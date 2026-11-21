FROM node:20-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
ARG NODE_AUTH_TOKEN
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY src ./src
RUN npm run build

FROM maven:3.9.11-eclipse-temurin-21 AS backend
WORKDIR /build
COPY pom.xml ./
COPY backend ./backend
RUN mvn -B -ntp package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=frontend /app/dist/noah-portal/browser ./dist/noah-portal/browser
COPY --from=backend /build/target/noah-portal.jar ./noah-portal.jar
USER 10001:10001
CMD ["java", "-jar", "noah-portal.jar"]
