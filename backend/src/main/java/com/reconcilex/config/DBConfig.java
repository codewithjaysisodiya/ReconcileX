package com.reconcilex.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConfig {
    private static final String DEFAULT_URL = "jdbc:mysql://localhost:3306/reconcilex_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String DEFAULT_USER = "root";
    private static final String DEFAULT_PASSWORD = "";

    public static String getUrl() {
        String envUrl = System.getenv("DB_URL");
        return (envUrl != null && !envUrl.trim().isEmpty()) ? envUrl : DEFAULT_URL;
    }

    public static String getUser() {
        String envUser = System.getenv("DB_USER");
        return (envUser != null && !envUser.trim().isEmpty()) ? envUser : DEFAULT_USER;
    }

    public static String getPassword() {
        String envPass = System.getenv("DB_PASSWORD");
        return (envPass != null) ? envPass : DEFAULT_PASSWORD;
    }

    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            // Driver may not be present in standalone classpath, attempt DriverManager anyway
        }
        return DriverManager.getConnection(getUrl(), getUser(), getPassword());
    }

    public static boolean isDatabaseAvailable() {
        try (Connection conn = getConnection()) {
            return conn != null && !conn.isClosed();
        } catch (Exception e) {
            return false;
        }
    }
}
