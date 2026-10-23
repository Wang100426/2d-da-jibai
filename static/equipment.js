"use strict";
const state = window.EQUIPMENT_STATE;
const strings = window.EQUIPMENT_STRINGS;
let inventory = [];
let loadout = {};
const drawButton = document.querySelector("#equipment-draw");
const resultPanel = document.querySelector("#equipment-result");
const resultCard = document.querySelector("#equipment-result-card");
const slotsContainer = document.querySelector("#equipment-slots");
const toast = document.querySelector("#equipment-toast");
const coinBalances = document.querySelectorAll("[data-coin-balance]");
function formatCoins(coins) {
    return state.infinite_coins ? "∞" : coins.toLocaleString();
}
function updateCoinDisplays(coins) {
    coinBalances.forEach((el) => el.textContent = formatCoins(coins));
}
function showToast(message, type = "success") {
    if (!toast)
        return;
    toast.textContent = message;
    toast.className = `equipment-toast ${type} is-visible`;
    setTimeout(() => toast.classList.remove("is-visible"), 2200);
}
function itemCard(item, actions) {
    const card = document.createElement("div");
    card.className = `equipment-item equipment-quality-${item.quality}`;
    card.style.borderColor = state.quality_colors[item.quality] || "#888";
    card.innerHTML = `
    <span class="equipment-item-quality" style="color:${state.quality_colors[item.quality] || "#888"}">${state.quality_labels[item.quality]}</span>
    <b class="equipment-item-slot">${state.slot_labels[item.slot]}</b>
    <span class="equipment-item-stat">${item.label} +${item.value}</span>
  `;
    if (actions)
        card.appendChild(actions);
    return card;
}
function actionButton(label, onClick, variant = "primary") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `equipment-action equipment-action-${variant}`;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
}
async function refreshState() {
    const res = await fetch("/api/equipment/state");
    const data = await res.json();
    if (data.ok) {
        inventory = data.inventory;
        loadout = data.loadout;
        updateCoinDisplays(data.coins);
        renderLoadout();
    }
}
async function drawEquipment() {
    drawButton?.setAttribute("disabled", "true");
    try {
        const res = await fetch("/api/equipment/draw", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
            updateCoinDisplays(data.coins);
            showToast(strings.draw_success
                .replace("{quality}", state.quality_labels[data.item.quality])
                .replace("{slot}", state.slot_labels[data.item.slot])
                .replace("{value}", String(data.item.value))
                .replace("{stat}", data.item.label));
            if (resultPanel && resultCard) {
                resultPanel.hidden = false;
                resultCard.innerHTML = "";
                const actions = document.createElement("div");
                actions.className = "equipment-result-actions";
                actions.appendChild(actionButton(strings.equip, async () => {
                    await fetch("/api/equipment/equip", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ equip_id: data.item.id }),
                    });
                    await refreshState();
                }));
                resultCard.appendChild(itemCard(data.item, actions));
            }
            await refreshState();
        }
        else {
            showToast(data.reason === "poor" ? strings.not_enough : strings.failed, "error");
        }
    }
    catch {
        showToast(strings.failed, "error");
    }
    finally {
        drawButton?.removeAttribute("disabled");
    }
}
function renderLoadout() {
    if (!slotsContainer)
        return;
    slotsContainer.innerHTML = "";
    state.slots.forEach((slot) => {
        const equippedId = loadout[slot];
        const equipped = inventory.find((item) => item.id === equippedId);
        const wrapper = document.createElement("div");
        wrapper.className = "equipment-slot-wrapper";
        const title = document.createElement("h3");
        title.textContent = state.slot_labels[slot];
        wrapper.appendChild(title);
        if (equipped) {
            const actions = document.createElement("div");
            actions.className = "equipment-slot-actions";
            actions.appendChild(actionButton(strings.unequip, async () => {
                await fetch("/api/equipment/unequip", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slot }),
                });
                await refreshState();
            }, "ghost"));
            wrapper.appendChild(itemCard(equipped, actions));
        }
        else {
            const empty = document.createElement("div");
            empty.className = "equipment-empty";
            empty.textContent = strings.empty_slot;
            wrapper.appendChild(empty);
        }
        slotsContainer.appendChild(wrapper);
    });
}
drawButton?.addEventListener("click", drawEquipment);
refreshState();
