package com.reconcilex.dao;

import com.reconcilex.config.DBConfig;
import com.reconcilex.model.User;
import com.reconcilex.util.PasswordHasher;

import java.sql.*;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class UserDAO {

    // In-memory fallback repository when MySQL is temporarily offline
    private static final Map<String, User> memoryUsersByEmail = new ConcurrentHashMap<>();
    private static final Map<String, User> memoryUsersByUsername = new ConcurrentHashMap<>();
    private static final AtomicInteger memoryIdCounter = new AtomicInteger(100);

    static {
        // Seed initial admin user in memory fallback
        String salt = "rx_salt_default_2026";
        String hash = PasswordHasher.hashPassword("Admin@1234", salt);
        User admin = new User(1, "admin", "admin@reconcilex.internal", "ReconcileX Lead Administrator", "ADMIN");
        admin.setSalt(salt);
        admin.setPasswordHash(hash);
        memoryUsersByEmail.put(admin.getEmail().toLowerCase(), admin);
        memoryUsersByUsername.put(admin.getUsername().toLowerCase(), admin);
    }

    public static User register(String username, String email, String password, String fullName, String role) throws SQLException {
        String cleanUsername = username.trim();
        String cleanEmail = email.trim().toLowerCase();
        String cleanRole = (role != null && !role.trim().isEmpty()) ? role.trim().toUpperCase() : "FINANCIAL_ANALYST";

        String salt = PasswordHasher.generateSalt();
        String hash = PasswordHasher.hashPassword(password, salt);

        // Try MySQL First
        if (DBConfig.isDatabaseAvailable()) {
            String sql = "INSERT INTO users (username, email, password_hash, salt, full_name, role) VALUES (?, ?, ?, ?, ?, ?)";
            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setString(1, cleanUsername);
                stmt.setString(2, cleanEmail);
                stmt.setString(3, hash);
                stmt.setString(4, salt);
                stmt.setString(5, fullName);
                stmt.setString(6, cleanRole);
                stmt.executeUpdate();

                try (ResultSet rs = stmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        int generatedId = rs.getInt(1);
                        return new User(generatedId, cleanUsername, cleanEmail, fullName, cleanRole);
                    }
                }
            }
        }

        // Fallback: In-Memory Storage
        if (memoryUsersByEmail.containsKey(cleanEmail) || memoryUsersByUsername.containsKey(cleanUsername.toLowerCase())) {
            throw new SQLException("User with this email or username already exists.");
        }

        int newId = memoryIdCounter.incrementAndGet();
        User u = new User(newId, cleanUsername, cleanEmail, fullName, cleanRole);
        u.setSalt(salt);
        u.setPasswordHash(hash);
        memoryUsersByEmail.put(cleanEmail, u);
        memoryUsersByUsername.put(cleanUsername.toLowerCase(), u);
        return u;
    }

    public static User login(String usernameOrEmail, String password) throws SQLException {
        String cleanKey = usernameOrEmail.trim().toLowerCase();

        // Try MySQL First
        if (DBConfig.isDatabaseAvailable()) {
            String sql = "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1";
            try (Connection conn = DBConfig.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, cleanKey);
                stmt.setString(2, cleanKey);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        String salt = rs.getString("salt");
                        String expectedHash = rs.getString("password_hash");
                        if (PasswordHasher.verifyPassword(password, salt, expectedHash)) {
                            User u = new User(
                                rs.getInt("id"),
                                rs.getString("username"),
                                rs.getString("email"),
                                rs.getString("full_name"),
                                rs.getString("role")
                            );
                            updateLastLogin(u.getId());
                            return u;
                        }
                    }
                }
            }
        }

        // Fallback: In-Memory Search
        User u = memoryUsersByEmail.get(cleanKey);
        if (u == null) {
            u = memoryUsersByUsername.get(cleanKey);
        }

        if (u != null && PasswordHasher.verifyPassword(password, u.getSalt(), u.getPasswordHash())) {
            return u;
        }

        return null;
    }

    private static void updateLastLogin(int userId) {
        if (!DBConfig.isDatabaseAvailable()) return;
        String sql = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?";
        try (Connection conn = DBConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.executeUpdate();
        } catch (Exception ignored) {}
    }
}
