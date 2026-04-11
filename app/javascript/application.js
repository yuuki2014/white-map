// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./controllers"
import * as Sentry from "@sentry/browser";

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

const sentryDsn = document.querySelector(`meta[name="sentry-dsn"]`)?.content

if (location.hostname !== "localhost") {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false, // 個人情報を送らない
    tracesSampleRate: 0,
    beforeSend(event) {
      return event;
    },
  });
}
