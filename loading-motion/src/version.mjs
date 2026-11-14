/**
 * 版本号解析（纯函数，不触碰 DOM）。
 *
 * 优先级：
 *   1. window.__2DFIGHT_VERSION__       —— 宿主（游戏 / Electron）启动时注入
 *   2. URL 查询参数 ?version=3.0.0     —— 以网页方式播放时覆盖
 *   3. src/game-meta.mjs               —— scripts/sync-version.mjs 从游戏 package.json 同步
 *   4. 'BUILD // UNLINKED'             —— 三者都缺失时的占位，绝不写死某个版本
 *
 * 结果只在 scene 初始化时解析一次并固定下来；prepareFrame(time) 仍是绝对时间的
 * 纯函数，seek、倒放、跳帧、逐帧导出得到完全一致的画面。
 */
import meta from './game-meta.mjs';

const clean = (v) => String(v ?? '').trim();

export function versionOverride() {
  const g = globalThis;
  const injected = clean(g.__2DFIGHT_VERSION__);
  if (injected) return injected;
  try {
    const fromUrl = clean(new URLSearchParams(g.location?.search ?? '').get('version'));
    if (fromUrl) return fromUrl;
  } catch {
    // Node / 非浏览器环境没有 location，忽略
  }
  return '';
}

export function resolveVersion(override = versionOverride()) {
  const raw = clean(override) || clean(meta.version);
  if (!raw) return 'BUILD // UNLINKED';
  // 宿主给 'v3.0.0' 或 '3.0.0' 都能正常显示
  return /^v\d/i.test(raw) ? raw : `v${raw}`;
}
