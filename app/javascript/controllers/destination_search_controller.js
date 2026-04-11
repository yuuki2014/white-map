import { Controller } from "@hotwired/stimulus"
import maplibregl from "maplibre-gl"
import { createGeocoderApi } from "../lib/geocoder_api"
import { getDistance } from "geolib";

// Connects to data-controller="destination-search"
export default class extends Controller {
  static outlets = [
    "map"
  ]

  static values = {
    geoapifyApiKey: String
  }

  static targets = [
    "searchPanel",
    "listPanel",
    "input",
    "results",
    "list",
    "destinationName",
    "destinationDistance",
    "destinationDirection",
    "destinationInfo",
    "searchIcon",
    "loadingIcon",
    "clearSearchButton",
  ]

  // 接続時に実行
  connect() {
    this.pendingMarkers = []; // 目的地候補のマーカー
    this.destinations = []; // 目的地の情報たち
    this.isSearching = false;
    this.setSearchState("idle");

    this.geocoderApi = createGeocoderApi(this, { apiKey: this.geoapifyApiKeyValue });
    this.handleLocationUpdate = this.handleLocationUpdate.bind(this);
    this.handleMapReady = this.handleMapReady.bind(this);
    this.handleMapRotate = this.handleMapRotate.bind(this);

    window.addEventListener("location:update", this.handleLocationUpdate);
    window.addEventListener("map:ready", this.handleMapReady);

    this.bindMapEventsIfReady(); // すでにmapが出来ていた場合
  }

  disconnect() {
    window.removeEventListener("location:update", this.handleLocationUpdate);
    window.removeEventListener("map:ready", this.handleMapReady);

    if (this.map) {
      this.map.off("rotate", this.handleMapRotate);
    }
  }

  handleLocationUpdate() {
    this.updateDestinationInfo();
  }

  handleMapRotate() {
    this.updateDestinationDirection();
  }

  handleMapReady() {
    this.bindMapEventsIfReady();
  }

  bindMapEventsIfReady() {
    if (!this.map) return;
    if (this.mapEventsBound) return;

    this.map.on("rotate", this.handleMapRotate);
    this.mapEventsBound = true;
  }

  // --- UIの表示設定 ----
  // 検索の状態と表示を管理
  setSearchState(state){
    this.searchState = state;

    this.searchIconTarget.classList.toggle("hidden", state !== "idle");
    this.loadingIconTarget.classList.toggle("hidden", state !== "loading");
  }

  toggleSearch(){
    this.searchPanelTarget.classList.toggle("hidden");
    this.listPanelTarget.classList.add("hidden")
  }

  closeSearch() {
    this.hideSearchPanel();
  }

  closeList() {
    this.hideListPanel();
  }

  hideSearchPanel() {
    this.searchPanelTarget.classList.add("hidden")
  }

  hideListPanel() {
    this.listPanelTarget.classList.add("hidden")
  }

  toggleList() {
    this.listPanelTarget.classList.toggle("hidden")
    this.searchPanelTarget.classList.add("hidden")
  }
  // --- UIの表示設定ここまで ---

  // --- ゲッターの設定 ---
  get currentPosition(){
    return this.hasMapOutlet ? this.mapOutlet.getCurrentPosition() : null;
  }

  get currentLat(){
    return this.currentPosition?.lat ?? null;
  }

  get currentLng(){
    return this.currentPosition?.lng ?? null;
  }

  get map(){
    return this.hasMapOutlet ? this.mapOutlet.getMap() : null;
  }
  // --- ゲッターの設定ここまで ---

  // geolocateのトラッキングを停止
  disableGeolocateTracking() {
    if(this.hasMapOutlet){
      this.mapOutlet.disableGeolocateTracking()
    }
  }

  async search(event){
    event.preventDefault();

    if (this.searchState === "loading") return;

    const query = this.inputTarget.value.trim(); // 入力された文字列を整形

    // queryが空の場合は検索結果と結果マーカーをクリアする
    if(!query){
      this.clearSearchState();
      return;
    }

    this.setSearchState("loading");

    this.clearSearchState();

    try {
      const response = await this.geocoderApi.forwardGeocode({ query });
      const features = response.features || [];

      this.renderSearchResults(features);
      this.renderPendingMarkers(features);
    } catch (error) {
      console.error("destination search error:", error);
      this.clearSearchState();
    } finally {
      this.setSearchState("idle");
    }
  }

  // 検索結果をリストに表示
  renderSearchResults(features){
    this.clearSearchResults();

    this.clearSearchButtonTarget.classList.remove("hidden")

    if(features.length === 0){
      const li = document.createElement("li");
      li.className = "rounded-xl bg-white/60 px-3 py-1 text-sm text-gray-800 shadow-sm";
      li.textContent = "検索結果が見つかりませんでした";
      this.resultsTarget.appendChild(li);
      return;
    }

    features.forEach(feature => {
      const li = document.createElement("li");
      li.className = "rounded-xl bg-white/60 px-3 py-2 text-sm text-gray-800 shadow-sm cursor-pointer hover:bg-gray-200/60 active:scale-95 active:shadow-sm transition";

      const placeName = feature.place_name.split(",");

      const divName = document.createElement("div");
      divName.className = "text-sm font-semibold"

      const divData = document.createElement("div");
      divData.className = "text-xs text-gray-500"

      divName.textContent = placeName[0]
      divData.textContent = placeName.slice(1).join(",");

      li.appendChild(divName);
      li.appendChild(divData);
      this.resultsTarget.appendChild(li);

      li.addEventListener("click", () => {
        const coords = feature.center || feature.geometry.coordinates; // 座標をセット
        this.disableGeolocateTracking(); // 現在地追従をオフ
        this.hideSearchPanel();

        this.map.flyTo({
          center: coords,
          zoom: 16
        });
      });
    })
  }

  // 検索結果のマーカーを地図上に表示
  renderPendingMarkers(features){
    console.log("マーカーを描画:",features);
    if(!this.map || !this.hasMapOutlet) return;

    const lng = this.currentLng;
    const lat = this.currentLat;

    const bounds = new maplibregl.LngLatBounds(); // 箱を用意
    if (lng != null && lat != null) {
      bounds.extend([lng, lat]); // 現在地を格納
    }

    features.forEach(feature => {
      const placeName = feature.place_name.split(",")[0];
      const coords = feature.center || feature.geometry.coordinates;
      bounds.extend(coords); // 検索結果の座標を箱に格納

      // マーカーを地図に追加
      const marker = new maplibregl.Marker({color: "#f233e9"})
        .setLngLat(coords)
        .addTo(this.map)

      // マーカーに名前を表示
      const el = marker.getElement();
      const label = document.createElement('div');
      label.textContent = placeName || feature.text || feature.properties?.name || "目的地候補";
      label.className = "absolute -top-7 left-1/2 -translate-x-1/2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold text-gray-800 whitespace-nowrap pointer-events-none shadow-sm";
      el.appendChild(label);

      // マーカーをクリックで目的地として登録するモーダルを表示
      el.addEventListener("click", () => {
        this.openConfirmDestinationModal(feature, coords);
      })
      this.pendingMarkers.push(marker);
    })

    // 全ての目的地が表示されるようにカメラを移動
    if (!bounds.isEmpty()) {
      this.disableGeolocateTracking();

      this.map.fitBounds(bounds, {
        padding: 130,
        duration: 1000,
        maxZoom: 16
      });
    }
  }

  // 検索結果をクリア
  clearSearchResults(){
    this.resultsTarget.innerHTML = "";
  }

  clearSearchState() {
    this.clearSearchResults();
    this.clearPendingMarkers();
    this.clearSearchButtonTarget.classList.add("hidden");
  }

  clearSearchAll() {
    this.inputTarget.value = '';
    this.clearSearchState();
  }

  // 検索結果のマーカーをクリア
  clearPendingMarkers(){
    if (this.pendingMarkers && this.pendingMarkers.length > 0) {
      this.pendingMarkers.forEach(marker => {
        marker.remove();
      });
      this.pendingMarkers = [];
    }
  }

  // 目的地を登録するのか確認
  openConfirmDestinationModal(feature, coords){
    const ok = window.confirm(`ここを目的地${this.destinations.length + 1}としてセットしますか？`);
    if (!ok) return;

    this.addConfirmedDestination(feature, coords); // 目的地を登録
    this.inputTarget.value = ""
    this.clearSearchState(); // 検索結果とマーカーを削除
    this.hideSearchPanel();
    this.updateDestinationInfo();
  }

  // 目的地を追加
  addConfirmedDestination(feature, coords){
    const placeName = feature.place_name.split(",")[0] || feature.text || feature.properties?.name || "目的地"; // 目的地の名前を設定

    // マーカーを追加
    const marker = new maplibregl.Marker({color: "#42f587"})
      .setLngLat(coords)
      .addTo(this.map);

    // マーカーに名前を追加
    const el = marker.getElement();
    const label = document.createElement('div');
    label.textContent = placeName;
    label.className = "absolute -top-7 left-1/2 -translate-x-1/2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold text-gray-800 whitespace-nowrap pointer-events-none shadow-sm";
    el.appendChild(label);

    // マーカーにイベントリスナーを登録
    el.addEventListener('click', (e) => {
      e.stopPropagation();

      const currentIndex = this.destinations.findIndex(dest => dest.marker === marker); // 削除する要素の順番を取得

      if (currentIndex !== -1) {
        this.removeDestination(currentIndex); // 見つかったら配列からデータを削除
      }
    });

    // 配列にデータを追加
    this.destinations.push({
      name: placeName,
      lng: coords[0],
      lat: coords[1],
      marker: marker,
      labelElement: label,
    })

    this.updateDestinationList(); // リストの描画と順番の更新
  }

  // 目的地リストをデータに合わせて描画
  updateDestinationList() {
    const ul = this.listTarget;
    ul.innerHTML = ''; // 一旦リストを空に

    // 目的地がゼロになったらコンテナごと隠す
    if (this.destinations.length === 0) {
      this.listPanelTarget.classList.add('hidden');
      return;
    }

    this.listPanelTarget.classList.remove('hidden'); // 目的地リストを表示

    // 配列をループしてリストとマーカーを作り直す
    this.destinations.forEach((dest, index) => {
      const order = index + 1; // orderに順番を設定

      // マーカーのラベルにテキストコンテンツに順番と名前をセット
      dest.labelElement.textContent = `${order}. ${dest.name}`;

      // リストを作成
      const li = document.createElement('li');
      li.className = "flex items-center justify-between rounded-xl bg-white/10 px-2 py-2 shadow-sm cursor-pointer hover:bg-gray-200/80 active:scale-95 active:shadow-sm transition";
      li.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white">${order}</span>
          <span class="truncate text-sm font-medium text-gray-800">${dest.name}</span>
        </div>
        <button class="flex-shrink-0 text-gray-400 hover:text-red-500 transition-opacity p-1 focus:outline-none">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      `

      // 削除ボタンのイベントを設定
      const deleteBtn = li.querySelector('button');

      // 削除ボタンにイベントリスナーを設定
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // イベントの伝播を停止
        this.removeDestination(index); // 目的地を削除
      });

      // リストにカメラを移動させるイベントリスナーを設定
      li.addEventListener('click', (e) => {
        e.stopPropagation(); // イベントの伝播を停止

        const lng = this.currentLng;
        const lat = this.currentLat;

        const bounds = new maplibregl.LngLatBounds(); // 箱を用意

        if (lng != null && lat != null) {
          bounds.extend([lng, lat]); // 現在地を格納
        }
        bounds.extend([dest.lng, dest.lat]); // 目的地の座標を箱に格納

        // boundsが全て見えるようにカメラを移動
        if (!bounds.isEmpty()) {
          this.disableGeolocateTracking();

          this.map.fitBounds(bounds, {
            padding: 130,
            duration: 1000,
            maxZoom: 16
          });
        }
      });

      ul.appendChild(li); // リストに要素を追加
    });
  }

  // 目的地を削除
  removeDestination(index) {
    const placeName = this.destinations[index].name; // 名前を取得

    const ok = window.confirm(`目的地「${placeName}」を削除しますか？`);
    if (!ok) return;

    this.destinations[index].marker.remove(); // 地図上からマーカー消去
    this.destinations.splice(index, 1); // 配列のデータを削除

    this.updateDestinationList(); // 更新後のデータで再描画
    this.updateDestinationInfo();
  }

  // 目的地までの距離方角を更新
  updateDestinationInfo(){
    if(this.destinations.length === 0 || this.currentLat == null || this.currentLng == null){
      this.destinationNameTarget.textContent = '';
      this.destinationDistanceTarget.textContent = '';
      this.destinationInfoTarget.classList.add("hidden");
      return;
    }

    const name = this.destinations[0].name;
    const distanceLng = this.destinations[0].lng;
    const distanceLat = this.destinations[0].lat;

    const dist = getDistance(
      { latitude: this.currentLat, longitude: this.currentLng }, // 現在地
      { latitude: distanceLat, longitude: distanceLng }  // 目的地
    );
    let distText = "";

    if(dist > 999){
      distText += (dist / 1000).toFixed(1);
      distText += " km"
    } else {
      distText += Math.round(dist);
      distText += " m";
    }

    this.destinationNameTarget.textContent = name;
    this.destinationDistanceTarget.textContent = distText;
    this.destinationInfoTarget.classList.remove("hidden");
    this.updateDestinationDirection();
  }

  // 目的地のまでの方角を更新
  updateDestinationDirection() {
    if (this.destinations.length === 0 || this.currentLat == null || this.currentLng == null) return;

    const destination = this.destinations[0];

    const targetBearing = this.calculateBearing(
      this.currentLat,
      this.currentLng,
      destination.lat,
      destination.lng
    );

    const mapBearing = this.map.getBearing(); // 地図の回転角
    const rotate = targetBearing - mapBearing;

    this.destinationDirectionTarget.style.transform = `rotate(${rotate}deg)`;
  }

  // 方角を計算
  calculateBearing(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lng2 - lng1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }
}
