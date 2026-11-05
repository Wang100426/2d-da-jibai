"use strict";
const locale = MP_LOCALE;
const translateByPattern = locale.code !== "zh";
const tx = (source) => localizeLobbyText(source);
/** 长键优先：tojson 会按键名排序，短键先跑会拆散长句导致漏译。 */
const lobbyMessageEntries = Object.entries(locale.lobby.messages)
    .sort((a, b) => b[0].length - a[0].length);
function localizeLobbyText(message) {
    let text = message;
    if (translateByPattern) {
        for (const [pattern, replacement] of locale.lobby.patterns) {
            text = text.replace(new RegExp(pattern), replacement);
        }
    }
    for (const [source, translation] of lobbyMessageEntries) {
        text = text.replaceAll(source, translation);
    }
    return text;
}
function getElement(id) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement))
        throw new Error(`Missing lobby element: ${id}`);
    return element;
}
const nameInput = getElement("player-name");
const heroSelect = getElement("hero-select");
const codeInput = getElement("room-code");
const joinRow = getElement("join-row");
const entryPanel = getElement("mp-entry");
const waitingRoom = getElement("waiting-room");
const waitingPlayers = getElement("waiting-players");
const waitingMessage = getElement("waiting-message");
const prepBanner = getElement("mp-prep");
const prepCountdown = getElement("prep-countdown");
const readyButton = getElement("ready-toggle");
const startButton = getElement("start-game");
const toast = getElement("mp-toast");
const lanAddresses = getElement("lan-addresses");
const modeButtons = [...document.querySelectorAll("[data-lobby-mode]")];
const storageKey = "2d-da-jibai-lobby";
let playerId = "";
let currentRoomId = "";
let selectedMode = MP_INITIAL_MODE === "duel" ? "duel" : "rogue";
let isHost = false;
let myReady = false;
let roomPollTimer = 0;
let toastTimer = 0;
let jumping = false;
/** 上一帧看到的英雄，避免轮询把玩家的选择覆盖掉。 */
let heroDirty = false;
try {
    nameInput.value = localStorage.getItem("2d-da-jibai-name") || "";
    const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (stored?.playerId && stored.roomId) {
        playerId = stored.playerId;
        currentRoomId = stored.roomId;
    }
}
catch (error) {
    console.warn("Could not restore local multiplayer session.", error);
}
function showToast(message, warning = false) {
    toast.textContent = localizeLobbyText(message);
    toast.classList.toggle("warning", warning);
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2500);
}
async function api(path, body) {
    const response = await fetch(`/api/mp/rooms${path}`, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
        const message = result.error === "房间模式不匹配，请选择相同的联机模式。"
            ? MP_STRINGS.mismatch
            : result.error || tx(`请求失败 (${response.status})`);
        throw new Error(message);
    }
    return result;
}
async function showLanAddresses() {
    try {
        const response = await fetch("/api/server-info");
        const result = await response.json();
        if (!response.ok || !result.ok)
            throw new Error(tx("无法获取局域网地址。"));
        lanAddresses.textContent = result.lan_urls.length
            ? result.lan_urls.join(" · ")
            : tx("未检测到局域网地址，请确认设备已连接网络。");
    }
    catch (error) {
        lanAddresses.textContent = localizeLobbyText(error instanceof Error ? error.message : tx("局域网地址获取失败。"));
    }
}
function currentName() {
    const name = nameInput.value.trim();
    if (!name)
        throw new Error(tx("请先输入昵称。"));
    localStorage.setItem("2d-da-jibai-name", name);
    return name;
}
function saveMembership() {
    localStorage.setItem(storageKey, JSON.stringify({ playerId, roomId: currentRoomId }));
}
function stopPolling() {
    window.clearInterval(roomPollTimer);
    roomPollTimer = 0;
}
function clearMembership() {
    playerId = "";
    currentRoomId = "";
    isHost = false;
    myReady = false;
    localStorage.removeItem(storageKey);
    stopPolling();
    waitingRoom.hidden = true;
    entryPanel.hidden = false;
    joinRow.hidden = true;
    getElement("join-toggle").setAttribute("aria-expanded", "false");
}
function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
}
function renderPlayers(room) {
    waitingPlayers.innerHTML = room.players.map((player, index) => {
        const hero = MP_HEROES.find((item) => item.id === player.hero_id);
        const palette = hero?.palette;
        const paletteStyle = palette
            ? ` style="--hero-main:${escapeHtml(palette.main)};--hero-light:${escapeHtml(palette.light)};--hero-dark:${escapeHtml(palette.dark)}"`
            : "";
        const isSelf = player.player_id === playerId;
        const isRoomHost = player.player_id === room.host_id;
        const state = room.status === "waiting"
            ? ""
            : player.ready
                ? `<em class="player-state ready">${escapeHtml(tx("已准备"))}</em>`
                : `<em class="player-state">${escapeHtml(tx("未准备"))}</em>`;
        return `<div class="waiting-player${player.ready ? " is-ready" : ""}">
      <span class="lobby-avatar ${escapeHtml(hero?.accent || player.accent)}"${paletteStyle}>${escapeHtml(hero?.initial || player.initial)}</span>
      <span><b>${escapeHtml(player.name)}${isSelf ? locale.lobby.you : ""}</b><small>${escapeHtml(hero?.name || player.hero_name)}${isRoomHost ? locale.lobby.host : ""}</small></span>
      ${state}<i>PLAYER 0${index + 1}</i>
    </div>`;
    }).join("");
}
function showRoom(room) {
    currentRoomId = room.room_id;
    selectedMode = room.mode;
    isHost = room.host_id === playerId;
    const self = room.players.find((item) => item.player_id === playerId);
    if (!self && playerId) {
        // 被服务器移出（掉线/超时清理）：房间还在但已不属于你，别再展示别人的房间
        showToast(tx("你已离开房间或被移出，请重新加入。"), true);
        clearMembership();
        return;
    }
    myReady = Boolean(self?.ready);
    getElement("current-room-code").textContent = room.room_id;
    getElement("room-mode-label").textContent = `${MP_STRINGS.roomMode} · ${room.mode === "duel" ? MP_STRINGS.duel : MP_STRINGS.rogue}`;
    entryPanel.hidden = true;
    waitingRoom.hidden = false;
    saveMembership();
    renderPlayers(room);
    // 英雄选择：不要用轮询结果覆盖玩家正在改的值
    if (self && !heroDirty) {
        const available = MP_HEROES.some((hero) => hero.id === self.hero_id);
        if (available)
            heroSelect.value = self.hero_id;
    }
    heroDirty = false;
    heroSelect.disabled = room.status === "playing";
    const preparing = room.status === "preparing";
    prepBanner.hidden = !preparing;
    if (preparing)
        prepCountdown.textContent = String(Math.max(0, Math.ceil(room.prep_remaining)));
    readyButton.hidden = !preparing;
    readyButton.textContent = myReady ? tx("取消准备") : tx("准备");
    readyButton.classList.toggle("is-ready", myReady);
    startButton.hidden = !isHost || preparing;
    startButton.disabled = room.players.length < 2;
    if (preparing) {
        waitingMessage.textContent = myReady ? tx("已准备，等待其他玩家…") : tx("选好英雄后点准备。");
    }
    else if (room.players.length < 2) {
        waitingMessage.textContent = tx("至少需要 2 名玩家，把房间码发给朋友。");
    }
    else {
        waitingMessage.textContent = isHost ? tx("全员到齐后点「开始」。") : tx("等待房主开始…");
    }
    if (room.status === "playing" || room.status === "finished") {
        const heroId = self?.hero_id || heroSelect.value;
        if (!jumping) {
            jumping = true;
            stopPolling();
            const onlineMode = room.mode === "duel" ? "&mode=duel" : "";
            window.location.replace(`/battle?hero=${encodeURIComponent(heroId)}&room=${encodeURIComponent(room.room_id)}&pid=${encodeURIComponent(playerId)}${onlineMode}`);
        }
    }
}
async function pollRoom() {
    if (!currentRoomId || !playerId || jumping)
        return;
    try {
        // pid 当心跳：服务端对房间内的玩家刷新在线时间，等在房间里的人不会被 30 秒掉线清理
        const result = await api(`/${encodeURIComponent(currentRoomId)}?pid=${encodeURIComponent(playerId)}`);
        // 请求飞行期间用户可能点了「退出房间」——丢弃过期响应，别把房间界面画回来
        if (!currentRoomId || !playerId)
            return;
        if (result.room)
            showRoom(result.room);
    }
    catch (error) {
        if (!currentRoomId || !playerId)
            return;
        clearMembership();
        showToast(error instanceof Error ? error.message : tx("房间已关闭，请重新加入。"), true);
    }
}
function startPolling() {
    stopPolling();
    roomPollTimer = window.setInterval(() => void pollRoom(), 900);
}
async function enterRoom(result) {
    playerId = result.player_id || "";
    if (!result.room || !playerId)
        throw new Error(tx("服务器没有返回房间信息。"));
    jumping = false;
    showRoom(result.room);
    startPolling();
}
async function createRoom() {
    try {
        await enterRoom(await api("", { name: currentName(), mode: selectedMode }));
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : tx("创建房间失败。"), true);
    }
}
async function joinRoom(roomId) {
    if (!roomId) {
        showToast(tx("请输入房间码。"), true);
        codeInput.focus();
        return;
    }
    try {
        await enterRoom(await api("/join", { room_id: roomId, name: currentName(), mode: selectedMode }));
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : tx("加入房间失败。"), true);
    }
}
async function changeHero(heroId) {
    if (!currentRoomId || !playerId)
        return;
    heroDirty = true;
    try {
        const result = await api(`/${encodeURIComponent(currentRoomId)}/hero`, { player_id: playerId, hero_id: heroId });
        if (result.room)
            showRoom(result.room);
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : tx("切换英雄失败。"), true);
    }
}
async function toggleReady() {
    if (!currentRoomId || !playerId)
        return;
    try {
        const result = await api(`/${encodeURIComponent(currentRoomId)}/ready`, { player_id: playerId, ready: !myReady });
        if (result.room)
            showRoom(result.room);
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : tx("准备状态更新失败。"), true);
    }
}
async function startGame() {
    if (!currentRoomId || !playerId)
        return;
    try {
        const result = await api(`/${encodeURIComponent(currentRoomId)}/start`, { player_id: playerId });
        if (result.room)
            showRoom(result.room);
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : tx("无法开始游戏。"), true);
    }
}
async function leaveRoom() {
    if (currentRoomId && playerId) {
        try {
            await api(`/${encodeURIComponent(currentRoomId)}/leave`, { player_id: playerId });
        }
        catch (error) {
            console.warn("Could not leave multiplayer room cleanly.", error);
        }
    }
    clearMembership();
}
getElement("create-room").addEventListener("click", () => void createRoom());
modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const mode = button.dataset.lobbyMode;
        if (mode === "ai") {
            window.location.href = "/select?mode=duel";
            return;
        }
        if (mode !== "duel" && mode !== "rogue")
            return;
        selectedMode = mode;
        modeButtons.forEach((item) => {
            const isSelected = item === button;
            item.classList.toggle("selected", isSelected);
            item.setAttribute("aria-pressed", String(isSelected));
        });
        getElement("mp-selected-mode").textContent = mode === "duel" ? MP_STRINGS.duel : MP_STRINGS.rogue;
    });
});
getElement("join-toggle").addEventListener("click", () => {
    const open = joinRow.hidden;
    joinRow.hidden = !open;
    getElement("join-toggle").setAttribute("aria-expanded", String(open));
    if (open)
        codeInput.focus();
});
getElement("join-room").addEventListener("click", () => void joinRoom(codeInput.value.trim().toUpperCase()));
getElement("leave-room").addEventListener("click", () => void leaveRoom());
readyButton.addEventListener("click", () => void toggleReady());
startButton.addEventListener("click", () => void startGame());
heroSelect.addEventListener("change", () => void changeHero(heroSelect.value));
codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter")
        void joinRoom(codeInput.value.trim().toUpperCase());
});
void showLanAddresses();
modeButtons.forEach((button) => {
    const isSelected = button.dataset.lobbyMode === selectedMode;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
});
getElement("mp-selected-mode").textContent = selectedMode === "duel" ? MP_STRINGS.duel : MP_STRINGS.rogue;
if (MP_INITIAL_MODE === "ai")
    window.location.replace("/select?mode=duel");
if (currentRoomId && playerId) {
    void pollRoom();
    startPolling();
}
