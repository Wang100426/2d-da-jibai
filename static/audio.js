/**
 * 全局音频开关（2.3.2）：
 * - 统一管理「同一时间只播一条」的短音频（目前是英雄展示语音）
 * - 静音状态存在 localStorage，跨页面/刷新保持
 * - 所有带 data-audio-toggle 的按钮自动绑定，aria-pressed 与图标状态自动同步
 * - 外部停止（或切到静音）会派发 gameaudio:stop 事件，让各页面复位自己的播放态
 *
 * 用法：
 *   var audio = GameAudio.play('/static/voices/tech.mp3');
 *   if (!audio) { /* 静音中或播放被拒 *\/ }
 *   GameAudio.setMuted(true);
 */
(function () {
  'use strict';

  var STORAGE_KEY = '2d-da-jibai-muted';
  var muted = false;
  var current = null;

  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (error) {
    muted = false;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch (error) {
      /* 隐私模式下写不进去，忽略即可 */
    }
  }

  function emitStop() {
    document.dispatchEvent(new CustomEvent('gameaudio:stop'));
  }

  /** 内部停止：不发事件，供 play() 开头复用。 */
  function halt() {
    if (!current) return;
    try {
      current.pause();
      current.currentTime = 0;
    } catch (error) {
      /* 某些浏览器对未加载完成的音频会抛，忽略 */
    }
    current = null;
  }

  function syncToggles() {
    var buttons = document.querySelectorAll('[data-audio-toggle]');
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      button.setAttribute('aria-pressed', muted ? 'true' : 'false');
      if (muted) button.classList.add('muted');
      else button.classList.remove('muted');
      var label = muted ? button.getAttribute('data-label-muted') : button.getAttribute('data-label-audible');
      if (label) button.setAttribute('title', label);
      if (label) button.setAttribute('aria-label', label);
    }
  }

  function stop() {
    var had = Boolean(current);
    halt();
    if (had) emitStop();
  }

  function setMuted(next) {
    var value = Boolean(next);
    if (value === muted) {
      syncToggles();
      return;
    }
    muted = value;
    persist();
    if (muted) stop();
    syncToggles();
  }

  function play(src) {
    if (!src) return null;
    halt();
    if (muted) {
      emitStop();
      return null;
    }
    var audio = new Audio(src);
    current = audio;
    audio.addEventListener('ended', function () {
      if (current === audio) current = null;
    });
    audio.addEventListener('error', function () {
      if (current === audio) current = null;
    });
    var started = audio.play();
    if (started && typeof started.catch === 'function') {
      started.catch(function () {
        if (current === audio) current = null;
      });
    }
    return audio;
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var button = target.closest('[data-audio-toggle]');
    if (!button) return;
    event.preventDefault();
    setMuted(!muted);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncToggles);
  } else {
    syncToggles();
  }

  window.GameAudio = {
    play: play,
    stop: stop,
    setMuted: setMuted,
    toggle: function () { setMuted(!muted); },
    isMuted: function () { return muted; },
  };
})();
