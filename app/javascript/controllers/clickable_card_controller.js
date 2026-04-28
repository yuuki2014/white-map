import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="clickable-card"
export default class extends Controller {
  static targets = ["link"]

  connect() {
  }

  open(event) {
    if (event.target.closest("a, button, input, textarea, select, label, summary, [data-clickable-card-ignore]")) {
      return
    }

    this.linkTarget.click()
  }
}
