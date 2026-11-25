# 本地运行说明（RUN）

本文档说明如何在本地把「学生实训室进组选拔系统」跑起来。按顺序做完即可，不需要预先安装数据库或 Node.js。

---

## 一、环境要求

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 操作系统 | Windows 10/11、macOS、Linux 均可 | 已在 Windows 11 与 Ubuntu 22.04 上验证 |
| JDK | **17 或更高**（21 亦可） | 运行与编译都只需 JDK，不需要单独装 JRE |
| Maven | 3.8+（可选） | 仅在需要自行编译时使用；包内 `target/` 已附编译好的 jar，可直接运行 |
| 内存 | 建议 2 GB 以上可用 | 应用本身占用约 350–500 MB |
| 端口 | 8080 可用 | 若被占用，可用参数改端口，见第五节 |

检查 JDK 版本：

```bash
java -version
```

输出应包含 `17`、`21` 或更高版本号。若提示「不是内部或外部命令」，说明 JDK 未安装或未加入 PATH，先装 JDK 17 再继续。

---

## 二、启动方式

三种方式任选其一，效果完全相同。包内 `target/selection-system-1.0.0.jar` 是已编译好的可执行包，**方式一、方式二开箱即用**；只有方式三（从源码运行）和自行改代码后才需要 Maven。

### 方式一：双击脚本（Windows，最省事）

在项目根目录双击 **`启动.bat`**。脚本会找到 `target/` 下的 jar，启动服务并自动打开浏览器；关闭命令行窗口即停止服务。

> 若提示「找不到 selection-system-1.0.0.jar」，说明 jar 被解压工具漏掉或被杀毒软件隔离。确认 `target\` 目录存在且内有约 48 MB 的 jar 文件；缺失时执行一次 `mvn clean package -DskipTests` 重新生成。

### 方式二：直接运行已编译的 jar

`target/selection-system-1.0.0.jar` 是完整的可执行包，前端资源已内置：

```bash
cd selection-system
java -jar target/selection-system-1.0.0.jar
```

看到下面这行即启动成功：

```
Started SelectionApplication in 6.2 seconds
```

浏览器访问 **http://localhost:8080**。

### 方式三：用 Maven 从源码启动

适合需要改代码的场景，改完 Java 代码重启即可生效：

```bash
cd selection-system
mvn spring-boot:run
```

> `mvn spring-boot:run` 每次启动都会重新编译，改完代码直接重启即可，不必手动打包。依赖已下载到本地仓库后，断网也能继续编译与运行。

---

## 三、首次启动发生了什么

1. 应用创建 **H2 内存数据库**（`jdbc:h2:mem:lab`），按实体自动建表；
2. `DataSeeder` 检测到库为空，自动灌入演示数据：**7 间实训室、17 位导师、28 名学生、25 份已提交意向、50 人次报名**；
3. 流程停在第一个阶段「意向填报」之前的初始状态，等待管理员推进。

**数据不落盘**：进程一停，数据库随之清空，下次启动重新灌一份干净的演示数据。这是有意设计——演示时钟也存在内存中，如果录取数据保留而时钟退回开头，会出现「还在填报阶段、学生却已有去向」的状态错位。

---

## 四、登录账号

| 角色 | 账号 | 密码 | 说明 |
| --- | --- | --- | --- |
| 学生 | `20221001` | `Lab@1001` | 意向留空，可完整演示填报 |
| 导师 | `T2008` | `Lab@2008` | 505 苏禾，名额 3、报名 4，满溢场景最直观 |
| 管理员 | `admin` | `Admin@2026` | 全部管理功能 |

登录页底部有「演示环境 · 一键进入」，点一下即可填入对应账号，不必手打。

完整账号清单（28 名学生 + 17 位导师，含姓名、班级、所属实训室）见根目录 **`账号密码表.md`**。

规则：学生用学号登录，密码是 `Lab@` + 学号后四位；导师用工号登录，密码是 `Lab@` + 工号后四位。

---

## 五、常用参数

改端口：

```bash
java -jar target/selection-system-1.0.0.jar --server.port=9000
```

让数据落盘（重启不丢）：

```bash
java -jar target/selection-system-1.0.0.jar \
  --spring.datasource.url="jdbc:h2:file:./data/lab" \
  --spring.jpa.hibernate.ddl-auto=update
```

> 切到文件模式后，`DataSeeder` 只在检测不到实验室数据时才灌种子数据，第二次启动不会重复插入。

需要从备份恢复初始数据时，先按第六节导入，再以 `--spring.jpa.hibernate.ddl-auto=none` 启动。

---

## 六、数据库文件

`db/lab-selection.sql` 是完整的数据库备份，由 H2 的 `SCRIPT` 命令导出，包含：

- **13 张表的建表语句**（ACCOUNT、STUDENT、MENTOR、LAB_ROOM、INTENTION、INTERVIEW_SCORE、MENTOR_DECISION、OFFER、ENROLLMENT、ADJUST_RECORD、RESUME、ANNOUNCEMENT、STAGE_CONFIG）
- **全部初始数据**：46 个账号（28 学生 + 17 导师 + 1 管理员，密码均为加盐 SHA-256 摘要）、7 间实训室、17 位导师档案、28 名学生、25 份意向及对应的面试评分与导师决策

### 恢复方式

备份脚本只导入一次。H2 的 `INSERT` 带显式主键，重复执行会撞主键，所以**不能**把它挂在每次启动的 `INIT=` 上。

**方式 A：命令行导入（推荐，已实测）**

第 1 步 · 先确保应用已停止（文件库被占用时无法再连）：

```bash
# 停掉正在运行的实例，例如
systemctl stop lab-selection
# 或找到进程后 kill
```

第 2 步 · 导入：

```bash
java -cp h2-2.2.224.jar org.h2.tools.RunScript \
  -url "jdbc:h2:file:./data/lab" -user sa -password "" \
  -script db/lab-selection.sql
```

`h2-2.2.224.jar` 可从 Maven 仓库获取，或直接从本项目 jar 里取出：

```bash
unzip -j target/selection-system-1.0.0.jar "BOOT-INF/lib/h2-*.jar" -d .
```

第 3 步 · 以「不再自动建表」的方式启动：

```bash
java -jar target/selection-system-1.0.0.jar \
  --spring.datasource.url="jdbc:h2:file:./data/lab" \
  --spring.jpa.hibernate.ddl-auto=none
```

`ddl-auto=none` 表示不再由 JPA 建表，完全以 SQL 文件里的结构为准。

导入后核对数据（应返回 28 / 17 / 7 / 46 / 50）：

```bash
java -cp h2-2.2.224.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/lab" -user sa -password "" \
  -sql "SELECT (SELECT COUNT(*) FROM STUDENT) s, (SELECT COUNT(*) FROM MENTOR) m, (SELECT COUNT(*) FROM LAB_ROOM) l, (SELECT COUNT(*) FROM ACCOUNT) a, (SELECT COUNT(*) FROM INTENTION) i;"
```

**方式 B：H2 控制台导入**

应用默认开启了 H2 控制台：http://localhost:8080/h2-console

- JDBC URL：`jdbc:h2:mem:lab`
- 用户名：`sa`
- 密码：留空

登录后把 `db/lab-selection.sql` 的内容粘进输入框执行即可。适合只是想在内存库里看一眼表结构、不想改配置文件的情况。

> 内存模式下每次重启都是新库，所以控制台导入的效果同样只在本次进程内有效。

---

## 七、修改前端代码

前端没有构建步骤，也没有 `node_modules`：`src/main/resources/static/` 下就是最终产物，浏览器直接加载 ES Module。

但**打包后的 jar 会把静态资源封进去**，所以改完样式看不到变化是正常现象。开发时用下面这组参数，让 Spring Boot 直接读磁盘上的文件：

```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--spring.web.resources.static-locations=file:src/main/resources/static/ --spring.web.resources.cache.period=0"
```

这样改完 CSS / JS 刷新浏览器即可，不必重启。

> 如果仍然看到旧样式，先确认 8080 端口上跑的是这个开发实例，而不是之前遗留的 `java -jar` 进程——两个实例抢同一个端口时，后启动的会直接退出，你以为改了没生效，其实是另一个进程在响应。

---

## 八、常见问题

**端口被占用（Port 8080 was already in use）**

```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <上面查到的PID> /F

# macOS / Linux
lsof -i :8080
kill -9 <PID>
```

或直接用 `--server.port=9000` 换端口。

**启动报 `UnsupportedClassVersionError`**

JDK 版本低于 17。装 JDK 17 或 21，并确认 `java -version` 输出的是新版本（PATH 里可能有多个 JDK）。

**页面打开是白屏**

按 F12 看控制台。常见原因是浏览器缓存了旧的 JS，强制刷新（Ctrl+F5）即可；本项目已在配置里对静态资源关闭缓存，正常不会出现。

**三维场景加载慢或空白**

首页与开放日展厅用到 Three.js（约 2 MB，分两个模块加载）。首次访问、尤其是手机流量下需要几秒，期间页面显示「正在准备三维场景…」。若设备不支持 WebGL，总览页会自动降级为七间实训室的平面卡片列表，功能不受影响。

**忘记密码**

所有账号的密码规则固定：`Lab@` + 账号后四位（学生学号后四位 / 导师工号后四位）。管理员是 `admin` / `Admin@2026`。

**想从头再来一遍**

重启进程即可，内存库会重新灌入干净的种子数据。
