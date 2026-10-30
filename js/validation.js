/**
 * ReconcileX - Data Validation Engine
 * Validates CSV structure, headers, row integrity, types, amounts, and dates.
 */

const Validation = (() => {
    "use strict";

    const REQUIRED_HEADERS = ["transaction_id", "date", "amount", "description"];
    
    // Header alias mappings to tolerate slight naming variations in financial exports
    const HEADER_ALIASES = {
        transaction_id: ["transaction_id", "transactionid", "txnid", "txn_id", "id", "trans_id", "reference_id"],
        date: ["date", "transaction_date", "txn_date", "trans_date", "val_date", "posting_date"],
        amount: ["amount", "txn_amount", "transaction_amount", "amt", "value", "net_amount"],
        description: ["description", "desc", "particulars", "narration", "details", "memo"],
        reference_number: ["reference_number", "reference", "ref_no", "ref", "ref_number", "cheque_no"]
    };

    /**
     * Map raw CSV headers to standard internal field names
     * @param {string[]} rawHeaders 
     * @returns {{ mappedHeaders: Object, missingHeaders: string[] }}
     */
    function mapHeaders(rawHeaders) {
        const cleanHeaders = rawHeaders.map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, "_"));
        const mapped = {};
        const missing = [];

        for (const standardKey of REQUIRED_HEADERS) {
            const aliases = HEADER_ALIASES[standardKey] || [standardKey];
            let foundIndex = -1;

            for (const alias of aliases) {
                foundIndex = cleanHeaders.indexOf(alias);
                if (foundIndex !== -1) break;
            }

            if (foundIndex !== -1) {
                mapped[standardKey] = rawHeaders[foundIndex]; // original header name
            } else {
                missing.push(standardKey);
            }
        }

        // Optional headers
        for (const optKey of ["reference_number"]) {
            const aliases = HEADER_ALIASES[optKey];
            let foundIndex = -1;
            for (const alias of aliases) {
                foundIndex = cleanHeaders.indexOf(alias);
                if (foundIndex !== -1) break;
            }
            if (foundIndex !== -1) {
                mapped[optKey] = rawHeaders[foundIndex];
            }
        }

        return { mapped, missing };
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

        const { mapped, missing } = mapHeaders(rawHeaders);

        if (missing.length > 0) {
            errors.push(`${fileLabel} is missing required column(s): ${missing.join(", ")}. Required columns are: ${REQUIRED_HEADERS.join(", ")}.`);
            return { valid: false, validRows: [], errors, warnings, invalidRowCount: rows.length };
        }

        rows.forEach((row, index) => {
            const rowNumber = index + 2; // +1 for header, +1 for 1-based index
            const rawId = row[mapped.transaction_id];
            const rawDate = row[mapped.date];
            const rawAmount = row[mapped.amount];
            const rawDesc = row[mapped.description];
            const rawRef = mapped.reference_number ? row[mapped.reference_number] : "";

            // Check if row is completely empty
            const values = Object.values(row).map(v => String(v || "").trim()).filter(Boolean);
            if (values.length === 0) return; // ignore trailing empty rows

            const txnId = String(rawId || "").trim();
            if (!txnId) {
                warnings.push(`Row ${rowNumber}: Skipped because transaction_id is missing.`);
                invalidRowCount++;
                return;
            }

            const cleanAmount = normalizeAmount(rawAmount);
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

            const cleanDesc = String(rawDesc || "").trim() || "No description provided";
            const cleanRef = String(rawRef || "").trim();

            validRows.push({
                transaction_id: txnId,
                date: cleanDate,
                amount: cleanAmount,
                description: cleanDesc,
                reference_number: cleanRef,
                _rowNumber: rowNumber
            });
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
