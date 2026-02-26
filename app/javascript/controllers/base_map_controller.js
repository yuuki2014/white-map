import { Controller } from "@hotwired/stimulus"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import ngeohash from 'ngeohash';
import * as turf from "@turf/turf"

// 定数定義
const INITIAL_ZOOM_LEVEL = 18;    // 初期のズームレベル

// Connects to data-controller="base-map"
export default class extends Controller {
  static outlets = [ "ui", "posts" ]
  static targets = [ "mapOverlay", "appendMarker" ]
  static values = { longitude: Number,
                    latitude: Number,
                    posts: Array,
                  }

  connect(_element) {
    // 初期化
    this.mapInitEnd = false; // 初期化終了フラグ
    this.clearMapOverlayEnd = false; // 初期のマップオーバーレイクリアフラグ
    this.isPostModeActive = false; // 投稿モードの状態管理変数を定義
    this.markers = []; // マーカーを保存する配列

    // 前のが残っていた時に備えて最初に消してからアボートコントローラーをセット
    this.ac?.abort();
    const abortController = new AbortController();
    this.ac = abortController;

    // 累計地図をセット
    this.cumulativeGeohashes = new Set();
    this.cumulativeFeature = null;

    // 世界を覆う霧のマスク
    this.worldFeature = turf.polygon([[
      [-180, 90],
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90]
    ]]);
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

    const signal = this.ac.signal;
    const apiKey = this.element.dataset.maptilerKey;

    try {
      // 地図のstyleを取得
      const res = await fetch(`https://api.maptiler.com/maps/jp-mierune-dark/style.json?key=${apiKey}`, { signal: signal });
      if(!res.ok) throw new Error(`fetch失敗: ${res.status}`);

      this.styleJson = await res.json();

      if (signal.aborted || !this.element.isConnected) return; // もし connect 中に遷移してたらreturn
    } catch (error) {
      if (error.name === "AbortError") {
        console.debug("ページ遷移によるエラー", error);
        return;
      }
      console.error("地図データの取得に失敗:",error);
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

  // 渡されたgeohash配列から、結合済みのFeatureを作って返す
  generateFeatureFromGeohashes(visitedGeohashes = [], targetGeohashesSet){
    if(visitedGeohashes.length === 0) return null;

    visitedGeohashes.forEach((geohash) => {
      this.addGeohashesAndGetNew(geohash, targetGeohashesSet)
    });

    // 今回追加するポリゴンを全て配列にする
    const polygonsToMerge = [...targetGeohashesSet].map(hash => this.createPolygonFromGeohash(hash));

    if (polygonsToMerge.length > 1) {
      // 配列をFeatureCollectionに変換してから、unionに渡す
      const featureCollection = turf.featureCollection(polygonsToMerge);
      return turf.union(featureCollection);
    } else {
      return polygonsToMerge[0];
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

  // appendMarkerTargetが接続されたときにマップにマーカーを追加
  appendMarkerTargetConnected(element){
    const post = JSON.parse(element.dataset.post)

    // targetのpostのデータをpopupで追加
    this.createPopup(post);

    element.remove() // 使い終わったら消す
  }

  createPopup(post){
    const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-2 text-gray-800">
            <p class="text-sm mb-1">${post.visited_at ? new Date(post.visited_at).toLocaleDateString() : ''}</p>
            <p class="font-bold whitespace-pre-wrap">${post.body}</p>
          </div>
        `)

    // マーカーを作成
    const marker = new maplibregl.Marker({
      color: "#FF5733", // ピンの色
      // element: el // 独自画像アイコン
    })
    .setLngLat([post.longitude, post.latitude]) // 座標をセット
    .setPopup(popup) // ポップアップを紐付け
    .addTo(this.map) // 地図に追加

    this.markers.push(marker);
  }

  // 霧の初期化
  fogInit(){
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

  // 霧の更新
  updateFog(geojsonData){
    if(!this.map.getSource('fog')){
      this.fogInit();
    }

    const source = this.map.getSource(`fog`);
    source.setData(geojsonData);
  }
}
