import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="error"
export default class extends Controller {
  connect() {
    requestAnimationFrame(() => {
      this.element.classList.remove("opacity-0", "-translate-y-2")
    })

    setTimeout(() => {
      this.element.classList.add("opacity-0")
      this.element.addEventListener("transitionend", () => {
        this.element.remove();
      }, { once: true });
    }, 1500)
  }
}
