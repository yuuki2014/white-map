import BaseMapController from "./base_map_controller.js"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from "@turf/turf"
import ngeohash from 'ngeohash'

const USE_WEBGL_FOG = true;

// Connects to data-controller="history-map"
export default class extends BaseMapController {
  static values = { ...BaseMapController.values,
                    visitedGeohashes: Array,
                  }

  async connect(_element) {
    // base mapのconnectを実行
    super.connect();

    await this.initVisitedGeohashes();
    // this.cumulativeFeature = this.generateFeatureFromGeohashes(this.visitedGeohashesValue, this.cumulativeGeohashes);

    // 中央位置設定
    if(this.longitudeValue && this.latitudeValue){
      this.center = [ this.longitudeValue, this.latitudeValue ]
    } else {
      this.center = [ 139.745, 35.658 ];
    }

    // 地図初期化
    await this.initializeMap(this.center)

    if (!this.map) return;

    this.fitToVisitedArea();

    // アトリビューション表記
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

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
      // 霧を初期化
      this.fogInit();
      this.setFogOpacity(0.6);
      this.setFogColor(26, 38, 52)
      this.setupCustomFogLayerEvents()

      // toHide.forEach(id => {
      //   if (this.map.getLayer(id)) {
      //     this.map.setLayoutProperty(id, "visibility", "none");
      //   }
      // });

      // this.executeFogClearing();
      this.updateCustomFogLayer();

      // this.initRevealedAreaLayer();
      // this.updateRevealedArea();

      this.addMarkers();

      this.mapInitEnd = true;
      this.maybeClearOverlay();
    })
  }

  async initVisitedGeohashes(){
    this.visitedGeohashes = new Set();
    console.log(window.location.pathname.slice(1))
    if (String(window.location.pathname.slice(1)) === "my_map"){
      await this.setCumulativeGeohashesAndFeature(this.visitedGeohashes);
    } else {
      this.generateFeatureFromGeohashes(this.visitedGeohashesValue, this.visitedGeohashes);
    }
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
    if (!this.hasMapOverlayTarget) return;

    const el = this.mapOverlayTarget

    const removeOverlay = () => {
      if (el.isConnected) el.remove();
    };

    const fallbackTimer = setTimeout(removeOverlay, 5000);

    el.addEventListener("transitionend", () => {
      clearTimeout(fallbackTimer);
      removeOverlay();
    }, { once: true })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add("-translate-y-full");
      });
    });
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

  // 霧の初期化
  // fogInit(){
  //   if (USE_WEBGL_FOG){
  //     this.fogCustomLayer = new GeohashFogCustomLayer({
  //       id: "geohash-fog-custom-layer",
  //       opacity: 0.65,
  //     })

  //     if (!this.map.getLayer('geohash-fog-custom-layer')) {
  //       this.map.addLayer(this.fogCustomLayer)
  //     }

  //   } else {
  //     if (!this.map.getSource('fog')) {
  //       this.map.addSource('fog', {
  //         type: 'geojson',
  //         data: this.worldFeature
  //       });
  //     }

  //     if (!this.map.getLayer('fog-layer')) {
  //       this.map.addLayer({
  //         id: 'fog-layer',
  //         type: "fill",
  //         source: 'fog',
  //         paint: {
  //           "fill-color": "#f2eee8",
  //           "fill-opacity": 0.55,
  //           'fill-antialias': false,
  //         }
  //       });
  //     }
  //   }
  // }

  initRevealedAreaLayer() {
    if (!this.map.getSource('revealed-area')) {
      this.map.addSource('revealed-area', {
        type: 'geojson',
        data: this.cumulativeFeature || turf.featureCollection([])
      });
    }

    // ふわっとした外側の光
    if (!this.map.getLayer('revealed-outline-glow')) {
      this.map.addLayer({
        id: 'revealed-outline-glow',
        type: 'line',
        source: 'revealed-area',
        paint: {
          'line-color': '#8b6b4a',
          'line-opacity': 0.1,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            10, 2,
            14, 4,
            17, 6
          ],
          'line-blur': 3
        }
      });
    }

    // くっきりした境界線
    if (!this.map.getLayer('revealed-outline')) {
      this.map.addLayer({
        id: 'revealed-outline',
        type: 'line',
        source: 'revealed-area',
        paint: {
          'line-color': '#ad8d6c',
          'line-opacity': 0.5,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            10, 1,
            14, 1,
            17, 2
          ]
        }
      });
    }
  }

  updateRevealedArea() {
    const source = this.map.getSource('revealed-area');
    if (!source) return;

    source.setData(this.cumulativeFeature || turf.featureCollection([]));
  }

  setupCustomFogLayerEvents() {
    // moveendとzoomendの両方で実行
    const updateEvents = ["moveend", "zoomend"];

    updateEvents.forEach(eventType => {
      this.map.on(eventType, () => {
        // カスタムレイヤーが存在し、かつ表示中であれば更新する
        if (this.fogCustomLayer && this.visitedGeohashes?.size > 0) {
          this.updateCustomFogLayer();
        }
      });
    });
  }

  fitToVisitedArea() {
    if (!this.visitedGeohashes || this.visitedGeohashes.size === 0) return;

    let minLat = Infinity, minLng = Infinity;
    let maxLat = -Infinity, maxLng = -Infinity;

    // すべてのGeohashを走査して外郭を探す
    this.visitedGeohashes.forEach(hash => {
      const bbox = ngeohash.decode_bbox(hash); // [s, w, n, e]

      if (bbox[0] < minLat) minLat = bbox[0];
      if (bbox[1] < minLng) minLng = bbox[1];
      if (bbox[2] > maxLat) maxLat = bbox[2];
      if (bbox[3] > maxLng) maxLng = bbox[3];
    });

    // MapLibreのfitBoundsに渡す
    this.map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        padding: 50,
        duration: 0,
        bearing: 0,
        pitch: 0,
        essential: true
      }
    );
  }
}
