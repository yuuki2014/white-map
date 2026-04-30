import BaseMapController from "./base_map_controller.js"
import { STATUS } from "../constants/status"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import ngeohash from 'ngeohash';
import { getDistance } from 'geolib'
import * as turf from "@turf/turf"

// 定数定義
const GEOHASH_PRECISION     = 9;     // 保存するgeohash精度
const MIN_DISTANCE_METERS   = 30;    // 30メートル
const FORCE_RECORD_MS       = 30000; // 30000ミリ秒 (記録間隔の最大値)
const FLUSH_INTERVAL_MS     = 60000; // 60000ミリ秒 (送信間隔)
const MAP_OVERLAY_TIMEOUT   = 5000;  // マップオーバーレイを消すまでタイムアウト時間
const MAP_OVERLAY_DISTANCE  = 100;   // マップオーバーレイを消すまで距離
const GEOLOCATE_MAXIMUM_AGE = 86400000;  // 位置情報のキャッシュ許容時間
const GEOLOCATE_TIMEOUT     = 10000;
const PERMISSION_DENIED     = 1;     // 位置情報不許可時のerror値
const INITIAL_ZOOM_LEVEL = 17;
const DEBUG_MODE = false;
const DEBUG_BULK_SAVE_CHUNK_SIZE = 500;
const DEBUG_BULK_SAVE_INTERVAL_MS = 200;
const USE_WEBGL_FOG = true

// Connects to data-controller="map"
export default class extends BaseMapController {
  connect() {
    if (document.documentElement.hasAttribute("data-turbo-preview")) return; // プレビューの時は戻る

    console.log("-----初期化実行-----")
    super.connect(); // BaseMapの初期化
    if (!this.ac) return;

    console.log("mapのconnect実行")
    this.initializeState(); // 初期ステータスや変数をセット
    this.setupEventListeners(); // イベントリスナーを登録
    if (this.ac.signal.aborted || !this.element.isConnected) return; // 途中で遷移してたらreturn

    this.setupMapProcess(); // マップ関連の処理を実行
  }

  // --- セットアップ関連メソッド ---

  // データ初期化
  async initializeState(){
    // 累計地図の設定
    this.cumulativeMode = false;
    this.cumulativeModeStatus = "notReady";
    this.forceStopCumulative = false;
    // this.setCumulativeGeohashesAndFeature(this.cumulativeGeohashes);

    // 地図の設定
    this.status = STATUS.STOPPED; // 地図のステータスを初期化
    this.currentLng = null; // 現在の経度を初期化
    this.currentLat = null; // 現在の緯度を初期化
    this.overlayTimer = null; // オーバーレイ要素を透過させるフェイルセーフ用のタイマーID格納変数

    // 足跡の設定
    this.lastSentAt = 0; // 最後にfootprintを送った時間を覚えておく変数
    this.lastSentGeohash = ""; // 最後に保存したgeohashを覚えておく変数
    this.lastSavedCoords = null; // 最後に保存した座標
    this.footprintBuffer = []; // データを溜めておくための配列

    // geohash、霧関係の設定
    this.visitedFeature = null; // 開放済みの場所をFeatureオブジェクトで管理
    this.visitedGeohashes = new Set(); //　開放済みのgeohashを保持
  }

  // イベントリスナーをセット
  setupEventListeners() {
    console.log("イベントリスナー登録")
    // 規約同意時にmap:geolocateが発火させて位置情報を取得
    window.addEventListener("map:geolocate", this.checkLocationPermissions, { signal: this.ac.signal });
    // リロード、タブ閉じ対策
    window.addEventListener('beforeunload', this.handleBeforeUnload, { signal: this.ac.signal });
    // Turbo遷移を止める
    document.addEventListener("turbo:before-visit", this.handleTurboBeforeVisit, { signal: this.ac.signal });
    // ブラウザの戻る対策
    this.enableBackGuard();
    // ターボがページ遷移時にキャッシュに保存するときにクリアする
    document.addEventListener("turbo:before-cache", this.cleanup, { signal: this.ac.signal});
    // ページ遷移時にデータを保存
    document.addEventListener('visibilitychange', this.onVisibilityChange, { signal: this.ac.signal });
  }

  async setupMapProcess(){
    this.center = [ 139.745, 35.658 ]; // 仮の中央として東京駅
    await this.initializeMap(this.center) // 地図初期化
    if (!this.map || this.ac.signal.aborted || !this.element.isConnected) return;

    this.setupMapControls(); // 地図のUI設定
    this.setupPulseMarker(); // 現在地のパルス設定
    this.addMarkers(); // マーカーをセット
    this.setupMapLoadEvents(); // 地図読み込み後の処理
    console.log("-----初期化終了-----")
  }

  // 地図のUI設定
  setupMapControls(){
    // アトリビューション表記
    this.map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>' }), "bottom-right");

    // 現在地追跡機能をセット
    this.geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true, // 高精度モードを有効
        maximumAge: GEOLOCATE_MAXIMUM_AGE,// 位置情報のキャッシュ許容時間
        timeout: GEOLOCATE_TIMEOUT
      },
      trackUserLocation: true, // 移動に合わせてドットが動く
      showUserHeading: true, // スマホの向いている方角を表示
      showAccuracyCircle: false, // GPSの誤差の範囲を表示
      fitBoundsOptions: { // ズームカメラの設定
      }
    });

    // ナビゲーションコントロールボタンを設定
    const navControl = new maplibregl.NavigationControl({
      showCompass: true, // コンパスを表示
      showZoom: false,    // ズームボタンを表示
      visualizePitch: true // マップの傾きに合わせてコンパスを傾ける
    });

    this.map.addControl(this.geolocate); // 地図にgeolocateボタンを追加。右上
    this.map.addControl(navControl); // 地図にナビゲーションボタンを追加
    this.overrideGeolocateTrigger(); // geolocateボタンのtriggerメソッドを上書き

    this.geolocate.on('geolocate', this.handleGeolocate); // geolocate発火時に起動する関数の設定

    this.geolocate.on('trackuserlocationstart', () => {
      if (this.pulseMarker){
        this.pulseMarker.getElement().style.display = "block";
      }
    });

    this.geolocate.on('trackuserlocationend', () => {
      if (this.pulseMarker){
        this.pulseMarker.getElement().style.display = "none";
      }
    });
  }

  // 現在地追従をオフ
  disableGeolocateTracking() {
    if (this.geolocate) {
      if (this.geolocate._watchState === 'ACTIVE_LOCK') { // ACTIVE_LOCK,追従中の時に
        this.geolocate._watchState = 'BACKGROUND'; // 強制的にBACKGROUNDに書き換える

        // ボタンの見た目も状態に合わせてオフに
        const btn = this.geolocate._geolocateButton;
        if (btn) {
          btn.classList.remove('maplibregl-ctrl-geolocate-active');
          btn.classList.add('maplibregl-ctrl-geolocate-background');
        }
      }
    }
  }

  // geolocateボタンのtriggerメソッドを上書き
  overrideGeolocateTrigger(){
    const originalTrigger = this.geolocate.trigger.bind(this.geolocate); // 元々のtriggerを保存

    // triggerを上書き
    this.geolocate.trigger = () => {
      const currentZoom = this.map.getZoom(); // 現在のズームレベルを取得
      // オプションを現在のズームレベルで書き換え
      this.geolocate.options.fitBoundsOptions = {
        maxZoom: currentZoom,
        minZoom: currentZoom,
        linear: true,
      }

      return originalTrigger(); // 最後に本来のtriggerを呼ぶ
    }

    // ズーム終了時にオプションを更新
    this.map.on('zoomend', () => {
      if (!this.geolocate) return; // 現在地追従機能が存在しない場合は無視

      const currentZoom = this.map.getZoom(); // 現在のズーム率を取得

      // maxとminのズームを現在のズームに固定
      // this.geolocate.options.fitBoundsOptions.maxZoom = currentZoom;
      this.geolocate.options.fitBoundsOptions.minZoom = currentZoom;
    });
  }

  // 自作のパルスを作成して地図に表示
  setupPulseMarker() {
    // 自作パルスを作成して位置を0,0で表示
    const pulseEl = document.createElement('div');
    pulseEl.className = 'my-pulse-marker';

    pulseEl.style.display = "none"; // バルスを初期は非表示にしておく

    this.pulseMarker = new maplibregl.Marker({
      element: pulseEl,
      offset: [ 0, 0 ]
    }).setLngLat([0,0]).addTo(this.map);
  }

  setupMapLoadEvents() {
    // 非表示にする地図上の情報
    const toHide = [
      // "Restaurant and shop",
      // "Store and mall",
      // "Pub",
      // "Hotel",
      // "Generic POI",
      // "Generic POI 11",
      // "Major POI",
      // "Doctor",
      // "Parking",
      // "Government",
      // "Golf pitch",
    ];

    // 地図の読み込みが終わった後に実行
    this.map.on('load', () => {
      this.fogInit(); // 霧を初期化
      this.setupCustomFogLayerEvents()

      // toHide配列の中身のidの要素を透過
      toHide.forEach(id => {
        if (this.map.getLayer(id)) {
          this.map.setLayoutProperty(id, "visibility", "none");
        }
      });

      this.checkLocationPermissions(); // 規約と位置情報をチェックして現在地追従オン

      // デバッグ用：クリックで霧を晴らす
      if(DEBUG_MODE){
        this.map.on('click', (e) => {
          const { lng, lat } = e.lngLat; // クリックした箇所のlng,latを取得

          // e.originalEvent.altKey で Alt(Option)キーが押されているか判定
          if (e.originalEvent.altKey && e.originalEvent.metaKey) {
            console.log(`[累計地図デバッグ保存] ${lat}, ${lng} 周辺のfootprintsを大量保存します`);

            this.debugSaveMassiveFootprintsForCumulativeMap(lat, lng, {
              offset: 0.01,
              precision: 9,
              step: 20,
              maxCount: 10000,
            });
          } else if (e.originalEvent.altKey) {
            console.log(`[負荷テスト] ${lat}, ${lng} 周辺を一括開放します`);
            this.debugClearMassiveFog(lat, lng);
          } else {
            // 通常の1箇所開放
            const clickHash = ngeohash.encode(lat, lng, 9);
            console.log(`クリック地点: ${lat}, ${lng} -> ${clickHash}`);
            this.debugClearFogAt(clickHash, lng, lat);
          }
        });
      }
    });

    // アイコンが足りない時のダミー追加
    this.map.on('styleimagemissing', (event) => {
      const id = event.id;
      if (this.map.hasImage(id)) return; // すでに追加済みなら何もしない

      // 透明 1x1 のダミー画像を登録
      const empty = new Uint8Array([0, 0, 0, 0]);
      this.map.addImage(id, { width: 1, height: 1, data: empty });
    });

    window.dispatchEvent(new CustomEvent("map:ready")); // map準備完了のイベントを発火
  }

  jumpToCurrentLocation() {
    if (this.currentLat != null && this.currentLng != null) {

      // 現在地に初期ズームで移動
      this.map.easeTo({
        center: [this.currentLng, this.currentLat],
        zoom: INITIAL_ZOOM_LEVEL,
        duration: 1000,
        essential: true // 強制的にアニメーション
      });

      // 移動が終わったら一回だけ起動
      this.map.once('moveend', () => {
        if (this.geolocate) {
          if (this.geolocate._watchState === 'BACKGROUND') {
            this.geolocate._watchState = 'ACTIVE_LOCK'; // geolocateの状態を追従モードへ
            const btn = this.geolocate._geolocateButton;

            if (btn) {
              btn.classList.remove('maplibregl-ctrl-geolocate-background');
              btn.classList.add('maplibregl-ctrl-geolocate-active');
            }
          } else if(this.geolocate._watchState === 'OFF') {
            this.geolocateTrigger();
          }
        }
      });
    } else {
      console.warn("現在地がまだ取得できていません");
    }
  }

  // --- ロジック関連メソッド ---

  // geolocate発火時のコールバック関数
  handleGeolocate = (data) => {
    if (!this.map || !this.element.isConnected) return; // ガード

    // 各種データの取得
    const lng = data.coords.longitude; // 経度
    const lat = data.coords.latitude;  // 緯度
    const recordTime = new Date(data.timestamp).toISOString(); // 取得時間
    const geohash = ngeohash.encode(lat, lng, GEOHASH_PRECISION); // geohashを計算

    // 状態を更新
    this.currentLng = lng;
    this.currentLat = lat;
    this.currentGeohash = geohash;
    this.currentRecordTime = recordTime;
    if(this.hasUiOutlet){
      this.uiOutlet.longitudeValue = lng;
      this.uiOutlet.latitudeValue = lat;
    }

    this.pulseMarker.setLngLat([this.currentLng, this.currentLat]); // 自作パルスの現在地を更新

    // 霧の更新
    if (this.status !== STATUS.PAUSED) {
      if (USE_WEBGL_FOG) {
        this.updateRealtimeFogClearing()
      } else {
        this.executeFogClearing()
      }
    }

    this.mapInitEnd = true;
    this.maybeClearOverlay();

    this.dispatchLocationUpdate(); // location:updateイベントを発火

    // status が RECORDING になっている場合に保存判定
    if(this.status === STATUS.RECORDING) {
      this.checkAndBufferFootprint(this.currentGeohash);
    }
  }

  // 位置情報と規約の状態をチェックして地図表示とオーバーレイを晴らす
  checkLocationPermissions = () => {

    this.hasAccepted = this.getCookie("terms_accepted"); // 規約に同意済みか最新のクッキーを取得

    if(this.hasAccepted !== "true") return; // 規約に同意していない場合は何もしない

    if(navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation'}).then((result) => {

        // ページを開いた時点の状態をチェック
        if(result.state === 'denied'){ // 許可していない時

          console.log("位置情報がブロックされています。モーダルを表示します。")
          this.showLocationDeniedModal(); // 位置情報を許可するよう促すモーダルを表示

        } else if (result.state === 'granted'){ // 許可しているとき

          if (this.map && this.geolocate) {
            this.geolocate.trigger(); // 地図上の現在地ボタンを起動

            setTimeout(() => {
              if (!this.mapInitEnd) {
                this.mapInitEnd = true;
                this.maybeClearOverlay();
              }
            }, GEOLOCATE_TIMEOUT);
          }

        } else if(result.state === 'prompt') { // 確認のダイアログが表示された時

          this.geolocate.trigger(); // 位置情報確認ダイアログを表示させるために、トリガーを起動させる

          // ダイアログの各種ボタンを押した時の動作をセット
          result.onchange = () => {
            console.log("権限が変更されました:", result.state);

            if (result.state === 'granted') { // 位置情報を許可するとき
              if (this.map && this.geolocate) {
                this.mapInitEnd = true;   // 地図の設定完了フラグをtrueに
                this.maybeClearOverlay(); // オーバーレイ要素を晴らす
              }
            } else if (result.state === 'denied') { // 位置情報を許可しないが押された時
              this.showLocationDeniedModal(); // 位置情報を許可するよう促すモーダルを表示
            }
          };
        }
      }).catch((e) => {
        // queryでエラーが出た時の処理
        console.warn("Permissions APIエラー", e);
        this.executeFallbackGeolocation();
      });
    } else {
      console.log("Permissions API非対応");
      this.executeFallbackGeolocation();
    }
  }

  // Permissions APIがうまくいかなかった時の処理
  executeFallbackGeolocation(){
    if (this.map && this.geolocate) {
      this.geolocate.trigger();
      this.mapInitEnd = true;
      this.maybeClearOverlay();

      this.geolocate.once('error', (e) => {
        if (e.code === PERMISSION_DENIED) {
          console.log("iPhone等で位置情報が拒否されました");
          this.showLocationDeniedModal();
        }
      });
    }
  }

  // 保存判定ロジック
  checkAndBufferFootprint(geohash){
    const now = Date.now(); // 現在の時刻
    const timeElapsed = now - this.lastSentAt; //経過時刻

    // 前回からの距離を算出
    const distanceMoved = this.lastSavedCoords ? getDistance(this.lastSavedCoords, { latitude: this.currentLat, longitude: this.currentLng }) : 99999;

    // 保存条件
    const isNewTile = this.lastSentGeohash !== geohash;       // geohashが前回から更新されている場合
    const isMoveEnough = distanceMoved > MIN_DISTANCE_METERS; // 前回より一定の距離以上移動している場合
    const isTimeOut = timeElapsed > FORCE_RECORD_MS;          // 移動していなくても一定時間が経過

    // どれか一つの条件にでも当てはまった場合は保存
    if( isNewTile || isMoveEnough || isTimeOut ) {
      console.log(`保存トリガー: [Tile:${isNewTile}, Dist:${distanceMoved}m, Time:${isTimeOut}]`);
      this.addFootprintToBuffer(now, geohash);
    }
  }

  // footprint用データをBufferにセット
  addFootprintToBuffer(now, geohash){
    // 保存用データをセット
    const data = {
      trip_id:     this.tripId,
      latitude:    this.currentLat,
      longitude:   this.currentLng,
      recorded_at: this.currentRecordTime,
    };

    // 配列に保存用データを格納
    this.footprintBuffer.push(data);
    console.log("バッファデータを追加:", this.footprintBuffer)

    // 保存判定用のデータを更新
    this.lastSentAt = now;
    this.lastSentGeohash = geohash;
    this.lastSavedCoords = { latitude: this.currentLat, longitude: this.currentLng }
  }

  // 画面遷移時にデータを保存
  onVisibilityChange = () => {
    if(document.visibilityState === 'hidden' && this.status === STATUS.RECORDING){
      this.flushBuffer();
      this.postFootprint();
    }
  }

  enableBackGuard(){
    if(this.backGuardEnable) return;
    this.backGuardEnable = true;

    // navigation API用
    if (window.navigation) {
      window.navigation.addEventListener("navigate", this.handleNavigate, { signal: this.ac.signal });
    }
    else {
      if (!window.location.hash.includes("map")) {
        const safeUrl = window.location.pathname + window.location.search + "#map";
        history.pushState(history.state, "", safeUrl);
      }
      window.addEventListener("popstate", this.handlePopState, { capture: true, signal: this.ac.signal });
    }
  }

  // Navigation API用ハンドラ
  handleNavigate = (event) => {
    // "traverse" 戻る・進むを検知
    if (event.navigationType === "traverse") {
      if (!this.shouldConfirmLeave()) return;

      const ok = window.confirm("探索中です。地図が正しく保存されない可能性がありますが移動しますか？");
      if (!ok) {
        event.preventDefault();
      } else {
        this.backGuardEnable = false;
      }
    }
  }

  // popstate用ハンドラ
  handlePopState = (event) => {
    if (!window.location.hash.includes("map")) {
      event.stopImmediatePropagation(); // 他のリスナーとバブリングを止める

      if (!this.shouldConfirmLeave()) {
        this.executeRealBack();
        return;
      }

      const ok = window.confirm("探索中です。地図が正しく保存されない可能性がありますが移動しますか？");
      if (ok) {
        this.executeRealBack();
      } else {
        const safeUrl = window.location.pathname + window.location.search + "#map";
        history.pushState(history.state, "", safeUrl);
      }
    }
  }

  // popstateで戻るためのメソッド
  executeRealBack = () => {
    window.removeEventListener("popstate", this.handlePopState, { capture: true });
    this.backGuardEnable = false;
    history.back();
  }

  shouldConfirmLeave = () => {
    return this.status === STATUS.RECORDING || this.status === STATUS.PAUSED
  }

  // 未保存時のチェック
  handleBeforeUnload = (event) => {
    if(!this.shouldConfirmLeave()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  // trubo遷移を止める
  handleTurboBeforeVisit = (event) => {
    if(!this.shouldConfirmLeave()) return;

    const ok = window.confirm("探索中です。地図が正しく保存されない可能性がありますが移動しますか？");
    if(!ok) event.preventDefault(); // turbo遷移を止める
  }

  // 既存のデータの掃除
  cleanup = () => {
    if (!this.map && !this.geolocate) return; // すでに片付け済みなら実行しない

    console.log("cleanup 実行");

    if (this.hasMapOverlayTarget) {
      const el = this.mapOverlayTarget;
      el.classList.remove("hidden");
      el.classList.remove("opacity-0");
      el.classList.add("opacity-100");
    }

    if(this.geolocate) {
      if (this.map) {
        try { this.map.removeControl(this.geolocate); } catch(e){}
      }
      this.geolocate.off('geolocate', this.handleGeolocate);
      this.geolocate = null;
    }

    this.uiOutlet.cumulativeModeOff();
    // 自作マーカーを削除
    if (this.pulseMarker) {
      this.pulseMarker.remove();
      this.pulseMarker = null;
    }

    if(this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      this.flushBuffer();
    }
    if(this.status === STATUS.RECORDING){
      this.postFootprint();
    }
    if(this.overlayTimer){
      clearTimeout(this.overlayTimer);
      this.overlayTimer = null;
    }
    if(this.tripId){
      this.tripId = null;
    }
    if(this.hasUiOutlet) {
      this.uiOutlet.stopRecording();
    }
    this.mapInitEnd = false;
    this.ac?.abort()
  }

  // 要素削除時に起動
  disconnect() {
    console.log("-----終了処理開始-----")

    this.cleanup();
    super.disconnect();
    console.log("-----終了処理完了-----")
  }

  // クッキーを取得
  getCookie(name) {
    return document.cookie.split("; ").find(row => row.startsWith(`${name}=`))?.split("=")[1];
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

  setTripId(id, oldVisitedGeohashes = []) {
    this.tripId = id;
    if(oldVisitedGeohashes){
      this.visitedGeohashes.clear();
      // this.visitedFeature = this.generateFeatureFromGeohashes(oldVisitedGeohashes, this.visitedGeohashes);
      this.generateFeatureFromGeohashes(oldVisitedGeohashes, this.visitedGeohashes);
    }
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
    console.log(data);

    const response = await fetch(`/api/v1/trips/${this.tripId}/footprints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "same-origin",
      body: JSON.stringify(data),
      keepalive: true,
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
    console.log("現在地を送信");

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
        body: JSON.stringify({ footprints: dataToSend }),
        keepalive: true
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

  resetFog() {
    this.visitedFeature = null;
    this.visitedGeohashes.clear();

    if (USE_WEBGL_FOG) {
      this.updateRealtimeFogClearing(true)
    } else {
      this.executeFogClearing(true)
    }

    Object.values(this.markers).forEach(marker => {
      marker.remove();
    });
    this.markers = {};
  }

  resetFogData() {
    this.visitedFeature = null;
    this.visitedGeohashes.clear();
  }

  executeFogClearing(force = false){
    // console.log("execute実行")
    const newGeohashes = this.addGeohashesAndGetNew(this.currentGeohash, this.visitedGeohashes);

    if(!force && newGeohashes.length === 0){
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

    let visitedUnion = turf.clone(this.visitedFeature);

    // if (this.cumulativeMode && this.cumulativeFeature) {
    //   const featureCollection = turf.featureCollection([visitedUnion, this.cumulativeFeature].filter(Boolean));
    //   visitedUnion = turf.union(featureCollection);
    // }

    // 世界全体からvisitedを引いて霧を作る
    const fogPolygon = turf.difference(turf.featureCollection([this.worldFeature, visitedUnion]));

    if (fogPolygon) {
      this.updateFog(fogPolygon);
    } else {
      console.log("fogPolygonが見つかりません");
    }

    if(this.status === STATUS.STOPPED){
      this.resetFogData(); // 霧描画後に、保持する霧データをリセット
    }
  }

  debugClearMassiveFog(centerLat, centerLng) {
    const offset = 0.01;
    const minLat = centerLat - offset;
    const minLng = centerLng - offset;
    const maxLat = centerLat + offset;
    const maxLng = centerLng + offset;

    // ngeohash.bboxes で範囲内のGeohash(精度9)を配列で一括取得
    const massiveHashes = ngeohash.bboxes(minLat, minLng, maxLat, maxLng, 9);

    console.log(`[負荷テスト開始] ${massiveHashes.length} 個のGeohashを一括結合します...`);

    try {
      // const resultFeature = this.generateFeatureFromGeohashes(massiveHashes, this.visitedGeohashes);
      this.generateFeatureFromGeohashes(massiveHashes, this.visitedGeohashes);

      // this.visitedFeature = resultFeature;
      if (USE_WEBGL_FOG) {
        this.updateRealtimeFogClearing(true)
      } else {
        this.executeFogClearing(true)
      }

      console.log('✅ [負荷テスト完了] オーバーフローせずに結合成功');
    } catch (e) {
      console.error("🚨 結合処理でエラー発生:", e);
    }
  }

  // 累計地図の重さ確認用
  // 指定地点周辺の geohash を大量に footprint として保存
  async debugSaveMassiveFootprintsForCumulativeMap(centerLat, centerLng, options = {}) {
    if (!DEBUG_MODE) return;

    if (!this.tripId) {
      console.warn("tripId がないため、デバッグ用footprintを保存できません");
      return;
    }

    const {
      offset = 0.005,
      precision = GEOHASH_PRECISION,
      step = 10,
      maxCount = 5000,
    } = options;

    const minLat = centerLat - offset;
    const minLng = centerLng - offset;
    const maxLat = centerLat + offset;
    const maxLng = centerLng + offset;

    console.log("----- 累計地図デバッグ保存 開始 -----");
    console.log({
      centerLat,
      centerLng,
      offset,
      precision,
      step,
      maxCount,
      bbox: { minLat, minLng, maxLat, maxLng },
    });

    // 範囲内のgeohashを取得
    const allHashes = ngeohash.bboxes(minLat, minLng, maxLat, maxLng, precision);

    console.log(`[debug] 生成された geohash 数: ${allHashes.length}`);

    // 全部保存すると多すぎるのでstep間隔で間引く
    const sampledHashes = allHashes
      .filter((_, index) => index % step === 0)
      .slice(0, maxCount);

    console.log(`[debug] 保存対象 geohash 数: ${sampledHashes.length}`);

    if (sampledHashes.length === 0) {
      console.warn("[debug] 保存対象がありません");
      return;
    }

    const now = new Date();

    // geohash の中心座標を footprint にする
    const footprints = sampledHashes.map((hash, index) => {
      const decoded = ngeohash.decode(hash);

      return {
        trip_id: this.tripId,
        latitude: decoded.latitude,
        longitude: decoded.longitude,

        // 少しずつ時刻をずらす
        recorded_at: new Date(now.getTime() + index * 1000).toISOString(),
      };
    });

    await this.debugBulkCreateFootprints(footprints);

    console.log("----- 累計地図デバッグ保存 終了 -----");
  }


  // デバッグ用ootprints一括保存
  async debugBulkCreateFootprints(footprints) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    if (!csrfToken) {
      console.error("CSRF token が見つかりません");
      return;
    }

    const chunks = this.chunkArray(footprints, DEBUG_BULK_SAVE_CHUNK_SIZE);

    console.log(`[debug] ${footprints.length}件を ${chunks.length} 回に分けて保存します`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      console.log(`[debug] 保存中 ${i + 1}/${chunks.length}: ${chunk.length}件`);

      try {
        const response = await fetch(`/api/v1/trips/${this.tripId}/footprints/bulk_create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "same-origin",
          body: JSON.stringify({ footprints: chunk }),
        });

        let result = null;

        try {
          result = await response.json();
        } catch (_) {
          // JSONで返らないエラー対策
        }

        if (!response.ok) {
          console.error(`[debug] 保存失敗 ${i + 1}/${chunks.length}`, {
            status: response.status,
            result,
          });
          return;
        }

        console.log(`[debug] 保存成功 ${i + 1}/${chunks.length}`, result);

        // サーバーに一気に投げすぎないため
        await this.sleep(DEBUG_BULK_SAVE_INTERVAL_MS);

      } catch (error) {
        console.error(`[debug] 保存中にエラー ${i + 1}/${chunks.length}`, error);
        return;
      }
    }
  }

  // 配列を指定サイズで分割
  chunkArray(array, size) {
    const chunks = [];

    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }

    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 指定されたGeohashの周辺を晴らす（デバッグ・テスト用）
  debugClearFogAt(targetGeohash, lng, lat) {
    this.currentGeohash = targetGeohash;
    this.currentLng = lng;
    this.currentLat = lat;
    this.currentRecordTime = new Date().toISOString();

    if (USE_WEBGL_FOG) {
      this.updateRealtimeFogClearing()
    } else {
      this.executeFogClearing()
    }

    if(this.status === STATUS.RECORDING){
      this.postFootprint();
    }
  }

  // 地図表示前にマップを覆っているオーバーレイを消去
  clearMapOverlay(){
    if (this.clearMapOverlayEnd) return; // すでにオーバーレイを消去済みならリターン

    const el = this.mapOverlayTarget
    if (!el) return; // オーバーレイターゲットが存在していなかったらリターン

    const fadeOut = () => {
      if (this.clearMapOverlayEnd) return; // すでにオーバーレイが消去ずみならリターン
      if (el.classList.contains("opacity-0")) return; // オーバレイターゲットにすでにopacity-0が含まれていたらリターン

      this.clearMapOverlayEnd = true; // オーバーレイ消去済みフラグをtrueに

      // オーバーレイ要素をアニメーションで透過させて、その後消去
      el.classList.remove("opacity-100")
      el.classList.add("opacity-0")
      el.addEventListener("transitionend", () => {
        el.classList.add("hidden");
      }, { once: true })
    }

    // 移動が終了しているかチェック
    const checkArrival = () => {
      if(!this.currentLat || !this.currentLng) return; // まだ現在地が取得できていない場合は何もしない

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

    checkArrival(); // まずは現在の距離で処理を実行

    // 消えなかった時用にsetTimeoutをセット
    if(!this.overlayTimer){
      this.overlayTimer = setTimeout(() => {
        fadeOut();
      }, MAP_OVERLAY_TIMEOUT);
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

  // 今回歩いた分を、ローカルの累計地図データに直接マージする
  mergeVisitedToCumulative() {
    if (!this.visitedFeature || !this.cumulativeGeohashes) return;

    // 今回のGeohashを累計Geohashに追加
    this.visitedGeohashes.forEach(hash => this.cumulativeGeohashes.add(hash));

    // 累計Featureと今回のFeatureを結合
    // if (this.cumulativeFeature) {
    //   this.cumulativeFeature = turf.union(turf.featureCollection([this.cumulativeFeature, this.visitedFeature]));
    // } else {
    //   this.cumulativeFeature = turf.clone(this.visitedFeature);
    // }
  }

  async cumulativeModeOn(){
    if (this.cumulativeModeStatus === "loading") return;

    if (this.cumulativeModeStatus === "notReady"){
      this.forceStopCumulative = false;

      await this.setCumulativeGeohashesAndFeature(this.cumulativeGeohashes);

      if (this.forceStopCumulative) {
        return;
      }

      this.cumulativeMode = true;
      if (USE_WEBGL_FOG) {
        this.updateRealtimeFogClearing(true)
      } else {
        this.executeFogClearing()
      }

    } else if (this.cumulativeModeStatus === "isReady"){
      this.cumulativeMode = true;
      if (USE_WEBGL_FOG) {
        this.updateRealtimeFogClearing(true)
      } else {
        this.executeFogClearing()
      }
    }
  }

  cumulativeModeOff(){
    if (!this.map) {
      return;
    }

    this.forceStopCumulative = true;
    this.cumulativeMode = false;

    if (USE_WEBGL_FOG) {
      this.updateRealtimeFogClearing(true)
    } else {
      this.executeFogClearing(true)
    }
  }

  geolocateTrigger(){
    this.geolocate.trigger();
  }

  fogOff(){
    this.setFogOpacity(0.0);
  }

  fogOn(){
    this.setFogOpacity(0.9);
  }

  getCurrentPosition(){
    return { lng: this.currentLng, lat: this.currentLat }
  }

  getCurrentLat() {
    return this.currentLat
  }

  getCurrentLng() {
    return this.currentLng
  }

  getMap() {
    return this.map
  }

  dispatchLocationUpdate(){
    window.dispatchEvent(new CustomEvent("location:update", {
    }))
  }

  updateRealtimeFogClearing(force = false) {
    const newGeohashes = this.addGeohashesAndGetNew(this.currentGeohash, this.visitedGeohashes)

    if (!force && newGeohashes.length === 0) {
      console.log("新たに訪れた場所がないのでWebGL霧は更新しません")
      return
    }

    this.updateCustomFogLayer()

    if(this.status === STATUS.STOPPED){
      this.resetFogData()
    }
  }

  setupCustomFogLayerEvents() {
    // moveendとzoomendの両方で実行
    const updateEvents = ["moveend", "zoomend"];

    updateEvents.forEach(eventType => {
      this.map.on(eventType, () => {
        // カスタムレイヤーが存在し、かつ表示中であれば更新する
        if (this.fogCustomLayer) {
          this.updateRealtimeFogClearing(true);
        }
      });
    });
  }
}
