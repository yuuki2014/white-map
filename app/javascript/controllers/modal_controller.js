import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "modalBox", "modalBackdrop" ]
  static values  = { url: String }

  connect() {
    requestAnimationFrame(() => {
      this.element.classList.remove("opacity-0")
      this.modalBoxTarget.classList.remove("opacity-0", "translate-y-40")
    })
  }

  close() {
    requestAnimationFrame(() => {
      this.element.classList.add("opacity-0")
      this.modalBoxTarget.classList.add("opacity-0", "translate-y-40")
    })

    // this.modalBoxTarget.addEventListener("transitionend", () => {
    //   this.element.remove();
    // }, { once: true });
    setTimeout(() => {
      this.element.remove();
    }, 300);
  }

  open(event){
    const url = event.params.url;

    if(url){
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
}
