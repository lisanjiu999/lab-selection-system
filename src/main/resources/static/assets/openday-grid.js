/* 开放日方块网格
 *
 * 一个自包含的场景：七间实训室平铺成方块，顶面是 canvas 现画的铭牌，
 * 点进去交给调用方处理。
 *
 * 拆出来是因为它有两个宿主：
 *   1. openday.html 的首屏（整页）
 *   2. 系统内的「总览」（塞在内容区里）
 * 两个宿主的渲染器和主循环各自独立，这里只负责"建场景 + 每帧更新 + 拾取"，
 * 不自己开 requestAnimationFrame，也不持有 renderer。
 *
 * 尺寸全部读 canvas 的 CSS 尺寸，不读 innerWidth/innerHeight——
 * 塞进内容区之后，视口大小和画布大小是两件事。
 */

import * as THREE from 'three';
import {
  tileCanvas, sideCanvas, labInk, MONO,
} from './openday-content.js?v=20261119f';

/* 间距和俯角是配套的：俯角 20° 时，前排 0.5 高的方块会把后排挡掉
   0.5/tan20° ≈ 1.33 米，而方块本身才 1.62 深——后排只露出 0.29 米，
   看着就像前后排插在了一起。抬到 30° 后遮挡降到 0.86 米，再配 0.95 的
   间距，后排能露出六成，前后关系一眼可辨。 */
const TILE = { size: 1.62, height: 0.46, gap: 0.7 };
const STEP = TILE.size + TILE.gap;

/* 标识物的基准缩放。单独提出来是因为 update 每帧都在改 scale，
   不记基准值的话悬停放大就会把造型越缩越小。 */
const EMBLEM_SCALE = 0.95;

/* 背景那枚 logo 立在网格后面这个深度上。 */
/* 院徽立在网格后面。原来是 -8.2，远到只剩一个淡淡的橙点；
   拉近到 -4.6，既还在方块之后，投影又够大，能看清是一枚完整的标志。 */
const LOGO_Z = -4.6;

const GRID_PITCH = 32 * Math.PI / 180;

/* 背景飘的代码碎片。单字符是标点骨架，双字符以上是能一眼认出"代码"的词。
   注意别放中文——128px 画布里中文糊成一团，远看只剩黑块。 */
const GLYPHS = [
  '{', '}', '<', '>', '/', '*', '(', ')', '[', ']', ';', ':', '=', '+', '-', '_',
  '|', '!', '?', '%', '^', '~', '&', '#', '@', '$', '\\', '01', '10', '0x1F',
  '=>', '::', '&&', '||', '//', '/*', '*/', '</>', 'λ', 'π', 'Σ', 'fn', 'if', 'for',
  'let', 'const', 'async', 'await', 'return', 'null', 'true', 'bool', '0b01',
  'i++', 'n--', 'x+=1', 'a.b()', '{ }', '[ ]', '<T>', '&&=',
];

/* 三层景深：远层小而淡、中层正常、近层大而实。
   只有一层的时候所有字都在同一个深度上，飘起来像贴了张纸；
   分了层才有前后穿插的空气感。 */
const GLYPH_LAYERS = [
  { n: 34, rad: [6.0, 9.4], y: [0.5, 3.6], size: [0.18, 0.30], alpha: [0.07, 0.14], speed: [0.16, 0.32], spin: 0.30 },
  { n: 26, rad: [4.2, 6.6], y: [0.8, 3.2], size: [0.28, 0.46], alpha: [0.11, 0.20], speed: [0.28, 0.50], spin: 0.45 },
  { n: 14, rad: [3.0, 4.4], y: [1.3, 3.0], size: [0.44, 0.72], alpha: [0.14, 0.24], speed: [0.40, 0.66], spin: 0.60 },
];

/* 两种墨色交替，全是同一个色会显得平 */
const GLYPH_TONES = ['#b8630f', '#8f4a10', '#c2410c'];


function lerp(a, b, t) { return a + (b - a) * t; }

/* 收尾过冲一点再回来。用在方块入场：落回台面那一下要有重量，
   纯 easeOutCubic 收得太"轻"，七块一起升起来像七部电梯。 */
function easeOutBack(t) {
  const c1 = 1.28, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function createGrid({ renderer, canvas, labs, logoUrl = 'assets/brand/lab-mark.png' }) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  const look = new THREE.Vector3(0, 0.5, 0);
  const home = { x: 0, y: 3.4, z: 7.3 };

  const st = {
    tiles: [],
    glyphs: [],
    hover: null,
    pointer: { x: 0, y: 0, has: false, nx: 0, ny: 0 },
    logo: null,
    logoY: 1.8,
    logoAspect: 1,
    cols: 4,
    tween: null,
    disposed: false,
    clock: 0,        // 建场以来的秒数，入场动画按它算进度
    marker: null,    // 悬停时地面那圈定位环
    ripples: [],     // 点击时扩散的涟漪
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function size() {
    return {
      w: Math.max(1, canvas.clientWidth || 1),
      h: Math.max(1, canvas.clientHeight || 1),
    };
  }

  function maxAniso() {
    return Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  /* ---------------------------------------------------------- 方块序号 */

  /* 方块正面的序号。做成纹理而不是 DOM，是因为它要跟着方块一起被透视、被光照。 */
  function indexStamp(i, ink) {
    const cv = document.createElement('canvas');
    cv.width = 272;
    cv.height = 120;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.85;
    ctx.font = `600 62px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1).padStart(2, '0'), 136, 62);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso();
    return t;
  }

  /* 地面贴图：中心暖、外圈化进背景色，边缘就自然消失了。
     256 就够——它只承担一层极缓的明暗过渡，看不出分辨率。 */
  function floorTexture() {
    const SZ = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = SZ;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(SZ / 2, SZ / 2, SZ * 0.04, SZ / 2, SZ / 2, SZ * 0.5);
    g.addColorStop(0, '#d8bf9b');
    g.addColorStop(0.28, '#e2cdad');
    g.addColorStop(0.55, '#f0e0c8');
    g.addColorStop(0.8, '#f9eddd');
    g.addColorStop(1, '#fbeedc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SZ, SZ);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* -------------------------------------------------------------- 建场景 */

  function build() {
    scene.background = new THREE.Color(0xfbeedc);
    scene.fog = new THREE.Fog(0xfbeedc, 13, 26);

    /* 地面：比背景暖一档，方块才有"摆在台面上"的感觉。
       底色不能是纯色板——纯色板靠雾去接背景，接缝是一条笔直的地平线，
       在浅底上格外显眼。改成径向渐变贴图，中间暖、四周化进背景，没有边。 */
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.97, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -TILE.height / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    scene.add(new THREE.HemisphereLight(0xfff8ec, 0xd2c9b6, 1.18));

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 2.5;
    scene.add(key);

    /* 背面补一盏冷光，方块侧面不至于死黑 */
    const rim = new THREE.DirectionalLight(0xd8ecff, 0.7);
    rim.position.set(-6, 4, -7);
    scene.add(rim);

    layoutTiles();
    buildBackdrop();
    buildMarker();
    fit();
    loadLogo();
  }

  /* 列数跟着画布比例走：竖屏排 4 列，每个方块只有 90px 宽，字根本看不清；
     而按宽度硬适配又会把相机推到三十米外，方块直接掉进雾里。
     竖屏排 2 列、宽屏排 4 列，行数自己长。 */
  function colsFor(aspect) {
    return aspect < 0.85 ? 2 : aspect < 1.15 ? 3 : 4;
  }

  function layoutTiles() {
    const { w, h } = size();
    st.cols = colsFor(w / h);
    const COLS = st.cols;
    const rows = Math.ceil(labs.length / COLS);

    labs.forEach((lab, i) => {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const inRow = Math.min(COLS, labs.length - r * COLS);
      const x = (c - (inRow - 1) / 2) * STEP;
      const z = (r - (rows - 1) / 2) * STEP;

      /* 七块不完全一样高、也不完全正对相机。差得很小（高度 5 档差 0.11、
         转角 1.8°），单看察觉不到，整排看过去就不再是一排复制的盒子。 */
      const th = TILE.height + ((i * 3) % 5) * 0.028;

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = (((i * 5) % 3) - 1) * 0.032;
      group.userData.baseY = 0;

      const tex = new THREE.CanvasTexture(tileCanvas(lab, 768));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso();

      /* 侧面贴一层极淡的代码。四个侧面共用一张，UV 方向不同会让某一面的字镜像，
         但字只有 10px 高、透明度 0.1，读不出来也无所谓——它负责氛围。 */
      const sideTex = new THREE.CanvasTexture(sideCanvas(lab));
      sideTex.colorSpace = THREE.SRGBColorSpace;
      sideTex.anisotropy = maxAniso();

      const side = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.66, metalness: 0.02 });
      const top = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.55, metalness: 0.02,
        emissive: new THREE.Color(labInk(lab.code)), emissiveIntensity: 0,
      });
      const bottom = new THREE.MeshStandardMaterial({ color: 0xa8967a, roughness: 0.9 });

      /* 材质顺序：+x -x +y -y +z -z，顶面是索引 2 */
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(TILE.size, th, TILE.size),
        [side, side, top, bottom, side, side],
      );
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);

      /* 底座：一圈略大的薄板，像展台的托 */
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(TILE.size + 0.11, 0.05, TILE.size + 0.11),
        new THREE.MeshStandardMaterial({ color: 0xb09d80, roughness: 0.92 }),
      );
      base.position.y = -th / 2 - 0.026;
      base.receiveShadow = true;
      group.add(base);

      /* 正面左侧一条竖槽，做的是代码编辑器里那根行号栏。
         用室色压一层浅色，七个颜色各不相同——远看是七个色块，
         凑近才发现每条槽底下都挂着一个行号。 */
      const gutter = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, th * 0.9),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(labInk(lab.code)),
          transparent: true, opacity: 0.24, depthWrite: false,
        }),
      );
      gutter.position.set(-TILE.size / 2 + 0.13, 0, TILE.size / 2 + 0.003);
      group.add(gutter);

      /* 槽底的序号，就是"第几行"。 */
      const stamp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.19, 0.085),
        new THREE.MeshBasicMaterial({
          map: indexStamp(i, labInk(lab.code)),
          transparent: true, opacity: 0.8, depthWrite: false,
        }),
      );
      stamp.position.set(-TILE.size / 2 + 0.13, -th / 2 + 0.1, TILE.size / 2 + 0.005);
      group.add(stamp);

      /* 每间室头顶一个小小的几何标识，七个各不相同。
         位置是试出来的：铭牌文字都居中排，只有近角那一片是空的。
         放在 (0.68, 0.68) 而不是正中，就是为了让标识物整个落在文字外面。 */
      const emblem = makeEmblem(lab);
      emblem.position.set(0.68, th / 2 + 0.03, 0.68);
      group.add(emblem);

      scene.add(group);
      /* 入场：先从地面底下升上来。起点压到 -3.4，整块在台面以下，
         被地面挡住看不见，所以不需要做透明度渐入。 */
      group.position.y = -3.4;
      group.scale.setScalar(0.9);
      st.tiles.push({
        lab, group, box, top, base, emblem, h: th,
        lift: 0, liftTo: 0, phase: Math.random() * Math.PI * 2,
        /* 依次入场：同一排里错开 75ms，整片网格从近到远"长"出来 */
        intro: i * 0.062,
        appear: 0,
      });
    });
  }

  /* ------------------------------------------------------ 悬停定位环 */

  /* 悬停时地面上亮起一圈细环。比"整块发光"克制得多，也不会在浅底上
     糊成一团；环是躺在地面上的，被方块遮挡的关系天然正确。 */
  function buildMarker() {
    const g = new THREE.Group();
    const ring = (r0, r1) => new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 72),
      new THREE.MeshBasicMaterial({
        color: 0xc2410c, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    const inner = ring(0.74, 0.775);
    const outer = ring(1.02, 1.04);
    g.add(inner, outer);
    g.rotation.x = -Math.PI / 2;
    g.position.y = -TILE.height / 2 + 0.012;
    g.visible = false;
    scene.add(g);
    st.marker = { group: g, inner, outer, on: 0 };
  }

  /* 点击时从方块脚下荡开一圈。0.8 秒走完，比相机推镜略短，
     等镜头到位的时候涟漪刚好散尽。 */
  function spawnRipple(x, z) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.37, 64),
      new THREE.MeshBasicMaterial({
        color: 0xc2410c, transparent: true, opacity: 0.62,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, -TILE.height / 2 + 0.014, z);
    scene.add(m);
    st.ripples.push({ mesh: m, t: 0 });
  }

  /* ---------------------------------------------------------- 背景 */

  /* 背景两层：方块上方一枚 logo 水印、四周一圈飘着的代码符号。
     都是"看得见但不抢"的强度——方块才是主角。

     logo 的尺寸和位置分成两件事算，因为它们的依据不同：
     · 大小跟网格宽度走。竖屏只排 2 列，方块比宽屏小一大截，
       按固定尺寸摆就成了一头压着七块小方块的巨兽。
     · 位置跟取景框走，在 fit() 里算——写死世界坐标的话，
       画布一矮，顶边就把 logo 切掉半个。
     所以这里只建一个 1×1 的平面，缩放和落位都交给 placeLogo()。 */
  function buildBackdrop() {
    /* 漂浮的代码符号。Sprite 始终面向相机，从任何角度看都是正的。 */
    const texCache = new Map();

    /* 纹理按「字 + 墨色」缓存：同一串字反复用，没必要每颗 sprite 重画一张。
       长词（async / return / a.b()）画在拉宽的画布里，不然挤在正方形里会糊。 */
    const glyphTex = (ch, tone) => {
      const key = tone + '|' + ch;
      if (texCache.has(key)) return texCache.get(key);
      const H = 128;
      const W = ch.length <= 1 ? H : Math.round(H * (0.34 + ch.length * 0.30));
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = tone;
      ctx.font = `600 ${H * (ch.length > 1 ? 0.5 : 0.66)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, W / 2, H / 2 + H * 0.02);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      texCache.set(key, t);
      return t;
    };

    const rnd = ([a, b]) => a + Math.random() * (b - a);

    let k = 0;
    for (const L of GLYPH_LAYERS) {
      for (let i = 0; i < L.n; i++, k++) {
        const ch = GLYPHS[k % GLYPHS.length];
        const tone = GLYPH_TONES[k % GLYPH_TONES.length];
        const tex = glyphTex(ch, tone);
        const size = rnd(L.size);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: rnd(L.alpha),
          depthWrite: false,
          fog: false,
        }));
        /* 黄金角散开比均分角度自然：均分的话同层永远等距，一眼看出是排的 */
        const a = i * 2.39996 + L.n * 0.7;
        const rad = rnd(L.rad);
        sp.position.set(
          Math.cos(a) * rad,
          rnd(L.y),
          Math.sin(a) * rad * 0.78 - 1.5,
        );
        /* 相机在 z 正方向。正对取景框那块要是压上字，方块名字就糊了——
           把它往两侧推开，中间只留空的。 */
        if (sp.position.z > -0.6 && Math.abs(sp.position.x) < 2.5) {
          sp.position.x = (sp.position.x >= 0 ? 1 : -1) * (2.5 + Math.random() * 2.4);
        }
        sp.scale.set(size * (tex.image.width / tex.image.height), size, 1);
        sp.userData = {
          baseX: sp.position.x,
          baseY: sp.position.y,
          phase: Math.random() * Math.PI * 2,
          speed: rnd(L.speed),
          spin: (Math.random() - 0.5) * L.spin,
          drift: 0.18 + Math.random() * 0.34,
          driftPhase: Math.random() * Math.PI * 2,
        };
        scene.add(sp);
        st.glyphs.push(sp);
      }
    }
  }

  /* logo 是异步取的：取不到就不摆，方块和交互照常 */
  function loadLogo() {
    new THREE.TextureLoader()
      .loadAsync(logoUrl)
      .then((tex) => {
        if (st.disposed) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = maxAniso();
        st.logoAspect = tex.image.width / tex.image.height;

        const logo = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.62,
            depthWrite: false,
            fog: false,          // 这么远，被雾吃掉就什么都看不见了
          }),
        );
        logo.position.set(0, 0, LOGO_Z);
        logo.renderOrder = -2;
        scene.add(logo);
        st.logo = logo;
        placeLogo();
      })
      .catch(() => { /* 少一层背景，不影响进厅 */ });
  }

  /* ---------------------------------------------------- 每室一个几何标识 */

  /* 七种造型对应七个方向：感知是球+环、数据是柱状图、嵌入式是芯片、
     视觉是点云、网络是节点连线、软工是堆栈、交互是轨道。
     全部用 MeshBasicMaterial，不受光照影响，小尺寸下反而更清楚。 */
  function makeEmblem(lab) {
    const g = new THREE.Group();
    const ink = new THREE.Color(labInk(lab.code));
    /* 不透明度给到 0.85：这些小东西只有 0.15 米见方，在 1.62 米的方块上
       本来就小，再半透明就跟铭牌上的水印糊成一片，读不出是个造型。 */
    const mat = new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.85 });
    const lineMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.6 });

    switch (String(lab.code)) {
      case '202': {   // 感知：球 + 两个正交环
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), mat));
        const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.007, 6, 36), mat);
        r1.rotation.x = Math.PI / 2;
        g.add(r1);
        const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.007, 6, 36), mat);
        g.add(r2);
        break;
      }
      case '204': {   // 数据：五根高低不一的柱
        [0.15, 0.27, 0.19, 0.33, 0.11].forEach((bh, i) => {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.034, bh, 0.034), mat);
          bar.position.set((i - 2) * 0.058, bh / 2 - 0.16, 0);
          g.add(bar);
        });
        break;
      }
      case '206': {   // 嵌入式：芯片 + 八根引脚
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.045, 0.15), mat));
        for (let i = 0; i < 4; i++) {
          for (const s of [-1, 1]) {
            const pin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.011, 0.011), mat);
            pin.position.set(s * 0.1, 0, (i - 1.5) * 0.038);
            g.add(pin);
          }
        }
        break;
      }
      case '402': {   // 视觉：球面点云
        const n = 96;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const phi = Math.acos(1 - 2 * (i + 0.5) / n);
          const theta = Math.PI * (1 + Math.sqrt(5)) * i;
          const r = 0.175;
          pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          pos[i * 3 + 1] = r * Math.cos(phi);
          pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.add(new THREE.Points(geo, new THREE.PointsMaterial({
          color: ink, size: 0.021, transparent: true, opacity: 0.8,
        })));
        break;
      }
      case '404': {   // 网络：五个节点 + 六条连线
        const nodes = [[0, 0, 0], [0.19, 0.07, 0.03], [-0.17, 0.05, 0.06], [0.05, -0.15, -0.04], [-0.05, 0.19, -0.07]];
        nodes.forEach(p => {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), mat);
          s.position.set(p[0], p[1], p[2]);
          g.add(s);
        });
        const seg = [];
        [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [3, 4]].forEach(([a, b]) => {
          seg.push(...nodes[a], ...nodes[b]);
        });
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
        g.add(new THREE.LineSegments(lg, lineMat));
        break;
      }
      case '406': {   // 软件工程：三层堆栈
        for (let i = 0; i < 3; i++) {
          const slab = new THREE.Mesh(
            new THREE.BoxGeometry(0.25 - i * 0.045, 0.016, 0.19 - i * 0.032), mat,
          );
          slab.position.y = (i - 1) * 0.062;
          g.add(slab);
        }
        break;
      }
      default: {      // 505 交互：球 + 倾斜轨道
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 14), mat));
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.006, 6, 40), mat);
        orbit.rotation.x = Math.PI * 0.34;
        g.add(orbit);
      }
    }
    g.scale.setScalar(EMBLEM_SCALE);
    return g;
  }

  /* ---------------------------------------------------------- 取景 */

  const BOX = new THREE.Box3();
  const _p = new THREE.Vector3();

  /* 整片网格（含底座和头顶的标识物）的包围盒。fit() 用它做数值校正。 */
  function measure() {
    BOX.makeEmpty();
    for (const t of st.tiles) {
      const p = t.group.position;
      BOX.expandByPoint(_p.set(p.x - TILE.size / 2 - 0.12, -0.34, p.z - TILE.size / 2 - 0.12));
      BOX.expandByPoint(_p.set(p.x + TILE.size / 2 + 0.12, t.h / 2 + 0.36, p.z + TILE.size / 2 + 0.12));
    }
  }

  /* 在给定距离上，包围盒八个角投到屏幕后最靠边的那个有多靠边（1 = 正好贴边） */
  function overflowAt(dist) {
    cam.position.set(0, Math.sin(GRID_PITCH) * dist, Math.cos(GRID_PITCH) * dist);
    cam.lookAt(look);
    cam.updateMatrixWorld();
    let worst = 0;
    for (let i = 0; i < 8; i++) {
      _p.set(
        i & 1 ? BOX.max.x : BOX.min.x,
        i & 2 ? BOX.max.y : BOX.min.y,
        i & 4 ? BOX.max.z : BOX.min.z,
      ).project(cam);
      worst = Math.max(worst, Math.abs(_p.x), Math.abs(_p.y));
    }
    return worst;
  }

  /* 按画布比例算相机距离：竖屏也得把整片网格装进去，不能靠写死一个机位。
     先按 needW/needH 估一个距离，再用投影实测校正——
     估算是线性的，而俯视 25° 时近排方块在屏幕上被拉得很开，
     光按世界尺寸留边距，竖屏下最后一行会被台面底边切掉。 */
  function fit() {
    const { w, h } = size();
    const aspect = w / h;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const vFov = cam.fov * Math.PI / 180;
    const rows = Math.ceil(labs.length / st.cols);

    /* 这两个只是起点估算，真正的边界交给下面的投影校正。
       所以边距给得小——给大了会把方块压得很小，白留一圈空地。 */
    const needW = (Math.min(st.cols, labs.length) * STEP) + 0.2;
    const needH = (rows * STEP) + 0.5;

    const distH = (needH / 2) / Math.tan(vFov / 2);
    const distW = (needW / 2) / (Math.tan(vFov / 2) * aspect);
    let dist = Math.max(distH, distW);

    measure();
    /* 越界比例大致和距离成反比，所以按比例退一次就够，退两次是保险 */
    for (let i = 0; i < 3; i++) {
      const o = overflowAt(dist);
      if (o <= 0.98) break;
      dist *= o / 0.98;
    }

    home.y = Math.sin(GRID_PITCH) * dist;
    home.z = Math.cos(GRID_PITCH) * dist;

    /* 雾要跟着机位走。写死 13~26 的话，窄屏相机退到二十多米，
       整片方块会被雾吃掉——这就是窄屏打开后一片空白的原因。 */
    if (scene.fog) {
      scene.fog.near = dist * 1.5;
      scene.fog.far = dist * 3.2;
    }

    if (!st.tween) {
      cam.position.set(home.x, home.y, home.z);
      cam.lookAt(look);
    }

    placeLogo();
  }

  /* 把 logo 摆到"方块上方那条空带"里。
     空带有多高取决于机位，所以先算出 logo 所在深度上取景框的上下沿，再往里放：
     大小按网格宽度（竖屏跟着缩小），高度按取景框（画布矮就往下挪，绝不被裁）。

     俯角要用相机真正朝的方向算。相机是 lookAt(look) 的，实际俯角
     atan(2.87/7.49)≈21°，比 GRID_PITCH 的 25° 浅——直接拿 25° 去推，
     "画面上沿"会算低一米多，logo 就掉到方块前面去了。 */
  function placeLogo() {
    if (!st.logo) return;

    const pitch = Math.atan2(home.y - look.y, home.z - look.z);
    const vFov = cam.fov * Math.PI / 180;

    const d = (home.z - LOGO_Z) / Math.cos(pitch);
    const half = Math.tan(vFov / 2) * d * Math.cos(pitch);
    const top = home.y - Math.sin(pitch) * d + half;

    const needW = (Math.min(st.cols, labs.length) * STEP) + 0.9;
    const k = Math.max(0.8, needW / (4 * STEP + 0.9));
    const lh = 2.8 * k;
    const lw = lh * st.logoAspect;

    /* 标志要完整地站在方块上方那道空带里。
       以前是按 1.68*k 硬摆的，空带一变窄（间距、俯角、取景任何一项改动都会变）
       标志就被压到方块背后，只剩上半截露出来——看着像"这页没有院徽"。
       现在先量空带有多高，放不下就缩，而不是往下掉。 */
    const floorY = TILE.height / 2 + 0.12;   // 方块顶再往上一点
    const ceilY = top - half * 0.03;         // 画面上沿，留一点呼吸
    const room = Math.max(0.5, ceilY - floorY);
    const fitH = Math.min(lh, room);
    const y = floorY + fitH / 2;

    st.logo.scale.set(fitH * st.logoAspect, fitH, 1);
    st.logo.position.set(0, y, LOGO_Z);
    st.logoY = y;
  }

  /* ---------------------------------------------------------- 每帧 */

  function update(dt) {
    if (st.disposed) return;
    const { w, h } = size();

    /* 鼠标视差：很小的位移，作用是让静止画面有一点"活着"的感觉。
       幅度必须压到 0.1 以下——相机一动，方块在屏幕上就跟着挪，
       鼠标底下原本瞄准的方块会跑掉，点击就点空了。 */
    const px = st.pointer.nx * 0.085;
    const py = st.pointer.ny * 0.05;

    if (st.tween) {
      st.tween.t += dt * 1000;
      const k = Math.min(1, st.tween.t / st.tween.dur);
      const e = 1 - Math.pow(1 - k, 3);
      cam.position.lerpVectors(st.tween.p0, st.tween.p1, e);
      look.lerpVectors(st.tween.t0, st.tween.t1, e);
      cam.lookAt(look);
      if (k >= 1) st.tween = null;
    } else {
      cam.position.x = lerp(cam.position.x, home.x + px, 0.06);
      cam.position.y = lerp(cam.position.y, home.y - py, 0.06);
      cam.position.z = lerp(cam.position.z, home.z, 0.06);
      cam.lookAt(look);
    }

    /* 悬停检测：每帧最多一次，七个方块开销可忽略 */
    if (st.pointer.has) {
      const hit = pick(st.pointer.x, st.pointer.y);
      if (hit !== st.hover) {
        st.hover = hit;
        canvas.classList.toggle('is-pointing', !!hit);
      }
    }

    /* 悬停上浮 + 顶面微微发亮 + 标识物转快 */
    const now = performance.now() * 0.001;
    st.clock += dt;
    for (const t of st.tiles) {
      const on = st.hover === t;
      t.liftTo = on ? 0.085 : 0;
      t.lift = lerp(t.lift, t.liftTo, 1 - Math.pow(0.001, dt));

      /* 入场：延迟到了才升。easeOutBack 会过冲一点，方块"落"回台面
         的那一下才有重量；匀速升上去像电梯。 */
      if (t.appear < 1) {
        const k = Math.min(1, Math.max(0, (st.clock - t.intro) / 0.82));
        t.appear = k;
        const e = easeOutBack(k);
        t.group.position.y = -3.4 * (1 - e) + t.lift;
        t.group.scale.setScalar(0.9 + 0.1 * e);
      } else {
        t.group.position.y = t.lift;
      }
      t.top.emissiveIntensity = lerp(t.top.emissiveIntensity, on ? 0.13 : 0, 1 - Math.pow(0.001, dt));

      if (t.emblem) {
        t.emblem.rotation.y += dt * (on ? 2.2 : 0.55);
        t.emblem.position.y = t.h / 2 + 0.05 + Math.sin(now * 1.1 + t.phase) * 0.032;
        const sc = lerp(t.emblem.scale.x, EMBLEM_SCALE * (on ? 1.16 : 1), 1 - Math.pow(0.002, dt));
        t.emblem.scale.setScalar(sc);
      }
    }

    /* 悬停定位环：贴在被指的那块方块脚下，慢慢亮起来，外圈一直在轻轻呼吸 */
    if (st.marker) {
      const mk = st.marker;
      mk.on = lerp(mk.on, st.hover ? 1 : 0, 1 - Math.pow(0.0009, dt));
      if (st.hover) {
        mk.group.position.x = st.hover.group.position.x;
        mk.group.position.z = st.hover.group.position.z;
      }
      mk.group.visible = mk.on > 0.01;
      mk.inner.material.opacity = 0.62 * mk.on;
      mk.outer.material.opacity = 0.32 * mk.on;
      mk.outer.scale.setScalar(1 + Math.sin(now * 2.2) * 0.04);
    }

    /* 点击涟漪：从方块脚下荡开，边扩边淡 */
    for (let i = st.ripples.length - 1; i >= 0; i--) {
      const r = st.ripples[i];
      r.t += dt;
      const k = Math.min(1, r.t / 0.8);
      r.mesh.scale.setScalar(1 + k * 4.6);
      r.mesh.material.opacity = 0.62 * (1 - k) * (1 - k);
      if (k >= 1) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        st.ripples.splice(i, 1);
      }
    }

    /* 背景：代码符号慢慢飘，logo 反向跟着鼠标走，纵深感来自这个反向。
       每颗字上下浮动 + 原地微旋 + 一点点横向漂移——只做上下的话，
       一排字会像电梯一样整齐地一起动，反而露馅。 */
    for (const sp of st.glyphs) {
      const u = sp.userData;
      sp.position.y = u.baseY + Math.sin(now * u.speed + u.phase) * 0.16;
      sp.position.x = u.baseX + Math.sin(now * u.speed * 0.55 + u.driftPhase) * u.drift;
      sp.material.rotation += dt * u.spin;
    }
    if (st.logo) {
      st.logo.position.x = -st.pointer.nx * 0.55;
      st.logo.position.y = st.logoY - st.pointer.ny * 0.14;
      st.logo.material.opacity = 0.3 + Math.sin(now * 0.7) * 0.022;
    }
  }

  /* ---------------------------------------------------------- 输入 */

  function setPointer(clientX, clientY) {
    st.pointer.x = clientX;
    st.pointer.y = clientY;
    st.pointer.has = true;
    const r = canvas.getBoundingClientRect();
    st.pointer.nx = ((clientX - r.left) / r.width) * 2 - 1;
    st.pointer.ny = ((clientY - r.top) / r.height) * 2 - 1;
  }

  function clearPointer() {
    st.pointer.has = false;
    st.pointer.nx = 0;
    st.pointer.ny = 0;
  }

  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, cam);
    const hits = ray.intersectObjects(st.tiles.map(t => t.box), false);
    if (!hits.length) return null;
    return st.tiles.find(t => t.box === hits[0].object) || null;
  }

  function hovered() { return st.hover; }

  /* 相机压向被点的方块，是"走过去"而不是"切画面" */
  function flyToTile(lab, dur = 560) {
    const tile = st.tiles.find(t => t.lab.id === lab.id);
    if (!tile) return;
    tile.liftTo = 0.42;
    /* 脚下先荡开一圈，镜头再推过去——顺序反了会像"点了没反应" */
    spawnRipple(tile.group.position.x, tile.group.position.z);
    const tgt = tile.group.position.clone().setY(0.52);
    st.tween = {
      t: 0, dur,
      p0: cam.position.clone(),
      p1: tgt.clone().add(new THREE.Vector3(0, 1.5, 2.3)),
      t0: look.clone(),
      t1: tgt,
    };
  }

  function reset() {
    st.tween = null;
    st.hover = null;
    st.tiles.forEach(t => { t.lift = 0; t.liftTo = 0; t.group.position.y = 0; });
    look.set(0, 0.62, 0);
    fit();
  }

  function resize() {
    const { w, h } = size();
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    /* 列数可能因为比例变了而变（竖屏 2 列 / 宽屏 4 列），那就得重新排 */
    const cols = colsFor(w / h);
    if (cols !== st.cols) {
      rebuild();
    } else {
      fit();
    }
  }

  /* 换列数只能重建：方块的 x/z 是按列数算的 */
  function rebuild() {
    for (const t of st.tiles) {
      scene.remove(t.group);
      disposeObject(t.group);
    }
    st.tiles = [];
    layoutTiles();
    fit();
  }

  function disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  function dispose() {
    st.disposed = true;
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    scene.clear();
    st.tiles = [];
    st.glyphs = [];
    st.logo = null;
    st.marker = null;
    st.ripples = [];
  }

  return {
    scene, cam,
    build, fit, resize, update, dispose,
    setPointer, clearPointer, pick, hovered,
    flyToTile, reset,
    get tiles() { return st.tiles; },
  };
}
