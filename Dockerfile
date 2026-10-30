# ===================================================================
# ReconcileX - Multi-Stage Production Dockerfile
# ===================================================================

FROM eclipse-temurin:17-jdk-alpine AS backend-build
WORKDIR /app
COPY backend/src /app/src
RUN mkdir -p /app/bin && \
    javac -d /app/bin $(find /app/src -name "*.java")

# Production Runner Image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy compiled backend classes
COPY --from=backend-build /app/bin /app/backend/bin

# Copy frontend static files
COPY index.html /app/
COPY css/ /app/css/
COPY js/ /app/js/
COPY assets/ /app/assets/
COPY sample-data/ /app/sample-data/
COPY database/ /app/database/

ENV PORT=8080
ENV DB_URL="jdbc:mysql://mysql:3306/reconcilex_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
ENV DB_USER="root"
ENV DB_PASSWORD="password"

EXPOSE 8080

CMD ["java", "-cp", "/app/backend/bin", "com.reconcilex.Server"]
