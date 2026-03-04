import { Controller } from "@hotwired/stimulus"
// import Swiper bundle with all modules installed
import Swiper from 'swiper/bundle';
import 'swiper/css/bundle';

// Connects to data-controller="image-viewer"
export default class extends Controller {
  connect() {
    if (this.element.swiper) {
      this.element.swiper.destroy(true, true)
    }

    // 画面サイズによって、倍率を変更
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const zoomMaxRatio = isMobile ? 20 : 3;

    const paginationEl = this.element.querySelector('.swiper-pagination')
    const nextEl = this.element.querySelector('.custom-button-next')
    const prevEl = this.element.querySelector('.custom-button-prev')

    this.swiper = new Swiper(this.element, {
      observer: true,
      observeParents: true,
      direction: 'horizontal',
      loop: false,

      zoom: {
        maxRatio: zoomMaxRatio,
      },

      pagination: {
        el: paginationEl,
        type: "fraction",
      },

      navigation: {
        nextEl: nextEl,
        prevEl: prevEl,
      },
    });
  }

  disconnect() {
    this.swiper?.destroy(true, true)
    this.swiper = null
  }
}
