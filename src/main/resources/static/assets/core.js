/* 核心：请求、路由、阶段导轨、页签、提示 */

const App = {
  session: null,
  boot: null,
  accounts: null,
  route: '',
  cache: {},
};

const VIEWS = { student: {}, mentor: {}, admin: {} };

/* 界面构建标记：用于确认浏览器里跑的是哪一版（改完前端记得同步 index.html 的 ?v=） */
const BUILD = '2026-11-23 12:45';

/* ------------------------------------------------------------ 工具 */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function n(v, dash = '—') {
  return v === null || v === undefined ? dash : v;
}

/* 线稿图标：统一 24×24、2px 描边、圆头圆角，跟字体气质一致 */
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON = {
  arrow: svg('<path d="m9 6 6 6-6 6"/>'),
  arrowLeft: svg('<path d="m15 6-6 6 6 6"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
};

/* 侧栏页签图标 */
const NAV_ICON = {
  's/overview': svg('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>'),
  's/labs': svg('<path d="M3 21h18"/><path d="M5 21V8.5L12 4l7 4.5V21"/><path d="M9.5 21v-5h5v5"/>'),
  's/intent': svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  's/result': svg('<circle cx="12" cy="12" r="9"/><path d="m8.2 12.2 2.6 2.6 5-5.4"/>'),
  's/notice': svg('<path d="M3 11v2a1 1 0 0 0 1 1h2.2l5.3 4V6L6.2 10H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19.5 6a9 9 0 0 1 0 12"/>'),
  'm/overview': svg('<path d="M6 20v-6"/><path d="M12 20V7"/><path d="M18 20v-9"/>'),
  'm/profile': svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>'),
  'm/applicants': svg('<circle cx="9.5" cy="8" r="3.6"/><path d="M2.8 20a6.7 6.7 0 0 1 13.4 0"/><path d="M16.5 5.2a3.6 3.6 0 0 1 0 6.6"/><path d="M18.2 14.4A6.7 6.7 0 0 1 22 20"/>'),
  'm/score': svg('<path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.5 6.6 20.4l1-6.1L3.2 10l6.1-.9z"/>'),
  'm/decision': svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7.8 12.2 2.9 2.9 5.5-6.2"/>'),
  'a/dashboard': svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 9.5h18"/><path d="M9.5 21V9.5"/>'),
  'a/base': svg('<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>'),
  'a/stages': svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3.2 2"/>'),
  'a/adjust': svg('<path d="M4 8h13"/><path d="m14 4.5 3.5 3.5L14 11.5"/><path d="M20 16H7"/><path d="m10 12.5 3.5 3.5L10 19.5"/>'),
  'a/notice': svg('<path d="M3 11v2a1 1 0 0 0 1 1h2.2l5.3 4V6L6.2 10H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19.5 6a9 9 0 0 1 0 12"/>'),
};

/* ------------------------------------------------------------ 像素头像与实训室配色 */

const AVA_COLOR = ['#e6c06f', '#a9d6a0', '#a8c8ea', '#eaaec2', '#c9b6ea', '#96d2c8', '#eab98f', '#c3d98f'];

function avSeed(s) {
  let h = 2166136261;
  const t = String(s || '?');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* 5×5 镜像像素头像：由姓名散列决定，同一个人永远是同一张脸 */
function pixelAvatar(name, px = 20) {
  const h = avSeed(name);
  const bg = AVA_COLOR[(h >>> 5) % AVA_COLOR.length];
  let bits = '';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (((h >>> ((y * 3 + x) % 28)) & 1) === 0) continue;
      bits += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      if (x < 2) bits += `<rect x="${4 - x}" y="${y}" width="1" height="1"/>`;
    }
  }
  if (!bits) bits = '<rect x="2" y="1" width="1" height="3"/>';
  return `<svg class="pxa" viewBox="0 0 5 5" width="${px}" height="${px}" shape-rendering="crispEdges" aria-hidden="true"><rect width="5" height="5" fill="${bg}"/><g fill="#3f3325">${bits}</g></svg>`;
}

/* 浅色纸面用的实训室色：填充走柔和粉彩，文字走同色深版 */
const LAB_COLOR = {
  '202': '#d9efe9', '204': '#dbe7f7', '206': '#f8e4d1', '402': '#e8dff7',
  '404': '#dfefdc', '406': '#f8eed2', '505': '#f8dfe6',
};
const LAB_INK = {
  '202': '#2f6f64', '204': '#3a5c8f', '206': '#96602e', '402': '#6a4d92',
  '404': '#4a6f3c', '406': '#8a6a24', '505': '#9b4a63',
};

function labColor(code) { return LAB_COLOR[String(code)] || '#f8eed2'; }
function labInk(code) { return LAB_INK[String(code)] || '#8a6a24'; }
function labVars(code) {
  return `--lab:${labInk(code)};--lab-fill:${labColor(code)}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const s = String(iso);
  return s.slice(5, 10).replace('-', '-');
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const s = String(iso);
  return s.slice(5, 10) + ' ' + s.slice(11, 16);
}

/* 把毫秒差写成「2 天 3 小时」这样的粗粒度 */
function fmtSpan(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d} 天 ${h} 小时`;
  if (h) return `${h} 小时 ${mm} 分`;
  return `${mm} 分`;
}

function fmtFull(iso) {
  if (!iso) return '';
  const s = String(iso);
  return s.slice(0, 10) + ' ' + s.slice(11, 16);
}

/* 横向滚动条在窄屏会切断内容，用两侧渐隐提示「还能滑」 */
function edgeFade(el) {
  if (!el || el._fadeBound) return;
  el._fadeBound = true;
  const upd = () => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('fade-l', el.scrollLeft > 2);
    el.classList.toggle('fade-r', max > 2 && el.scrollLeft < max - 2);
  };
  el.addEventListener('scroll', upd, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(upd).observe(el);
  el._fadeUpd = upd;
  upd();
}

function refreshFades() {
  ['#rail', '#nav'].forEach(sel => {
    const el = $(sel);
    edgeFade(el);
    if (el && el._fadeUpd) el._fadeUpd();
  });
}

/* ------------------------------------------------------------ 请求 */

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (App.session) headers['X-Token'] = App.session.token;
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty */ }
  if (!res.ok) {
    if (res.status === 400 && data && data.message) throw new Error(data.message);
    throw new Error((data && data.message) || '请求失败');
  }
  return data;
}

/**
 * 带 token 的文件下载。不能用 <a href> 直接点：token 在 X-Token 头里，链接带不过去。
 * 文件名由调用方给（服务端那份是 RFC 5987 编码过的，前端解析反而容易出错）。
 */
async function downloadFile(path, fileName) {
  const res = await fetch('/api' + path, {
    headers: { 'X-Token': App.session ? App.session.token : '' },
  });
  if (!res.ok) {
    let msg = '下载失败';
    try { const d = await res.json(); if (d && d.message) msg = d.message; } catch (e) { /* 不是 JSON */ }
    throw new Error(msg);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ------------------------------------------------------------ 提示 */

function toast(msg, kind = '') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

/* ------------------------------------------------------------ 阶段导轨 */

const STAGE_LABEL = { PREACH: '宣讲', OPENDAY: '开放日', INTENT: '填报', INTERVIEW: '面试', CONFIRM: '确认', SUPPLEMENT: '补录', ADJUST: '调剂', PUBLISH: '公示' };

function stageState(stage, current) {
  if (!current) return 'todo';
  if (stage.seq < current.seq) return 'done';
  if (stage.seq === current.seq) return 'active';
  return 'todo';
}

function renderRail() {
  const boot = App.boot;
  if (!boot) return;

  $('#rail').innerHTML = '<ol>' + boot.stages.map(s => {
    const st = stageState(s, boot.current);
    const mark = st === 'done' ? ICON.check : String(s.seq);
    return `<li class="step ${st}" title="${esc(s.summary)}">
      <span class="step-dot">${mark}</span>
      <span class="step-label">${esc(STAGE_LABEL[s.code] || s.name)}</span>
      <span class="step-time">${fmtDate(s.startAt)}</span>
    </li>`;
  }).join('') + '</ol>';

  const pill = $('#stagePill');
  const cur = boot.current;
  /* 阶段胶囊只放阶段名：序号下面那条阶段条上已经有了，顶栏省出来的宽度给导航 */
  pill.innerHTML = cur ? `<i></i><span>${esc(cur.name)}</span>` : '';

  const left = $('#stageLeft');
  if (left) {
    const endMs = cur && cur.endAt ? new Date(cur.endAt) - new Date(boot.demoNow) : 0;
    left.innerHTML = cur && cur.endAt
      ? (endMs > 0 ? `本阶段还剩 <b>${fmtSpan(endMs)}</b>` : '本阶段<b>已截止</b>')
      : '';
  }

  const clockEl = $('#demoClock');
  clockEl.textContent = fmtFull(boot.demoNow);
  const canAdjust = boot.me.role === 'admin';
  clockEl.classList.toggle('is-link', canAdjust);
  clockEl.title = canAdjust ? '演示时钟 · 点击调节' : '演示时钟 · 调节需管理员账号';
  if (!clockEl._bound) {
    clockEl._bound = true;
    clockEl.addEventListener('click', () => {
      if (App.session.role === 'admin') navigate('a/stages');
      else toast('调节时间要用管理员账号登录（admin / Admin@2026）');
    });
  }
  $('#whoName').textContent = boot.me.name;
  $('#whoSub').textContent = boot.me.sub;
  /* 顶栏头像用姓名首字，和纸感气质一致（表格里仍用像素头像做区分） */
  $('#meAvatar').textContent = (boot.me.name || '?').trim().slice(0, 1);
  /* 顶栏放不下整行姓名，把完整身份挂到头像的 title 上 */
  const meBox = $('.me');
  if (meBox) meBox.title = [boot.me.name, boot.me.sub].filter(Boolean).join(' · ');
  refreshFades();

  /* 窄屏阶段条要横向滚动：直接把当前阶段滚到中间，省得用户自己找 */
  const rail = $('#rail');
  const act = rail && rail.querySelector('.step.active');
  if (act && rail.scrollWidth > rail.clientWidth + 4) {
    const rr = rail.getBoundingClientRect();
    const ar = act.getBoundingClientRect();
    rail.scrollLeft += (ar.left - rr.left) - (rr.width - ar.width) / 2;
  }
}

/* ------------------------------------------------------------ 页签 */

const TABS = {
  student: [
    ['s/overview', '总览'], ['s/labs', '实训室'], ['s/intent', '意向填报'],
    ['s/result', '我的结果'], ['s/notice', '公示名单'],
  ],
  mentor: [
    ['m/overview', '概览'], ['m/profile', '我的介绍'], ['m/applicants', '报名学生'],
    ['m/score', '面试评分'], ['m/decision', '录取决策'],
  ],
  admin: [
    ['a/dashboard', '录取看板'], ['a/base', '基础数据'], ['a/stages', '阶段控制'],
    ['a/adjust', '统筹调剂'], ['a/notice', '公示管理'],
  ],
};

function activeTab() {
  const active = App.route.split('/').slice(0, 2).join('/');
  if (active === 's/lab' || active === 's/mentor') return 's/labs';
  return active;
}

function renderTabs() {
  const role = App.session.role;
  const on = activeTab();
  const items = TABS[role];
  $('#nav').innerHTML = items.map(([key, label]) =>
    `<button class="nav-item ${key === on ? 'on' : ''}" type="button" data-tab="${key}"><span class="ni">${NAV_ICON[key] || ''}</span>${label}</button>`
  ).join('');
  const hit = items.find(([key]) => key === on);
  $('#barTitle').textContent = hit ? hit[1] : items[0][1];
  refreshFades();
}

/* ------------------------------------------------------------ 路由 */

function navigate(hash) {
  if (location.hash === '#' + hash) { render(); return; }
  location.hash = '#' + hash;
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || '';
  return raw;
}

/* 角色中文名：越权提示和二次确认里都要用 */
const ROLE_LABEL = { student: '学生', mentor: '导师', admin: '学院管理' };

/* 每次 render 领一个序号；慢请求回来时若已有更新的渲染，直接丢弃，避免旧页面盖掉新页面 */
let renderSeq = 0;

async function render() {
  const seq = ++renderSeq;
  const route = parseRoute();
  App.route = route || defaultRoute();
  if (!route) { navigate(App.route); return; }
  renderTabs();

  const [role, key, param] = App.route.split('/');
  const view = VIEWS[App.session.role] && VIEWS[App.session.role][key];
  if (!view) {
    /* 越权访问比「页面不存在」更常见：管理员手敲 #s/overview、学生翻到 #a/base。
       先判断这是不是别人的地盘，说清楚再给一个回自己工作台的按钮。 */
    const mine = { s: 'student', m: 'mentor', a: 'admin' };
    const who = { s: '学生端', m: '导师端', a: '学院管理端' };
    const other = mine[role] && mine[role] !== App.session.role;
    $('#view').innerHTML = other
      ? `<div class="empty">
           <b>这个页面属于${esc(who[role] || '其他角色')}</b>
           你当前的身份是「${esc(ROLE_LABEL[App.session.role] || App.session.role)}」，无法直接打开这一页。
           <div style="margin-top:16px"><button class="btn btn-primary" data-home>回到我的工作台</button></div>
         </div>`
      : `<div class="empty"><b>页面不存在</b>地址里的页签名不对，返回上方页签继续。</div>`;
    const home = $('#view').querySelector('[data-home]');
    if (home) home.addEventListener('click', () => navigate(defaultRoute()));
    return;
  }
  /* 换页之前先拆上一页。3D 渲染器必须主动 dispose 并丢掉 WebGL 上下文，
     不然每次进出总览都漏一个，十几个之后就再也开不出新的了。
     放在这里而不是等新视图回来：容器下面就要被清空，旧画布已经用不着了。 */
  if (App.viewCleanup) {
    const f = App.viewCleanup;
    App.viewCleanup = null;
    try { f(); } catch (e) { /* 清理失败不该挡住换页 */ }
  }
  /* 骨架屏而不是「载入中…」三个字。
     但不能一见换页就摆出来：接口几十毫秒就回来，骨架屏会闪一下就没，
     看着像画面抖了一下，比什么都不放还糟。延迟 130ms 再上——
     本地够快的话用户根本看不到它，慢的时候才出现，那时候它才是"有内容"。 */
  let skTimer = 0;
  if (window.FX) {
    FX.progress(true);
    $('#view').innerHTML = '';
    skTimer = setTimeout(() => {
      if (seq === renderSeq) $('#view').innerHTML = FX.skeleton();
    }, 130);
  } else {
    $('#view').innerHTML = '<div class="empty">载入中…</div>';
  }
  try {
    const out = await view(param);
    clearTimeout(skTimer);
    if (seq !== renderSeq) return;
    const stale = $('#view');
    const root = stale.cloneNode(false); // 换一个干净的容器，避免事件监听累积
    stale.replaceWith(root);
    if (typeof out === 'string') {
      root.innerHTML = out;
    } else {
      root.innerHTML = out.html;
    }
    const mount = (out && out.mount) || view.mount;
    if (mount) mount(root);
    root.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (window.FX) { FX.progress(false); FX.afterMount(root); }
  } catch (e) {
    clearTimeout(skTimer);
    if (seq !== renderSeq) return;
    if (window.FX) FX.progress(false);
    $('#view').innerHTML = `<div class="empty"><b>没能取到数据</b>${esc(e.message)}</div>`;
  }
}

function defaultRoute() {
  const role = App.session ? App.session.role : 'student';
  return { student: 's/overview', mentor: 'm/overview', admin: 'a/dashboard' }[role];
}

/* ------------------------------------------------------------ 页面骨架 */

function pageHead(title, sub, actions = '') {
  return `<div class="page-head">
    <div>
      <h1 class="page-title">${esc(title)}</h1>
      ${sub ? `<p class="page-sub">${esc(sub)}</p>` : ''}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </div>`;
}

/* ------------------------------------------------------------ 二次确认 */

/* 不可逆动作统一走这里。返回 Promise<boolean>。
   不用原生 confirm：样式脱离整套纸感，移动端还会被系统弹窗打断上下文。 */
function confirmAction({ title, lines = [], note = '', okText = '确认', danger = false }) {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = `<div class="modal-card confirm-card" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
      <div class="modal-head">
        <h2 id="cfTitle">${esc(title)}</h2>
        <button class="modal-x" type="button" aria-label="关闭">${ICON.close}</button>
      </div>
      <div class="modal-body">
        ${lines.length ? `<ul class="confirm-list">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        ${note ? `<p class="confirm-note">${esc(note)}</p>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn" data-no type="button">返回核对</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes type="button">${esc(okText)}</button>
      </div>
    </div>`;
    document.body.appendChild(box);

    const done = v => {
      box.remove();
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = e => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter') done(true);
    };
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', e => {
      if (e.target === box) return done(false);
      if (e.target.closest('[data-no]') || e.target.closest('.modal-x')) return done(false);
      if (e.target.closest('[data-yes]')) done(true);
    });
    setTimeout(() => { const y = box.querySelector('[data-yes]'); if (y) y.focus(); }, 40);
  });
}

function stageBanner() {
  const c = App.boot.current;
  if (!c) return '';
  return `<div class="notice">
    <span class="dot"></span>
    <span><b>当前阶段 · ${esc(c.name)}</b>　${esc(c.summary)}<br>
    <span class="muted small tnum">时间窗 ${fmtFull(c.startAt)} — ${fmtFull(c.endAt)}</span></span>
  </div>`;
}

function meter(done, total, tint) {
  const pct = total <= 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
  const cls = tint || pct < 100 ? '' : 'low';
  const style = tint ? ` style="--lab:${tint}"` : '';
  return `<div class="meter ${cls}"${style}><i style="width:${pct}%"></i></div>`;
}

/* ------------------------------------------------------------ 登录 */

const REMEMBER_KEY = 'rememberUser';

/* 院徽的 WebGL 流动物体：按需加载，加载失败就留静态图 */
let authObject = null;
let authObjectLoading = false;

function mountAuthObject() {
  if (authObject || authObjectLoading) return;
  const canvas = $('#authCanvas');
  const fallback = $('#authFallback');
  if (!canvas) return;

  if (!window.createLiquidObject) {
    authObjectLoading = true;
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'assets/liquid-object.js';
    s.onload = () => { authObjectLoading = false; mountAuthObject(); };
    s.onerror = () => { authObjectLoading = false; };
    document.head.appendChild(s);
    return;
  }

  try {
    authObject = window.createLiquidObject({ canvas }, {
      src: 'assets/brand/ss-mark.png',
      distortion: 1.15, aberration: 0.55, grain: 0.45, sheen: 1.25, swirl: 0.45,
      iridescence: 0.7, cursorSize: 0.95, cursorForce: 0.85, persistence: 0.55,
      splash: 1, ambient: 0.9, wobble: 0.12, depth: 0.15, bevel: 0.5, gloss: 0.72,
      metallic: 0.08, highlight: '#ffd0a0', environmentIntensity: 0.95,
      brightness: 1, saturation: 1.45, scale: 3.4,
      onLoad: () => { if (fallback) fallback.classList.add('is-hidden'); },
      onError: () => { if (fallback) fallback.classList.remove('is-hidden'); },
    });
  } catch (e) {
    /* WebGL 不可用（老显卡 / 被禁用）：静态院徽照常显示 */
    authObject = null;
  }
}

/* 登录成功后把渲染循环停掉：院徽只在登录页需要，
   进了系统还让 three.js 在后台每帧跑一遍纯粹是白耗电 */
function unmountAuthObject() {
  if (!authObject) return;
  try { authObject.destroy(); } catch (e) { /* 已经释放过就忽略 */ }
  authObject = null;
  /* destroy() 之后旧 canvas 上的 WebGL 上下文不再可复用，
     换一块干净的，下次退出登录才能重建渲染器 */
  const old = $('#authCanvas');
  if (old && old.parentNode) {
    const fresh = old.cloneNode(false);
    /* 旧 canvas 的 width/height 是渲染器写上去的，留着会撑出个空尺寸 */
    fresh.removeAttribute('width');
    fresh.removeAttribute('height');
    old.parentNode.replaceChild(fresh, old);
  }
}

function showLogin(message) {
  const box = $('#login');
  box.hidden = false;
  $('#loginError').hidden = !message;
  $('#loginError').textContent = message || '';
  $('#password').value = '';
  /* 记住过的账号直接回填，省得每次重敲 */
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved) {
    $('#username').value = saved;
    $('#rememberMe').checked = true;
  }
  box.scrollTop = 0;
  setTimeout(() => {
    const u = $('#username');
    (u.value ? $('#password') : u).focus();
    mountAuthObject();
  }, 60);
}

function loginError(msg) {
  const el = $('#loginError');
  el.hidden = false;
  el.textContent = msg;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function loginBusy(on) {
  const btn = $('#loginBtn');
  btn.disabled = on;
  $('#loginBtnText').textContent = on ? '登录中…' : '登录';
  Array.from(document.querySelectorAll('.auth-role')).forEach(b => { b.disabled = on; });
}

async function doLogin(e) {
  if (e) e.preventDefault();
  const username = $('#username').value.trim();
  const password = $('#password').value;
  if (!username || !password) { loginError('请输入账号和密码'); return; }

  loginBusy(true);
  $('#loginError').hidden = true;
  try {
    const res = await api('/login', { method: 'POST', body: { username, password } });
    App.session = res;
    sessionStorage.setItem('session', JSON.stringify(res));
    /* 记住账号：只存账号，不存密码 */
    if ($('#rememberMe').checked) localStorage.setItem(REMEMBER_KEY, username);
    else localStorage.removeItem(REMEMBER_KEY);
    await boot();
    unmountAuthObject();
    /* 幕布落下来盖住「登录页消失、工作台出现」那一下。
       用 replaceState 改 hash 而不是 navigate：navigate 会触发 hashchange
       再 render 一次，两次渲染抢同一个容器，先到的那次会因为序号过期直接返回，
       幕布就在骨架屏上揭开了。 */
    if (window.FX) await FX.curtain(true);
    $('#login').hidden = true;
    const target = defaultRoute();
    App.route = target;
    if (location.hash !== '#' + target) history.replaceState(null, '', '#' + target);
    await render();
    if (window.FX) await FX.curtain(false);
    if (res.mustChange) openPwd(true);
  } catch (err) {
    loginError(err.message);
    $('#password').value = '';
    $('#password').focus();
  } finally {
    loginBusy(false);
  }
}

async function logout() {
  try { await api('/logout', { method: 'POST' }); } catch (err) { /* 忽略 */ }
  /* 退出也走一次幕布：从工作台直接"啪"回到登录页太生硬 */
  if (window.FX) await FX.curtain(true);
  App.session = null;
  App.boot = null;
  App.route = '';
  sessionStorage.removeItem('session');
  if (App.viewCleanup) {
    const f = App.viewCleanup;
    App.viewCleanup = null;
    try { f(); } catch (e) { /* 忽略 */ }
  }
  $('#rail').innerHTML = '';
  $('#nav').innerHTML = '';
  $('#view').innerHTML = '';
  $('#stagePill').innerHTML = '';
  $('#barTitle').textContent = '总览';
  $('#whoName').textContent = '未登录';
  $('#whoSub').textContent = '';
  $('#meAvatar').innerHTML = '·';
  $('#username').value = '';
  $('#password').value = '';
  $('#password').type = 'password';
  const reveal = $('#pwdReveal');
  if (reveal) {
    reveal.classList.remove('is-on');
    reveal.setAttribute('aria-label', '显示密码');
    reveal.title = '显示密码';
  }
  showLogin();
  if (window.FX) await FX.curtain(false);
}

async function boot() {
  App.boot = await api('/bootstrap');
  renderRail();
}

/* ------------------------------------------------------------ 修改密码 */

function openPwd(forced) {
  $('#pwdModal').hidden = false;
  $('#pwdError').hidden = true;
  $('#pwdOld').value = '';
  $('#pwdNew').value = '';
  $('#pwdNew2').value = '';
  $('#pwdCancel').textContent = forced ? '稍后再说' : '取消';
  setTimeout(() => $('#pwdOld').focus(), 60);
}

function closePwd() {
  $('#pwdModal').hidden = true;
}

function pwdError(msg) {
  const el = $('#pwdError');
  el.hidden = false;
  el.textContent = msg;
}

async function savePwd() {
  const oldPwd = $('#pwdOld').value;
  const newPwd = $('#pwdNew').value;
  const again = $('#pwdNew2').value;
  if (!oldPwd || !newPwd) { pwdError('请填写当前密码与新密码'); return; }
  if (newPwd !== again) { pwdError('两次输入的新密码不一致'); return; }
  const btn = $('#pwdSave');
  btn.disabled = true;
  try {
    await api('/password', { method: 'POST', body: { oldPassword: oldPwd, newPassword: newPwd } });
    closePwd();
    toast('密码已修改，请用新密码重新登录', 'ok');
    await logout();
  } catch (err) {
    pwdError(err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------ 绑定 */

function bindLogin() {
  const tag = 'build ' + BUILD;
  ['#buildTag', '#buildTagLogin'].forEach(sel => {
    const el = $(sel);
    if (el) el.textContent = tag;
  });

  $('#loginForm').addEventListener('submit', doLogin);

  /* 密码显隐 */
  const reveal = $('#pwdReveal');
  reveal.addEventListener('click', () => {
    const input = $('#password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    reveal.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    reveal.title = show ? '隐藏密码' : '显示密码';
    reveal.classList.toggle('is-on', show);
    input.focus();
  });

  /* 演示身份一键进入：填好账号密码直接提交 */
  $('#authRoles').addEventListener('click', e => {
    const b = e.target.closest('[data-user]');
    if (!b || b.disabled) return;
    $('#username').value = b.dataset.user;
    $('#password').value = b.dataset.pass;
    $('#loginForm').requestSubmit();
  });

  /* 点品牌回首页 */
  $('#brandHome').addEventListener('click', () => {
    if (App.session) navigate(defaultRoute());
  });

  $('#switchBtn').addEventListener('click', logout);
  $('#pwdBtn').addEventListener('click', () => openPwd(false));
  $('#pwdClose').addEventListener('click', closePwd);
  $('#pwdCancel').addEventListener('click', closePwd);
  $('#pwdSave').addEventListener('click', savePwd);
  $('#pwdModal').addEventListener('click', e => { if (e.target.id === 'pwdModal') closePwd(); });
  $('#nav').addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) navigate(t.dataset.tab);
  });
  window.addEventListener('hashchange', render);
}
