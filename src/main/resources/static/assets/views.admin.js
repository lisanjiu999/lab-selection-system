/* 管理员端 */

/* 公示页的待公示人数：视图渲染时记下，mount 里给二次确认用 */
let pendingNoticeTotal = 0;
/* 调剂页的池子人数，同上 */
let pendingAdjustPool = 0;
/* 看板的「尚未落定」人数，推进确认卡里要用来提醒 */
let pendingUnplaced = 0;

VIEWS.admin.dashboard = async () => {
  const d = await api('/admin/dashboard');
  const t = d.totals;
  const c = App.boot.current;
  const next = App.boot.stages.find(s => s.seq === (c ? c.seq + 1 : 1));
  pendingUnplaced = t.unplaced;
  const pct = t.students ? Math.round((t.enrolled / t.students) * 100) : 0;

  return `
  ${pageHead('录取看板', '名额、报名、确认与递补。',
    `<button class="btn" data-goto-clock type="button">调节演示时间</button>
     <button class="btn btn-primary" id="advanceBtn" ${next ? '' : 'disabled'}>推进到「${next ? esc(next.name) : '已结束'}」</button>`)}

  <div class="sec">
    <p class="lede">全院 ${t.students} 名学生，${t.submitted} 人已提交意向，共收到 ${t.applicants} 份报名；目前 ${t.enrolled} 人已确认去向（占 ${pct}%），${t.unplaced} 人尚未落定，其中 ${t.adjusted} 人经统筹调剂安排。${t.pending} 条拟录取等待学生确认。</p>
  </div>

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">分实训室</h2></div>
    <div class="table-wrap"><table class="data">
      <thead><tr>
        <th>实训室</th><th class="num" style="width:70px">名额</th><th class="num" style="width:70px">报名</th><th class="num" style="width:78px">拟录取</th>
        <th class="num" style="width:70px">递补</th><th class="num" style="width:78px">已确认</th><th class="num" style="width:96px">剩余</th><th style="width:156px">占用</th>
      </tr></thead>
      <tbody>${d.labs.map(l => `<tr>
        <td><div class="cell-lab"><i style="background:${labColor(l.code)}"></i><span class="cell-strong">${esc(l.code)}</span><span>${esc(l.name)}</span></div><div class="cell-sub">${esc(l.direction)}</div></td>
        <td class="num">${l.quota}</td>
        <td class="num">${l.applicants}</td>
        <td class="num">${l.admits}</td>
        <td class="num">${l.waits}</td>
        <td class="num cell-strong">${l.enrolled}</td>
        <td class="num ${l.remaining === 0 ? 'cell-strong' : ''}">${l.remaining}${l.remaining === 0 ? '<span class="tag tag-red" style="margin-left:8px">已满</span>' : ''}</td>
        <td><div class="cell-meter">${meter(l.enrolled, l.quota)}<b>${l.quota ? Math.round(l.enrolled / l.quota * 100) : 0}%</b></div></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">当前阶段</h2></div>
    <div class="kv wide" style="max-width:780px">
      <div class="kv-row"><span class="kv-k">阶段</span><span class="kv-v">${esc(c ? c.seq + '. ' + c.name : '—')}</span></div>
      <div class="kv-row"><span class="kv-k">说明</span><span class="kv-v">${esc(c ? c.summary : '')}</span></div>
      <div class="kv-row"><span class="kv-k">时间窗</span><span class="kv-v tnum">${fmtFull(c ? c.startAt : '')} — ${fmtFull(c ? c.endAt : '')}</span></div>
      <div class="kv-row"><span class="kv-k">演示时钟</span><span class="kv-v tnum">${fmtFull(App.boot.demoNow)}
        <button class="btn-link" data-goto-clock type="button" style="margin-left:10px">调节</button></span></div>
    </div>
  </div>`;
};

VIEWS.admin.dashboard.mount = root => {
  root.querySelectorAll('[data-goto-clock]').forEach(el =>
    el.addEventListener('click', () => navigate('a/stages')));
  const btn = $('#advanceBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const cur = App.boot.current;
    const next = App.boot.stages.find(s => s.seq === (cur ? cur.seq + 1 : 1));
    const ok = await confirmAction({
      title: '推进到下一阶段？',
      lines: [
        '当前：' + (cur ? `第 ${cur.seq} 阶段 · ${cur.name}` : '尚未开始'),
        '推进到：' + (next ? `第 ${next.seq} 阶段 · ${next.name}` : '全部结束'),
        ...(cur && cur.code === 'ADJUST' ? ['尚未落定：' + pendingUnplaced + ' 人'] : []),
      ],
      note: cur && cur.code === 'ADJUST'
        ? '离开调剂阶段后不再安排去向。若还有未落定学生，请先回「统筹调剂」确认落库。'
        : '推进会顺带结算上一阶段（生成拟录取、释放逾期名额、按序递补），且不能回退。',
      okText: '推进',
    });
    if (!ok) return;
    btn.disabled = true;
    api('/admin/stage/advance', { method: 'POST' })
      .then(async res => {
        toast('已进入「' + res.stage + '」' + (res.log.length ? '：' + res.log.join('；') : ''), 'ok');
        await boot();
        render();
      })
      .catch(e => { toast(e.message, 'err'); btn.disabled = false; });
  });
};

VIEWS.admin.base = async () => {
  const [labsData, mentorData] = await Promise.all([api('/labs'), api('/mentors')]);
  const labs = labsData.labs;
  const labOptions = labs.map(l => `<option value="${l.id}">${esc(l.code)} ${esc(l.name)}</option>`).join('');

  const introTag = m => m.introStatus === 'APPROVED'
    ? '<span class="tag tag-ok">已审核</span>'
    : m.introStatus === 'PENDING'
      ? '<span class="tag tag-ink">待审核</span>'
      : '<span class="tag tag-quiet">草稿</span>';

  return `
  ${pageHead('基础数据', '实训室与导师名单。职称、方向、实训室、名额、介绍都可以直接改。', '')}

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">导师</h2><span class="sec-note tnum">${mentorData.mentors.length} 位在岗</span></div>
    <div class="table-wrap mentor-wrap"><table class="data mentor-table">
      <thead><tr><th style="width:11%">姓名</th><th style="width:8%">职称</th><th style="width:15%">方向</th><th style="width:16%">所属实训室</th><th class="num" style="width:6%">名额</th><th class="num" style="width:6%">剩余</th><th class="col-intro" style="width:26%">介绍</th><th style="width:12%;text-align:right">操作</th></tr></thead>
      <tbody>${mentorData.mentors.map(m => `<tr>
        <td><div class="cell-who">${pixelAvatar(m.name, 20)}<span class="cell-strong">${esc(m.name)}</span></div></td>
        <td class="cell-sub">${esc(m.title)}</td>
        <td class="cell-sub cell-wrap" style="max-width:220px">${esc(m.tags)}</td>
        <td>
          <select data-move="${m.id}" style="min-width:144px">
            ${labs.map(l => `<option value="${l.id}" ${l.id === m.labId ? 'selected' : ''}>${esc(l.code)} ${esc(l.name)}</option>`).join('')}
          </select>
        </td>
        <td class="num">${m.quota}</td>
        <td class="num">${m.remaining}</td>
        <td class="cell-intro">
          <button class="intro-cell" type="button" data-edit="${m.id}" title="点开编辑并查看全文">
            <span class="intro-line">${esc(m.intro || '（还没有介绍，点这里写一段）')}</span>
          </button>
          ${introTag(m)}
        </td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" data-edit="${m.id}">编辑</button>
          <button class="btn btn-sm" data-del="${m.id}">停用</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">新增导师</h2></div>
    <div class="field-row" style="max-width:1000px;align-items:flex-end;flex-wrap:wrap">
      <div class="field" style="flex:1.4"><label>姓名</label><input type="text" id="nName" placeholder="张…"></div>
      <div class="field" style="flex:1"><label>职称</label><input type="text" id="nTitle" placeholder="副教授"></div>
      <div class="field" style="flex:1.6"><label>方向</label><input type="text" id="nTags" placeholder="方向一 · 方向二"></div>
      <div class="field" style="flex:1.4"><label>实训室</label><select id="nLab">${labOptions}</select></div>
      <div class="field" style="flex:.6"><label>名额</label><input type="number" id="nQuota" value="3" min="1" max="10"></div>
      <button class="btn btn-primary" id="addMentorBtn">新增</button>
    </div>
  </div>`;
};

/* 导师档案编辑弹窗。
   名额和剩余是同一个数的两种写法，所以两个框互相联动：
   已录取人数由后端一并给出（enrolled），改哪一侧都能立刻算出另一侧。 */
function openMentorEditor(m, labs) {
  const box = document.createElement('div');
  box.className = 'modal';
  box.innerHTML = `<div class="modal-card mentor-card" role="dialog" aria-modal="true" aria-labelledby="mEditTitle">
    <div class="modal-head">
      <h2 id="mEditTitle">编辑导师 · ${esc(m.name)}</h2>
      <button class="modal-x" type="button" aria-label="关闭">${ICON.close}</button>
    </div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label for="eTitle">职称</label><input id="eTitle" type="text" value="${esc(m.title)}" placeholder="副教授"></div>
        <div class="field" style="flex:1.5"><label for="eTags">方向</label><input id="eTags" type="text" value="${esc(m.tags)}" placeholder="方向一 · 方向二"></div>
      </div>
      <div class="field">
        <label for="eLab">所属实训室</label>
        <select id="eLab">${labs.map(l => `<option value="${l.id}" ${l.id === m.labId ? 'selected' : ''}>${esc(l.code)} ${esc(l.name)}</option>`).join('')}</select>
        ${m.enrolled > 0 ? `<span class="field-hint">名下已有 ${m.enrolled} 名学生，先完成调剂才能换实训室。</span>` : ''}
      </div>
      <div class="field-row">
        <div class="field"><label for="eQuota">名额</label><input id="eQuota" type="number" min="0" max="50" value="${m.quota}"></div>
        <div class="field"><label for="eRemain">剩余</label><input id="eRemain" type="number" min="0" max="50" value="${m.remaining}"></div>
      </div>
      <p class="form-note">剩余 = 名额 − 已录取${m.enrolled ? `（已录取 ${m.enrolled} 人）` : ''}。改任一侧，另一侧会自动跟着变。</p>
      <div class="field">
        <label for="eIntro">介绍<span class="label-note">学生会看到这段</span></label>
        <textarea id="eIntro" rows="9" placeholder="写一段研究方向、在做的项目、对学生的期待…">${esc(m.intro || '')}</textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" data-close type="button">取消</button>
      <button class="btn btn-primary" data-save type="button">保存</button>
    </div>
  </div>`;
  document.body.appendChild(box);

  const qEl = box.querySelector('#eQuota');
  const rEl = box.querySelector('#eRemain');
  const enrolled = m.enrolled || 0;

  qEl.addEventListener('input', () => {
    rEl.value = Math.max(0, (Number(qEl.value) || 0) - enrolled);
  });
  rEl.addEventListener('input', () => {
    qEl.value = Math.max(0, (Number(rEl.value) || 0) + enrolled);
  });

  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  box.addEventListener('click', async e => {
    if (e.target === box || e.target.closest('[data-close]') || e.target.closest('.modal-x')) return close();
    if (!e.target.closest('[data-save]')) return;

    const body = {
      title: box.querySelector('#eTitle').value.trim(),
      tags: box.querySelector('#eTags').value.trim(),
      labId: Number(box.querySelector('#eLab').value),
      quota: Number(qEl.value),
      intro: box.querySelector('#eIntro').value,
    };
    if (!body.title) { toast('职称不能为空'); return; }

    const btn = e.target.closest('[data-save]');
    btn.disabled = true;
    try {
      await api('/admin/mentors/' + m.id, { method: 'PUT', body });
      close();
      toast('已保存', 'ok');
      render();
    } catch (err) {
      btn.disabled = false;
      toast(err.message, 'err');
    }
  });

  setTimeout(() => box.querySelector('#eTitle').focus(), 40);
}

VIEWS.admin.base.mount = root => {
  root.addEventListener('change', e => {
    const sel = e.target.closest('[data-move]');
    if (!sel) return;
    api('/admin/mentors/' + sel.dataset.move + '/move', { method: 'PUT', body: { labId: Number(sel.value) } })
      .then(() => toast('已移动到新实训室', 'ok'))
      .catch(err => { toast(err.message, 'err'); render(); });
  });

  root.addEventListener('click', async e => {
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      /* 表格里只有截断的两行，全文在弹窗里 */
      const id = Number(edit.dataset.edit);
      const [mentorsData, labsData] = await Promise.all([api('/mentors'), api('/labs')]);
      const m = mentorsData.mentors.find(x => x.id === id);
      if (!m) { toast('导师不存在，刷新一下'); return; }
      openMentorEditor(m, labsData.labs);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const name = del.closest('tr').querySelector('.cell-strong').textContent.trim();
      const ok = await confirmAction({
        title: '停用这位导师？',
        lines: ['导师：' + name, '停用后学生端不再展示'],
        note: '名下已有学生的导师不能停用；已报名学生需要另行处理。',
        okText: '停用',
        danger: true,
      });
      if (!ok) return;
      api('/admin/mentors/' + del.dataset.del, { method: 'DELETE' })
        .then(() => { toast('已停用', 'ok'); render(); })
        .catch(err => toast(err.message, 'err'));
      return;
    }
    if (e.target.id === 'addMentorBtn') {
      const body = {
        name: $('#nName').value.trim(),
        title: $('#nTitle').value.trim(),
        tags: $('#nTags').value.trim(),
        labId: Number($('#nLab').value),
        quota: Number($('#nQuota').value),
      };
      if (!body.name) { toast('先填姓名'); return; }
      api('/admin/mentors', { method: 'POST', body })
        .then(() => { toast('已新增', 'ok'); render(); })
        .catch(err => toast(err.message, 'err'));
    }
  });
};

/* 后端返回 2026-11-02T09:30:00，datetime-local 只吃 2026-11-02T09:30 */
const localInput = iso => String(iso || '').slice(0, 16);
/* Date → 本地时区的 datetime-local 值（不能用 toISOString，那是 UTC） */
const stamp = d => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

VIEWS.admin.stages = async () => {
  const stages = App.boot.stages;
  const cur = App.boot.current;
  const next = cur ? stages.find(s => s.seq === cur.seq + 1) : null;
  return `
  ${pageHead('阶段控制', '八个阶段由时间窗驱动。')}

  <div class="sec">
    <div class="clock-card">
      <div class="clock-head">
        <div class="clock-copy">
          <h3>演示时钟</h3>
        </div>
        <div class="clock-read">
          <b class="tnum">${fmtFull(App.boot.demoNow)}</b>
          <span>${cur ? '第 ' + cur.seq + ' 阶段 · ' + esc(cur.name) : '未进入任何阶段'}</span>
        </div>
      </div>
      <div class="clock-row">
        <label class="clock-field">
          <span>拨到</span>
          <input type="datetime-local" id="clockAt" step="60" value="${localInput(App.boot.demoNow)}">
        </label>
        <button class="btn btn-primary" id="clockApply">应用</button>
        <div class="clock-quick">
          <button class="btn btn-sm" data-shift="-1440" type="button">前一天</button>
          <button class="btn btn-sm" data-shift="1440" type="button">后一天</button>
          <button class="btn btn-sm" data-jump="start" type="button">本阶段开始</button>
          <button class="btn btn-sm" data-jump="next" type="button" ${next ? '' : 'disabled'}>下一阶段</button>
        </div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">时间窗</h2></div>
    <div class="table-wrap"><table class="data stages-table">
      <thead><tr>
        <th class="num" style="width:56px">序号</th><th>阶段</th>
        <th style="width:196px">开始</th><th style="width:196px">结束</th>
        <th style="width:92px">状态</th>
      </tr></thead>
      <tbody>${stages.map(s => {
        const st = stageState(s, cur);
        return `<tr class="${st === 'active' ? 'is-active' : ''}">
          <td class="num tnum">${String(s.seq).padStart(2, '0')}</td>
          <td>
            <div class="cell-strong">${esc(s.name)}</div>
            <div class="cell-sub">${esc(s.summary)}</div>
          </td>
          <td><input type="datetime-local" class="win-input" step="60"
                data-id="${s.id}" data-f="startAt" value="${localInput(s.startAt)}" aria-label="${esc(s.name)} 开始时间"></td>
          <td><input type="datetime-local" class="win-input" step="60"
                data-id="${s.id}" data-f="endAt" value="${localInput(s.endAt)}" aria-label="${esc(s.name)} 结束时间"></td>
          <td>${st === 'active' ? '<span class="tag tag-ink">进行中</span>' : st === 'done' ? '<span class="tag tag-ok">已结束</span>' : '<span class="tag tag-quiet">未开始</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>

  <div class="sec">
    <div class="notice"><span class="dot"></span><span>
      「推进到下一阶段」和「拨时钟」都会结算已经跨过的阶段（生成拟录取、释放逾期名额、递补补位、统筹调剂落库）。结算按时间判断，拨到哪里就补到哪里，不会因为换了入口而漏掉。
    </span></div>
  </div>`;
};

VIEWS.admin.stages.mount = root => {
  const input = $('#clockAt');

  const applyClock = async at => {
    if (!at) { toast('先选一个时间'); return; }
    try {
      const r = await api('/admin/stage/clock', { method: 'PUT', body: { at } });
      await boot();
      render();
      /* 拨时钟会补结算跨过的阶段，结果必须说出来——不然学生那边凭空多出拟录取，
         管理员不知道是哪一步做的。 */
      const did = (r && r.log && r.log.length) ? '，' + r.log.join('；') : '';
      toast('时钟已拨到 ' + fmtFull(at) + did, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };

  $('#clockApply').addEventListener('click', () => applyClock(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyClock(input.value); } });

  root.querySelectorAll('[data-shift]').forEach(btn => btn.addEventListener('click', () => {
    const d = new Date(App.boot.demoNow);
    d.setMinutes(d.getMinutes() + Number(btn.dataset.shift));
    applyClock(stamp(d));
  }));

  root.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => {
    const cur = App.boot.current;
    if (!cur) return;
    if (btn.dataset.jump === 'start') { applyClock(localInput(cur.startAt)); return; }
    const nx = App.boot.stages.find(s => s.seq === cur.seq + 1);
    if (nx) applyClock(localInput(nx.startAt));
  }));

  root.querySelectorAll('.win-input').forEach(el => el.addEventListener('change', async () => {
    const tr = el.closest('tr');
    const start = tr.querySelector('[data-f="startAt"]').value;
    const end = tr.querySelector('[data-f="endAt"]').value;
    if (!start || !end) return;
    try {
      await api('/admin/stage/' + el.dataset.id + '/window', { method: 'PUT', body: { startAt: start, endAt: end } });
      await boot();
      render();
      toast('时间窗已更新', 'ok');
    } catch (e) {
      toast(e.message, 'err');
      render();
    }
  }));
};

VIEWS.admin.adjust = async () => {
  const data = await api('/admin/adjust/preview');
  const s = data.stat;
  pendingAdjustPool = s.pool;
  const groups = { 1: '室内调剂', 2: '跨室调剂', 3: '最终安置' };
  const c = App.boot.current;
  const inAdjust = c && c.code === 'ADJUST';
  const canCommit = inAdjust && s.pool > 0;
  return `
  ${pageHead('统筹调剂', '室内调剂 → 跨室调剂 → 全院统筹，试算确认后落库。',
    `<button class="btn btn-primary" id="commitBtn" ${canCommit ? '' : 'disabled'}>确认落库</button>`)}
  ${inAdjust ? '' : `<div class="notice" style="margin-bottom:22px"><span class="dot"></span><span>当前不在「统筹调剂录取」阶段，这一页只做试算，不写库。演示时可把演示时钟拨到 11-06 08:00 之后。</span></div>`}

  <div class="sec">
    <p class="lede">调剂池 ${s.pool} 人。${[
      s.level1 ? `${s.level1} 人可在本实训室内换导师解决` : '',
      s.level2 ? `${s.level2} 人需要跨实训室安排` : '',
      s.level3 ? `${s.level3} 人未服从调剂，直接统筹安置` : '',
      s.failed ? `${s.failed} 人全院名额已满，需人工处理` : ''
    ].filter(Boolean).join('；')}${[s.level1, s.level2, s.level3, s.failed].some(Boolean) ? '。' : ''}</p>
  </div>

  ${data.rows.length ? `<div class="notice" style="margin-bottom:18px"><span class="dot"></span><span>
    下表是<b>试算结果，还没写入录取表</b>。点「确认落库」才真正生效；直接推进到公示阶段也会自动执行一次。
  </span></div>` : ''}

  <div class="sec">
    ${data.rows.length === 0 ? `<div class="empty"><b>调剂池是空的</b>所有学生都已确定去向，无需调剂。</div>` : `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>优先级</th><th>建议去向</th><th>依据</th></tr></thead>
      <tbody>${data.rows.map(r => `<tr>
        <td class="tnum cell-sub">${esc(r.no)}</td>
        <td><div class="cell-who">${pixelAvatar(r.name, 15)}<span class="cell-strong">${esc(r.name)}</span></div></td>
        <td class="cell-sub">${esc(r.className)}</td>
        <td>${r.level === 1 ? '<span class="tag tag-ok">一 · 室内</span>' : r.level === 2 ? '<span class="tag">二 · 跨室</span>' : '<span class="tag tag-quiet">三 · 统筹</span>'}</td>
        <td>${r.mentorName ? esc(r.labCode + ' · ' + r.mentorName) : '<span class="muted">待人工处理</span>'}</td>
        <td class="cell-sub">${esc(r.reason)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>`;
};

VIEWS.admin.adjust.mount = root => {
  const btn = $('#commitBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const ok = await confirmAction({
      title: '确认执行调剂？',
      lines: ['调剂池：' + pendingAdjustPool + ' 人'],
      note: '会写入录取表与调剂记录，操作留痕，不能撤回。',
      okText: '确认落库',
    });
    if (!ok) return;
    btn.disabled = true;
    api('/admin/adjust/commit', { method: 'POST' })
      .then(res => { toast('已安排 ' + res.count + ' 人', 'ok'); render(); })
      .catch(e => { toast(e.message, 'err'); btn.disabled = false; });
  });
};

VIEWS.admin.notice = async () => {
  const data = await api('/announcement');
  const total = data.groups.reduce((s, g) => s + g.rows.length, 0);
  pendingNoticeTotal = total;
  return `
  ${pageHead('公示管理', '生成公示名单并发布。',
    `<button class="btn btn-primary" id="publishBtn" ${total === 0 ? 'disabled' : ''}>发布公示</button>`)}

  <div class="sec">
    <div class="field" style="max-width:720px;margin-bottom:0">
      <label for="annTitle">公示标题</label>
      <input type="text" id="annTitle" maxlength="60" placeholder="2026 年秋季学期实训室进组选拔录取名单公示">
      <p class="small muted" style="margin:0">留空则按系统默认格式生成，学期与届次可自行填写。</p>
    </div>
  </div>

  <div class="sec">
    <div class="kv" style="max-width:720px">
      <div class="kv-row"><span class="kv-k">待公示人数</span><span class="kv-v tnum">${total} 人</span></div>
      <div class="kv-row"><span class="kv-k">已发布批次</span><span class="kv-v">${data.announcements.length ? data.announcements.map(a => esc(a.batchNo)).join('、') : '无'}</span></div>
      <div class="kv-row"><span class="kv-k">异议</span><span class="kv-v">${data.announcements.reduce((s, a) => s + a.objections, 0)} 条</span></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">名单预览</h2></div>
    ${total === 0 ? `<div class="empty"><b>暂无可公示名单</b>需先完成确认或调剂。</div>` : `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>实训室</th><th class="num">人数</th><th>学生</th></tr></thead>
      <tbody>${data.groups.filter(g => g.rows.length).map(g => `<tr>
        <td class="cell-strong">${esc(g.code)}　${esc(g.name)}</td>
        <td class="num">${g.rows.length}</td>
        <td class="cell-sub">${g.rows.map(r => esc(r.studentName)).join('、')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>`;
};

VIEWS.admin.notice.mount = root => {
  const btn = $('#publishBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const title = ($('#annTitle').value || '').trim();
    const ok = await confirmAction({
      title: '发布公示？',
      lines: [
        '待公示：' + pendingNoticeTotal + ' 人',
        '标题：' + (title || '系统默认标题'),
      ],
      note: '发布后录取结果转为正式，生成新的公示批次，不可撤回。',
      okText: '发布',
    });
    if (!ok) return;
    btn.disabled = true;
    api('/admin/announce', { method: 'POST', body: { title } })
      .then(() => { toast('公示已发布', 'ok'); render(); })
      .catch(e => { toast(e.message, 'err'); btn.disabled = false; });
  });
};
