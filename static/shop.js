"use strict";
// 英雄商店的交互：点「购买」调 /api/shop/buy，然后就地刷新金币与卡片。
// 页面本身由 Flask 服务端渲染（store 卡片、金币余额都在 HTML 里），
// 这里只做增量更新，所以脚本挂了页面依然能看懂。
const shopState = window.SHOP_STATE || {
    coins: 0,
    infinite_coins: false,
    unlocked_heroes: [],
};
const shopStrings = window.SHOP_STRINGS || {
    buy: "BUY",
    owned: "OWNED",
    locked: "LOCKED",
    select: "SELECT",
    not_enough: "Not enough coins",
    purchased: "Purchased",
    failed: "Purchase failed",
};
const coinLabels = [...document.querySelectorAll("[data-coin-balance]")];
const shopCards = [...document.querySelectorAll("[data-shop-card]")];
const shopToast = document.getElementById("shop-toast");
function formatCoins(value) {
    return shopState.infinite_coins ? "∞" : value.toLocaleString("en-US");
}
function applyState(payload) {
    if (typeof payload.coins === "number")
        shopState.coins = payload.coins;
    if (typeof payload.infinite_coins === "boolean")
        shopState.infinite_coins = payload.infinite_coins;
    if (Array.isArray(payload.unlocked_heroes))
        shopState.unlocked_heroes = payload.unlocked_heroes;
    coinLabels.forEach((label) => {
        const next = formatCoins(shopState.coins);
        if (label.textContent !== next)
            label.textContent = next;
    });
    document.body.classList.toggle("infinite-coins", shopState.infinite_coins);
}
function isUnlocked(heroId) {
    return shopState.unlocked_heroes.includes(heroId);
}
function showShopToast(message, kind) {
    if (!shopToast)
        return;
    shopToast.textContent = message;
    shopToast.classList.toggle("warning", kind === "warning");
    shopToast.classList.add("visible");
    window.clearTimeout(shopToastTimer);
    shopToastTimer = window.setTimeout(() => shopToast.classList.remove("visible"), 2400);
}
let shopToastTimer = 0;
/** 已解锁的卡片换成「已解锁 + 去选人」，未解锁的按余额决定能不能点。 */
function refreshCards() {
    shopCards.forEach((card) => {
        const heroId = card.dataset.shopCard || "";
        const price = Number(card.dataset.price || "0");
        const owned = isUnlocked(heroId) || price <= 0;
        card.classList.toggle("locked", !owned);
        card.classList.toggle("owned", owned);
        card.querySelectorAll("[data-owned-only]").forEach((node) => {
            node.hidden = !owned;
        });
        card.querySelectorAll("[data-locked-only]").forEach((node) => {
            node.hidden = owned;
        });
        const button = card.querySelector("[data-buy]");
        if (!button)
            return;
        button.disabled = !shopState.infinite_coins && shopState.coins < price;
        button.textContent = `${shopStrings.buy} · ◈ ${price}`;
        button.title = button.disabled ? shopStrings.not_enough : shopStrings.buy;
    });
}
async function buyHero(heroId, button) {
    button.disabled = true;
    try {
        const response = await fetch("/api/shop/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hero_id: heroId }),
        });
        const payload = (await response.json());
        applyState(payload);
        if (payload.ok) {
            const card = shopCards.find((item) => item.dataset.shopCard === heroId);
            const name = card?.querySelector("h2")?.textContent || heroId;
            showShopToast(`${shopStrings.purchased} · ${name}`, "success");
        }
        else {
            showShopToast(payload.message || shopStrings.not_enough, "warning");
        }
    }
    catch {
        showShopToast(shopStrings.failed, "warning");
    }
    finally {
        refreshCards();
    }
}
shopCards.forEach((card) => {
    const button = card.querySelector("[data-buy]");
    if (!button)
        return;
    button.addEventListener("click", () => {
        const heroId = card.dataset.shopCard || "";
        if (!heroId)
            return;
        void buyHero(heroId, button);
    });
});
applyState({});
refreshCards();
