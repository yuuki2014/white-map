import { STATUS } from "../constants/status"
import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="ui"
export default class extends Controller {
  static outlets = [ "map" ]
  static targets = [ "footer", "leftButtonContainer", "rightNormalButtonContainer", "rightRecordingButtonContainer", "pauseButtonContainer", "bottomSheet", "playButton", "pauseButton", "tripIdReceiver" ]
  static values = { status: String,
                    tripId: String
                  }

  connect() {
    console.log("接続テスト");
    // this.mapOutlet.showLocationDeniedModal()
    // 初期化
    // status の初期値をセット
    if(!this.hasStatusValue) {
      this.statusValue = STATUS.STOPPED;
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
    this.mapOutlet.setFlashTimer();
  }

  resumeRecording(){
    console.log("記録再開");
    this.statusValue = STATUS.RECORDING
    this.mapOutlet.setStatus(this.statusValue);
  }

  pauseRecording(){
    console.log("一時停止");
    this.mapOutlet.flashBuffer();
    this.mapOutlet.postFootprint();
    this.statusValue = STATUS.PAUSED
    this.mapOutlet.setStatus(this.statusValue);
  }

  endRecording(){
    console.log("記録を終えました");
    this.mapOutlet.clearFlashTimer();
    this.statusValue = STATUS.ENDED
    this.mapOutlet.setStatus(this.statusValue);
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

  checkGeolocate(event){
    console.log("現在地情報チェック")
    this.mapOutlet.checkGeolocate(event);
  }
}
