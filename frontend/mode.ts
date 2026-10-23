interface ModePalette {
  main: string;
  light: string;
  dark: string;
}

interface ModeOption {
  id: string;
  name: string;
  kicker: string;
  tagline: string;
  description: string;
  icon: string;
  accent: string;
  palette: ModePalette;
}

function requireModeElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing mode selection element: ${id}`);
  return element as T;
}

const modes: ModeOption[] = (window as Window & Partial<{ MODE_SELECTION: ModeOption[] }>).MODE_SELECTION || [];
if (!modes.length) throw new Error("Mode selection data was not provided by the Flask page.");

const choices = [...document.querySelectorAll<HTMLButtonElement>("[data-mode-id]")];
const portrait = requireModeElement<HTMLDivElement>("mode-detail-portrait");
const initial = requireModeElement<HTMLElement>("mode-detail-initial");
const kicker = requireModeElement<HTMLElement>("mode-detail-kicker");
const modeName = requireModeElement<HTMLElement>("mode-detail-name");
const tagline = requireModeElement<HTMLElement>("mode-detail-tagline");
const description = requireModeElement<HTMLElement>("mode-detail-description");
const features = requireModeElement<HTMLDivElement>("mode-detail-features");
const indexLabel = requireModeElement<HTMLElement>("mode-detail-index");
const selectedName = requireModeElement<HTMLElement>("mode-selected-name");
const confirmButton = requireModeElement<HTMLButtonElement>("mode-confirm");

const STORAGE_KEY = "selectedMode";

function applyPalette(element: HTMLElement, palette: ModePalette): void {
  element.style.setProperty("--hero-main", palette.main);
  element.style.setProperty("--hero-light", palette.light);
  element.style.setProperty("--hero-dark", palette.dark);
}

function renderFeatures(taglineText: string): void {
  features.replaceChildren();
  taglineText.split(" · ").forEach((point) => {
    const chip = document.createElement("span");
    chip.textContent = point.trim();
    features.append(chip);
  });
}

function selectMode(modeId: string): void {
  const index = modes.findIndex((mode) => mode.id === modeId);
  const mode = modes[index];
  if (!mode) return;
  choices.forEach((choice) => {
    const selected = choice.dataset.modeId === mode.id;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
  portrait.className = `detail-portrait ${mode.accent}`;
  applyPalette(portrait, mode.palette);
  initial.textContent = mode.icon;
  kicker.textContent = mode.kicker;
  modeName.textContent = mode.name;
  tagline.textContent = mode.tagline;
  description.textContent = mode.description;
  indexLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(modes.length).padStart(2, "0")}`;
  selectedName.textContent = mode.name;
  renderFeatures(mode.tagline);
}

choices.forEach((choice) => {
  choice.addEventListener("click", () => selectMode(choice.dataset.modeId || ""));
});

confirmButton.addEventListener("click", () => {
  const selected = choices.find((choice) => choice.classList.contains("selected"));
  const modeId = selected?.dataset.modeId || modes[0].id;
  localStorage.setItem(STORAGE_KEY, modeId);
  window.location.href = "/";
});

selectMode(choices.find((choice) => choice.classList.contains("selected"))?.dataset.modeId || modes[0].id);
