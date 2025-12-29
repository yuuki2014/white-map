import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="dispatch"
export default class extends Controller {
  connect() {
    window.dispatchEvent(new CustomEvent("map:geolocate"))
    this.element.remove()
  }
}
