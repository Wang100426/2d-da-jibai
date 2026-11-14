/**
 * 2D大击败 / 2DFight Arena — 赛博风开场动画
 *
 * Standard scene。所有视觉状态都是 prepareFrame(time) 的纯函数：
 * 不使用 CSS animation / transition / Math.random，因此 seek、倒放、跳帧
 * 都会得到完全一致的画面，导出逐帧渲染才不会闪。
 *
 * 改动画只需要动 CONFIG（文案、配色、尺寸）和 TIMELINE（时间点，单位秒）。
 * 版本号不在这里：由 scripts/sync-version.mjs 从游戏 package.json 同步，或由宿主注入。
 * assets/logo.png 来自 D:\code\2d-da-jibai\static\2d_da_jibai_logo.png（1254x1254 RGBA）。
 */

import { resolveVersion } from './version.mjs';

const CONFIG = {
  bg: '#080b13',
  cyan: '#49e6e0',
  pink: '#ff4fa3',
  violet: '#8867ff',
  ink: '#eafaff',
  sub: '#a7bcd4',
  logoSize: 620, // 逻辑像素，基准画布 1920x1080
  words: [
    ['NEON RUINS', '霓虹废墟'],
    ['OVERCLOCK', '超频协议'],
    ['WAVE PROTOCOL', '敌潮来袭'],
    ['ARENA ONLINE', '竞技场已连接'],
  ],
  subtitle: '2DFIGHT ARENA',
  tagline: '霓虹废墟 · 迎战敌潮',
  press: 'PRESS START',
};

// 片头健康游戏忠告：白底 + 发行公司图标 + 6 字 × 8 行公约（复刻 2.0.0 启动画面）
// 占用前 3 秒，其后赛博动画整体后移 COMPLIANCE.duration 秒，总时长见 mh.json
const COMPLIANCE = {
  duration: 3.0,
  iconSize: 260,
  lines: [
    '抵制不良游戏', '拒绝盗版游戏', '注意自我保护', '谨防受骗上当',
    '适度游戏益脑', '沉迷游戏伤身', '合理安排时间', '享受健康生活',
  ],
};

// 全部时间点为绝对项目秒，见 mh.json 的 duration
const TIMELINE = {
  boot: [0.00, 0.55],
  words: [0.45, 1.70],
  logo: [1.05, 2.35],
  sweep: [2.10, 2.80],
  letters: [2.05, 3.10],
  tagline: [2.70, 3.35],
  outro: [4.65, 5.35],
  press: [5.20, 5.65],
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const outCubic = (x) => 1 - Math.pow(1 - x, 3);
const inOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mix = (a, b, x) => a + (b - a) * x;
const f3 = (n) => Number(n.toFixed(3));

export default function ({ root, width, height }) {
  // 以 1920x1080 为基准等比缩放，改 mh.json 分辨率后布局仍然成立
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
    inset:0;overflow:hidden;opacity:.85;
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
    color:${CONFIG.cyan};text-shadow:0 0 ${px(18)} ${CONFIG.cyan}88;`, hud, 'abs mono nowrap');
  topLeft.textContent = 'SYS // 2DFIGHT ARENA';
  const topRight = make('div', `
    right:${px(126)};top:${px(58)};font-size:${px(19)};letter-spacing:${px(4)};
    color:${CONFIG.sub};`, hud, 'abs mono nowrap');
  // 版本号在 scene 初始化时解析一次并固定，不随时间变化（seek / 跳帧一致）
  topRight.textContent = `${resolveVersion()}  //  60 FPS`;

  const track = make('div', `
    left:${px(126)};right:${px(126)};top:${px(104)};height:${px(2)};
    background:${CONFIG.cyan}26;`, hud, 'abs');
  const fill = make('div', `
    position:absolute;inset:0;background:linear-gradient(90deg, ${CONFIG.cyan}, ${CONFIG.pink});
    box-shadow:0 0 ${px(16)} ${CONFIG.cyan}aa;transform-origin:0 50%;transform:scaleX(0);`, track);
  const bottomLeft = make('div', `
    left:${px(126)};bottom:${px(62)};font-size:${px(17)};letter-spacing:${px(4)};
    color:${CONFIG.sub};`, hud, 'abs mono nowrap');
  const bottomRight = make('div', `
    right:${px(126)};bottom:${px(62)};font-size:${px(17)};letter-spacing:${px(4)};
    color:${CONFIG.cyan};`, hud, 'abs mono nowrap');
  bottomRight.textContent = 'NEON CITY // SECTOR 07';

  // ---------- 左侧赛博关键词 ----------
  const wordList = make('div', `left:${px(126)};top:${px(290)};width:${px(480)};`, stage, 'abs');
  const wordRows = CONFIG.words.map(([en, zh], i) => {
    const row = make('div', `
      position:relative;margin-bottom:${px(34)};padding-left:${px(24)};
      border-left:2px solid ${CONFIG.cyan}66;will-change:transform,opacity;`, wordList);
    const idx = make('div', `
      font-size:${px(15)};letter-spacing:${px(3)};color:${CONFIG.pink};opacity:.9;`, row, 'mono');
    idx.textContent = `0${i + 1} /`;
    const enEl = make('div', `
      margin-top:${px(6)};font-size:${px(31)};font-weight:700;letter-spacing:${px(4)};
      color:${CONFIG.ink};text-shadow:0 0 ${px(22)} ${CONFIG.cyan}55;`, row, 'mono nowrap');
    enEl.textContent = en;
    const zhEl = make('div', `
      margin-top:${px(7)};font-size:${px(17)};letter-spacing:${px(6)};color:${CONFIG.sub};`, row, 'zh');
    zhEl.textContent = zh;
    const bar = make('div', `
      margin-top:${px(12)};height:${px(2)};width:${px(360)};
      background:linear-gradient(90deg, ${CONFIG.cyan}, transparent);
      transform-origin:0 50%;transform:scaleX(0);`, row);
    return { row, bar };
  });

  // ---------- 中心 logo 与副标 ----------
  const center = make('div', `left:50%;top:${px(470)};`, stage, 'abs');
  const logoWrap = make('div', `
    position:absolute;left:0;top:0;width:${px(CONFIG.logoSize)};height:${px(CONFIG.logoSize)};
    transform:translate(-50%,-50%);will-change:transform,opacity,filter;`, center);
  const logo = make('img', `
    display:block;width:100%;height:100%;object-fit:contain;
    -webkit-user-drag:none;user-select:none;`, logoWrap);
  logo.src = new URL('../assets/logo.png', import.meta.url).href;
  logo.alt = '2D大击败';

  const sweep = make('div', `
    position:absolute;left:-25%;top:0;width:${px(150)};height:100%;
    background:linear-gradient(90deg, transparent, ${CONFIG.cyan}cc, #ffffffcc, ${CONFIG.cyan}cc, transparent);
    filter:blur(${px(12)});mix-blend-mode:screen;transform:skewX(-18deg);opacity:0;`, logoWrap);

  const subWrap = make('div', `
    position:absolute;left:0;top:${px(350)};transform:translate(-50%,0);text-align:center;`, center);
  const lettersBox = make('div', `
    display:flex;justify-content:center;gap:${px(3)};
    font-size:${px(47)};font-weight:700;letter-spacing:${px(10)};
    color:${CONFIG.ink};text-shadow:0 0 ${px(26)} ${CONFIG.cyan}66;`, subWrap, 'mono nowrap');
  const letters = [...CONFIG.subtitle].map((ch) => {
    const s = make('span', 'display:inline-block;will-change:transform,opacity;', lettersBox);
    s.textContent = ch === ' ' ? '\u00a0' : ch;
    return s;
  });
  const divider = make('div', `
    margin:${px(20)} auto 0;width:${px(460)};height:${px(2)};
    background:linear-gradient(90deg, transparent, ${CONFIG.cyan}, ${CONFIG.pink}, transparent);
    box-shadow:0 0 ${px(10)} ${CONFIG.cyan}88;
    transform-origin:50% 50%;transform:scaleX(0);`, subWrap);
  const tagline = make('div', `
    margin-top:${px(18)};font-size:${px(21)};letter-spacing:${px(10)};
    color:${CONFIG.sub};opacity:0;`, subWrap, 'zh nowrap');
  tagline.textContent = CONFIG.tagline;

  // ---------- 收束光带与尾帧 ----------
  const flash = make('div', `
    left:-70%;top:0;width:${px(420)};height:100%;pointer-events:none;
    background:linear-gradient(90deg, transparent, ${CONFIG.cyan}55, #ffffffaa, ${CONFIG.cyan}55, transparent);
    filter:blur(${px(24)});mix-blend-mode:screen;transform:skewX(-16deg);opacity:0;`, stage, 'abs');
  const pressEl = make('div', `
    left:50%;bottom:${px(70)};transform:translateX(-50%);
    font-size:${px(23)};letter-spacing:${px(11)};color:${CONFIG.cyan};
    text-shadow:0 0 ${px(24)} ${CONFIG.cyan}88;opacity:0;`, stage, 'abs mono nowrap');
  pressEl.textContent = CONFIG.press;

  // ---------- 片头健康游戏忠告（盖在赛博画面之上，3 秒后淡出） ----------
  const compliance = make('div', `
    inset:0;z-index:80;background:#fff;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:${px(44)};`, stage, 'abs');
  const complianceIcon = make('img', `
    display:block;width:${px(COMPLIANCE.iconSize)};height:${px(COMPLIANCE.iconSize)};
    object-fit:contain;opacity:0;will-change:transform,opacity;`, compliance);
  complianceIcon.src = new URL('../assets/gamecom.png', import.meta.url).href;
  complianceIcon.alt = '发行公司';
  const rules = make('div', `
    display:flex;flex-direction:column;gap:${px(6)};color:#3a3f52;`, compliance, 'zh');
  const ruleRows = COMPLIANCE.lines.map((line) => {
    const row = make('div', `
      font-size:${px(36)};letter-spacing:${px(9)};line-height:1.6;text-align:center;
      opacity:0;will-change:transform,opacity;`, rules);
    row.textContent = line;
    return row;
  });

  return {
    prepareFrame(time) {
      const t = Math.max(0, time - COMPLIANCE.duration);

      // 背景：连续滚动的透视网格 + 李萨如漂移的光斑（无跳变）
      grid.style.backgroundPosition = `0 ${f3(t * 78)}px, ${f3(t * 26)}px 0`;
      glowCyan.style.transform = `translate(${f3(Math.sin(t * 0.31) * 110)}px, ${f3(Math.cos(t * 0.24) * 70)}px)`;
      glowPink.style.transform = `translate(${f3(Math.cos(t * 0.22) * -90)}px, ${f3(Math.sin(t * 0.29) * 60)}px)`;

      // HUD
      const boot = outCubic(seg(t, ...TIMELINE.boot));
      for (const c of corners) {
        c.style.opacity = f3(0.75 * boot);
        c.style.transform = `scale(${f3(mix(0.6, 1, boot))})`;
      }
      topLeft.style.opacity = f3(boot);
      topRight.style.opacity = f3(boot);
      bottomRight.style.opacity = f3(boot * (1 - seg(t, ...TIMELINE.outro)));
      const load = seg(t, 0, 5.2);
      fill.style.transform = `scaleX(${f3(load)})`;
      bottomLeft.textContent = `LOADING ARENA  //  ${String(Math.floor(load * 100)).padStart(3, '0')}%`;
      bottomLeft.style.opacity = f3(boot * (1 - seg(t, ...TIMELINE.outro)));

      // 关键词：错峰滑入 + 入场瞬间的轻微色差抖动，收束时整体淡出
      const wordFade = 1 - seg(t, TIMELINE.outro[0], TIMELINE.outro[0] + 0.5);
      wordRows.forEach(({ row, bar }, i) => {
        const delay = i * 0.16;
        const start = TIMELINE.words[0] + delay;
        const p = outExpo(seg(t, start, start + 0.62));
        const glitch = (1 - p) * Math.sin((t + i * 0.37) * 92) * 7;
        const drift = Math.sin(t * 0.65 + i * 0.8) * 2.5;
        row.style.opacity = f3(p * wordFade);
        row.style.transform = `translateX(${f3(mix(-80, 0, p) + glitch + drift)}px)`;
        bar.style.transform = `scaleX(${f3(outCubic(seg(t, start + 0.12, start + 0.66)) * wordFade)})`;
      });

      // Logo：expo 缩放 + 模糊/色差收敛，之后极慢呼吸；收束时轻微回缩
      const lp = outExpo(seg(t, ...TIMELINE.logo));
      const outro = inOutCubic(seg(t, ...TIMELINE.outro));
      const breath = Math.sin(Math.max(0, t - TIMELINE.logo[1]) * 1.05) * 0.009;
      const scale = mix(0.86, 1, lp) * (1 + breath) * mix(1, 0.94, outro);
      const lift = mix(52, 0, lp) - outro * 12;
      logoWrap.style.opacity = f3(seg(t, TIMELINE.logo[0], TIMELINE.logo[0] + 0.45));
      logoWrap.style.transform = `translate(-50%,-50%) scale(${f3(scale)}) translateY(${f3(lift)}px)`;
      const chroma = (1 - lp) * 16;
      logo.style.filter =
        `blur(${f3((1 - lp) * 9)}px) ` +
        `drop-shadow(${f3(chroma)}px 0 ${f3(mix(8, 30, lp))}px ${CONFIG.pink}bb) ` +
        `drop-shadow(${f3(-chroma)}px 0 ${f3(mix(8, 30, lp))}px ${CONFIG.cyan}bb)`;

      // 横向光带扫过 logo
      const sw = seg(t, ...TIMELINE.sweep);
      sweep.style.opacity = f3(Math.sin(sw * Math.PI) * 0.85);
      sweep.style.left = `${f3(mix(-25, 105, sw))}%`;

      // 副标逐字展开
      letters.forEach((s, i) => {
        const start = TIMELINE.letters[0] + i * 0.045;
        const p = outCubic(seg(t, start, start + 0.38));
        s.style.opacity = f3(p);
        s.style.transform = `translateY(${f3(mix(26, 0, p))}px)`;
      });
      const tagP = outCubic(seg(t, ...TIMELINE.tagline));
      divider.style.transform = `scaleX(${f3(tagP)})`;
      tagline.style.opacity = f3(tagP);
      tagline.style.transform = `translateY(${f3(mix(14, 0, tagP))}px)`;

      // 收束闪光与尾帧提示（不淡出到黑，方便直接接主菜单）
      const fl = seg(t, 4.95, 5.08) * (1 - seg(t, 5.08, 5.34));
      flash.style.opacity = f3(fl * 0.7);
      flash.style.left = `${f3(mix(-70, 130, seg(t, 4.9, 5.35)))}%`;
      const pp = seg(t, ...TIMELINE.press);
      pressEl.style.opacity = f3(pp * (0.55 + 0.45 * Math.abs(Math.sin(t * 4.2))));

      // 片头忠告用绝对 time 驱动（不受上面的后移影响），每帧全量赋值保证 seek 一致
      compliance.style.opacity = f3(1 - seg(time, 2.6, COMPLIANCE.duration));
      const iconP = outCubic(seg(time, 0.10, 0.90));
      complianceIcon.style.opacity = f3(iconP);
      complianceIcon.style.transform =
        `translateY(${f3(mix(14, 0, iconP))}px) scale(${f3(mix(0.96, 1, iconP))})`;
      ruleRows.forEach((row, i) => {
        const start = 0.55 + i * 0.09;
        const p = outCubic(seg(time, start, start + 0.4));
        row.style.opacity = f3(p);
        row.style.transform = `translateY(${f3(mix(10, 0, p))}px)`;
      });
    },

    dispose() {
      stage.remove();
      style.remove();
    },
  };
}
