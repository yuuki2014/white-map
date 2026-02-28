import { Controller } from "@hotwired/stimulus"
import Compressor from 'compressorjs'

// Connects to data-controller="avatar-compress"
export default class extends Controller {
  static targets = ["input", "preview", "defaultIcon", "removeButton", "removeCheckbox"]

  connect() {
    this.currentFile = null;
  }

  compress(event) {
    const file = event.target.files[0];
    if (!file) {
      if(this.currentFile){
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(this.currentFile);
        this.inputTarget.files = dataTransfer.files;
      }
      return;
    }

    // 画像以外の時ははじく
    if (!file.type.startsWith('image/')){
      alert('画像ファイルを選択してください')
      event.target.value = '';
      return;
    }

    // Compressor.jsで圧縮
    new Compressor(file, {
      quality: 1, // 画質 0-1
      maxWidth: 128, // 最大幅
      maxHeight: 128, // 最大高さ
      mimeType: 'image/webp',
      success: (result) => {
        // 圧縮されたresultで元のinputの中身をすり替える
        const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
        this.currentFile = new File([result], newFileName, { type: 'image/webp' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(this.currentFile);
        this.inputTarget.files = dataTransfer.files;

        // 選んだ画像を画面に表示
        const url = URL.createObjectURL(result);
        if(this.hasPreviewTarget){
          this.previewTarget.src = url;
          this.previewTarget.classList.remove('hidden');
        }

        // デフォルトアイコンを隠す
        if(this.hasDefaultIconTarget){
          this.defaultIconTarget.classList.add('hidden');
        }

        // 新しい画像が選ばれたので削除フラグをオフにする
        if(this.hasRemoveCheckboxTarget){
          this.removeCheckboxTarget.checked = false;
        }

        // 削除ボタンを表示する
        if(this.hasRemoveButtonTarget){
          this.removeButtonTarget.classList.remove('hidden');
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

    this.currentFile = null;
    this.inputTarget.value = ''; // 選択したファイルを空にする

    // 隠してあるチェックボックスをオンにする
    if (this.hasRemoveCheckboxTarget) {
      this.removeCheckboxTarget.checked = true;
    }

    // プレビュー画像を隠す
    if (this.hasPreviewTarget) {
      this.previewTarget.classList.add('hidden');
      this.previewTarget.src = '';
    }

    // デフォルトアイコンを表示
    if (this.hasDefaultIconTarget) {
      this.defaultIconTarget.classList.remove('hidden');
    }

    // 削除ボタンを隠す
    if (this.hasRemoveButtonTarget) {
      this.removeButtonTarget.classList.add('hidden');
    }
  }
}
