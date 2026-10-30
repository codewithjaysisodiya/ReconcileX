/**
 * ReconcileX - Analytics & Financial Insights Engine
 * Calculates advanced discrepancy metrics, generates rule-based audit observations,
 * and highlights high-risk financial leakages and top discrepancies.
 */

const AnalyticsUI = (() => {
    "use strict";

    /**
     * Generate automated audit observations from actual parsed reconciliation data
     * @param {Object} stats 
     * @param {Array<Object>} results 
     * @returns {Array<{ type: 'danger'|'warning'|'info'|'success', icon: string, title: string, message: string }>}
     */
    function generateObservations(stats, results) {
        const insights = [];
        const currSym = Settings.getCurrencySymbol();

        // 1. Critical Discrepancy Volume Insight
        if (stats.totalDiscrepancyAmount > 0) {
            insights.push({
                type: "danger",
                icon: "fa-exclamation-triangle",
                title: "Financial Variance Detected",
                message: `Total unaligned transaction volume is ${Settings.formatCurrency(stats.totalDiscrepancyAmount)}. Immediate review of mismatched entries is advised.`
            });
        } else if (stats.matchedCount > 0 && stats.discrepancyCount === 0) {
            insights.push({
                type: "success",
                icon: "fa-check-circle",
                title: "Perfect Reconciliation Balance",
                message: "100% of recorded transactions matched exactly on ID, amounts, and dates with zero financial discrepancy."
            });
        }

        // 2. Action Required / Manual Review count
        const manualReviewCount = (stats.amountMismatchCount || 0) + (stats.duplicateCount || 0) + (stats.multipleIssuesCount || 0);
        if (manualReviewCount > 0) {
            insights.push({
                type: "danger",
                icon: "fa-user-check",
                title: "Manual Triage Required",
                message: `${manualReviewCount} transaction(s) require manual ledger adjustment due to pricing differences, multiple issues, or duplicate billing.`
            });
        }

        // 3. Bank-only transactions (Missing in Company books)
        if (stats.unmatchedBankCount > 0) {
            insights.push({
                type: "warning",
                icon: "fa-university",
                title: "Bank Statement Only Records",
                message: `Bank statement contains ${stats.unmatchedBankCount} transaction(s) missing from company records. These may represent direct bank charges, auto-debits, or unrecorded client wires.`
            });
        }

        // 4. Company-only transactions (Missing in Bank statements)
        if (stats.unmatchedCompanyCount > 0) {
            insights.push({
                type: "warning",
                icon: "fa-building",
                title: "Unpresented / Uncleared Entries",
                message: `Company ledger records ${stats.unmatchedCompanyCount} transaction(s) not found in the bank statement. These may be uncleared cheques, pending gateway settlements, or timing differences.`
            });
        }

        // 5. Duplicates Alert
        if (stats.duplicateCount > 0) {
            insights.push({
                type: "danger",
                icon: "fa-copy",
                title: "Duplicate Transaction IDs Flagged",
                message: `${stats.duplicateCount} transaction ID(s) appeared multiple times in source records. Investigate potential duplicate charges or duplicate batch exports.`
            });
        }

        // 6. Timing / Date Mismatches
        if (stats.dateMismatchCount > 0) {
            insights.push({
                type: "info",
                icon: "fa-clock",
                title: "Value Date Timing Differences",
                message: `${stats.dateMismatchCount} transaction(s) have matching amounts but differing posting dates. You can adjust the Date Tolerance in Settings to absorb settlement lag.`
            });
        }

        // 7. Net Variance Direction
        if (stats.netDiscrepancy !== 0) {
            const isBankHigher = stats.netDiscrepancy > 0;
            insights.push({
                type: isBankHigher ? "info" : "warning",
                icon: "fa-balance-scale",
                title: "Net Settlement Direction",
                message: isBankHigher
                    ? `Bank balance exceeds company books by ${Settings.formatCurrency(stats.netDiscrepancy)}.`
                    : `Company ledger exceeds bank statement by ${Settings.formatCurrency(Math.abs(stats.netDiscrepancy))}.`
            });
        }

        return insights;
    }

    /**
     * Render the analytics view
     * @param {Object} statistics 
     * @param {Array<Object>} results 
     */
    function render(statistics, results) {
        const domAnalyticsEmpty = document.getElementById("analyticsEmptyState");
        const domAnalyticsContent = document.getElementById("analyticsActiveContent");

        if (!statistics || !results || results.length === 0) {
            if (domAnalyticsEmpty) domAnalyticsEmpty.style.display = "block";
            if (domAnalyticsContent) domAnalyticsContent.style.display = "none";
            return;
        }

        if (domAnalyticsEmpty) domAnalyticsEmpty.style.display = "none";
        if (domAnalyticsContent) domAnalyticsContent.style.display = "block";

        // Metrics
        const total = statistics.totalProcessedRows || 1;
        const unmatchedPct = total > 0 ? ((statistics.totalUnmatchedCount / total) * 100).toFixed(1) : 0;
        const mismatchPct = total > 0 ? (((statistics.amountMismatchCount + statistics.dateMismatchCount + statistics.multipleIssuesCount) / total) * 100).toFixed(1) : 0;

        const elMatchRate = document.getElementById("anMatchRate");
        const elUnmatchedPct = document.getElementById("anUnmatchedPct");
        const elDiscrepancyAmt = document.getElementById("anDiscrepancyAmt");
        const elNetVariance = document.getElementById("anNetVariance");
        const elDupCount = document.getElementById("anDuplicateCount");
        const elBankOnlyCount = document.getElementById("anBankOnlyCount");
        const elCompanyOnlyCount = document.getElementById("anCompanyOnlyCount");
        const elDateMismatchCount = document.getElementById("anDateMismatchCount");

        if (elMatchRate) elMatchRate.textContent = `${statistics.matchPercentage.toFixed(1)}%`;
        if (elUnmatchedPct) elUnmatchedPct.textContent = `${unmatchedPct}%`;
        if (elDiscrepancyAmt) elDiscrepancyAmt.textContent = Settings.formatCurrency(statistics.totalDiscrepancyAmount);
        if (elNetVariance) {
            const net = statistics.netDiscrepancy;
            elNetVariance.textContent = (net >= 0 ? "+" : "") + Settings.formatCurrency(net);
        }
        if (elDupCount) elDupCount.textContent = statistics.duplicateCount || 0;
        if (elBankOnlyCount) elBankOnlyCount.textContent = statistics.unmatchedBankCount || 0;
        if (elCompanyOnlyCount) elCompanyOnlyCount.textContent = statistics.unmatchedCompanyCount || 0;
        if (elDateMismatchCount) elDateMismatchCount.textContent = statistics.dateMismatchCount || 0;

        // Render AI Observations / Audit Insights
        const insightsContainer = document.getElementById("auditInsightsList");
        if (insightsContainer) {
            const observations = generateObservations(statistics, results);
            insightsContainer.innerHTML = observations.map(obs => `
                <div class="insight-card insight-${obs.type}">
                    <div class="insight-icon">
                        <i class="fas ${obs.icon}"></i>
                    </div>
                    <div class="insight-content">
                        <h4>${escapeHTML(obs.title)}</h4>
                        <p>${escapeHTML(obs.message)}</p>
                    </div>
                </div>
            `).join("");
        }

        // Render Top 5 Largest Discrepancies Table
        const topDiscrepancyBody = document.getElementById("topDiscrepancyBody");
        if (topDiscrepancyBody) {
            // Find records with non-zero discrepancy, sorted by magnitude
            const discrepancies = results
                .filter(r => r.status !== "matched" && (Math.abs(r.difference) > 0 || r.bankAmount || r.companyAmount))
                .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
                .slice(0, 5);

            if (discrepancies.length === 0) {
                topDiscrepancyBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-4 text-muted">
                            No discrepancy records to display. All transactions balanced!
                        </td>
                    </tr>
                `;
            } else {
                topDiscrepancyBody.innerHTML = discrepancies.map((item, idx) => {
                    const diffAbs = Math.abs(item.difference);
                    return `
                        <tr>
                            <td>#${idx + 1}</td>
                            <td class="font-mono font-medium">${escapeHTML(item.transactionId)}</td>
                            <td><span class="status-badge ${escapeHTML(item.badgeClass)}">${escapeHTML(item.statusLabel)}</span></td>
                            <td class="font-mono text-right font-bold text-red">${Settings.formatCurrency(diffAbs)}</td>
                            <td class="text-sm">${escapeHTML(item.notes || "Discrepancy detected.")}</td>
                        </tr>
                    `;
                }).join("");
            }
        }
    }

    function escapeHTML(str) {
        if (!str) return "";
        return String(str).replace(/[&<>"']/g, c => {
            const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
            return map[c];
        });
    }

    return {
        render,
        generateObservations
    };
})();
