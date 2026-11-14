/**
 * 战场过场背景视频（2.8.2）：把 .map-transition 的静态图升级为
 * loading-motion 工程的 4 秒无缝循环 MP4。
 *
 * 降级策略（任一命中都直接退回 game_loading_1.png，绝不卡住战斗）：
 *   - 用户偏好减少动效
 *   - 视频不存在 / 解码失败 / 自动播放被浏览器拦截
 * 过场开始淡出时暂停视频，省掉后台解码开销。
 */
(() => {
  'use strict';
  const video = document.getElementById('map-transition-video');
  const overlay = document.getElementById('map-transition');
  if (!video || !overlay) return;

  let failed = false;
  const giveUp = () => {
    if (failed) return;
    failed = true;
    video.classList.remove('is-ready');
    video.hidden = true;
    video.pause();
    video.removeAttribute('src');
    try { video.load(); } catch (error) { /* 忽略：静态图已在下层 */ }
  };

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    giveUp();
    return;
  }

  video.addEventListener('error', giveUp);
  video.addEventListener('canplay', () => video.classList.add('is-ready'), { once: true });
  overlay.addEventListener('animationstart', (event) => {
    if (event.target === overlay && event.animationName === 'map-transition-out') video.pause();
  });

  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  video.src = "/static/intro/loading.mp4";
  const pending = video.play();
  // 自动播放被拦截时保持 opacity:0，静态图继续兜底
  if (pending && typeof pending.catch === 'function') pending.catch(() => {});
})();
