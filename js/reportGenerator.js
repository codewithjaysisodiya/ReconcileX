/**
 * ReconcileX - Report Generator Module
 * Handles exporting reconciliation data to CSV (filtered and full) and
 * generates professional audit PDF reports using jsPDF and AutoTable.
 */

const ReportGenerator = (() => {
    "use strict";

    /**
     * Convert an array of transaction result objects to CSV string
     * @param {Array<Object>} records 
     * @returns {string}
     */
    function convertResultsToCSV(records) {
        const headers = [
            "Transaction ID",
            "Bank Amount",
            "Company Amount",
            "Variance (Bank - Company)",
            "Bank Date",
            "Company Date",
            "Date Difference (Days)",
            "Status",
            "Bank Description",
            "Company Description",
            "Bank Reference",
            "Company Reference",
            "Audit Notes"
        ];

        const rows = records.map(item => [
            item.transactionId,
            item.bankAmount !== null ? item.bankAmount : "",
            item.companyAmount !== null ? item.companyAmount : "",
            item.difference !== undefined ? item.difference : "",
            item.bankDate || "",
            item.companyDate || "",
            item.dateDiffDays !== null ? item.dateDiffDays : "",
            item.statusLabel,
            item.bankDescription || "",
            item.companyDescription || "",
            item.bankReference || "",
            item.companyReference || "",
            item.notes || ""
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(val => {
                const safe = String(val === null || val === undefined ? "" : val).replace(/"/g, '""');
                return `"${safe}"`;
            }).join(","))
            .join("\r\n");

        return "\uFEFF" + csvContent; // Add UTF-8 BOM
    }

    /**
     * Trigger browser file download
     * @param {string} content 
     * @param {string} filename 
     * @param {string} mimeType 
     */
    function triggerDownload(content, filename, mimeType = "text/csv;charset=utf-8;") {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Export all results to CSV
     * @param {Array<Object>} results 
     */
    function exportAllCSV(results) {
        if (!results || results.length === 0) return false;
        const csv = convertResultsToCSV(results);
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(csv, `ReconcileX_Complete_Reconciliation_${dateStr}.csv`);
        return true;
    }

    /**
     * Export only Mismatches (Amount or Date) to CSV
     * @param {Array<Object>} results 
     */
    function exportMismatchesCSV(results) {
        if (!results || results.length === 0) return false;
        const mismatches = results.filter(r => 
            r.status === "amount_mismatch" || 
            r.status === "date_mismatch" || 
            r.status === "multiple_issues"
        );
        const csv = convertResultsToCSV(mismatches);
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(csv, `ReconcileX_Mismatches_Only_${dateStr}.csv`);
        return true;
    }

    /**
     * Export only Unmatched records (Bank-only or Company-only) to CSV
     * @param {Array<Object>} results 
     */
    function exportUnmatchedCSV(results) {
        if (!results || results.length === 0) return false;
        const unmatched = results.filter(r => 
            r.status === "unmatched_bank" || 
            r.status === "unmatched_company"
        );
        const csv = convertResultsToCSV(unmatched);
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(csv, `ReconcileX_Unmatched_Records_${dateStr}.csv`);
        return true;
    }

    /**
     * Export only Duplicate transactions to CSV
     * @param {Array<Object>} results 
     */
    function exportDuplicatesCSV(results) {
        if (!results || results.length === 0) return false;
        const duplicates = results.filter(r => r.status === "duplicate" || r.totalOccurrences > 1);
        const csv = convertResultsToCSV(duplicates);
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(csv, `ReconcileX_Duplicates_Only_${dateStr}.csv`);
        return true;
    }

    /**
     * Generate and download professional executive PDF audit report
     * @param {Object} statistics 
     * @param {Array<Object>} results 
     * @param {Object} metadata 
     */
    function exportAuditPDF(statistics, results, metadata = {}) {
        if (!statistics || !results || results.length === 0) {
            alert("No reconciliation data available to generate PDF report.");
            return false;
        }

        // Verify jsPDF library availability
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) {
            alert("PDF Generation Library (jsPDF) is loading or unavailable. Please ensure internet access or use CSV Export.");
            return false;
        }

        try {
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const currSym = Settings.getCurrencySymbol();
            const dateGenerated = new Date().toLocaleString();

            // Header Banner
            doc.setFillColor(15, 23, 42); // #0f172a Dark navy
            doc.rect(0, 0, 210, 42, "F");

            // Brand Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(56, 189, 248); // #38bdf8 Cyan
            doc.text("ReconcileX", 14, 18);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184); // #94a3b8
            doc.text("Financial Transaction Reconciliation & Audit Report", 14, 25);
            doc.text(`Generated: ${dateGenerated}`, 14, 32);

            // Report Meta Badge
            doc.setFontSize(9);
            doc.setTextColor(203, 213, 225);
            doc.text(`Bank File: ${metadata.bankFileName || "Bank_Statement.csv"}`, 120, 18);
            doc.text(`Company File: ${metadata.companyFileName || "Company_Records.csv"}`, 120, 24);
            doc.text(`Status: Official Reconciliation Audit`, 120, 30);

            // Section: Executive Summary
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            doc.text("1. Executive Reconciliation Summary", 14, 52);

            // KPI Grid Boxes
            const kpiItems = [
                { label: "Total Transactions", val: String(statistics.totalProcessedRows) },
                { label: "Matched Records", val: String(statistics.matchedCount) },
                { label: "Unmatched Records", val: String(statistics.totalUnmatchedCount) },
                { label: "Amount / Date Mismatches", val: String(statistics.amountMismatchCount + statistics.dateMismatchCount) },
                { label: "Duplicate Records", val: String(statistics.duplicateCount) },
                { label: "Match Percentage", val: `${statistics.matchPercentage.toFixed(1)}%` },
                { label: "Total Discrepancy", val: Settings.formatCurrency(statistics.totalDiscrepancyAmount) },
                { label: "Net Ledger Variance", val: Settings.formatCurrency(statistics.netDiscrepancy) }
            ];

            let startX = 14;
            let startY = 56;
            const boxW = 44;
            const boxH = 16;
            const gap = 3;

            kpiItems.forEach((item, index) => {
                const col = index % 4;
                const row = Math.floor(index / 4);
                const x = startX + col * (boxW + gap);
                const y = startY + row * (boxH + gap);

                doc.setFillColor(248, 250, 252); // slate 50
                doc.setDrawColor(226, 232, 240); // slate 200
                doc.roundedRect(x, y, boxW, boxH, 2, 2, "FD");

                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(100, 116, 139);
                doc.text(item.label, x + 3, y + 5);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(15, 23, 42);
                doc.text(item.val, x + 3, y + 12);
            });

            // Section: Detailed Audit Breakdown Table
            let tableStartY = 96;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            doc.text("2. Transaction Reconciliation Audit Table", 14, tableStartY);

            const tableRows = results.map(item => [
                item.transactionId,
                item.bankAmount !== null ? Settings.formatCurrency(item.bankAmount) : "—",
                item.companyAmount !== null ? Settings.formatCurrency(item.companyAmount) : "—",
                item.difference !== 0 ? Settings.formatCurrency(item.difference) : "0.00",
                item.bankDate || "—",
                item.companyDate || "—",
                item.statusLabel
            ]);

            // AutoTable plugin
            if (typeof doc.autoTable === "function") {
                doc.autoTable({
                    startY: tableStartY + 4,
                    head: [["Txn ID", "Bank Amount", "Company Amount", "Difference", "Bank Date", "Comp Date", "Audit Status"]],
                    body: tableRows,
                    theme: "striped",
                    styles: {
                        fontSize: 8,
                        cellPadding: 2.5,
                        textColor: [30, 41, 59],
                        font: "helvetica"
                    },
                    headStyles: {
                        fillColor: [30, 41, 59],
                        textColor: [248, 250, 252],
                        fontStyle: "bold"
                    },
                    alternateRowStyles: {
                        fillColor: [248, 250, 252]
                    },
                    columnStyles: {
                        0: { fontStyle: "bold", cellWidth: 26 },
                        1: { halign: "right", cellWidth: 26 },
                        2: { halign: "right", cellWidth: 26 },
                        3: { halign: "right", cellWidth: 26 },
                        4: { cellWidth: 22 },
                        5: { cellWidth: 22 },
                        6: { cellWidth: 34 }
                    },
                    didParseCell: data => {
                        if (data.section === "body" && data.column.index === 6) {
                            const val = String(data.cell.raw);
                            if (val.includes("Matched")) {
                                data.cell.styles.textColor = [16, 185, 129];
                                data.cell.styles.fontStyle = "bold";
                            } else if (val.includes("Mismatch") || val.includes("Duplicate") || val.includes("Multiple")) {
                                data.cell.styles.textColor = [239, 68, 68];
                                data.cell.styles.fontStyle = "bold";
                            } else if (val.includes("Unmatched")) {
                                data.cell.styles.textColor = [245, 158, 11];
                                data.cell.styles.fontStyle = "bold";
                            }
                        }
                    },
                    margin: { left: 14, right: 14, bottom: 20 }
                });

                // Add Footer with page numbers
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text("ReconcileX – Confidential Financial Audit", 14, 287);
                    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: "right" });
                }
            }

            const cleanDate = new Date().toISOString().slice(0, 10);
            doc.save(`ReconcileX_Audit_Report_${cleanDate}.pdf`);
            return true;
        } catch (err) {
            console.error("PDF generation error:", err);
            alert("Error generating PDF: " + err.message);
            return false;
        }
    }

    return {
        exportAllCSV,
        exportMismatchesCSV,
        exportUnmatchedCSV,
        exportDuplicatesCSV,
        exportAuditPDF
    };
})();
