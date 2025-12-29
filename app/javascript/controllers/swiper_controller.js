import { Controller } from "@hotwired/stimulus"
// import Swiper bundle with all modules installed
import Swiper from 'swiper/bundle';
// import styles bundle
import 'swiper/css/bundle';

// Connects to data-controller="swiper"
export default class extends Controller {
  connect() {
    this.swiper = new Swiper(this.element, {
      observer: true,
      observeParents: true,
      // Optional parameters
      direction: 'horizontal',
      loop: false,

      // If we need pagination
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },

      // Navigation arrows
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },

    });

    this.update()

    this.swiper.on("slideChange", () => this.update())
  }

  update() {
    const index = this.swiper.realIndex ?? this.swiper.activeIndex

    console.log(index)

    const choiceEls = document.querySelectorAll("[data-show-on")

    choiceEls.forEach((el) => {
      const rule = el.dataset.showOn
      const visible =
        rule === "all" ||
        rule.split(",").map(n => Number(n)).includes(index)

      console.log(el)

      el.classList.toggle("hidden", !visible)
    })
  }

  disconnect() {
    if (this.swiper) {
      this.swiper.destroy();
    }
  }
}
