/* 导师端 */

VIEWS.mentor.overview = async () => {
  const o = await api('/mentor/overview');
  const c = App.boot.current;
  const todoScore = Math.max(0, o.applicants - o.scored);
  const todoDecide = Math.max(0, o.scored - o.admits - o.waits);
  const inInterview = c && c.code === 'INTERVIEW';

  const stat = (label, value, hint, accent) => `
    <div class="stat" style="--accent:${accent}">
      <span class="stat-label">${esc(label)}</span>
      <b class="stat-value">${value}</b>
      <span class="stat-hint">${esc(hint)}</span>
    </div>`;

  return `
  ${pageHead('导师工作台', `${o.mentor.name} · ${o.mentor.title} · ${o.lab ? o.lab.code + ' ' + o.lab.name : ''}`,
    inInterview ? `<button class="btn btn-primary" data-go="m/decision">去处理录取决策</button>` : '')}
  ${stageBanner()}

  <div class="sec">
    <div class="stat-grid">
      ${stat('报名人数', o.applicants, '全部须参加面试', '#6FA8F5')}
      ${stat('已评分', `${o.scored} <small>/ ${o.applicants}</small>`, todoScore ? `${todoScore} 人待评` : '已全部完成', '#B08CF0')}
      ${stat('拟录取', `${o.admits} <small>/ ${o.mentor.quota}</small>`, `递补 ${o.waits} 人 · 已入组 ${o.enrolled} 人`, '#F2C14E')}
    </div>
  </div>

  <div class="sec">
    <div class="sec-head"><h2 class="sec-title">待办</h2></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th style="width:150px">事项</th><th>说明</th><th class="num" style="width:90px">数量</th><th style="width:96px"></th></tr></thead>
      <tbody>
        <tr>
          <td class="cell-strong">面试评分</td>
          <td class="cell-sub">四维评分与评语，仅本导师可见</td>
          <td class="num">${todoScore}</td>
          <td style="text-align:right"><button class="btn btn-sm" data-go="m/score">去评分</button></td>
        </tr>
        <tr>
          <td class="cell-strong">录取决策</td>
          <td class="cell-sub">拟录取、递补、内部调剂候选</td>
          <td class="num">${todoDecide}</td>
          <td style="text-align:right"><button class="btn btn-sm" data-go="m/decision">去决策</button></td>
        </tr>
        <tr>
          <td class="cell-strong">个人介绍</td>
          <td class="cell-sub">学生可见，提交后需审核</td>
          <td class="num">${o.mentor.introStatus === 'APPROVED' ? '已审核' : '待完善'}</td>
          <td style="text-align:right"><button class="btn btn-sm" data-go="m/profile">去编辑</button></td>
        </tr>
      </tbody>
    </table></div>
  </div>`;
};

VIEWS.mentor.overview.mount = root => {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) navigate(b.dataset.go);
  });
};

VIEWS.mentor.profile = async () => {
  const o = await api('/mentor/overview');
  const m = o.mentor;
  return `
  ${pageHead('我的介绍', '学生看到的自我介绍。',
    `<span class="tag ${m.introStatus === 'APPROVED' ? 'tag-ok' : 'tag-quiet'}">${m.introStatus === 'APPROVED' ? '已审核' : m.introStatus === 'PENDING' ? '待审核' : '草稿'}</span>`)}

  <div class="grid-2">
    <div>
      <div class="field" style="margin-bottom:18px">
        <label for="pTitle">职称</label>
        <input type="text" id="pTitle" value="${esc(m.title)}">
      </div>
      <div class="field" style="margin-bottom:18px">
        <label for="pTags">方向标签</label>
        <input type="text" id="pTags" value="${esc(m.tags)}" placeholder="用 · 分隔，例如 多模态感知 · 边缘推理">
      </div>
      <div class="field">
        <label for="pIntro">介绍正文</label>
        <textarea id="pIntro" rows="11" placeholder="在做什么项目、学生进来先做什么、怎么带、希望什么样的人">${esc(m.intro || '')}</textarea>
      </div>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn btn-primary" id="saveProfile">提交审核</button>
      </div>
    </div>
    <aside>
      <div class="sec-head"><h2 class="sec-title">学生看到的样子</h2></div>
      <div class="kv" style="margin-bottom:20px">
        <div class="kv-row"><span class="kv-k">所属实训室</span><span class="kv-v">${esc(o.lab ? o.lab.code + ' ' + o.lab.name : '')}</span></div>
        <div class="kv-row"><span class="kv-k">招录名额</span><span class="kv-v tnum">${m.quota} 人</span></div>
        <div class="kv-row"><span class="kv-k">当前报名</span><span class="kv-v tnum">${o.applicants} 人</span></div>
      </div>
      <div id="preview" class="intro-body" style="margin-top:0">${esc(m.intro || '（还没有内容）')}</div>
    </aside>
  </div>`;
};

VIEWS.mentor.profile.mount = root => {
  const intro = $('#pIntro');
  intro.addEventListener('input', () => {
    $('#preview').textContent = intro.value || '（还没有内容）';
  });
  $('#saveProfile').addEventListener('click', () => {
    api('/mentor/profile', {
      method: 'PUT',
      body: { title: $('#pTitle').value, tags: $('#pTags').value, intro: $('#pIntro').value },
    }).then(() => { toast('已提交审核', 'ok'); render(); })
      .catch(e => toast(e.message, 'err'));
  });
};

VIEWS.mentor.applicants = async () => {
  const data = await api('/mentor/applicants');
  const rows = data.applicants;
  return `
  ${pageHead('报名学生', `共 ${rows.length} 人填报了你。`,
    `<span class="tag tnum">名额 ${data.quota} · 已确认 ${data.enrolled}</span>`)}
  ${stageBanner()}
  <div class="sec">
    ${rows.length === 0 ? `<div class="empty"><b>还没有学生填报你</b>填报阶段结束后这里会出现名单。</div>` : `
    <div class="table-wrap"><table class="data">
      <thead><tr>
        <th>学号</th><th>姓名</th><th>班级</th><th>技能</th><th>简历</th>
        <th>调剂意愿</th><th class="num">面试分</th><th>决策</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td class="tnum cell-sub">${esc(r.no)}</td>
        <td><div class="cell-who">${pixelAvatar(r.name, 15)}<span class="cell-strong">${esc(r.name)}</span></div></td>
        <td class="cell-sub">${esc(r.className)}</td>
        <td class="cell-sub">${esc(r.skill)}</td>
        <td>${resumeLink(r)}</td>
        <td class="cell-sub">${r.acceptInner ? '室内' : ''}${r.acceptInner && r.acceptCross ? ' · ' : ''}${r.acceptCross ? '跨室' : ''}${!r.acceptInner && !r.acceptCross ? '<span class="muted">不服从</span>' : ''}</td>
        <td class="num">${r.score === null ? '<span class="muted">未评</span>' : r.score}</td>
        <td>${decisionTag(r.decision, r.waitRank)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="small muted" style="margin-top:16px">「不显示志愿顺序」是硬约束：接口层面就不下发该字段，前端无法还原。</p>`}
  </div>`;
};

/* 简历列只显示格式和大小，文件名太长会把表格撑开；完整名字挂在 title 上 */
function resumeLink(r, compact = true) {
  if (!r.resume) return '<span class="muted">未上传</span>';
  const ext = r.resume.fileName.split('.').pop().toUpperCase();
  const label = compact ? `${ext} · ${fmtSize(r.resume.size)}` : r.resume.fileName;
  return `<button class="btn-link tnum" type="button" data-resume="${r.studentId}"
    data-name="${esc(r.resume.fileName)}" title="${esc(r.resume.fileName)}">${esc(label)}</button>`;
}

function bindResumeDownload(root) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-resume]');
    if (!b) return;
    downloadFile('/mentor/applicants/' + b.dataset.resume + '/resume', b.dataset.name)
      .catch(err => toast(err.message, 'err'));
  });
}

VIEWS.mentor.applicants.mount = root => bindResumeDownload(root);

function decisionTag(d, rank) {
  if (!d) return '<span class="tag tag-quiet">待定</span>';
  if (d === 'ADMIT') return '<span class="tag tag-ink">拟录取</span>';
  if (d === 'WAIT') return `<span class="tag">递补 ${rank || ''}</span>`;
  if (d === 'ADJUST') return '<span class="tag tag-red">调剂候选</span>';
  return '<span class="tag tag-quiet">不录取</span>';
}

VIEWS.mentor.score = async () => {
  const data = await api('/mentor/applicants');
  const rows = data.applicants;
  const inInterview = App.boot.current && App.boot.current.code === 'INTERVIEW';
  return `
  ${pageHead('面试评分', '四维各 1—5 分，折算百分制。',
    `<span class="tag tnum">已评 ${rows.filter(r => r.score !== null).length} / ${rows.length}</span>`)}
  ${inInterview ? '' : `<div class="notice" style="margin-bottom:24px"><span class="dot"></span><span>当前不在面试考核时间窗，评分只读。演示时可让管理端在「阶段控制」把演示时钟拨到 11-02 12:00 之后。</span></div>`}
  <div class="sec">
    ${rows.length === 0 ? `<div class="empty"><b>没有可评分的学生</b></div>` : `
    <div class="table-wrap"><table class="data">
      <thead><tr><th style="width:170px">学生</th><th style="width:280px">四维评分</th><th class="num" style="width:70px">总分</th><th>评语</th><th style="width:64px"></th></tr></thead>
      <tbody>${rows.map(r => {
        const d = r.dimensions || { attitude: 3, logic: 3, coding: 3, time: 3 };
        return `<tr data-row="${r.studentId}">
        <td style="min-width:200px">
          <div class="cell-who">${pixelAvatar(r.name, 20)}
            <div>
              <div class="cell-strong">${esc(r.name)}</div>
              <div class="cell-sub" style="white-space:nowrap">${esc(r.className)}</div>
              <div style="margin-top:5px">${resumeLink(r)}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="dims">
            ${dimInput('attitude', '态度', d.attitude, inInterview)}
            ${dimInput('logic', '逻辑', d.logic, inInterview)}
            ${dimInput('coding', '编程', d.coding, inInterview)}
            ${dimInput('time', '投入', d.time, inInterview)}
          </div>
        </td>
        <td class="num"><span class="total" data-total>${r.score === null ? '—' : r.score}</span></td>
        <td style="min-width:220px">
          <input type="text" data-comment value="${esc(r.comment || '')}" placeholder="一句评语" ${inInterview ? '' : 'disabled'}>
        </td>
        <td style="text-align:right"><button class="btn btn-sm" data-save="${r.studentId}" ${inInterview ? '' : 'disabled'}>保存</button></td>
      </tr>`;
      }).join('')}</tbody>
    </table></div>`}
  </div>`;
};

function dimInput(name, label, value, enabled) {
  return `<div class="dim">
    <label>${label}</label>
    <input type="number" min="1" max="5" step="1" value="${value}" data-dim="${name}" ${enabled ? '' : 'disabled'}>
  </div>`;
}

VIEWS.mentor.score.mount = root => {
  bindResumeDownload(root);
  root.addEventListener('input', e => {
    const input = e.target.closest('[data-dim]');
    if (!input) return;
    const tr = input.closest('tr');
    const sum = $$('[data-dim]', tr).reduce((s, el) => s + (Number(el.value) || 0), 0);
    $('[data-total]', tr).textContent = sum * 5;
  });

  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const body = { studentId: Number(btn.dataset.save), comment: $('[data-comment]', tr).value };
    $$('[data-dim]', tr).forEach(el => { body[el.dataset.dim] = Number(el.value); });
    body.timeInput = body.time;
    btn.disabled = true;
    api('/mentor/score', { method: 'POST', body })
      .then(res => { toast('已保存，总分 ' + res.total, 'ok'); btn.disabled = false; })
      .catch(err => { toast(err.message, 'err'); btn.disabled = false; });
  });
};

VIEWS.mentor.decision = async () => {
  const data = await api('/mentor/applicants');
  const rows = data.applicants.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  const inInterview = App.boot.current && App.boot.current.code === 'INTERVIEW';
  const admits = rows.filter(r => r.decision === 'ADMIT').length;
  return `
  ${pageHead('录取决策', '按面试总分排序。',
    `<span class="tag ${admits >= data.quota ? 'tag-red' : ''} tnum">拟录取 ${admits} / ${data.quota}</span>`)}
  ${inInterview ? '' : `<div class="notice" style="margin-bottom:24px"><span class="dot"></span><span>当前不在面试考核时间窗，决策只读。演示时可让管理端在「阶段控制」把演示时钟拨到 11-02 12:00 之后。</span></div>`}
  <div class="sec">
    <div class="table-wrap"><table class="data">
      <thead><tr><th>学生</th><th class="num">面试分</th><th>评语</th><th>当前决策</th><th style="text-align:right">标注为</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>
          <div class="cell-who">${pixelAvatar(r.name, 20)}
            <div>
              <div class="cell-strong">${esc(r.name)}</div>
              <div class="cell-sub">${esc(r.className)}</div>
              <div style="margin-top:5px">${resumeLink(r)}</div>
            </div>
          </div>
        </td>
        <td class="num">${r.score === null ? '—' : r.score}</td>
        <td class="cell-sub cell-wrap" style="max-width:280px">${esc(r.comment || '')}</td>
        <td>${decisionTag(r.decision, r.waitRank)}</td>
        <td style="min-width:246px">
          <div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
            <button class="btn btn-sm ${r.decision === 'ADMIT' ? 'btn-primary' : ''}" data-set="ADMIT" data-sid="${r.studentId}" ${inInterview ? '' : 'disabled'}>拟录取</button>
            <button class="btn btn-sm ${r.decision === 'WAIT' ? 'btn-primary' : ''}" data-set="WAIT" data-sid="${r.studentId}" ${inInterview ? '' : 'disabled'}>递补</button>
            <button class="btn btn-sm ${r.decision === 'ADJUST' ? 'btn-primary' : ''}" data-set="ADJUST" data-sid="${r.studentId}" ${inInterview ? '' : 'disabled'}>调剂候选</button>
          </div>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
};

VIEWS.mentor.decision.mount = root => {
  bindResumeDownload(root);
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    const decision = b.dataset.set;
    const waitRank = decision === 'WAIT'
      ? $$('[data-set="WAIT"]').filter(x => x.classList.contains('btn-primary')).length + 1
      : null;
    b.disabled = true;
    api('/mentor/decision', { method: 'POST', body: { studentId: Number(b.dataset.sid), decision, waitRank } })
      .then(() => { toast('已更新', 'ok'); render(); })
      .catch(err => { toast(err.message, 'err'); b.disabled = false; });
  });
};
