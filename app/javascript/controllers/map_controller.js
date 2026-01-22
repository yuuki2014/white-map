import { Controller } from "@hotwired/stimulus"
import { STATUS } from "../constants/status"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { get } from "@rails/request.js"
import ngeohash from 'ngeohash';
import { getDistance } from 'geolib'
import * as turf from "@turf/turf"

// 定数定義
const PERMISSION_DENIED   = 1;    // 位置情報不許可時のerror値
const GEOHASH_PRECISION   = 9;    // 保存するgeohash精度
const MIN_DISTANCE_METERS = 30;   // 30メートル
const FORCE_RECORD_MS     = 3000; // 3000ミリ秒 (記録間隔の最大値)
const FLUSH_INTERVAL_MS   = 6000; // 6000ミリ秒 (送信間隔)
const GEOLOCATE_TIMEOUT = 10000;  // 10秒（現在地取得タイムアウト）
const INITIAL_ZOOM_LEVEL = 17;    // 初期のズームレベル
const MAP_OVERLAY_TIMEOUT = 5000; // マップオーバーレイを消すまでタイムアウト時間
const MAP_OVERLAY_DISTANCE = 100; // マップオーバーレイを消すまで距離

// Connects to data-controller="map"
export default class extends Controller {
  static targets = [ "mapOverlay" ]
  static values = { longitude: String,
                    latitude : String
                  }

  async connect() {
    console.log("stimulus map 接続確認")

    // 前のが残っていた時に備えて最初に消してからアボートコントローラーをセット
    this.ac?.abort();
    const abortController = new AbortController();
    this.ac = abortController;

    // 自作イベント発火用
    // 規約同意時にmap:geolocateが発火して位置情報を取得
    // startGeolocateをwindowにセットする様にthisを固定してセット
    this._onWindowGeolocate ??= this.startGeolocate.bind(this)
    window.addEventListener("map:geolocate", this._onWindowGeolocate, { signal: abortController.signal });

    if (abortController.signal.aborted || !this.element.isConnected) return; // もし connect 中に遷移してたらreturn

    this.mapInitEnd         = false; // 地図の初期化フラグ
    this.clearMapOverlayEnd = false; // 初期表示されているオーバレイ要素のクリアフラグ

    const apiKey = this.element.dataset.maptilerKey;

    try {
      // 地図のstyleを取得
      const res = await fetch(`https://api.maptiler.com/maps/jp-mierune-dark/style.json?key=${apiKey}`, { signal: abortController.signal })
      this.styleJson = await res.json();
      if (abortController.signal.aborted || !this.element.isConnected) return; // もし connect 中に遷移してたらreturn
    } catch (e) {
      if (e.name == "AbortError") {
        console.debug("ページ遷移によるエラー", e);
        return;
      }
      console.error(e);
    }


    // ステータスを初期化
    this.status = STATUS.STOPPED;

    // 現在の緯度経度を初期化
    this.currentLng = null;
    this.currentLat = null;

    // 最後にfootprintを送った時間を覚えておく変数
    this.lastSentAt = 0;

    // 最後に保存したgeohashを覚えておく変数
    this.lastSentGeohash = "";

    // 最後に保存した座標
    this.lastSavedCoords = null;

    // データを溜めておくための配列
    this.footprintBuffer = []

    // 現在地を初期化
    await this.geolocateInit()

    if (abortController.signal.aborted || !this.element.isConnected) return; // もし connect 中に遷移してたらreturn

    // TurfのFeatureオブジェクトとして管理
    this.visitedFeature = null;
    this.visitedGeohashes = new Set()

    // 世界を覆う霧のマスク
    this.worldFeature = turf.polygon([[
      [-180, 90],
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90]
    ]]);

    // 地図の初期化
    this.map = new maplibregl.Map({
      container: this.element,
      style: this.styleJson,
      center: this.center,
      zoom: INITIAL_ZOOM_LEVEL,
      attributionControl: false,
    });

    // maplibreglのアトリビューションを画面右上に表示
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

    // 自作パルスを作成して位置を0,0で表示
    const pulseEl = document.createElement('div');
    pulseEl.className = 'my-pulse-marker';

    this.pulseMarker = new maplibregl.Marker({
      element: pulseEl,
      offset: [ 0, 0 ]
    }).setLngLat([0,0]).addTo(this.map);

    // 現在地追跡機能をセット
    this.geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        // 高精度（GPS）モードを有効に
        enableHighAccuracy: true,
        // 10秒(10000ms)以内のデータなら再利用
        maximumAge: 10000
      },
      // 移動に合わせてドットが動く
      trackUserLocation: true,
      // スマホの向いている方角を表示
      showUserHeading: true,
      // GPSの誤差の範囲を表示
      showAccuracyCircle: false,
      // ズームカメラの設定
      fitBoundsOptions: {
      }
    });

    // 地図に現在地を追加。右上にボタン
    this.map.addControl(this.geolocate);

    // 元々のtriggerを保存
    const originalTrigger = this.geolocate.trigger.bind(this.geolocate);

    // triggerを上書き
    this.geolocate.trigger = () => {
      // 現在のズームレベルを取得
      const currentZoom = this.map.getZoom();

      // オプションを現在のズームレベルで書き換え
      this.geolocate.options.fitBoundsOptions = {
        maxZoom: currentZoom,
        minZoom: currentZoom,
        linear: true,
        // duration: 5000
      }

      return originalTrigger();
    }

    this.map.on('zoomend', () => {
      // 現在地追従機能が存在しない場合は無視
      if (!this.geolocate) return;

      const currentZoom = this.map.getZoom();

      // maxとminのズームを現在のズームに固定
      this.geolocate.options.fitBoundsOptions.maxZoom = currentZoom;
      this.geolocate.options.fitBoundsOptions.minZoom = currentZoom;
    });

    // on.geolocate用ハンドラ
    this._onGeolocate = (data) => {
      const lng = data.coords.longitude; // 経度
      const lat = data.coords.latitude;  // 緯度
      const recordTime = new Date(data.timestamp).toISOString(); // 取得時間
      const lngInput = document.getElementById("longitude");
      const latInput = document.getElementById("latitude");
      const geohash = ngeohash.encode(lat, lng, GEOHASH_PRECISION); // geohashを計算
      lngInput.value = lng;
      latInput.value = lat;

      // 自作パルスの現在地を更新
      this.pulseMarker.setLngLat([lng, lat]);

      this.currentLng = lng;
      this.currentLat = lat;
      this.currentGeohash = geohash;
      this.currentRecordTime = recordTime;

      // 霧の更新
      if (this.status !== STATUS.PAUSED) {
        this.executeFogClearing()
      }

      this.mapInitEnd = true;
      this.maybeClearOverlay();

      // status が RECORDING になっている場合に保存
      if(this.status === STATUS.RECORDING) {

        // 保存判定ロジック
        const now = Date.now(); // 現在の時刻
        const timeElapsed = now - this.lastSentAt; //経過時刻

        // 前回からの距離を算出
        const distanceMoved = this.lastSavedCoords ? getDistance(this.lastSavedCoords, { latitude: this.currentLat, longitude: this.currentLng }) : 99999;

        // 保存条件
        const isNewTile = this.lastSentGeohash !== this.currentGeohash; // geohashが前回から更新されている場合
        const isMoveEnough = distanceMoved > MIN_DISTANCE_METERS;       // 前回より一定の距離以上移動している場合
        const isTimeOut = timeElapsed > FORCE_RECORD_MS;                // 移動していなくても一定時間が経過

        // どれか一つの条件にでも当てはまった場合は保存
        if( isNewTile || isMoveEnough || isTimeOut ) {
          console.log(`保存トリガー: [Tile:${isNewTile}, Dist:${distanceMoved}m, Time:${isTimeOut}]`);

          // 保存用データをセット
          const data = {
            trip_id:     this.tripId,
            latitude:    this.currentLat,
            longitude:   this.currentLng,
            recorded_at: this.currentRecordTime,
          }

          // 配列に保存用データを格納
          this.footprintBuffer.push(data);
          console.log("バッファデータを追加:", this.footprintBuffer)

          // this.postFootprint();
          // 保存判定用に今回のデータを格納
          this.lastSentAt = now;
          this.lastSentGeohash = geohash;
          this.lastSavedCoords = { latitude: data.latitude, longitude: data.longitude }
        }
      }
    };

    // 現在地を取得
    this.geolocate.on('geolocate', this._onGeolocate);

    // 非表示にする地図上の情報
    const toHide = [
      "Restaurant and shop",
      "Store and mall",
      "Pub",
      "Hotel",
      "Generic POI",
      "Generic POI 11",
      "Major POI",
      "Doctor",
      "Parking",
      "Government",
      "Golf pitch",
    ];

    // 地図の読み込みが終わった後に実行
    this.map.on('load', () => {
      // 霧を初期化
      this.fogInit()

      toHide.forEach(id => {
        if (this.map.getLayer(id)) {
          this.map.setLayoutProperty(id, "visibility", "none");
        }
      });

      // 地図上の現在地ボタンを起動
      if(this.hasAccepted === "true"){
        this.geolocate.trigger();
      } else {
        this.mapInitEnd = true;
        this.maybeClearOverlay();
      }


      // // ▼▼▼ デバッグ用：クリックで霧を晴らす ▼▼▼
      // this.map.on('click', (e) => {
      //   const { lng, lat } = e.lngLat;

      //   // クリックした場所をGeohash（精度9）に変換
      //   const clickHash = ngeohash.encode(lat, lng, 9);

      //   console.log(`クリック地点: ${lat}, ${lng} -> ${clickHash}`);

      //   // その場所を中心に霧を晴らす処理を実行
      //   this.debugClearFogAt(clickHash);
      // });
    })

    // アイコンが足りない時のダミー追加。後で正しいアイコンが表示されるように設定する
    this.map.on('styleimagemissing', (event) => {
      const id = event.id;
      // すでに追加済みなら何もしない
      if (this.map.hasImage(id)) return;

      // 透明 1x1 のダミー画像を登録
      const empty = new Uint8Array([0, 0, 0, 0]);
      this.map.addImage(id, { width: 1, height: 1, data: empty });
    });
  }

  getCurrentPosition() {
    return new Promise ((resolve, reject) => {
      // オプションを設定
      const options = {
        enableHighAccuracy: true,
        timeout: GEOLOCATE_TIMEOUT,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  disconnect() {
    console.log("disconnect:", this.map)

    // アボートでフェッチやイベントリスナーを止める
    this.ac?.abort();
    this.ac = null;

    // 自作マーカーを削除
    if (this.pulseMarker) {
      this.pulseMarker.remove();
      this.pulseMarker = null;
    }

    if (this.map) {
      if (this.geolocate) {
        this.geolocate.off('geolocate', this._onGeolocate);
      }

      this.map.remove(); // 地図機能の停止、画面から削除
      this.map = null; // 参照も切る
      console.log("map 消去:", this.map)
    }

    if(this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushBuffer();
    }
    if(this.status === STATUS.RECORDING){
      this.postFootprint();
    }
  }

  getCookie(name) {
    return document.cookie.split("; ").find(row => row.startsWith(`${name}=`))?.split("=")[1];
  }

  async startGeolocate(){
    if (!this.geolocate) {
      console.log("geolocateが準備できてません")
      return
    }
    // 現在地を初期化
    await this.geolocateInit()
    this.geolocate.trigger();
    this.fog
  }

  async geolocateInit(){
    this.hasAccepted = this.getCookie("terms_accepted");

    if(this.hasAccepted === "true"){
      // 現在地を取得
      try {
        // getCurrentPosition関数で現在地を取得
        const position = await this.getCurrentPosition();

        if (this.ac?.signal.aborted || !this.element.isConnected) return; // 途中で終了していた場合はreturn

        // 取得できたら現在地で中央を書き換え
        this.center = [ position.coords.longitude, position.coords.latitude ];
      } catch (error) {
        console.log("位置情報が取得できなかったのでデフォルトの中央を設定", error);
        // デフォルトの中央
        this.center = [ 139.745, 35.658 ];

        // 現在地機能が許可されていない場合にモーダルを表示
        if(error.code === PERMISSION_DENIED) {
          this.showLocationDeniedModal()
        }
      }
    }
  }

  clearModal(){
    const container = document.getElementById("modal-container");
    if (container) {
      setTimeout(() => {
        container.innerHTML = "";
      },100)
    }
  }

  setStatus(uiStatus){
    this.status = uiStatus;
  }

  setTripId(id) {
    this.tripId = id
  }

  // ターボストリームで位置情報が許可されていない時のモーダルを表示
  showLocationDeniedModal() {
    get("/location_denied", { responseKind: "turbo-stream" });
  }

  // 単発のfootprint保存
  async postFootprint() {
    console.log("postFootprint起動")
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content

    const data = {
      trip_id:     this.tripId,
      latitude:    this.currentLat,
      longitude:   this.currentLng,
      recorded_at: this.currentRecordTime,
    }

    const response = await fetch(`/api/v1/trips/${this.tripId}/footprints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "same-origin",
      body: JSON.stringify(data),
    });

    if(!response.ok) {
      const errorData = await response.json();

      console.debug("postFootprint:位置情報の保存に失敗しました", errorData.errors)
      return;
    }

    console.log("postFootprint:位置情報の保存に成功しました");
  }

  // 溜めたバッファを送信するためのフラッシュタイマー
  setFlushTimer(){
    console.log("バッファ送信用タイマーをセット")
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, FLUSH_INTERVAL_MS);
  }

  // 溜めたバッファを一気にポスト
  async flushBuffer(){
    if(!this.footprintBuffer?.length) return;

    const csrfToken = document.querySelector('meta[name="csrf-token"]').content

    // データ送信用の浅いコピーを作成
    const dataToSend = [...this.footprintBuffer];

    try {
      console.log(`${dataToSend.length}件のデータを送信中...`);
      const response = await fetch(`/api/v1/trips/${this.tripId}/footprints/bulk_create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ footprints: dataToSend })
      })

      const result = await response.json()
      console.log(result)

      // 保存失敗時はエラー
      if(!response.ok) throw new Error("footprints一括送信失敗");

      // 保存成功次はバッファをクリア
      this.footprintBuffer = this.footprintBuffer.filter(item => !dataToSend.includes(item));
      console.log("送信成功。現在のバッファ:", this.footprintBuffer);
    } catch(error) {
      console.warn("送信失敗。データを保持して次回リトライします", error);
    }
  }

  clearFlushTimer(){
    if(this.flushTimer) {
      console.log("flushTimerを停止")
      clearInterval(this.flushTimer);
    }
  }

  // 現在地を取得できているのかチェック
  checkGeolocate(event){
    if(this.currentLng && this.currentLat) return; // 現在地が取得できているのであれば何もしない
    event.preventDefault();                        // 現在地が取得できていない場合はeventを行わないようにする
  }

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

  createPolygonFromGeohash(hash){
    const [minLat, minLon, maxLat, maxLon] = ngeohash.decode_bbox(hash); // geohashをデコードしてbboxの形式に4点を取得
    const bbox = [minLon, minLat, maxLon, maxLat]; // turfのbbox用に並び替える

    return turf.bboxPolygon(bbox);
  }

  addGeohashesAndGetNew(){
    const newGeohashes = []

    // 現在地の周囲8方向のgeohashを取得
    const neighbors = ngeohash.neighbors(this.currentGeohash);
    const aroundGeohashes = [this.currentGeohash, ...neighbors];

    // 保持していないものを追加
    for (const hash of aroundGeohashes) {
      if (this.visitedGeohashes.has(hash)) continue // すでに保持していた場合はスキップ
      this.visitedGeohashes.add(hash);
      newGeohashes.push(hash);
    }

    return newGeohashes
  }

  updateFog(geojsonData){
    if(!this.map.getSource('fog')){
      this.fogInit();
    }

    const source = this.map.getSource(`fog`);
    source.setData(geojsonData);
  }

  resetFog() {
    this.visitedFeature = null;
    this.visitedGeohashes.clear();

    const targetHash = this.currentGeohash;
    const neighbors = ngeohash.neighbors(targetHash);
    const hashesToClear = [targetHash, ...neighbors];

    const polygonsToMerge = hashesToClear.map(hash => this.createPolygonFromGeohash(hash));

    let feature = null;

    if (polygonsToMerge.length > 1) {
      // 配列をFeatureCollectionに変換してから、unionに渡す
      const featureCollection = turf.featureCollection(polygonsToMerge);
      feature = turf.union(featureCollection);
    } else {
      feature = polygonsToMerge[0];
    }

    const fogPolygon = turf.difference(turf.featureCollection([this.worldFeature, feature]));

    this.updateFog(fogPolygon);
  }

  resetFogData() {
    this.visitedFeature = null;
    this.visitedGeohashes.clear();
  }

  executeFogClearing(){
    // console.log("execute実行")
    const newGeohashes = this.addGeohashesAndGetNew();
    // console.log(newGeohashes)

    if(newGeohashes.length === 0){
      console.log("新たに訪れた場所がないので何も実行しません")
      return;
    }

    // 今回追加するポリゴンを全て配列にする
    const polygonsToMerge = newGeohashes.map(hash => this.createPolygonFromGeohash(hash));

    // 過去のvisitedFeatureがあれば、それも配列に加える
    if (this.visitedFeature) {
      polygonsToMerge.push(this.visitedFeature);
    }

    if (polygonsToMerge.length > 1) {
      // 配列をFeatureCollectionに変換してから、unionに渡す
      const featureCollection = turf.featureCollection(polygonsToMerge);
      this.visitedFeature = turf.union(featureCollection);
    } else {
      this.visitedFeature = polygonsToMerge[0];
    }

    // 世界全体からvisitedを引いて霧を作る
    const fogPolygon = turf.difference(turf.featureCollection([this.worldFeature, this.visitedFeature]));

    if (fogPolygon) {
      this.updateFog(fogPolygon);
    } else {
      console.log("fogPolygonが見つかりません");
    }

    if(this.status === STATUS.STOPPED){
      // console.log("リセット")
      this.resetFogData();
    }
  }

  // 指定されたGeohashの周辺を晴らす（デバッグ・テスト用）
  debugClearFogAt(targetHash) {
    // 周囲8方向のgeohashを取得
    const neighbors = ngeohash.neighbors(targetHash);
    const hashesToClear = [targetHash, ...neighbors];

    const polygonsToMerge = hashesToClear.map(hash => this.createPolygonFromGeohash(hash));

     // 過去のvisitedFeatureがあれば、それも配列に加える
    if (this.visitedFeature) {
      polygonsToMerge.push(this.visitedFeature);
    }

    if (polygonsToMerge.length > 1) {
      // 配列をFeatureCollectionに変換してから、unionに渡す
      const featureCollection = turf.featureCollection(polygonsToMerge);
      this.visitedFeature = turf.union(featureCollection);
    } else {
      this.visitedFeature = polygonsToMerge[0];
    }

    // 世界全体からvisitedを引いて霧を作る
    const fogPolygon = turf.difference(turf.featureCollection([this.worldFeature, this.visitedFeature]));

    if (fogPolygon) {
      this.updateFog(fogPolygon);
    } else {
      console.log("fogPolygonが見つかりません");
    }

    if(this.status === STATUS.STOPPED){
      // console.log("リセット")
      this.resetFogData();
    }
  }

  // 地図表示前にマップを覆っているオーバーレイを消去
  clearMapOverlay(){
    if (this.clearMapOverlayEnd) return;

    const el = this.mapOverlayTarget
    if (!el) return;

    const fadeOut = () => {
      if (this.clearMapOverlayEnd) return;
      if (el.classList.contains("opacity-0")) return; // すでにopacity-0が含まれていたら何もしない

      this.clearMapOverlayEnd = true;

      el.classList.remove("opacity-100")
      el.classList.add("opacity-0")
      el.addEventListener("transitionend", () => {
        el.remove();
      }, { once: true })
    }

    // 移動が終了しているかチェック
    const checkArrival = () => {
      const center = this.map.getCenter(); // 現在の地図の中央を取得

      // 地図の中央とGPSから取得した現在地の距離を算出
      const distance = getDistance(
        { latitude: center.lat, longitude: center.lng },
        { latitude: this.currentLat, longitude: this.currentLng }
      );

      // 差が一定以下ならオーバーレイを消去
      if (distance < MAP_OVERLAY_DISTANCE) {
        fadeOut();
      } else {
        this.map.once("moveend", checkArrival); // まだ距離があるようなら再びセット
      }
    }

    // isMoving()で移動中か検知
    if (this.map.isMoving()) {
      this.map.once("moveend", checkArrival);

      // moveendがうまく機能しなかった時用にsetTimeoutをセット
      setTimeout(() => {
        fadeOut();
      }, MAP_OVERLAY_TIMEOUT);
    } else {
      fadeOut();
    }
  }

  maybeClearOverlay(){
    if (!this.mapInitEnd)          return; // まだ地図が初期化されてない
    if (!this.hasMapOverlayTarget) return; // まだ overlay target がない
    if (this.clearMapOverlayEnd)   return; // すでにoverlay削除済み

    this.clearMapOverlay();
  }

  // mapOverlayが接続された時に自動実行
  mapOverlayTargetConnected(_element) {
    this.maybeClearOverlay();
  }
}
