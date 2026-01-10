import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="copy"
export default class extends Controller {
  static values = { text: String,
                  }

  connect() {
  }

  selectAll(){
    const range = document.createRange()
    range.selectNodeContents(this.element)
    const select = window.getSelection();
    select.removeAllRanges()
    select.addRange(range);
  }

  async copy(){
    const text = this.textValue;

    try {
      await navigator.clipboard.writeText(text)
    } catch(e) {
      console.error("コピーエラー", e)
    }
  }
}
