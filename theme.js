(() => {
  const key = "dilshan-portfolio-theme";
  const root = document.documentElement;
  const meta = document.querySelector("#themeColorMeta");
  const saved = (() => { try { return localStorage.getItem(key); } catch (_) { return null; } })();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  let theme = saved === "dark" || saved === "light" ? saved : (prefersDark ? "dark" : "light");
  function applyTheme(next, persist = true) {
    theme = next;
    root.dataset.theme = theme;
    document.body.dataset.theme = theme;
    if (meta) meta.setAttribute("content", theme === "dark" ? "#20241f" : "#f7f5f0");
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      const dark = theme === "dark";
      button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      button.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");
      const icon = button.querySelector(".theme-icon");
      const label = button.querySelector(".theme-label");
      if (icon) icon.textContent = dark ? "☀" : "☾";
      if (label) label.textContent = dark ? "Light mode" : "Dark mode";
    });
    if (persist) { try { localStorage.setItem(key, theme); } catch (_) {} }
  }
  applyTheme(theme, false);
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-theme-toggle]");
    if (button) applyTheme(theme === "dark" ? "light" : "dark");
  });
})();
