/* ================================================================
   视觉特效层

   只做 DOM / CSS 能做的事：启动屏、转场幕布、路由进度条、骨架屏、
   数字滚动、内容依次浮现。three.js 那边的动效在 openday-grid.js
   和 openday.js 里，不在这。

   一条原则：**任何一项失效都只是少个效果，绝不能挡住功能**。
   所以所有入口都包了 try，所有定时器都有兜底超时。
   ================================================================ */

(function () {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);

  /* ---------------------------------------------------------- 启动屏 */

  let bootEl = null;
  let bootDone = false;
  const BOOT_MIN = 1000;     // 至少亮这么久，否则一闪而过反而像卡了一下
  const BOOT_MAX = 6000;     // 兜底：接口再慢也不能一直挂着

  /* 计时起点必须等第一帧画出来再取。脚本是在 </body> 前执行的，
     而 CSS / 字体还没下完时 performance.now() 已经跑了好几百毫秒——
     照那个起点算，"至少亮 1 秒"会变成"亮 0 毫秒"，启动屏刚出来就开始淡出。 */
  let bootStart = performance.now();
  requestAnimationFrame(() => { bootStart = performance.now(); });

  function bootNode() {
    if (bootEl) return bootEl;
    bootEl = $('#bootScreen');
    return bootEl;
  }

  function hideBoot() {
    if (bootDone) return;
    const el = bootNode();
    bootDone = true;
    if (!el) return;
    const wait = Math.max(0, BOOT_MIN - (performance.now() - bootStart));
    setTimeout(() => {
      el.classList.add('is-done');
      /* 动画走完再摘掉节点，免得它继续盖着底下的焦点环 */
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
    }, wait);
  }

  setTimeout(hideBoot, BOOT_MAX);

  /* ---------------------------------------------------------- 幕布 */

  function curtainEl() { return $('#curtain'); }

  /* on=true 盖住（落下来），on=false 揭开（升上去）。
     返回 Promise，让调用方可以 await 之后再换内容。 */
  function curtain(on, hold = 0) {
    const el = curtainEl();
    if (!el) return Promise.resolve();
    if (on) {
      el.classList.remove('is-off');
      el.classList.add('is-on');
      return wait(reduce ? 0 : 520 + hold);
    }
    el.classList.remove('is-on');
    el.classList.add('is-off');
    return wait(reduce ? 0 : 620);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ---------------------------------------------------- 路由进度条 */

  let progTimer = 0;
  function progress(on) {
    const el = $('#routeProgress');
    if (!el) return;
    clearTimeout(progTimer);
    if (on) {
      el.classList.remove('is-done');
      el.classList.add('is-on');
    } else {
      el.classList.add('is-done');
      el.classList.remove('is-on');
      progTimer = setTimeout(() => el.classList.remove('is-done'), 400);
    }
  }

  /* ---------------------------------------------------------- 骨架屏 */

  /* 骨架屏的形状跟着页面走：有 .sec 的地方就画两块卡，没有就画一行标题。
     统一用一组通用块，够像就行——目标是"页面在长出来"，不是复刻版式。 */
  function skeleton() {
    return `<div class="sk" aria-hidden="true">
      <div class="sk-head">
        <span class="sk-line w40"></span>
        <span class="sk-line w22 dim"></span>
      </div>
      <div class="sk-grid">
        ${Array.from({ length: 3 }, () => `<div class="sk-card">
          <span class="sk-line w60"></span>
          <span class="sk-line w88 dim"></span>
          <span class="sk-line w74 dim"></span>
          <span class="sk-line w30"></span>
        </div>`).join('')}
      </div>
      <div class="sk-rows">
        ${Array.from({ length: 4 }, () => `<div class="sk-row">
          <span class="sk-dot"></span>
          <span class="sk-line w52"></span>
          <span class="sk-line w18 dim"></span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------ 数字滚动 */

  /* [data-count="123"] 从 0 滚到 123。带 .tnum 的地方数字等宽，
     滚动时不会左右抖。 */
  function countUp(root) {
    if (reduce) return;
    const nodes = root.querySelectorAll('[data-count]');
    nodes.forEach(el => {
      if (el.__counted) return;
      el.__counted = true;
      const to = Number(el.dataset.count);
      if (!Number.isFinite(to)) return;
      const dur = 780;
      const t0 = performance.now();
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur);
        /* 先快后慢，最后一点点收住 */
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = String(Math.round(to * e));
        if (k < 1) requestAnimationFrame(tick);
        else el.textContent = String(to);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ------------------------------------------------------ 依次浮现 */

  /* 给容器里的直接子元素排队挂上 --i，CSS 用 animation-delay 错开。
     只挑「块级、有视觉重量」的那些，不然页面上几十个 span 一起动会很乱。 */
  const REVEAL_SEL = '.ov-head > *, .ov-stage, .sec, .page-head, .lab-list > *, .ring-stage, .ring-bar, .stat, .ov-chip';

  function reveal(root) {
    if (reduce) return;
    const list = [];
    root.querySelectorAll(REVEAL_SEL).forEach(el => { if (!list.includes(el)) list.push(el); });
    list.slice(0, 14).forEach((el, i) => {
      el.style.setProperty('--i', String(i));
      el.classList.add('fx-in');
    });
    /* 动画结束后把类摘掉：留着的话 transform 会一直挂在元素上，
       里面如果有 position: fixed 的子元素就会跟着错位 */
    setTimeout(() => {
      list.forEach(el => {
        el.classList.remove('fx-in');
        el.style.removeProperty('--i');
      });
    }, 1400);
  }

  /* -------------------------------------------------------- 3D 倾斜 */

  /* 只给明确标了 data-tilt 的元素挂。整站铺开的话，滚动时几十个
     transform 一起重算，手机会掉帧。 */
  function tilt(root) {
    if (reduce) return;
    root.querySelectorAll('[data-tilt]').forEach(el => {
      if (el.__tilt) return;
      el.__tilt = true;
      let raf = 0;
      const move = e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--tx', (-py * 6).toFixed(2) + 'deg');
          el.style.setProperty('--ty', (px * 8).toFixed(2) + 'deg');
          el.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%');
          el.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
        });
      };
      const reset = () => {
        cancelAnimationFrame(raf);
        el.style.setProperty('--tx', '0deg');
        el.style.setProperty('--ty', '0deg');
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', reset);
      el.addEventListener('blur', reset);
    });
  }

  /* 主按钮统一挂上涟漪。写在一个地方比在七八个视图里逐个加属性省事，
     也不怕以后新加的按钮漏掉。 */
  function rippleize(root) {
    root.querySelectorAll('.btn-primary, .auth-submit, .auth-role, .openday-entry')
      .forEach(b => { if (!b.hasAttribute('data-ripple')) b.setAttribute('data-ripple', ''); });
  }

  /* ------------------------------------------------------ 挂载后统一 */

  function afterMount(root) {
    try { rippleize(root); } catch (e) { /* 忽略 */ }
    try { tilt(root); } catch (e) { /* 忽略 */ }
    try { countUp(root); } catch (e) { /* 忽略 */ }
    try { reveal(root); } catch (e) { /* 忽略 */ }
  }

  /* ---------------------------------------------------- 涟漪 / 光晕 */

  /* 点击时在指针位置溅一圈。用在按钮上，比单纯的 :active 缩放更有反馈。 */
  function ripple(el, e) {
    if (reduce) return;
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'fx-ripple';
    s.style.width = s.style.height = d + 'px';
    s.style.left = ((e ? e.clientX : r.left + r.width / 2) - r.left - d / 2) + 'px';
    s.style.top = ((e ? e.clientY : r.top + r.height / 2) - r.top - d / 2) + 'px';
    el.appendChild(s);
    setTimeout(() => s.remove(), 620);
  }

  /* 全局委托：带 data-ripple 的按钮自动有涟漪，不用一个个绑 */
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest('[data-ripple]');
    if (t) ripple(t, e);
  }, { passive: true });

  window.FX = {
    hideBoot, curtain, progress, skeleton, countUp, reveal, tilt, afterMount, ripple,
    get reduceMotion() { return reduce; },
  };
})();
