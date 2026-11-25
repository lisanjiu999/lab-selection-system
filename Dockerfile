# 学生实训室进组选拔系统 —— 单镜像部署
# 先在本机打包： mvn clean package -DskipTests
# 再构建镜像：   docker build -t lab-selection:1.0.0 .
# 运行：         docker run -d -p 8080:8080 --name lab-selection lab-selection:1.0.0

FROM eclipse-temurin:17-jre

# 阶段判断依赖本地时区，容器默认 UTC 会让「第几阶段」整体偏 8 小时
ENV TZ=Asia/Shanghai \
    JAVA_OPTS="-Xms256m -Xmx512m"

WORKDIR /app

COPY target/selection-system-1.0.0.jar app.jar

EXPOSE 8080

# exec 形式保证 java 是 1 号进程，docker stop 能把 SIGTERM 传到 JVM
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar --server.port=8080"]
