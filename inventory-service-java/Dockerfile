# ==============================
# BUILD STAGE
# ==============================
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# ==============================
# RUNTIME STAGE
# ==============================
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 5005

ENTRYPOINT ["java", "-jar", "app.jar"]