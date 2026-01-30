import { Controller } from "@hotwired/stimulus"
import { get } from "@rails/request.js"

// Connects to data-controller="posts"
export default class extends Controller {
  static outlets = [ "ui", "history-map" ]
  static targets = [ "latitude", "longitude", "postButton" ]
  static instanceCount = 0;
  static values = {
    lat: Number,
    lng: Number
  }

  connect() {
    // console.log(this.element)
    // console.log(this.uiOutlet.footerTarget)
    console.log(this.latValue)
    console.log(this.lngValue)
    this.uiOutlet.footerTarget.classList.add("hidden")
    this.constructor.instanceCount++;
    // console.log(this.constructor.instanceCount);
  }

  disconnect(){
    this.constructor.instanceCount--;

    console.log(this.constructor.instanceCount);
    if (this.constructor.instanceCount === 0){
      this.uiOutlet.footerTarget.classList.remove("hidden")
    }
  }

  postButtonTargetConnected(){
    this.element.removeAttribute("data-posts-lat-value")
    this.element.removeAttribute("data-posts-lng-value")
    this.latValue = null;
    this.lngValue = null;
  }

  postValidation(event){
    console.log("バリデーション")
    console.log(this.latValue)
    console.log(this.lngValue)
    if(this.latValue && this.lngValue) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    get("/post_flash", { responseKind: "turbo-stream" });
  }

  latitudeTargetConnected(){
    console.log("ラティ")
    console.log(this.latValue)
    // this.latitudeTarget.value = String(this.latValue)
    this.latitudeTarget.value = this.uiOutlet.postLatitudeValue
    console.log(this.latitudeTarget.value)
  }

  longitudeTargetConnected(){
    console.log("ラング")
    console.log(this.lngValue)
    // this.longitudeTarget.value = String(this.lngValue)
    this.longitudeTarget.value = this.uiOutlet.postLongitudeValue
    console.log(this.longitudeTarget.value)
  }

  close(){
    this.element.remove()
  }
}
