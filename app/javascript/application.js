// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./controllers"

if (!window.hasMacScrollbarEnhancer) {
  window.hasMacScrollbarEnhancer = true;

  // スクロール検知して、動かしている時だけ表示
  document.addEventListener('scroll', (event) => {
    const target = event.target;
    if (target instanceof Element && (target.classList.contains('overflow-y-auto') || target.classList.contains('overflow-x-auto'))) {
      target.classList.add('is-scrolling');
      if (target.scrollTimeout) clearTimeout(target.scrollTimeout);
      target.scrollTimeout = setTimeout(() => {
        target.classList.remove('is-scrolling');
      }, 800);
    }
  }, true);
}
