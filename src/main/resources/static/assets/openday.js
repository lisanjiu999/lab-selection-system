/* 开放日 3D 展厅
 *
 * 两个场景：
 *   1. 方块网格 —— 七间实训室平铺，顶面是实验室名，点进去。
 *      场景本身在 openday-grid.js 里，因为系统内的「总览」也用同一套。
 *   2. 展厅 —— 三块悬挂大屏（PPT / 演示 / 文档）+ 侧墙导师展板，可漫游。
 *
 * 画面内容全部由 openday-content.js 用 canvas 现画，这里只管几何、灯光、相机、交互。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  deckOf, paintSlide, paintDemo, paintDoc, docPageCount, boardCanvas,
  labTint, labInk,
} from './openday-content.js?v=20261119f';
import { createGrid } from './openday-grid.js?v=20261119f';

/* ------------------------------------------------------------------ 尺寸 */

const ROOM = { w: 11.8, d: 12.4, h: 4.3 };

/* 三块屏：16:9，站在房间中段刚好占满正前方视野 */
const SCREEN = { w: 3.1, h: 3.1 * 9 / 16, x: 3.6, y: 2.6, z: -ROOM.d / 2 + 0.34 };
const SCREEN_DEF = [
  { key: 'ppt', title: '项目简介', sub: 'PPT 预览 · 点击翻页' },
  { key: 'demo', title: '项目演示', sub: '现场录屏 · 循环播放' },
  { key: 'doc', title: '项目材料', sub: '文档 · 点击翻页' },
];

/* -------------------------------------------------------------------- DOM */

const $ = s => document.querySelector(s);
const canvas = $('#stage');
const veil = $('#veil');
const boot = $('#boot');
const hudTitle = $('#hudTitle');
const hudKicker = $('#hudKicker');
const hudSide = $('#hudSide');
const hint = $('#hint');
const keysBar = $('#keys');
const backBtn = $('#backBtn');
const backLabel = $('#backLabel');
const screenBar = $('#screenBar');
const sbTitle = $('#sbTitle');
const sbSub = $('#sbSub');
const sbPage = $('#sbPage');

/* ------------------------------------------------------------------ 状态 */

const S = {
  labs: [],
  mentors: [],
  scene: 'grid',        // grid | hall
  busy: false,
  direct: false,       // 从系统总览点进来的（带 ?lab=）
  focus: null,          // 聚焦中的屏 key
  screens: {},
  hallHome: null,
  preFocus: null,       // 聚焦前的机位，退出聚焦时回这里
  demoAcc: 0,
  motion: [],          // 本室陈设的动画函数，切厅时随场景一起丢掉
  t: 0,                 // 展厅内的累计时间，动效都用它
};

const clock = new THREE.Clock();
const wait = ms => new Promise(r => setTimeout(r, ms));

/* -------------------------------------------------------------- 渲染器 */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
/* 不做 tone mapping：这是浅色设计场景，ACES 会把粉彩压成灰白，
   而这套配色本来就是靠色相区分实验室的。 */

/* 网格场景交给 openday-grid.js——系统内的「总览」用的是同一个模块，
   那边自带渲染器和主循环，这里把渲染器传进去共用。 */
let grid = null;

const hallScene = new THREE.Scene();
const hallCam = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.05, 60);
let controls = null;

/* ========================================================== 每室一套风格 */

/* 七个实训室各自的室内设计：墙面、顶面、地面、雾、灯光色温、标志性陈设。
 *
 * 色相一律从 openday-content.js 的 LAB_INK 派生——系统列表里那个小色块是
 * 什么颜色，推门进来就是什么颜色，两边认得出是一家人。
 * 雾的远近也各给一套：202/402 通透（房间显得大），505 收得紧（私密感），
 * 不然七间室看起来只是换了张壁纸，谈不上"各有特色"。
 */
const LAB_STYLE = {
  '202': { wall: '#e6f1ec', ceil: '#dcebe5', floor: '#cfe4db', fog: '#ddeee7', lamp: '#e8fbf4', near: 8.5, far: 21 },
  '204': { wall: '#e6edf8', ceil: '#dbe4f4', floor: '#d2e0f0', fog: '#dde6f6', lamp: '#e9f2ff', near: 9.5, far: 23 },
  '206': { wall: '#f9ecdd', ceil: '#f2e2cd', floor: '#ecd9c1', fog: '#f4e6d4', lamp: '#fff0d8', near: 8, far: 19 },
  '402': { wall: '#efe8f9', ceil: '#e6dcf5', floor: '#ded1f0', fog: '#eae2f7', lamp: '#f3ecff', near: 10, far: 24 },
  '404': { wall: '#e8f2e3', ceil: '#ddeed7', floor: '#d3e7cc', fog: '#e1efdb', lamp: '#effbe6', near: 8.5, far: 21 },
  '406': { wall: '#f8f1de', ceil: '#f1e8cd', floor: '#e9dfc2', fog: '#f4ecd6', lamp: '#fff6da', near: 8, far: 19 },
  '505': { wall: '#f9eaee', ceil: '#f4dee4', floor: '#eed6dd', fog: '#f6e5ea', lamp: '#fff0f3', near: 7, far: 17 },
};

/* 标志性陈设。每间室只放一件，位置都避开了三块屏和两侧展板：
 * 天花类挂在 y≈3.0 以上、z≈-1 附近；落地类贴着 x≈±3.4 的侧廊。 */
const PROPS = {
  /* 202 感知 —— 天花下一圈传感环，八个探头绕中心球慢转 */
  '202': (c) => {
    const g = new THREE.Group();
    g.position.set(0, 3.42, -1.1);
    const m = new THREE.MeshStandardMaterial({
      color: c.tint, emissive: c.ink, emissiveIntensity: 0.34, roughness: 0.42, metalness: 0.2,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.019, 10, 72), m);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 24, 18),
      new THREE.MeshStandardMaterial({ color: c.tint, emissive: c.ink, emissiveIntensity: 0.75, roughness: 0.3 }),
    );
    g.add(core);
    /* 探头挂在环的**外侧**（1.325 = 环管外壁 1.279 + 方块半宽 0.045），
       而不是让环从方块中心穿过去——那样看着像串糖葫芦。 */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), m);
      box.position.set(Math.cos(a) * 1.325, 0, Math.sin(a) * 1.325);
      g.add(box);
    }
    c.add(g);
    c.motion(t => {
      g.rotation.y = t * 0.16;
      core.scale.setScalar(1 + Math.sin(t * 1.7) * 0.09);
    });
  },

  /* 204 网络 —— 两座机架 + 三根从顶上垂下来的光纤 */
  '204': (c) => {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x333b46, roughness: 0.58, metalness: 0.45 });
    const ledMat = new THREE.MeshBasicMaterial({ color: c.ink });
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 3.55, 0, -3.15);
      g.rotation.y = side * -0.3;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.74, 0.58), shellMat);
      body.position.y = 0.87;
      body.castShadow = true;
      g.add(body);
      for (let i = 0; i < 7; i++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.026, 0.02), ledMat);
        d.position.set(0, 1.52 - i * 0.18, 0.296);
        g.add(d);
      }
      c.add(g);
    }
    const fiberMat = new THREE.MeshBasicMaterial({ color: c.ink, transparent: true, opacity: 0.42 });
    for (const x of [-1.5, 0, 1.5]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x * 1.6, ROOM.h - 0.05, -4.4),
        new THREE.Vector3(x * 1.1, 3.2, -2.2),
        new THREE.Vector3(x * 0.7, 2.9, -0.4),
        new THREE.Vector3(x * 0.4, 3.1, 1.4),
      ]);
      c.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 6, false), fiberMat));
    }
  },

  /* 206 电路 —— 后墙一整面 PCB 走线，地板上一块芯片 */
  '206': (c) => {
    const tex = pcbTexture(c.tint, c.ink);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM.w - 0.2, ROOM.h - 0.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 }),
    );
    panel.position.set(0, ROOM.h / 2, -ROOM.d / 2 + 0.06);
    c.add(panel);

    const g = new THREE.Group();
    g.position.set(-2.15, 0, -3.15);
    g.rotation.y = 0.42;
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x2c3230, roughness: 0.5, metalness: 0.4 });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.78), chipMat);
    /* 引脚高 0.03，顶面在 0.03；芯片底面也落在 0.03，坐在引脚上 */
    chip.position.y = 0.075;
    chip.castShadow = true;
    g.add(chip);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xc9b489, roughness: 0.35, metalness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const o = -0.28 + i * 0.14;
      /* 引脚往外挪到 0.44：内沿 0.39 正好贴住芯片边，不再咬进去 */
      for (const [px, pz] of [[o, 0.44], [o, -0.44], [0.44, o], [-0.44, o]]) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.1), pinMat);
        pin.position.set(px, 0.015, pz);
        pin.rotation.y = pz === 0 ? Math.PI / 2 : 0;
        g.add(pin);
      }
    }
    c.add(g);
    c.motion(t => { chip.position.y = 0.075 + Math.sin(t * 1.2) * 0.008; });
  },

  /* 402 视觉 —— 天花板下悬一颗点云球。
     一开始摆在房间中段，正好糊住中间的演示屏；挪到屏顶以上才看得见又不挡。 */
  '402': (c) => {
    const N = 520;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      /* 球面均匀撒点：直接随机 xyz 会往球心堆，用经纬度反着来 */
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = 0.56 + Math.random() * 0.05;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(th) * s * r;
      pos[i * 3 + 1] = u * r;
      pos[i * 3 + 2] = Math.sin(th) * s * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cloud = new THREE.Points(geo, new THREE.PointsMaterial({
      color: c.ink, size: 0.05, transparent: true, opacity: 0.85, sizeAttenuation: true,
    }));
    /* 摆在 z=-0.5：屏幕顶的视线在这个深度只到 y≈2.65，球底 2.82 才真正
       落在屏上方。原先 z=-1.15 时视线是 2.75、球底 2.73——差 2 厘米，
       肉眼就是"球压进了屏幕"。 */
    const g = new THREE.Group();
    g.position.set(0, 3.52, -1.0);
    g.add(cloud);
    c.add(g);
    c.motion(t => {
      cloud.rotation.y = t * 0.22;
      cloud.rotation.x = Math.sin(t * 0.3) * 0.14;
    });
  },

  /* 404 网络系统 —— 五个节点连成一张拓扑，挂在屏顶以上。
     最初挂在 y2.95，连线横穿三块屏，乱；抬高到 3.55、缩小到 0.85 之后，
     它正好落在画面顶部那道空档里，抬头才看得见，低头全是屏。 */
  '404': (c) => {
    const nodes = [
      [0, 0.42, -0.35], [-1.05, 0.05, 0.3], [1.05, 0.05, 0.3],
      [-0.58, -0.34, -0.72], [0.58, -0.34, -0.72],
    ];
    const edges = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [0, 3], [0, 4]];
    const g = new THREE.Group();
    g.position.set(0, 3.56, -2.5);
    g.scale.setScalar(1.02);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: c.tint, emissive: c.ink, emissiveIntensity: 0.55, roughness: 0.35,
    });
    const dots = nodes.map(([x, y, z]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), nodeMat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    });
    const linkMat = new THREE.MeshBasicMaterial({ color: c.ink, transparent: true, opacity: 0.45 });
    for (const [a, b] of edges) link(g, nodes[a], nodes[b], 0.008, linkMat);
    c.add(g);
    c.motion(t => {
      g.rotation.y = t * 0.12;
      dots.forEach((d, i) => d.scale.setScalar(1 + Math.sin(t * 1.8 + i * 1.3) * 0.16));
    });
  },

  /* 406 数据 —— 三层堆叠的方块 + 一排数据柱 */
  '406': (c) => {
    const g = new THREE.Group();
    g.position.set(-2.72, 0, -2.75);
    g.rotation.y = 0.34;
    const sizes = [[1.15, 0.26, 1.15], [0.86, 0.24, 0.86], [0.58, 0.22, 0.58]];
    let y = 0;
    sizes.forEach(([w, h, d], i) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(c.tint).lerp(c.ink, 0.9 - i * 0.14),
          emissive: c.ink, emissiveIntensity: 0.12 + i * 0.05, roughness: 0.62,
        }),
      );
      m.position.set(0, y + h / 2, 0);
      m.castShadow = true;
      g.add(m);
      y += h + 0.04;
    });
    c.add(g);

    const bars = new THREE.Group();
    bars.position.set(2.82, 0, -2.85);
    bars.rotation.y = -0.3;
    [0.5, 0.86, 1.24, 1.72, 1.1].forEach((h, i) => {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, h, 0.26),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(c.tint).lerp(c.ink, 0.82),
          emissive: c.ink, emissiveIntensity: 0.16, roughness: 0.55,
        }),
      );
      b.position.set((i - 2) * 0.36, h / 2, 0);
      b.castShadow = true;
      bars.add(b);
    });
    c.add(bars);
  },

  /* 505 安全 —— 悬着一副陀螺仪：两个互相垂直的环，各自转。
     只放一个大环的话，环底会切进中间那块屏；收到 0.62 半径、抬到 3.55，
     整副才落在屏顶以上，抬头是一组在转的环，低头是屏。 */
  '505': (c) => {
    /* 同 402：z=-2.5 时屏幕顶的视线在 2.96，环底 2.93 会切进去一点。
       前移到 -1.2（视线 2.76）、抬到 3.6，环底 2.98 才干净地悬在屏上方。 */
    const g = new THREE.Group();
    g.position.set(0, 3.6, -1.2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: c.tint, emissive: c.ink, emissiveIntensity: 0.6, roughness: 0.35,
    });
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 10, 72), ringMat);
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.016, 8, 56), ringMat);
    inner.rotation.y = Math.PI / 2;
    g.add(inner);

    /* 环心一段扫描扇面。要挂在一个 pivot 上绕环心转——
       直接转 mesh 的话它只会在原地自转，看着像根斜插在空中的棍子。 */
    const sweep = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.07),
      new THREE.MeshBasicMaterial({ color: c.ink, transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
    );
    beam.position.set(0.29, 0, 0);
    sweep.add(beam);
    g.add(sweep);
    c.add(g);

    /* 地面上那一圈警示细线，从默认机位看是画面底部一道弧 */
    const mark = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.54, 72),
      new THREE.MeshBasicMaterial({ color: c.ink, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(0, 0.012, -2.6);
    c.add(mark);

    c.motion(t => {
      outer.rotation.z = 0.34 + t * 0.5;
      inner.rotation.x = t * 0.8;
      sweep.rotation.z = -t * 1.1;
    });
  },
};

/* 两点之间拉一根细圆柱。LineBasicMaterial 的 linewidth 在多数浏览器里
 * 被忽略，线细得看不见，所以宁可多用几个面。 */
function link(parent, a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(A).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(m);
}

/* 206 用的 PCB 贴图：走线 + 焊盘，画在 canvas 上最省事 */
function pcbTexture(tint, ink) {
  const W = 1024, H = 448;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const t = '#' + tint.getHexString();
  const k = '#' + ink.getHexString();

  ctx.fillStyle = t;
  ctx.fillRect(0, 0, W, H);

  /* 走线：横竖各来一批，转角做成 45° 折角，看起来才像电路不像方格纸 */
  ctx.strokeStyle = k;
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * H;
    const x0 = Math.random() * W * 0.5;
    const x1 = x0 + 120 + Math.random() * 260;
    const bend = 18 + Math.random() * 26;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + bend, y - bend);
    ctx.lineTo(x1, y - bend);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * W;
    const y0 = Math.random() * H * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + 90 + Math.random() * 180);
    ctx.stroke();
  }

  /* 焊盘 */
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 46; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, 3 + Math.random() * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ================================================================ 展厅 */

function buildHall(data) {
  const lab = data.lab;
  const style = LAB_STYLE[String(lab.code)] || LAB_STYLE['406'];
  const tint = new THREE.Color(labTint(lab.code));
  const ink = new THREE.Color(labInk(lab.code));
  const wall = new THREE.Color(style.wall);
  const ceil = new THREE.Color(style.ceil);

  S.motion = [];
  S.t = 0;

  hallScene.background = new THREE.Color(style.fog);
  hallScene.fog = new THREE.Fog(new THREE.Color(style.fog), style.near, style.far);

  /* 顶栏、聚焦条上的主色跟着房间走——同一间室里，界面和墙是一个色 */
  document.documentElement.style.setProperty('--sage-deep', '#' + ink.getHexString());

  /* ---- 房间：一个反面盒子，相机在内部 ---- */
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d),
    new THREE.MeshStandardMaterial({ color: wall, side: THREE.BackSide, roughness: 0.96, metalness: 0 }),
  );
  shell.position.y = ROOM.h / 2;
  shell.receiveShadow = true;
  hallScene.add(shell);

  /* 天花板单独一层：盒子的顶面和墙面同色的话，抬头一片糊，
     看不出"有顶"。压深半档，房间的高度才立得住。 */
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ color: ceil, roughness: 0.98 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h - 0.012;
  hallScene.add(ceiling);

  /* ---- 地板：单独一层，带极淡的拼缝 ---- */
  const floorTex = makeFloorTexture(style.floor);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.005;
  floor.receiveShadow = true;
  hallScene.add(floor);

  /* ---- 踢脚线：一圈深色细条，房间立刻有了"装修过"的感觉 ---- */
  const skirtMat = new THREE.MeshStandardMaterial({
    color: ink.clone().lerp(wall, 0.62), roughness: 0.85,
  });
  const skirtH = 0.11, skirtT = 0.03;
  const skirts = [
    [0, skirtH / 2, -ROOM.d / 2 + skirtT / 2, ROOM.w, skirtH, skirtT],
    [0, skirtH / 2, ROOM.d / 2 - skirtT / 2, ROOM.w, skirtH, skirtT],
    [-ROOM.w / 2 + skirtT / 2, skirtH / 2, 0, skirtT, skirtH, ROOM.d],
    [ROOM.w / 2 - skirtT / 2, skirtH / 2, 0, skirtT, skirtH, ROOM.d],
  ];
  for (const [x, y, z, w, h, d] of skirts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skirtMat);
    m.position.set(x, y, z);
    hallScene.add(m);
  }

  /* ---- 灯光：环境 + 两盏顶灯 + 屏幕溢光 ----
     环境光的天色取本室灯色，地色取墨色压淡——地板反上来的光带着房间的色，
     这样即使七间室户型一样，一进门的光感也是各自的。 */
  const lampColor = new THREE.Color(style.lamp);
  hallScene.add(new THREE.HemisphereLight(lampColor, ink.clone().lerp(wall, 0.55), 1.12));

  const key = new THREE.DirectionalLight(lampColor, 1.35);
  key.position.set(2, 8, 6);
  hallScene.add(key);

  const fill = new THREE.DirectionalLight(ink.clone().lerp(lampColor, 0.62), 0.4);
  fill.position.set(-5, 3, -4);
  hallScene.add(fill);

  for (const z of [-3.2, 1.4]) {
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 20),
      new THREE.MeshBasicMaterial({ color: lampColor }),
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, ROOM.h - 0.02, z);
    hallScene.add(lamp);
    /* 灯离天花板太近会把顶面烧成一片白：往下压到 3.1，强度只留 2.2。
       房间的基础亮度由半球光给，这盏只负责在地板上留一块暖斑。 */
    const pl = new THREE.PointLight(lampColor, 2.2, 7, 2);
    pl.position.set(0, 3.1, z);
    hallScene.add(pl);
  }

  /* ---- 空气里的尘埃 ----
     没有它的时候房间是"真空"的，一动镜头就露馅；有了之后光才有介质，
     屏幕溢光才像真的照在空气里。三百颗，位置全部用 sin 起伏，
     不做速度积分——积分会在边界处跳一下，粒子一多就看得出来。 */
  const DUST = 320;
  const dustBase = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST * 2);
  for (let i = 0; i < DUST; i++) {
    dustBase[i * 3] = (Math.random() - 0.5) * ROOM.w * 0.94;
    dustBase[i * 3 + 1] = 0.25 + Math.random() * (ROOM.h - 0.6);
    dustBase[i * 3 + 2] = (Math.random() - 0.5) * ROOM.d * 0.94;
    dustSeed[i * 2] = Math.random() * Math.PI * 2;
    dustSeed[i * 2 + 1] = 0.35 + Math.random() * 0.75;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustBase.slice(), 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: tint.clone().lerp(new THREE.Color(0xffffff), 0.5),
    size: 0.026, transparent: true, opacity: 0.34,
    sizeAttenuation: true, depthWrite: false,
  }));
  hallScene.add(dust);
  S.motion.push((t) => {
    const arr = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) {
      const ph = dustSeed[i * 2];
      const sp = dustSeed[i * 2 + 1];
      arr[i * 3] = dustBase[i * 3] + Math.sin(t * 0.3 * sp + ph) * 0.16;
      arr[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.22 * sp + ph * 1.7) * 0.3;
      arr[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.26 * sp + ph) * 0.16;
    }
    dustGeo.attributes.position.needsUpdate = true;
  });

  /* ---- 三块悬挂大屏 ---- */
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x232825).lerp(ink, 0.34), roughness: 0.55, metalness: 0.35,
  });
  const rodMat = new THREE.MeshStandardMaterial({
    color: wall.clone().lerp(ink, 0.28), roughness: 0.45, metalness: 0.5,
  });

  SCREEN_DEF.forEach((def, i) => {
    const x = (i - 1) * SCREEN.x;
    const group = new THREE.Group();
    group.position.set(x, SCREEN.y, SCREEN.z);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(SCREEN.w + 0.14, SCREEN.h + 0.14, 0.09),
      frameMat,
    );
    body.castShadow = true;
    group.add(body);

    const cv = document.createElement('canvas');
    cv.width = def.key === 'demo' ? 896 : 1024;
    cv.height = def.key === 'demo' ? 504 : 576;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    face.position.z = 0.048;
    group.add(face);

    /* 屏底一条发光细线，颜色取本室主色，三块屏之间有了呼应 */
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(SCREEN.w, 0.018, 0.012),
      new THREE.MeshBasicMaterial({ color: tint }),
    );
    glow.position.set(0, -(SCREEN.h / 2) - 0.09, 0.05);
    group.add(glow);

    /* 吊杆 */
    const rodH = ROOM.h - (SCREEN.y + SCREEN.h / 2) - 0.05;
    for (const rx of [-1.15, 1.15]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, rodH, 8), rodMat);
      rod.position.set(rx, (SCREEN.h / 2) + rodH / 2, -0.02);
      group.add(rod);
    }

    /* 屏幕自身的溢光：把光打在后墙上，屏幕才像在发光。
       强度不是常数——三块屏各自以不同频率轻轻起伏，房间里就有"画面在动"
       的错觉，比死亮的背光真实得多。 */
    const spill = new THREE.PointLight(tint.getHex(), 7, 5.5, 2);
    spill.position.set(0, 0, 0.75);
    group.add(spill);
    const spillBase = 7;
    const spillPh = Math.random() * Math.PI * 2;
    const spillSp = 0.55 + Math.random() * 0.5;
    S.motion.push((t) => {
      spill.intensity = spillBase * (0.9 + Math.sin(t * spillSp + spillPh) * 0.1);
    });

    hallScene.add(group);
    S.screens[def.key] = {
      ...def, group, face, tex, canvas: cv, ctx, body,
      page: 0,
      deck: def.key === 'ppt' ? deckOf(lab) : null,
      pages: def.key === 'doc' ? docPageCount(lab) : 0,
      dirty: true,
    };
  });

  /* ---- 侧墙立式展板：导师简介 ---- */
  const left = data.mentors.filter((_, i) => i % 2 === 0);
  const right = data.mentors.filter((_, i) => i % 2 === 1);
  placeBoards(left, -1, lab, tint, ink);
  placeBoards(right, 1, lab, tint, ink);

  /* ---- 本室的标志性陈设：进门第一眼靠它认人 ---- */
  const prop = PROPS[String(lab.code)];
  if (prop) {
    prop({
      tint, ink, style,
      add: o => hallScene.add(o),
      motion: fn => S.motion.push(fn),
    });
  }

  /* ---- 首屏内容 ---- */
  paintScreen('ppt');
  paintScreen('doc');
  paintDemoFrame(0);

  /* ---- 默认视角：站在房间中段偏后，正对三块屏。
       再往前一步，两侧墙的展板就完全出画了；再退一步，屏就缩成一排小窗。
       2.8 是这两件事的平衡点。 ---- */
  hallCam.position.set(0, 2.15, 2.8);
  hallCam.lookAt(0, SCREEN.y, SCREEN.z);

  S.hallHome = {
    pos: hallCam.position.clone(),
    target: new THREE.Vector3(0, SCREEN.y, SCREEN.z),
  };

  if (!controls) {
    controls = new OrbitControls(hallCam, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.55;
    controls.panSpeed = 0.6;
    controls.zoomSpeed = 0.75;
    controls.minDistance = 1.6;
    controls.maxDistance = 11;
    controls.minPolarAngle = Math.PI * 0.16;
    controls.maxPolarAngle = Math.PI * 0.53;
    controls.screenSpacePanning = true;
  }
  controls.target.copy(S.hallHome.target);
  controls.enabled = true;
  controls.update();
}

/* 展板立在屏幕墙前方的两侧，朝内偏转 28°。
 *
 * 一开始是贴在侧墙上的，结果站中段看屏时两块侧墙全在视野外——
 * 观众进门只看得到三块屏，不知道旁边还有内容。挪到屏墙前方之后，
 * 既进了画面，又不会挡住屏：按当前机位算，展板投影落在屏的右下方墙面上。 */
function placeBoards(list, side, lab, tint, ink) {
  if (!list.length) return;
  const span = 2.6;
  const step = list.length > 1 ? span / (list.length - 1) : 0;

  const panelW = 1.1, panelH = 1.65, frameW = 1.16, frameH = 1.72;
  const x = side * 5.05;
  const yaw = side * -0.49;   // ∓28°，法线朝房间中心偏前

  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xfaf4e7).lerp(tint, 0.45), roughness: 0.62,
  });
  const postMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xb9b1a0).lerp(ink, 0.3), roughness: 0.5, metalness: 0.35,
  });

  list.forEach((m, i) => {
    const z = list.length > 1 ? -4.6 + i * step : -3.3;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    g.scale.setScalar(0.94);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameH, 0.07), frameMat);
    frame.position.y = 1.5;
    frame.castShadow = true;
    g.add(frame);

    const tex = new THREE.CanvasTexture(boardCanvas(m, lab));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(panelW, panelH),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    face.position.set(0, 1.5, 0.038);
    g.add(face);

    /* 立式支架：两根立柱 + 底座，展板不是浮在墙上的 */
    for (const px of [-frameW / 2 + 0.1, frameW / 2 - 0.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.68, 10), postMat);
      post.position.set(px, 0.34, -0.02);
      post.castShadow = true;
      g.add(post);
    }
    const foot = new THREE.Mesh(new THREE.BoxGeometry(frameW + 0.16, 0.05, 0.42), postMat);
    foot.position.set(0, 0.025, 0.04);
    foot.receiveShadow = true;
    g.add(foot);

    /* 一盏小射灯从上方打亮展板 */
    const spot = new THREE.PointLight(tint.getHex(), 2.6, 3.2, 2);
    spot.position.set(0, 2.55, 0.5);
    g.add(spot);

    hallScene.add(g);
  });
}

function makeFloorTexture(base) {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  /* 一点点色差，避免纯色地板看起来像塑料 */
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(90,74,58,${Math.random() * 0.022})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  ctx.strokeStyle = 'rgba(90,74,58,0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(ROOM.w / 2.9, ROOM.d / 2.9);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/* ============================================================ 屏幕内容 */

function paintScreen(key) {
  const s = S.screens[key];
  if (!s) return;
  const lab = S.lab;
  const W = s.canvas.width, H = s.canvas.height;

  if (key === 'ppt') paintSlide(s.ctx, W, H, s.page, s.deck, lab);
  else if (key === 'doc') paintDoc(s.ctx, W, H, s.page, lab);

  s.tex.needsUpdate = true;
}

function paintDemoFrame(t) {
  const s = S.screens.demo;
  if (!s || !S.lab) return;
  paintDemo(s.ctx, s.canvas.width, s.canvas.height, t, S.lab);
  s.tex.needsUpdate = true;
}

/* ================================================================ 交互 */

function handleGridClick(e) {
  if (S.busy || !grid) return;
  const hit = grid.pick(e.clientX, e.clientY);
  if (hit) enterHall(hit.lab);
}

function handleHallClick(e) {
  const hit = pickScreen(e.clientX, e.clientY);
  if (hit) {
    if (S.focus === hit.key) {
      /* 已经聚焦了，点击屏幕左右区域翻页 */
      const nx = (e.clientX / innerWidth) * 2 - 1;
      if (nx < -0.12) turnPage(hit.key, -1);
      else if (nx > 0.12) turnPage(hit.key, 1);
      else exitFocus();
    } else {
      focusScreen(hit.key);
    }
    return;
  }
  if (S.focus) exitFocus();
}

function turnPage(key, dir) {
  const s = S.screens[key];
  if (!s) return;
  if (key === 'demo') return;   // 演示屏没有页
  const total = key === 'ppt' ? s.deck.length : s.pages;
  const next = Math.min(total - 1, Math.max(0, s.page + dir));
  if (next === s.page) return;
  s.page = next;
  paintScreen(key);
  syncScreenBar();
}

function focusScreen(key) {
  const s = S.screens[key];
  if (!s) return;
  /* 记下聚焦前的机位：退出时回到"我刚才站的地方"，而不是一律弹回门口 */
  if (!S.preFocus && controls) {
    S.preFocus = { pos: hallCam.position.clone(), target: controls.target.clone() };
  }
  S.focus = key;
  const p = s.group.position.clone();
  const camPos = p.clone().add(new THREE.Vector3(0, 0.06, 2.72));
  tweenCam(camPos, p.clone(), 760);
  screenBar.hidden = false;
  requestAnimationFrame(() => screenBar.classList.add('is-on'));
  syncScreenBar();
  keysBar.classList.add('is-gone');
}

function exitFocus() {
  if (!S.focus) return;
  S.focus = null;
  screenBar.classList.remove('is-on');
  setTimeout(() => { if (!S.focus) screenBar.hidden = true; }, 300);
  const back = S.preFocus || S.hallHome;
  tweenCam(back.pos, back.target, 760);
  S.preFocus = null;
}

function syncScreenBar() {
  const key = S.focus;
  if (!key) return;
  const s = S.screens[key];
  sbTitle.textContent = s.title;
  sbSub.textContent = s.sub;
  if (key === 'demo') {
    sbPage.textContent = '循环';
    $('#sbPrev').disabled = true;
    $('#sbNext').disabled = true;
  } else {
    const total = key === 'ppt' ? s.deck.length : s.pages;
    sbPage.textContent = `${s.page + 1} / ${total}`;
    $('#sbPrev').disabled = s.page === 0;
    $('#sbNext').disabled = s.page >= total - 1;
  }
}

/* ---------------------------------------------------------------- 拾取 */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function toNdc(x, y) {
  ndc.x = (x / innerWidth) * 2 - 1;
  ndc.y = -(y / innerHeight) * 2 + 1;
  return ndc;
}

function pickScreen(x, y) {
  ray.setFromCamera(toNdc(x, y), hallCam);
  const objs = Object.values(S.screens).map(s => s.face);
  const hits = ray.intersectObjects(objs, false);
  if (!hits.length) return null;
  return Object.values(S.screens).find(s => s.face === hits[0].object) || null;
}

/* ------------------------------------------------------------ 相机补间 */

let camTween = null;

function tweenCam(toPos, toTarget, dur = 760) {
  camTween = {
    t: 0, dur,
    p0: hallCam.position.clone(), p1: toPos.clone(),
    g0: controls ? controls.target.clone() : new THREE.Vector3(),
    g1: toTarget.clone(),
  };
  if (controls) controls.enabled = false;
}

function stepCamTween(dt) {
  if (!camTween) return false;
  camTween.t += dt * 1000;
  const k = Math.min(1, camTween.t / camTween.dur);
  const e = 1 - Math.pow(1 - k, 3);
  hallCam.position.lerpVectors(camTween.p0, camTween.p1, e);
  const look = camTween.g0.clone().lerp(camTween.g1, e);
  if (controls) controls.target.copy(look);
  hallCam.lookAt(look);
  if (k >= 1) {
    camTween = null;
    if (controls) { controls.enabled = true; controls.update(); }
  }
  return true;
}

/* ============================================================ 场景切换 */

/* fast=true 是"从系统总览里点过来的"：那边已经做过相机压向方块的动作了，
   这里不必再演一遍，直接黑场进厅。 */
async function enterHall(lab, fast = false) {
  if (S.busy || S.scene !== 'grid') return;
  S.busy = true;

  /* 相机压向被点的方块，是"走过去"而不是"切画面" */
  if (grid && !fast) grid.flyToTile(lab, 560);
  hint.classList.add('is-gone');

  await wait(fast ? 80 : 560);
  veil.classList.add('is-on');
  await wait(fast ? 120 : 360);

  try {
    const data = await apiGet(`/labs/${lab.id}/hall`);
    S.lab = data.lab;
    disposeScene(hallScene);
    buildHall(data);
    S.scene = 'hall';
    hudKicker.textContent = `${data.lab.code} 实训室`;
    hudTitle.textContent = data.lab.name;
    hudSide.textContent = `${data.lab.direction} · ${data.mentors.length} 位导师在两侧展板`;
    backLabel.textContent = S.direct ? '返回总览' : '返回';
    keysBar.hidden = false;
    keysBar.classList.remove('is-gone');
    setTimeout(() => keysBar.classList.add('is-gone'), 7000);
    document.title = `${data.lab.name} · 开放日展厅`;
  } catch (err) {
    veil.classList.remove('is-on');
    hint.classList.remove('is-gone');
    if (grid) grid.reset();      // 方块落回台面、机位回到原点
    S.busy = false;
    flash(err.message || '展厅加载失败');
    return;
  }

  await wait(380);
  veil.classList.remove('is-on');
  await wait(360);
  S.busy = false;
}

async function exitHall() {
  if (S.busy || S.scene !== 'hall') return;

  /* 从系统总览点进来的，退出就回总览——中间那层网格页在这儿是多余的，
     用户刚才就是从网格上点的这一块。 */
  if (S.direct) { location.href = '/'; return; }

  S.busy = true;

  if (S.focus) { S.focus = null; screenBar.classList.remove('is-on'); screenBar.hidden = true; }
  keysBar.classList.add('is-gone');
  keysBar.hidden = true;
  veil.classList.add('is-on');
  await wait(380);

  disposeScene(hallScene);
  S.screens = {};
  S.motion = [];
  S.lab = null;
  S.scene = 'grid';
  camTween = null;
  if (controls) controls.enabled = true;

  /* 展厅里的主色是跟着房间走的，退出要还原成系统主色 */
  document.documentElement.style.setProperty('--sage-deep', '#c2410c');

  backLabel.textContent = '退出';
  hudKicker.textContent = '实训室开放日';
  hudTitle.textContent = '选择一间实训室';
  hudSide.textContent = '';
  document.title = '实训室开放日 · 3D 展厅';

  /* 网格相机回到初始机位（距离按当前视口重算，不是写死的），方块落回台面 */
  if (grid) grid.reset();
  S.preFocus = null;

  hint.classList.remove('is-gone');
  await wait(220);
  veil.classList.remove('is-on');
  await wait(320);
  S.busy = false;
}

/* ================================================================ 事件 */

canvas.addEventListener('pointermove', e => {
  if (grid) grid.setPointer(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => { if (grid) grid.clearPointer(); });

let downAt = null;
canvas.addEventListener('pointerdown', e => {
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
});

canvas.addEventListener('pointerup', e => {
  const d = downAt;
  downAt = null;
  if (!d) return;
  /* 拖过视角就不算点击——OrbitControls 拖动结束后会跟一个 pointerup */
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9) return;
  if (performance.now() - d.t > 900) return;

  if (S.scene === 'grid') handleGridClick(e);
  else handleHallClick(e);
});

backBtn.addEventListener('click', () => {
  if (S.scene === 'hall') exitHall();
  else location.href = '/';
});
$('#sbPrev').addEventListener('click', () => turnPage(S.focus, -1));
$('#sbNext').addEventListener('click', () => turnPage(S.focus, 1));
$('#sbExit').addEventListener('click', exitFocus);

addEventListener('keydown', e => {
  if (S.scene === 'grid') return;

  if (e.key === 'Escape') {
    if (S.focus) exitFocus();
    else exitHall();
    return;
  }
  if (S.focus && S.focus !== 'demo') {
    if (e.key === 'ArrowLeft') { turnPage(S.focus, -1); e.preventDefault(); return; }
    if (e.key === 'ArrowRight') { turnPage(S.focus, 1); e.preventDefault(); return; }
  }
  S.keys = S.keys || {};
  S.keys[e.code] = true;
});

addEventListener('keyup', e => { if (S.keys) S.keys[e.code] = false; });
addEventListener('blur', () => { S.keys = {}; });

addEventListener('resize', () => {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  if (grid) grid.resize();
  hallCam.aspect = w / h;
  hallCam.updateProjectionMatrix();
});

/* ============================================================ 展厅每帧 */

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function updateHall(dt) {
  if (stepCamTween(dt)) return;

  /* WASD 平移：相机和观察点一起走，所以移动时视角朝向不变 */
  if (S.keys && controls) {
    hallCam.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, UP).normalize();

    _move.set(0, 0, 0);
    if (S.keys.KeyW || S.keys.ArrowUp) _move.add(_fwd);
    if (S.keys.KeyS || S.keys.ArrowDown) _move.sub(_fwd);
    if (S.keys.KeyD) _move.add(_right);
    if (S.keys.KeyA) _move.sub(_right);

    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(3.1 * dt);
      hallCam.position.add(_move);
      controls.target.add(_move);
    }
  }

  if (controls) controls.update();

  /* 别让人走出房间、钻到地下或者贴到天花板 */
  clampCamera();

  /* 演示屏：30fps 重绘就够了，每帧传一张 896×504 的纹理太浪费 */
  const demo = S.screens.demo;
  if (demo) {
    S.demoAcc += dt;
    if (S.demoAcc > 1 / 30) {
      demo.t = (demo.t || 0) + S.demoAcc;
      S.demoAcc = 0;
      paintDemoFrame(demo.t);
    }
  }

  /* 本室陈设的动效：吊环慢转、点云呼吸、拓扑节点脉动。
     统一挂在 S.motion 上，切厅时和场景一起清空，不会越积越多。 */
  if (S.motion.length) {
    S.t += dt;
    for (const fn of S.motion) fn(S.t, dt);
  }
}

function clampCamera() {
  const m = 0.55;
  const x = clamp(hallCam.position.x, -ROOM.w / 2 + m, ROOM.w / 2 - m);
  const y = clamp(hallCam.position.y, 1.05, ROOM.h - 0.45);
  const z = clamp(hallCam.position.z, -ROOM.d / 2 + 0.75, ROOM.d / 2 - m);
  const dx = x - hallCam.position.x, dy = y - hallCam.position.y, dz = z - hallCam.position.z;
  if (dx || dy || dz) {
    hallCam.position.set(x, y, z);
    /* 观察点跟着相机走同样的位移，否则一贴墙视角就会被掰一下 */
    if (controls) controls.target.add(new THREE.Vector3(dx, dy, dz));
  }

  if (controls) {
    const t = controls.target;
    t.x = clamp(t.x, -ROOM.w / 2 + 0.3, ROOM.w / 2 - 0.3);
    t.y = clamp(t.y, 0.5, ROOM.h - 0.3);
    t.z = clamp(t.z, -ROOM.d / 2 + 0.3, ROOM.d / 2 - 0.3);
  }
}

/* ================================================================ 主循环 */

renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());

  if (S.scene === 'grid') {
    /* 主循环在模块加载时就起来了，而网格场景要等接口回来才建。
       这一段空窗期里 grid 还是 null，不挡住就是每帧一个报错。 */
    if (!grid) return;
    grid.update(dt);
    renderer.render(grid.scene, grid.cam);
  } else {
    updateHall(dt);
    renderer.render(hallScene, hallCam);
  }
});

/* ================================================================ 工具 */

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function disposeScene(scene) {
  const seen = new Set();
  scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose();
    }
  });
  scene.clear();
}

/* 一句临时提示，复用底部 hint 的位置 */
let flashTimer = null;
/* 触屏没有鼠标，文案按输入方式分。 */
const HINT_IDLE = matchMedia('(hover: none)').matches
  ? '<span class="hint-dot"></span>拖动看细节，点方块进入展厅'
  : '<span class="hint-dot"></span>移动鼠标看细节，点击方块进入展厅';
function flash(text) {
  hint.textContent = text;
  hint.classList.remove('is-gone');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    hint.innerHTML = HINT_IDLE;
    if (S.scene !== 'grid') hint.classList.add('is-gone');
  }, 3600);
}

/* ================================================================ 数据 */

function token() {
  try {
    const s = JSON.parse(sessionStorage.getItem('session') || 'null');
    return (s && s.token) || '';
  } catch { return ''; }
}

async function apiGet(path) {
  const res = await fetch('/api' + path, { headers: { 'X-Token': token() } });
  let data = null;
  try { data = await res.json(); } catch { /* 非 JSON 响应 */ }
  if (!res.ok) throw new Error((data && data.message) || `请求失败（${res.status}）`);
  return data;
}

/* ================================================================ 启动 */

function bootFail(text) {
  boot.classList.add('is-error');
  $('#bootText').textContent = text;
  $('#bootBtn').hidden = false;
  $('#bootBtn').onclick = () => { location.href = '/'; };
}

async function start() {
  if (!token()) {
    bootFail('还没有登录。请先从登录页进入系统，再打开开放日展厅。');
    return;
  }

  try {
    /* 字体没就位就画 canvas，中文会按回退字体烙进纹理，后面改不回来 */
    if (document.fonts) {
      await document.fonts.load('600 32px "Quicksand Variable"').catch(() => {});
      await document.fonts.ready.catch(() => {});
    }

    const data = await apiGet('/labs');
    S.labs = data.labs || [];
    if (!S.labs.length) { bootFail('还没有配置实训室。'); return; }

    grid = createGrid({ renderer, canvas, labs: S.labs });
    grid.build();

    /* ?lab=<id> 是"从系统总览里点了某个方块"进来的，直接进那间展厅，
       不再让人在网格页里再点一次。 */
    const wantLab = Number(new URLSearchParams(location.search).get('lab'));
    const direct = wantLab && S.labs.find(l => l.id === wantLab);
    S.direct = !!direct;

    S.scene = 'grid';
    updateHud('grid');

    boot.classList.add('is-off');
    setTimeout(() => { boot.hidden = true; }, 520);

    if (direct) {
      await wait(120);
      enterHall(direct, true);
    }
  } catch (e) {
    bootFail(e.message || '加载失败，请刷新重试。');
  }
}

function updateHud(mode) {
  if (mode === 'grid') {
    hudKicker.textContent = '实训室开放日';
    hudTitle.textContent = '选择一间实训室';
    hudSide.textContent = `${S.labs.length} 间实训室 · 点进去看导师与项目`;
  }
}

start();
