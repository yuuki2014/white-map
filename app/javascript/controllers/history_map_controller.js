import { Controller } from "@hotwired/stimulus"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import ngeohash from 'ngeohash';
import * as turf from "@turf/turf"

// Connects to data-controller="history-map"
export default class extends Controller {
  static outlets = [ "ui" ]
  static targets = [ "mapOverlay" ]
  static values = { longitude: Number,
                    latitude: Number,
                    visitedGeohashes: Array,
                  }

  async connect(_element) {
    this.mapInitEnd         = false;
    this.clearMapOverlayEnd = false;

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

    this.currentLongitude = this.center[0]
    this.currentLatitude = this.center[1]
    this.uiOutlet.longitudeValue = this.currentLongitude
    this.uiOutlet.latitudeValue = this.currentLatitude
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

      this.map.on('move', () => {
        const center = this.map.getCenter();
        this.currentLatitude = center.lat
        this.currentLongitude = center.lng
        this.uiOutlet.longitudeValue = this.currentLongitude
        this.uiOutlet.latitudeValue = this.currentLatitude
      })
      this.executeFogClearing();

      this.mapInitEnd = true;
      this.maybeClearOverlay();
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
