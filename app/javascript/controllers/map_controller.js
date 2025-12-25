import { Controller } from "@hotwired/stimulus"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Connects to data-controller="map"
export default class extends Controller {
  async connect() {
    console.log("stimulus map 接続確認")
    const apiKey = this.element.dataset.maptilerKey;

    // 地図のstyleを取得
    const res = await fetch(`https://api.maptiler.com/maps/jp-mierune-streets/style.json?key=${apiKey}`);
    const styleJson = await res.json();

    console.log(styleJson);

    // デフォルトの中央
    let center = [ 139.745, 35.658 ]

    // 現在地を取得
    try {
      // getCurrentPosition関数で現在地を取得
      const position = await this.getCurrentPosition();

      // 取得できたら現在地で中央を書き換え
      center = [ position.coords.longitude, position.coords.latitude ]
    } catch (error) {
      console.log("位置情報が取得できなかったのでデフォルトの中央を設定", error);
    }

    // 地図の初期化
    this.map = new maplibregl.Map({
      container: this.element,
      style: styleJson,
      center: center,
      zoom: 17
    });

    // 現在地追跡機能を作成
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        // 高精度（GPS）モードを有効に
        enableHighAccuracy: true,
        // 10秒(10000ms)以内のデータなら、再利用して
        maximumAge: 10000
      },
      // 移動に合わせてドットが動く
      trackUserLocation: true,
      // スマホの向いている方角を表示するか
      showUserHeading: true,
      // ズームカメラの設定
      fitBoundsOptions: {
      }
    });

    console.log(geolocate)

    // 地図に現在地を追加。右上にボタン
    this.map.addControl(geolocate);

    // 元々のtriggerを一時保存
    const originalTrigger = geolocate.trigger.bind(geolocate);

    // triggerを上書き
    geolocate.trigger = () => {
      // 現在のズームレベルを取得
      const currentZoom = this.map.getZoom();

      // オプションを現在のズームレベルで書き換え
      geolocate.options.fitBoundsOptions = {
        maxZoom: currentZoom,
        minZoom: currentZoom,
      }

      return originalTrigger();
    }

    let num = 0;

    // 現在地を取得
    geolocate.on('geolocate', (data) => {

      const lat = data.coords.latitude;  // 緯度
      const lng = data.coords.longitude; // 経度
      const recordTime = data.timestamp; // 取得時間
      num += 1;

      console.log(num)
      console.log("取得時刻:", recordTime);
      console.log("現在地取得:", lat, lng);

      this.currentLat = lat;
      this.currentLng = lng;
      this.currentRecordTime = recordTime;
    })

    // 地図の読み込みが終わった後に実行
    this.map.on('load', () => {
      // 地図上の現在地ボタンを起動
      geolocate.trigger();
    })

    // アイコンが足りない時のダミー追加。後で正しいアイコンが表示されるように設定する
    this.map.on('styleimagemissing', (e) => {
      const id = e.id;
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
        timeout: 5000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  disconnect() {
    console.log("disconnect:", this.map)
    if (this.map) {
      this.map.remove(); // 地図機能の停止、画面から削除
      this.map = null; // メモリの解放
      console.log("map 消去:", this.map)
    }
  }
}
