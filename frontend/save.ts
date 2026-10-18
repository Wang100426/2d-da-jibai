// 主页右上角的「存档管理」面板：总览 / 导出 / 导入 / 重置。
// 面板内容由 Flask 服务端渲染（金币、英雄解锁状态都在 HTML 里），
// 这里只负责打开关闭、调用存档接口，并把结果同步回页面。

interface SaveState {
  coins: number;
  infinite_coins: boolean;
  unlocked_heroes: string[];
  settled_count: number;
  save_path: string;
}

interface SaveStrings {
  owned: string;
  locked: string;
  exported: string;
  imported: string;
  import_failed: string;
  reset_done: string;
  reset_confirm: string;
  failed: string;
  infinite_note: string;
}

interface SaveResponse extends Partial<SaveState> {
  ok?: boolean;
  message?: string;
  reason?: string;
}

const saveState: SaveState = (window as Window & Partial<{ SAVE_STATE: SaveState }>).SAVE_STATE || {
  coins: 0,
  infinite_coins: false,
  unlocked_heroes: [],
  settled_count: 0,
  save_path: "",
};
const saveStrings: SaveStrings = (window as Window & Partial<{ SAVE_STRINGS: SaveStrings }>).SAVE_STRINGS || {
  owned: "OWNED",
  locked: "LOCKED",
  exported: "Save exported.",
  imported: "Save imported.",
  import_failed: "Import failed: not a valid save file.",
  reset_done: "Save reset.",
  reset_confirm: "Click again to confirm",
  failed: "Something went wrong, please try again.",
  infinite_note: "Unlimited-coin test save",
};

const saveOverlay = document.getElementById("save-overlay");
const saveOpenButton = document.getElementById("save-open");
const saveCloseButton = document.getElementById("save-close");
const saveExportButton = document.getElementById("save-export");
const saveImportButton = document.getElementById("save-import");
const saveImportFile = document.getElementById("save-import-file") as HTMLInputElement | null;
const saveResetButton = document.getElementById("save-reset");
const saveResetLabel = saveResetButton?.querySelector<HTMLElement>("b") || null;
const saveToast = document.getElementById("save-toast");
const saveOwnedCount = document.getElementById("save-owned-count");
const saveSettledCount = document.getElementById("save-settled");
const saveCoinsNote = document.getElementById("save-coins-note");

const coinLabels = [...document.querySelectorAll<HTMLElement>("[data-coin-balance]")];
const heroChips = [...document.querySelectorAll<HTMLElement>("[data-save-hero]")];

let toastTimer = 0;
let resetTimer = 0;
const resetLabel = saveResetLabel?.textContent || "";

function formatCoins(value: number): string {
  return saveState.infinite_coins ? "∞" : value.toLocaleString("en-US");
}

function showToast(message: string, kind: "success" | "warning"): void {
  if (!saveToast) return;
  saveToast.textContent = message;
  saveToast.classList.toggle("warning", kind === "warning");
  saveToast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => saveToast.classList.remove("visible"), 2400);
}

/** 把接口返回的存档状态渲染到面板与主页金币胶囊上。 */
function render(): void {
  const balance = formatCoins(saveState.coins);
  coinLabels.forEach((label) => {
    if (label.textContent !== balance) label.textContent = balance;
  });
  if (saveCoinsNote) saveCoinsNote.hidden = !saveState.infinite_coins;
  if (saveOwnedCount) saveOwnedCount.textContent = String(countOwned());
  if (saveSettledCount) saveSettledCount.textContent = String(saveState.settled_count);
  heroChips.forEach((chip) => {
    const heroId = chip.dataset.saveHero || "";
    const price = Number(chip.dataset.price || "0");
    const owned = saveState.unlocked_heroes.includes(heroId) || price <= 0;
    chip.classList.toggle("locked", !owned);
    const tag = chip.querySelector<HTMLElement>("em");
    if (tag) tag.textContent = owned ? saveStrings.owned : saveStrings.locked;
  });
}

function countOwned(): number {
  return heroChips.filter((chip) => {
    const heroId = chip.dataset.saveHero || "";
    const price = Number(chip.dataset.price || "0");
    return saveState.unlocked_heroes.includes(heroId) || price <= 0;
  }).length;
}

function applyState(payload: SaveResponse): void {
  if (typeof payload.coins === "number") saveState.coins = payload.coins;
  if (typeof payload.infinite_coins === "boolean") saveState.infinite_coins = payload.infinite_coins;
  if (Array.isArray(payload.unlocked_heroes)) saveState.unlocked_heroes = payload.unlocked_heroes;
  if (typeof payload.settled_count === "number") saveState.settled_count = payload.settled_count;
  if (typeof payload.save_path === "string") saveState.save_path = payload.save_path;
  render();
}

function openPanel(): void {
  if (!saveOverlay) return;
  saveOverlay.hidden = false;
  saveOverlay.setAttribute("aria-hidden", "false");
  saveCloseButton?.focus();
}

function closePanel(): void {
  if (!saveOverlay) return;
  saveOverlay.hidden = true;
  saveOverlay.setAttribute("aria-hidden", "true");
  cancelResetConfirm();
}

function cancelResetConfirm(): void {
  window.clearTimeout(resetTimer);
  saveResetButton?.classList.remove("confirm");
  if (saveResetLabel && resetLabel) saveResetLabel.textContent = resetLabel;
}

async function callSaveApi(path: string, init?: RequestInit): Promise<SaveResponse | null> {
  try {
    const response = await fetch(path, init);
    const payload = (await response.json()) as SaveResponse;
    if (payload && typeof payload === "object") applyState(payload);
    return payload;
  } catch {
    showToast(saveStrings.failed, "warning");
    return null;
  }
}

/** 导出：直接下载服务端返回的存档文件。 */
function exportSave(): void {
  const link = document.createElement("a");
  link.href = "/api/save/export";
  link.download = "2d-da-jibai-save.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast(saveStrings.exported, "success");
}

/** 导入：把选中的 JSON 交给服务端校验并覆盖存档。 */
async function importSave(file: File): Promise<void> {
  const text = await file.text();
  const payload = await callSaveApi("/api/save/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text,
  });
  if (!payload) return;
  if (payload.ok) showToast(saveStrings.imported, "success");
  else showToast(payload.message || saveStrings.import_failed, "warning");
}

/** 重置：第一次点击只是进入确认状态，再点一次才真的清档。 */
async function resetSave(): Promise<void> {
  if (!saveResetButton?.classList.contains("confirm")) {
    saveResetButton?.classList.add("confirm");
    if (saveResetLabel) saveResetLabel.textContent = saveStrings.reset_confirm;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(cancelResetConfirm, 5000);
    return;
  }
  cancelResetConfirm();
  const payload = await callSaveApi("/api/save/reset", { method: "POST" });
  if (payload?.ok) showToast(saveStrings.reset_done, "success");
}

saveOpenButton?.addEventListener("click", openPanel);
saveCloseButton?.addEventListener("click", closePanel);
saveOverlay?.addEventListener("click", (event) => {
  if (event.target === saveOverlay) closePanel();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && saveOverlay && !saveOverlay.hidden) closePanel();
});
saveExportButton?.addEventListener("click", exportSave);
saveImportButton?.addEventListener("click", () => saveImportFile?.click());
saveImportFile?.addEventListener("change", () => {
  const file = saveImportFile.files?.[0];
  saveImportFile.value = "";
  if (file) void importSave(file);
});
saveResetButton?.addEventListener("click", () => {
  void resetSave();
});

render();
