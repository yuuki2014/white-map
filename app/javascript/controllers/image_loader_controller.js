import { Controller } from "@hotwired/stimulus"
import * as Sentry from "@sentry/browser"

// Connects to data-controller="image-loader"
export default class extends Controller {
  static targets = [
    "image",
    "placeholder"
  ]

  connect() {
    this.originalSrc = this.imageTarget.getAttribute("src") || null // 画像へのリダイレクトリンクを取得
    this.retryCount = 0;

    // すでに読み込み済みなら、loadイベントを待たずに表示する
    if (this.imageTarget.complete && this.imageTarget.naturalWidth > 0) {
      this.loaded()
    }
  }

  // 画像ロード完了後
  loaded() {
    this.imageTarget.classList.remove("opacity-0")
    this.placeholderTarget.classList.add("hidden")
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 画像ロード失敗時
  async error() {
    if (this.originalSrc){
      if (this.retryCount < 5) {
        this.retryCount++;

        const delayTime = [1000, 2000, 3000, 5000, 8000][this.retryCount - 1]

        await this.delay(delayTime);

        this.imageTarget.setAttribute("src", this.originalSrc) // URLを再セットして画像を再読み込み
        return
      }
    }


    Sentry.withScope((scope) => {
      scope.setLevel("warning")
      scope.setTag("feature", "image_loader")
      scope.setTag("event_type", "image_load_error")
      scope.setTag("retried", "true")

      scope.setContext("image_loader", {
        src: this.originalSrc,
        currentSrc: this.imageTarget.currentSrc || null,
        alt: this.imageTarget.getAttribute("alt") || null,
        complete: this.imageTarget.complete,
        naturalWidth: this.imageTarget.naturalWidth || 0,
        naturalHeight: this.imageTarget.naturalHeight || 0
      })

      Sentry.captureMessage("画像読み込みに失敗しました")
    })

    this.placeholderTarget.classList.remove("opacity-0")
    this.placeholderTarget.innerHTML = `
      <span
        class="block text-center leading-tight text-gray-500 font-medium px-2 break-words"
        style="font-size: clamp(10px, 9cqw, 14px);"
      >
        画像を表示できませんでした
      </span>
    `
  }
}
