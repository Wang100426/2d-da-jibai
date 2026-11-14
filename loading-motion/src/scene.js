/**
 * 2D大击败 / 2DFight Arena — 战场加载背景（4 秒无缝循环）
 *
 * 供 templates/battle.html 的 .map-transition 当背景视频用：HTML 层已有
 * 左上 briefing / 左下英雄卡 / 右下 LOADING 提示，所以这里只做氛围，
 * 不放大字，并把左侧与底部压暗保证文案可读。
 *
 * 所有视觉状态都是 prepareFrame(time) 的纯函数；周期性动效一律用
 * sin/cos(TAU * phase * k)（k 为整数）或首尾透明度为 0 的线性扫光，
 * 因此 t=0 与 t=LOOP 画面一致，loop 播放不会跳帧。
 * 版本号由 scripts/sync-version.mjs 从游戏 package.json 同步。
 */

import { resolveVersion } from './version.mjs';

const LOOP = 4;
const TAU = Math.PI * 2;

const CONFIG = {
  bg: '#050814',
  cyan: '#49e6e0',
  pink: '#ff4fa3',
  violet: '#8867ff',
  ink: '#eafaff',
  sub: '#8fa6c2',
};

const ARENA_CLIP = 'polygon(6% 0, 94% 0, 100% 15%, 100% 85%, 94% 100%, 6% 100%, 0 85%, 0 15%)';

const f3 = (n) => Number(n.toFixed(3));
const mix = (a, b, x) => a + (b - a) * x;
const wave = (phase, k = 1, shift = 0) => Math.sin(TAU * phase * k + shift);

export default function ({ root, width, height }) {
  // 以 1920x1080 为基准等比缩放
  const u = Math.min(width / 1920, height / 1080);
  const px = (n) => `${f3(n * u)}px`;

  const style = document.createElement('style');
  style.textContent = `
    .mh-stage, .mh-stage * { box-sizing: border-box; }
    .mh-stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
    .mh-stage .mono { font-family: Consolas, 'Courier New', 'DejaVu Sans Mono', monospace; }
    .mh-stage .zh { font-family: 'Microsoft YaHei', 'Noto Sans SC', 'PingFang SC', sans-serif; }
    .mh-stage .abs { position: absolute; }
    .mh-stage .nowrap { white-space: nowrap; }
  `;
  document.head.append(style);

  const stage = document.createElement('div');
  stage.className = 'mh-stage';
  stage.style.cssText = `background:${CONFIG.bg};color:${CONFIG.ink}`;
  root.append(stage);

  const make = (tag, css, parent = stage, cls = '') => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    node.style.cssText = css;
    parent.append(node);
    return node;
  };

  // ---------- 底层氛围光 ----------
  const glowCyan = make('div', `
    left:${px(-300)};top:${px(120)};width:${px(1500)};height:${px(1100)};
    background:radial-gradient(ellipse at center, ${CONFIG.cyan}20 0%, ${CONFIG.cyan}08 42%, transparent 72%);
    filter:blur(${px(36)});will-change:transform;`, stage, 'abs');
  const glowPink = make('div', `
    right:${px(-260)};bottom:${px(-380)};width:${px(1400)};height:${px(1100)};
    background:radial-gradient(ellipse at center, ${CONFIG.pink}22 0%, ${CONFIG.violet}0c 44%, transparent 72%);
    filter:blur(${px(40)});will-change:transform;`, stage, 'abs');

  // ---------- 斜切擂台边框（复刻 game_loading_1.png 的青粉跑道） ----------
  const arena = make('div', `
    left:${px(300)};top:${px(190)};width:${px(1320)};height:${px(730)};
    transform-style:preserve-3d;will-change:transform;`, stage, 'abs');
  const arenaGlow = make('div', `
    position:absolute;inset:${px(-12)};clip-path:${ARENA_CLIP};
    background:linear-gradient(115deg, ${CONFIG.cyan}, ${CONFIG.pink}, ${CONFIG.violet}, ${CONFIG.cyan});
    filter:blur(${px(34)});opacity:.42;`, arena);
  const rim = make('div', `
    position:absolute;inset:0;padding:${px(5)};clip-path:${ARENA_CLIP};
    background:linear-gradient(115deg, ${CONFIG.cyan} 0%, ${CONFIG.pink} 28%, ${CONFIG.violet} 50%, ${CONFIG.cyan} 72%, ${CONFIG.pink} 100%);
    background-size:300% 300%;will-change:background-position;`, arena);
  make('div', `
    width:100%;height:100%;clip-path:${ARENA_CLIP};
    background:linear-gradient(160deg, ${CONFIG.bg}b3, #070d1ec4 55%, ${CONFIG.bg}cc);`, rim);
  // 地面网格必须放在擂台内部：放在 stage 层会被上面的实心内层整个盖住。
  // 跟随 arena 的 rotateX 得到俯视透视，clip-path 保证不溢出边框。
  const arenaFloor = make('div', `
    position:absolute;inset:0;clip-path:${ARENA_CLIP};opacity:.78;
    background-image:
      repeating-linear-gradient(0deg, ${CONFIG.cyan}52 0 ${px(1.5)}, transparent ${px(1.5)} ${px(96)}),
      repeating-linear-gradient(90deg, ${CONFIG.pink}40 0 ${px(1.5)}, transparent ${px(1.5)} ${px(96)});
    will-change:background-position;`, arena);
  // 边框内侧两条对角分割线，像原图那样把场地切成区块
  const diagA = make('div', `
    position:absolute;left:8%;top:12%;width:86%;height:${px(1.5)};
    background:linear-gradient(90deg,transparent,${CONFIG.cyan}66,transparent);
    transform-origin:0 50%;transform:rotate(19deg);opacity:.55;`, arena);
  const diagB = make('div', `
    position:absolute;left:4%;top:74%;width:90%;height:${px(1.5)};
    background:linear-gradient(90deg,transparent,${CONFIG.pink}66,transparent);
    transform-origin:0 50%;transform:rotate(-14deg);opacity:.5;`, arena);

  // ---------- 右侧雷达 / 扫描扇区 ----------
  const radar = make('div', `
    left:${px(1370)};top:${px(510)};width:${px(560)};height:${px(560)};
    transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;`, stage, 'abs');
  const radarRings = [0.98, 0.72, 0.46].map((scale, i) => make('div', `
    position:absolute;inset:${f3((1 - scale) * 50)}%;border:${px(1.5)} solid ${i === 1 ? CONFIG.pink : CONFIG.cyan};
    border-radius:50%;opacity:.28;will-change:transform,opacity;`, radar));
  const sweepSector = make('div', `
    position:absolute;inset:0;border-radius:50%;
    background:conic-gradient(from 0deg, transparent 0deg, ${CONFIG.cyan}05 6deg, ${CONFIG.cyan}55 30deg, transparent 62deg, transparent 360deg);
    will-change:transform;`, radar);
  const radarDot = make('div', `
    position:absolute;left:50%;top:50%;width:${px(10)};height:${px(10)};
    transform:translate(-50%,-50%);border-radius:50%;background:${CONFIG.cyan};
    box-shadow:0 0 ${px(24)} ${CONFIG.cyan};opacity:.6;`, radar);

  // ---------- 中央能量核心（低亮度，不抢 HTML 文案） ----------
  const core = make('div', `
    left:50%;top:${px(545)};width:${px(210)};height:${px(210)};
    transform:translate(-50%,-50%);border:${px(1.5)} solid ${CONFIG.cyan}55;
    border-radius:50%;opacity:.42;will-change:transform,opacity;`, stage, 'abs');
  const coreInner = make('div', `
    position:absolute;inset:${px(26)};border:${px(1)} dashed ${CONFIG.pink}88;
    border-radius:50%;will-change:transform;`, core);

  // ---------- 漂浮数据块 ----------
  const blocks = [];
  for (let i = 0; i < 30; i += 1) {
    const x = 90 + ((i * 397) % 1740);
    const y = 70 + ((i * 251) % 940);
    const w = 6 + (i % 5) * 9;
    const b = make('div', `
      left:${px(x)};top:${px(y)};width:${px(w)};height:${px(3 + (i % 3) * 2)};
      background:${i % 3 === 0 ? CONFIG.pink : CONFIG.cyan};
      opacity:.2;will-change:transform,opacity;`, stage, 'abs');
    blocks.push({ node: b, k: 1 + (i % 3), shift: i * 0.71 });
  }

  // ---------- 左右边缘刻度 ----------
  const ticks = [];
  for (const side of ['left', 'right']) {
    for (let i = 0; i < 14; i += 1) {
      const t = make('div', `
        ${side}:${px(34)};top:${px(120 + i * 62)};width:${px(14 + (i % 3) * 10)};height:${px(2)};
        background:${CONFIG.cyan};opacity:.3;will-change:opacity;`, stage, 'abs');
      ticks.push({ node: t, k: 1 + (i % 2), shift: i * 0.45 + (side === 'right' ? 1.2 : 0) });
    }
  }

  // ---------- 全屏扫光带 + 扫描线 ----------
  const scanBand = make('div', `
    left:0;right:0;top:-12%;height:${px(170)};opacity:0;mix-blend-mode:screen;
    background:linear-gradient(180deg,transparent,${CONFIG.cyan}14 42%,${CONFIG.cyan}4a 50%,${CONFIG.cyan}14 58%,transparent);
    will-change:top,opacity;`, stage, 'abs');
  const scanlines = make('div', `
    inset:0;pointer-events:none;opacity:.18;
    background:repeating-linear-gradient(0deg,#000 0 ${px(1)},transparent ${px(1)} ${px(4)});`, stage, 'abs');

  // ---------- 暗角：左侧、底部压暗，给 HTML 文案留干净底色 ----------
  make('div', `
    inset:0;pointer-events:none;
    background:
      linear-gradient(90deg,${CONFIG.bg}f2 0%,${CONFIG.bg}a0 26%,${CONFIG.bg}0f 52%,transparent 78%),
      linear-gradient(0deg,${CONFIG.bg}e0 0%,${CONFIG.bg}3d 18%,transparent 40%),
      radial-gradient(ellipse at 64% 44%,transparent 30%,${CONFIG.bg}8c 100%);`, stage, 'abs');

  // ---------- 顶部 HUD（在暗角之上，保持可读） ----------
  const hud = make('div', 'inset:0;pointer-events:none;', stage, 'abs');
  const hudLeft = make('div', `
    left:${px(126)};top:${px(46)};font-size:${px(18)};letter-spacing:${px(5)};
    color:${CONFIG.cyan};opacity:.72;`, hud, 'abs mono nowrap');
  hudLeft.textContent = 'SYSTEM // ARENA DEPLOYMENT';
  const hudRight = make('div', `
    right:${px(126)};top:${px(46)};font-size:${px(17)};letter-spacing:${px(4)};
    color:${CONFIG.sub};opacity:.7;`, hud, 'abs mono nowrap');
  hudRight.textContent = `${resolveVersion()}  //  LOADING ASSETS`;
  const track = make('div', `
    left:${px(126)};right:${px(126)};top:${px(92)};height:${px(2)};
    background:${CONFIG.cyan}22;`, hud, 'abs');
  const fill = make('div', `
    position:absolute;inset:0;transform-origin:0 50%;
    background:linear-gradient(90deg,${CONFIG.cyan},${CONFIG.pink});
    box-shadow:0 0 ${px(14)} ${CONFIG.cyan}88;will-change:transform;`, track);
  const bottomRight = make('div', `
    right:${px(126)};bottom:${px(52)};font-size:${px(16)};letter-spacing:${px(4)};
    color:${CONFIG.sub};opacity:.55;`, hud, 'abs mono nowrap');
  bottomRight.textContent = 'SYNC // STANDBY';

  return {
    prepareFrame(time) {
      const t = Math.max(0, time);
      const phase = (t % LOOP) / LOOP; // 0..1，4 秒一个完整周期

      // 网格 4 秒滚 2 个 84px 格距，与重复图案对齐，loop 无跳变
      arenaFloor.style.backgroundPosition = `0 ${f3(phase * 192)}px, ${f3(phase * 192)}px 0`;
      glowCyan.style.transform = `translate(${f3(wave(phase, 1) * 82)}px, ${f3(Math.cos(TAU * phase) * 48)}px)`;
      glowPink.style.transform = `translate(${f3(Math.cos(TAU * phase * 2) * -70)}px, ${f3(wave(phase, 2) * 42)}px)`;

      // 擂台边框：轻微俯仰呼吸 + 渐变沿边流动
      arena.style.transform = `perspective(${px(1500)}) rotateX(${f3(14 + wave(phase) * 1.1)}deg) rotateZ(${f3(-5 + wave(phase, 2) * 0.4)}deg)`;
      rim.style.backgroundPosition = `${f3(50 + 26 * wave(phase))}% 50%`;
      arenaGlow.style.opacity = f3(0.5 + 0.18 * (0.5 + 0.5 * wave(phase, 2)));
      diagA.style.opacity = f3(0.55 + 0.25 * (0.5 + 0.5 * wave(phase, 2)));
      diagB.style.opacity = f3(0.5 + 0.25 * (0.5 + 0.5 * wave(phase, 3, 1.1)));

      // 雷达扇区整圈旋转（phase=0 与 1 都是 0deg，无缝）
      sweepSector.style.transform = `rotate(${f3(phase * 360)}deg)`;
      radarRings.forEach((ring, i) => {
        const pulse = 0.5 + 0.5 * wave(phase, 1, i * 1.4);
        ring.style.opacity = f3(0.26 + 0.34 * pulse);
        ring.style.transform = `scale(${f3(0.97 + 0.045 * pulse)})`;
      });
      radarDot.style.opacity = f3(0.35 + 0.35 * (0.5 + 0.5 * wave(phase, 3)));

      core.style.opacity = f3(0.42 + 0.22 * (0.5 + 0.5 * wave(phase, 2)));
      core.style.transform = `translate(-50%,-50%) scale(${f3(1 + wave(phase, 2) * 0.03)})`;
      coreInner.style.transform = `rotate(${f3(phase * 360)}deg)`;

      blocks.forEach(({ node, k, shift }) => {
        node.style.opacity = f3(0.16 + 0.5 * (0.5 + 0.5 * wave(phase, k, shift)));
        node.style.transform = `translateY(${f3(wave(phase, k, shift) * 10)}px)`;
      });
      ticks.forEach(({ node, k, shift }) => {
        node.style.opacity = f3(0.16 + 0.42 * (0.5 + 0.5 * wave(phase, k, shift)));
      });

      // 线性扫光：两端 opacity 归零，位置跳回时不可见
      scanBand.style.top = `${f3(mix(-12, 100, phase))}%`;
      scanBand.style.opacity = f3(Math.sin(phase * Math.PI) * 0.72);

      fill.style.transform = `scaleX(${f3(0.38 + 0.3 * wave(phase))})`;
      hudLeft.style.opacity = f3(0.62 + 0.16 * wave(phase, 2));
      hudRight.style.opacity = f3(0.58 + 0.14 * wave(phase, 2, 0.8));
    },

    dispose() {
      stage.remove();
      style.remove();
    },
  };
}
