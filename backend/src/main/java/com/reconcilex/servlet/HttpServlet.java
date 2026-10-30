package com.reconcilex.servlet;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Base HttpServlet class providing HTTP lifecycle dispatching (doGet, doPost, doPut,
 * doDelete, doOptions), JSON serialization helpers, and request/response coordination.
 */
public abstract class HttpServlet {

    public void service(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String method = req.getMethod();

        if ("OPTIONS".equalsIgnoreCase(method)) {
            doOptions(req, resp);
        } else if ("GET".equalsIgnoreCase(method)) {
            doGet(req, resp);
        } else if ("POST".equalsIgnoreCase(method)) {
            doPost(req, resp);
        } else if ("PUT".equalsIgnoreCase(method)) {
            doPut(req, resp);
        } else if ("DELETE".equalsIgnoreCase(method)) {
            doDelete(req, resp);
        } else {
            resp.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "HTTP method " + method + " not supported.");
        }
    }

    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "HTTP GET not supported on this endpoint.");
    }

    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "HTTP POST not supported on this endpoint.");
    }

    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "HTTP PUT not supported on this endpoint.");
    }

    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "HTTP DELETE not supported on this endpoint.");
    }

    protected void doOptions(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }

    // Utility JSON Extraction Helpers
    protected String extractJsonString(String json, String key) {
        if (json == null || key == null) return "";
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\\"|[^\"])*)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            String val = matcher.group(1);
            return val.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t").replace("\\\"", "\"").replace("\\\\", "\\");
        }
        return "";
    }

    protected double extractJsonDouble(String json, String key, double defaultVal) {
        if (json == null || key == null) return defaultVal;
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?[0-9.]+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            try {
                return Double.parseDouble(matcher.group(1));
            } catch (Exception ignored) {}
        }
        return defaultVal;
    }

    protected int extractJsonInt(String json, String key, int defaultVal) {
        if (json == null || key == null) return defaultVal;
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?[0-9]+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (Exception ignored) {}
        }
        return defaultVal;
    }

    protected boolean extractJsonBoolean(String json, String key, boolean defaultVal) {
        if (json == null || key == null) return defaultVal;
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(true|false)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return Boolean.parseBoolean(matcher.group(1));
        }
        return defaultVal;
    }

    protected void sendJsonResponse(HttpServletResponse resp, int statusCode, String json) throws IOException {
        resp.setStatus(statusCode);
        resp.setContentType("application/json; charset=UTF-8");
        resp.getWriter().print(json);
        resp.getWriter().flush();
    }
}
