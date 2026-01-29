import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="posts"
export default class extends Controller {
  static outlets = [ "ui" ]
  static targets = [ "latitude", "longitude" ]
  static instanceCount = 0;

  connect() {
    console.log(this.element)
    console.log(this.uiOutlet.footerTarget)
    this.uiOutlet.footerTarget.classList.add("hidden")
    this.constructor.instanceCount++;
    console.log(this.constructor.instanceCount);
  }

  disconnect(){
    this.constructor.instanceCount--;

    console.log(this.constructor.instanceCount);
    if (this.constructor.instanceCount === 0){
      this.uiOutlet.footerTarget.classList.remove("hidden")
    }
  }

  latitudeTargetConnected(){
    console.log(this.uiOutlet.latitudeValue)
    this.latitudeTarget.value = this.uiOutlet.latitudeValue
  }

  longitudeTargetConnected(){
    console.log(this.uiOutlet.longitudeValue)
    this.longitudeTarget.value = this.uiOutlet.longitudeValue
  }

  close(){
    this.element.remove()
  }
}
