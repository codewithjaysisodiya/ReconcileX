package com.reconcilex;

import com.reconcilex.config.DBConfig;
import com.reconcilex.servlet.*;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class Server {

    private static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) throws IOException {
        int port = DEFAULT_PORT;
        String envPort = System.getenv("PORT");
        if (envPort != null) {
            try { port = Integer.parseInt(envPort); } catch (NumberFormatException ignored) {}
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // Health Route
        server.createContext("/api/health", new HealthHandler());

        // Enterprise Java Servlets mapped via ServletAdapter
        server.createContext("/api/auth/register", new ServletAdapter(new RegisterServlet()));
        server.createContext("/api/auth/login", new ServletAdapter(new LoginServlet()));
        server.createContext("/api/upload/csv", new ServletAdapter(new CSVUploadServlet()));
        server.createContext("/api/upload/pdf", new ServletAdapter(new PDFUploadServlet()));
        server.createContext("/api/upload", new ServletAdapter(new UploadServlet()));
        server.createContext("/api/reconciliation", new ServletAdapter(new ReconciliationServlet()));
        server.createContext("/api/sessions", new ServletAdapter(new ReconciliationServlet()));
        server.createContext("/api/duplicates", new ServletAdapter(new DuplicateDetectionServlet()));
        server.createContext("/api/report", new ServletAdapter(new ReportServlet()));
        server.createContext("/api/analytics", new ServletAdapter(new AnalyticsServlet()));
        server.createContext("/api/audit", new ServletAdapter(new AuditServlet()));

        server.setExecutor(null); // default executor
        System.out.println("==================================================");
        System.out.println("ReconcileX Java Backend API Server running on port " + port);
        System.out.println("Database Status: " + (DBConfig.isDatabaseAvailable() ? "CONNECTED (MySQL)" : "STANDALONE / MEMORY FALLBACK"));
        System.out.println("Registered Servlets: Register, Login, Upload, CSVUpload, PDFUpload,");
        System.out.println("                    Reconciliation, DuplicateDetection, Report, Analytics, Audit");
        System.out.println("Health Check: http://localhost:" + port + "/api/health");
        System.out.println("==================================================");
        server.start();
    }

    private static void handleCors(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    }

    private static void sendJsonResponse(HttpExchange exchange, int statusCode, String json) throws IOException {
        handleCors(exchange);
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    // Health Handler
    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            handleCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            boolean dbOk = DBConfig.isDatabaseAvailable();
            String json = "{\"status\":\"UP\",\"platform\":\"ReconcileX Java Enterprise Servlets\",\"database\":\"" + (dbOk ? "CONNECTED" : "STANDALONE_FALLBACK") + "\",\"version\":\"2.4\"}";
            sendJsonResponse(exchange, 200, json);
        }
    }
}
