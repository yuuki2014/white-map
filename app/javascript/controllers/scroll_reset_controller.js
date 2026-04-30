import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="scroll-reset"
export default class extends Controller {
  connect() {
    console.log("アイウエオ")
  }

  top() {
    console.log("会う家お")
    this.element.scrollTo({
      // top: 0,
      // behavior: "auto"
    })
  }
}
