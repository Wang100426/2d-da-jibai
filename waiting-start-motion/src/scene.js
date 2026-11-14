/**
 * 2D大击败 / 2DFight Arena — 等待进入的待机动画（4 秒无缝循环）
 *
 * 接在开场动画之后循环播放，玩家按空格 / 点击进入主页。
 * 所有视觉状态都是 prepareFrame(time) 的纯函数，且每个周期都整除 LOOP，
 * 因此 t=0 与 t=LOOP 画面一致，loop 播放不会跳帧。
 * 版本号由 scripts/sync-version.mjs 从游戏 package.json 同步，或由宿主注入。
 */

import { resolveVersion } from './version.mjs';

const LOOP = 4;
const TAU = Math.PI * 2;

const CONFIG = {
  bg: '#080b13',
  cyan: '#49e6e0',
  pink: '#ff4fa3',
  violet: '#8867ff',
  ink: '#eafaff',
  sub: '#a7bcd4',
  logoSize: 500,
  subtitle: '2DFIGHT ARENA',
  tagline: '霓虹废墟 · 迎战敌潮',
  press: 'PRESS START',
  hint: 'SPACE / CLICK TO ENTER',
  hintZh: '按空格键或点击进入',
};

const f3 = (n) => Number(n.toFixed(3));
const mix = (a, b, x) => a + (b - a) * x;

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

  // ---------- 背景 ----------
  const glowCyan = make('div', `
    left:${px(-260)};top:${px(-320)};width:${px(1500)};height:${px(1200)};
    background:radial-gradient(ellipse at center, ${CONFIG.cyan}2b 0%, ${CONFIG.cyan}0d 40%, transparent 72%);
    filter:blur(${px(30)});will-change:transform;`, stage, 'abs');
  const glowPink = make('div', `
    right:${px(-300)};bottom:${px(-420)};width:${px(1500)};height:${px(1300)};
    background:radial-gradient(ellipse at center, ${CONFIG.pink}26 0%, ${CONFIG.violet}12 42%, transparent 72%);
    filter:blur(${px(36)});will-change:transform;`, stage, 'abs');

  const gridWrap = make('div', `
    inset:0;overflow:hidden;opacity:.8;
    -webkit-mask-image:linear-gradient(180deg, transparent 0%, #000 24%, #000 76%, transparent 100%);
    mask-image:linear-gradient(180deg, transparent 0%, #000 24%, #000 76%, transparent 100%);`, stage, 'abs');
  const grid = make('div', `
    position:absolute;inset:-10% 0 0 0;
    background-image:
      repeating-linear-gradient(0deg, ${CONFIG.cyan}40 0 ${px(1.5)}, transparent ${px(1.5)} ${px(76)}),
      repeating-linear-gradient(90deg, ${CONFIG.cyan}26 0 ${px(1.5)}, transparent ${px(1.5)} ${px(76)});
    will-change:background-position;`, gridWrap);
  const scan = make('div', `
    inset:0;pointer-events:none;opacity:.16;
    background:repeating-linear-gradient(0deg, #000000 0 ${px(1)}, transparent ${px(1)} ${px(4)});`, stage, 'abs');
  const vignette = make('div', `
    inset:0;pointer-events:none;
    background:radial-gradient(ellipse at 50% 46%, transparent 32%, #03050bd9 100%);`, stage, 'abs');

  // ---------- HUD ----------
  const hud = make('div', 'inset:0;pointer-events:none;', stage, 'abs');
  const corners = [
    `left:${px(58)};top:${px(52)};border-left:2px solid ${CONFIG.cyan};border-top:2px solid ${CONFIG.cyan};`,
    `right:${px(58)};top:${px(52)};border-right:2px solid ${CONFIG.cyan};border-top:2px solid ${CONFIG.cyan};`,
    `left:${px(58)};bottom:${px(52)};border-left:2px solid ${CONFIG.cyan};border-bottom:2px solid ${CONFIG.cyan};`,
    `right:${px(58)};bottom:${px(52)};border-right:2px solid ${CONFIG.cyan};border-bottom:2px solid ${CONFIG.cyan};`,
  ].map((css) => make('div', `${css}width:${px(46)};height:${px(46)};opacity:.75;`, hud, 'abs'));

  const topLeft = make('div', `
    left:${px(126)};top:${px(58)};font-size:${px(19)};letter-spacing:${px(5)};
    color:${CONFIG.cyan};text-shadow:0 0 ${px(18)} ${CONFIG.cyan}88;opacity:.9;`, hud, 'abs mono nowrap');
  topLeft.textContent = 'SYS // 2DFIGHT ARENA';
  const topRight = make('div', `
    right:${px(126)};top:${px(58)};font-size:${px(19)};letter-spacing:${px(4)};
    color:${CONFIG.sub};opacity:.9;`, hud, 'abs mono nowrap');
  topRight.textContent = `${resolveVersion()}  //  60 FPS`;

  const track = make('div', `
    left:${px(126)};right:${px(126)};top:${px(104)};height:${px(2)};
    background:${CONFIG.cyan}26;`, hud, 'abs');
  const fill = make('div', `
    position:absolute;inset:0;background:linear-gradient(90deg, ${CONFIG.cyan}, ${CONFIG.pink});
    box-shadow:0 0 ${px(16)} ${CONFIG.cyan}aa;transform-origin:0 50%;transform:scaleX(1);`, track);
  const bottomLeft = make('div', `
    left:${px(126)};bottom:${px(62)};font-size:${px(17)};letter-spacing:${px(4)};
    color:${CONFIG.sub};opacity:.8;`, hud, 'abs mono nowrap');
  bottomLeft.textContent = 'SYSTEM READY  //  AWAITING INPUT';
  const bottomRight = make('div', `
    right:${px(126)};bottom:${px(62)};font-size:${px(17)};letter-spacing:${px(4)};
    color:${CONFIG.cyan};opacity:.8;`, hud, 'abs mono nowrap');
  bottomRight.textContent = 'NEON CITY // SECTOR 07';

  // ---------- 中心 logo 与副标 ----------
  const center = make('div', `left:50%;top:${px(440)};`, stage, 'abs');
  const logoWrap = make('div', `
    position:absolute;left:0;top:0;width:${px(CONFIG.logoSize)};height:${px(CONFIG.logoSize)};
    transform:translate(-50%,-50%);will-change:transform;`, center);
  const logo = make('img', `
    display:block;width:100%;height:100%;object-fit:contain;
    -webkit-user-drag:none;user-select:none;will-change:filter;`, logoWrap);
  logo.src = new URL('../assets/logo.png', import.meta.url).href;
  logo.alt = '2D大击败';

  const sweep = make('div', `
    position:absolute;left:-25%;top:0;width:${px(150)};height:100%;
    background:linear-gradient(90deg, transparent, ${CONFIG.cyan}cc, #ffffffcc, ${CONFIG.cyan}cc, transparent);
    filter:blur(${px(24)});mix-blend-mode:screen;transform:skewX(-18deg);opacity:0;`, logoWrap);

  const subWrap = make('div', `
    position:absolute;left:0;top:${px(285)};transform:translate(-50%,0);text-align:center;`, center);
  const letters = make('div', `
    font-size:${px(47)};font-weight:700;letter-spacing:${px(10)};
    color:${CONFIG.ink};text-shadow:0 0 ${px(26)} ${CONFIG.cyan}66;`, subWrap, 'mono nowrap');
  letters.textContent = CONFIG.subtitle;
  const divider = make('div', `
    margin:${px(20)} auto 0;width:${px(460)};height:${px(2)};
    background:linear-gradient(90deg, transparent, ${CONFIG.cyan}, ${CONFIG.pink}, transparent);
    box-shadow:0 0 ${px(10)} ${CONFIG.cyan}88;`, subWrap);
  const tagline = make('div', `
    margin-top:${px(18)};font-size:${px(21)};letter-spacing:${px(10)};
    color:${CONFIG.sub};`, subWrap, 'zh nowrap');
  tagline.textContent = CONFIG.tagline;

  // ---------- 待机提示 ----------
  const pressEl = make('div', `
    left:50%;bottom:${px(150)};transform:translateX(-50%);
    font-size:${px(30)};letter-spacing:${px(13)};color:${CONFIG.cyan};
    text-shadow:0 0 ${px(26)} ${CONFIG.cyan}99;opacity:1;`, stage, 'abs mono nowrap');
  pressEl.textContent = CONFIG.press;
  const hintEl = make('div', `
    left:50%;bottom:${px(86)};transform:translateX(-50%);text-align:center;`, stage, 'abs');
  const hintEn = make('div', `
    font-size:${px(16)};letter-spacing:${px(6)};color:${CONFIG.sub};`, hintEl, 'mono nowrap');
  hintEn.textContent = CONFIG.hint;
  const hintZh = make('div', `
    margin-top:${px(8)};font-size:${px(16)};letter-spacing:${px(5)};color:${CONFIG.sub};`, hintEl, 'zh nowrap');
  hintZh.textContent = CONFIG.hintZh;

  return {
    prepareFrame(time) {
      const t = Math.max(0, time);
      const phase = (t % LOOP) / LOOP; // 0..1，LOOP 秒一个完整周期

      // 网格 4 秒滚 2 个 76px 格距，首尾与重复图案对齐，loop 无跳变
      grid.style.backgroundPosition = `0 ${f3(phase * 152)}px, ${f3(-phase * 152)}px 0`;
      glowCyan.style.transform =
        `translate(${f3(Math.sin(TAU * phase * 2) * 95)}px, ${f3(Math.cos(TAU * phase * 2) * 60)}px)`;
      glowPink.style.transform =
        `translate(${f3(Math.cos(TAU * phase) * -85)}px, ${f3(Math.sin(TAU * phase) * 55)}px)`;

      // HUD 角标轻微呼吸
      corners.forEach((c, i) => {
        c.style.opacity = f3(0.62 + 0.16 * Math.sin(TAU * phase * 2 + i * 0.4));
      });

      // Logo 呼吸 + 光晕脉动
      const breath = Math.sin(TAU * phase * 2) * 0.012;
      logoWrap.style.transform = `translate(-50%,-50%) scale(${f3(1 + breath)})`;
      logo.style.filter = `drop-shadow(0 0 ${f3(20 + 8 * Math.sin(TAU * phase * 2))}px ${CONFIG.cyan}55)`;

      // 线性扫光：opacity 两端为 0，位置从右跳回左时恰好不可见
      const sw = phase;
      sweep.style.opacity = f3(Math.sin(sw * Math.PI) * 0.42);
      sweep.style.left = `${f3(mix(-25, 105, sw))}%`;

      // PRESS START 呼吸闪烁（4 秒内 4 次），提示行缓慢明暗
      const blink = 0.5 + 0.5 * Math.abs(Math.sin(TAU * phase * 2));
      pressEl.style.opacity = f3(0.3 + 0.7 * blink);
      pressEl.style.transform =
        `translateX(-50%) translateY(${f3(Math.sin(TAU * phase * 2) * 3)}px)`;
      hintEl.style.opacity = f3(0.62 + 0.28 * Math.sin(TAU * phase));
    },

    dispose() {
      stage.remove();
      style.remove();
    },
  };
}
