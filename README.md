# 学生实训室进组选拔系统

按《学生实训室进组选拔系统 程序设计规划书》实现的完整可运行原型：八阶段流程、三端（学生 / 导师 / 管理员）、平行意向、双向选择、分轮补录、三级优先统筹调剂、公示归档。

- 后端：Java 17 + Spring Boot 3.2.5 + Spring Data JPA + H2（内存库，启动自动灌入演示数据）
- 前端：原生 HTML / CSS / JavaScript（无构建步骤，由 Spring Boot 直接托管）
- 三维：Three.js 构建的实训室展厅与总览沙盘，移动端自动降级为平面卡片
- 设计：吉卜力纸感（奶油纸底 + 1px 细边 + 软阴影 + 大圆角 + 鼠尾草绿主色），详见 `DESIGN.md`

在线演示：<http://59.110.60.6:8080>（管理员 `admin` / `Admin@2026`）

## 运行

**最简单：双击项目根目录的 `启动.bat`**（Windows）。脚本会先检查 jar，再开浏览器并起服务；关掉窗口即停止。

> 仓库只含源码，不含编译产物。第一次运行前先执行一次 `mvn clean package -DskipTests` 生成 `target/selection-system-1.0.0.jar`（需要 JDK 17+ 与 Maven 3.8+）。

命令行方式：

```bash
cd selection-system

# 已打包过，直接跑
java -jar target/selection-system-1.0.0.jar --server.port=8080

# 或让 Maven 起（改完 Java 代码不用手动打包）
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8080

# 或先打包再跑（改完前端/后端都建议这一步）
mvn clean package -DskipTests
java -jar target/selection-system-1.0.0.jar --server.port=8080
```

Git Bash / macOS / Linux 用 `./start.sh`。

打开 <http://localhost:8080>。

> 若环境变量里存在 `SERVER__PORT`，Spring Boot 会优先采用它，导致端口不是 8080；用 `--server.port=8080` 显式覆盖即可。

### 只想改前端样式时

静态资源打在 jar 里，改完 css/js 必须重新 `mvn package` 才会生效；调试期可以让服务直接读源码目录：

```bash
java -jar target/selection-system-1.0.0.jar --server.port=8080 \
  --spring.web.resources.static-locations=file:./src/main/resources/static/
```

改完刷新即可（静态资源已设 `Cache-Control: no-store`）。`index.html` 里 `app.css?v=...` 的版本串在正式发布时记得往上推一位。

## 部署

产物只有一个可执行 jar，不依赖外网（字体、院徽、three.js 全在 jar 里），也没有数据库要装。三种跑法按场景挑一种：

**① 本机演示**：双击 `启动.bat`，或 `./start.sh`。

**② 独立服务器**（Linux，有 JDK 17 即可）

```bash
# 本机打包，把 jar 传上去
mvn clean package -DskipTests
scp target/selection-system-1.0.0.jar user@host:/opt/lab-selection/app.jar

# 服务器上常驻（-Duser.timezone 必须显式给，否则阶段时间窗会按 UTC 算）
cd /opt/lab-selection
nohup java -Duser.timezone=Asia/Shanghai -Xmx512m -jar app.jar --server.port=8080 > app.log 2>&1 &
```

用 systemd 托管则写一个 unit，`ExecStart=/usr/bin/java -Duser.timezone=Asia/Shanghai -Xmx512m -jar /opt/lab-selection/app.jar`，`Restart=always`。前面挂 Nginx 反代时注意 `proxy_set_header X-Forwarded-Proto $scheme;`，并把 `client_max_body_size` 调到 2m 以上——应用自身已开 gzip，Nginx 侧不必再压一次。

**③ Docker**

```bash
mvn clean package -DskipTests
docker build -t lab-selection:1.0.0 .
docker run -d -p 8080:8080 --name lab-selection lab-selection:1.0.0
```

镜像里已固定 `TZ=Asia/Shanghai`；要调内存用 `-e JAVA_OPTS="-Xmx1g"`。

**上线前注意**

- 数据库是 H2 内存库，**进程一重启，数据回到初始演示状态**。这是演示原型的设定（每轮都能从干净的 28 人重跑）；若需要留痕，把 `application.yml` 的 `url` 换成 `jdbc:h2:file:/opt/lab-selection/data/lab`、`ddl-auto` 改 `update`，并让 `DataSeeder` 在已有数据时跳过。
- 演示时钟在「阶段控制」里可拨，正式上线应把 `StageService.now()` 换成 `LocalDateTime.now()`，否则谁都能改系统认定的日期。
- 管理员初始口令 `Admin@2026` 请上线即改（右上角修改密码）。

## 账号与密码

一人一号，必须输入账号与密码登录。预置数据：7 间实训室、17 位导师、28 名学生、50 条平行意向、50 份面试评分与决策。

> 有三个学生账号故意**没有预置意向**：`20221001`（陈嘉禾）、`20221183`（顾南舟）、`20221190`（温以宁）。意向只能提交一次，留空才能反复走一遍填报流程。其余 25 名学生都已有意向，导师端与管理端的统计才不至于空着。

| 身份 | 账号 | 初始密码 |
| --- | --- | --- |
| 学生 | 学号，如 `20221001` | `Lab@` + 学号后四位，如 `Lab@1001` |
| 导师 | 工号 `T2001`—`T2017` | `Lab@` + 工号后四位，如 `Lab@2001` |
| 管理员 | `admin` | `Admin@2026` |

登录页右下角的「演示账号」可以展开查看这三组示例，其余账号按上面的规则推导。

口令以 PBKDF2-HMAC-SHA256（每账号独立随机盐，60000 次迭代）存于 `account` 表，数据库里没有明文。登录失败 5 次锁定 5 分钟；会话 8 小时过期。登录后可在右上角「修改密码」，改密成功会强制重新登录（旧 token 立即失效），新密码至少 8 位且需含字母和数字。

## 演示路径（建议按顺序）

1. **学生端**：登录进来第一屏就是**总览的 3D 方块网格**——七间实训室平铺在台面上，点任意一块进那间室的展厅（三块悬挂大屏 + 两侧导师展板，可拖动转视角、WASD 漫游、点屏聚焦翻页）。右上角三个胶囊是进度（意向 / 拟录取 / 去向），台面之外的功能从顶部页签进：实训室 → **导师环**（17 位导师排成一圈，滚轮/拖动转动，正面那张即当前选中，可直接「加入意向」或「看介绍」）→ 意向填报（3 个平行位 + 两个调剂开关，**只能提交一次**；同页可**拖拽上传简历**，PDF / Word，5MB 以内）。学生端不显示导师剩余名额——名额由录取阶段统一核算，填报时不该左右判断。
2. **3D 开放日展厅**：从总览点方块进去；开放日阶段实训室页顶部还有一张横幅，走的是同一个全屏展厅。第一屏是七个实验室方块，点任意一块转场进入该室展厅。
3. **导师端**：概览 → 我的介绍（编辑并提交审核）→ 报名学生（注意：看不到志愿顺序；有简历的学生这一列可点开下载）→ 面试评分（姓名下同样挂着简历链接）→ 录取决策（拟录取受名额限制，决策时可直接下载简历）。
4. **管理员端**：录取看板 → 阶段控制 → 点「推进到下一阶段」，观察自动结算。
5. 推进到「拟录取与学生确认」：46 条意向生成、11 人单意向自动确认；换一个有 2 个拟录取的学生看「我的结果」，可择一确认。
6. 继续推进：确认阶段结束后逾期名额释放并按递补顺序补位 → 统筹调剂（三级优先试算 → 确认落库）→ 公示发布，录取结果转正式。

「演示时钟」是可控的：所有阶段判断都基于它。**管理员 → 阶段控制** 可以直接拨日期时间（含前一天/后一天/本阶段开始/下一阶段四个快捷键），八个阶段的时间窗也能在表格里逐行改，改完即存、立即生效。真实部署把 `StageService.now()` 换成 `LocalDateTime.now()` 即可。

## 目录

```
selection-system/
├─ 启动.bat / start.bat   一键启动（检查 jar → 开浏览器 → 起服务）
├─ start.sh              Git Bash / macOS / Linux 用
├─ Dockerfile            单镜像部署（只 COPY jar）
├─ src/main/java/edu/lab/select/
│  ├─ model/          实体：账号、实训室、导师、学生、意向、拟录取、录取、决策、评分、阶段、调剂、公示、简历
│  ├─ service/        SelectionService（业务与算法）、StageService（阶段时间窗）、
│  │                  AccountService（登录/改密/锁定）、PasswordService（PBKDF2）、TokenStore（会话）
│  ├─ web/            Auth / Catalog / Student / Mentor / Admin 五个控制器 + 统一错误处理
│  └─ config/         DataSeeder（演示数据）
├─ src/main/resources/
│  ├─ application.yml
│  ├─ static/
│  │  ├─ index.html       主应用（登录 + 三角色 SPA）
│  │  ├─ openday.html     3D 开放日展厅（独立页面，独立 importmap）
│  │  ├─ assets/
│  │  │  ├─ app.css, core.js, views.*.js, main.js, ring.js
│  │  │  ├─ fx.js              启动屏、转场幕布、路由进度条、骨架屏、数字滚动、内容浮现（纯 DOM）
│  │  │  ├─ clouds.js          背景云层（WebGL2 全屏三角形 + fbm 密度场，30fps）
│  │  │  ├─ openday.js         3D 场景、相机、灯光、交互
│  │  │  ├─ openday-grid.js    方块网格场景（总览页和展厅页共用）
│  │  │  ├─ openday-content.js 所有画面内容（方块铭牌、侧面水印、PPT、演示动画、文档、展板）
│  │  │  ├─ openday.css        覆盖在画布上的 HUD
│  │  │  ├─ fonts3/            Quicksand 可变字体（2 个 woff2，无外网依赖）
│  │  │  ├─ brand/ss-mark.png  院徽原图（登录页 WebGL 物体的素材）
│  │  │  ├─ brand/lab-mark.png 3D 网格页背景那枚橙色标志（从截图抠图，透明底）
│  │  │  └─ liquid-object.js   登录页院徽的 three.js 打包产物（懒加载）
│  │  └─ vendor/three/    three.js r187 本地副本（three.module.js + three.core.js + OrbitControls）
└─ DESIGN.md          视觉系统说明
```

### 3D 展厅说明

`openday.html` 是独立页面，不进 SPA——它要独占整块视口、用 ES module + importmap 加载 three.js，混在主应用里会和现有 CSS 打架。**同一个网格场景也被学生端「总览」直接嵌进内容区**（`openday-grid.js` 两个宿主共用，各自持有渲染器和主循环）；从总览点方块会带 `?lab=<id>` 跳到全屏展厅，返回直接回总览。

- **离线可用**：`vendor/three/` 是 r187 的本地副本，不走 CDN。部署到内网也能开。
- **画面全部现画**：方块铭牌、侧面代码水印、PPT 六页、演示动画、材料文档、导师展板，全部由 `openday-content.js` 用 canvas 2D 生成成纹理。没有图片、没有视频文件——H2 是内存库，素材若落盘会留下对不上号的孤儿文件；而且演示环境不一定有网。唯一的位图是背景那枚橙色标志（`brand/lab-mark.png`），从截图抠成透明底。
- **代码风格**：方块不是七个复制品——高度分五档、朝向各偏 ±1.8°，每块正面左侧有一条室色的行号栏（槽底挂等宽序号 01–07），顶面铭牌右上角一对花括号、底部一行等宽代码，侧面压着极淡的代码水印，角落立着七种不同的几何标识物（球环 / 柱状 / 芯片 / 点云 / 节点连线 / 堆栈 / 轨道）。背景再飘 74 个代码符号，分远中近三层景深（`async` `return` `a.b()` `x+=1` `0x1F` 这类长词也在里面），正对取景框的那块会主动让开，不压方块名字。
- **七间展厅七个样**：户型、机位、三块屏、两侧展板七间完全一致，差别全在墙面 / 顶面 / 地面 / 雾 / 灯色 + 一件标志性陈设上，色相一律从该室的 `LAB_INK` 派生——系统列表里那个小色块是什么颜色，推门进去就是什么颜色。202 天花一圈传感环、204 两座机架加三根垂下的光纤、206 整面后墙 PCB 走线加地上芯片、402 屏顶悬一颗点云球、404 五节点拓扑、406 三层堆叠加数据柱、505 一副双环陀螺仪加地面警示圈。演示屏的底色也跟着房间走，七块屏的暗部各不相同。
- **演示动画是画的，不是播的**：七种动画对应七个方向（扫描点云 / 数据流 / 机器人轨迹 / 三维重建 / 网络拓扑 / 代码流 / 交互波纹），用 canvas 每帧重绘，30fps 节流，带时间码和进度条。真视频要编码、要文件、要带宽，这里用现画换可靠。
- **漫游**：OrbitControls（拖动转视角、滚轮远近、右键/双指平移）+ WASD 平移，相机与观察点同移，贴墙时自动 clamp 不穿模。点大屏 → 相机补间飞到屏前 2.7 米；再点屏左右区域或按 ← → 翻页；Esc 退回原机位。
- **动效**：方块从台面以下依次升起（错开 62ms，收尾过冲一点才有重量）、悬停时脚下亮起一圈橙色定位环、点击时先荡开涟漪再推镜；展厅里飘 320 颗尘埃、三块屏的溢光各自呼吸。所有动效在 `prefers-reduced-motion` 下降级为静态。
- **展板位置是试出来的**：一开始贴侧墙，站中段看屏时两块侧墙全在视野外，进门只看得到三块屏。挪到屏墙前方两侧、朝内偏 28° 之后既进了画面又不挡屏。


## 与规划书对应的关键实现

| 规划书要点 | 代码位置 |
| --- | --- |
| 阶段时间窗、服务端裁决 | `StageService`、`SelectionService.submitIntentions` 等入口的阶段校验 |
| 平行意向不落志愿序号 | `Intention` 实体无 seq 字段；`mentorApplicants` DTO 不含该字段 |
| 单意向自动确认 / 逾期释放 | `SelectionService.autoConfirmSingles` / `expireUnconfirmed` |
| 递补按顺序补位 | `SelectionService.fillWaitlist` |
| 三级优先统筹调剂 | `SelectionService.adjustPreview` / `adjustCommit` |
| 名额不超录 | `saveDecision` 校验 + `Enrollment` 学生唯一约束 |
| 阶段推进自动结算 | `SelectionService.advanceStage` |
| 账号口令与登录锁定 | `AccountService.authenticate`、`PasswordService` |
| 简历上传与导师查看 | `SelectionService.saveResume` / `mentorResume`（校验该学生确实报过这位导师），`Resume` 实体 |

## 已知简化（课程作业范围）

- 账号由 `DataSeeder` 生成，密码为演示用初始口令；真实部署应由管理员导入或对接统一身份认证（SSO），并强制首次登录改密（`Account.mustChange` 已预留）。
- 会话为服务端内存 token（重启失效、多实例需换 Redis）；生产建议改用 JWT 或集中式会话。
- 数据库为 H2 内存库，重启即重置；生产可换 MySQL，`ddl-auto` 改为 `update`。
- 面试场次编排、通知推送、Excel 导入导出在规划书中列为模块，本原型未展开实现。
- **补录是一轮递补，不是多轮重填**：确认阶段结束后，空出的名额按导师的递补顺序一次性补位，学生不参与操作（意向只能提交一次）。规划书里的「多轮重新填报」需要放开第二次提交，与本项目的单次提交约束冲突，故未实现。
- 调剂落库有阶段闸：只有处在「统筹调剂录取」阶段才能执行，其余阶段该页只做试算。
- 简历文件直接存库（`Resume.data` 是 BLOB），随 H2 内存库一起重启即失。换 MySQL 时建议改存对象存储，库里只留 key；单份上限 5MB，由 `spring.servlet.multipart` 和 `SelectionService.RESUME_MAX` 双重把关。
- 阶段回退、审计日志表结构已预留（`AdjustRecord` 等留痕），界面未开放。
