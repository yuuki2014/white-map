import { Controller } from "@hotwired/stimulus"

const GRANTED = "granted"
const DENIED  = "denied"

// Connects to data-controller="cookie-consent"
export default class extends Controller {
  static targets = [
    "banner",
  ]

  connect() {
    this.checkAnalyticsConsent();
  }

  consent(){
    this.setAnalyticsConsentCookie(GRANTED);
    this.close();
    this.checkAnalyticsConsent();
  }

  denied(){
    this.setAnalyticsConsentCookie(DENIED);
    this.close();
  }

  close(){
    if (this.hasBannerTarget) {
      this.bannerTarget.classList.add("translate-y-[200px]");
      this.bannerTarget.classList.add("opacity-0");
      setTimeout(() => {
        this.bannerTarget.remove();
      }, 300)
    }
  }

  setAnalyticsConsentCookie(value){
    const maxAge = 60 * 60 * 24 * 365 * 2;

    document.cookie = `analytics_consent=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
  }

  getCookie(name){
    return document.cookie.split("; ").find(row => row.startsWith(`${name}=`))?.split("=")[1];
  }

  loadClarity(){
    if (window.clarity) return;

    const metaTag = document.querySelector(`meta[name="clarity-id"]`);

    if (!metaTag || !metaTag.content) {
      console.warn("Clarity IDのmetaタグが見つかりません");
      return;
    }

    const clarityId = metaTag.content;

    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);
        t.async=1;
        t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];
        y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", clarityId);
  }

  checkAnalyticsConsent() {
    const consent = this.getCookie("analytics_consent")
    if (consent === "granted") {
      this.loadClarity();
    }
  }
}
