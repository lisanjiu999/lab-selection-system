/* 开放日 3D 展厅 —— 所有 2D 画面都在这里生成。
 *
 * 3D 世界（相机、灯光、几何体、交互）在 openday.js。
 * 这个文件只回答一个问题：屏幕上该出现什么。
 *
 * 全部用 canvas 现画，不引任何外部图片、视频、字体文件：
 * H2 内存库重启即清空，素材若落盘会留下对不上号的孤儿文件；
 * 而且演示环境不一定有网，离线能跑比"素材精美"重要。
 */

export const C = {
  paper: '#fffaf0',
  paper2: '#fbf4e4',
  ink: '#3f3325',
  text: '#4a3d2f',
  muted: '#76624d',
  faint: '#816b53',
  /* 系统主色。名字留着 sage，值已经是橙色系——改值一处，全站生效 */
  sage: '#e8791e',
  sageDeep: '#c2410c',
  sageDark: '#9a3606',
  cream: '#f4e4bc',
  line: 'rgba(90, 74, 58, 0.16)',
  lineSoft: 'rgba(90, 74, 58, 0.09)',
  dark: '#1f332d',
  darkSoft: '#2a423a',
};

export const FONT = '"Quicksand Variable", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';

/* 代码风格的那半套字：等宽，不引字体文件，用系统自带的 */
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace';

/* 每个实训室一套色：和系统里 labColor/labInk 同一套，3D 和网页看起来是一家人 */
const LAB_COLOR = {
  '202': '#d9efe9', '204': '#dbe7f7', '206': '#f8e4d1', '402': '#e8dff7',
  '404': '#dfefdc', '406': '#f8eed2', '505': '#f8dfe6',
};
const LAB_INK = {
  '202': '#2f6f64', '204': '#3a5c8f', '206': '#96602e', '402': '#6a4d92',
  '404': '#4a6f3c', '406': '#8a6a24', '505': '#9b4a63',
};

export function labTint(code) { return LAB_COLOR[String(code)] || '#f8eed2'; }
export function labInk(code) { return LAB_INK[String(code)] || '#8a6a24'; }

/* ------------------------------------------------------------------ 内容 */

/* 七个实训室的展厅内容。方向、备注来自数据库；设备、项目、要求是本项目
 * 演示用的示例资料——真实部署时应该换成各室自己交上来的材料。 */
const CONTENT = {
  '202': {
    kicker: '感知 · 端侧智能',
    code: 'sensor.fuse(rgb, depth, audio)',
    snippet: [
      'const lab = new Lab({',
      '  id: "202",',
      '  focus: "multimodal",',
      '  stack: ["jetson", "onnx"],',
      '});',
    ],
    motto: '让设备自己看懂现场',
    equip: [
      '多模态采集阵列：RGB-D ×4、阵列麦克风 ×2、标定转台',
      'Jetson Orin 边缘节点 ×6，支持板端推理与功耗实测',
      '隔音观察间，可做语音-视觉同步采集',
    ],
    projects: [
      { t: '教室注意力感知', d: '摄像头与麦克风融合，估计课堂互动分布' },
      { t: '端侧跌倒检测', d: '在 15W 功耗内跑通实时检测与告警' },
      { t: '语音-视觉联合检索', d: '用一句话找回某段课堂录像' },
    ],
    reqs: [
      'C++ 或 Python 至少一门能独立写模块',
      '愿意动手调硬件，接受设备排班',
      '每周可支配时间不少于 8 小时',
    ],
    doc: {
      title: '端侧多模态感知 · 项目材料',
      sections: [
        { h: '一、课题背景', p: '校园场景里的感知任务长期依赖云端推理：带宽吃紧、隐私敏感、断网即失效。本室把模型压到边缘节点上，在 15W 功耗预算内完成多模态融合。' },
        { h: '二、本期开放课题', l: ['教室互动分布估计（已有 2 学期标注数据）', '端侧跌倒检测（与后勤联合，需现场采集）', '跨模态检索原型（语音描述找视频片段）'] },
        { h: '三、可用资源', l: ['RGB-D 采集阵列 4 套、阵列麦克风 2 套', 'Jetson Orin 节点 6 台，独占使用', '标注完成的课堂数据集 320 小时'] },
        { h: '四、对同学的期待', p: '不要求发论文，但要求每个阶段有可运行的产出。硬件调试会占掉不少时间，请确认自己愿意花这个时间再来。' },
      ],
    },
  },
  '204': {
    kicker: '数据 · 大模型应用',
    code: 'llm.rag(query, { topK: 8 })',
    snippet: [
      'const lab = new Lab({',
      '  id: "204",',
      '  focus: "data + llm",',
      '  stack: ["vllm", "pgvector"],',
      '});',
    ],
    motto: '把数据变成能用的判断',
    equip: [
      '8 卡推理服务器 ×2，支持 70B 级模型量化部署',
      '脱敏校园数据集：教务、一卡通、图书馆、门禁',
      '向量检索集群，千万级索引毫秒响应',
    ],
    projects: [
      { t: '学业预警模型', d: '用行为序列提前一学期识别风险学生' },
      { t: '校园问答 RAG', d: '接教务规章，回答要能给出条款出处' },
      { t: '课表冲突求解', d: '把排课约束写成可解的优化问题' },
    ],
    reqs: [
      'SQL 熟练，Python 能写数据管道',
      '读过至少一篇大模型相关论文',
      '对"模型为什么错"有兴趣，不只调包',
    ],
    doc: {
      title: '校园数据智能 · 项目材料',
      sections: [
        { h: '一、数据边界', p: '所有数据集在入库前完成脱敏，学号替换为不可逆哈希，姓名与联系方式不进入训练集。使用需签署数据使用承诺书。' },
        { h: '二、本期开放课题', l: ['学业预警：基于行为序列的早期识别', '校园问答：规章类文档的检索增强生成', '排课求解：硬约束与软偏好的分层处理'] },
        { h: '三、算力与工具', l: ['推理服务器 2 台（8 卡），按周申请', '向量库与评测集已搭好，可直接接', '实验记录统一走本室模板，便于复现'] },
        { h: '四、考核方式', p: '不看模型分数排行榜，看能不能说清楚：这个指标涨了，是因为哪一处改动。' },
      ],
    },
  },
  '206': {
    kicker: '嵌入式 · 机器人控制',
    code: 'robot.gait({ step: 0.4 })',
    snippet: [
      'const lab = new Lab({',
      '  id: "206",',
      '  focus: "embedded",',
      '  stack: ["stm32", "ros2"],',
      '});',
    ],
    motto: '代码写下去，机器要动起来',
    equip: [
      '四足平台 ×2、差速底盘 ×6，均开放底层接口',
      '示波器、逻辑分析仪、可编程电源各 2 套',
      'STM32 / ESP32 全系开发板与传感器套件',
    ],
    projects: [
      { t: '四足步态调参', d: '在真实地形上把步态调稳，不是仿真' },
      { t: '底盘 SLAM 建图', d: '低成本激光雷达 + 轮速融合' },
      { t: '低功耗传感节点', d: '纽扣电池跑一年的环境采集节点' },
    ],
    reqs: [
      '会 C，能看懂寄存器手册',
      '接受上机排班（平台需两人以上操作）',
      '不怕焊板子、不怕调不通',
    ],
    doc: {
      title: '嵌入式与机器人 · 项目材料',
      sections: [
        { h: '一、安全须知', p: '四足平台与差速底盘必须在两人以上在场时上电，禁止单人调试。电池充电须在指定区域，离开实验室前断电。' },
        { h: '二、本期开放课题', l: ['四足步态：复杂地形下的稳定性调参', '底盘建图：低成本雷达与轮速融合', '低功耗节点：能量采集与休眠策略'] },
        { h: '三、平台清单', l: ['四足平台 2 台（含底层 SDK）', '差速底盘 6 台（ROS 驱动已就绪）', '示波器 / 逻辑分析仪 / 可编程电源'] },
        { h: '四、时间安排', p: '前两周熟悉平台与安全规范，第三周起进入课题。每周一次上机，缺席需提前报备。' },
      ],
    },
  },
  '402': {
    kicker: '视觉 · 三维重建',
    code: 'recon.mesh(pointcloud, 16)',
    snippet: [
      'const lab = new Lab({',
      '  id: "402",',
      '  focus: "3d vision",',
      '  stack: ["cuda", "colmap"],',
      '});',
    ],
    motto: '把现实量成可计算的形状',
    equip: [
      '自研多相机采集阵列（16 机位同步）',
      '结构光扫描仪，精度 0.1mm',
      'A100 ×2，重建与训练共用',
    ],
    projects: [
      { t: '文物三维重建', d: '与本地博物馆合作，做可交互的数字藏品' },
      { t: '手部姿态估计', d: '遮挡与快速运动下的鲁棒跟踪' },
      { t: '工业缺陷检测', d: '小样本条件下的表面缺陷识别' },
    ],
    reqs: [
      '线性代数与概率论扎实',
      '能读英文论文并复现核心公式',
      '对几何有耐心，重建常常要调一周',
    ],
    doc: {
      title: '视觉计算 · 项目材料',
      sections: [
        { h: '一、研究方向', p: '本室做两件事：把真实世界采成三维数据，再从三维数据里抽出可用的判断。采集硬件自研，算法与硬件一起调。' },
        { h: '二、本期开放课题', l: ['文物数字化：多机位采集与纹理映射', '手部姿态：遮挡场景下的关键点补全', '缺陷检测：小样本与域偏移'] },
        { h: '三、设备与算力', l: ['16 机位同步采集阵列（可预约）', '结构光扫描仪，精度 0.1mm', 'A100 ×2，按周分配'] },
        { h: '四、入门建议', p: '先把多视图几何的前半本读完再来，否则会在坐标系里迷路。本室不提供"手把手教数学"。' },
      ],
    },
  },
  '404': {
    kicker: '网络 · 分布式系统',
    code: 'raft.replicate({ peers: 5 })',
    snippet: [
      'const lab = new Lab({',
      '  id: "404",',
      '  focus: "net + dist",',
      '  stack: ["p4", "ebpf"],',
      '});',
    ],
    motto: '先假设会出事，再让它不出事',
    equip: [
      '物理隔离实验网段，与校园网完全断开',
      '可编程交换机 ×2，支持 P4',
      '蜜罐集群与流量回放环境',
    ],
    projects: [
      { t: '内网异常检测', d: '在回放流量里找出横向移动的痕迹' },
      { t: '一致性协议实验', d: '自己实现一遍 Raft，再打故障注入' },
      { t: '协议模糊测试', d: '对真实设备固件做黑盒测试' },
    ],
    reqs: [
      '熟悉 Linux 命令行与抓包',
      '严格遵守隔离环境规则，违者立即退出',
      '能接受"大部分时间在复现别人的失败"',
    ],
    doc: {
      title: '网络系统 · 项目材料',
      sections: [
        { h: '一、环境规则', p: '实验网段物理隔离，禁止以任何形式桥接校园网或外网。所有攻击性实验仅限本网段内的靶机，违规即刻终止资格并报学院。' },
        { h: '二、本期开放课题', l: ['内网异常：横向移动的流量特征', '一致性：Raft 实现与故障注入', '协议安全：固件黑盒模糊测试'] },
        { h: '三、平台', l: ['可编程交换机 2 台（P4）', '蜜罐集群 8 节点', '流量回放环境（含真实脱敏样本）'] },
        { h: '四、说明', p: '本室节奏偏慢，前期大量时间花在搭环境和复现上。想要快速出成果的同学建议选别的室。' },
      ],
    },
  },
  '406': {
    kicker: '软件工程 · 智能体',
    code: 'agent.deploy({ rollback: true })',
    snippet: [
      'const lab = new Lab({',
      '  id: "406",',
      '  focus: "agent eng",',
      '  stack: ["ci/cd", "eval"],',
      '});',
    ],
    motto: '能上线的才算做完',
    equip: [
      '完整 CI/CD 流水线，提交即构建即部署',
      '真实业务沙箱，对接校园服务的测试实例',
      '智能体评测集与回归基线',
    ],
    projects: [
      { t: '校园服务智能体', d: '把办事流程拆成可执行、可回滚的步骤' },
      { t: '代码评审助手', d: '在真实提交上给出可采纳的意见' },
      { t: '工程效能度量', d: '用数据回答"改哪里最省时间"' },
    ],
    reqs: [
      'Git 协作熟练，能写清楚的提交信息',
      '有至少一个完整项目经历',
      '接受代码评审，也愿意评审别人',
    ],
    doc: {
      title: '软件工程与智能体 · 项目材料',
      sections: [
        { h: '一、工作方式', p: '本室按真实项目节奏推进：需求评审、拆任务、周迭代、上线验收。每周一次站会，产出必须可运行。' },
        { h: '二、本期开放课题', l: ['校园服务智能体：流程编排与失败回滚', '代码评审助手：意见可采纳率优化', '效能度量：从提交数据反推瓶颈'] },
        { h: '三、基础设施', l: ['CI/CD 流水线（提交即构建）', '业务沙箱：校园服务测试实例', '评测集与回归基线，防止改坏'] },
        { h: '四、期待', p: '不需要你什么都会，但需要你交付的东西别人能接手：有文档、有测试、有回滚方案。' },
      ],
    },
  },
  '505': {
    kicker: '交互 · 可穿戴',
    code: 'ux.probe(user, { think: true })',
    snippet: [
      'const lab = new Lab({',
      '  id: "505",',
      '  focus: "hci",',
      '  stack: ["figma", "eye-track"],',
      '});',
    ],
    motto: '先看人怎么用，再决定做什么',
    equip: [
      '眼动仪、可穿戴手势手套、生理信号采集',
      '绿幕访谈间与可用性测试实验室',
      '原型工具链：Figma → 硬件原型',
    ],
    projects: [
      { t: '校园导览可穿戴原型', d: '抬手就能看到下一节课在哪' },
      { t: '无障碍交互评估', d: '为视障同学重做一套导航反馈' },
      { t: '专注度反馈装置', d: '不打扰的前提下提示休息' },
    ],
    reqs: [
      '愿意做用户访谈，能跟陌生人聊',
      '会 Figma 更好，不会可以学',
      '接受自己的方案被用户否掉',
    ],
    doc: {
      title: '人机交互 · 项目材料',
      sections: [
        { h: '一、方法', p: '本室的项目从访谈开始，不从技术开始。每个课题前两周只做一件事：找到 5 个真实用户，问清楚他们现在怎么解决这个问题。' },
        { h: '二、本期开放课题', l: ['校园导览：可穿戴的即时信息呈现', '无障碍：视障同学的导航反馈重构', '专注度：低干扰的疲劳提示'] },
        { h: '三、设备', l: ['眼动仪 1 台（需预约）', '可穿戴手势手套 2 套', '绿幕访谈间与可用性测试室'] },
        { h: '四、产出形式', p: '交付物不一定是代码：可以是完整的设计方案 + 可交互原型 + 用户测试报告。' },
      ],
    },
  },
};

export function contentOf(lab) {
  return CONTENT[String(lab.code)] || CONTENT['406'];
}

/* ------------------------------------------------------------ 绘制工具 */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* 中文按字符宽度折行。canvas 没有自动换行，只能自己量。 */
function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const ch of String(text)) {
    if (ch === '\n') { out.push(line); line = ''; continue; }
    const t = line + ch;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; }
    else line = t;
  }
  if (line) out.push(line);
  return out;
}

function fillTextWrapped(ctx, text, x, y, maxW, lh, maxLines = 99) {
  const lines = wrap(ctx, text, maxW);
  const n = Math.min(lines.length, maxLines);
  for (let i = 0; i < n; i++) {
    let s = lines[i];
    if (i === n - 1 && lines.length > maxLines) s = s.slice(0, -1) + '…';
    ctx.fillText(s, x, y + i * lh);
  }
  return y + n * lh;
}

/* 像素头像：和网页里 pixelAvatar 同一套算法，3D 展板上看起来是同一个人 */
function avSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const AV_COLOR = ['#d9efe9', '#dbe7f7', '#f8e4d1', '#e8dff7', '#dfefdc', '#f8eed2', '#f8dfe6'];

function drawPixelAvatar(ctx, name, x, y, size) {
  const h = avSeed(name);
  const bg = AV_COLOR[(h >>> 5) % AV_COLOR.length];
  const cell = size / 5;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = C.ink;
  let any = false;
  for (let yy = 0; yy < 5; yy++) {
    for (let xx = 0; xx < 3; xx++) {
      if (((h >>> ((yy * 3 + xx) % 28)) & 1) === 0) continue;
      any = true;
      ctx.fillRect(x + xx * cell, y + yy * cell, cell, cell);
      if (xx < 2) ctx.fillRect(x + (4 - xx) * cell, y + yy * cell, cell, cell);
    }
  }
  if (!any) ctx.fillRect(x + 2 * cell, y + cell, cell, 3 * cell);
}

/* -------------------------------------------------- 1. 方块顶面（实验室名） */

export function tileCanvas(lab, size = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const ink = labInk(lab.code);

  ctx.fillStyle = labTint(lab.code);
  ctx.fillRect(0, 0, size, size);

  /* 内描边：让方块顶面像一块压印的铭牌 */
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = size * 0.008;
  ctx.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);
  ctx.globalAlpha = 1;

  /* 左上编号 */
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.5;
  ctx.font = `600 ${size * 0.062}px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText(lab.code, size * 0.11, size * 0.11);
  ctx.globalAlpha = 1;

  /* 右上角：一对花括号。整块铭牌只靠这一个符号说"这是代码"，
     其余排版保持原来的克制。 */
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.26;
  ctx.font = `600 ${size * 0.105}px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('{ }', size * 0.89, size * 0.095);
  ctx.globalAlpha = 1;

  /* 实验室名：拆成两行。七个室的名字都是「XX实验室」结构，
     一行排满会顶到铭牌边，两行反而能把字放大。 */
  const name = lab.name;
  let lines;
  if (name.length <= 5) {
    lines = [name];
  } else if (name.endsWith('实验室') && name.length <= 9) {
    lines = [name.slice(0, -3), '实验室'];
  } else {
    const mid = Math.ceil(name.length / 2);
    lines = [name.slice(0, mid), name.slice(mid)];
  }

  const longest = Math.max(...lines.map(l => l.length));
  const fs = Math.min(size * 0.135, (size * 0.76) / longest);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = C.ink;
  const lh = fs * 1.16;
  const startY = size * 0.46 - (lines.length - 1) * lh * 0.5;
  lines.forEach((ln, i) => ctx.fillText(ln, size * 0.5, startY + i * lh));

  /* 方向 */
  ctx.font = `500 ${size * 0.052}px ${FONT}`;
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.8;
  ctx.fillText(lab.direction || '', size * 0.5, size * 0.685);
  ctx.globalAlpha = 1;

  /* 一行等宽代码，写这间室在干什么。字号按字符数回退，长的不会顶出铭牌。 */
  const d = contentOf(lab);
  if (d.code) {
    const fs2 = Math.min(size * 0.045, (size * 0.64) / (d.code.length * 0.62));
    ctx.font = `500 ${fs2}px ${MONO}`;
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.42;
    ctx.fillText(d.code, size * 0.5, size * 0.765);
    ctx.globalAlpha = 1;
  }

  /* 底部一条主色横线，作为"点我进去"的暗示 */
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(size * 0.44, size * 0.83, size * 0.12, size * 0.007);
  ctx.globalAlpha = 1;

  return cv;
}

/* ------------------------------------------- 1b. 方块侧面（代码水印） */

/* 侧面贴一层极淡的代码，像隔着磨砂玻璃看到的一屏终端。
   字号压得很小、透明度只有 0.1，它不负责读，只负责"这里在写代码"。
   纹理做成 1024×316 是因为侧面是 1.62×0.5（3.24:1），
   用正方形纹理会被横向拉成胖字。 */
export function sideCanvas(lab, w = 1024, h = 316) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const ink = labInk(lab.code);
  const d = contentOf(lab);
  const base = '#faf5e9';

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const lines = d.snippet || [];
  if (lines.length) {
    ctx.font = `500 ${h * 0.115}px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const lh = h * 0.2;
    const startY = h * 0.5 - (lines.length - 1) * lh * 0.5;
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.1;
    lines.forEach((ln, i) => ctx.fillText(ln, w * 0.055, startY + i * lh));
    ctx.globalAlpha = 1;
  }

  /* 上下各压一道渐隐，侧面和顶面交界处不会有生硬的一条线 */
  const fade = h * 0.22;
  const top = ctx.createLinearGradient(0, 0, 0, fade);
  top.addColorStop(0, base);
  top.addColorStop(1, 'rgba(250,245,233,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, fade);

  const bot = ctx.createLinearGradient(0, h - fade, 0, h);
  bot.addColorStop(0, 'rgba(250,245,233,0)');
  bot.addColorStop(1, base);
  ctx.fillStyle = bot;
  ctx.fillRect(0, h - fade, w, fade);

  return cv;
}

/* -------------------------------------------------------- 2. PPT 幻灯片 */

export function deckOf(lab) {
  const d = contentOf(lab);
  return [
    { kind: 'cover' },
    { kind: 'list', title: '研究方向', lead: d.motto, items: d.equip.length ? [lab.direction, ...d.reqs.slice(0, 1)] : [] },
    { kind: 'list', title: '设备与平台', items: d.equip },
    { kind: 'cards', title: '代表项目', items: d.projects },
    { kind: 'list', title: '招募要求', items: d.reqs },
    { kind: 'doc', title: '材料索引' },
  ];
}

export function paintSlide(ctx, W, H, page, deck, lab) {
  const d = contentOf(lab);
  const ink = labInk(lab.code);
  const slide = deck[page] || deck[0];
  const pad = W * 0.075;

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  /* 页眉：细线 + 实训室编号，PPT 的"模板感"来自这两处固定元素 */
  ctx.fillStyle = C.line;
  ctx.fillRect(pad, H * 0.085, W - pad * 2, Math.max(1, H * 0.0022));
  ctx.font = `600 ${H * 0.026}px ${FONT}`;
  ctx.fillStyle = C.faint;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${lab.code} · ${lab.name}`, pad, H * 0.068);
  ctx.textAlign = 'right';
  ctx.fillText(`${page + 1} / ${deck.length}`, W - pad, H * 0.068);

  if (slide.kind === 'cover') {
    /* 封面：大色块 + 名称 + 一句 motto */
    ctx.fillStyle = labTint(lab.code);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(W * 0.86, H * 0.2, H * 0.42, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.62;
    ctx.font = `600 ${H * 0.032}px ${FONT}`;
    ctx.fillText(d.kicker, pad, H * 0.42);
    ctx.globalAlpha = 1;

    ctx.fillStyle = C.ink;
    ctx.font = `700 ${H * 0.098}px ${FONT}`;
    ctx.fillText(lab.name, pad, H * 0.58);

    ctx.fillStyle = C.text;
    ctx.font = `500 ${H * 0.042}px ${FONT}`;
    ctx.fillText(d.motto, pad, H * 0.70);

    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.75;
    ctx.font = `500 ${H * 0.028}px ${FONT}`;
    ctx.fillText(lab.direction || '', pad, H * 0.82);
    ctx.globalAlpha = 1;
    return;
  }

  /* 标题 */
  ctx.textAlign = 'left';
  ctx.fillStyle = ink;
  ctx.fillRect(pad, H * 0.155, H * 0.008, H * 0.075);
  ctx.fillStyle = C.ink;
  ctx.font = `700 ${H * 0.062}px ${FONT}`;
  ctx.fillText(slide.title, pad + H * 0.03, H * 0.215);

  let y = H * 0.33;

  if (slide.kind === 'list') {
    ctx.font = `500 ${H * 0.038}px ${FONT}`;
    for (const it of slide.items) {
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(pad + H * 0.012, y - H * 0.013, H * 0.008, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.text;
      const endY = fillTextWrapped(ctx, it, pad + H * 0.042, y, W - pad * 2 - H * 0.05, H * 0.052, 2);
      y = endY + H * 0.035;
    }
  } else if (slide.kind === 'cards') {
    const n = slide.items.length;
    const cw = (W - pad * 2 - H * 0.03 * (n - 1)) / n;
    const ch = H * 0.42;
    slide.items.forEach((it, i) => {
      const x = pad + i * (cw + H * 0.03);
      ctx.fillStyle = C.paper2;
      roundRect(ctx, x, y, cw, ch, H * 0.022);
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = Math.max(1, H * 0.002);
      ctx.stroke();

      ctx.fillStyle = labTint(lab.code);
      ctx.fillRect(x, y, cw, H * 0.008);

      ctx.fillStyle = C.ink;
      ctx.font = `700 ${H * 0.038}px ${FONT}`;
      ctx.textAlign = 'left';
      const ty = fillTextWrapped(ctx, it.t, x + cw * 0.08, y + H * 0.08, cw * 0.84, H * 0.046, 2);

      ctx.fillStyle = C.muted;
      ctx.font = `500 ${H * 0.029}px ${FONT}`;
      fillTextWrapped(ctx, it.d, x + cw * 0.08, ty + H * 0.03, cw * 0.84, H * 0.042, 4);
    });
  } else if (slide.kind === 'doc') {
    ctx.fillStyle = C.text;
    ctx.font = `500 ${H * 0.034}px ${FONT}`;
    ctx.fillText('本页对应的完整材料，挂在第三块屏上。', pad, y);
    y += H * 0.07;
    ctx.font = `500 ${H * 0.03}px ${FONT}`;
    ctx.fillStyle = C.muted;
    for (const s of d.doc.sections) {
      ctx.fillStyle = ink;
      ctx.fillRect(pad, y - H * 0.024, H * 0.006, H * 0.028);
      ctx.fillStyle = C.text;
      ctx.font = `600 ${H * 0.031}px ${FONT}`;
      ctx.fillText(s.h, pad + H * 0.02, y);
      y += H * 0.055;
    }
  }
}

/* ------------------------------------------------ 3. 项目演示（动态画面） */

/* 七种演示动画，按实训室方向选。都是"数据在动"的抽象演示，
 * 不是真视频——真视频要编码、要文件、要带宽，这里用 canvas 现场画，
 * 效果上是一块持续播放的屏，成本和可靠性都更好。 */
export function demoKind(lab) {
  return { '202': 'scan', '204': 'flow', '206': 'robot', '402': 'recon', '404': 'net', '406': 'code', '505': 'wave' }[String(lab.code)] || 'flow';
}

/* 演示屏的底色：把本室墨色压到接近黑，只留一点色相。
   七块屏的动画本来就各不相同，底色再跟着房间走，一眼就知道在哪间室。 */
function demoBg(ink) {
  const n = parseInt(ink.slice(1), 16);
  const f = v => Math.round(16 + v * 0.2);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function paintDemo(ctx, W, H, t, lab) {
  const kind = demoKind(lab);
  const ink = labInk(lab.code);
  const tint = labTint(lab.code);
  const bg = demoBg(ink);
  /* 画面里的"暗一档"元素原来写死成薄荷绿，换到暖色房间就突兀了。
     统一从 tint 派生，七块屏各自的暗部都跟着房间走。 */
  const tn = parseInt(tint.slice(1), 16);
  const dim = a => `rgba(${(tn >> 16) & 255},${(tn >> 8) & 255},${tn & 255},${a})`;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* 底纹网格：所有动画共用，让画面有"仪表盘"的底 */
  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.09;
  ctx.lineWidth = 1;
  const g = H * 0.075;
  for (let x = 0; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  const cx = W * 0.5, cy = H * 0.52;

  if (kind === 'scan') {
    /* 感知：一圈扫描波 + 被点亮的点云 */
    const pts = [];
    const N = 170;
    for (let i = 0; i < N; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = Math.sqrt(i / N) * H * 0.36;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.74]);
    }
    const sweep = (t * 0.55) % (Math.PI * 2);
    pts.forEach(([x, y]) => {
      const a = Math.atan2(y - cy, x - cx);
      const d = ((sweep - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const lit = Math.max(0, 1 - d / 1.3);
      ctx.fillStyle = lit > 0.12 ? tint : dim(0.42);
      ctx.globalAlpha = 0.42 + lit * 0.58;
      ctx.beginPath();
      ctx.arc(x, y, H * (0.0085 + lit * 0.013), 0, 7);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    /* 扫描线 */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sweep);
    const grd = ctx.createLinearGradient(0, 0, H * 0.36, 0);
    grd.addColorStop(0, dim(0.55));
    grd.addColorStop(1, dim(0));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, H * 0.36, -0.16, 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (kind === 'flow') {
    /* 数据：节点之间跑光点 */
    const nodes = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.3;
      const r = H * 0.3;
      nodes.push([cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 0.85]);
    }
    ctx.strokeStyle = dim(0.20);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if ((i * 7 + j * 3) % 5 > 1) continue;
        ctx.beginPath(); ctx.moveTo(...nodes[i]); ctx.lineTo(...nodes[j]); ctx.stroke();
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if ((i * 7 + j * 3) % 5 > 1) continue;
        const ph = ((t * 0.6 + i * 0.13 + j * 0.07) % 1);
        const x = nodes[i][0] + (nodes[j][0] - nodes[i][0]) * ph;
        const y = nodes[i][1] + (nodes[j][1] - nodes[i][1]) * ph;
        ctx.fillStyle = tint;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        ctx.beginPath(); ctx.arc(x, y, H * 0.008, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    nodes.forEach(([x, y]) => {
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(x, y, H * 0.022, 0, 7); ctx.fill();
      ctx.strokeStyle = tint; ctx.lineWidth = H * 0.004; ctx.stroke();
    });
  } else if (kind === 'robot') {
    /* 机器人：一条被反复走出来的轨迹 + 关节角柱状图 */
    ctx.strokeStyle = tint;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = H * 0.012;
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const p = i / 160;
      const x = W * 0.12 + p * W * 0.62;
      const y = cy + Math.sin(p * Math.PI * 3 + t * 0.7) * H * 0.17;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* 沿轨迹跑的点 */
    const p = (t * 0.22) % 1;
    const px = W * 0.12 + p * W * 0.62;
    const py = cy + Math.sin(p * Math.PI * 3 + t * 0.7) * H * 0.17;
    ctx.fillStyle = tint;
    ctx.beginPath(); ctx.arc(px, py, H * 0.026, 0, 7); ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(px, py, H * 0.011, 0, 7); ctx.fill();
    /* 右侧关节柱 */
    for (let i = 0; i < 6; i++) {
      const hgt = (0.35 + 0.5 * Math.abs(Math.sin(t * 1.1 + i * 0.9))) * H * 0.4;
      const bx = W * 0.82 + i * W * 0.022;
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.24;
      ctx.fillRect(bx, cy + H * 0.2 - hgt, W * 0.012, hgt);
      ctx.globalAlpha = 1;
      ctx.fillStyle = tint;
      ctx.fillRect(bx, cy + H * 0.2 - hgt, W * 0.012, H * 0.006);
    }
  } else if (kind === 'recon') {
    /* 三维重建：点云绕 Y 轴转 */
    const R = H * 0.26;
    for (let i = 0; i < 320; i++) {
      const a = i * 0.618 * Math.PI * 2;
      const lat = Math.asin(((i / 320) * 2 - 1));
      const rr = Math.cos(lat) * R * (0.7 + 0.3 * Math.sin(i * 1.7));
      const ang = a + t * 0.35;
      const x = cx + Math.cos(ang) * rr * 1.25;
      const y = cy + Math.sin(lat) * R * 1.1;
      const z = Math.sin(ang);
      ctx.fillStyle = z > 0 ? tint : dim(0.30);
      ctx.globalAlpha = 0.4 + (z * 0.5 + 0.5) * 0.6;
      ctx.beginPath(); ctx.arc(x, y, H * 0.005, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (kind === 'net') {
    /* 网络：拓扑 + 沿链路跑的数据包 */
    const nodes = [[cx, cy]];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      nodes.push([cx + Math.cos(a) * W * 0.28, cy + Math.sin(a) * H * 0.3]);
    }
    for (let i = 1; i < nodes.length; i++) {
      ctx.strokeStyle = dim(0.26);
      ctx.lineWidth = H * 0.003;
      ctx.beginPath(); ctx.moveTo(...nodes[0]); ctx.lineTo(...nodes[i]); ctx.stroke();
      /* 数据包 */
      const ph = (t * 0.5 + i * 0.17) % 1;
      const x = nodes[0][0] + (nodes[i][0] - nodes[0][0]) * ph;
      const y = nodes[0][1] + (nodes[i][1] - nodes[0][1]) * ph;
      ctx.fillStyle = ph > 0.85 ? '#c9e0d6' : tint;
      ctx.fillRect(x - H * 0.006, y - H * 0.006, H * 0.012, H * 0.012);
    }
    nodes.forEach(([x, y], i) => {
      const r = i === 0 ? H * 0.028 : H * 0.018;
      ctx.fillStyle = i === 0 ? tint : bg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = tint; ctx.globalAlpha = 0.6; ctx.lineWidth = H * 0.0025; ctx.stroke();
      ctx.globalAlpha = 1;
    });
  } else if (kind === 'code') {
    /* 软件工程：滚动的代码行 + 流水线状态灯 */
    const lh = H * 0.055;
    const rows = Math.floor(H * 0.62 / lh);
    const off = (t * 0.55) % 1;
    for (let i = 0; i < rows; i++) {
      const seed = Math.floor(t * 0.55) + i;
      const w = (0.18 + ((seed * 37) % 47) / 100) * W * 0.5;
      const x = W * 0.1 + ((seed * 13) % 5) * H * 0.04;
      const y = H * 0.28 + i * lh - off * lh;
      ctx.fillStyle = i % 4 === 0 ? tint : dim(0.30);
      ctx.globalAlpha = 0.55 + (i % 4 === 0 ? 0.35 : 0);
      ctx.fillRect(x, y, w, H * 0.012);
    }
    ctx.globalAlpha = 1;
    /* 右侧流水线 */
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(t * 1.4) % 5 >= i;
      const y = H * 0.3 + i * H * 0.11;
      ctx.fillStyle = on ? tint : dim(0.16);
      ctx.beginPath(); ctx.arc(W * 0.88, y, H * 0.016, 0, 7); ctx.fill();
      if (i < 4) {
        ctx.strokeStyle = dim(0.3);
        ctx.beginPath(); ctx.moveTo(W * 0.88, y + H * 0.02); ctx.lineTo(W * 0.88, y + H * 0.09); ctx.stroke();
      }
    }
  } else {
    /* 交互：一圈呼吸波 + 触摸热点 */
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.4 + k / 3) % 1);
      ctx.strokeStyle = tint;
      ctx.globalAlpha = (1 - ph) * 0.55;
      ctx.lineWidth = H * 0.004;
      ctx.beginPath(); ctx.arc(cx, cy, ph * H * 0.32, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + t * 0.3;
      const x = cx + Math.cos(a) * H * 0.2;
      const y = cy + Math.sin(a) * H * 0.2;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.35 + pulse * 0.5;
      ctx.beginPath(); ctx.arc(x, y, H * 0.012 + pulse * H * 0.006, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* 播放器 UI：时间码 + 进度条。有这层才像"视频"，不是一张动图。
     底栏原来是写死的墨绿，换成从本室墨色派生的深色，才不会在暖色房间里突兀。 */
  ctx.fillStyle = bg;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(0, H * 0.9, W, H * 0.1);
  ctx.globalAlpha = 1;
  const total = 96;
  const sec = Math.floor(t) % total;
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');

  ctx.fillStyle = '#b86862';
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.beginPath(); ctx.arc(W * 0.055, H * 0.952, H * 0.011, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = dim(0.92);
  ctx.font = `600 ${H * 0.028}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('REC', W * 0.075, H * 0.953);
  ctx.fillStyle = dim(0.62);
  ctx.fillText(`${mm}:${ss} / 01:36`, W * 0.135, H * 0.953);

  const barX = W * 0.34, barW = W * 0.52;
  ctx.fillStyle = dim(0.22);
  ctx.fillRect(barX, H * 0.949, barW, H * 0.006);
  ctx.fillStyle = tint;
  ctx.fillRect(barX, H * 0.949, barW * (sec / total), H * 0.006);

  ctx.textAlign = 'right';
  ctx.fillStyle = dim(0.55);
  ctx.fillText('项目演示', W * 0.945, H * 0.953);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* -------------------------------------------------------- 4. 材料文档页 */

export function paintDoc(ctx, W, H, page, lab) {
  const d = contentOf(lab);
  const ink = labInk(lab.code);
  const pad = W * 0.09;
  const sec = d.doc.sections[page];

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  /* 纸张左边缘的装订线 */
  ctx.fillStyle = C.lineSoft;
  ctx.fillRect(pad * 0.55, 0, Math.max(1, W * 0.0015), H);

  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = `700 ${H * 0.058}px ${FONT}`;
  ctx.fillText(d.doc.title, pad, H * 0.16);

  ctx.fillStyle = C.faint;
  ctx.font = `500 ${H * 0.026}px ${FONT}`;
  ctx.fillText(`${lab.code} · ${lab.name} · 第 ${page + 1} / ${d.doc.sections.length} 节`, pad, H * 0.205);

  ctx.fillStyle = C.line;
  ctx.fillRect(pad, H * 0.235, W - pad * 2, Math.max(1, H * 0.0022));

  let y = H * 0.33;
  if (sec) {
    ctx.fillStyle = ink;
    ctx.fillRect(pad, y - H * 0.028, H * 0.006, H * 0.032);
    ctx.fillStyle = C.ink;
    ctx.font = `700 ${H * 0.038}px ${FONT}`;
    ctx.fillText(sec.h, pad + H * 0.022, y);
    y += H * 0.075;

    if (sec.p) {
      ctx.fillStyle = C.text;
      ctx.font = `500 ${H * 0.031}px ${FONT}`;
      const lines = wrap(ctx, sec.p, W - pad * 2);
      lines.forEach((ln, i) => ctx.fillText(ln, pad, y + i * H * 0.048));
      y += lines.length * H * 0.048;
    }
    if (sec.l) {
      ctx.font = `500 ${H * 0.031}px ${FONT}`;
      for (const it of sec.l) {
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(pad, y - H * 0.014, H * 0.022, H * 0.0035);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.text;
        const lines = wrap(ctx, it, W - pad * 2 - H * 0.04);
        lines.forEach((ln, i) => ctx.fillText(ln, pad + H * 0.038, y + i * H * 0.046));
        y += lines.length * H * 0.046 + H * 0.022;
      }
    }
  }

  /* 页脚 */
  ctx.fillStyle = C.faint;
  ctx.font = `500 ${H * 0.024}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('项目材料 · 开放日展厅', pad, H * 0.93);
  ctx.textAlign = 'right';
  ctx.fillText(`P${page + 1}`, W - pad, H * 0.93);
  ctx.textAlign = 'left';
}

export function docPageCount(lab) { return contentOf(lab).doc.sections.length; }

/* ------------------------------------------------------ 5. 导师立式展板 */

export function boardCanvas(mentor, lab) {
  const W = 512, H = 768;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const ink = labInk(lab.code);

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  /* 顶部色带 */
  ctx.fillStyle = labTint(lab.code);
  ctx.fillRect(0, 0, W, H * 0.2);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.9;
  ctx.font = `600 ${H * 0.026}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${lab.code} 实训室 · 指导教师`, W * 0.09, H * 0.075);
  ctx.globalAlpha = 1;

  /* 头像 */
  drawPixelAvatar(ctx, mentor.name, W * 0.09, H * 0.12, W * 0.24);

  /* 姓名与职称 */
  ctx.fillStyle = C.ink;
  ctx.font = `700 ${H * 0.062}px ${FONT}`;
  ctx.fillText(mentor.name, W * 0.09, H * 0.35);
  ctx.fillStyle = ink;
  ctx.font = `500 ${H * 0.032}px ${FONT}`;
  ctx.fillText(mentor.title || '', W * 0.09, H * 0.395);

  ctx.fillStyle = C.line;
  ctx.fillRect(W * 0.09, H * 0.43, W * 0.82, Math.max(1, H * 0.002));

  /* 标签 */
  let tx = W * 0.09, ty = H * 0.47;
  ctx.font = `500 ${H * 0.026}px ${FONT}`;
  for (const tag of String(mentor.tags || '').split(/[\/,、]/).map(s => s.trim()).filter(Boolean).slice(0, 4)) {
    const tw = ctx.measureText(tag).width + H * 0.03;
    if (tx + tw > W * 0.91) { tx = W * 0.09; ty += H * 0.05; }
    ctx.fillStyle = labTint(lab.code);
    roundRect(ctx, tx, ty - H * 0.026, tw, H * 0.042, H * 0.021);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.fillText(tag, tx + H * 0.015, ty);
    tx += tw + H * 0.014;
  }

  /* 简介 */
  ctx.fillStyle = C.text;
  ctx.font = `500 ${H * 0.029}px ${FONT}`;
  const intro = mentor.intro || '这位老师还没有填写个人简介。';
  const lines = wrap(ctx, intro, W * 0.82);
  const maxLines = 9;
  lines.slice(0, maxLines).forEach((ln, i) => {
    ctx.fillText(ln, W * 0.09, H * 0.60 + i * H * 0.042);
  });

  /* 底部：招生名额用点表示，不写数字（学生在开放日不该被名额左右） */
  ctx.fillStyle = C.faint;
  ctx.font = `500 ${H * 0.024}px ${FONT}`;
  ctx.fillText('开放日 · 可当面交流', W * 0.09, H * 0.93);

  return cv;
}
