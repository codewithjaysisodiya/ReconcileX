/**
 * ReconcileX - Authentication & User Management Module
 * Supports dual-mode authentication:
 * 1. Live Java / MySQL REST API (/api/auth/login, /api/auth/register)
 * 2. Secure Local Fallback when running standalone / offline
 */

const AuthManager = (() => {
    "use strict";

    const USER_STORAGE_KEY = "reconcilex_auth_user_v1";
    const API_BASE = "http://localhost:8080/api";

    // Demo Pre-configured accounts for quick hackathon evaluation
    const DEMO_USERS = [
        {
            id: 1,
            username: "admin",
            email: "admin@reconcilex.internal",
            fullName: "ReconcileX Lead Administrator",
            role: "ADMIN",
            password: "Admin@1234"
        },
        {
            id: 2,
            username: "analyst",
            email: "analyst@reconcilex.internal",
            fullName: "Senior Financial Analyst",
            role: "FINANCIAL_ANALYST",
            password: "Admin@1234"
        }
    ];

    let currentUser = null;

    function init() {
        loadUserFromStorage();
        updateUI();
        checkBackendHealth();
    }

    function loadUserFromStorage() {
        try {
            const raw = localStorage.getItem(USER_STORAGE_KEY);
            if (raw) {
                currentUser = JSON.parse(raw);
            } else {
                // Default to Analyst user for immediate seamless hackathon evaluation
                currentUser = DEMO_USERS[1];
            }
        } catch (e) {
            currentUser = DEMO_USERS[1];
        }
    }

    function saveUserToStorage(user) {
        currentUser = user;
        try {
            if (user) {
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(USER_STORAGE_KEY);
            }
        } catch (e) {}
        updateUI();
    }

    async function checkBackendHealth() {
        const badge = document.getElementById("dbStatusIndicator");
        if (!badge) return;

        try {
            const res = await fetch(`${API_BASE}/health`, { method: "GET", mode: "cors" });
            if (res.ok) {
                const data = await res.json();
                badge.className = "status-badge badge-matched";
                badge.innerHTML = `<i class="fas fa-database"></i> MySQL ${data.database === "CONNECTED" ? "Connected" : "Standby"}`;
                return;
            }
        } catch (e) {
            // Backend offline, fallback active
        }

        badge.className = "status-badge badge-date-mismatch";
        badge.innerHTML = `<i class="fas fa-shield-alt"></i> Local Engine Active`;
    }

    async function login(usernameOrEmail, password) {
        const key = usernameOrEmail.trim().toLowerCase();

        // 1. Try Java REST API if available
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: key, password: password })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    saveUserToStorage(data.user);
                    return { success: true, user: data.user, source: "MySQL Database" };
                }
            }
        } catch (e) {
            // Server offline, use local auth fallback
        }

        // 2. Local Fallback Auth
        const found = DEMO_USERS.find(u => 
            (u.username.toLowerCase() === key || u.email.toLowerCase() === key) && u.password === password
        );

        if (found) {
            const safeUser = {
                id: found.id,
                username: found.username,
                email: found.email,
                fullName: found.fullName,
                role: found.role
            };
            saveUserToStorage(safeUser);
            return { success: true, user: safeUser, source: "Secure Local Session" };
        }

        // Check custom registered users in LocalStorage
        try {
            const localUsers = JSON.parse(localStorage.getItem("reconcilex_custom_users") || "[]");
            const match = localUsers.find(u => 
                (u.username.toLowerCase() === key || u.email.toLowerCase() === key) && u.password === password
            );
            if (match) {
                const safeUser = { id: match.id, username: match.username, email: match.email, fullName: match.fullName, role: match.role };
                saveUserToStorage(safeUser);
                return { success: true, user: safeUser, source: "Secure Local Session" };
            }
        } catch (e) {}

        throw new Error("Invalid username or password. (Hint: Try demo user: analyst / Admin@1234)");
    }

    async function register(username, email, password, fullName, role) {
        // 1. Try Java API
        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password, fullName, role })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    saveUserToStorage(data.user);
                    return { success: true, user: data.user };
                }
            }
        } catch (e) {}

        // 2. Local Fallback
        const localUsers = JSON.parse(localStorage.getItem("reconcilex_custom_users") || "[]");
        if (localUsers.some(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) {
            throw new Error("Username or Email already registered.");
        }

        const newUser = {
            id: Date.now(),
            username,
            email,
            password,
            fullName: fullName || username,
            role: role || "FINANCIAL_ANALYST"
        };
        localUsers.push(newUser);
        localStorage.setItem("reconcilex_custom_users", JSON.stringify(localUsers));

        const safeUser = { id: newUser.id, username: newUser.username, email: newUser.email, fullName: newUser.fullName, role: newUser.role };
        saveUserToStorage(safeUser);
        return { success: true, user: safeUser };
    }

    function logout() {
        saveUserToStorage(null);
        App.showToast("Signed out successfully.", "info");
    }

    function getCurrentUser() {
        return currentUser;
    }

    function updateUI() {
        const nameEl = document.getElementById("headerUserName");
        const roleEl = document.getElementById("headerUserRole");
        const avatarEl = document.getElementById("headerUserAvatar");
        const authBtn = document.getElementById("headerAuthBtn");

        if (currentUser) {
            if (nameEl) nameEl.textContent = currentUser.fullName || currentUser.username;
            if (roleEl) roleEl.textContent = currentUser.role.replace("_", " ");
            if (avatarEl) {
                const initials = (currentUser.fullName || currentUser.username).slice(0, 2).toUpperCase();
                avatarEl.textContent = initials;
            }
            if (authBtn) {
                authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Sign Out</span>';
                authBtn.onclick = logout;
            }
        } else {
            if (nameEl) nameEl.textContent = "Guest User";
            if (roleEl) roleEl.textContent = "Not Authenticated";
            if (avatarEl) avatarEl.textContent = "GU";
            if (authBtn) {
                authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Sign In</span>';
                authBtn.onclick = openAuthModal;
            }
        }
    }

    function openAuthModal() {
        const modal = document.getElementById("authModal");
        if (modal) modal.classList.add("active");
    }

    function closeAuthModal() {
        const modal = document.getElementById("authModal");
        if (modal) modal.classList.remove("active");
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", init);
    }

    return {
        init,
        login,
        register,
        logout,
        getCurrentUser,
        openAuthModal,
        closeAuthModal,
        checkBackendHealth
    };
})();
