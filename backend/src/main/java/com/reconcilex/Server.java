package com.reconcilex;

import com.reconcilex.config.DBConfig;
import com.reconcilex.dao.ReconciliationDAO;
import com.reconcilex.dao.UserDAO;
import com.reconcilex.model.ReconciliationSession;
import com.reconcilex.model.User;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Server {

    private static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) throws IOException {
        int port = DEFAULT_PORT;
        String envPort = System.getenv("PORT");
        if (envPort != null) {
            try { port = Integer.parseInt(envPort); } catch (NumberFormatException ignored) {}
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/api/health", new HealthHandler());
        server.createContext("/api/auth/register", new RegisterHandler());
        server.createContext("/api/auth/login", new LoginHandler());
        server.createContext("/api/sessions", new SessionsHandler());

        server.setExecutor(null); // default executor
        System.out.println("==================================================");
        System.out.println("ReconcileX Java Backend API Server running on port " + port);
        System.out.println("Database Status: " + (DBConfig.isDatabaseAvailable() ? "CONNECTED (MySQL)" : "STANDALONE / MEMORY FALLBACK"));
        System.out.println("Health Check: http://localhost:" + port + "/api/health");
        System.out.println("==================================================");
        server.start();
    }

    private static void handleCors(HttpExchange exchange) throws IOException {
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

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[1024];
            int n;
            while ((n = is.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
            return baos.toString(StandardCharsets.UTF_8);
        }
    }

    private static String extractJsonString(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return "";
    }

    private static double extractJsonDouble(String json, String key, double defaultVal) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*([0-9.]+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            try { return Double.parseDouble(matcher.group(1)); } catch (Exception ignored) {}
        }
        return defaultVal;
    }

    private static int extractJsonInt(String json, String key, int defaultVal) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*([0-9]+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            try { return Integer.parseInt(matcher.group(1)); } catch (Exception ignored) {}
        }
        return defaultVal;
    }

    // Handlers
    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            handleCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            boolean dbOk = DBConfig.isDatabaseAvailable();
            String json = "{\"status\":\"UP\",\"platform\":\"ReconcileX Java API\",\"database\":\"" + (dbOk ? "CONNECTED" : "OFFLINE_FALLBACK") + "\",\"version\":\"2.4\"}";
            sendJsonResponse(exchange, 200, json);
        }
    }

    static class RegisterHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            handleCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                String username = extractJsonString(body, "username");
                String email = extractJsonString(body, "email");
                String password = extractJsonString(body, "password");
                String fullName = extractJsonString(body, "fullName");
                String role = extractJsonString(body, "role");

                if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
                    sendJsonResponse(exchange, 400, "{\"error\":\"Username, email, and password are required.\"}");
                    return;
                }

                User user = UserDAO.register(username, email, password, fullName.isEmpty() ? username : fullName, role);
                sendJsonResponse(exchange, 201, "{\"success\":true,\"user\":" + user.toJson() + ",\"token\":\"rx_jwt_" + System.currentTimeMillis() + "\"}");
            } catch (Exception e) {
                sendJsonResponse(exchange, 400, "{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
            }
        }
    }

    static class LoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            handleCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                String username = extractJsonString(body, "username");
                String password = extractJsonString(body, "password");

                User user = UserDAO.login(username, password);
                if (user == null) {
                    sendJsonResponse(exchange, 401, "{\"error\":\"Invalid credentials. Please verify username and password.\"}");
                    return;
                }

                sendJsonResponse(exchange, 200, "{\"success\":true,\"user\":" + user.toJson() + ",\"token\":\"rx_jwt_" + System.currentTimeMillis() + "\"}");
            } catch (Exception e) {
                sendJsonResponse(exchange, 500, "{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
            }
        }
    }

    static class SessionsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            handleCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    List<ReconciliationSession> list = ReconciliationDAO.getRecentSessions(20);
                    StringBuilder sb = new StringBuilder("[");
                    for (int i = 0; i < list.size(); i++) {
                        sb.append(list.get(i).toJson());
                        if (i < list.size() - 1) sb.append(",");
                    }
                    sb.append("]");
                    sendJsonResponse(exchange, 200, "{\"success\":true,\"sessions\":" + sb.toString() + "}");
                } catch (Exception e) {
                    sendJsonResponse(exchange, 500, "{\"error\":\"" + e.getMessage() + "\"}");
                }
            } else if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = readRequestBody(exchange);
                    ReconciliationSession s = new ReconciliationSession();
                    s.setSessionCode(extractJsonString(body, "sessionCode"));
                    s.setBankFileName(extractJsonString(body, "bankFileName"));
                    s.setCompanyFileName(extractJsonString(body, "companyFileName"));
                    s.setTotalProcessed(extractJsonInt(body, "totalProcessed", 0));
                    s.setMatchedCount(extractJsonInt(body, "matchedCount", 0));
                    s.setUnmatchedCount(extractJsonInt(body, "unmatchedCount", 0));
                    s.setMismatchCount(extractJsonInt(body, "mismatchCount", 0));
                    s.setDuplicateCount(extractJsonInt(body, "duplicateCount", 0));
                    s.setMatchPercentage(extractJsonDouble(body, "matchPercentage", 0.0));
                    s.setTotalDiscrepancy(extractJsonDouble(body, "totalDiscrepancy", 0.0));
                    s.setNetVariance(extractJsonDouble(body, "netVariance", 0.0));

                    int savedId = ReconciliationDAO.saveSession(s);
                    sendJsonResponse(exchange, 201, "{\"success\":true,\"sessionId\":" + savedId + "}");
                } catch (Exception e) {
                    sendJsonResponse(exchange, 500, "{\"error\":\"" + e.getMessage() + "\"}");
                }
            } else {
                sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
            }
        }
    }
}
