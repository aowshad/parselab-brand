/** Shared by the inline <head> script (server) and lib/theme.ts (client). */
export const THEME_STORAGE_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs inline in <head>, before first paint: reads the stored choice and sets `data-theme`
 * (the resolved light/dark) and `data-theme-pref` (light/dark/system) on <html>, so the
 * page never flashes the wrong theme. Dependency-free; it is stringified into the page.
 */
export const THEME_SCRIPT = `(function(){var p="system";try{p=localStorage.getItem("${THEME_STORAGE_KEY}")||p}catch(e){}if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themePref=p})()`;
