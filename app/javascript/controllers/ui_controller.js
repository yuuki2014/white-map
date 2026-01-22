import { STATUS } from "../constants/status"
import { Controller } from "@hotwired/stimulus"

const HIDDEN_TIMEOUT = 3000;
const EVENTS = [ "click", "touchstart", "pointerdown" ]

// Connects to data-controller="ui"
export default class extends Controller {
  static outlets = [ "map" ]
  static targets = [ "footer", "leftButtonContainer", "rightNormalButtonContainer", "rightRecordingButtonContainer", "pauseButtonContainer", "bottomSheet", "playButton", "pauseButton", "tripIdReceiver", "uiOverlay" ]
  static values = { status: String,
                    tripId: String
                  }

  connect() {
    console.log(EVENTS)
    console.log("接続テスト");
    // this.mapOutlet.showLocationDeniedModal()
    // 初期化
    // status の初期値をセット
    if(!this.hasStatusValue) {
      this.statusValue = STATUS.STOPPED;
    }

    // UIを隠すタイマーIDを保持
    this.hiddenTimerId = null;

    // transitionend イベント内で実行するイベントを定義
    this._handleTransitionEnd = () => {
      if (this.maplibreTopContainer.classList.contains("opacity-0")) {
        this.maplibreTopContainer.classList.add("hidden")
      }
    }

    // デバウンスでUIを隠すタイマーをセット
    this._debounceEvent = () => {
      clearTimeout(this.hiddenTimerId);
      this.hiddenTimerId = null;
      if(this.statusValue === STATUS.RECORDING){
        this.visibleUi();
        this.setHiddenTimer();
      }
    }
  }

  // trip-id-receiver 接続時に呼ばれる
  tripIdReceiverTargetConnected(element){
    const newId = element.dataset.tripId

    if (newId) {
      console.log("trip ID: ", newId);
      this.tripIdValue = newId
    }
    element.remove();
  }

  tripIdValueChanged(value, previousValue) {
    // 初期化時は何もしない
    if(!value) return

    console.log(`Trip ID が${value}になりました。`)
    this.startRecording();
  }

  stopRecording(){
    console.log("記録停止中")
    this.statusValue = STATUS.STOPPED;
    this.mapOutlet.setStatus(this.statusValue);
  }

  startRecording(){
    console.log("記録モード開始")
    this.mapOutlet.setTripId(this.tripIdValue);
    this.statusValue = STATUS.RECORDING
    this.mapOutlet.setStatus(this.statusValue);
    this.mapOutlet.postFootprint();
    this.mapOutlet.setFlushTimer();
    this.mapOutlet.executeFogClearing();

    // デバウンスイベントをセット
    this.documentSetHiddenTimer();
    this.setHiddenTimer();
  }

  resumeRecording(){
    console.log("記録再開");
    this.statusValue = STATUS.RECORDING
    this.mapOutlet.setStatus(this.statusValue);
  }

  pauseRecording(){
    console.log("一時停止");
    this.mapOutlet.flushBuffer();
    this.mapOutlet.postFootprint();
    this.statusValue = STATUS.PAUSED
    this.mapOutlet.setStatus(this.statusValue);
  }

  endRecording(){
    console.log("記録を終えました");
    this.mapOutlet.clearFlushTimer();
    this.statusValue = STATUS.ENDED
    this.mapOutlet.setStatus(this.statusValue);
    this.mapOutlet.resetFog();

    this.documentRemoveHiddenTimer();
  }

  // status 変化時に自動で呼ばれるメソッド
  statusValueChanged(value, previousValue){
    console.log(`状態が ${previousValue} から ${value} に変わりました`)

    switch (value){
      // 探索停止(初期状態)になった時
      case STATUS.STOPPED:
        if (this.hasPlayButtonTarget) {
          this.playButtonTarget.classList.remove("hidden")
          this.pauseButtonContainerTarget.classList.add("translate-y-[calc(100%+6rem)]")
          this.rightNormalButtonContainerTarget.classList.remove("translate-x-full")
          this.pauseButtonTarget.classList.add("hidden")
          this.leftButtonContainerTarget.classList.add("-translate-x-full")
          this.rightRecordingButtonContainerTarget.classList.add("translate-x-full")
        }
        if (this.hasBottomSheetTarget) {
          this.bottomSheetTarget.classList.remove("translate-y-full")
        }
        break;
      // 地図記録中になった時
      case STATUS.RECORDING:
        this.playButtonTarget.classList.add("hidden")
        this.pauseButtonTarget.classList.remove("hidden")
        this.leftButtonContainerTarget.classList.remove("-translate-x-full")
        this.rightNormalButtonContainerTarget.classList.add("translate-x-full")
        this.rightRecordingButtonContainerTarget.classList.remove("translate-x-full")
        this.bottomSheetTarget.classList.add("translate-y-full")
        this.pauseButtonContainerTarget.classList.add("translate-y-[calc(100%+6rem)]")
        break;
      // 地図記録一時停止中になった時
      case STATUS.PAUSED:
        this.playButtonTarget.classList.remove("hidden")
        this.pauseButtonTarget.classList.add("hidden")
        this.pauseButtonContainerTarget.classList.remove("translate-y-[calc(100%+6rem)]")
        break;
      case STATUS.ENDED:
        // 保存確認モーダルを表示する
        this.stopRecording();
        break;
    }
  }

  // 現在地が取得できているのかチェック
  checkGeolocate(event){
    this.mapOutlet.checkGeolocate(event);
  }

  hiddenIcon(){
    this.transitionEvents = new AbortController();

    if(!this.maplibreTopContainer){
      this.maplibreTopContainer = document.querySelector(".maplibregl-ctrl-group")
    }

    this.maplibreTopContainer.classList.add("transition-opacity", "duration-500", "opacity-0")
    this.maplibreTopContainer.addEventListener("transitionend", this._handleTransitionEnd, { signal: this.transitionEvents.signal, once: true });

    this.leftButtonContainerTarget.classList.add("-translate-x-full")
    this.rightRecordingButtonContainerTarget.classList.add("translate-x-full")
  }

  visibleUi(){
    this.leftButtonContainerTarget.classList.remove("-translate-x-full")
    this.rightRecordingButtonContainerTarget.classList.remove("translate-x-full")

    if(this.maplibreTopContainer){
      this.maplibreTopContainer = document.querySelector(".maplibregl-ctrl-group")
    }
    this.maplibreTopContainer.classList.remove("hidden");
    // this.maplibreTopContainer.removeEventListener("transitionend", this._handleTransitionEnd);
    this.transitionEvents?.abort();
    this.transitionEvents = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.maplibreTopContainer.classList.remove("opacity-0")
      });
    });
  }

  // document の各イベントハンドラに _debounceEvent をセット
  documentSetHiddenTimer(){
    this.debounceEvents = new AbortController();
    EVENTS.forEach((e) => {
      document.addEventListener(e, this._debounceEvent, { signal: this.debounceEvents.signal });
    });
  }

  documentRemoveHiddenTimer(){
    this.debounceEvents?.abort();
    this.debounceEvents = null;
    // EVENTS.forEach((e) => {
    //   document.removeEventListener(e, this._debounceEvent);
    // })
  }

  // 一定時間後アイコンを隠す
  setHiddenTimer(){
    if(!this.maplibreTopContainer){
      this.maplibreTopContainer = document.querySelector(".maplibregl-ctrl-group");
    }

    clearTimeout(this.hiddenTimerId);

    this.hiddenTimerId = setTimeout(() => {
      if(this.statusValue === STATUS.RECORDING){
        this.hiddenIcon();
      }
    }, HIDDEN_TIMEOUT);
  }

  disconnect(){
    clearTimeout(this.hiddenTimerId)
    this.hiddenTimerId = null

    // this.maplibreTopContainer.removeEventListener("transitionend", this._handleTransitionEnd);
    this.transitionEvents?.abort();
    this.documentRemoveHiddenTimer();
  }
}
