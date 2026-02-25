import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="posts"
export default class extends Controller {
  static outlets = [ "ui" ]
  static targets = [ "postButton" ]
  static instanceCount = 0;
  static values = {
    lat: Number,
    lng: Number
  }

  // 接続時に実行
  connect() {
    this.uiOutlet.footerTarget.classList.add("hidden") // フッターのボタンを非表示に
    this.constructor.instanceCount++; // data-controller="posts" のインスタンスの数を加算
  }

  // 破棄時に実行
  disconnect(){
    this.constructor.instanceCount--; // インスタンスの数を一つ減らす

    if (this.constructor.instanceCount === 0){
      // インスタンスが0になったらフッターのボタンを再度表示する
      this.uiOutlet.footerTarget.classList.remove("hidden")
    }
  }

  // latValue変更時に自動で実行
  latValueChanged(){
    this.updateButtonUrl();
  }

  // lngValue変更時に自動で実行
  lngValueChanged(){
    this.updateButtonUrl();
  }

  // ボタンのURLにlng,latをセットする
  updateButtonUrl(){
    // ボタンが存在しない、latValue,lngValueがセットされていない時はreturn
    if(!this.hasPostButtonTarget || !this.hasLatValue || !this.hasLngValue) return;

    // lng,latをクエリパラメータとして今ののurlにセット
    const url = new URL(this.postButtonTarget.href, window.location.origin);
    url.searchParams.set("lat", this.latValue);
    url.searchParams.set("lng", this.lngValue);

    this.postButtonTarget.href = url.toString(); // 文字列に変換してからセット
  }

  close(){
    this.element.remove()
  }
}
