/**
 * ReconcileX - Phase 3: AI Financial Intelligence & Assistant Engine
 * Features:
 * 1. AI Fuzzy Description Matching (Tokenized Jaro-Winkler Similarity)
 * 2. Root-Cause Anomaly & Fee Variance Explanations
 * 3. Interactive AI Financial Assistant (Natural Language Copilot)
 */

const AIEngine = (() => {
    "use strict";

    const VENDOR_ABBREVIATIONS = {
        "amzn": "amazon",
        "mktp": "marketplace",
        "svcs": "services",
        "serv": "services",
        "intl": "international",
        "tech": "technology",
        "msft": "microsoft",
        "goog": "google"
    };

    /**
     * Clean and tokenize financial transaction descriptions
     */
    function tokenize(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .replace(/\b(inc|ltd|pvt|corp|payment|charges|transfer|ref|wire|card|fee)\b/g, "")
            .split(/\s+/)
            .filter(t => t.length > 2)
            .map(t => VENDOR_ABBREVIATIONS[t] || t);
    }

    /**
     * Compute Jaro-Winkler string similarity (0.0 to 1.0)
     */
    function jaroWinkler(s1, s2) {
        if (!s1 || !s2) return 0.0;
        s1 = s1.toLowerCase().trim();
        s2 = s2.toLowerCase().trim();
        if (s1 === s2) return 1.0;

        const len1 = s1.length;
        const len2 = s2.length;
        const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

        const s1Matches = new Array(len1).fill(false);
        const s2Matches = new Array(len2).fill(false);

        let matches = 0;
        let transpositions = 0;

        for (let i = 0; i < len1; i++) {
            const start = Math.max(0, i - matchDistance);
            const end = Math.min(i + matchDistance + 1, len2);

            for (let j = start; j < end; j++) {
                if (s2Matches[j]) continue;
                if (s1[i] !== s2[j]) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }

        if (matches === 0) return 0.0;

        let k = 0;
        for (let i = 0; i < len1; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }

        const m = matches;
        const jaro = (m / len1 + m / len2 + (m - transpositions / 2) / m) / 3.0;

        // Winkler prefix bonus
        let prefix = 0;
        for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
            if (s1[i] === s2[i]) prefix++;
            else break;
        }

        return Math.min(1.0, jaro + prefix * 0.1 * (1.0 - jaro));
    }

    /**
     * Calculate AI Description Match Confidence Score (0% - 100%)
     */
    function calculateDescriptionMatchScore(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
        const jwScore = jaroWinkler(desc1, desc2);

        const tokens1 = new Set(tokenize(desc1));
        const tokens2 = new Set(tokenize(desc2));

        if (tokens1.size === 0 || tokens2.size === 0) {
            return Math.round(jwScore * 100);
        }

        let intersection = 0;
        tokens1.forEach(t => { if (tokens2.has(t)) intersection++; });
        const union = new Set([...tokens1, ...tokens2]).size;
        const jaccard = union > 0 ? intersection / union : 0;

        // Weighted hybrid score
        const hybrid = (jwScore * 0.6) + (jaccard * 0.4);
        return Math.min(100, Math.round(hybrid * 100));
    }

    /**
     * AI Root-Cause Anomaly Explanation Engine
     */
    function explainAnomaly(item) {
        if (item.status === "matched") {
            return "Exact financial and temporal match confirmed.";
        }

        if (item.status === "amount_mismatch") {
            const diff = Math.abs(item.difference);
            const base = Math.max(item.bankAmount, item.companyAmount);
            const ratio = base > 0 ? (diff / base) : 0;

            // Common tax / gateway fee checks
            if (Math.abs(ratio - 0.18) < 0.015) {
                return `Likely GST/Tax Variance: Discrepancy of ${Settings.formatCurrency(diff)} corresponds to an 18% standard tax deduction on ${Settings.formatCurrency(base - diff)}.`;
            }
            if (Math.abs(ratio - 0.02) < 0.005) {
                return `Likely Payment Gateway Fee: Discrepancy of ${Settings.formatCurrency(diff)} aligns with a standard 2.0% merchant gateway settlement fee.`;
            }
            if (item.bankAmount < item.companyAmount) {
                return `Bank Under-Settlement: Bank statement reflects ${Settings.formatCurrency(diff)} less than company invoice. Possible bank wire deduction or withholding.`;
            } else {
                return `Bank Surplus: Bank received ${Settings.formatCurrency(diff)} more than recorded ledger. Possible late interest credit or unrecorded bonus.`;
            }
        }

        if (item.status === "date_mismatch") {
            const days = Math.abs(item.dateDiffDays || 0);
            return `Settlement Timing Lag: Transaction cleared with a ${days}-day latency between posting date (${item.bankDate}) and invoice date (${item.companyDate}). Common during weekend or holiday banking clearing windows.`;
        }

        if (item.status === "duplicate") {
            return "Duplicate Transaction Warning: Repeated transaction ID detected in source statement. Risk of double-debit or duplicate vendor billing webhook fires.";
        }

        if (item.status === "unmatched_bank") {
            return "Unrecorded Bank Debit/Credit: Present in bank statement but omitted from internal accounting ledger. Immediate ledger adjustment required to balance treasury books.";
        }

        if (item.status === "unmatched_company") {
            return "Uncleared / Outstanding Item: Recorded in internal company ERP but not cleared by bank. Likely an unpresented cheque, pending wire, or processing lag.";
        }

        return "Multiple compound variances detected across amounts and value dates.";
    }

    /**
     * Interactive AI Financial Assistant Query Processor
     */
    function processQuery(query, activeRecon) {
        const q = query.trim().toLowerCase();

        if (!activeRecon || !activeRecon.results || activeRecon.results.length === 0) {
            return "No reconciliation session is currently active. Please upload CSV records or click **'Load Demo'** first.";
        }

        const stats = activeRecon.statistics;
        const results = activeRecon.results;

        // Query: Summary / Health / Overview
        if (q.includes("summary") || q.includes("overview") || q.includes("health") || q.includes("kpi")) {
            return `### Executive Reconciliation Summary
- **Total Processed:** ${stats.totalProcessedRows} records
- **Matched:** ${stats.matchedCount} (${stats.matchPercentage}% accuracy)
- **Mismatches:** ${stats.amountMismatchCount + stats.dateMismatchCount}
- **Unmatched Entries:** ${stats.totalUnmatchedCount}
- **Total Discrepancy:** **${Settings.formatCurrency(stats.totalDiscrepancyAmount)}**
- **Net Variance:** ${stats.netDiscrepancy >= 0 ? "+" : ""}${Settings.formatCurrency(stats.netDiscrepancy)}`;
        }

        // Query: Largest / Maximum Discrepancy
        if (q.includes("largest") || q.includes("max") || q.includes("highest") || q.includes("leakage")) {
            const sorted = [...results].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
            const top = sorted[0];
            if (!top || Math.abs(top.difference) === 0) {
                return "All transactions are fully balanced with zero discrepancy!";
            }
            return `**Highest Discrepancy Transaction:**
- **ID:** \`${top.transactionId}\`
- **Status:** ${top.statusLabel}
- **Variance:** **${Settings.formatCurrency(Math.abs(top.difference))}** (Bank: ${Settings.formatCurrency(top.bankAmount)} vs Company: ${Settings.formatCurrency(top.companyAmount)})
- **AI Diagnosis:** ${explainAnomaly(top)}`;
        }

        // Query: Duplicates
        if (q.includes("duplicate")) {
            const dups = results.filter(r => r.status === "duplicate" || r.totalOccurrences > 1);
            if (dups.length === 0) {
                return "Good news! No duplicate transaction IDs were detected in your source files.";
            }
            return `Detected **${stats.duplicateCount} duplicate transaction ID(s)** representing ${dups.length} total occurrences. Immediate investigation recommended for vendor double-billing risk.`;
        }

        // Query: Specific Transaction ID (e.g., TXN003, TXN001)
        const txnMatch = q.match(/txn\w*/i);
        if (txnMatch) {
            const targetId = txnMatch[0].toUpperCase();
            const item = results.find(r => r.transactionId.toUpperCase() === targetId);
            if (item) {
                return `**Audit Analysis for \`${item.transactionId}\`:**
- **Status:** ${item.statusLabel}
- **Bank Amount:** ${item.bankAmount !== null ? Settings.formatCurrency(item.bankAmount) : "N/A"}
- **Company Amount:** ${item.companyAmount !== null ? Settings.formatCurrency(item.companyAmount) : "N/A"}
- **Variance:** ${item.difference !== 0 ? Settings.formatCurrency(item.difference) : "Zero (Exact Match)"}
- **AI Root Cause:** ${explainAnomaly(item)}`;
            } else {
                return `Transaction ID \`${targetId}\` was not found in the active reconciliation batch.`;
            }
        }

        // Query: Missing or Unmatched
        if (q.includes("missing") || q.includes("unmatched")) {
            return `We found **${stats.unmatchedBankCount} records** appearing only in the Bank Statement, and **${stats.unmatchedCompanyCount} records** appearing only in Company Books. Review these in the Transactions tab by selecting the "Unmatched" filter.`;
        }

        // Default Help
        return `I am your ReconcileX Financial Copilot. You can ask me:
- *"Summarize reconciliation health"*
- *"What is our largest financial leakage?"*
- *"Explain TXN003"*
- *"Check for duplicate payments"*
- *"Show unrecorded bank charges"*`;
    }

    return {
        jaroWinkler,
        calculateDescriptionMatchScore,
        explainAnomaly,
        processQuery
    };
})();
