import { Controller } from "@hotwired/stimulus"
import Compressor from 'compressorjs'

const QUALITY    = 0.8;
const MAX_WIDTH  = 128;
const MAX_HEIGHT = 128;

// Connects to data-controller="avatar-compress"
export default class extends Controller {
  static targets = ["input", "preview", "defaultIcon", "removeButton", "removeCheckbox"]

  connect() {
    this.currentFile = null;
    this.isWebpSupported = this.checkWebpSupport(); // ブラウザがWebPエンコードに対応しているかチェック
  }

  // WebP書き出しに対応しているか判定
  checkWebpSupport() {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      // 実際にWebPを指定してデータURLを生成し、WebPとして生成されたか確認
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
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

    const targetMimeType = this.isWebpSupported ? 'image/webp' : 'image/jpeg';
    const targetExtension = this.isWebpSupported ? '.webp' : '.jpeg';

    // Compressor.jsで圧縮
    new Compressor(file, {
      quality: QUALITY, // 画質 0-1
      maxWidth: MAX_WIDTH, // 最大幅
      maxHeight: MAX_HEIGHT, // 最大高さ
      mimeType: targetMimeType,
      success: (result) => {
        // 圧縮されたresultで元のinputの中身をすり替える
        const newFileName = file.name.replace(/\.[^/.]+$/, "") + targetExtension;
        this.currentFile = new File([result], newFileName, { type: targetMimeType });
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
        console.log(`圧縮成功(${targetMimeType}): ${(result.size / 1024).toFixed(2)} KB`);
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
