const LANGUAGE_OPTIONS = [
  { code: "zh", label: "中文", sub: "简体中文" },
  { code: "en", label: "English", sub: "English" },
  { code: "ja", label: "日本語", sub: "日本語" },
];

function currentLanguage() {
  const declared = (document.documentElement.lang || "zh").toLowerCase();
  if (declared.startsWith("en")) return "en";
  if (declared.startsWith("ja")) return "ja";
  return "zh";
}

function switchLanguage(code) {
  document.cookie = `lang=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
  const target = new URL(window.location.href);
  target.searchParams.delete("lang");
  window.location.assign(target.toString());
}

document.querySelectorAll("[data-language-switch]").forEach((root) => {
  const active = currentLanguage();
  const activeOption = LANGUAGE_OPTIONS.find((option) => option.code === active) || LANGUAGE_OPTIONS[0];

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "language-switch-current";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", activeOption.label);

  const mark = document.createElement("span");
  mark.className = "language-switch-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "文";
  const label = document.createElement("span");
  label.className = "language-switch-label";
  label.textContent = activeOption.label;
  const arrow = document.createElement("span");
  arrow.className = "language-switch-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "⌄";
  trigger.append(mark, label, arrow);

  const list = document.createElement("div");
  list.className = "language-switch-options";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  LANGUAGE_OPTIONS.forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(option.code === active));
    item.dataset.langCode = option.code;
    const name = document.createElement("b");
    name.textContent = option.label;
    const sub = document.createElement("small");
    sub.textContent = option.sub;
    item.append(name, sub);
    item.addEventListener("click", () => {
      if (option.code === active) {
        closeMenu();
        return;
      }
      switchLanguage(option.code);
    });
    list.append(item);
  });

  function closeMenu() {
    trigger.setAttribute("aria-expanded", "false");
    list.hidden = true;
  }

  function openMenu() {
    trigger.setAttribute("aria-expanded", "true");
    list.hidden = false;
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (list.hidden) openMenu();
    else closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !list.hidden) {
      closeMenu();
      trigger.focus();
    }
  });

  root.append(trigger, list);
});
