/**
 * ReconcileX - Phase 4: Maker-Checker Multi-User Audit Workflow Engine
 * Manages enterprise discrepancy resolution tickets, sign-offs, and compliance audit trails.
 */

const AuditWorkflow = (() => {
    "use strict";

    const STORAGE_KEY = "reconcilex_audit_tickets_v1";

    let tickets = [];

    function init() {
        loadTickets();
    }

    function loadTickets() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            tickets = raw ? JSON.parse(raw) : [];
        } catch (e) {
            tickets = [];
        }
    }

    function saveTickets() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
        } catch (e) {}
    }

    /**
     * Generate discrepancy tickets from reconciliation results
     * @param {Array<Object>} results 
     */
    function syncTicketsFromResults(results, sessionId = "ACTIVE") {
        if (!results) return;
        const u = (typeof AuthManager !== "undefined" && AuthManager.getCurrentUser) ? AuthManager.getCurrentUser() : null;
        const currentUser = u || { username: "analyst", role: "FINANCIAL_ANALYST" };

        results.forEach(item => {
            if (item.status === "matched") return; // Only discrepancies

            const ticketId = `TKT-${item.transactionId}`;
            const existingIndex = tickets.findIndex(t => t.id === ticketId);

            if (existingIndex === -1) {
                tickets.push({
                    id: ticketId,
                    transactionId: item.transactionId,
                    sessionId: sessionId,
                    amount: item.difference,
                    bankAmount: item.bankAmount,
                    companyAmount: item.companyAmount,
                    status: item.status,
                    statusLabel: item.statusLabel,
                    workflowState: "PENDING_REVIEW", // PENDING_REVIEW | RESOLVED_APPROVED | ESCALATED
                    maker: currentUser.username,
                    checker: null,
                    resolutionCategory: "Unclassified",
                    makerNotes: item.notes || "Discrepancy detected during automated reconciliation.",
                    checkerNotes: null,
                    signedAt: null,
                    createdAt: new Date().toISOString()
                });
            }
        });

        saveTickets();
        renderWorkflowTable();
    }

    /**
     * Maker action: Add investigation notes and classify resolution category
     */
    function updateMakerNote(ticketId, category, note) {
        const t = tickets.find(x => x.id === ticketId);
        if (!t) return;
        t.resolutionCategory = category;
        t.makerNotes = note;
        t.workflowState = "PENDING_AUDIT_APPROVAL";
        saveTickets();
        renderWorkflowTable();
        if (typeof App !== "undefined" && App.showToast) {
            App.showToast(`Ticket ${ticketId} updated and sent for Senior Auditor review.`, "info");
        }
    }

    /**
     * Checker action: Senior Auditor approves write-off / resolution with digital signature
     */
    function approveResolution(ticketId, checkerNotes) {
        const u = (typeof AuthManager !== "undefined" && AuthManager.getCurrentUser) ? AuthManager.getCurrentUser() : null;
        const currentUser = u || { username: "admin", fullName: "Lead Auditor", role: "ADMIN" };
        const t = tickets.find(x => x.id === ticketId);
        if (!t) return;

        t.workflowState = "RESOLVED_APPROVED";
        t.checker = currentUser.fullName || currentUser.username;
        t.checkerNotes = checkerNotes || "Approved and adjusted in master general ledger.";
        t.signedAt = new Date().toISOString();

        saveTickets();
        renderWorkflowTable();
        if (typeof App !== "undefined" && App.showToast) {
            App.showToast(`Resolution approved for ${ticketId} by ${t.checker}!`, "success");
        }
    }

    /**
     * Render the Maker-Checker Workflow Table in the UI
     */
    function renderWorkflowTable() {
        if (typeof document === "undefined") return;
        const tbody = document.getElementById("workflowTableBody");
        const countPending = document.getElementById("wfCountPending");
        const countResolved = document.getElementById("wfCountResolved");

        if (!tbody) return;

        const pending = tickets.filter(t => t.workflowState !== "RESOLVED_APPROVED");
        const resolved = tickets.filter(t => t.workflowState === "RESOLVED_APPROVED");

        if (countPending) countPending.textContent = `${pending.length} Pending`;
        if (countResolved) countResolved.textContent = `${resolved.length} Approved`;

        if (tickets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        No discrepancy tickets in workflow queue. Run reconciliation to generate audit items.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            const isApproved = t.workflowState === "RESOLVED_APPROVED";
            const stateBadge = isApproved
                ? '<span class="status-badge badge-matched"><i class="fas fa-check-circle"></i> Approved & Signed</span>'
                : '<span class="status-badge badge-unmatched-bank"><i class="fas fa-hourglass-half"></i> Pending Sign-Off</span>';

            const diffStr = Settings.formatCurrency(Math.abs(t.amount));

            return `
                <tr>
                    <td class="font-mono font-medium">${t.id}</td>
                    <td class="font-mono font-bold">${t.transactionId}</td>
                    <td class="font-mono font-bold text-red">${diffStr}</td>
                    <td>${stateBadge}</td>
                    <td class="text-sm">
                        <div><strong>Maker:</strong> ${t.maker}</div>
                        <div class="text-muted text-sm">${t.makerNotes.slice(0, 40)}...</div>
                    </td>
                    <td class="text-sm">
                        ${isApproved 
                            ? `<span class="text-green font-medium"><i class="fas fa-signature"></i> ${t.checker}</span><div class="text-muted">${new Date(t.signedAt).toLocaleDateString()}</div>` 
                            : '<span class="text-muted">Awaiting Auditor</span>'}
                    </td>
                    <td>
                        ${isApproved 
                            ? '<button class="btn-action-view" disabled><i class="fas fa-lock"></i> Locked</button>'
                            : `<button class="btn-primary" style="padding: 6px 12px; font-size: 11px;" onclick="AuditWorkflow.openReviewModal('${t.id}')">
                                <i class="fas fa-signature"></i> Audit Sign-Off
                               </button>`}
                    </td>
                </tr>
            `;
        }).join("");
    }

    function openReviewModal(ticketId) {
        const t = tickets.find(x => x.id === ticketId);
        if (!t) return;

        const modal = document.getElementById("auditSignoffModal");
        const content = document.getElementById("auditSignoffContent");
        if (!modal || !content) return;

        content.innerHTML = `
            <div class="modal-header-section">
                <h3>Resolution Sign-Off: <span class="font-mono text-cyan">${t.id}</span> (${t.transactionId})</h3>
                <p class="modal-notes">Variance Amount: <strong class="text-red font-mono">${Settings.formatCurrency(Math.abs(t.amount))}</strong></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
                <div class="form-field">
                    <label>Resolution Classification</label>
                    <select id="wfResCategory" class="select-filter" style="width: 100%;">
                        <option value="Vendor Billing Adjustment">Vendor Billing Adjustment</option>
                        <option value="Approved Bank Fee Write-Off">Approved Bank Fee Write-Off</option>
                        <option value="Timing Lag (T+2 Absorption)">Timing Lag (T+2 Absorption)</option>
                        <option value="Duplicate Refund Initiated">Duplicate Refund Initiated</option>
                        <option value="General Ledger Correction">General Ledger Correction</option>
                    </select>
                </div>
                <div class="form-field">
                    <label>Senior Auditor Compliance Notes / Justification</label>
                    <textarea id="wfCheckerNote" class="search-input" rows="3" placeholder="Enter formal audit remarks..."></textarea>
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn-secondary" onclick="AuditWorkflow.closeReviewModal()">Cancel</button>
                <button type="button" class="btn-primary" onclick="AuditWorkflow.confirmSignoff('${t.id}')">
                    <i class="fas fa-stamp"></i> Digitally Sign & Approve Resolution
                </button>
            </div>
        `;

        modal.classList.add("active");
    }

    function confirmSignoff(ticketId) {
        const cat = document.getElementById("wfResCategory").value;
        const note = document.getElementById("wfCheckerNote").value;
        approveResolution(ticketId, `${cat}: ${note || "Authorized by Auditor."}`);
        closeReviewModal();
    }

    function closeReviewModal() {
        const modal = document.getElementById("auditSignoffModal");
        if (modal) modal.classList.remove("active");
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", init);
    }

    return {
        init,
        syncTicketsFromResults,
        approveResolution,
        updateMakerNote,
        renderWorkflowTable,
        openReviewModal,
        closeReviewModal,
        confirmSignoff
    };
})();
