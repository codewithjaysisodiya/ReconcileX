package com.reconcilex.servlet;

import com.reconcilex.dao.UserDAO;
import com.reconcilex.model.User;

import java.io.IOException;

/**
 * RegisterServlet
 * Handles user account registration and analyst credential onboarding.
 * Mapped to /api/auth/register and /RegisterServlet
 */
public class RegisterServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String body = req.getBody();

        // Extract credentials from JSON body or URL parameters
        String username = extractJsonString(body, "username");
        String email = extractJsonString(body, "email");
        String password = extractJsonString(body, "password");
        String fullName = extractJsonString(body, "fullName");
        String role = extractJsonString(body, "role");

        if (username.isEmpty()) username = req.getParameter("username") != null ? req.getParameter("username") : "";
        if (email.isEmpty()) email = req.getParameter("email") != null ? req.getParameter("email") : "";
        if (password.isEmpty()) password = req.getParameter("password") != null ? req.getParameter("password") : "";
        if (fullName.isEmpty()) fullName = req.getParameter("fullName") != null ? req.getParameter("fullName") : "";
        if (role.isEmpty()) role = req.getParameter("role") != null ? req.getParameter("role") : "ANALYST";

        if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Username, corporate email, and password are required.\"}");
            return;
        }

        try {
            User user = UserDAO.register(username, email, password, fullName.isEmpty() ? username : fullName, role);
            String token = "rx_jwt_" + System.currentTimeMillis() + "_" + Math.abs(username.hashCode());
            String responseJson = "{\"success\":true,\"user\":" + user.toJson() + ",\"token\":\"" + token + "\"}";
            sendJsonResponse(resp, HttpServletResponse.SC_CREATED, responseJson);
        } catch (Exception e) {
            String errorMsg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "Registration failed.";
            sendJsonResponse(resp, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"" + errorMsg + "\"}");
        }
    }
}
