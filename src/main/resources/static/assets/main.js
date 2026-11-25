/* 启动 */

(async function init() {
  bindLogin();

  const saved = sessionStorage.getItem('session');
  if (saved) {
    try {
      App.session = JSON.parse(saved);
      await boot();
      $('#login').hidden = true;
      /* 有存档就直接进工作台。用 replaceState 改 hash 而不是 navigate：
         navigate 会再触发一次 hashchange→render，两次渲染抢同一个容器，
         先到的那次会因为序号过期提前返回，启动屏就在空白上撤掉了。 */
      const target = location.hash ? parseRoute() : defaultRoute();
      App.route = target;
      if (location.hash !== '#' + target) history.replaceState(null, '', '#' + target);
      await render();
      /* 启动屏等首屏真的画完再撤 */
      if (window.FX) FX.hideBoot();
      return;
    } catch (e) {
      App.session = null;
      sessionStorage.removeItem('session');
    }
  }
  showLogin();
  if (window.FX) FX.hideBoot();
})();
