import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="scroll-reset"
export default class extends Controller {
  connect() {
  }

  top() {
    this.element.scrollTo({
      top: 0,
      behavior: "auto"
    })
  }
}
