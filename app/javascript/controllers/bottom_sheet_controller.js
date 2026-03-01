import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="bottom-sheet"
export default class extends Controller {
  static targets = [ "bottomSheetBox", "bottomSheetBackdrop" ]

  connect() {
    requestAnimationFrame(() => {
      this.element.classList.remove("opacity-0")
      if (this.hasBottomSheetBoxTarget) {
        this.bottomSheetBoxTarget.classList.remove("translate-y-full")
      }
    })
  }

  close() {
    requestAnimationFrame(() => {
      this.element.classList.add("opacity-0")
      if (this.hasBottomSheetBoxTarget) {
        this.bottomSheetBoxTarget.classList.add("translate-y-full")
      }
    })

    this.bottomSheetBoxTarget.addEventListener("transitionend", () => {
      this.element.remove();
    }, { once: true });
  }
}
