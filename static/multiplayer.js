"use strict";
const locale = MP_LOCALE;
const savedUsername = typeof MP_USERNAME === "undefined" ? "" : MP_USERNAME;
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
const hallPlayerStorageKey = "2d-da-jibai-hall-player";
const hallViewport = document.getElementById("hall-viewport");
const hallMap = document.getElementById("hall-map");
const hallSelf = document.getElementById("hall-self");
const hallPlayers = document.getElementById("hall-players");
const hallPrompt = document.getElementById("hall-interact-prompt");
const hallPromptLabel = document.getElementById("hall-interact-label");
const arenaOverlay = document.getElementById("arena-overlay");
const inviteOverlay = document.getElementById("invite-overlay");
const roomCodeOverlay = document.getElementById("mp-entry-overlay");
const waitingOverlay = document.getElementById("waiting-overlay");
const hallInvitations = document.getElementById("mp-invitations");
const hallOnlineCount = document.getElementById("hall-online-count");
const hallEnabled = hallViewport instanceof HTMLElement
    && hallMap instanceof HTMLElement
    && hallSelf instanceof HTMLElement
    && hallPlayers instanceof HTMLElement
    && hallPrompt instanceof HTMLElement
    && hallPromptLabel instanceof HTMLElement;
let playerId = "";
let currentRoomId = "";
let hallPlayerId = "";
let selectedMode = MP_INITIAL_MODE === "duel" ? "duel" : "rogue";
let isHost = false;
let myReady = false;
let roomPollTimer = 0;
let toastTimer = 0;
let jumping = false;
/** 上一帧看到的英雄，避免轮询把玩家的选择覆盖掉。 */
let heroDirty = false;
let hallPollTimer = 0;
let hallLastFrame = 0;
let hallActive = true;
let hallPolling = false;
let hallSpawnReady = false;
let selectedHallTarget = "";
const hallKeys = new Set();
const hallPosition = { x: 500, y: 525 };
let nearbyHallTarget = null;
let hallNearbyObject = null;
try {
    nameInput.value = savedUsername || localStorage.getItem("2d-da-jibai-name") || "";
    nameInput.readOnly = Boolean(savedUsername);
    const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (stored?.playerId && stored.roomId) {
        playerId = stored.playerId;
        currentRoomId = stored.roomId;
    }
    hallPlayerId = sessionStorage.getItem(hallPlayerStorageKey) || "";
    if (!hallPlayerId) {
        const bytes = new Uint8Array(18);
        if (globalThis.crypto?.getRandomValues)
            globalThis.crypto.getRandomValues(bytes);
        else
            bytes.forEach((_value, index) => { bytes[index] = Math.floor(Math.random() * 256); });
        hallPlayerId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        sessionStorage.setItem(hallPlayerStorageKey, hallPlayerId);
    }
}
catch (error) {
    console.warn("Could not restore local multiplayer session.", error);
    hallPlayerId = `hall-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
async function hallApi(path = "", body, method) {
    const response = await fetch(`/api/mp/hall${path}`, {
        method: method || (body ? "POST" : "GET"),
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok || !result.ok)
        throw new Error(result.error || tx(`请求失败 (${response.status})`));
    return result;
}
function setOverlayHidden(overlay, hidden) {
    if (overlay)
        overlay.hidden = hidden;
}
function worldSize() {
    if (!(hallMap instanceof HTMLElement))
        return { width: 1, height: 1 };
    return { width: hallMap.clientWidth, height: hallMap.clientHeight };
}
function moveHallCamera() {
    if (!(hallMap instanceof HTMLElement) || !(hallViewport instanceof HTMLElement) || !(hallSelf instanceof HTMLElement))
        return;
    const { width, height } = worldSize();
    hallSelf.style.left = `${hallPosition.x / 1000 * width}px`;
    hallSelf.style.top = `${hallPosition.y / 700 * height}px`;
    const x = Math.min(0, Math.max(hallViewport.clientWidth - width, hallViewport.clientWidth / 2 - hallPosition.x / 1000 * width));
    const y = Math.min(0, Math.max(hallViewport.clientHeight - height, hallViewport.clientHeight / 2 - hallPosition.y / 700 * height));
    hallMap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}
function renderHallPlayers(players) {
    if (!(hallPlayers instanceof HTMLElement) || !(hallOnlineCount instanceof HTMLElement))
        return;
    hallOnlineCount.textContent = String(players.length + 1);
    hallPlayers.innerHTML = players.map((player) => {
        const x = Math.max(0, Math.min(1000, Number(player.x) || 0)) / 10;
        const y = Math.max(0, Math.min(700, Number(player.y) || 0)) / 7;
        const name = escapeHtml(player.name);
        const initial = escapeHtml(player.name.slice(0, 1));
        const playerIdSafe = escapeHtml(player.player_id);
        return `<button class="hall-player hall-remote-player" type="button" data-hall-player="${playerIdSafe}" data-name="${name}" aria-label="${escapeHtml(MP_HALL_STRINGS.player.replace("{name}", player.name))}" style="left:${x}%;top:${y}%"><span class="hall-player-name">${name}</span><i>${initial}</i></button>`;
    }).join("");
}
function renderHallInvitations(invitations) {
    if (!(hallInvitations instanceof HTMLElement))
        return;
    hallInvitations.innerHTML = invitations.map((invitation) => {
        const id = escapeHtml(invitation.invitation_id);
        const mode = invitation.mode === "duel" ? MP_HALL_STRINGS.duel : MP_HALL_STRINGS.rogue;
        const message = escapeHtml(MP_HALL_STRINGS.inviteReceived.replace("{name}", invitation.from_name).replace("{mode}", mode));
        return `<article class="hall-invite-card" data-invitation="${id}" data-room="${escapeHtml(invitation.room_id)}" data-mode="${invitation.mode}"><p>${message}</p><div class="hall-invite-actions"><button type="button" data-invite-accept="${id}">${escapeHtml(MP_HALL_STRINGS.accept)}</button><button type="button" data-invite-decline="${id}">${escapeHtml(MP_HALL_STRINGS.decline)}</button></div></article>`;
    }).join("");
}
async function pollHall() {
    if (!hallEnabled || !hallActive || !hallPlayerId || currentRoomId || jumping || hallPolling)
        return;
    hallPolling = true;
    try {
        const snapshot = await hallApi("", {
            player_id: hallPlayerId,
            name: currentName(),
            x: hallPosition.x,
            y: hallPosition.y,
        });
        if (!hallActive || currentRoomId) {
            await hallApi(`?player_id=${encodeURIComponent(hallPlayerId)}`, undefined, "DELETE");
            return;
        }
        if (!hallSpawnReady && snapshot.self) {
            hallPosition.x = snapshot.self.x;
            hallPosition.y = snapshot.self.y;
            hallSpawnReady = true;
            moveHallCamera();
        }
        renderHallPlayers(snapshot.players || []);
        renderHallInvitations(snapshot.invitations || []);
    }
    catch (error) {
        if (!(error instanceof Error))
            return;
        console.warn("Could not update multiplayer hall presence.", error);
    }
    finally {
        hallPolling = false;
    }
}
function stopHallPresence() {
    hallActive = false;
    window.clearInterval(hallPollTimer);
    hallPollTimer = 0;
    if (hallPlayerId)
        void hallApi(`?player_id=${encodeURIComponent(hallPlayerId)}`, undefined, "DELETE").catch(() => { });
}
function hallInteractables() {
    if (!(hallMap instanceof HTMLElement))
        return [];
    return [...hallMap.querySelectorAll(".hall-interactable, .hall-remote-player")];
}
function updateHallNearby() {
    if (!(hallSelf instanceof HTMLElement) || !(hallPrompt instanceof HTMLElement) || !(hallPromptLabel instanceof HTMLElement))
        return;
    const selfRect = hallSelf.getBoundingClientRect();
    const centerX = selfRect.left + selfRect.width / 2;
    const centerY = selfRect.top + selfRect.height / 2;
    const candidates = hallInteractables().map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, distance: Math.hypot(rect.left + rect.width / 2 - centerX, rect.top + rect.height / 2 - centerY) };
    }).filter((candidate) => candidate.distance <= 150).sort((a, b) => a.distance - b.distance);
    const target = candidates[0]?.element || null;
    hallNearbyObject = target?.classList.contains("hall-interactable") ? target : null;
    nearbyHallTarget = target?.classList.contains("hall-remote-player") ? target : null;
    hallInteractables().forEach((element) => element.classList.toggle("nearby", element === target));
    if (hallPrompt)
        hallPrompt.classList.toggle("ready", Boolean(target));
    if (hallPromptLabel) {
        if (hallNearbyObject?.dataset.hallAction === "arena")
            hallPromptLabel.textContent = MP_HALL_STRINGS.arena;
        else if (hallNearbyObject?.dataset.hallAction === "rogue")
            hallPromptLabel.textContent = MP_HALL_STRINGS.portal;
        else if (nearbyHallTarget)
            hallPromptLabel.textContent = MP_HALL_STRINGS.player.replace("{name}", nearbyHallTarget.dataset.name || "");
        else
            hallPromptLabel.textContent = MP_HALL_STRINGS.walk;
    }
}
function openPlayerInvite(target) {
    selectedHallTarget = target.dataset.hallPlayer || "";
    const name = document.getElementById("invite-target-name");
    if (name)
        name.textContent = target.dataset.name || "";
    setOverlayHidden(inviteOverlay, false);
}
function interactWithHallTarget(target) {
    if (!target)
        return;
    if (target.classList.contains("hall-remote-player")) {
        openPlayerInvite(target);
        return;
    }
    if (target.dataset.hallAction === "arena")
        setOverlayHidden(arenaOverlay, false);
    if (target.dataset.hallAction === "rogue")
        void createRoom("rogue", true);
}
async function inviteHallPlayer(mode) {
    if (!selectedHallTarget || !hallPlayerId)
        return;
    let created = null;
    try {
        created = await api("", { name: currentName(), mode, hall_player_id: hallPlayerId });
        if (!created.room)
            throw new Error(tx("服务器没有返回房间信息。"));
        await hallApi("/invitations", {
            player_id: hallPlayerId,
            target_id: selectedHallTarget,
            room_id: created.room.room_id,
            mode,
        });
        setOverlayHidden(inviteOverlay, true);
        selectedHallTarget = "";
        await enterRoom(created);
        showToast(MP_HALL_STRINGS.inviteSent);
    }
    catch (error) {
        if (created?.room && created.player_id) {
            await api(`/${encodeURIComponent(created.room.room_id)}/leave`, { player_id: created.player_id }).catch(() => { });
        }
        showToast(error instanceof Error ? error.message : tx("发送邀请失败。"), true);
    }
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
    const name = (savedUsername || nameInput.value).trim();
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
    setOverlayHidden(waitingOverlay, true);
    setOverlayHidden(roomCodeOverlay, true);
    joinRow.hidden = true;
    getElement("join-toggle").setAttribute("aria-expanded", "false");
    if (hallEnabled) {
        hallActive = true;
        hallSpawnReady = false;
        void pollHall();
        window.clearInterval(hallPollTimer);
        hallPollTimer = window.setInterval(() => void pollHall(), 1000);
    }
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
    setOverlayHidden(roomCodeOverlay, true);
    setOverlayHidden(waitingOverlay, false);
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
    stopHallPresence();
    showRoom(result.room);
    startPolling();
}
async function createRoom(mode = selectedMode, fromHall = false) {
    try {
        selectedMode = mode;
        await enterRoom(await api("", {
            name: currentName(),
            mode,
            ...(fromHall && hallPlayerId ? { hall_player_id: hallPlayerId } : {}),
        }));
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : tx("创建房间失败。"), true);
    }
}
async function joinRoom(roomId, mode = selectedMode) {
    if (!roomId) {
        showToast(tx("请输入房间码。"), true);
        codeInput.focus();
        return false;
    }
    try {
        selectedMode = mode;
        await enterRoom(await api("/join", { room_id: roomId, name: currentName(), mode }));
        return true;
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : tx("加入房间失败。"), true);
        return false;
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
getElement("create-room").addEventListener("click", () => void createRoom(selectedMode, true));
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
if (hallEnabled && hallMap instanceof HTMLElement && hallViewport instanceof HTMLElement) {
    const map = hallMap;
    const mapButtons = [...document.querySelectorAll("[data-close-overlay]")];
    const touchButtons = [...document.querySelectorAll("[data-move]")];
    const moveKeys = {
        up: "w",
        left: "a",
        down: "s",
        right: "d",
    };
    const overlays = [arenaOverlay, inviteOverlay, roomCodeOverlay, waitingOverlay, hallInvitations]
        .filter((element) => element instanceof HTMLElement && element.id !== "mp-invitations");
    const dismissibleOverlays = [arenaOverlay, inviteOverlay, roomCodeOverlay]
        .filter((element) => element instanceof HTMLElement);
    const overlayOpen = () => overlays.some((element) => !element.hidden);
    const hallFrame = (timestamp) => {
        const dt = hallLastFrame ? Math.min((timestamp - hallLastFrame) / 1000, 0.05) : 0;
        hallLastFrame = timestamp;
        if (!currentRoomId && !overlayOpen()) {
            let dx = Number(hallKeys.has("d") || hallKeys.has("arrowright")) - Number(hallKeys.has("a") || hallKeys.has("arrowleft"));
            let dy = Number(hallKeys.has("s") || hallKeys.has("arrowdown")) - Number(hallKeys.has("w") || hallKeys.has("arrowup"));
            if (dx && dy) {
                dx *= Math.SQRT1_2;
                dy *= Math.SQRT1_2;
            }
            const { width, height } = worldSize();
            hallPosition.x = Math.max(35, Math.min(965, hallPosition.x + dx * 250 * dt / width * 1000));
            hallPosition.y = Math.max(45, Math.min(655, hallPosition.y + dy * 250 * dt / height * 700));
            moveHallCamera();
            updateHallNearby();
        }
        window.requestAnimationFrame(hallFrame);
    };
    map.addEventListener("click", (event) => {
        const element = event.target instanceof Element
            ? event.target.closest(".hall-interactable, .hall-remote-player")
            : null;
        if (element)
            interactWithHallTarget(element);
    });
    document.querySelectorAll("#arena-online").forEach((button) => {
        button.addEventListener("click", () => {
            setOverlayHidden(arenaOverlay, true);
            void createRoom("duel", true);
        });
    });
    document.getElementById("arena-ai")?.addEventListener("click", () => {
        window.location.href = "/select?mode=duel";
    });
    document.getElementById("invite-duel")?.addEventListener("click", () => void inviteHallPlayer("duel"));
    document.getElementById("invite-rogue")?.addEventListener("click", () => void inviteHallPlayer("rogue"));
    document.getElementById("mp-room-code-open")?.addEventListener("click", () => setOverlayHidden(roomCodeOverlay, false));
    document.getElementById("hall-touch-interact")?.addEventListener("click", () => {
        if (!overlayOpen())
            interactWithHallTarget(nearbyHallTarget || hallNearbyObject);
    });
    mapButtons.forEach((button) => button.addEventListener("click", () => {
        const overlay = button.closest(".mp-overlay");
        setOverlayHidden(overlay, true);
    }));
    hallInvitations?.addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest("[data-invite-accept], [data-invite-decline]") : null;
        const card = button?.closest(".hall-invite-card");
        if (!button || !card)
            return;
        const invitationId = card.dataset.invitation || "";
        if (button.hasAttribute("data-invite-decline")) {
            void hallApi(`/invitations/${encodeURIComponent(invitationId)}/dismiss`, { player_id: hallPlayerId }).then(() => card.remove());
            return;
        }
        const mode = card.dataset.mode === "duel" ? "duel" : "rogue";
        void joinRoom(card.dataset.room || "", mode).then((joined) => {
            if (joined) {
                void hallApi(`/invitations/${encodeURIComponent(invitationId)}/dismiss`, { player_id: hallPlayerId });
            }
        });
    });
    touchButtons.forEach((button) => {
        const key = moveKeys[button.dataset.move || ""];
        if (!key)
            return;
        button.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            hallKeys.add(key);
        });
        const release = () => hallKeys.delete(key);
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("pointerleave", release);
    });
    window.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) {
            if (overlayOpen())
                return;
            hallKeys.add(key);
            event.preventDefault();
        }
        else if (key === "e" && !overlayOpen()) {
            event.preventDefault();
            interactWithHallTarget(nearbyHallTarget || hallNearbyObject);
        }
        else if (key === "escape") {
            dismissibleOverlays.forEach((overlay) => { overlay.hidden = true; });
        }
    });
    window.addEventListener("keyup", (event) => hallKeys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => hallKeys.clear());
    window.addEventListener("resize", moveHallCamera);
    if (!currentRoomId) {
        moveHallCamera();
        void pollHall();
        hallPollTimer = window.setInterval(() => void pollHall(), 1000);
    }
    window.requestAnimationFrame(hallFrame);
}
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
    setOverlayHidden(waitingOverlay, false);
    void pollRoom();
    startPolling();
}
