// Cookie consent — hard wall. No consent = no service.
// If you ever switch to the GDPR-compliant model, allow the UI to work when
// consent === "declined" and skip loading ad scripts instead of blocking.

(function () {
  const KEY = "nabby_consent"; // "accepted" | "declined" | null
  const overlay = document.getElementById("consent-overlay");
  const blocked = document.getElementById("consent-blocked");
  if (!overlay || !blocked) return;

  const acceptBtn = document.getElementById("consent-accept");
  const declineBtn = document.getElementById("consent-decline");
  const reopenBtn = document.getElementById("consent-reopen");
  const prefsLink = document.getElementById("consent-prefs");

  function get() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  function set(v) {
    try { localStorage.setItem(KEY, v); } catch {}
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch {}
  }

  function show(el) {
    el.classList.remove("hidden");
    document.body.classList.add("consent-locked");
  }
  function hide(el) {
    el.classList.add("hidden");
    if (overlay.classList.contains("hidden") && blocked.classList.contains("hidden")) {
      document.body.classList.remove("consent-locked");
    }
  }

  function render() {
    const state = get();
    if (state === "accepted") {
      hide(overlay);
      hide(blocked);
      loadThirdParty();
    } else if (state === "declined") {
      hide(overlay);
      show(blocked);
    } else {
      show(overlay);
      hide(blocked);
    }
  }

  const GA_ID = "G-1PXV1K2M5X";

  function loadAnalytics() {
    if (window.__nabbyAnalyticsLoaded) return;
    window.__nabbyAnalyticsLoaded = true;

    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }

  function loadAds() {
    // Hook: inject ad network script tags here once a provider is picked.
    // Example (A-Ads, Monetag, etc.):
    //   const s = document.createElement("script");
    //   s.src = "https://...";
    //   s.async = true;
    //   document.head.appendChild(s);
    window.__nabbyAdsReady = true;
  }

  function loadThirdParty() {
    loadAnalytics();
    loadAds();
  }

  acceptBtn && acceptBtn.addEventListener("click", () => {
    set("accepted");
    render();
  });
  declineBtn && declineBtn.addEventListener("click", () => {
    set("declined");
    render();
  });
  reopenBtn && reopenBtn.addEventListener("click", () => {
    clear();
    render();
  });
  prefsLink && prefsLink.addEventListener("click", (e) => {
    e.preventDefault();
    clear();
    render();
  });

  render();
})();
