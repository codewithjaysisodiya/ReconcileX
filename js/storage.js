/**
 * ReconcileX - Storage & Session History Manager
 * Persists reconciliation sessions and active state in browser LocalStorage.
 * Allows restoring, inspecting, and deleting past reconciliation sessions.
 */

const StorageManager = (() => {
    "use strict";

    const SESSIONS_KEY = "reconcilex_sessions_v1";
    const ACTIVE_SESSION_KEY = "reconcilex_active_session_v1";
    const MAX_SESSIONS = 15;

    /**
     * Generate unique session ID
     */
    function generateId() {
        return "RX-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    /**
     * Get all saved reconciliation sessions
     * @returns {Array<Object>}
     */
    function getSessions() {
        try {
            const raw = localStorage.getItem(SESSIONS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("Failed to read sessions from storage:", e);
            return [];
        }
    }

    /**
     * Save a completed reconciliation session
     * @param {Object} sessionData 
     * @returns {Object|null} Saved session metadata
     */
    function saveSession(sessionData) {
        try {
            const sessions = getSessions();
            const sessionId = generateId();

            const sessionSummary = {
                id: sessionId,
                timestamp: new Date().toISOString(),
                bankFileName: sessionData.bankFileName || "Bank_Statement.csv",
                companyFileName: sessionData.companyFileName || "Company_Records.csv",
                bankCount: sessionData.bankRecords ? sessionData.bankRecords.length : 0,
                companyCount: sessionData.companyRecords ? sessionData.companyRecords.length : 0,
                totalProcessed: sessionData.statistics.totalProcessedRows,
                matchedCount: sessionData.statistics.matchedCount,
                unmatchedCount: sessionData.statistics.totalUnmatchedCount,
                duplicateCount: sessionData.statistics.duplicateCount,
                mismatchCount: sessionData.statistics.amountMismatchCount + sessionData.statistics.dateMismatchCount,
                matchPercentage: sessionData.statistics.matchPercentage,
                totalDiscrepancyAmount: sessionData.statistics.totalDiscrepancyAmount,
                // Keep data payload for full session restoration
                results: sessionData.results,
                statistics: sessionData.statistics,
                optionsUsed: sessionData.optionsUsed || {},
                bankRecords: sessionData.bankRecords,
                companyRecords: sessionData.companyRecords
            };

            // Prepend newest session
            sessions.unshift(sessionSummary);

            // Prune older sessions if exceeding limit
            const prunedSessions = sessions.slice(0, MAX_SESSIONS);

            // Attempt to save to LocalStorage with fallback if quota exceeded
            try {
                localStorage.setItem(SESSIONS_KEY, JSON.stringify(prunedSessions));
                localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionSummary));
            } catch (quotaError) {
                console.warn("Storage quota exceeded, pruning historical payloads:", quotaError);
                // Strip detailed results from older sessions, preserving only the newest
                const lightweightSessions = prunedSessions.map((s, idx) => {
                    if (idx === 0) return s;
                    const { results, bankRecords, companyRecords, ...metaOnly } = s;
                    return metaOnly;
                });
                localStorage.setItem(SESSIONS_KEY, JSON.stringify(lightweightSessions));
                localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionSummary));
            }

            return sessionSummary;
        } catch (e) {
            console.error("Critical storage failure:", e);
            return null;
        }
    }

    /**
     * Retrieve the last active session (for restoring after page reload)
     */
    function getActiveSession() {
        try {
            const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Clear the currently active session
     */
    function clearActiveSession() {
        try {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
        } catch (e) {}
    }

    /**
     * Retrieve a specific session by ID
     * @param {string} sessionId 
     */
    function getSessionById(sessionId) {
        const sessions = getSessions();
        return sessions.find(s => s.id === sessionId) || null;
    }

    /**
     * Delete a session by ID
     * @param {string} sessionId 
     */
    function deleteSession(sessionId) {
        try {
            const sessions = getSessions();
            const filtered = sessions.filter(s => s.id !== sessionId);
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));

            const active = getActiveSession();
            if (active && active.id === sessionId) {
                clearActiveSession();
            }
            return true;
        } catch (e) {
            console.error("Failed to delete session:", e);
            return false;
        }
    }

    /**
     * Clear all session history
     */
    function clearAllHistory() {
        try {
            localStorage.removeItem(SESSIONS_KEY);
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            return true;
        } catch (e) {
            console.error("Failed to clear history:", e);
            return false;
        }
    }

    return {
        getSessions,
        saveSession,
        getActiveSession,
        clearActiveSession,
        getSessionById,
        deleteSession,
        clearAllHistory
    };
})();
