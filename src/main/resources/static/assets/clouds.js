/* ================================================================
   背景云层

   移植自 canvas-ui 的 Clouds，砍掉了它「把 HTML 画进 canvas 再折射」那
   部分——那套要用实验性的 element image API，而且我们要的只是一层会飘
   的背景。

   留下来的是核心：三层 fbm 噪声叠出云的密度场，阈值卡出云形，指针划过
   把云吹开一个口子。

   —— 云的形状是三件事决定的，跟调色无关 ——
   1. **低频定云带**。超低频那层决定「这片天有云、那片没有」，中频长团
      块，高频只做边缘毛躁。全用同一频率，云就会变成一地一样大的斑点。
   2. **层数要少**。fbm 每多一层，边界梯度就多由高频主导，阈值一卡上去
      就是碎玻璃。三层封顶。
   3. **过渡带宽度要跟密度场的分布相称**。带宽盖满整个分布 → 哪里都是
      半透明，云化成一团雾；带宽比分布窄太多 → 等高线地图。现在是
      ±0.038，密度场标准差的四分之一左右。

   —— 另外三件事决定它能不能跑得动 ——
   1. **降分辨率渲染**。云本来就是糊的，0.75 倍放大看不出区别。
   2. **限 30fps**。云飘得很慢，60fps 只是白烧电。
   3. **切到后台就停**。
   ================================================================ */

(function () {
  'use strict';

  const canvas = document.getElementById('cloudCanvas');
  if (!canvas) return;

  /* 注意 premultipliedAlpha: false —— 下面输出的是直通 alpha，
     并且不开混合。两者必须配对：开着 SRC_ALPHA 混合写进一个非预乘的
     画布，颜色会被乘两次 alpha，白云立刻变成灰褐色。 */
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  /* 没有 WebGL2 就整块拿掉，露出底下的 CSS 渐变。别留一块黑布。 */
  if (!gl) { canvas.remove(); return; }

  const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
void main () { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uWarp;
uniform float uCover;
uniform float uDensity;
uniform float uVert;
uniform float uOpacity;
uniform vec2 uPointer;
uniform float uWind;

const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);

vec2 hash (vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

/* 单纯形噪声。比 value noise 少一层方格感，云才不会看着像马赛克。 */
float noise (vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h
    * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}

/* 归一化 fbm：总振幅除掉权重和，输出稳定落在 ±0.5 */
float fbmN (vec2 p) {
  float s = 0.0; float a = 0.5; float nrm = 0.0;
  for (int i = 0; i < 3; i++) { s += a * noise(p); nrm += a; p = M * p; a *= 0.5; }
  return s / nrm;
}

float fbm2 (vec2 p) { return noise(p) * 0.62 + noise(M * p) * 0.38; }

void main () {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y) * uScale;

  float t = uTime;
  vec2 b = p + vec2(t * 0.035, t * 0.010);

  /* 域扭曲：两层 fbm 当位移场，云才长出卷边而不是一圈圈等高线。
     频率必须跟云本身同档——用超低频去扭曲，会把一大片区域整体推开，
     云就被拖成斜向的长条。 */
  vec2 w = vec2(fbm2(b + 11.3), fbm2(b + 27.7));
  vec2 q = b + w * uWarp;

  /* 三层：云带 / 团块 / 毛边。权重决定云是"大片带子"还是"一地斑点" */
  float band = fbmN(q * 0.34) * 0.5 + 0.5;
  float puff = fbmN(q * 1.05) * 0.5 + 0.5;
  float fine = fbmN(q * 2.60) * 0.5 + 0.5;
  float d = band * 0.46 + puff * 0.38 + fine * 0.16;

  /* 云往上聚：底下留干净的天，内容压在云上也不打架 */
  d -= (1.0 - uv.y) * uVert;

  /* 风：指针附近把密度压下去，云就散开一个口子。
     半径和力度都得克制——高斯太宽、压得太狠，一划就把半屏的云抹平，
     看着像穿帮而不是"被手拨开"。半径约屏幕高度的 1/8，压一个多带宽。 */
  if (uWind > 0.002) {
    vec2 e = (uv - uPointer) * vec2(uRes.x / uRes.y, 1.0);
    d -= exp(-dot(e, e) * 30.0) * uWind * 0.055;
  }

  /* 过渡带宽度是云"软不软"的唯一旋钮 */
  float mist = smoothstep(uCover - uDensity, uCover + uDensity, d);

  /* 明暗：厚的地方更白，薄的地方偏暖——体积感全在这里。
     给第二种颜色给狠了会浮出暖边，整片变迷彩，所以只差 3%。 */
  float lit = smoothstep(uCover - uDensity, uCover + uDensity * 2.2, d);
  vec3 col = mix(vec3(0.968, 0.955, 0.945), vec3(1.0, 0.998, 0.994), lit);

  outColor = vec4(col, mist * uOpacity);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[clouds]', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[clouds]', gl.getProgramInfoLog(prog));
    canvas.remove();
    return;
  }
  gl.useProgram(prog);

  /* 一个盖满屏幕的三角形就够了，比两个三角形的四边形少一条对角线接缝 */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes', 'uTime', 'uScale', 'uWarp', 'uCover', 'uDensity', 'uVert',
   'uOpacity', 'uPointer', 'uWind'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });

  /* 全屏三角形不需要混合，而且开了会把 alpha 乘两次 */
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);

  /* 降分辨率渲染，但别降太狠：0.35 倍在 1440 宽的屏上等于放大 2.8 倍，
     云的内部结构会被浏览器插值糊平，只剩一片水汽。
     0.6 倍既能看清团块，像素量又只有满分辨率的 36%。 */
  const SCALE = 0.75;
  const MAX_W = 1600;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    t: 0, raf: 0, last: 0, running: true,
    wind: 0, px: 0.5, py: 0.5, tx: 0.5, ty: 0.5,
    res: [1, 1],
  };

  function draw() {
    gl.uniform1f(U.uTime, state.t);
    gl.uniform1f(U.uScale, 4.0);
    gl.uniform1f(U.uWarp, 0.22);
    gl.uniform1f(U.uCover, 0.52);    // 阈值：越大云越少
    gl.uniform1f(U.uDensity, 0.038); // 过渡带半宽：越大越柔
    gl.uniform1f(U.uVert, 0.03);     // 往上聚的力度
    gl.uniform1f(U.uOpacity, 1.0);
    gl.uniform2f(U.uPointer, state.px, state.py);
    gl.uniform1f(U.uWind, state.wind);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let w = Math.round(innerWidth * SCALE * Math.min(dpr, 1.5));
    w = Math.min(w, MAX_W);
    const h = Math.round(w * innerHeight / innerWidth);
    if (w === state.res[0] && h === state.res[1]) return;
    state.res = [w, h];
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
    draw();
  }

  function frame(now) {
    if (!state.running) return;
    state.raf = requestAnimationFrame(frame);
    /* 30fps 封顶。云飘得慢，多出来的帧只是白烧电。 */
    if (now - state.last < 33) return;
    const dt = Math.min(0.1, (now - state.last) / 1000) || 0.016;
    state.last = now;

    state.t += dt * 0.55;
    /* 指针位置缓动过去，风劲儿自己衰减——手停下来云就慢慢合回去 */
    state.px += (state.tx - state.px) * 0.12;
    state.py += (state.ty - state.py) * 0.12;
    state.wind *= 0.965;
    draw();
  }

  function start() {
    if (state.raf) return;
    state.running = true;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  addEventListener('resize', resize, { passive: true });
  addEventListener('pointermove', e => {
    state.tx = e.clientX / innerWidth;
    state.ty = 1 - e.clientY / innerHeight;
    state.wind = Math.min(1, state.wind + 0.22);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  resize();

  if (reduce) {
    /* 不动的云也要有一帧，否则背景是空的 */
    state.t = 12;
    draw();
  } else {
    start();
  }
})();
