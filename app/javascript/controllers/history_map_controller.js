import BaseMapController from "./base_map_controller.js"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from "@turf/turf"

// Connects to data-controller="history-map"
export default class extends BaseMapController {
  static values = { ...BaseMapController.values,
                    visitedGeohashes: Array,
                  }

  async connect(_element) {
    // base mapのconnectを実行
    super.connect();

    this.cumulativeFeature = this.generateFeatureFromGeohashes(this.visitedGeohashesValue, this.cumulativeGeohashes);

    // 中央位置設定
    if(this.longitudeValue && this.latitudeValue){
      this.center = [ this.longitudeValue, this.latitudeValue ]
    } else {
      this.center = [ 139.745, 35.658 ];
    }

    // 地図初期化
    await this.initializeMap(this.center)

    if (!this.map) return;

    // アトリビューション表記
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

      this.addMarkers();

      this.mapInitEnd = true;
      this.maybeClearOverlay();
    })
  }

  executeFogClearing(){
    if(!this.cumulativeFeature){
      console.log("geohashがないので何も実行しません")
      return;
    }

    // 世界全体からvisitedを引いて霧を作る
    const fogPolygon = turf.difference(turf.featureCollection([ this.worldFeature, this.cumulativeFeature ]));

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

  // 霧の初期化のhistorymapバージョン
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
          "fill-opacity": 0.3,
          'fill-antialias': false,
        }
      });
    }
  }
}
