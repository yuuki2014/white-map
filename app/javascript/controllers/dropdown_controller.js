import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="dropdown"
export default class extends Controller {
  static values = { postUrl: String }
  connect() {
  }

  toggle(event){
    // すでにメニューがある場合は削除
    const existingMenu = event.currentTarget.parentNode.querySelector('.my-dropdown-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const url = this.postUrlValue;
    const div = document.createElement("div");
    div.className = "my-dropdown-menu absolute top-full right-0 mt-2 w-20 bg-white shadow-lg rounded-md border border-gray-400 z-50 flex flex-col text-black";
    div.innerHTML = `
      <a href="" class="px-2 py-1 hover:bg-gray-100 rounded">編集</a>
      <a href="${url}" data-turbo-stream="true" class="px-2 py-1 hover:bg-gray-100 rounded text-red-500">削除</a>
    `;

    event.currentTarget.appendChild(div);
  }
}
