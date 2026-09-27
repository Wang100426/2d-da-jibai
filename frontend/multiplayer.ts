interface LobbyHero {
  id: string;
  name: string;
  class_name: string;
  initial: string;
  accent: string;
}

interface RoomSummary {
  room_id: string;
  host_name: string;
  count: number;
  capacity: number;
  status: "waiting" | "playing";
  players: string[];
}

interface LobbyPlayer {
  player_id: string;
  name: string;
  hero_id: string;
  hero_name: string;
  initial: string;
  accent: string;
}

interface RoomSnapshot {
  room_id: string;
  host_id: string;
  status: "waiting" | "playing";
  players: LobbyPlayer[];
  capacity: number;
}

interface ApiResult {
  ok: boolean;
  error?: string;
  player_id?: string;
  room?: RoomSnapshot;
  rooms?: RoomSummary[];
}

interface ServerInfo {
  ok: boolean;
  lan_urls: string[];
}

declare const MP_HEROES: LobbyHero[];

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing lobby element: ${id}`);
  return element as T;
}

const nameInput = getElement<HTMLInputElement>("player-name");
const heroSelect = getElement<HTMLSelectElement>("hero-select");
const codeInput = getElement<HTMLInputElement>("room-code");
const roomList = getElement<HTMLDivElement>("room-list");
const waitingRoom = getElement<HTMLElement>("waiting-room");
const toast = getElement<HTMLDivElement>("mp-toast");
const lanAddresses = getElement<HTMLSpanElement>("lan-addresses");
const storageKey = "2d-da-jibai-lobby";

let playerId = "";
let currentRoomId = "";
let isHost = false;
let roomPollTimer = 0;
let roomListTimer = 0;
let toastTimer = 0;

try {
  nameInput.value = localStorage.getItem("2d-da-jibai-name") || "";
  const stored = JSON.parse(localStorage.getItem(storageKey) || "null") as { playerId?: string; roomId?: string } | null;
  if (stored?.playerId && stored.roomId) {
    playerId = stored.playerId;
    currentRoomId = stored.roomId;
  }
} catch (error) {
  console.warn("Could not restore local multiplayer session.", error);
}

function showToast(message: string, warning = false): void {
  toast.textContent = message;
  toast.classList.toggle("warning", warning);
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2500);
}

async function api(path: string, body?: Record<string, unknown>): Promise<ApiResult> {
  const response = await fetch(`/api/mp/rooms${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as ApiResult;
  if (!response.ok || !result.ok) throw new Error(result.error || `请求失败 (${response.status})`);
  return result;
}

async function showLanAddresses(): Promise<void> {
  try {
    const response = await fetch("/api/server-info");
    const result = await response.json() as ServerInfo;
    if (!response.ok || !result.ok) throw new Error("无法获取局域网地址。");
    lanAddresses.textContent = result.lan_urls.length
      ? result.lan_urls.join(" · ")
      : "未检测到局域网地址，请确认设备已连接网络。";
  } catch (error) {
    lanAddresses.textContent = error instanceof Error ? error.message : "局域网地址获取失败。";
  }
}

function currentName(): string {
  const name = nameInput.value.trim();
  if (!name) throw new Error("请先输入昵称。");
  localStorage.setItem("2d-da-jibai-name", name);
  return name;
}

function saveMembership(): void {
  localStorage.setItem(storageKey, JSON.stringify({ playerId, roomId: currentRoomId }));
}

function clearMembership(): void {
  playerId = "";
  currentRoomId = "";
  isHost = false;
  localStorage.removeItem(storageKey);
  window.clearInterval(roomPollTimer);
  waitingRoom.hidden = true;
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function renderRooms(rooms: RoomSummary[]): void {
  if (!rooms.length) {
    roomList.innerHTML = '<p class="empty-state">暂时没有等待中的房间，创建一个吧。</p>';
    return;
  }
  roomList.innerHTML = rooms.map((room) => {
    const full = room.count >= room.capacity;
    const disabled = full || room.status !== "waiting";
    return `<article class="room-row">
      <div class="room-code">${escapeHtml(room.room_id)}</div>
      <div class="room-summary"><b>${escapeHtml(room.host_name)} 的房间</b><small>${room.count}/${room.capacity} 人 · ${escapeHtml(room.players.join("、"))}</small></div>
      <button type="button" data-join="${escapeHtml(room.room_id)}" ${disabled ? "disabled" : ""}>${disabled ? "不可加入" : "加入"}</button>
    </article>`;
  }).join("");
  roomList.querySelectorAll<HTMLButtonElement>("[data-join]").forEach((button) => {
    button.addEventListener("click", () => joinRoom(button.dataset.join || ""));
  });
}

async function refreshRooms(): Promise<void> {
  try {
    const result = await api("");
    renderRooms(result.rooms || []);
  } catch (error) {
    roomList.innerHTML = `<p class="empty-state error">${escapeHtml(error instanceof Error ? error.message : "房间列表加载失败")}</p>`;
  }
}

function showRoom(room: RoomSnapshot): void {
  currentRoomId = room.room_id;
  isHost = room.host_id === playerId;
  getElement<HTMLElement>("current-room-code").textContent = room.room_id;
  const players = getElement<HTMLDivElement>("waiting-players");
  players.innerHTML = room.players.map((player, index) => {
    const hero = MP_HEROES.find((item) => item.id === player.hero_id);
    const host = player.player_id === room.host_id;
    return `<div class="waiting-player">
      <span class="lobby-avatar ${escapeHtml(hero?.accent || player.accent)}">${escapeHtml(hero?.initial || player.initial)}</span>
      <span><b>${escapeHtml(player.name)}${player.player_id === playerId ? "（你）" : ""}</b><small>${escapeHtml(player.hero_name)}${host ? " · 房主" : ""}</small></span>
      <i>PLAYER 0${index + 1}</i>
    </div>`;
  }).join("");
  const startButton = getElement<HTMLButtonElement>("start-game");
  startButton.hidden = !isHost;
  startButton.disabled = room.players.length < 2;
  getElement<HTMLElement>("waiting-message").textContent = room.players.length < 2
    ? "至少需要 2 名玩家，分享房间码邀请朋友加入。"
    : isHost ? "玩家已就绪，房主可以开始探索。" : "等待房主开始游戏…";
  waitingRoom.hidden = false;
  saveMembership();
  if (room.status === "playing") {
    const self = room.players.find((item) => item.player_id === playerId);
    const heroId = self?.hero_id || heroSelect.value;
    window.location.href = `/battle?hero=${encodeURIComponent(heroId)}&room=${encodeURIComponent(room.room_id)}&pid=${encodeURIComponent(playerId)}`;
  }
}

async function pollRoom(): Promise<void> {
  if (!currentRoomId || !playerId) return;
  try {
    const result = await api(`/${encodeURIComponent(currentRoomId)}`);
    if (result.room) showRoom(result.room);
  } catch (error) {
    clearMembership();
    showToast(error instanceof Error ? error.message : "房间已关闭，请重新加入。", true);
    await refreshRooms();
  }
}

async function createRoom(): Promise<void> {
  try {
    const result = await api("", { name: currentName(), hero_id: heroSelect.value });
    playerId = result.player_id || "";
    if (!result.room || !playerId) throw new Error("服务器没有返回房间信息。");
    showRoom(result.room);
    window.clearInterval(roomPollTimer);
    roomPollTimer = window.setInterval(() => void pollRoom(), 1200);
    await refreshRooms();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "创建房间失败。", true);
  }
}

async function joinRoom(roomId: string): Promise<void> {
  try {
    const result = await api("/join", { room_id: roomId, name: currentName(), hero_id: heroSelect.value });
    playerId = result.player_id || "";
    if (!result.room || !playerId) throw new Error("服务器没有返回房间信息。");
    showRoom(result.room);
    window.clearInterval(roomPollTimer);
    roomPollTimer = window.setInterval(() => void pollRoom(), 1200);
    await refreshRooms();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "加入房间失败。", true);
  }
}

async function startGame(): Promise<void> {
  try {
    await api(`/${encodeURIComponent(currentRoomId)}/start`, { player_id: playerId });
    await pollRoom();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "无法开始游戏。", true);
  }
}

async function leaveRoom(): Promise<void> {
  if (currentRoomId && playerId) {
    try {
      await api(`/${encodeURIComponent(currentRoomId)}/leave`, { player_id: playerId });
    } catch (error) {
      console.warn("Could not leave multiplayer room cleanly.", error);
    }
  }
  clearMembership();
  await refreshRooms();
}

getElement<HTMLButtonElement>("create-room").addEventListener("click", () => void createRoom());
getElement<HTMLButtonElement>("join-room").addEventListener("click", () => void joinRoom(codeInput.value.trim()));
getElement<HTMLButtonElement>("refresh-rooms").addEventListener("click", () => void refreshRooms());
getElement<HTMLButtonElement>("start-game").addEventListener("click", () => void startGame());
getElement<HTMLButtonElement>("leave-room").addEventListener("click", () => void leaveRoom());
codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") void joinRoom(codeInput.value.trim());
});

void refreshRooms();
void showLanAddresses();
roomListTimer = window.setInterval(() => void refreshRooms(), 3500);
if (currentRoomId && playerId) {
  void pollRoom();
  roomPollTimer = window.setInterval(() => void pollRoom(), 1200);
}
