/* Tiny ID/EN switch shared by the DeKa pages (landing, chat, office).
 * Reads the choice from ?lang=id|en, then localStorage ("deka_lang"), and defaults to Indonesian.
 * Any element with data-lang="id" or data-lang="en" becomes a toggle button. */
(function () {
  var KEY = "deka_lang", cbs = [], lang = "id";
  try {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "id" || q === "en") { localStorage.setItem(KEY, q); lang = q; }
    else { var s = localStorage.getItem(KEY); if (s === "id" || s === "en") lang = s; }
  } catch (e) { /* storage blocked: keep the default */ }
  function paint() {
    document.documentElement.lang = lang;
    [].forEach.call(document.querySelectorAll("[data-lang]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false"); });
  }
  function change(l) { lang = l; paint(); cbs.forEach(function (f) { f(l); }); }
  window.DekaLang = {
    get: function () { return lang; },
    set: function (l) { if ((l === "id" || l === "en") && l !== lang) { try { localStorage.setItem(KEY, l); } catch (e) {} change(l); } },
    on: function (f) { cbs.push(f); paint(); f(lang); }
  };
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-lang]"); if (b) window.DekaLang.set(b.getAttribute("data-lang")); });
  addEventListener("storage", function (e) { if (e.key === KEY && (e.newValue === "id" || e.newValue === "en") && e.newValue !== lang) change(e.newValue); });
  document.addEventListener("DOMContentLoaded", paint);
})();
