import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="share-button"
export default class extends Controller {
  static values = { title: String,
                    text: String,
                    url: String,
                  }
  static targets = [ "fallbackShare", "nativeShare" ]

  connect() {
    if(!navigator.share){
      this.nativeShareTarget.classList.add("hidden")
    }
  }

  async open(){
    const shareData = {
      title: this.titleValue,
      text: `${this.titleValue}\n${this.textValue}`,
      url: this.urlValue
    }
    console.log(shareData)

    try {
      await navigator.share(shareData);
    } catch (err) {
      console.log("シェア機能がありません");
    }
  }
}
