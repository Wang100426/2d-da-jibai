"use strict";
// 地图图鉴的缩略图绘制。
// 布局数据由 app.py 注入（window.MAP_CODEX_PREVIEWS），数值镜像 frontend/map.ts 的基础阵列，
// 所以这里只负责把矩形画成一张能一眼看懂结构的示意图。
const CODEX_GRID_STEP = 200;
const STATION_HALL_HEIGHT = 300;
const STATION_PLATFORM_HEIGHT = 250;
const STATION_TRACK_HEIGHT = 95;
const STATION_TRACK_COUNT = 5;
const STATION_PLATFORM_COUNT = 6;
function drawStationMotif(context, preview, hair) {
    const [, mapHeight] = preview.size;
    const palette = preview.palette;
    let y = STATION_HALL_HEIGHT;
    const trackBands = [];
    for (let index = 0; index < STATION_PLATFORM_COUNT; index += 1) {
        y += STATION_PLATFORM_HEIGHT;
        if (index < STATION_TRACK_COUNT) {
            trackBands.push({ x: 0, y, w: preview.size[0], h: STATION_TRACK_HEIGHT });
            y += STATION_TRACK_HEIGHT;
        }
    }
    trackBands.forEach((band) => {
        context.fillStyle = "#070d13";
        context.fillRect(band.x, band.y, band.w, band.h);
        context.strokeStyle = palette.grid;
        context.lineWidth = hair * 2;
        [band.y + band.h * 0.3, band.y + band.h * 0.7].forEach((railY) => {
            context.beginPath();
            context.moveTo(band.x, railY);
            context.lineTo(band.x + band.w, railY);
            context.stroke();
        });
    });
    // 站台边界：让六个站台在缩略图里也能数得清。
    context.strokeStyle = palette.grid;
    context.lineWidth = hair;
    let lineY = STATION_HALL_HEIGHT;
    for (let index = 0; index < STATION_PLATFORM_COUNT; index += 1) {
        context.beginPath();
        context.moveTo(0, lineY);
        context.lineTo(preview.size[0], lineY);
        context.stroke();
        lineY += STATION_PLATFORM_HEIGHT;
        if (index < STATION_TRACK_COUNT)
            lineY += STATION_TRACK_HEIGHT;
    }
    context.beginPath();
    context.moveTo(0, mapHeight);
    context.lineTo(preview.size[0], mapHeight);
    context.stroke();
}
function drawAirportRunways(context, preview, hair) {
    const [mapWidth, mapHeight] = preview.size;
    const palette = preview.palette;
    const apronX = mapWidth / 2;
    const apronY = mapHeight / 2;
    const directions = [
        [0, -1],
        [Math.SQRT1_2, -Math.SQRT1_2],
        [1, 0],
        [Math.SQRT1_2, Math.SQRT1_2],
        [0, 1],
        [-Math.SQRT1_2, Math.SQRT1_2],
        [-1, 0],
        [-Math.SQRT1_2, -Math.SQRT1_2],
    ];
    directions.forEach(([dx, dy]) => {
        const distanceX = dx === 0 ? Infinity : (mapWidth / 2 - 60) / Math.abs(dx);
        const distanceY = dy === 0 ? Infinity : (mapHeight / 2 - 60) / Math.abs(dy);
        const distance = Math.min(distanceX, distanceY);
        const endX = apronX + dx * distance;
        const endY = apronY + dy * distance;
        context.strokeStyle = palette.road;
        context.lineWidth = 78;
        context.beginPath();
        context.moveTo(apronX, apronY);
        context.lineTo(endX, endY);
        context.stroke();
        context.strokeStyle = palette.grid;
        context.lineWidth = hair * 3;
        context.setLineDash([26, 26]);
        context.beginPath();
        context.moveTo(apronX, apronY);
        context.lineTo(endX, endY);
        context.stroke();
        context.setLineDash([]);
        context.beginPath();
        context.arc(endX, endY, 18, 0, Math.PI * 2);
        context.stroke();
    });
    context.fillStyle = palette.road;
    context.beginPath();
    context.arc(apronX, apronY, 120, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = palette.stroke;
    context.lineWidth = hair * 3;
    context.stroke();
}
function drawCodexPreview(canvas, preview) {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(260, Math.round(bounds.width || canvas.width));
    const height = Math.max(195, Math.round(bounds.height || (width * preview.size[1]) / preview.size[0]));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context)
        return;
    const [mapWidth, mapHeight] = preview.size;
    const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight);
    const offsetX = (canvas.width - mapWidth * scale) / 2;
    const offsetY = (canvas.height - mapHeight * scale) / 2;
    const palette = preview.palette;
    const hair = 1 / scale;
    const cap = { x: offsetX, y: offsetY, w: mapWidth * scale, h: mapHeight * scale };
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#05070d";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    context.fillStyle = palette.bg;
    context.fillRect(0, 0, mapWidth, mapHeight);
    context.strokeStyle = palette.grid;
    context.lineWidth = hair;
    for (let x = CODEX_GRID_STEP; x < mapWidth; x += CODEX_GRID_STEP) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, mapHeight);
        context.stroke();
    }
    for (let y = CODEX_GRID_STEP; y < mapHeight; y += CODEX_GRID_STEP) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(mapWidth, y);
        context.stroke();
    }
    if (preview.motif === "station")
        drawStationMotif(context, preview, hair);
    if (preview.motif === "runways")
        drawAirportRunways(context, preview, hair);
    context.fillStyle = palette.road;
    preview.roads.forEach((road) => context.fillRect(road.x, road.y, road.w, road.h));
    preview.obstacles.forEach((obstacle) => {
        context.fillStyle = palette.fill;
        context.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        if (obstacle.kind === "building") {
            const inset = 14;
            const innerWidth = obstacle.w - inset * 2;
            const innerHeight = obstacle.h - inset * 2;
            if (innerWidth > 0 && innerHeight > 0) {
                context.fillStyle = palette.inner;
                context.fillRect(obstacle.x + inset, obstacle.y + inset, innerWidth, innerHeight);
            }
        }
        context.strokeStyle = palette.stroke;
        context.lineWidth = hair * 2;
        context.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    });
    // 出生点：和实机一样落在 (1600,1200) 附近。
    const [spawnX, spawnY] = preview.spawn;
    context.strokeStyle = palette.accent;
    context.lineWidth = hair * 3;
    context.beginPath();
    context.arc(spawnX, spawnY, 46, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(spawnX - 74, spawnY);
    context.lineTo(spawnX + 74, spawnY);
    context.moveTo(spawnX, spawnY - 74);
    context.lineTo(spawnX, spawnY + 74);
    context.stroke();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.strokeStyle = palette.accent;
    context.globalAlpha = 0.5;
    context.lineWidth = Math.max(1, ratio);
    context.strokeRect(cap.x + 0.5, cap.y + 0.5, cap.w - 1, cap.h - 1);
    context.globalAlpha = 1;
}
const codexPreviews = window.MAP_CODEX_PREVIEWS || [];
const previewById = new Map(codexPreviews.map((preview) => [preview.id, preview]));
function renderCodexPreviews() {
    document.querySelectorAll("[data-codex-canvas]").forEach((canvas, index) => {
        const key = canvas.dataset.codexCanvas || "";
        const preview = previewById.get(key) || codexPreviews[index];
        if (preview)
            drawCodexPreview(canvas, preview);
    });
}
renderCodexPreviews();
let codexResizeTimer = 0;
window.addEventListener("resize", () => {
    window.clearTimeout(codexResizeTimer);
    codexResizeTimer = window.setTimeout(renderCodexPreviews, 180);
});
