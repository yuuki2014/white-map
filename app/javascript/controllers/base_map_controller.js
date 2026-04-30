import { Controller } from "@hotwired/stimulus"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import ngeohash from 'ngeohash';
import { get } from "@rails/request.js"
import * as turf from "@turf/turf"
import { Protocol } from "pmtiles";

// 定数定義
const INITIAL_ZOOM_LEVEL = 17;    // 初期のズームレベル
const DEBUG_MODE = false;
const USE_WEBGL_FOG = true;

// Connects to data-controller="base-map"
export default class extends Controller {
  static styleJsonCache = null;
  static outlets = [ "ui", "posts" ]
  static targets = [ "mapOverlay", "appendMarker" ]
  static values = { longitude: Number,
                    latitude: Number,
                    posts: Array,
                  }

  connect(_element) {
    console.log("base mapのconnect実行")
    // 初期化
    this.mapInitEnd = false; // 初期化終了フラグ
    this.clearMapOverlayEnd = false; // 初期のマップオーバーレイクリアフラグ
    this.isPostModeActive = false; // 投稿モードの状態管理変数を定義
    this.markers = {}; // マーカーを保存するオブジェクト

    // 前のが残っていた時に備えて最初に消してからアボートコントローラーをセット
    this.ac?.abort();
    const abortController = new AbortController();
    this.ac = abortController;

    // 累計地図をセット
    this.cumulativeGeohashes = new Set();
    this.cumulativeFeature = null;

    // 世界を覆う霧のマスク
    // this.worldFeature = turf.polygon([[
    //   [-180, 90],
    //   [-180, -90],
    //   [180, -90],
    //   [180, 90],
    //   [-180, 90]
    // ]]);
  }

  disconnect(_element){
    console.log("base map disconnect")

    // アボートでフェッチやイベントリスナーを止める
    this.ac?.abort();
    this.ac = null;
    console.log("アボート:this.ac=",this.ac)

    if (this.map) {
      this.map.remove(); // 地図機能の停止、削除
      this.map = null; // 参照も切る
      console.log("map 消去:", this.map)
    }
  }

  // 地図の初期化
  async initializeMap(center){
    if (!this.ac) return;

    // プロトコル登録
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const signal = this.ac.signal;

    try {
      // 地図のstyleを取得
      const styleJson = await this.loadStyleJson(signal);

      if (signal.aborted || !this.element.isConnected) return; // もし connect 中に遷移してたらreturn

      this.styleJson = styleJson;
    } catch (error) {
      if (error.name === "AbortError") {
        console.debug("ページ遷移によるエラー", error);
        return;
      }
      console.error("style読み込み時の想定外エラー", error);
      this.styleJson = this.getFallbackStyle();
    }

     // 地図の初期化
    this.map = new maplibregl.Map({
      container: this.element,
      style: this.styleJson,
      center: center,
      zoom: INITIAL_ZOOM_LEVEL,
      attributionControl: false,
    });
  }

  async loadStyleJson(signal){
    if(this.constructor.styleJsonCache) {
      console.log("前回のを使用")
      return structuredClone(this.constructor.styleJsonCache);
    }

    const styleUrl = this.element.dataset.styleUrl;

    try {
      const res = await fetch(styleUrl, { signal: signal });
      if(!res.ok) throw new Error(`fetch失敗: ${res.status}`);

      const styleJson = await res.json();
      this.constructor.styleJsonCache = structuredClone(styleJson);
      return structuredClone(styleJson);
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      console.log("style.json の取得失敗", error);
      return this.getFallbackStyle();
    }
  }

  getFallbackStyle() {
    return {
      version: 8,
      sources: {
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#1955A6"
          }
        },
      ]
    };
  }

  // 渡されたgeohash配列から、結合済みのFeatureを作って返す
  generateFeatureFromGeohashes(visitedGeohashes = [], targetGeohashesSet) {
    if (visitedGeohashes.length === 0) return null;

    // 訪問済みgeohashから周囲の開放するgeohashを重複抜きで取得する
    visitedGeohashes.forEach((geohash) => {
      this.addGeohashesAndGetNew(geohash, targetGeohashesSet)
    });

    return;

    // geohashから開放するポリゴンの配列を作成
    const polygonsToMerge = [...targetGeohashesSet].map(hash => this.createPolygonFromGeohash(hash));

    if (polygonsToMerge.length === 1) {
      return polygonsToMerge[0];
    }

    // 分割でマージ
    const chunkSize = 100; // 100個のずつに分ける
    const intermediatePolygons = []; // 塊を保存する配列

    // 100個ずつ四角形だけをマージして塊を複数作る
    for (let i = 0; i < polygonsToMerge.length; i += chunkSize) {
      const chunk = polygonsToMerge.slice(i, i + chunkSize);
      try {
        // chunkだけのFeatureCollectionを作ってマージ
        const mergedChunk = turf.union(turf.featureCollection(chunk));
        if (mergedChunk) {
          intermediatePolygons.push(mergedChunk);
        }
      } catch (e) {
        console.warn("Union chunk failed, skipping this chunk...", e);
      }
    }

    // 塊たちを一気にマージする
    try {
      if (intermediatePolygons.length === 1) {
        return intermediatePolygons[0];
      }
      return turf.union(turf.featureCollection(intermediatePolygons));
    } catch (e) {
      console.error("Final union failed, falling back to sequential merge...", e);
      // マージでエラーになったら雪だるま式でリカバリー
      let fallbackResult = intermediatePolygons[0];
      for (let i = 1; i < intermediatePolygons.length; i++) {
        fallbackResult = turf.union(turf.featureCollection([fallbackResult, intermediatePolygons[i]]));
      }
      return fallbackResult;
    }
  }

  addGeohashesAndGetNew(currentGeohash, visitedGeohashes) {
    if(!currentGeohash) return [];

    const newGeohashes = [];
    const candidates = new Set();

    candidates.add(currentGeohash);

    // 現在地の周囲8つのgeohashを取得
    const neighbors = ngeohash.neighbors(currentGeohash);
    neighbors.forEach(hash => candidates.add(hash));

    // 周囲8つのさらに周りのgeohashを取得
    for (const hash of neighbors) {
      const aroundNeighbors = ngeohash.neighbors(hash);
      aroundNeighbors.forEach(hash => candidates.add(hash));
    }

    // 保持していないものを追加
    for (const hash of candidates) {
      if (visitedGeohashes.has(hash)) continue // すでに保持していた場合はスキップ
      visitedGeohashes.add(hash);
      newGeohashes.push(hash);
    }

    return newGeohashes
  }

  // geohashのポリゴンを作成
  createPolygonFromGeohash(hash){
    const [minLat, minLon, maxLat, maxLon] = ngeohash.decode_bbox(hash); // geohashをデコードしてbboxの形式に4点を取得
    const bbox = [minLon, minLat, maxLon, maxLat]; // turfのbbox用に並び替える

    return turf.bboxPolygon(bbox);
  }

  // 投稿モードアクティブ
  enablePostPositionMode(){
    if(this.isPostModeActive) return

    if(this.hasPostsOutlet) {
      this.postsOutlet.lngValue = null;
      this.postsOutlet.latValue = null;
    }
    this.currentMarker = null;

    this.map.on('click', this.handlePostMapClick);
    this.isPostModeActive = true;
  }

  // 投稿モード非アクティブ
  disablePostPositionMode(){
    if(!this.isPostModeActive) return;

    if(this.currentMarker) {
      this.currentMarker.remove()
      this.currentMarker = null;
    }
    this.map.off('click', this.handlePostMapClick);
    this.isPostModeActive = false;
  }

  // 投稿モード時にクリックで呼ばれるコールバック関数
  handlePostMapClick = (e) => {
    const{ lng, lat } = e.lngLat;

    if (this.currentMarker) {
      // マーカーがある場合はマーカーの場所を更新
      this.currentMarker.setLngLat([lng, lat]);
    } else {
      // マーカーがない場合は新たにマーカーを作成して地図に追加
      this.currentMarker = new maplibregl.Marker({color: "#00CCFF"})
        .setLngLat([lng, lat])
        .addTo(this.map)
    }
    if(this.hasPostsOutlet) {
      this.postsOutlet.lngValue = lng
      this.postsOutlet.latValue = lat
    }
  }

  // postsValueのデータを全てマップに追加
  addMarkers(){
    // データがない場合は何もしない
    console.log(this.postsValue);
    if(!this.hasPostsValue) return;
    if (!this.postsValue?.length) return

    // postsValueのデータをpopupで追加
    this.postsValue.forEach(post => {
      this.createPopup(post);
    })
  }

  removeMarker(postUid){
    this.markers[postUid]?.remove();
    delete this.markers[postUid];
  }

  // appendMarkerTargetが接続されたときにマップにマーカーを追加
  appendMarkerTargetConnected(element){
    const post = JSON.parse(element.dataset.post)

    // targetのpostのデータをpopupで追加
    this.createPopup(post);

    element.remove() // 使い終わったら消す
  }

  createPopup(post){
    // マーカーを作成
    const marker = new maplibregl.Marker({
      color: "#FF5733", // ピンの色
      // element: el // 独自画像アイコン
    })
    .setLngLat([post.longitude, post.latitude]) // 座標をセット
    .addTo(this.map) // 地図に追加

    const el = marker.getElement();

    el.setAttribute("data-action", `click->${this.identifier}#openPostPreview`);

    el.setAttribute("data-post-uid", post.public_uid);
    el.setAttribute("data-post-lng", post.longitude);
    el.setAttribute("data-post-lat", post.latitude);

    this.markers[post.public_uid] = marker;
  }

  openPostPreview(event) {
    const el = event.currentTarget;

    const uid = el.getAttribute("data-post-uid");
    const lng = parseFloat(el.getAttribute("data-post-lng"));
    const lat = parseFloat(el.getAttribute("data-post-lat"));
    const moveHeight = window.innerHeight / 4;

    const point = this.map.project([lng, lat]); // マーカーの緯度経度を画面上のピクセル座標に変換
    point.y += moveHeight; // yを移動
    const newCenter = this.map.unproject(point); // ずらしたピクセル座標を緯度軽度に変換

    this.map.easeTo({
      center: newCenter,
      duration: 500,
    });

    get(`/posts/${uid}/preview`, { responseKind: "turbo-stream" });
  }

  // 霧の初期化
  fogInit(){
    if (USE_WEBGL_FOG){
      // 文字レイヤー（Symbol）のIDを探す
      // const layers = this.map.getStyle().layers;
      // let firstSymbolId = null;
      // for (const layer of layers) {
      //   if (layer.type === 'symbol') {
      //     firstSymbolId = layer.id;
      //     break;
      //   }
      // }

      this.fogCustomLayer = new GeohashFogCustomLayer({
        id: "geohash-fog-custom-layer",
        opacity: 0.9,
      });

      if (!this.map.getLayer('geohash-fog-custom-layer')) {
        this.map.addLayer(this.fogCustomLayer);
        // this.map.addLayer(this.fogCustomLayer, firstSymbolId);
      }
    } else {
      if (!this.map.getSource('fog')) {
        this.map.addSource('fog', {
          type: 'geojson',
          data: this.worldFeature
        });
      }

      if (!this.map.getLayer('fog-layer')) {
        this.map.addLayer({
          id: 'fog-layer',
          type: "fill",
          source: 'fog',
          paint: {
            "fill-color": "#ffffff",
            "fill-opacity": 0.9,
            'fill-antialias': false,
          }
        });
      }
    }
  }

  // 霧の更新
  updateFog(geojsonData){
    if(!this.map.getSource('fog')){
      this.fogInit();
    }

    const source = this.map.getSource(`fog`);
    source.setData(geojsonData);
  }

  updateCustomFogLayer() {
    if (!this.fogCustomLayer) return

    const visibleHashes = this.getVisibleClearedGeohashes()

    this.fogCustomLayer.setHashes(visibleHashes)
    this.map.triggerRepaint()
  }

  setFogOpacity(opacity){
    // if(this.map){
    //   this.map.setPaintProperty('fog-layer', 'fill-opacity', opacity);
    // }
    if (this.fogCustomLayer) {
      this.fogCustomLayer.opacity = opacity;
      this.map.triggerRepaint(); // 再描画
    }
  }

  // 累計地図セット
  setCumulativeGeohashesAndFeature(cumulativeGeohashes){
    if(this.cumulativeModeStatus === "loading" || this.cumulativeModeStatus === "isReady") return;
    this.cumulativeModeStatus = "loading"

    return fetch("/api/v1/my_map", { signal: this.ac.signal })
      .then(res => {
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (this.ac.signal.aborted || !this.element.isConnected) return;

        // this.cumulativeFeature = this.generateFeatureFromGeohashes(data.geohashes, cumulativeGeohashes);
        this.generateFeatureFromGeohashes(data.geohashes, cumulativeGeohashes);

        // console.log(this.cumulativeFeature)

        this.cumulativeModeStatus = "isReady"
      })
      .catch((e) => {
        this.cumulativeModeStatus = "notReady"
        this.uiOutlet.disableCumulative();
        if (e.name == "AbortError") {
          console.debug("ページ遷移によるエラー", e);
          return;
        }
        console.error(e);
      });
  }

  // 解放ずみgeohashを取得
  getVisibleClearedGeohashes() {
    if (!this.map) return []

    const merged = new Set()

    if (this.cumulativeMode && this.cumulativeGeohashes) {
      this.cumulativeGeohashes.forEach(hash => merged.add(hash))
    }

    if (this.visitedGeohashes) {
      this.visitedGeohashes.forEach(hash => merged.add(hash))
    }

    // return this.filterVisibleGeohashes(merged)
    return Array.from(merged)
  }

  // 現在の描画範囲内のgeohashを返す
  filterVisibleGeohashes(geohashes) {
    const bounds = this.map.getBounds() // 現在の表示範囲を取得

    const west = bounds.getWest()
    const east = bounds.getEast()
    const south = bounds.getSouth()
    const north = bounds.getNorth()

    return Array.from(geohashes).filter(hash => {
      const bbox = ngeohash.decode_bbox(hash)

      const minLat = bbox[0]
      const minLng = bbox[1]
      const maxLat = bbox[2]
      const maxLng = bbox[3]

      return !(
        maxLng < west ||
        minLng > east ||
        maxLat < south ||
        minLat > north
      )
    })
  }

  setFogColor(r, g, b) {
    if (this.fogCustomLayer) {
      this.fogCustomLayer.color = [r / 255, g / 255, b / 255];
      this.map.triggerRepaint();
    }
  }
}


class GeohashFogCustomLayer {
  constructor({ id = "geohash-fog-custom-layer", opacity = 0.65, color = [1.0, 1.0, 1.0] } = {}) {
    this.id = id;
    this.type = "custom";
    this.renderingMode = "2d";

    this.visible = true;
    this.opacity = opacity;
    this.color = color;
    this.hashes = [];
    this.vertexData = new Float32Array([]);

    // アンカー座標（メルカトル座標系）
    this.anchor = { x: 0, y: 0 };

    // WebGLリソース
    this.gl = null;
    this.cellProgram = null;
    this.fogProgram = null;
    this.cellBuffer = null;
    this.fullscreenBuffer = null;
  }

  // 表示するGeohashを更新し、頂点バッファを再構築する
  setHashes(hashes) {
    this.hashes = hashes || [];

    // アンカーの設定
    // 描画対象がある場合、最初のGeohashの中心付近を基準点にする。高ズーム時でも頂点座標の有効桁数が保たれる
    if (this.hashes.length > 0) {
      const firstBbox = ngeohash.decode_bbox(this.hashes[0]);
      const center = maplibregl.MercatorCoordinate.fromLngLat({
        lng: (firstBbox[1] + firstBbox[3]) / 2,
        lat: (firstBbox[0] + firstBbox[2]) / 2
      });
      this.anchor.x = center.x;
      this.anchor.y = center.y;
    }

    // 頂点データの構築
    this.vertexData = this.buildVertexData(this.hashes);

    // GPUバッファの更新
    if (this.gl && this.cellBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cellBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertexData, this.gl.DYNAMIC_DRAW);
    }
  }

  // Geohashの配列を三角形ポリゴンの頂点配列に変換。座標は this.anchor からの相対値として計算
  buildVertexData(hashes) {
    const vertices = [];

    for (const hash of hashes) {
      const bbox = ngeohash.decode_bbox(hash);

      // メルカトル座標を取得
      const p1 = maplibregl.MercatorCoordinate.fromLngLat({ lng: bbox[1], lat: bbox[0] });
      const p2 = maplibregl.MercatorCoordinate.fromLngLat({ lng: bbox[3], lat: bbox[0] });
      const p3 = maplibregl.MercatorCoordinate.fromLngLat({ lng: bbox[3], lat: bbox[2] });
      const p4 = maplibregl.MercatorCoordinate.fromLngLat({ lng: bbox[1], lat: bbox[2] });

      // アンカーからの差分を計算
      const x1 = p1.x - this.anchor.x, y1 = p1.y - this.anchor.y;
      const x2 = p2.x - this.anchor.x, y2 = p2.y - this.anchor.y;
      const x3 = p3.x - this.anchor.x, y3 = p3.y - this.anchor.y;
      const x4 = p4.x - this.anchor.x, y4 = p4.y - this.anchor.y;

      // 1つのGeohash(四角形)を2つの三角形に分割
      vertices.push(
        x1, y1,
        x2, y2,
        x3, y3,

        x1, y1,
        x3, y3,
        x4, y4,
      );
    }

    return new Float32Array(vertices);
  }

  // レイヤーがマップに追加された時の初期化処理
  onAdd(map, gl) {
    this.map = map;
    this.gl = gl;

    // セル描画用プログラム（stencil用）
    this.cellProgram = this.createProgram(
      gl,
      `
        precision highp float;
        attribute vec2 a_pos;
        uniform mat4 u_matrix;
        void main() {
          gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
        }
      `,
      `
        precision highp float;
        void main() {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
      `
    );

    // 画面全体を覆う霧用プログラム
    this.fogProgram = this.createProgram(
      gl,
      `
        precision highp float;
        attribute vec2 a_pos;
        void main() {
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `,
      `
        precision highp float;
        uniform float u_opacity;
        uniform vec3 u_color;

        void main() {
          gl_FragColor = vec4(u_color * u_opacity, u_opacity);
        }
      `
    );

    this.cellBuffer = gl.createBuffer();

    // フルスクリーン描画用の四角形バッファ
    this.fullscreenBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,  1, -1,  1,  1,
        -1, -1,  1,  1, -1,  1,
      ]),
      gl.STATIC_DRAW
    );
  }

  // 毎フレームの描画処理
  render(gl, args) {
    if (!this.cellProgram || !this.fogProgram || !this.visible) return;

    // MapLibreの行列(4x4)をコピーして修正を加える
    const matrix = [...args.defaultProjectionData.mainMatrix];

    // 行列に対して、アンカー分の移動を適用。相対座標で計算された頂点が正しい位置にレンダリングされる
    this.translateMatrix(matrix, this.anchor.x, this.anchor.y);


    // ステンシルマスクを「書き込み許可」にする.gl.clear(gl.STENCIL_BUFFER_BIT) が効かない場合があるから
    gl.stencilMask(0xff);

    // 深度テストとブレンドの設定
    gl.disable(gl.DEPTH_TEST); // 霧が地図の下に隠れないようにする
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ステンシルバッファを完全にクリア
    gl.enable(gl.STENCIL_TEST);
    gl.clearStencil(0);
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // 晴れている場所をステンシルに記録
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

    gl.useProgram(this.cellProgram);
    const matrixLocation = gl.getUniformLocation(this.cellProgram, "u_matrix");
    gl.uniformMatrix4fv(matrixLocation, false, matrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cellBuffer);
    const cellPosLocation = gl.getAttribLocation(this.cellProgram, "a_pos");
    gl.enableVertexAttribArray(cellPosLocation);
    gl.vertexAttribPointer(cellPosLocation, 2, gl.FLOAT, false, 0, 0);

    const cellVertexCount = this.vertexData.length / 2;
    if (cellVertexCount > 0) {
      gl.drawArrays(gl.TRIANGLES, 0, cellVertexCount);
    }

    // ステンシルが1以外の場所に霧を塗る
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

    gl.useProgram(this.fogProgram);

    const opacityLocation = gl.getUniformLocation(this.fogProgram, "u_opacity");
    gl.uniform1f(opacityLocation, this.opacity);

    const colorLocation = gl.getUniformLocation(this.fogProgram, "u_color")
    gl.uniform3f(colorLocation, this.color[0], this.color[1], this.color[2])

    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
    const fogPosLocation = gl.getAttribLocation(this.fogProgram, "a_pos");
    gl.enableVertexAttribArray(fogPosLocation);
    gl.vertexAttribPointer(fogPosLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 後片付けMapLibreの次のレイヤー描画に影響を与えないため
    gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(0x00); // ステンシル書き込みを禁止に戻す
  }

  // 4x4 行列（列優先配列）に平行移動を適用するヘルパー
  translateMatrix(m, tx, ty) {
    // 列優先(column-major)行列の移動成分(m12, m13, m14, m15)を更新
    m[12] = m[0] * tx + m[4] * ty + m[12];
    m[13] = m[1] * tx + m[5] * ty + m[13];
    m[14] = m[2] * tx + m[6] * ty + m[14];
    m[15] = m[3] * tx + m[7] * ty + m[15];
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error);
    }
    return shader;
  }

  createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(error);
    }
    return program;
  }
}
