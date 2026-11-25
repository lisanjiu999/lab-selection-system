/* 导师环：把导师排成一圈 3D 卡片，滚轮 / 拖动 / 方向键转动，正面那张即「当前选中」 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const norm = a => (((a % 360) + 540) % 360) - 180;   // → −180…180
const easeOut = t => 1 - Math.pow(1 - t, 3);

function mentorCard(m, i) {
  const initial = (m.name || '?').slice(0, 1);
  /* 卡面只留房号：实验室信息由上方那块跟着环一起切换，卡上不再标「本室」 */
  return `<button class="mcard" type="button" data-i="${i}" data-mid="${m.id}" data-lab="${m.labId}"
      style="--lab:${labInk(m.labCode)};--lab-fill:${labColor(m.labCode)}"
      aria-label="${esc(m.name)}，${esc(m.title)}，${esc(m.labCode)} ${esc(m.labName)}">
    <span class="mcard-face">
      <span class="mcard-ghost" aria-hidden="true">${esc(initial)}</span>
      <span class="mcard-top">
        <span class="mcard-code">${esc(m.labCode)}</span>
      </span>
      <span class="mcard-name">${esc(m.name)}</span>
      <span class="mcard-title">${esc(m.title)}</span>
      <span class="mcard-foot">
        <span class="mcard-tags">${esc(m.tags || '')}</span>
        <span class="mcard-go">${ICON.arrow}</span>
      </span>
    </span>
  </button>`;
}

function mountMentorRing(stage, mentors, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = mentors.length;
  if (!N) return null;
  const step = 360 / N;

  stage.innerHTML = `
    <div class="ring-lens">
      <div class="ring-center">
        ${mentors.map((m, i) => mentorCard(m, i)).join('')}
      </div>
    </div>
    <button class="ring-nav ring-prev" type="button" aria-label="上一位导师">${ICON.arrowLeft}</button>
    <button class="ring-nav ring-next" type="button" aria-label="下一位导师">${ICON.arrow}</button>`;

  const center = $('.ring-center', stage);
  const cards = $$('.mcard', stage);

  let rot = reduce ? 0 : -26;       // 当前角度
  let target = 0;                    // 目标角度
  let vel = 0;
  let intro = reduce ? 1 : 0;        // 入场装配进度
  let baseR = 600;
  let drag = null;
  let snapTimer = 0;
  let lastFocus = -1;
  let raf = 0;
  let prev = 0;

  const measure = () => {
    const cardW = cards[0] ? cards[0].offsetWidth : 300;
    /* 半径按卡宽算：R = 卡宽 × rf。rf 越大环越松，越小卡片越挤成一圈。
       透视 = R × pf，pf 决定近处那张放大多少（pf/(pf-1)）。
       rf 默认由卡数推出来：相邻两卡在 3D 空间里刚好留出一点缝。
       16 张时算出来是 2.5（原本手调的值），换人数自动跟着走，不会互相穿插。 */
    const spacing = 2 * Math.sin(Math.PI / Math.max(N, 3));
    const autoRf = (2.5 * 2 * Math.sin(Math.PI / 16)) / spacing;
    const rf = Number(stage.dataset.rf || autoRf);
    const pf = Number(stage.dataset.pf || 4.0);
    baseR = cardW * rf;
    stage.style.perspective = Math.round(baseR * pf) + 'px';
  };

  /* 把第 i 张转到正前方 */
  /* 卡片的视觉方位是 step*i - rot（父层转了 -rot），下面所有判断都用这个角度，
     否则「转到哪张」和「哪张算正面」会差一位，信息条和画面对不上。 */
  const centerOn = i => {
    target = rot + norm(step * i - rot);
  };

  /* 指针交互 */
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.ring-nav')) return;
    drag = { x: e.clientX, y: e.clientY, from: target, moved: 0, captured: false };
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    drag.moved = Math.max(drag.moved, Math.abs(d));
    /* 超过阈值才捕获指针：一按下就捕获会让卡片收不到 click */
    if (drag.moved > 5 && !drag.captured) {
      drag.captured = true;
      stage.setPointerCapture?.(e.pointerId);
      stage.classList.add('is-drag');
    }
    if (drag.captured) target = drag.from + d * 0.28;
  });
  const snap = v => Math.round(v / step) * step;
  const endPointer = e => {
    if (!drag) return;
    const wasDrag = drag.moved > 5;
    drag = null;
    stage.classList.remove('is-drag');
    if (wasDrag) { target = snap(target); return; }   // 松手吸附到最近的卡片
    /* 没拖动 → 当作点击；自己命中测试，避免指针捕获改变 target */
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const card = hit && hit.closest('.mcard');
    if (!card) return;
    const i = Number(card.dataset.i);
    if (Math.abs(norm(step * i - rot)) < step * 0.55) opts.onOpen?.(mentors[i]);
    else centerOn(i);
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', () => { drag = null; stage.classList.remove('is-drag'); });
  /* 停止输入后吸附到最近的卡片，环总能「停稳」在某一位上 */
  const settle = () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = snap(target); }, 260);
  };

  /* 滚轮：只在指针位于环上时接管，横向/纵向都行 */
  stage.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const raw = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    target += clamp(raw, -480, 480) * 0.22;
    settle();
  }, { passive: false });

  /* 方向键 */
  stage.tabIndex = 0;
  stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); target -= step; settle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); target += step; settle(); }
    else if (e.key === 'Enter' || e.key === ' ') {
      const m = mentors[lastFocus];
      if (m) { e.preventDefault(); opts.onOpen?.(m); }
    }
  });

  $('.ring-prev', stage).addEventListener('click', () => { target -= step; settle(); });
  $('.ring-next', stage).addEventListener('click', () => { target += step; settle(); });

  /* 点卡片：先转到面前，已经在面前就打开（命中测试在 pointerup 里做） */

  const render = () => {
    const R = baseR * (0.42 + 0.58 * easeOut(intro));
    center.style.transform = `rotateX(-2deg) rotateY(${-rot}deg)`;
    let best = 0, bestAbs = 999;
    cards.forEach((el, i) => {
      const ang = norm(step * i - rot);
      const a = Math.abs(ang);
      el.style.transform = `rotateY(${step * i}deg) translateZ(${R}px)`;
      /* 只让正面和紧邻的一张清楚可见：再往外的卡片已被压得很扁，
         而且 17 人时环的直径大于面板宽度，露出来会被边缘裁断，不如淡出 */
      const fade = 1 - clamp((a - 30) / 12, 0, 1);
      el.style.opacity = fade * intro;
      el.style.pointerEvents = fade < 0.3 ? 'none' : 'auto';
      el.classList.toggle('is-front', a < step * 0.55);
      if (a < bestAbs) { bestAbs = a; best = i; }
    });
    if (best !== lastFocus && intro > 0.5) {
      lastFocus = best;
      opts.onFocus?.(mentors[best]);
    }
  };

  const frame = t => {
    if (!stage.isConnected) return;           // 视图已切走
    const dt = Math.min(32, t - prev || 16);
    prev = t;
    if (intro < 1) intro = Math.min(1, intro + dt / 1000);

    if (reduce) {
      rot = target;
    } else {
      /* 定步长积分：帧多长都按 4ms 一步走，长帧只会多走几步，不会一步跨过头 */
      const h = 0.004;
      const steps = Math.min(16, Math.max(1, Math.round(dt / 4)));
      for (let s = 0; s < steps; s++) {
        vel += (150 * (target - rot) - 27 * vel) * h;
        rot += vel * h;
      }
    }
    render();
    raf = requestAnimationFrame(frame);
  };

  measure();
  window.addEventListener('resize', measure);
  render();
  raf = requestAnimationFrame(frame);

  return {
    focus: i => centerOn(i),
    stop: () => cancelAnimationFrame(raf),
  };
}
