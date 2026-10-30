/**
 * ReconcileX - CSV Reader & File Upload Module
 * Integrates PapaParse for robust CSV parsing, handles quoted fields, commas inside descriptions,
 * drag-and-drop interactions, and provides downloadable templates and demo datasets.
 */

const CSVReader = (() => {
    "use strict";

    // Built-in Demo Data for immediate hackathon judge demonstration
    const DEMO_BANK_CSV = `transaction_id,date,amount,description,reference_number
TXN001,2026-10-30,5000.00,Client Retainer Fee,REF-1001
TXN002,2026-10-30,2500.00,Cloud Infrastructure AWS,REF-1002
TXN003,2026-10-30,3000.00,Office Supplies Global,REF-1003
TXN004,2026-10-29,1500.00,Software Subscription Slack,REF-1004
TXN006,2026-10-28,12500.00,Consulting Services Acme,REF-1006
TXN007,2026-10-28,450.00,"Courier Logistics, Express Delivery",REF-1007
TXN008,2026-10-27,8200.00,Marketing Campaign Ads,REF-1008
TXN009,2026-10-26,1800.00,Utility Electric Bill,REF-1009
TXN010,2026-10-25,9500.00,Hardware Equipment Server,REF-1010
TXN012,2026-10-24,3400.00,Legal Consultancy Audit,REF-1012
TXN012,2026-10-24,3400.00,"Legal Consultancy Audit (DUPLICATE CHARGE)",REF-1012-DUP`;

    const DEMO_COMPANY_CSV = `transaction_id,date,amount,description,reference_number
TXN001,2026-10-30,5000.00,Client Retainer Fee,REF-1001
TXN002,2026-10-30,2500.00,Cloud Infrastructure AWS,REF-1002
TXN003,2026-10-30,2800.00,Office Supplies Global,REF-1003
TXN005,2026-10-30,4000.00,Legal Advisory Retainer,REF-1005
TXN006,2026-10-25,12500.00,Consulting Services Acme,REF-1006
TXN007,2026-10-28,450.00,"Courier Logistics, Express Delivery",REF-1007
TXN008,2026-10-27,8200.00,Marketing Campaign Ads,REF-1008
TXN009,2026-10-23,1750.00,Utility Electric Bill,REF-1009
TXN011,2026-10-25,6200.00,Contractor Stipend Dev,REF-1011
TXN012,2026-10-24,3400.00,Legal Consultancy Audit,REF-1012`;

    /**
     * Parse CSV string using PapaParse (or fallback manual parser if offline)
     * @param {string} csvText 
     * @returns {Promise<{ data: Array<Object>, headers: string[] }>}
     */
    function parseCSVText(csvText) {
        return new Promise((resolve, reject) => {
            if (!csvText || !csvText.trim()) {
                return reject(new Error("The uploaded file is empty."));
            }

            // Check if PapaParse is available
            if (typeof Papa !== "undefined") {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: "greedy",
                    transformHeader: h => String(h || "").trim(),
                    complete: results => {
                        if (results.errors && results.errors.length > 0) {
                            // Filter non-fatal errors
                            const fatalErrors = results.errors.filter(e => e.type !== "FieldMismatch");
                            if (fatalErrors.length > 0) {
                                return reject(new Error(`CSV Parsing error: ${fatalErrors[0].message}`));
                            }
                        }
                        const headers = results.meta.fields || [];
                        resolve({ data: results.data, headers });
                    },
                    error: err => reject(err)
                });
            } else {
                // Robust fallback CSV parser handling quotes and commas
                try {
                    const parsed = manualCSVParser(csvText);
                    resolve(parsed);
                } catch (e) {
                    reject(e);
                }
            }
        });
    }

    /**
     * Fallback standard-compliant CSV parser if PapaParse CDN fails to load
     * @param {string} text 
     */
    function manualCSVParser(text) {
        const lines = [];
        let currentRow = [];
        let currentField = "";
        let insideQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentField += '"';
                    i++; // skip escaped quote
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentRow.push(currentField.trim());
                currentField = "";
            } else if ((char === '\r' || char === '\n') && !insideQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                currentRow.push(currentField.trim());
                if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
                    lines.push(currentRow);
                }
                currentRow = [];
                currentField = "";
            } else {
                currentField += char;
            }
        }
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            lines.push(currentRow);
        }

        if (lines.length < 2) {
            throw new Error("File must contain at least a header row and one data row.");
        }

        const headers = lines[0].map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i];
            if (row.length === 0 || (row.length === 1 && !row[0])) continue;
            const obj = {};
            headers.forEach((h, idx) => {
                obj[h] = row[idx] !== undefined ? row[idx] : "";
            });
            data.push(obj);
        }

        return { data, headers };
    }

    /**
     * Read a browser File object using FileReader
     * @param {File} file 
     * @returns {Promise<string>}
     */
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error("No file provided."));
            if (!file.name.toLowerCase().endsWith(".csv")) {
                return reject(new Error(`Invalid file "${file.name}". Please upload a valid .csv file.`));
            }
            if (file.size === 0) {
                return reject(new Error(`The file "${file.name}" is empty (0 bytes).`));
            }

            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
            reader.readAsText(file, "UTF-8");
        });
    }

    /**
     * Format byte size to human readable string (KB / MB)
     * @param {number} bytes 
     * @returns {string}
     */
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    /**
     * Trigger browser download of sample CSV template
     * @param {'bank' | 'company'} templateType 
     */
    function downloadSampleTemplate(templateType) {
        let content = "";
        let filename = "";

        if (templateType === "bank") {
            filename = "ReconcileX_Bank_Statement_Template.csv";
            content = "transaction_id,date,amount,description,reference_number\r\n" +
                "TXN001,2026-10-30,5000.00,Client Retainer Fee,REF-1001\r\n" +
                "TXN002,2026-10-30,2500.00,Cloud Infrastructure AWS,REF-1002\r\n" +
                "TXN003,2026-10-30,3000.00,Office Supplies Global,REF-1003\r\n" +
                "TXN004,2026-10-29,1500.00,Software Subscription Slack,REF-1004\r\n";
        } else {
            filename = "ReconcileX_Company_Records_Template.csv";
            content = "transaction_id,date,amount,description,reference_number\r\n" +
                "TXN001,2026-10-30,5000.00,Client Retainer Fee,REF-1001\r\n" +
                "TXN002,2026-10-30,2500.00,Cloud Infrastructure AWS,REF-1002\r\n" +
                "TXN003,2026-10-30,2800.00,Office Supplies Global,REF-1003\r\n" +
                "TXN005,2026-10-30,4000.00,Legal Advisory Retainer,REF-1005\r\n";
        }

        const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return {
        DEMO_BANK_CSV,
        DEMO_COMPANY_CSV,
        parseCSVText,
        readFileAsText,
        formatFileSize,
        downloadSampleTemplate
    };
})();
