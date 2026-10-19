/**
 * 页面离场过场（1.7.5）：
 * 拦截站内链接点击 → body 加 .leaving 淡出 → 再执行跳转。
 * 外链、下载、新标签页、锚点、右键/组合键不拦截。
 * 尊重 prefers-reduced-motion：用户偏好减少动画时直接跳转。
 */
(function () {
  'use strict';

  var LEAVE_MS = 170;

  function reducedMotion() {
    return window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isInternalNavigation(link) {
    if (link.target && link.target !== '_self') return false;
    if (link.hasAttribute('download')) return false;
    if (link.hasAttribute('data-no-transition')) return false;
    var href = link.getAttribute('href');
    if (!href || href === '#' || href.charAt(0) === '#') return false;
    if (/^(javascript|mailto|tel):/i.test(href)) return false;
    if (/^https?:\/\//i.test(href) && link.hostname !== location.hostname) return false;
    return true;
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var link = event.target.closest ? event.target.closest('a') : null;
    if (!link || !isInternalNavigation(link)) return;
    if (document.body.classList.contains('leaving')) {
      event.preventDefault();
      return;
    }
    if (reducedMotion()) return;

    event.preventDefault();
    document.body.classList.add('leaving');
    window.setTimeout(function () {
      window.location.href = link.href;
    }, LEAVE_MS);
  }, true);

  // 页面从历史缓存（后退）恢复时清掉 leaving，避免白屏
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) document.body.classList.remove('leaving');
  });
})();
