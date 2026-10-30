/**
 * ReconcileX - Core Financial Reconciliation Engine
 * Executes transaction matching between Bank Statements and Company Records.
 * Detects: Matched, Unmatched, Amount Mismatch, Date Mismatch, Duplicates, and Multiple Issues.
 * Supports configurable Amount and Date tolerances.
 */

const ReconciliationEngine = (() => {
    "use strict";

    /**
     * Compute difference in days between two ISO date strings (YYYY-MM-DD)
     * @param {string} date1 
     * @param {string} date2 
     * @returns {number} Days difference (positive or negative)
     */
    function getDaysDifference(date1, date2) {
        if (!date1 || !date2) return 0;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffMs = d1.getTime() - d2.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Status definitions and human-readable badges
     */
    const STATUS_MAP = {
        matched: {
            label: "Matched",
            badgeClass: "badge-matched",
            severity: "success",
            description: "Transaction ID, amount, and date match within tolerances."
        },
        unmatched_bank: {
            label: "Unmatched (Bank Only)",
            badgeClass: "badge-unmatched-bank",
            severity: "warning",
            description: "Recorded in bank statement but missing from company ledger."
        },
        unmatched_company: {
            label: "Unmatched (Company Only)",
            badgeClass: "badge-unmatched-company",
            severity: "warning",
            description: "Recorded in company ledger but missing from bank statement."
        },
        amount_mismatch: {
            label: "Amount Mismatch",
            badgeClass: "badge-amount-mismatch",
            severity: "danger",
            description: "Transaction IDs match, but amounts differ beyond tolerance."
        },
        date_mismatch: {
            label: "Date Mismatch",
            badgeClass: "badge-date-mismatch",
            severity: "info",
            description: "Transaction IDs and amounts match, but dates differ beyond tolerance."
        },
        duplicate: {
            label: "Duplicate Record",
            badgeClass: "badge-duplicate",
            severity: "danger",
            description: "Transaction ID appears more than once in the source file."
        },
        multiple_issues: {
            label: "Multiple Issues",
            badgeClass: "badge-multiple",
            severity: "danger",
            description: "Both amount and date differ, or duplicate record with mismatches."
        }
    };

    /**
     * Main reconciliation algorithm
     * @param {Array<Object>} bankRecords 
     * @param {Array<Object>} companyRecords 
     * @param {Object} options Configurable options: amountTolerance, dateToleranceDays
     * @returns {{
     *   results: Array<Object>,
     *   statistics: Object,
     *   optionsUsed: Object
     * }}
     */
    function reconcile(bankRecords = [], companyRecords = [], options = {}) {
        const amountTolerance = Math.max(0, parseFloat(options.amountTolerance) || 0);
        const dateToleranceDays = Math.max(0, parseInt(options.dateToleranceDays, 10) || 0);

        // 1. Detect duplicates in both files (case-insensitive & trimmed)
        const bankDupAnalysis = DuplicateDetector.detectDuplicates(bankRecords);
        const companyDupAnalysis = DuplicateDetector.detectDuplicates(companyRecords);

        // Normalized key helper for resilient financial matching
        function normKey(val) {
            return String(val || "").trim().toUpperCase();
        }

        // 2. Build multi-maps to handle possible multiple records per ID safely
        const bankMap = new Map();
        const originalIdMap = new Map();

        bankRecords.forEach(record => {
            const rawId = record.transaction_id !== undefined && record.transaction_id !== null ? String(record.transaction_id).trim() : "";
            const key = normKey(rawId);
            if (!bankMap.has(key)) bankMap.set(key, []);
            bankMap.get(key).push(record);
            if (!originalIdMap.has(key)) originalIdMap.set(key, rawId);
        });

        const companyMap = new Map();
        companyRecords.forEach(record => {
            const rawId = record.transaction_id !== undefined && record.transaction_id !== null ? String(record.transaction_id).trim() : "";
            const key = normKey(rawId);
            if (!companyMap.has(key)) companyMap.set(key, []);
            companyMap.get(key).push(record);
            if (!originalIdMap.has(key)) originalIdMap.set(key, rawId);
        });

        // 3. Union of all unique normalized transaction IDs
        const allKeys = new Set([...bankMap.keys(), ...companyMap.keys()]);
        const results = [];

        // 4. Reconcile records ID by ID
        allKeys.forEach(key => {
            const bankList = bankMap.get(key) || [];
            const companyList = companyMap.get(key) || [];
            const displayId = (bankList[0] && bankList[0].transaction_id) || (companyList[0] && companyList[0].transaction_id) || originalIdMap.get(key) || key;

            const isBankDup = bankDupAnalysis.duplicateIds.has(key);
            const isCompanyDup = companyDupAnalysis.duplicateIds.has(key);

            // Determine maximum instances for this ID to ensure no record is lost
            const maxOccurrences = Math.max(bankList.length, companyList.length);

            for (let i = 0; i < maxOccurrences; i++) {
                const b = bankList[i] || null;
                const c = companyList[i] || null;

                const bankAmount = b ? b.amount : null;
                const companyAmount = c ? c.amount : null;
                const bankDate = b ? b.date : null;
                const companyDate = c ? c.date : null;
                const bankDesc = b ? b.description : "";
                const companyDesc = c ? c.description : "";
                const bankRef = b ? b.reference_number : "";
                const companyRef = c ? c.reference_number : "";

                let status = "matched";
                const notes = [];

                // Case A: Duplicate detected in either file
                if (isBankDup || isCompanyDup) {
                    status = "duplicate";
                    if (isBankDup && isCompanyDup) {
                        notes.push(`Repeated transaction ID found in both Bank and Company files (${bankList.length} bank, ${companyList.length} company).`);
                    } else if (isBankDup) {
                        notes.push(`Duplicate transaction ID in Bank statement (${bankList.length} occurrences).`);
                    } else {
                        notes.push(`Duplicate transaction ID in Company records (${companyList.length} occurrences).`);
                    }
                }

                // Case B: Record exists in Bank only
                if (b && !c) {
                    if (status !== "duplicate") {
                        status = "unmatched_bank";
                        notes.push("Missing in Company records. Potential unrecorded bank deposit, fee, or charge.");
                    }
                }
                // Case C: Record exists in Company only
                else if (!b && c) {
                    if (status !== "duplicate") {
                        status = "unmatched_company";
                        notes.push("Missing in Bank statement. Potential unpresented cheque or pending settlement.");
                    }
                }
                // Case D: Exists in both Bank and Company
                else if (b && c) {
                    const amountDiff = Math.abs(bankAmount - companyAmount);
                    const isAmountMatch = amountDiff <= amountTolerance;

                    const dateDiff = Math.abs(getDaysDifference(bankDate, companyDate));
                    const isDateMatch = dateDiff <= dateToleranceDays;

                    if (status === "duplicate") {
                        // Keep duplicate status, but note if amounts also differ
                        if (!isAmountMatch || !isDateMatch) {
                            status = "multiple_issues";
                            notes.push(`Duplicate entry with discrepancies: Amount diff: ${amountDiff.toFixed(2)}, Date diff: ${dateDiff} days.`);
                        }
                    } else if (isAmountMatch && isDateMatch) {
                        status = "matched";
                        if (amountDiff > 0) {
                            notes.push(`Matched within tolerance (Diff: ${amountDiff.toFixed(2)} <= ${amountTolerance.toFixed(2)}).`);
                        } else {
                            notes.push("Exact match on transaction ID, amount, and date.");
                        }
                    } else if (!isAmountMatch && isDateMatch) {
                        status = "amount_mismatch";
                        notes.push(`Amount mismatch: Bank ${bankAmount.toFixed(2)} vs Company ${companyAmount.toFixed(2)} (Diff: ${amountDiff.toFixed(2)}).`);
                    } else if (isAmountMatch && !isDateMatch) {
                        status = "date_mismatch";
                        notes.push(`Date mismatch: Bank ${bankDate} vs Company ${companyDate} (${dateDiff} days difference).`);
                    } else {
                        status = "multiple_issues";
                        notes.push(`Multiple issues: Amount diff is ${amountDiff.toFixed(2)} and Date diff is ${dateDiff} days.`);
                    }
                }

                // Calculate numeric difference (Bank - Company)
                let difference = 0;
                if (bankAmount !== null && companyAmount !== null) {
                    difference = Math.round((bankAmount - companyAmount) * 100) / 100;
                } else if (bankAmount !== null) {
                    difference = bankAmount; // Bank has it, Company doesn't
                } else if (companyAmount !== null) {
                    difference = -companyAmount; // Company has it, Bank doesn't
                }

                const statusMeta = STATUS_MAP[status] || STATUS_MAP.matched;

                results.push({
                    id: `${displayId}${maxOccurrences > 1 ? `_#${i + 1}` : ""}`,
                    transactionId: displayId,
                    occurrenceIndex: i + 1,
                    totalOccurrences: maxOccurrences,
                    bankAmount,
                    companyAmount,
                    difference,
                    bankDate,
                    companyDate,
                    dateDiffDays: (bankDate && companyDate) ? getDaysDifference(bankDate, companyDate) : null,
                    bankDescription: bankDesc,
                    companyDescription: companyDesc,
                    bankReference: bankRef,
                    companyReference: companyRef,
                    status,
                    statusLabel: statusMeta.label,
                    badgeClass: statusMeta.badgeClass,
                    severity: statusMeta.severity,
                    notes: notes.join(" ")
                });
            }
        });

        // 5. Smart Secondary Field Matching:
        // Automatically pairs unmatched bank and company entries if amounts and dates match within tolerance
        const unmatchedBankIndices = [];
        const unmatchedCompIndices = [];

        results.forEach((res, idx) => {
            if (res.status === "unmatched_bank" && res.bankAmount !== null && res.bankAmount !== undefined) {
                unmatchedBankIndices.push(idx);
            } else if (res.status === "unmatched_company" && res.companyAmount !== null && res.companyAmount !== undefined) {
                unmatchedCompIndices.push(idx);
            }
        });

        const bankMatchedSet = new Set();
        const compMatchedSet = new Set();
        const pairedResults = [];

        for (const bIdx of unmatchedBankIndices) {
            const bItem = results[bIdx];
            let bestCompIdx = null;
            let bestScore = -1;

            for (const cIdx of unmatchedCompIndices) {
                if (compMatchedSet.has(cIdx)) continue;
                const cItem = results[cIdx];

                const amountDiff = Math.abs(bItem.bankAmount - cItem.companyAmount);
                const isAmountMatch = amountDiff <= amountTolerance;
                const dateDiff = Math.abs(getDaysDifference(bItem.bankDate, cItem.companyDate));
                const isDateMatch = dateDiff <= dateToleranceDays;

                if (isAmountMatch && isDateMatch) {
                    let score = 100 - (amountDiff * 5) - (dateDiff * 5);
                    if (bItem.bankReference && cItem.companyReference && bItem.bankReference === cItem.companyReference) {
                        score += 50;
                    }
                    if (score > bestScore) {
                        bestScore = score;
                        bestCompIdx = cIdx;
                    }
                }
            }

            if (bestCompIdx !== null) {
                bankMatchedSet.add(bIdx);
                compMatchedSet.add(bestCompIdx);

                const cItem = results[bestCompIdx];
                const amountDiff = Math.abs(bItem.bankAmount - cItem.companyAmount);
                const dateDiff = Math.abs(getDaysDifference(bItem.bankDate, cItem.companyDate));
                const difference = Math.round((bItem.bankAmount - cItem.companyAmount) * 100) / 100;

                const status = (amountDiff <= amountTolerance && dateDiff <= dateToleranceDays)
                    ? "matched"
                    : (amountDiff > amountTolerance ? "amount_mismatch" : "date_mismatch");

                const statusMeta = STATUS_MAP[status];
                const note = (amountDiff === 0 && dateDiff === 0)
                    ? `Field Match: Exact amount (${bItem.bankAmount.toFixed(2)}) & date (${bItem.bankDate}) matched.`
                    : `Field Match: Matched within tolerance (Amount diff: ${amountDiff.toFixed(2)}, Date diff: ${dateDiff}d).`;

                pairedResults.push({
                    id: `${bItem.transactionId}_${cItem.transactionId}`,
                    transactionId: bItem.transactionId === cItem.transactionId ? bItem.transactionId : `${bItem.transactionId} / ${cItem.transactionId}`,
                    bankAmount: bItem.bankAmount,
                    companyAmount: cItem.companyAmount,
                    difference,
                    bankDate: bItem.bankDate,
                    companyDate: cItem.companyDate,
                    daysDifference: dateDiff,
                    dateDiffDays: dateDiff,
                    bankDescription: bItem.bankDescription,
                    companyDescription: cItem.companyDescription,
                    bankReference: bItem.bankReference,
                    companyReference: cItem.companyReference,
                    status,
                    statusLabel: statusMeta.label,
                    badgeClass: statusMeta.badgeClass,
                    severity: statusMeta.severity,
                    notes: note
                });
            }
        }

        let reconciledResults = results;
        if (bankMatchedSet.size > 0 || compMatchedSet.size > 0) {
            reconciledResults = results.filter((_, idx) => !bankMatchedSet.has(idx) && !compMatchedSet.has(idx));
            reconciledResults.push(...pairedResults);
        }

        // 6. Compute dynamic statistical summaries
        const statistics = computeStatistics(reconciledResults, bankRecords, companyRecords);

        return {
            results: reconciledResults,
            statistics,
            optionsUsed: {
                amountTolerance,
                dateToleranceDays
            }
        };
    }

    /**
     * Compute comprehensive statistics from reconciliation results
     * @param {Array<Object>} results 
     * @param {Array<Object>} bankRecords 
     * @param {Array<Object>} companyRecords 
     * @returns {Object}
     */
    function computeStatistics(results, bankRecords, companyRecords) {
        let matchedCount = 0;
        let unmatchedBankCount = 0;
        let unmatchedCompanyCount = 0;
        let amountMismatchCount = 0;
        let dateMismatchCount = 0;
        let duplicateCount = 0;
        let multipleIssuesCount = 0;

        let totalDiscrepancyAmount = 0;
        let totalBankVolume = 0;
        let totalCompanyVolume = 0;

        bankRecords.forEach(b => { totalBankVolume += (b.amount || 0); });
        companyRecords.forEach(c => { totalCompanyVolume += (c.amount || 0); });

        results.forEach(r => {
            switch (r.status) {
                case "matched":
                    matchedCount++;
                    break;
                case "unmatched_bank":
                    unmatchedBankCount++;
                    totalDiscrepancyAmount += Math.abs(r.bankAmount || 0);
                    break;
                case "unmatched_company":
                    unmatchedCompanyCount++;
                    totalDiscrepancyAmount += Math.abs(r.companyAmount || 0);
                    break;
                case "amount_mismatch":
                    amountMismatchCount++;
                    totalDiscrepancyAmount += Math.abs(r.difference || 0);
                    break;
                case "date_mismatch":
                    dateMismatchCount++;
                    break;
                case "duplicate":
                    duplicateCount++;
                    // If amounts also differ, count the difference
                    if (r.bankAmount !== null && r.companyAmount !== null) {
                        totalDiscrepancyAmount += Math.abs(r.difference || 0);
                    } else if (r.bankAmount !== null) {
                        totalDiscrepancyAmount += Math.abs(r.bankAmount);
                    } else if (r.companyAmount !== null) {
                        totalDiscrepancyAmount += Math.abs(r.companyAmount);
                    }
                    break;
                case "multiple_issues":
                    multipleIssuesCount++;
                    totalDiscrepancyAmount += Math.abs(r.difference || 0);
                    break;
            }
        });

        const totalUnmatchedCount = unmatchedBankCount + unmatchedCompanyCount;
        const totalProcessedRows = results.length;
        const totalUniqueTransactions = new Set(results.map(r => r.transactionId)).size;
        
        // Match rate based on matched records divided by total processed records
        const matchPercentage = totalProcessedRows > 0
            ? Math.round((matchedCount / totalProcessedRows) * 1000) / 10
            : 0;

        const netDiscrepancy = Math.round((totalBankVolume - totalCompanyVolume) * 100) / 100;

        return {
            totalProcessedRows,
            totalUniqueTransactions,
            totalBankRecords: bankRecords.length,
            totalCompanyRecords: companyRecords.length,
            totalBankVolume: Math.round(totalBankVolume * 100) / 100,
            totalCompanyVolume: Math.round(totalCompanyVolume * 100) / 100,
            netDiscrepancy,
            totalDiscrepancyAmount: Math.round(totalDiscrepancyAmount * 100) / 100,
            matchedCount,
            unmatchedBankCount,
            unmatchedCompanyCount,
            totalUnmatchedCount,
            amountMismatchCount,
            dateMismatchCount,
            duplicateCount,
            multipleIssuesCount,
            discrepancyCount: (amountMismatchCount + dateMismatchCount + totalUnmatchedCount + duplicateCount + multipleIssuesCount),
            matchPercentage
        };
    }

    return {
        STATUS_MAP,
        reconcile,
        computeStatistics,
        getDaysDifference
    };
})();
