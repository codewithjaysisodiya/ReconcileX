package com.reconcilex.servlet;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Standard HttpServletResponse abstraction supporting status codes,
 * response headers, buffered output stream, and text print writer.
 */
public class HttpServletResponse {

    public static final int SC_OK = 200;
    public static final int SC_CREATED = 201;
    public static final int SC_NO_CONTENT = 204;
    public static final int SC_BAD_REQUEST = 400;
    public static final int SC_UNAUTHORIZED = 401;
    public static final int SC_FORBIDDEN = 403;
    public static final int SC_NOT_FOUND = 404;
    public static final int SC_METHOD_NOT_ALLOWED = 405;
    public static final int SC_INTERNAL_SERVER_ERROR = 500;

    private int status = SC_OK;
    private final Map<String, String> headers = new HashMap<>();
    private final ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
    private PrintWriter printWriter;

    public HttpServletResponse() {
        // Default CORS and Content-Type headers for REST APIs
        setHeader("Access-Control-Allow-Origin", "*");
        setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
        setContentType("application/json; charset=UTF-8");
    }

    public void setStatus(int sc) {
        this.status = sc;
    }

    public int getStatus() {
        return status;
    }

    public void setContentType(String type) {
        setHeader("Content-Type", type);
    }

    public String getContentType() {
        return headers.get("Content-Type");
    }

    public void setHeader(String name, String value) {
        headers.put(name, value);
    }

    public String getHeader(String name) {
        return headers.get(name);
    }

    public Map<String, String> getHeaders() {
        return headers;
    }

    public OutputStream getOutputStream() {
        return outputStream;
    }

    public PrintWriter getWriter() {
        if (printWriter == null) {
            printWriter = new PrintWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8), true);
        }
        return printWriter;
    }

    public void sendError(int sc, String message) throws IOException {
        setStatus(sc);
        getWriter().print("{\"error\":\"" + (message != null ? message.replace("\"", "'") : "Error") + "\"}");
        getWriter().flush();
    }

    public void sendRedirect(String location) {
        setStatus(302);
        setHeader("Location", location);
    }

    public byte[] toByteArray() {
        if (printWriter != null) {
            printWriter.flush();
        }
        return outputStream.toByteArray();
    }
}
