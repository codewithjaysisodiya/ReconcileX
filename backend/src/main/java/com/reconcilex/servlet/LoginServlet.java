package com.reconcilex.servlet;

import com.reconcilex.dao.UserDAO;
import com.reconcilex.model.User;

import java.io.IOException;

/**
 * LoginServlet
 * Handles user authentication, credential matching, and JWT session generation.
 * Mapped to /api/auth/login and /LoginServlet
 */
public class LoginServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String body = req.getBody();

        String username = extractJsonString(body, "username");
        String password = extractJsonString(body, "password");

        if (username.isEmpty()) username = req.getParameter("username") != null ? req.getParameter("username") : "";
        if (password.isEmpty()) password = req.getParameter("password") != null ? req.getParameter("password") : "";

        if (username.isEmpty() || password.isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Username and password are required.\"}");
            return;
        }

        try {
            User user = UserDAO.login(username, password);
            if (user == null) {
                sendJsonResponse(resp, HttpServletResponse.SC_UNAUTHORIZED, "{\"error\":\"Invalid credentials. Please verify your username and password.\"}");
                return;
            }

            String token = "rx_jwt_" + System.currentTimeMillis() + "_" + Math.abs(username.hashCode());
            String responseJson = "{\"success\":true,\"user\":" + user.toJson() + ",\"token\":\"" + token + "\"}";
            sendJsonResponse(resp, HttpServletResponse.SC_OK, responseJson);
        } catch (Exception e) {
            String errorMsg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "Authentication error.";
            sendJsonResponse(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "{\"error\":\"" + errorMsg + "\"}");
        }
    }
}
