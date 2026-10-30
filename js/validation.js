/**
 * ReconcileX - Data Validation Engine
 * Validates CSV structure, headers, row integrity, types, amounts, and dates.
 */

const Validation = (() => {
    "use strict";

    const REQUIRED_HEADERS = ["transaction_id", "date", "amount", "description"];
    
    // Comprehensive real-world financial header aliases for global bank statements & ERP systems
    const HEADER_ALIASES = {
        transaction_id: [
            "transaction_id", "transactionid", "txnid", "txn_id", "id", "trans_id",
            "bank_reference", "bank_ref", "bank_ref_no", "bank_txn_id",
            "reference_id", "ref_id", "ref_no", "ref_num", "reference_number", "reference",
            "cheque_no", "chq_no", "chq_ref_no", "cheque_ref_no", "utr", "utr_no",
            "transaction_no", "txn_no", "trans_no", "journal_no", "doc_no", "document_no",
            "voucher_no", "voucher", "bill_no", "invoice_no", "order_id", "order_no",
            "sr_no", "s_no", "seq_no", "no"
        ],
        date: [
            "date", "transaction_date", "txn_date", "trans_date", "val_date", "value_date",
            "posting_date", "post_date", "tran_date", "booking_date", "entry_date",
            "statement_date", "time", "timestamp"
        ],
        amount: [
            "amount", "txn_amount", "transaction_amount", "amt", "value", "net_amount",
            "total", "total_amount", "sum", "debit", "credit", "withdrawal", "deposit",
            "withdrawal_amt", "deposit_amt", "withdrawal_amount", "deposit_amount",
            "dr", "cr", "paid_out", "paid_in", "outflow", "inflow", "payment", "receipt",
            "money_out", "money_in"
        ],
        description: [
            "description", "desc", "particulars", "narration", "details", "memo",
            "remarks", "transaction_remarks", "payee", "beneficiary", "party",
            "account_name", "note", "notes", "comment", "comments", "message"
        ],
        debit: [
            "debit", "withdrawal", "withdrawal_amt", "withdrawal_amount", "dr",
            "paid_out", "outflow", "money_out", "debit_amount", "dr_amt"
        ],
        credit: [
            "credit", "deposit", "deposit_amt", "deposit_amount", "cr",
            "paid_in", "inflow", "money_in", "credit_amount", "cr_amt"
        ],
        reference_number: [
            "reference_number", "reference", "ref_no", "ref", "ref_number",
            "cheque_no", "chq_no", "chq_ref_no", "utr", "utr_no", "utr_number"
        ]
    };

    /**
     * Map raw CSV headers to standard internal field names
     * Handles single amount columns or split Debit / Credit columns, and tolerates arbitrary extra columns.
     * @param {string[]} rawHeaders 
     * @returns {{ mappedHeaders: Object, missingHeaders: string[], extraHeaders: string[] }}
     */
    function mapHeaders(rawHeaders) {
        if (!rawHeaders || rawHeaders.length === 0) {
            return { mapped: {}, missing: ["date", "amount"], extraHeaders: [] };
        }

        const cleanHeaders = rawHeaders.map(h => 
            String(h || "").trim().toLowerCase().replace(/[\(\)₹$,£€\s\-_.]+/g, "_").replace(/^_+|_+$/g, "")
        );
        const mapped = {};
        const missing = [];
        const matchedIndices = new Set();

        // 1. Map known financial concepts using aliases
        for (const [standardKey, aliases] of Object.entries(HEADER_ALIASES)) {
            let foundIndex = -1;
            for (const alias of aliases) {
                // Exact match first
                foundIndex = cleanHeaders.findIndex((ch, idx) => !matchedIndices.has(idx) && ch === alias);
                if (foundIndex !== -1) break;
            }
            if (foundIndex === -1) {
                // Substring containment match
                for (const alias of aliases) {
                    foundIndex = cleanHeaders.findIndex((ch, idx) => !matchedIndices.has(idx) && (ch.includes(alias) || alias.includes(ch)));
                    if (foundIndex !== -1) break;
                }
            }
            if (foundIndex !== -1) {
                mapped[standardKey] = rawHeaders[foundIndex];
                matchedIndices.add(foundIndex);
            }
        }

        // 2. Identify and preserve all extra columns
        const extraHeaders = rawHeaders.filter((_, idx) => !matchedIndices.has(idx));

        // 3. Resolve Amount from split Debit / Credit columns if direct "amount" is not present
        if (!mapped.amount) {
            if (mapped.debit && mapped.credit) {
                mapped.amount = mapped.debit; // will check both debit and credit during row iteration
            } else if (mapped.debit) {
                mapped.amount = mapped.debit;
            } else if (mapped.credit) {
                mapped.amount = mapped.credit;
            } else {
                missing.push("amount");
            }
        }

        // 4. Resolve Date
        if (!mapped.date) {
            missing.push("date");
        }

        // 5. Transaction ID and Description are gracefully defaulted if not explicitly provided
        if (!mapped.transaction_id && mapped.reference_number) {
            mapped.transaction_id = mapped.reference_number;
        }

        return { mapped, missing, extraHeaders };
    }

    /**
     * Validate date string (supports YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD, etc.)
     * Returns standard YYYY-MM-DD if valid, or null if invalid
     * @param {string} dateStr 
     * @returns {string|null}
     */
    function normalizeDate(dateStr) {
        if (!dateStr) return null;
        const trimmed = String(dateStr).trim();

        // Standard ISO YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) return trimmed;
        }

        // DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyMatch) {
            const day = dmyMatch[1].padStart(2, "0");
            const month = dmyMatch[2].padStart(2, "0");
            const year = dmyMatch[3];
            const iso = `${year}-${month}-${day}`;
            const d = new Date(iso);
            if (!isNaN(d.getTime())) return iso;
        }

        // General Date parse fallback
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, "0");
            const day = String(parsed.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        }

        return null;
    }

    /**
     * Normalize amount (removes currency symbols, commas, spaces)
     * @param {any} amountVal 
     * @returns {number|null}
     */
    function normalizeAmount(amountVal) {
        if (amountVal === null || amountVal === undefined || amountVal === "") return null;
        if (typeof amountVal === "number") return isFinite(amountVal) ? Math.round(amountVal * 100) / 100 : null;

        const cleaned = String(amountVal)
            .replace(/[₹$,£€¥\s]/g, "")
            .replace(/,/g, "");

        const num = parseFloat(cleaned);
        if (!isFinite(num) || isNaN(num)) return null;
        return Math.round(num * 100) / 100;
    }

    /**
     * Validate and sanitize parsed CSV rows
     * @param {Array<Object>} rows 
     * @param {string[]} rawHeaders 
     * @param {string} fileLabel "Bank Statement" | "Company Records"
     * @returns {{ valid: boolean, validRows: Array, errors: string[], warnings: string[], invalidRowCount: number }}
     */
    function validateDataset(rows, rawHeaders, fileLabel = "File") {
        const errors = [];
        const warnings = [];
        const validRows = [];
        let invalidRowCount = 0;

        if (!rows || rows.length === 0) {
            errors.push(`${fileLabel} is empty. No transaction records found.`);
            return { valid: false, validRows: [], errors, warnings, invalidRowCount: 0 };
        }

        const { mapped, missing, extraHeaders } = mapHeaders(rawHeaders);

        if (missing.length > 0) {
            errors.push(`${fileLabel} is missing required column(s): ${missing.join(", ")}. Required columns are: ${REQUIRED_HEADERS.join(", ")}.`);
            return { valid: false, validRows: [], errors, warnings, invalidRowCount: rows.length };
        }

        rows.forEach((row, index) => {
            const rowNumber = index + 2; // +1 for header, +1 for 1-based index
            const rawId = mapped.transaction_id ? row[mapped.transaction_id] : "";
            const rawDate = mapped.date ? row[mapped.date] : "";
            const rawAmount = mapped.amount ? row[mapped.amount] : "";
            const rawDesc = mapped.description ? row[mapped.description] : "";
            const rawRef = mapped.reference_number ? row[mapped.reference_number] : "";

            // Check if row is completely empty
            const values = Object.values(row).map(v => String(v || "").trim()).filter(Boolean);
            if (values.length === 0) return; // ignore trailing empty rows

            // Auto-resolve transaction ID: explicit ID -> reference/cheque -> auto-generated sequential ID
            let txnId = String(rawId || "").trim();
            if (!txnId && rawRef) txnId = String(rawRef).trim();
            if (!txnId) {
                const prefix = fileLabel.toLowerCase().includes("bank") ? "BNK" : "CMP";
                txnId = `${prefix}-${String(index + 1).padStart(4, "0")}`;
            }

            // Auto-resolve amount: supports single amount column OR split Debit / Credit columns
            let cleanAmount = null;
            if (mapped.debit && mapped.credit) {
                const dr = normalizeAmount(row[mapped.debit]);
                const cr = normalizeAmount(row[mapped.credit]);
                if (dr !== null && Math.abs(dr) > 0) cleanAmount = Math.abs(dr);
                else if (cr !== null && Math.abs(cr) > 0) cleanAmount = Math.abs(cr);
                else if (dr !== null) cleanAmount = Math.abs(dr);
                else if (cr !== null) cleanAmount = Math.abs(cr);
            } else if (mapped.debit && row[mapped.debit] !== undefined && row[mapped.debit] !== "") {
                const dr = normalizeAmount(row[mapped.debit]);
                if (dr !== null) cleanAmount = Math.abs(dr);
            } else if (mapped.credit && row[mapped.credit] !== undefined && row[mapped.credit] !== "") {
                const cr = normalizeAmount(row[mapped.credit]);
                if (cr !== null) cleanAmount = Math.abs(cr);
            } else {
                cleanAmount = normalizeAmount(rawAmount);
            }

            if (cleanAmount === null || cleanAmount < 0) {
                warnings.push(`Row ${rowNumber} (${txnId}): Invalid amount "${rawAmount}". Must be a non-negative number.`);
                invalidRowCount++;
                return;
            }

            const cleanDate = normalizeDate(rawDate);
            if (!cleanDate) {
                warnings.push(`Row ${rowNumber} (${txnId}): Invalid date format "${rawDate}". Expected YYYY-MM-DD.`);
                invalidRowCount++;
                return;
            }

            const cleanDesc = String(rawDesc || "").trim() || `${fileLabel} Transaction #${index + 1}`;
            const cleanRef = String(rawRef || "").trim();

            // Preserve all extra columns alongside standard reconciliation fields
            const validRecord = {
                ...row,
                transaction_id: txnId,
                date: cleanDate,
                amount: cleanAmount,
                description: cleanDesc,
                reference_number: cleanRef,
                _rowNumber: rowNumber
            };

            validRows.push(validRecord);
        });

        if (validRows.length === 0) {
            errors.push(`${fileLabel} does not contain any valid transaction rows.`);
        }

        return {
            valid: errors.length === 0 && validRows.length > 0,
            validRows,
            errors,
            warnings,
            invalidRowCount
        };
    }

    return {
        REQUIRED_HEADERS,
        mapHeaders,
        normalizeDate,
        normalizeAmount,
        validateDataset
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = Validation;
}
