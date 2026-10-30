package com.reconcilex.servlet;

import com.reconcilex.dao.UserDAO;
import com.reconcilex.model.User;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Standard Java Servlet implementation for User Authentication & Registration.
 * Suitable for deployment in Tomcat, Jetty, or standard J2EE servlet containers.
 */
public class AuthServlet {

    public void processLogin(String jsonBody, PrintWriter out) {
        String username = extract(jsonBody, "username");
        String password = extract(jsonBody, "password");

        try {
            User user = UserDAO.login(username, password);
            if (user != null) {
                out.print("{\"success\":true,\"user\":" + user.toJson() + ",\"token\":\"rx_jwt_" + System.currentTimeMillis() + "\"}");
            } else {
                out.print("{\"success\":false,\"error\":\"Invalid credentials.\"}");
            }
        } catch (Exception e) {
            out.print("{\"success\":false,\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    public void processRegister(String jsonBody, PrintWriter out) {
        String username = extract(jsonBody, "username");
        String email = extract(jsonBody, "email");
        String password = extract(jsonBody, "password");
        String fullName = extract(jsonBody, "fullName");
        String role = extract(jsonBody, "role");

        try {
            User user = UserDAO.register(username, email, password, fullName, role);
            out.print("{\"success\":true,\"user\":" + user.toJson() + ",\"token\":\"rx_jwt_" + System.currentTimeMillis() + "\"}");
        } catch (Exception e) {
            out.print("{\"success\":false,\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    private String extract(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? matcher.group(1) : "";
    }
}
