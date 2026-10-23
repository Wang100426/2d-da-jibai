interface EquipmentItem {
  id: string;
  slot: string;
  quality: string;
  stat: string;
  value: number;
  label: string;
}

interface BackpackState {
  slots: string[];
  qualities: string[];
  quality_colors: Record<string, string>;
  slot_labels: Record<string, string>;
  quality_labels: Record<string, string>;
}

interface BackpackStrings {
  equip: string;
  unequip: string;
  delete: string;
  empty: string;
  all: string;
}

const state = (window as unknown as { BACKPACK_STATE: BackpackState }).BACKPACK_STATE;
const strings = (window as unknown as { BACKPACK_STRINGS: BackpackStrings }).BACKPACK_STRINGS;
let inventory: EquipmentItem[] = [];
let loadout: Record<string, string | null> = {};
let filterSlot: string | "all" = "all";

const filtersContainer = document.querySelector<HTMLDivElement>("#backpack-filters");
const listContainer = document.querySelector<HTMLDivElement>("#backpack-list");
const toast = document.querySelector<HTMLDivElement>("#backpack-toast");

function showToast(message: string, type: "success" | "warning" | "error" = "success"): void {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `backpack-toast ${type} is-visible`;
  setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function itemCard(item: EquipmentItem, equipped: boolean): HTMLElement {
  const card = document.createElement("div");
  card.className = `backpack-item backpack-quality-${item.quality}`;
  card.style.borderColor = state.quality_colors[item.quality] || "#888";
  card.innerHTML = `
    <span class="backpack-item-quality" style="color:${state.quality_colors[item.quality] || "#888"}">${state.quality_labels[item.quality]}</span>
    <b class="backpack-item-slot">${state.slot_labels[item.slot]}</b>
    <span class="backpack-item-stat">${item.label} +${item.value}</span>
  `;
  const actions = document.createElement("div");
  actions.className = "backpack-item-actions";
  if (equipped) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "backpack-action backpack-action-ghost";
    btn.textContent = strings.unequip;
    btn.addEventListener("click", async () => {
      await fetch("/api/equipment/unequip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: item.slot }),
      });
      await refreshState();
    });
    actions.appendChild(btn);
  } else {
    const equipBtn = document.createElement("button");
    equipBtn.type = "button";
    equipBtn.className = "backpack-action backpack-action-primary";
    equipBtn.textContent = strings.equip;
    equipBtn.addEventListener("click", async () => {
      await fetch("/api/equipment/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equip_id: item.id }),
      });
      await refreshState();
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "backpack-action backpack-action-danger";
    deleteBtn.textContent = strings.delete;
    deleteBtn.addEventListener("click", async () => {
      await fetch("/api/equipment/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equip_id: item.id }),
      });
      await refreshState();
    });
    actions.appendChild(equipBtn);
    actions.appendChild(deleteBtn);
  }
  card.appendChild(actions);
  return card;
}

async function refreshState(): Promise<void> {
  const res = await fetch("/api/equipment/state");
  const data = await res.json();
  if (data.ok) {
    inventory = data.inventory;
    loadout = data.loadout;
    renderFilters();
    renderList();
  }
}

function renderFilters(): void {
  if (!filtersContainer) return;
  filtersContainer.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `backpack-filter${filterSlot === "all" ? " active" : ""}`;
  allBtn.textContent = strings.all;
  allBtn.addEventListener("click", () => { filterSlot = "all"; renderFilters(); renderList(); });
  filtersContainer.appendChild(allBtn);
  state.slots.forEach((slot) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `backpack-filter${filterSlot === slot ? " active" : ""}`;
    btn.textContent = state.slot_labels[slot];
    btn.addEventListener("click", () => { filterSlot = slot; renderFilters(); renderList(); });
    filtersContainer.appendChild(btn);
  });
}

function renderList(): void {
  if (!listContainer) return;
  listContainer.innerHTML = "";
  const items = filterSlot === "all" ? inventory : inventory.filter((item) => item.slot === filterSlot);
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "backpack-empty";
    empty.textContent = strings.empty;
    listContainer.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const equipped = loadout[item.slot] === item.id;
    listContainer.appendChild(itemCard(item, equipped));
  });
}

refreshState();
