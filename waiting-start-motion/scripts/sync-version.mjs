#!/usr/bin/env node
/**
 * 把《2D大击败》的真实版本号同步进本动画工程，避免动画源码里写死版本。
 *
 *   node scripts/sync-version.mjs
 *   GAME_PACKAGE=/path/to/package.json node scripts/sync-version.mjs
 *   npm run sync:version
 *
 * 真值源是游戏 package.json 的 version 字段（游戏 README 明确要求版本只维护在这里）。
 * 本脚本生成 src/game-meta.mjs；scene 再通过 src/version.mjs 的 resolveVersion() 读取。
 * 输出内容只有真值源和版本变化时才改变，重复运行不会触发无意义的重新构建。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
// 本工程位于 <游戏仓库>/waiting-start-motion/，真值源就是上一级目录的 package.json。
// 用相对路径：整个仓库换位置或被 clone 后不用改代码；GAME_PACKAGE 可显式覆盖。
const gamePackage = resolve(process.env.GAME_PACKAGE || resolve(projectRoot, '../package.json'));
const output = resolve(projectRoot, 'src/game-meta.mjs');

let pkg;
try {
  pkg = JSON.parse(readFileSync(gamePackage, 'utf8'));
} catch (err) {
  console.error(`[sync-version] 读不到游戏 package.json：${gamePackage}\n${err.message}`);
  process.exit(1);
}

const version = String(pkg.version ?? '').trim();
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.]+)?$/.test(version)) {
  console.error(`[sync-version] version 字段无效：${JSON.stringify(version)} (${gamePackage})`);
  process.exit(1);
}

const source = gamePackage.replace(/\\/g, '/');
const content = `// 由 scripts/sync-version.mjs 生成，请勿手改。
// 真值源：${source}
// 运行时可用 window.__2DFIGHT_VERSION__ 或 ?version= 覆盖，见 src/version.mjs
export default {
  version: ${JSON.stringify(version)},
  source: ${JSON.stringify(source)},
};
`;

if (existsSync(output) && readFileSync(output, 'utf8') === content) {
  console.log(`[sync-version] 已是最新：${version}（真值源 ${source}）`);
} else {
  writeFileSync(output, content, 'utf8');
  console.log(`[sync-version] ${pkg.name || 'game'} ${version} -> ${output}（真值源 ${source}）`);
}
