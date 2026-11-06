(() => {
  const floor = document.getElementById("house-floor");
  const map = document.getElementById("house-map");
  const player = document.getElementById("home-player");
  const prompt = document.getElementById("home-interact-prompt");
  const promptLabel = document.getElementById("home-interact-label");
  const destinationOverlay = document.getElementById("destination-overlay");
  const destinationClose = document.getElementById("destination-close");
  const saveOverlay = document.getElementById("save-overlay");
  if (!floor || !map || !player || !prompt || !promptLabel || !destinationOverlay || !destinationClose || !saveOverlay) return;

  const hotspots = Array.from(floor.querySelectorAll(".home-hotspot"));
  const keys = new Set();
  const moveSpeed = 250;
  const interactionRange = 142;
  const position = { x: 0.48, y: 0.76 };
  const positionStorageKey = "homeMapPosition";
  try {
    const savedPosition = JSON.parse(sessionStorage.getItem(positionStorageKey) || "null");
    if (savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)) {
      position.x = Math.max(0.06, Math.min(0.94, savedPosition.x));
      position.y = Math.max(0.1, Math.min(0.92, savedPosition.y));
    }
  } catch (error) {
    // Continue from the default spawn if session storage is unavailable or invalid.
  }
  let nearby = null;
  let lastFrame = 0;

  const sceneSize = () => ({ width: map.clientWidth, height: map.clientHeight });
  const followPlayer = () => {
    const { width, height } = sceneSize();
    const x = Math.min(0, Math.max(floor.clientWidth - width, floor.clientWidth / 2 - position.x * width));
    const y = Math.min(0, Math.max(floor.clientHeight - height, floor.clientHeight / 2 - position.y * height));
    map.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const movePlayer = () => {
    const { width, height } = sceneSize();
    player.style.left = `${position.x * width}px`;
    player.style.top = `${position.y * height}px`;
    followPlayer();
  };
  const distanceToHotspot = (hotspot) => {
    const bounds = hotspot.getBoundingClientRect();
    const playerBounds = player.getBoundingClientRect();
    const x = (bounds.left + bounds.width / 2) - (playerBounds.left + playerBounds.width / 2);
    const y = (bounds.top + bounds.height / 2) - (playerBounds.top + playerBounds.height / 2);
    return Math.hypot(x, y);
  };
  const refreshNearby = () => {
    nearby = hotspots
      .map((hotspot) => ({ hotspot, distance: distanceToHotspot(hotspot) }))
      .filter(({ distance }) => distance <= interactionRange)
      .sort((a, b) => a.distance - b.distance)[0]?.hotspot || null;
    hotspots.forEach((hotspot) => hotspot.classList.toggle("nearby", hotspot === nearby));
    if (nearby) {
      promptLabel.textContent = nearby.dataset.homeLabel || "";
      prompt.classList.add("ready");
    } else {
      promptLabel.textContent = prompt.dataset.walkHint || "";
      prompt.classList.remove("ready");
    }
  };
  const interact = (hotspot) => {
    if (!hotspot) return;
    if (hotspot.dataset.homeAction === "destinations") {
      destinationOverlay.hidden = false;
      destinationClose.focus();
      return;
    }
    if (hotspot.dataset.homeAction === "save") {
      document.dispatchEvent(new Event("home:open-save"));
      return;
    }
    const href = hotspot.dataset.homeHref;
    if (href) window.location.assign(href);
  };
  const frame = (timestamp) => {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    if (!destinationOverlay.hidden || !saveOverlay.hidden) {
      requestAnimationFrame(frame);
      return;
    }
    let dx = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
    let dy = Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup"));
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    const { width, height } = sceneSize();
    position.x = Math.max(0.06, Math.min(0.94, position.x + dx * moveSpeed * dt / width));
    position.y = Math.max(0.1, Math.min(0.92, position.y + dy * moveSpeed * dt / height));
    movePlayer();
    refreshNearby();
    requestAnimationFrame(frame);
  };

  floor.addEventListener("click", (event) => {
    const hotspot = event.target instanceof Element ? event.target.closest(".home-hotspot") : null;
    if (hotspot) interact(hotspot);
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    const key = event.key.toLowerCase();
    if (!destinationOverlay.hidden || !saveOverlay.hidden) {
      if (key === "escape" && !destinationOverlay.hidden) destinationOverlay.hidden = true;
      return;
    }
    if (key === "e") {
      event.preventDefault();
      if (destinationOverlay.hidden) interact(nearby);
      return;
    }
    if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) {
      keys.add(key);
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem(positionStorageKey, JSON.stringify(position));
    } catch (error) {
      // Navigation should still work when session storage is unavailable.
    }
  });
  window.addEventListener("resize", movePlayer);
  destinationClose.addEventListener("click", () => {
    destinationOverlay.hidden = true;
  });
  destinationOverlay.addEventListener("click", (event) => {
    if (event.target === destinationOverlay) destinationOverlay.hidden = true;
  });

  prompt.dataset.walkHint = promptLabel.textContent || "";
  movePlayer();
  refreshNearby();
  requestAnimationFrame(frame);
})();
