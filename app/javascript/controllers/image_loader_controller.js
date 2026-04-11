import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="image-loader"
export default class extends Controller {
  static targets = [
    "image",
    "placeholder"
  ]

  connect() {
  }

  loaded() {
    this.imageTarget.classList.remove("opacity-0")
    this.placeholderTarget.classList.add("hidden")
  }

  error() {
    this.placeholderTarget.textContent = "画像を表示できませんでした"
    this.placeholderTarget.classList.remove("animate-pulse")
  }
}
