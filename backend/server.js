/**
 * ReconcileX - Standalone Lightweight REST API Server
 * Provides persistent database storage for user registration and credential-verified authentication.
 * Uses Node.js standard libraries (http, crypto, fs, path). Zero external dependencies required.
 *
 * Endpoints:
 * - GET  /api/health
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - GET  /api/database/users
 */

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 8080;
const DB_FILE = path.join(__dirname, "..", "database", "reconcilex.db.json");

// Helper: SHA-256 hashing with salt
function hashPassword(password, salt) {
    return crypto.createHash("sha256").update(password + salt).digest("hex");
}

function generateSalt() {
    return crypto.randomBytes(16).toString("hex");
}

// Initial clean database structure without pre-seeded demo accounts
function getDefaultDatabase() {
    return {
        users: [],
        audit_logs: [
            {
                id: "LOG-INIT",
                action: "SYSTEM_BOOTSTRAP",
                details: "Database initialized with clean production schema.",
                timestamp: new Date().toISOString()
            }
        ]
    };
}

function readDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, "utf-8");
            const db = JSON.parse(data);
            if (db && Array.isArray(db.users)) {
                const initialCount = db.users.length;
                db.users = db.users.filter(u => u.username !== "admin" && u.username !== "analyst");
                if (db.users.length !== initialCount) {
                    writeDatabase(db);
                }
            }
            return db;
        }
    } catch (e) {
        console.error("Warning reading database file:", e.message);
    }
    const def = getDefaultDatabase();
    writeDatabase(def);
    return def;
}

function writeDatabase(data) {
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error("Error writing database file:", e.message);
    }
}

// HTTP Server
const server = http.createServer((req, res) => {
    // Enable CORS for all local requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    function sendJSON(statusCode, payload) {
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
    }

    // Parse body for POST requests
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
        let jsonBody = {};
        if (body) {
            try {
                jsonBody = JSON.parse(body);
            } catch (e) {
                return sendJSON(400, { success: false, error: "Invalid JSON in request body" });
            }
        }

        // ROUTE: GET /api/health
        if (req.method === "GET" && pathname === "/api/health") {
            return sendJSON(200, {
                status: "UP",
                database: "CONNECTED",
                engine: "ReconcileX Relational Engine v2.0",
                timestamp: new Date().toISOString()
            });
        }

        // ROUTE: POST /api/auth/register
        if (req.method === "POST" && pathname === "/api/auth/register") {
            const { username, email, password, fullName, role } = jsonBody;

            if (!username || !email || !password) {
                return sendJSON(400, {
                    success: false,
                    error: "Validation Error: Username, Corporate Email, and Password are required."
                });
            }

            const cleanUser = username.trim().toLowerCase();
            const cleanEmail = email.trim().toLowerCase();
            const db = readDatabase();

            // Constraint Check: Unique Username
            if (db.users.some(u => u.username.toLowerCase() === cleanUser)) {
                return sendJSON(409, {
                    success: false,
                    error: `Database Constraint Violation: Username '${username}' is already registered in the database.`
                });
            }

            // Constraint Check: Unique Corporate Email
            if (db.users.some(u => u.email.toLowerCase() === cleanEmail)) {
                return sendJSON(409, {
                    success: false,
                    error: `Database Constraint Violation: Corporate Email '${email}' is already registered in the database.`
                });
            }

            // Generate 16-byte random salt and SHA-256 hash
            const salt = generateSalt();
            const passwordHash = hashPassword(password, salt);

            const newRecord = {
                id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
                username: username.trim(),
                email: cleanEmail,
                full_name: (fullName && fullName.trim()) ? fullName.trim() : username.trim(),
                role: role || "FINANCIAL_ANALYST",
                password_hash: passwordHash,
                salt: salt,
                created_at: new Date().toLocaleString(),
                last_login: null
            };

            db.users.push(newRecord);
            db.audit_logs.unshift({
                id: "LOG-" + Date.now(),
                action: "USER_REGISTERED",
                details: `User created in database: ${newRecord.username} (ID: ${newRecord.id})`,
                timestamp: new Date().toISOString()
            });

            writeDatabase(db);

            return sendJSON(201, {
                success: true,
                message: "User successfully registered in the database.",
                user: {
                    id: newRecord.id,
                    username: newRecord.username,
                    email: newRecord.email,
                    fullName: newRecord.full_name,
                    role: newRecord.role,
                    createdAt: newRecord.created_at
                }
            });
        }

        // ROUTE: POST /api/auth/login
        if (req.method === "POST" && pathname === "/api/auth/login") {
            const { username, password } = jsonBody;

            if (!username || !password) {
                return sendJSON(400, {
                    success: false,
                    error: "Login Error: Username or Email and password are required."
                });
            }

            const cleanKey = username.trim().toLowerCase();
            const db = readDatabase();

            // Query database table
            const user = db.users.find(u => 
                u.username.toLowerCase() === cleanKey || u.email.toLowerCase() === cleanKey
            );

            if (!user) {
                return sendJSON(404, {
                    success: false,
                    error: `Authentication Failed: User '${username}' does not exist in the database. Please register first.`
                });
            }

            // Compute hash with stored salt
            const computedHash = hashPassword(password, user.salt);

            // Verify credential match
            if (computedHash.toLowerCase() !== user.password_hash.toLowerCase()) {
                return sendJSON(401, {
                    success: false,
                    error: "Authentication Failed: Incorrect password. Database credential match failed."
                });
            }

            // Update last_login timestamp
            user.last_login = new Date().toLocaleString();
            db.audit_logs.unshift({
                id: "LOG-" + Date.now(),
                action: "USER_LOGIN_SUCCESS",
                details: `User ${user.username} (ID: ${user.id}) successfully verified against database.`,
                timestamp: new Date().toISOString()
            });

            writeDatabase(db);

            return sendJSON(200, {
                success: true,
                message: "Authentication verified successfully.",
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    lastLogin: user.last_login
                }
            });
        }

        // ROUTE: GET /api/database/users
        if (req.method === "GET" && pathname === "/api/database/users") {
            const db = readDatabase();
            const safeUsers = db.users.map(u => ({
                id: u.id,
                username: u.username,
                email: u.email,
                fullName: u.full_name,
                role: u.role,
                passwordHash: u.password_hash.slice(0, 10) + "..." + u.password_hash.slice(-8),
                salt: u.salt.slice(0, 8) + "...",
                createdAt: u.created_at,
                lastLogin: u.last_login
            }));

            return sendJSON(200, {
                success: true,
                count: safeUsers.length,
                users: safeUsers
            });
        }

        // Default 404
        sendJSON(404, { success: false, error: "Endpoint not found" });
    });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`ReconcileX Database & REST API Server running at http://localhost:${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
}

module.exports = { server, hashPassword, generateSalt };
