# 部署说明（DEPLOY）

本文档说明如何把「学生实训室进组选拔系统」部署到一台服务器上，供他人通过浏览器访问。

系统已在线运行于 **http://59.110.60.6:8080**（Ubuntu 22.04 / 2 核 4G / OpenJDK 21 / systemd 托管），本文档描述的就是这套部署方式。

---

## 一、环境要求

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 操作系统 | Linux（Ubuntu 20.04+ / CentOS 7+）或 Windows Server | 命令以 Linux 为例 |
| JDK | **17 或更高** | 服务器只需 JRE 亦可，但装 JDK 更方便排查 |
| 内存 | 1 GB 以上 | JVM 上限按 768 MB 配置，实测常驻约 380 MB |
| 磁盘 | 100 MB | jar 本体 48 MB，其余为日志与临时文件 |
| 端口 | 8080（可改） | 需在安全组 / 防火墙放行 |

**不需要安装**：数据库（H2 跑在进程内）、Node.js（前端无构建）、Nginx（可选，仅做域名或 80 端口转发时用）。

安装 JDK（Ubuntu / Debian）：

```bash
apt update && apt install -y openjdk-17-jre-headless
java -version
```

---

## 二、获取部署包

两种来源，任选其一。

**① 使用已构建好的部署包**（推荐）

`selection-system-deploy-1.0.0.tar.gz`（Linux）或 `.zip`（Windows），解压后得到：

```
selection-system/
├── app.jar            后端 + 全部前端资源，48 MB
├── application.yml    外部配置，改端口/数据模式不用重新打包
├── start.sh           Linux 启动脚本
├── start.bat          Windows 启动脚本
├── Dockerfile
└── 部署说明.md
```

**② 从源码自行构建**

```bash
cd selection-system
mvn clean package -DskipTests
ls -lh target/selection-system-1.0.0.jar     # 约 48 MB
```

构建需要 Maven 3.8+ 与 JDK 17+；服务器上没有 Maven 时，请在本机构建后把 jar 上传。

---

## 三、部署方式

### 方式一：systemd 托管（推荐，生产用）

开机自启、崩溃自动重启，日志进 journald。

**第 1 步 · 上传并解压**

```bash
mkdir -p /opt/selection-system
tar -xzf selection-system-deploy-1.0.0.tar.gz -C /tmp
cp -r /tmp/selection-system/. /opt/selection-system/
chmod +x /opt/selection-system/start.sh
```

**第 2 步 · 创建 service 文件**

写入 `/etc/systemd/system/lab-selection.service`：

```ini
[Unit]
Description=Lab Selection System (student lab recruitment)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/selection-system
Environment=PORT=8080
Environment="JAVA_OPTS=-Xms256m -Xmx768m -Duser.timezone=Asia/Shanghai -Dfile.encoding=UTF-8"
ExecStart=/opt/selection-system/start.sh
Restart=on-failure
RestartSec=5
SuccessExitStatus=143

[Install]
WantedBy=multi-user.target
```

> ⚠️ **`JAVA_OPTS` 必须用引号包住**。写成 `Environment=JAVA_OPTS=-Xms256m -Xmx768m ...`（不加引号）时，systemd 只取到第一个空格前的内容，后面的 `-Duser.timezone` 会凭空消失——表现为时区不对、阶段时间判断偏 8 小时，且日志里看不出任何报错。

**第 3 步 · 启动**

```bash
systemctl daemon-reload
systemctl enable --now lab-selection
systemctl status lab-selection --no-pager
```

状态显示 `active (running)` 即成功。

### 方式二：直接运行（临时演示）

```bash
cd /opt/selection-system
./start.sh
```

或不用脚本：

```bash
java -Xms256m -Xmx768m -Duser.timezone=Asia/Shanghai \
  -Dfile.encoding=UTF-8 -jar app.jar
```

放后台并留日志：

```bash
nohup java -jar app.jar > app.log 2>&1 &
```

> 这种方式的进程**不会开机自启**，机器重启或 SSH 会话结束时可能被带走。正式环境请用方式一。

### 方式三：Docker

```bash
cd /opt/selection-system
docker build -t lab-selection:1.0.0 .
docker run -d --name lab-selection \
  -p 8080:8080 \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  lab-selection:1.0.0
```

查看日志：`docker logs -f lab-selection`

---

## 四、外部配置

`application.yml` 与 jar 放在同一目录时会自动覆盖 jar 内的默认配置，改端口、改数据模式都不需要重新打包。

```yaml
server:
  port: 8080

spring:
  datasource:
    # 内存模式（默认）：重启清空，演示用
    url: jdbc:h2:mem:lab;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    # 文件模式：数据落盘，重启不丢
    # url: jdbc:h2:file:./data/lab
  jpa:
    hibernate:
      # 内存模式配 create-drop；文件模式改成 update
      ddl-auto: create-drop
```

### 关于数据是否持久化

**默认不持久化**，这是有意的设计：

演示时钟（`demoNow`）存在内存里，重启会回到「意向填报」阶段。如果录取数据留在库里而时钟退回开头，就会出现「还在填报阶段、学生却已有去向」的状态错位，比清空数据更难解释。

需要长期留存时，把上面两行改成文件模式（`jdbc:h2:file:./data/lab` + `ddl-auto: update`）即可。切过去之后，`DataSeeder` 只在检测不到实验室数据时灌种子数据，第二次启动不会重复插入。

从 `db/lab-selection.sql` 恢复数据见 `RUN.md` 第六节。

---

## 五、可选：Nginx 反向代理

用域名或 80 端口访问时加一层转发（注意阿里云等云厂商的安全组要单独放行 80）。

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 8m;   # 简历上传上限 5MB，留余量

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

`client_max_body_size` 必须大于 5MB，否则上传简历会被 Nginx 直接拦成 413，且后端日志里看不到任何记录。

---

## 六、部署后验证

按顺序检查，每一步都能定位到具体环节。

**① 本机是否监听**

```bash
ss -lntp | grep :8080
```

**② 本机能否访问**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```

返回 `200` 说明应用正常。

**③ 接口是否正常**

```bash
curl -s -X POST http://127.0.0.1:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026"}'
```

返回含 `token` 字段的 JSON 即接口正常。

**④ 公网能否访问**

在本地浏览器打开 `http://<服务器IP>:8080`。打不开但第 ② 步正常，说明是安全组或防火墙没放行，不是应用问题。

**⑤ 关键资源是否齐全**

```bash
for f in / /assets/app.css /assets/core.js /assets/views.student.js; do
  printf '%-28s ' $f
  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080$f
done
```

全部 `200` 才算完整。

---

## 七、日常运维

```bash
systemctl status lab-selection        # 看状态
systemctl restart lab-selection       # 重启（数据会重置为种子态）
systemctl stop lab-selection          # 停止
journalctl -u lab-selection -f        # 实时日志
journalctl -u lab-selection --since '10 min ago' --no-pager   # 最近日志
```

升级版本：

```bash
systemctl stop lab-selection
cp /opt/selection-system/app.jar /opt/backup/app.jar.$(date +%Y%m%d%H%M)
cp <新包>/app.jar /opt/selection-system/app.jar
systemctl start lab-selection
```

---

## 八、常见问题

**启动即退出，日志里没有明显报错**

先看是不是端口被占用：

```bash
ss -lntp | grep :8080
```

Spring Boot 遇到端口占用会打印 `Port 8080 was already in use` 后退出。杀掉占用进程或换端口。

**页面能打开，但样式全丢 / 接口 404**

jar 上传不完整或解压损坏。核对文件大小（约 48 MB），重新上传。

**访问不存在的静态文件返回 500**

旧版本存在这个问题（全局异常处理把 `NoResourceFoundException` 一并吞成 500）。当前版本已修正为返回 404；若仍出现，说明跑的是旧 jar。

**时间偏 8 小时**

JVM 时区没生效。检查 service 文件里 `JAVA_OPTS` 是否被引号包住（见第三节的警告），或改用 `-Duser.timezone=Asia/Shanghai` 显式指定。

**内存占用持续上涨**

H2 内存库加上简历文件（base64 存库），长时间运行会吃内存。`-Xmx768m` 对演示规模（28 学生 / 17 导师）足够；若数据量更大，相应调高并改用文件模式。

**想清空数据重新演示**

```bash
systemctl restart lab-selection
```

内存模式重启即重置。
