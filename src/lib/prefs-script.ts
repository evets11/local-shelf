// No "use client": the layout (a server component) needs the script string itself.

export const PREFS_KEY = "shelflife:prefs";
/** Set once the first-visit welcome is dismissed. */
export const WELCOMED_KEY = "shelflife:welcomed";

/** Display prefs mirrored onto <html data-*> so CSS can react. */
export const DISPLAY_KEYS = ["theme", "profile", "cover", "textSize", "contrast", "motion", "font"] as const;

/**
 * Sets <meta name=theme-color> (browser/status bar colour) to the page background for the
 * theme. Self-contained so the inline script can embed it via toString(); keep it that way.
 */
export function setThemeColor(theme?: string, contrast?: string) {
  const color =
    theme === "light"
      ? contrast === "high"
        ? "#ffffff"
        : "#f7f2e8"
      : contrast === "high"
        ? "#000000"
        : "#0e1014";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

/**
 * Runs inline in <head> before first paint so text size, contrast etc. never flash.
 * Also flags installed (standalone) launches, which skip the first-visit welcome.
 * Must stay dependency-free and tolerant of bad storage.
 */
export const PREFS_SCRIPT = `(function(){var d=document.documentElement;try{if(matchMedia("(display-mode: standalone)").matches||navigator.standalone)d.dataset.standalone="1"}catch(e){}try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");${DISPLAY_KEYS.map(
  (k) => `if(typeof p.${k}==="string")d.dataset.${k}=p.${k};`,
).join("")}if(p.profile==="kids"||p.branch||p.onShelfOnly||(p.audioFormat&&p.audioFormat!=="all"))d.dataset.prefFiltering="1";if(localStorage.getItem(${JSON.stringify(WELCOMED_KEY)}))d.dataset.welcomed="1";(${setThemeColor.toString()})(p.theme,p.contrast)}catch(e){}})()`;
