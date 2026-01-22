import { Controller } from "@hotwired/stimulus"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import ngeohash from 'ngeohash';
import * as turf from "@turf/turf"

// Connects to data-controller="history-map"
export default class extends Controller {
  static targets = [ "mapOverlay" ]
  static values = { longitude: Number,
                    latitude: Number,
                    visitedGeohashes: Array,
                  }

  async connect(_element) {
    this.mapInitEnd         = false;
    this.clearMapOverlayEnd = false;

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
    if(this.visitedGeohashesValue.length === 0){
      console.log("geohashがないので何も実行しません")
      return;
    }

    // 今回追加するポリゴンを全て配列にする
    const polygonsToMerge = this.visitedGeohashesValue.map(hash => this.createPolygonFromGeohash(hash));

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

  disconnect(_element) {
    console.log("disconnect map controller")
    if (this.map) {
      this.map.remove(); // 地図機能の停止、削除
      console.log("map 消去:", this.map)
    }
  }
}
