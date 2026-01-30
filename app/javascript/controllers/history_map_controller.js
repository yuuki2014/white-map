import { Controller } from "@hotwired/stimulus"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import ngeohash from 'ngeohash';
import * as turf from "@turf/turf"

// Connects to data-controller="history-map"
export default class extends Controller {
  static outlets = [ "ui", "posts" ]
  static targets = [ "mapOverlay", "appendMarker" ]
  static values = { longitude: Number,
                    latitude: Number,
                    visitedGeohashes: Array,
                    posts: Array,
                  }

  async connect(_element) {
    this.mapInitEnd         = false;
    this.clearMapOverlayEnd = false;
    this._onMapClick = null

    console.log(this.uiOutlet);
    // geohashをセット
    this.cumulativeGeohashes = new Set()
    this.cumulativeFeature = { value: null };
    this.setCumulativeGeohashesAndFeature(this.cumulativeGeohashes, this.cumulativeFeature);

    const apiKey = this.element.dataset.maptilerKey;
    // 地図のstyleを取得
    const res = await fetch(`https://api.maptiler.com/maps/jp-mierune-dark/style.json?key=${apiKey}`);
    const styleJson = await res.json();
    // 中央位置設定
    if(this.longitudeValue && this.latitudeValue){
      this.center = [ this.longitudeValue, this.latitudeValue ]
    } else {
      this.center = [ 139.745, 35.658 ];
    }

    // this.currentLongitude = this.center[0]
    // this.currentLatitude = this.center[1]
    this.uiOutlet.postLongitudeValue = null
    this.uiOutlet.postLatitudeValue = null
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
      style: styleJson,
      center: this.center,
      zoom: 18,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

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

      // this.map.on('move', () => {
      //   const center = this.map.getCenter();
      //   this.currentLatitude = center.lat
      //   this.currentLongitude = center.lng
      //   this.uiOutlet.longitudeValue = this.currentLongitude
      //   this.uiOutlet.latitudeValue = this.currentLatitude
      // })
      this.executeFogClearing();

      this.addMarkers();

      this.mapInitEnd = true;
      this.maybeClearOverlay();
    })
  }

  enablePostPositionMode(){
    if(this._onMapClick) return

    if(this.hasPostsOutlet) {
      this.postsOutlet.lngValue = null;
      this.postsOutlet.latValue = null;
    }
    this.uiOutlet.postLongitudeValue = null;
    this.uiOutlet.postLatitudeValue = null;
    this.currentMarker = null;

    this._onMapClick = this.handlePostMapClick.bind(this);
    this.map.on('click', this._onMapClick);
  }

  disablePostPositionMode(){
    if(!this._onMapClick) return;

    this.currentMarker.remove()
    this.currentMarker = null;
    this.map.off('click', this._onMapClick);
    this._onMapClick = null;
  }

  handlePostMapClick(e){
    const{ lng, lat } = e.lngLat;

    if (this.currentMarker) {
      // マーカーがある場合はマーカーの場所を更新
      this.currentMarker.setLngLat([lng, lat]);
    } else {
      this.currentMarker = new maplibregl.Marker({color: "#00CCFF"})
        .setLngLat([lng, lat])
        .addTo(this.map)
    }
    if(this.hasPostsOutlet) {
      this.postsOutlet.lngValue = lng
      this.postsOutlet.latValue = lat
    }
    if(this.hasUiOutlet){
      this.uiOutlet.postLongitudeValue = lng;
      this.uiOutlet.postLatitudeValue = lat;
    }
  }

  addMarkers(){
    // データがない場合は何もしない
    if (!this.postsValue.length) return

    this.postsValue.forEach(post => {
      // 1. ポップアップ（吹き出し）を作る
      const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-2 text-gray-800">
            <p class="text-sm mb-1">${post.visited_at ? new Date(post.visited_at).toLocaleDateString() : ''}</p>
            <p class="font-bold">${post.body}</p>
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
    })
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

  // geohashの部分のポリゴンを作成
  createPolygonFromGeohash(hash){
    const [minLat, minLon, maxLat, maxLon] = ngeohash.decode_bbox(hash); // geohashをデコードしてbboxの形式に4点を取得
    const bbox = [minLon, minLat, maxLon, maxLat]; // turfのbbox用に並び替える

    return turf.bboxPolygon(bbox);
  }

  // 霧の更新
  updateFog(geojsonData){
    if(!this.map.getSource('fog')){
      this.fogInit();
    }

    const source = this.map.getSource(`fog`);
    source.setData(geojsonData);
  }

  executeFogClearing(){
    if(this.cumulativeFeature.value .length === 0){
      console.log("geohashがないので何も実行しません")
      return;
    }

    // 世界全体からvisitedを引いて霧を作る
    const fogPolygon = turf.difference(turf.featureCollection([ this.worldFeature, this.cumulativeFeature.value ]));

    if (fogPolygon) {
      this.updateFog(fogPolygon);
    } else {
      console.log("fogPolygonが見つかりません");
    }
  }

  clearMapOverlay(){
    const el = this.mapOverlayTarget

    if (!el) return;

    el.classList.add("-translate-y-full")

    el.addEventListener("transitionend", () => {
      el.remove();
    }, { once: true })
  }

  maybeClearOverlay(){
    if (!this.mapInitEnd)          return; // まだ地図が初期化されてない
    if (!this.hasMapOverlayTarget) return; // まだ overlay target がない
    if (this.clearMapOverlayEnd)   return; // すでにoverlay削除済み

    this.clearMapOverlay();
    this.clearMapOverlayEnd = true;
  }

  // mapOverlayが接続された時に自動実行
  mapOverlayTargetConnected(_element) {
    this.maybeClearOverlay();
  }

  appendMarkerTargetConnected(element){
    console.log("接続ターゲット")
    const post = JSON.parse(element.dataset.post)

    const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-2 text-gray-800">
            <p class="text-sm mb-1">${post.visited_at ? new Date(post.visited_at).toLocaleDateString() : ''}</p>
            <p class="font-bold">${post.body}</p>
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

    element.remove() // 使い終わったら消す
  }

  addGeohashesAndGetNew(currentGeohash, visitedGeohashes){
    if(!currentGeohash) return [];

    const newGeohashes = [];

    // 現在地の周囲8方向のgeohashを取得
    const neighbors = ngeohash.neighbors(currentGeohash);
    const aroundGeohashes = [currentGeohash, ...neighbors];

    // 保持していないものを追加
    for (const hash of aroundGeohashes) {
      if (visitedGeohashes.has(hash)) continue // すでに保持していた場合はスキップ
      visitedGeohashes.add(hash);
      newGeohashes.push(hash);
    }

    return newGeohashes
  }

  // 累計地図セット
  setCumulativeGeohashesAndFeature(cumulativeGeohashes, cumulativeFeature){
    this.visitedGeohashesValue.forEach((geohash) => {
      this.addGeohashesAndGetNew(geohash, cumulativeGeohashes)
    });

    // 今回追加するポリゴンを全て配列にする
    const polygonsToMerge = [...cumulativeGeohashes].map(hash => this.createPolygonFromGeohash(hash));

    if (polygonsToMerge.length > 1) {
      // 配列をFeatureCollectionに変換してから、unionに渡す
      const featureCollection = turf.featureCollection(polygonsToMerge);
      cumulativeFeature.value = turf.union(featureCollection);
    } else {
      cumulativeFeature.value = polygonsToMerge[0];
    }
  }



  disconnect(_element) {
    console.log("disconnect map controller")
    if (this.map) {
      this.map.remove(); // 地図機能の停止、削除
      console.log("map 消去:", this.map)
    }
  }
}
