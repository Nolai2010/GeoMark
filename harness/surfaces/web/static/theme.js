/* 主题预设：在 CSS 加载前确定，避免闪烁。支持 ?theme=light|dark 覆盖。 */
(function () {
  var t;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    t = q || localStorage.getItem('gm-theme') || 'system';
  } catch (e) { t = 'system'; }
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
