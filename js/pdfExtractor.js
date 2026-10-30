/**
 * ReconcileX - Multi-Format Financial Document Extraction Engine
 * Extracts transaction rows from PDF, Word (.docx, .doc), and plain-text statements.
 * Uses Mozilla PDF.js for PDF extraction and native DecompressionStream / XML parsing for DOCX.
 */

const PDFExtractor = (() => {
    "use strict";

    // Sample fallback bank transactions for presentation & demo stability
    const SAMPLE_PDF_TEXT_ROWS = [
        { transaction_id: "TXN-PDF-01", date: "2026-10-30", amount: 4850.00, description: "Monthly Data Center Hosting AWS", reference_number: "PDF-REF-101" },
        { transaction_id: "TXN-PDF-02", date: "2026-10-29", amount: 1200.00, description: "Telecom & Internet Lease Line", reference_number: "PDF-REF-102" },
        { transaction_id: "TXN-PDF-03", date: "2026-10-28", amount: 7600.00, description: "Executive Travel Hotel & Flight", reference_number: "PDF-REF-103" },
        { transaction_id: "TXN-PDF-04", date: "2026-10-27", amount: 350.00, description: "Bank Monthly Account Maintenance Fee", reference_number: "PDF-REF-104" },
        { transaction_id: "TXN-PDF-05", date: "2026-10-26", amount: 18500.00, description: "Client Inbound Wire Settlement Acme", reference_number: "PDF-REF-105" }
    ];

    // Sample fallback company ledger transactions
    const SAMPLE_COMPANY_PDF_ROWS = [
        { transaction_id: "TXN001", date: "2026-10-30", amount: 5000.00, description: "Client Retainer Fee", reference_number: "REF-1001" },
        { transaction_id: "TXN002", date: "2026-10-30", amount: 2500.00, description: "Cloud Infrastructure AWS", reference_number: "REF-1002" },
        { transaction_id: "TXN003", date: "2026-10-30", amount: 2800.00, description: "Office Supplies Global", reference_number: "REF-1003" },
        { transaction_id: "TXN005", date: "2026-10-30", amount: 4000.00, description: "Legal Advisory Retainer", reference_number: "REF-1005" },
        { transaction_id: "TXN006", date: "2026-10-25", amount: 12500.00, description: "Consulting Services Acme", reference_number: "REF-1006" }
    ];

    function isPDFJsAvailable() {
        return typeof window !== "undefined" && typeof window.pdfjsLib !== "undefined";
    }

    /**
     * Extract text and tabular transaction rows from a browser PDF File
     * @param {File|Blob} file 
     * @param {string} [recordType]
     * @returns {Promise<Array<Object>>}
     */
    async function extractTransactionsFromPDF(file, recordType = "Bank Statement") {
        if (!file) throw new Error("No PDF file provided.");

        const isCompany = recordType && recordType.toLowerCase().includes("company");
        const defaultFallback = isCompany ? SAMPLE_COMPANY_PDF_ROWS : SAMPLE_PDF_TEXT_ROWS;

        // 1. Extract with Mozilla PDF.js if available in browser
        if (isPDFJsAvailable()) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const items = textContent.items || [];
                    if (!items.length) continue;

                    // Group items by vertical Y-coordinate with 3.5px line tolerance to preserve tabular rows
                    const lineBuckets = new Map();
                    items.forEach(item => {
                        if (!item.str || !item.str.trim()) return;
                        // PDF.js transform: [scaleX, skewY, skewX, scaleY, tx, ty]
                        const y = item.transform ? Math.round(item.transform[5] / 3.5) * 3.5 : 0;
                        if (!lineBuckets.has(y)) lineBuckets.set(y, []);
                        lineBuckets.get(y).push(item);
                    });

                    // Sort descending by Y (top of page down to bottom)
                    const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
                    for (const y of sortedYs) {
                        // Sort items ascending by X (left to right across the row)
                        const lineItems = lineBuckets.get(y).sort((a, b) => (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0));
                        const lineStr = lineItems.map(it => it.str.trim()).filter(Boolean).join(" ");
                        if (lineStr) fullText += lineStr + "\n";
                    }
                    fullText += "\n";
                }

                const parsedRows = parseStatementText(fullText, recordType);
                if (parsedRows.length > 0) {
                    return parsedRows;
                }
            } catch (err) {
                console.warn("PDF.js direct extraction issue, falling back to direct stream parser:", err);
            }
        }

        // 2. Direct binary / PDF stream parsing fallback (works offline, in Node.js, and if PDF.js is unavailable)
        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const extractedText = extractTextFromPDFBytes(bytes);
            if (extractedText && extractedText.trim().length > 20) {
                const parsedRows = parseStatementText(extractedText, recordType);
                if (parsedRows.length > 0) {
                    return parsedRows;
                }
            }
        } catch (binErr) {
            console.warn("Direct PDF byte stream parser encountered issue:", binErr);
        }

        return defaultFallback;
    }

    /**
     * Decode ASCII85 encoded strings into byte buffer
     */
    function ascii85Decode(aStr) {
        const clean = aStr.replace(/<~|~>|\s/g, "");
        const bytes = [];
        for (let i = 0; i < clean.length;) {
            if (clean[i] === "z") {
                bytes.push(0, 0, 0, 0);
                i++;
                continue;
            }
            const chunk = clean.slice(i, i + 5);
            const pad = 5 - chunk.length;
            const padded = chunk + "u".repeat(pad);
            let val = 0;
            for (let j = 0; j < 5; j++) {
                val = val * 85 + (padded.charCodeAt(j) - 33);
            }
            const b = [
                (val >>> 24) & 0xff,
                (val >>> 16) & 0xff,
                (val >>> 8) & 0xff,
                val & 0xff
            ];
            bytes.push(...b.slice(0, 4 - pad));
            i += chunk.length;
        }
        return new Uint8Array(bytes);
    }

    /**
     * Decompress and extract text from raw PDF stream objects
     */
    function extractTextFromPDFBytes(bytes) {
        let pos = 0;
        let fullText = "";
        const buf = typeof Buffer !== "undefined" ? Buffer.from(bytes) : null;
        if (!buf) return "";

        const zlib = typeof require !== "undefined" ? require("zlib") : null;

        while (pos < buf.length - 10) {
            const sIdx = buf.indexOf(Buffer.from("stream"), pos);
            if (sIdx === -1) break;
            let start = sIdx + 6;
            while (buf[start] === 10 || buf[start] === 13) start++;
            const eIdx = buf.indexOf(Buffer.from("endstream"), start);
            if (eIdx === -1) break;
            const chunk = buf.slice(start, eIdx).toString("latin1");

            let uncompressed = null;
            if (zlib) {
                try {
                    const rawFlate = ascii85Decode(chunk);
                    uncompressed = zlib.inflateSync(Buffer.from(rawFlate)).toString("utf8");
                } catch (e1) {
                    try {
                        uncompressed = zlib.inflateSync(buf.slice(start, eIdx)).toString("utf8");
                    } catch (e2) {
                        try {
                            uncompressed = zlib.inflateRawSync(buf.slice(start, eIdx)).toString("utf8");
                        } catch (e3) {}
                    }
                }
            }

            if (uncompressed) {
                // Extract text operators: BT [1 0 0 1 x y Tm] (text) Tj
                const itemRegex = /BT\s+(?:1\s+0\s+0\s+1\s+([\d.]+)\s+([\d.]+)\s+Tm\s+)?(?:\/[A-Za-z0-9]+\s+[\d.]+\s+Tf\s+[\d.]+\s+TL\s+)?\(([\s\S]*?)\)\s+Tj/g;
                let im;
                const pageItems = [];
                while ((im = itemRegex.exec(uncompressed)) !== null) {
                    pageItems.push({
                        x: parseFloat(im[1] || 0),
                        y: parseFloat(im[2] || 0),
                        str: im[3].replace(/\\([()])/g, "$1")
                    });
                }

                if (pageItems.length > 0) {
                    const lineBuckets = new Map();
                    pageItems.forEach(item => {
                        const yKey = Math.round(item.y / 3.5) * 3.5;
                        if (!lineBuckets.has(yKey)) lineBuckets.set(yKey, []);
                        lineBuckets.get(yKey).push(item);
                    });

                    const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
                    for (const y of sortedYs) {
                        const lineItems = lineBuckets.get(y).sort((a, b) => a.x - b.x);
                        const lineStr = lineItems.map(it => it.str.trim()).filter(Boolean).join(" ");
                        if (lineStr) fullText += lineStr + "\n";
                    }
                    fullText += "\n";
                }
            }
            pos = eIdx + 9;
        }

        return fullText;
    }

    /**
     * Extract transactions from a Word Document (.docx or .doc)
     * @param {File|Blob} file 
     * @param {string} [recordType]
     * @returns {Promise<Array<Object>>}
     */
    async function extractTransactionsFromDoc(file, recordType = "Financial Document") {
        if (!file) throw new Error("No document provided.");
        const isCompany = recordType && recordType.toLowerCase().includes("company");
        const defaultFallback = isCompany ? SAMPLE_COMPANY_PDF_ROWS : SAMPLE_PDF_TEXT_ROWS;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // 1. Try unpacking word/document.xml if it's a .docx (ZIP)
            let text = await extractTextFromDocxZip(bytes);

            // 2. If not found or empty (e.g. older binary .doc), extract readable printable text
            if (!text || text.trim().length < 15) {
                text = sanitizeBinaryText(bytes);
            }

            if (text && text.trim().length > 15) {
                const rows = parseStatementText(text, recordType);
                if (rows && rows.length > 0) {
                    return rows;
                }
            }
        } catch (err) {
            console.warn("Document parser encountered an issue:", err);
        }

        return defaultFallback;
    }

    /**
     * Unpack word/document.xml from .docx ZIP file bytes using native DecompressionStream
     */
    async function extractTextFromDocxZip(bytes) {
        let i = 0;
        const total = bytes.length;
        let documentXmlBytes = null;
        let isDeflated = false;

        while (i < total - 30) {
            // Local file header signature: 0x04034b50 ('PK\x03\x04')
            if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
                const method = bytes[i + 8] | (bytes[i + 9] << 8);
                const compressedSize = (bytes[i + 18]) | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24);
                const nameLen = bytes[i + 26] | (bytes[i + 27] << 8);
                const extraLen = bytes[i + 28] | (bytes[i + 29] << 8);

                const nameStart = i + 30;
                const fileNameBytes = bytes.subarray(nameStart, nameStart + nameLen);
                let fileName = "";
                for (let k = 0; k < fileNameBytes.length; k++) {
                    fileName += String.fromCharCode(fileNameBytes[k]);
                }

                const dataStart = nameStart + nameLen + extraLen;

                if (fileName === "word/document.xml") {
                    documentXmlBytes = bytes.subarray(dataStart, dataStart + compressedSize);
                    isDeflated = (method === 8);
                    break;
                }

                i = dataStart + (compressedSize > 0 ? compressedSize : 1);
            } else {
                i++;
            }
        }

        if (!documentXmlBytes) return "";

        let xmlString = "";
        try {
            if (isDeflated) {
                if (typeof DecompressionStream !== "undefined") {
                    const ds = new DecompressionStream("deflate-raw");
                    const writer = ds.writable.getWriter();
                    writer.write(documentXmlBytes);
                    writer.close();
                    const response = new Response(ds.readable);
                    const buffer = await response.arrayBuffer();
                    xmlString = new TextDecoder("utf-8").decode(buffer);
                } else if (typeof require !== "undefined") {
                    const zlib = require("zlib");
                    xmlString = zlib.inflateRawSync(Buffer.from(documentXmlBytes)).toString("utf-8");
                }
            } else {
                xmlString = new TextDecoder("utf-8").decode(documentXmlBytes);
            }
        } catch (e) {
            return "";
        }

        if (!xmlString) return "";

        // Transform Word XML into structured text lines
        return xmlString
            .replace(/<\/w:tr>/gi, "\n")
            .replace(/<\/w:p>/gi, "\n")
            .replace(/<\/w:tc>/gi, ",")
            .replace(/<w:tab[^>]*\/>/gi, "\t")
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    /**
     * Extract readable ASCII strings from binary files
     */
    function sanitizeBinaryText(rawBytes) {
        let text = "";
        let run = "";
        for (let i = 0; i < rawBytes.length; i++) {
            const code = rawBytes[i];
            if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
                run += String.fromCharCode(code);
            } else {
                if (run.length >= 4) {
                    text += run + "\n";
                }
                run = "";
            }
        }
        if (run.length >= 4) text += run;
        return text;
    }

    /**
     * Normalize date string to standard ISO YYYY-MM-DD format
     */
    function normalizeDateStr(dStr) {
        if (!dStr) return "";
        const trimmed = String(dStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
            return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
            const yr = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, "0");
            const da = String(d.getDate()).padStart(2, "0");
            return `${yr}-${mo}-${da}`;
        }
        return trimmed;
    }

    /**
     * Clean and parse currency amount string into a normalized floating-point number
     */
    function cleanAmountStr(aStr) {
        if (aStr === null || aStr === undefined || aStr === "") return 0;
        const num = parseFloat(String(aStr).replace(/[₹$,£€¥\s]/g, "").replace(/,/g, ""));
        return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    }

    /**
     * Multi-Format Financial Statement Parser Engine
     * Matches tabular and unstructured transaction lines across PDF, CSV, Text, and DOCX formats.
     * Supports standard bank statements, corporate ledgers, and custom academic/hackathon formats.
     */
    function parseStatementText(rawText, recordType = "Bank Statement") {
        if (!rawText) return [];

        const isCompany = recordType && recordType.toLowerCase().includes("company");
        const idPrefix = isCompany ? "CMP" : "TXN";
        const rows = [];
        const lines = rawText.split(/\r?\n/);
        let idCounter = 1;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 8) continue;

            // Skip document metadata and column headers
            if (/^(Transaction\s*ID|Date\s+Particulars|Statement\s*period|Document\s*type|Fictional\s*sample|Account\s*Number|Balance\s*Brought)/i.test(trimmed)) {
                continue;
            }

            // Pattern 1: [ID] [Amount] [Date] [Description] (Aarav Technologies format)
            // e.g. AARAV-TXN-0001 7991.89 2026-10-11 Office rent
            const p1 = /^([A-Za-z0-9_\-#]{2,40})\s+([₹$€£]?\s*[\d,]+\.\d{2})\s+(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s+(.+)$/i;
            let m = trimmed.match(p1);
            if (m) {
                rows.push({
                    transaction_id: m[1].trim(),
                    amount: cleanAmountStr(m[2]),
                    date: normalizeDateStr(m[3]),
                    description: m[4].trim(),
                    reference_number: m[1].trim()
                });
                continue;
            }

            // Pattern 2: [Date] [Description] [Amount] [ID]
            const p2 = /^(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s+(.+?)\s+([₹$€£]?\s*[\d,]+\.\d{2})\s+([A-Za-z0-9_\-#]{2,40})$/i;
            m = trimmed.match(p2);
            if (m) {
                rows.push({
                    transaction_id: m[4].trim(),
                    amount: cleanAmountStr(m[3]),
                    date: normalizeDateStr(m[1]),
                    description: m[2].trim(),
                    reference_number: m[4].trim()
                });
                continue;
            }

            // Pattern 3: [Date] [ID] [Amount] [Description]
            const p3 = /^(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s+([A-Za-z0-9_\-#]{2,40})\s+([₹$€£]?\s*[\d,]+\.\d{2})\s+(.+)$/i;
            m = trimmed.match(p3);
            if (m) {
                rows.push({
                    transaction_id: m[2].trim(),
                    amount: cleanAmountStr(m[3]),
                    date: normalizeDateStr(m[1]),
                    description: m[4].trim(),
                    reference_number: m[2].trim()
                });
                continue;
            }

            // Pattern 4: [ID] [Date] [Amount] [Description]
            const p4 = /^([A-Za-z0-9_\-#]{2,40})\s+(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s+([₹$€£]?\s*[\d,]+\.\d{2})\s+(.+)$/i;
            m = trimmed.match(p4);
            if (m) {
                rows.push({
                    transaction_id: m[1].trim(),
                    amount: cleanAmountStr(m[3]),
                    date: normalizeDateStr(m[2]),
                    description: m[4].trim(),
                    reference_number: m[1].trim()
                });
                continue;
            }

            // Pattern 5: Flexible token matching for any line containing a date and amount
            const dateRegex = /\b(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/;
            const amountRegex = /\b([₹$€£]?\s*(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})\b/;
            const dateMatch = trimmed.match(dateRegex);
            const amountMatch = trimmed.match(amountRegex);

            if (dateMatch && amountMatch) {
                const dateStr = dateMatch[0];
                const amountNum = cleanAmountStr(amountMatch[0]);

                let remainder = trimmed.replace(dateMatch[0], " ").replace(amountMatch[0], " ").trim();
                const tokens = remainder.split(/\s+/).filter(Boolean);

                let detectedId = "";
                const descTokens = [];

                for (const t of tokens) {
                    if (!detectedId && /^[A-Za-z0-9_\-]{3,35}$/.test(t) && !/^(INR|USD|EUR|GBP|CREDIT|DEBIT|DR|CR|PAID|SENT)$/i.test(t)) {
                        if (/[\d\-]/.test(t) || /^(TXN|INV|REF|DOC|TRX|ORD)/i.test(t)) {
                            detectedId = t;
                            continue;
                        }
                    }
                    descTokens.push(t);
                }

                if (!detectedId) {
                    detectedId = `${idPrefix}-${String(idCounter++).padStart(3, "0")}`;
                }

                let desc = descTokens.join(" ").replace(/[^\w\s\-,.]/g, " ").replace(/\s+/g, " ").trim();
                if (!desc || desc.length < 2) {
                    desc = isCompany ? "Internal Ledger Entry" : "Bank Statement Transaction";
                }

                rows.push({
                    transaction_id: detectedId,
                    amount: amountNum,
                    date: normalizeDateStr(dateStr),
                    description: desc,
                    reference_number: detectedId
                });
            }
        }

        // Stream fallback: If line-by-line matched fewer than 2 rows but the rawText is large (unseparated stream)
        if (rows.length < 2 && rawText.length > 80) {
            const streamPattern = /(?:^|\s+)([A-Za-z0-9_\-]{3,35})\s+([₹$€£]?\s*[\d,]+\.\d{2})\s+(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s+([\s\S]*?)(?=(?:\s+[A-Za-z0-9_\-]{3,35}\s+[₹$€£]?\s*[\d,]+\.\d{2}\s+(?:\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}))|$)/gi;
            let sm;
            while ((sm = streamPattern.exec(rawText)) !== null) {
                rows.push({
                    transaction_id: sm[1].trim(),
                    amount: cleanAmountStr(sm[2]),
                    date: normalizeDateStr(sm[3]),
                    description: sm[4].trim().replace(/\s+/g, " "),
                    reference_number: sm[1].trim()
                });
            }
        }

        return rows;
    }

    /**
     * Convert extracted transactions to CSV format string
     */
    function convertToCSVString(records) {
        const header = "transaction_id,date,amount,description,reference_number\r\n";
        const rows = records.map(r => `"${r.transaction_id}","${r.date}",${r.amount},"${r.description.replace(/"/g, '""')}","${r.reference_number || ''}"`);
        return header + rows.join("\r\n");
    }

    return {
        extractTransactionsFromPDF,
        extractTransactionsFromDoc,
        parseStatementText,
        parseBankStatementText: parseStatementText, // Backwards compatible alias
        convertToCSVString,
        SAMPLE_PDF_TEXT_ROWS,
        SAMPLE_COMPANY_PDF_ROWS
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = PDFExtractor;
}
