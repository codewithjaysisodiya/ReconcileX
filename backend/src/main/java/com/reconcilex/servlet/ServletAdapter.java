package com.reconcilex.servlet;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;

/**
 * ServletAdapter
 * Bridges Java EE Servlets to JDK HttpServer handlers.
 * Allows ReconcileX Servlets to run in standalone zero-dependency mode
 * or inside traditional servlet containers (Tomcat, Jetty).
 */
public class ServletAdapter implements HttpHandler {

    private final HttpServlet servlet;

    public ServletAdapter(HttpServlet servlet) {
        this.servlet = servlet;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        HttpServletRequest req = new HttpServletRequest(
            exchange.getRequestMethod(),
            exchange.getRequestURI().toString(),
            exchange.getRequestHeaders(),
            exchange.getRequestBody()
        );
        HttpServletResponse resp = new HttpServletResponse();

        try {
            servlet.service(req, resp);
        } catch (Exception e) {
            resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
        }

        // Forward response headers
        for (Map.Entry<String, String> entry : resp.getHeaders().entrySet()) {
            exchange.getResponseHeaders().set(entry.getKey(), entry.getValue());
        }

        byte[] bytes = resp.toByteArray();
        exchange.sendResponseHeaders(resp.getStatus(), bytes.length > 0 ? bytes.length : -1);
        if (bytes.length > 0) {
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        } else {
            exchange.getResponseBody().close();
        }
    }
}
