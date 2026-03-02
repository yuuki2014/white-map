import { Controller } from "@hotwired/stimulus"
import Compressor from 'compressorjs'

const QUALITY    = 0.85;
const MAX_WIDTH  = 1600;
const MAX_HEIGHT = 1600;

// Connects to data-controller="images-compress"
export default class extends Controller {
  static targets = ["input", "preview", "defaultIcon"]

  connect() {
    this.currentFiles = [];
  }

  compress(event) {
    const files = Array.from(event.target.files);
    const dataTransfer = new DataTransfer();

    if (files.length === 0) {
      if(this.currentFiles.length > 0){
        this.currentFiles.forEach(file => {
          dataTransfer.items.add(file);
        })
        this.inputTarget.files = dataTransfer.files;
      }
      return;
    }

    // 画像以外の時ははじく
    for (const file of files){
      if (!file.type.startsWith('image/')){
        alert('画像ファイルを選択してください')
        event.target.value = '';
        return;
      }
    }

    // Compressor.jsで圧縮
    files.forEach(file => {
      this.compressImages(file, dataTransfer);
    })
  }

  compressImages(file, dataTransfer){
    new Compressor(file, {
      quality: QUALITY, // 画質 0-1
      maxWidth: MAX_WIDTH, // 最大幅
      maxHeight: MAX_HEIGHT, // 最大高さ
      mimeType: 'image/webp',
      success: (result) => {
        // 圧縮されたresultで元のinputの中身をすり替える
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); // ランダムなIDを生成
        const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
        const newFile = new File([result], newFileName, { type: 'image/webp' });
        newFile.uniqueId = uniqueId;
        console.log(uniqueId);

        this.currentFiles.push(newFile);
        dataTransfer.items.add(newFile);
        this.inputTarget.files = dataTransfer.files;

        // デフォルトアイコンを非表示
        if (this.hasDefaultIconTarget) {
          this.defaultIconTarget.classList.add('hidden');
        }

        // 選んだ画像を画面に表示
        if (this.hasPreviewTarget) {
          const url = URL.createObjectURL(result);

          const div = document.createElement("div");
          div.className = "shrink-0 w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center snap-center relative";

          const img = document.createElement("img");
          img.src = url;
          img.className = "w-full h-full object-cover rounded-lg";

          const button = document.createElement("button");
          button.type = "button";
          button.className = "absolute -top-0 -right-0 rounded-full text-white hover:text-gray-400 shadow border border-gray-200 p-2 z-10 w-8 h-8 flex items-center justify-center opacity-80 bg-gray-600";

          button.setAttribute("data-action", "click->images-compress#removePreview");
          button.setAttribute("data-file-id", uniqueId);

          button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          `;

          div.appendChild(img);
          div.appendChild(button);
          this.previewTarget.appendChild(div);
        }

        console.log(`圧縮成功: ${(result.size / 1024).toFixed(2)} KB`);
      },
      error(err){
        console.log("画像圧縮エラー:", err.message);
      }
    })
  }

  // 削除ボタンを押した時の処理
  removePreview(event){
    event.preventDefault();
    const button = event.currentTarget;
    const targetId = button.getAttribute("data-file-id"); // ターゲットのidを取得

    button.parentElement.remove(); // ターゲットの画像要素を削除

    // targetId以外のものだけ残す
    this.currentFiles = this.currentFiles.filter(file => file.uniqueId !== targetId);

    const dataTransfer = new DataTransfer();
    this.currentFiles.forEach(file => dataTransfer.items.add(file));
    this.inputTarget.files = dataTransfer.files

    // デフォルトアイコンを表示
    if (this.hasDefaultIconTarget && (this.currentFiles.length === 0)) {
      this.defaultIconTarget.classList.remove('hidden');
    }
  }
}
