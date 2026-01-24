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
      await navigator.clipboard.writeText(text);

      const messageElement = document.createElement("div");
      messageElement.textContent = "コピーしました"

      messageElement.className = `
        absolute bottom-full left-1/2 -translate-x-1/2
        mb-2
        z-50
        rounded-md
        bg-black/80 text-white
        px-3 py-1.5
        text-xs font-medium
        shadow-lg
        pointer-events-none
        transition-opacity duration-300
        opacity-0
        whitespace-nowrap

        after:content-['']
        after:absolute
        after:top-full
        after:left-1/2
        after:-translate-x-1/2
        after:border-4
        after:border-transparent
        after:border-t-black/80
      `;

      this.element.appendChild(messageElement);

      // フェードイン
      requestAnimationFrame(() => {
        messageElement.classList.remove("opacity-0");
      });

      // 表示維持
      setTimeout(() => {
        messageElement.classList.add("opacity-0");
      }, 900);

      // 削除（フェード後）
      setTimeout(() => {
        messageElement.remove();
      }, 1200);

    } catch(e) {
      console.error("コピーエラー", e)
    }
  }
}
