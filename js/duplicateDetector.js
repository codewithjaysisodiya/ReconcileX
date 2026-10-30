/**
 * ReconcileX - Duplicate Detector Engine
 * Analyzes transaction datasets to detect intra-file duplicate transaction IDs
 * and identical records.
 */

const DuplicateDetector = (() => {
    "use strict";

    /**
     * Analyze a list of transactions for duplicates by transaction_id
     * @param {Array<Object>} transactions 
     * @returns {{
     *   duplicateIds: Set<string>,
     *   idOccurrences: Map<string, Array<Object>>,
     *   duplicateCount: number,
     *   duplicateTransactions: Array<Object>
     * }}
     */
    function detectDuplicates(transactions) {
        const idOccurrences = new Map();
        const duplicateIds = new Set();
        const duplicateTransactions = [];

        transactions.forEach((txn, index) => {
            const id = txn.transaction_id;
            if (!idOccurrences.has(id)) {
                idOccurrences.set(id, []);
            }
            idOccurrences.get(id).push({ ...txn, _originalIndex: index });
        });

        idOccurrences.forEach((list, id) => {
            if (list.length > 1) {
                duplicateIds.add(id);
                // All entries after the first are duplicates, or flag all occurrences
                list.forEach(entry => duplicateTransactions.push(entry));
            }
        });

        return {
            duplicateIds,
            idOccurrences,
            duplicateCount: duplicateIds.size,
            duplicateTransactions
        };
    }

    /**
     * Check if a specific transaction ID is duplicate in either bank or company records
     * @param {string} txnId 
     * @param {Set<string>} bankDuplicateIds 
     * @param {Set<string>} companyDuplicateIds 
     * @returns {{ isDuplicate: boolean, source: 'none' | 'bank' | 'company' | 'both' }}
     */
    function checkDuplicateStatus(txnId, bankDuplicateIds, companyDuplicateIds) {
        const inBank = bankDuplicateIds.has(txnId);
        const inCompany = companyDuplicateIds.has(txnId);

        if (inBank && inCompany) return { isDuplicate: true, source: "both" };
        if (inBank) return { isDuplicate: true, source: "bank" };
        if (inCompany) return { isDuplicate: true, source: "company" };
        return { isDuplicate: false, source: "none" };
    }

    return {
        detectDuplicates,
        checkDuplicateStatus
    };
})();
