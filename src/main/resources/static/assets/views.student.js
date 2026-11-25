/* 学生端 */

/* 导师环用的数据：视图渲染时写入，mount 时读取（避免二次请求） */
let ringMentors = [];
let ringLabId = null;
let ringLabMap = {};

function labRow(l) {
  return `<div class="lab-row" data-lab="${l.id}" style="${labVars(l.code)}">
    <div class="lab-code">${esc(l.code)}</div>
    <div>
      <div class="lab-name">${esc(l.name)}</div>
      <div class="lab-dir">${esc(l.direction)}</div>
    </div>
    <div class="lab-stats">
      <span>导师 <b>${l.mentorCount}</b> 位</span>
      <span>名额 <b>${l.quota}</b> 人</span>
      <span>报名 <b>${l.applicants}</b> 人</span>
    </div>
    <div class="lab-arrow">${ICON.arrow}</div>
  </div>`;
}

/* 实验室详情顶栏：左侧色板写房号，右侧三格数据（学生端不显示剩余名额） */
/* 实验室信息卡：环转到哪个室，这块就换成哪个室 */
function labHeroHtml(l) {
  const cell = (k, v) => `<div class="lh-cell"><b>${v}</b><span>${k}</span></div>`;
  return `<div class="lab-hero" id="labHero" data-tilt style="${labVars(l.code)}">
    <div class="lab-hero-plate">${esc(l.code)}</div>
    <div class="lab-hero-body">
      <button class="btn-link" data-back="s/labs" style="margin-bottom:8px">${ICON.arrowLeft} 全部实训室</button>
      <h1 class="page-title">${esc(l.name)}</h1>
      <p class="page-sub">${esc(l.direction)}</p>
    </div>
    <div class="lab-hero-stats">
      ${cell('导师', l.mentorCount)}
      ${cell('名额', l.quota)}
      ${cell('报名', l.applicants)}
    </div>
  </div>`;
}

/* 总览 = 3D 方块网格。登录进来第一眼就是它：七间实训室平铺在台面上，
   点哪一块就进哪一间。场景模块跟 openday.html 共用一份（openday-grid.js），
   这里只负责给它一块画布、一个渲染器和一条主循环。

   进度数据收成右上角三个小胶囊。原来那三张大卡占掉半屏，
   而这页的主角现在是模型，不是数字。 */
VIEWS.student.overview = async () => {
  const [home, labsData] = await Promise.all([api('/student/home'), api('/labs')]);
  const labs = labsData.labs.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const c = App.boot.current;
  const stageSeq = c ? c.seq : 0;
  const en = home.enrollment;
  /* 触屏没有鼠标。文案按输入方式分，不按屏宽分——窄窗口的电脑也是有鼠标的。 */
  const touch = matchMedia('(hover: none)').matches;

  const kicker = c
    ? `${c.name}${c.endAt ? ' · ' + fmtDateTime(c.endAt) + ' 截止' : ''}`
    : '2026 秋季学期';

  const html = `
  <div class="ov">
    <div class="ov-head">
      <div class="ov-lead">
        <span class="ov-kicker">${esc(kicker)}</span>
        <h1 class="ov-title">选择一间实训室</h1>
        <p class="ov-sub">${esc(home.student.name)} · ${esc(home.student.no)} · ${esc(home.student.className)}</p>
      </div>
      <div class="ov-side">
        <span class="ov-chip">平行意向 <b><span data-count="${home.intentionCount}">0</span><i>/3</i></b></span>
        <span class="ov-chip">拟录取 <b>${stageSeq > 4 ? `<span data-count="${home.offerCount}">0</span> 个` : '—'}</b></span>
        <span class="ov-chip">去向 <b>${en ? esc(en.labCode) : '未定'}</b></span>
        <button class="btn btn-primary" data-go="s/intent">去填报意向</button>
      </div>
    </div>

    <div class="ov-stage" id="ovStage">
      <canvas id="ovCanvas" aria-label="七间实训室的三维展示，点任意一块进入展厅"></canvas>
      <div class="ov-loading" id="ovLoading"><i class="ov-spinner" aria-hidden="true"></i>正在准备三维场景…</div>
      <div class="ov-hint">
        <span>${touch ? '拖动查看细节' : '拖动鼠标看细节'}</span><i aria-hidden="true"></i><span>点方块进入展厅</span>
      </div>
      <div class="ov-veil" id="ovVeil"></div>
    </div>
  </div>`;

  return { html, mount: root => mountOverview(root, labs) };
};

/* 3D 起不来时的替代视图。总览页唯一的入口就是点方块，3D 挂了不能只留一块
   空台面——那等于整页不可用。换成七间室的平面列表，点哪间进哪间。 */
function flatFallback(stage, canvas, labs) {
  if (!stage) return;
  if (canvas) canvas.remove();
  const ld = stage.querySelector('#ovLoading');
  if (ld) ld.remove();
  const hint = stage.querySelector('.ov-hint');
  if (hint) hint.remove();
  stage.classList.add('is-flat');
  stage.insertAdjacentHTML('afterbegin', `
    <div class="ov-flat">
      <p class="ov-flat-note">这台设备没能开启三维视图，已换成平面列表——点任意一间照样能进展厅。</p>
      <div class="ov-flat-list">
        ${labs.map(l => `<a class="ov-flat-item" href="/openday.html?lab=${l.id}">
          <span class="ov-flat-code">${esc(l.code)}</span>
          <span class="ov-flat-name">${esc(l.name)}</span>
          <span class="ov-flat-dir">${esc(l.direction)}</span>
          <span class="ov-flat-meta">导师 ${l.mentorCount} · 名额 ${l.quota} · 报名 ${l.applicants}</span>
        </a>`).join('')}
      </div>
    </div>`);
}

/* 3D 总览的挂载：渲染器、主循环、拾取、清理。
   清理是必须的——WebGL 上下文有上限（十几个），进出几次总览不释放就再也开不出来了。 */
function mountOverview(root, labs) {
  /* 页内跳转（「去填报意向」这类按钮）。
     必须挂在这里而不是 VIEWS.student.overview.mount —— render() 取的是
     `out.mount || view.mount`，本视图返回了 out.mount，那个赋值就永远轮不到。
     root 每次换页都是 clone 出来的新容器，挂一次不会累积。 */
  root.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) navigate(go.dataset.go);
  });

  const stage = root.querySelector('#ovStage');
  const canvas = root.querySelector('#ovCanvas');
  const veil = root.querySelector('#ovVeil');
  if (!stage || !canvas) return;

  let renderer = null;
  let grid = null;
  let raf = 0;
  let ro = null;
  let leaving = false;

  (async () => {
    const THREE = await import('three');
    const { createGrid } = await import('./openday-grid.js?v=20261119f');

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const fit = () => {
      renderer.setSize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight), false);
    };
    fit();

    grid = createGrid({ renderer, canvas, labs });
    grid.build();

    const clock = new THREE.Clock();
    let painted = false;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      grid.update(dt);
      renderer.render(grid.scene, grid.cam);
      /* 第一帧出来才撤加载层。three.js 是 2.1MB 的两段式模块，手机流量下
         要好几秒——这段时间画面是空的，不放提示就像「这页没有 3D」。 */
      if (!painted) {
        painted = true;
        const ld = root.querySelector('#ovLoading');
        if (ld) ld.remove();
      }
    };
    loop();

    /* 画布尺寸跟着容器走。窗口缩放会改变内容区比例，列数可能从 4 变 2，
       所以要走 resize() 而不是只改 renderer 尺寸。 */
    ro = new ResizeObserver(() => {
      if (!renderer || !grid) return;
      fit();
      grid.resize();
    });
    ro.observe(stage);

    canvas.addEventListener('pointermove', e => grid.setPointer(e.clientX, e.clientY));
    canvas.addEventListener('pointerleave', () => grid.clearPointer());
  })().catch(err => {
    /* 开不出 3D 不能只留一块空台面：这页唯一的入口就是点方块，
       空着等于整页不可用。换成平面列表，七间室照样能点进去。
       常见原因：老机型没有 WebGL2、上下文数量超限、three.js 没下下来。 */
    console.warn('3D 总览不可用，已切换平面列表：', err && err.message);
    flatFallback(stage, canvas, labs);
  });

  /* 点击：相机压向方块 → 黑场 → 打开那间室的展厅（整页，跟 openday.html 一致） */
  let downAt = null;
  canvas.addEventListener('pointerdown', e => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', e => {
    const d = downAt;
    downAt = null;
    if (!d || leaving || !grid) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9) return;
    if (performance.now() - d.t > 900) return;

    const hit = grid.pick(e.clientX, e.clientY);
    if (!hit) return;

    leaving = true;
    grid.flyToTile(hit.lab, 560);
    setTimeout(() => veil.classList.add('is-on'), 340);
    setTimeout(() => { location.href = '/openday.html?lab=' + hit.lab.id; }, 780);
  });

  /* 万一两次 render 叠在一起（慢接口 + 快速切页），清理函数会互相覆盖。
     链起来，前一个也得拆干净。 */
  const prevCleanup = App.viewCleanup;
  App.viewCleanup = () => {
    if (prevCleanup) { try { prevCleanup(); } catch (e) { /* 忽略 */ } }
    leaving = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    if (grid) grid.dispose();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();   // 主动丢掉上下文，别等 GC
    }
    renderer = null;
    grid = null;
  };
}

VIEWS.student.labs = async () => {
  const { labs } = await api('/labs');
  const c = App.boot.current;
  /* 3D 网格已经搬到总览了，这页不用再放一个入口；只留开放日那张横幅，
     因为它是阶段性的招徕，点进去是全屏展厅，和总览里的不是一回事。 */
  const inOpenDay = c && c.code === 'OPENDAY';
  return `
  ${pageHead('实训室', '七个实训室，点进去看导师。')}
  ${stageBanner()}
  ${inOpenDay ? `
  <a class="openday-entry" href="/openday.html">
    <div class="oe-copy">
      <span class="oe-kicker">实训室开放日</span>
      <b>走进 3D 展厅，逐间看设备、项目和导师</b>
      <span class="oe-sub">拖动转视角，W A S D 移动，点悬挂大屏看介绍</span>
    </div>
    <span class="oe-go">进入展厅 ${ICON.arrow}</span>
  </a>` : ''}
  <div class="sec"><div class="lab-list">${labs.map(labRow).join('')}</div></div>`;
};

VIEWS.student.labs.mount = root => {
  root.addEventListener('click', e => {
    const row = e.target.closest('[data-lab]');
    if (row) navigate('s/lab/' + row.dataset.lab);
  });
};

VIEWS.student.lab = async id => {
  const [data, all, labsData] = await Promise.all([api('/labs/' + id), api('/mentors'), api('/labs')]);
  const l = data.lab;
  /* 全院导师按实验室分组排成一圈：同室的人连在一起，转动时一室一室地过。
     排序后从「进来的那个室」开始切，环的起点和页面信息卡对得上。 */
  const sorted = all.mentors.slice().sort((a, b) =>
    String(a.labCode).localeCompare(String(b.labCode)) ||
    String(a.name).localeCompare(String(b.name), 'zh'));
  const start = Math.max(0, sorted.findIndex(m => m.labId === l.id));
  ringMentors = [...sorted.slice(start), ...sorted.slice(0, start)];
  ringLabId = l.id;
  ringLabMap = Object.fromEntries(labsData.labs.map(x => [x.id, x]));
  const canApply = App.boot.current && App.boot.current.code === 'INTENT';

  return `
  <div id="labHeroWrap">${labHeroHtml(ringLabMap[l.id] || l)}</div>
  <div class="sec">
    <div class="sec-head">
      <h2 class="sec-title">导师环</h2>
      <span class="sec-note tnum">全院 ${ringMentors.length} 位</span>
    </div>
    <div class="ring-stage" id="mentorRing" role="group" tabindex="0"
         aria-label="导师环，共 ${ringMentors.length} 位导师，可用左右方向键切换"></div>
    <div class="ring-bar">
      <div class="ring-bar-main">
        <span class="ring-bar-code" id="rbCode"></span>
        <b class="ring-bar-name" id="rbName"></b>
        <span class="ring-bar-meta" id="rbMeta"></span>
      </div>
      <div class="ring-bar-actions">
        <button class="btn btn-sm" id="rbOpen" type="button">看介绍</button>
        ${canApply
          ? `<button class="btn btn-sm btn-primary" id="rbPick" type="button">加入意向</button>`
          : `<span class="tag tag-quiet">不在填报时间窗</span>`}
      </div>
    </div>
  </div>`;
};

VIEWS.student.lab.mount = root => {
  const stage = $('#mentorRing', root);
  const heroWrap = $('#labHeroWrap', root);
  const code = $('#rbCode', root), name = $('#rbName', root), meta = $('#rbMeta', root);
  let current = ringMentors[0];
  let shownLab = ringLabId;

  /* 环转到另一个室，上面那块信息卡跟着换，卡片的「当前室」描边也跟着换 */
  const showLab = labId => {
    const lab = ringLabMap[labId];
    if (!lab || labId === shownLab) return;
    shownLab = labId;
    heroWrap.innerHTML = labHeroHtml(lab);
    const el = $('#labHero', heroWrap);
    if (el) el.classList.add('is-swap');
    $$('.mcard', stage).forEach(c => c.classList.toggle('is-mine', Number(c.dataset.lab) === labId));
  };

  const show = m => {
    if (!m) return;
    current = m;
    code.textContent = m.labCode;
    code.style.setProperty('--lab-fill', labColor(m.labCode));
    code.style.setProperty('--lab', labInk(m.labCode));
    name.textContent = m.name;
    meta.textContent = `${m.title} · ${m.labName}`;
    showLab(m.labId);
  };

  if (stage && ringMentors.length) {
    mountMentorRing(stage, ringMentors, {
      onFocus: show,
      onOpen: m => navigate('s/mentor/' + m.id),
    });
    $$('.mcard', stage).forEach(c => c.classList.toggle('is-mine', Number(c.dataset.lab) === shownLab));
    show(ringMentors[0]);
  }

  root.addEventListener('click', e => {
    const back = e.target.closest('[data-back]');
    if (back) { navigate(back.dataset.back); return; }
    if (e.target.id === 'rbOpen' && current) navigate('s/mentor/' + current.id);
    if (e.target.id === 'rbPick' && current) {
      sessionStorage.setItem('pendingMentor', current.id);
      navigate('s/intent');
    }
  });
};

VIEWS.student.mentor = async id => {
  const [m, mine] = await Promise.all([api('/mentors/' + id), api('/student/intentions')]);
  const submitted = !!mine.submitted;
  const canApply = !submitted && App.boot.current && App.boot.current.code === 'INTENT';
  const interview = App.boot.stages.find(s => s.code === 'INTERVIEW');
  const confirm = App.boot.stages.find(s => s.code === 'CONFIRM');
  return `
  <div class="page-head">
    <div>
      <button class="btn-link" data-back="s/lab/${m.labId}" style="margin-bottom:10px">${ICON.arrowLeft} ${esc(m.labCode)} ${esc(m.labName)}</button>
      <h1 class="page-title mentor-title">${pixelAvatar(m.name, 40)}<span>${esc(m.name)}</span></h1>
      <p class="page-sub">${esc(m.title)}　·　${esc(m.tags)}　·　报名 ${m.applicants} 人</p>
    </div>
    <div class="page-actions">
      ${submitted
        ? `<span class="tag tag-ok">意向已提交</span>`
        : canApply
          ? `<button class="btn btn-primary" data-pick="${m.id}">加入我的意向</button>`
          : `<span class="tag tag-quiet">当前不在填报时间窗</span>`}
    </div>
  </div>

  <div class="mentor-hero">
    <div>
      <div class="intro-body"><p>${esc(m.intro || '这位导师还没有填写介绍。')}</p></div>
    </div>
    <aside>
      <div class="kv">
        <div class="kv-row"><span class="kv-k">所属实训室</span><span class="kv-v">${esc(m.labCode)} ${esc(m.labName)}</span></div>
        <div class="kv-row"><span class="kv-k">当前报名</span><span class="kv-v tnum">${m.applicants} 人</span></div>
        <div class="kv-row"><span class="kv-k">介绍状态</span><span class="kv-v">${m.introStatus === 'APPROVED' ? '已审核' : m.introStatus === 'PENDING' ? '待审核' : '草稿'}</span></div>
      </div>
    </aside>
  </div>
  <div class="sec" style="margin-top:52px">
    <div class="sec-head">
      <h2 class="sec-title">面试与考核安排</h2>
    </div>
    <div class="kv wide" style="max-width:780px">
      <div class="kv-row"><span class="kv-k">面试时间窗</span><span class="kv-v tnum">${interview ? fmtFull(interview.startAt) + ' — ' + fmtFull(interview.endAt) : '待公布'}</span></div>
      <div class="kv-row"><span class="kv-k">考察维度</span><span class="kv-v">学习态度 · 逻辑思维 · 编程基础 · 时间投入</span></div>
      <div class="kv-row"><span class="kv-k">拟录取公布</span><span class="kv-v tnum">${confirm ? fmtFull(confirm.startAt) + ' 起' : '待公布'}</span></div>
    </div>
  </div>`;
};

VIEWS.student.mentor.mount = root => {
  root.addEventListener('click', e => {
    const back = e.target.closest('[data-back]');
    if (back) { navigate(back.dataset.back); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      sessionStorage.setItem('pendingMentor', pick.dataset.pick);
      navigate('s/intent');
    }
  });
};

/* ------------------------------------------------------------ 意向填报 */

/* 简历区的 HTML 单独拎出来，是为了上传/删除之后只重绘这一块。
   以前是整页 render()，代价是页面上所有临时状态一起归零——最要命的是
   学生在「选择导师」下拉里挑好一位、还没点「加入」就去传简历，
   回来发现选择被清空了，看着像"选的导师没了"。 */
function resumeBlock(rsm, locked) {
  return `
  <div class="sec" id="resumeSec">
    <div class="sec-head">
      <h2 class="sec-title">简历附件</h2>
      <span class="sec-note">${rsm ? '导师在报名名单里可以直接下载' : 'PDF / Word · 5MB 以内'}</span>
    </div>
    <div class="drop ${rsm ? 'has-file' : ''} ${locked ? 'is-locked' : ''}" id="resumeDrop">
      <input type="file" id="resumeFile" accept=".pdf,.doc,.docx" hidden>
      ${rsm ? `
        <div class="drop-ico">${esc(rsm.fileName.split('.').pop().toUpperCase())}</div>
        <div class="drop-main">
          <div class="drop-name">${esc(rsm.fileName)}</div>
          <div class="drop-meta">${fmtSize(rsm.size)} · 上传于 ${fmtDateTime(rsm.uploadedAt)}</div>
          ${locked ? '' : '<div class="drop-meta drop-hint">拖入新文件可直接替换</div>'}
        </div>
        <div class="drop-act">
          <button class="btn btn-sm" type="button" data-rsm-dl>下载</button>
          ${locked ? '' : '<button class="btn btn-sm" type="button" data-rsm-del>删除</button>'}
        </div>`
      : `
        <div class="drop-ico">${ICON.file}</div>
        <div class="drop-main">
          <div class="drop-name">${locked ? '没有简历' : '把简历拖到这里'}</div>
          <div class="drop-meta">${locked ? '结果已公示，不再接受材料更新' : '或点击选择文件 · PDF / Word · 不超过 5MB'}</div>
        </div>`}
    </div>
    ${rsm || locked ? '' : '<p class="small muted" style="margin:12px 0 0">可选，但导师在面试和录取时会参考。上传后随时可以替换。</p>'}
  </div>`;
}

/* 简历上传。拖拽区在视图里已按「有没有文件 / 阶段是否关闭」渲染好，这里只管交互。
   表单要用 FormData 直接 fetch，不能走 api()——它固定发 application/json。 */
function mountResume(root) {
  const drop = root.querySelector('#resumeDrop');
  const input = root.querySelector('#resumeFile');
  if (!drop || !input) return;
  const locked = drop.classList.contains('is-locked');

  /* 上传/删除之后只换这一块，不碰整页。
     整页 render() 会把「选择导师」下拉里已经挑好、但还没点「加入」的那位清掉——
     学生会以为自己选的导师丢了。 */
  const swapResume = rsm => {
    const sec = root.querySelector('#resumeSec');
    if (!sec) { render(); return; }
    sec.outerHTML = resumeBlock(rsm, locked);
    mountResume(root);
  };

  const upload = async file => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext)) { toast('只支持 PDF 或 Word', 'err'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('文件不能超过 5MB', 'err'); return; }
    const fd = new FormData();
    fd.append('file', file);
    drop.classList.add('is-busy');
    try {
      const res = await fetch('/api/student/resume', {
        method: 'POST',
        headers: { 'X-Token': App.session.token },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.message) || '上传失败');
      toast('简历已上传', 'ok');
      swapResume(data.resume);
    } catch (err) {
      toast(err.message, 'err');
      drop.classList.remove('is-busy');
    }
  };

  /* input.click() 的 click 会冒泡回 drop，不拦住就会自己点自己 */
  input.addEventListener('click', e => e.stopPropagation());

  if (!locked) {
    drop.addEventListener('click', e => {
      if (e.target.closest('[data-rsm-dl]') || e.target.closest('[data-rsm-del]')) return;
      input.click();
    });
    input.addEventListener('change', () => { upload(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {
      e.preventDefault();
      drop.classList.add('is-over');
    }));
    drop.addEventListener('dragleave', e => {
      if (drop.contains(e.relatedTarget)) return;
      drop.classList.remove('is-over');
    });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('is-over');
      upload(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
  }

  drop.addEventListener('click', e => {
    if (e.target.closest('[data-rsm-dl]')) {
      const name = drop.querySelector('.drop-name').textContent.trim();
      downloadFile('/student/resume/file', name).catch(err => toast(err.message, 'err'));
    }
    if (e.target.closest('[data-rsm-del]')) {
      confirmAction({
        title: '删除这份简历？',
        lines: ['导师在报名名单里就看不到它了'],
        note: '删除不影响已提交的意向，之后还可以重新上传。',
        okText: '删除',
        danger: true,
      }).then(ok => {
        if (!ok) return;
        api('/student/resume', { method: 'DELETE' })
          .then(() => { toast('已删除', 'ok'); swapResume(null); })
          .catch(err => toast(err.message, 'err'));
      });
    }
  });
}

VIEWS.student.intent = async () => {
  const [mine, labsData, mentorData, resumeData] = await Promise.all([
    api('/student/intentions'), api('/labs'), api('/mentors'), api('/student/resume'),
  ]);
  const rsm = resumeData.resume;
  const locked = mine.locked;
  const submitted = mine.submitted;
  const submittedAt = submitted && mine.intentions[0] ? mine.intentions[0].submittedAt : null;

  /* 下拉里挑好但还没点「加入」的那位也要能扛过一次重绘 */
  const pendingPick = sessionStorage.getItem('pendingPick') || '';
  const saved = sessionStorage.getItem('keepSlots');
  let chosen = saved ? JSON.parse(saved) : mine.intentions.map(i => i.mentorId);
  const pending = sessionStorage.getItem('pendingMentor');
  if (!submitted && pending && !chosen.includes(Number(pending)) && chosen.length < 3) {
    chosen.push(Number(pending));
  }
  sessionStorage.removeItem('pendingMentor');
  chosen = chosen.slice(0, 3);

  /* 从导师页点「选他」过来时，选择原本只塞进这一次渲染的 chosen，
     pendingMentor 随即被删掉、也没写回 keepSlots——于是任何一次重绘
     （上传简历、删简历、切页签回来）都会把它抹掉，看着像"选的导师没了"。
     这里把合并后的结果落盘，它才是一次真实的选择。 */
  if (!submitted && chosen.length) {
    sessionStorage.setItem('keepSlots', JSON.stringify(chosen));
  }

  const mentors = mentorData.mentors;
  const byId = Object.fromEntries(mentors.map(m => [m.id, m]));
  const groups = {};
  labsData.labs.forEach(l => groups[l.id] = { lab: l, list: [] });
  mentors.forEach(m => { if (groups[m.labId]) groups[m.labId].list.push(m); });

  const slots = [0, 1, 2].map(i => {
    const mid = chosen[i];
    const m = mid ? byId[mid] : null;
    return `<div class="slot ${m ? 'is-filled' : 'is-empty'}">
      <div class="slot-head">
        <span class="slot-no">意向 ${i + 1}</span>
        ${m && !locked ? `<button class="btn-link" data-del="${m.id}">移除</button>` : ''}
      </div>
      <div class="slot-body">
        ${m ? `<div class="slot-name">${esc(m.name)}</div>
               <div class="slot-lab">${esc(m.labCode)} ${esc(m.labName)} · ${esc(m.title)}</div>`
            : `<div class="slot-empty">空位 · 可以不填满</div>`}
      </div>
    </div>`;
  }).join('');

  const options = Object.values(groups).filter(g => g.list.length).map(g =>
    `<optgroup label="${esc(g.lab.code)} ${esc(g.lab.name)}">
      ${g.list.map(m => `<option value="${m.id}" ${chosen.includes(m.id) ? 'disabled' : ''} ${String(m.id) === pendingPick ? 'selected' : ''}>${esc(m.name)} · ${esc(m.title)}</option>`).join('')}
    </optgroup>`).join('');

  const state = submitted ? '已提交' : locked ? '窗口已关闭' : '填报进行中';
  const stateCls = submitted ? 'tag-ok' : locked ? 'tag-quiet' : 'tag-ink';

  /* 简历不跟意向绑定：意向提交后不能再改，但简历在结果公示前都该能更新——
     导师面试、录取时看的应该是最新那一份。 */
  const resumeLocked = !!(App.boot.current && App.boot.current.seq >= 8);

  return `
  ${pageHead('意向填报',
    submitted ? '已提交，不可增删改。'
              : '最多 3 个平行意向，不分先后。',
    `<span class="tag ${stateCls}">${state}</span>`)}
  ${stageBanner()}
  ${submitted ? `<div class="notice ok" style="margin-bottom:22px"><span class="dot"></span>
    <span><b>已提交，不可修改</b>　${submittedAt ? '提交于 ' + fmtDateTime(submittedAt) : ''}</span></div>` : ''}

  <div class="sec">
    <div class="sec-head">
      <h2 class="sec-title">我的平行意向</h2>
      <span class="sec-note tnum">已选 ${chosen.length} / 3</span>
    </div>
    <div class="slots">${slots}</div>
  </div>

  ${submitted ? '' : `
  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">添加导师</h2></div>
    <div class="field-row" style="align-items:flex-end;max-width:720px">
      <div class="field">
        <label for="pickMentor">选择导师</label>
        <select id="pickMentor" ${locked || chosen.length >= 3 ? 'disabled' : ''}>
          <option value="">— 从实训室里挑一位 —</option>
          ${options}
        </select>
      </div>
      <button class="btn" id="addMentor" ${locked || chosen.length >= 3 ? 'disabled' : ''}>加入</button>
    </div>
  </div>`}

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">调剂意愿</h2></div>
    <div class="grid-2" style="max-width:900px">
      <label class="check ${mine.acceptInner ? 'on' : ''}">
        <input type="checkbox" id="acceptInner" ${mine.acceptInner ? 'checked' : ''} ${locked ? 'disabled' : ''}>
        <span><b>服从实训室内部调剂</b><span>调剂时先在你报过的实训室里换导师，不用等全院统筹。</span></span>
      </label>
      <label class="check ${mine.acceptCross ? 'on' : ''}">
        <input type="checkbox" id="acceptCross" ${mine.acceptCross ? 'checked' : ''} ${locked ? 'disabled' : ''}>
        <span><b>服从全院跨实训室调剂</b><span>本室没有空位时，愿意被安排到其他实训室的空余名额。</span></span>
      </label>
    </div>
    <p class="small muted" style="margin:12px 0 0">两个都不勾，等于跳过前两级，直接进入全院统筹安置——学院仍会为你安排去向。</p>
  </div>

  ${resumeBlock(rsm, resumeLocked)}

  <div class="sec" style="display:flex;gap:14px;align-items:center">
    ${submitted
      ? '<span class="small muted">意向已提交并锁定，不能再改。</span>'
      : locked
        ? `<button class="btn btn-primary" disabled>提交意向</button><span class="small muted">已过填报时间窗，提交与修改都已锁定。</span>`
        : `<button class="btn btn-primary" id="submitIntent">提交意向</button><span class="small muted">只能提交一次，提交后不可修改，请确认后再点。</span>`}
  </div>`;
};

VIEWS.student.intent.mount = root => {
  mountResume(root);

  const state = { ids: JSON.parse(sessionStorage.getItem('keepSlots') || '[]') };
  if (!state.ids.length) {
    root.querySelectorAll('[data-del]').forEach(b => state.ids.push(Number(b.dataset.del)));
  }

  root.querySelectorAll('.check input').forEach(cb => {
    cb.addEventListener('change', () => cb.closest('.check').classList.toggle('on', cb.checked));
  });

  const pick = root.querySelector('#pickMentor');
  if (pick) {
    pick.addEventListener('change', () => {
      sessionStorage.setItem('pendingPick', pick.value || '');
    });
  }

  root.addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      state.ids = state.ids.filter(x => x !== Number(del.dataset.del));
      sessionStorage.setItem('keepSlots', JSON.stringify(state.ids));
      render();
      return;
    }
    if (e.target.id === 'addMentor') {
      const sel = $('#pickMentor');
      if (!sel.value) { toast('先选一位导师'); return; }
      state.ids.push(Number(sel.value));
      sessionStorage.setItem('keepSlots', JSON.stringify(state.ids));
      sessionStorage.removeItem('pendingPick');
      render();
      return;
    }
    if (e.target.id === 'submitIntent') {
      const inner = $('#acceptInner').checked;
      const cross = $('#acceptCross').checked;
      if (!state.ids.length) { toast('至少选一位导师再提交'); return; }
      /* 意向只能提交一次，提交前把「将要锁定的内容」原样列出来给用户核一遍 */
      const lines = $$('.slot.is-filled', root).map(s => {
        const no = s.querySelector('.slot-no').textContent.trim();
        const nm = s.querySelector('.slot-name').textContent.trim();
        const lb = s.querySelector('.slot-lab').textContent.trim();
        return `${no}　${nm} · ${lb}`;
      });
      lines.push('调剂意愿　' + ([inner ? '室内调剂' : '', cross ? '跨室调剂' : ''].filter(Boolean).join(' · ') || '不服从调剂'));
      confirmAction({
        title: '确认提交意向？',
        lines,
        note: '提交后当前轮次不可撤回或修改。',
        okText: '确认提交',
      }).then(ok => {
        if (!ok) return;
        const btn = $('#submitIntent');
        if (btn) btn.disabled = true;
        api('/student/intentions', { method: 'POST', body: { mentorIds: state.ids, acceptInner: inner, acceptCross: cross } })
          .then(() => {
            sessionStorage.removeItem('keepSlots');
            sessionStorage.removeItem('pendingPick');
            toast('意向已提交', 'ok');
            navigate('s/result');
          })
          .catch(err => { toast(err.message, 'err'); if (btn) btn.disabled = false; });
      });
    }
  });
};

/* ------------------------------------------------------------ 我的结果 */

VIEWS.student.result = async () => {
  const data = await api('/student/offers');
  const offers = data.offers;
  const pending = offers.filter(o => o.status === 'PENDING');
  const en = data.enrollment;
  const c = App.boot.current;

  /* 没拿到拟录取的学生，在这一页只能干等——但页面原来只说「面试结束后公布」，
     到了补录、调剂阶段还这么写，学生不知道自己该做什么。按当前阶段说清楚。 */
  const emptyHint = (() => {
    switch (c && c.code) {
      case 'INTERVIEW': return '面试正在进行，导师会在考核结束后提交拟录取。';
      case 'CONFIRM': return '确认阶段结束后，空出来的名额会按递补顺序补位。';
      case 'SUPPLEMENT': return '补录阶段按导师的递补顺序补位，名额一空出来系统自动安排，<b>你不需要操作</b>。';
      case 'ADJUST': return '已进入统筹调剂，按「室内调剂 → 跨室调剂 → 全院统筹」三级依次安排，由学院统一执行，<b>你不需要操作</b>。';
      case 'PUBLISH': return '本轮没有安排到实训室，最终以公示名单为准；如有异议请联系教学办公室。';
      default: return '面试结束后，导师的拟录取会出现在这里。';
    }
  })();

  let head = '';
  if (en) {
    head = `<div class="notice ok"><span class="dot"></span><span><b>去向已确定</b>　${esc(en.labCode)} ${esc(en.labName)} · ${esc(en.mentorName)}
      <br><span class="muted small">${en.source === 'ADJUST' ? '经统筹调剂安排' : en.source === 'WAITLIST' ? '经递补补位' : '面试拟录取后确认'} · ${en.status === 'FINAL' ? '已公示生效' : '待公示'}</span></span></div>`;
  } else if (pending.length >= 2) {
    head = `<div class="notice"><span class="dot"></span><span><b>收到 ${pending.length} 个拟录取，需要你选一个</b>　请在 ${fmtDateTime(data.deadline)} 前确认，逾期视为放弃。</span></div>`;
  } else if (pending.length === 1) {
    head = `<div class="notice ok"><span class="dot"></span><span><b>收到 1 个拟录取</b>　${esc(pending[0].mentorName)} · ${esc(pending[0].labName)}
      <br><span class="muted small">可以在 ${fmtDateTime(data.deadline)} 前手动确认，也可以等系统自动确认。</span></span></div>`;
  } else if (offers.length === 0) {
    head = `<div class="notice"><span class="dot"></span><span><b>还没有收到拟录取</b>　${emptyHint}</span></div>`;
  } else {
    head = `<div class="notice"><span class="dot"></span><span><b>手上的拟录取都已处理完</b>　${emptyHint}</span></div>`;
  }

  const cards = offers.map(o => `
    <div class="offer ${o.status === 'CONFIRMED' ? 'chosen' : ''}">
      <div>
        <div class="offer-name">${esc(o.mentorName)}</div>
        <div class="offer-meta">${esc(o.labName)} · 第 ${o.roundNo} 轮 · 面试 ${n(o.score)} 分</div>
      </div>
      <div class="offer-quote">${esc(o.comment || '')}</div>
      <div class="offer-act" style="text-align:right">
        ${o.status === 'PENDING' && !en
          ? `<button class="btn btn-primary btn-sm" data-confirm="${o.id}">确认去这里</button>`
          : `<span class="tag ${o.status === 'CONFIRMED' ? 'tag-ink' : o.status === 'EXPIRED' ? 'tag-quiet' : 'tag-quiet'}">${o.status === 'CONFIRMED' ? '已确认' : o.status === 'EXPIRED' ? '已逾期' : o.status === 'RELEASED' ? '已释放' : '待确认'}</span>`}
      </div>
    </div>`).join('');

  return `
  ${pageHead('我的结果', '', '')}
  ${head ? `<div class="sec">${head}</div>` : ''}
  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">${en ? '先前的拟录取' : '收到的拟录取'}</h2><span class="sec-note tnum">共 ${offers.length} 条${en ? ' · 去向已由递补 / 调剂安排' : ''}</span></div>
    ${offers.length ? `<div class="offer-list">${cards}</div>`
      : `<div class="empty"><b>暂无记录</b>当前阶段为「${esc(c ? c.name : '—')}」，面试结束后这里才会有内容。</div>`}
  </div>`;
};

VIEWS.student.result.mount = root => {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-confirm]');
    if (!b) return;
    b.disabled = true;
    api('/student/offers/' + b.dataset.confirm + '/confirm', { method: 'POST' })
      .then(() => { toast('已确认去向', 'ok'); render(); })
      .catch(err => { toast(err.message, 'err'); b.disabled = false; });
  });
};

/* ------------------------------------------------------------ 公示 */

VIEWS.student.notice = async () => {
  const data = await api('/announcement');
  const published = data.announcements.find(a => a.status === 'PUBLISHED');
  const total = data.groups.reduce((s, g) => s + g.rows.length, 0);
  return `
  ${pageHead('公示名单', published ? `${published.title} · 批次 ${published.batchNo} · 公示 1 天` : '最终录取名单尚未发布',
    published ? `<span class="tag tag-ok">公示中</span>` : `<span class="tag tag-quiet">未发布</span>`)}
  <div class="sec">
    ${total === 0 ? `<div class="empty"><b>还没有可公示的名单</b>补录与统筹调剂结束后，学院会在这里发布最终名单。</div>` : `
      <p class="lede" style="margin-bottom:26px">共 ${total} 人已确定去向。公示期内如有异议，可向教学办公室书面提出。</p>
      ${data.groups.filter(g => g.rows.length).map(g => `
        <div class="sec">
          <div class="sec-head"><h2 class="sec-title">${esc(g.code)}　${esc(g.name)}</h2><span class="sec-note tnum">${g.rows.length} 人</span></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>导师</th><th>录取方式</th><th>状态</th></tr></thead>
            <tbody>${g.rows.map(r => `<tr>
              <td class="tnum">${esc(r.studentNo)}</td>
              <td class="cell-strong">${esc(r.studentName)}</td>
              <td class="cell-sub">${esc(r.className)}</td>
              <td>${esc(r.mentorName)}</td>
              <td class="cell-sub">${r.source === 'ADJUST' ? '统筹调剂' : r.source === 'WAITLIST' ? '递补' : '直接录取'}</td>
              <td>${r.status === 'FINAL' ? '<span class="tag tag-ok">已生效</span>' : '<span class="tag tag-quiet">待公示</span>'}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>`).join('')}`}
  </div>`;
};
