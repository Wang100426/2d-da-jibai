document.querySelectorAll("[data-language-toggle]").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const current = document.documentElement.lang === "en" ? "en" : "zh";
    const next = current === "en" ? "zh" : "en";
    document.cookie = `lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const target = new URL(window.location.href);
    target.searchParams.delete("lang");
    window.location.assign(target.toString());
  });
});
