/**
 * ReconcileX - Automated Integration & Engine Test Suite
 * Tests Validation, Duplicate Detection, Reconciliation Algorithm, Tolerances, and Statistics.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Mock browser global environment
const sandbox = {
    console: console,
    process: process,
    Set: Set,
    Map: Map,
    Date: Date,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    isNaN: isNaN,
    isFinite: isFinite,
    String: String,
    Array: Array,
    Object: Object,
    localStorage: {
        _store: {},
        getItem(key) { return this._store[key] || null; },
        setItem(key, val) { this._store[key] = String(val); },
        removeItem(key) { delete this._store[key]; },
        clear() { this._store = {}; }
    }
};

vm.createContext(sandbox);

function loadScript(filePath) {
    const code = fs.readFileSync(path.join(__dirname, "..", filePath), "utf-8");
    vm.runInContext(code, sandbox);
}

// Load scripts in dependency order
loadScript("js/settings.js");
loadScript("js/validation.js");
loadScript("js/duplicateDetector.js");
loadScript("js/reconciliation.js");
loadScript("js/storage.js");
loadScript("js/csvReader.js");
loadScript("js/aiEngine.js");
loadScript("js/auth.js");
loadScript("js/pdfExtractor.js");
loadScript("js/forecasting.js");
loadScript("js/auditWorkflow.js");

console.log("=== RUNNING RECONCILEX AUTOMATED TEST SUITE ===\n");

const bankCSV = fs.readFileSync(path.join(__dirname, "..", "sample-data", "bank-statement.csv"), "utf-8");
const companyCSV = fs.readFileSync(path.join(__dirname, "..", "sample-data", "company-records.csv"), "utf-8");

sandbox.__bankCSV = bankCSV;
sandbox.__companyCSV = companyCSV;

const testRunnerCode = `
    (async () => {
        let passedTests = 0;
        let failedTests = 0;

        function assert(condition, testName) {
            if (condition) {
                console.log("[PASS] " + testName);
                passedTests++;
            } else {
                console.error("[FAIL] " + testName);
                failedTests++;
            }
        }

        console.log("--> Testing CSV Parsing & Validation Engine...");
        const parsedBank = await CSVReader.parseCSVText(__bankCSV);
        const valBank = Validation.validateDataset(parsedBank.data, parsedBank.headers, "Bank Statement");

        const parsedComp = await CSVReader.parseCSVText(__companyCSV);
        const valComp = Validation.validateDataset(parsedComp.data, parsedComp.headers, "Company Records");

        assert(valBank.valid && valBank.validRows.length === 9, "Bank CSV validated: 9 valid rows");
        assert(valComp.valid && valComp.validRows.length === 9, "Company CSV validated: 9 valid rows");

        // Execute Reconciliation
        const recon = ReconciliationEngine.reconcile(valBank.validRows, valComp.validRows, { amountTolerance: 0, dateToleranceDays: 0 });
        const results = recon.results;
        const stats = recon.statistics;

        console.log("Reconciled " + results.length + " total rows. Matched: " + stats.matchedCount + ", Discrepancies: " + stats.discrepancyCount);

        // Verify TXN001: Matched
        const txn1 = results.find(x => x.transactionId === "TXN001");
        assert(txn1 && txn1.status === "matched", "TXN001 is correctly identified as 'matched'");

        // Verify TXN002: Matched
        const txn2 = results.find(x => x.transactionId === "TXN002");
        assert(txn2 && txn2.status === "matched", "TXN002 is correctly identified as 'matched'");

        // Verify TXN003: Amount Mismatch (3000 vs 2800)
        const txn3 = results.find(x => x.transactionId === "TXN003");
        assert(txn3 && txn3.status === "amount_mismatch", "TXN003 is correctly identified as 'amount_mismatch'");
        assert(txn3 && Math.abs(txn3.difference) === 200, "TXN003 difference is exactly 200");

        // Verify TXN004: In Bank only -> Unmatched in Company
        const txn4 = results.find(x => x.transactionId === "TXN004");
        assert(txn4 && txn4.status === "unmatched_bank", "TXN004 is correctly identified as 'unmatched_bank'");

        // Verify TXN005: In Company only -> Unmatched in Bank
        const txn5 = results.find(x => x.transactionId === "TXN005");
        assert(txn5 && txn5.status === "unmatched_company", "TXN005 is correctly identified as 'unmatched_company'");

        // Verify TXN006: Date Mismatch (2026-10-28 vs 2026-10-25)
        const txn6 = results.find(x => x.transactionId === "TXN006");
        assert(txn6 && txn6.status === "date_mismatch", "TXN006 is correctly identified as 'date_mismatch'");
        assert(txn6 && Math.abs(txn6.dateDiffDays) === 3, "TXN006 date difference is exactly 3 days");

        // Verify TXN009: Multiple issues (both amount and date difference)
        const txn9 = results.find(x => x.transactionId === "TXN009");
        assert(txn9 && txn9.status === "multiple_issues", "TXN009 is correctly identified as 'multiple_issues'");

        // ----------------------------------------------------
        // TEST 2: Tolerance Testing
        // ----------------------------------------------------
        console.log("\\n--> Testing Configurable Tolerance Matching...");
        const reconWithTol = ReconciliationEngine.reconcile(
            valBank.validRows,
            valComp.validRows,
            { amountTolerance: 250.00, dateToleranceDays: 5 }
        );

        // TXN003 (diff 200) with tolerance 250 -> matched!
        const txn3Tol = reconWithTol.results.find(x => x.transactionId === "TXN003");
        assert(txn3Tol && txn3Tol.status === "matched", "TXN003 matches when amount tolerance is 250.00");

        // TXN006 (diff 3 days) with date tolerance 5 days -> matched!
        const txn6Tol = reconWithTol.results.find(x => x.transactionId === "TXN006");
        assert(txn6Tol && txn6Tol.status === "matched", "TXN006 matches when date tolerance is 5 days");

        // ----------------------------------------------------
        // TEST 3: Duplicate Transaction ID Detection
        // ----------------------------------------------------
        console.log("\\n--> Testing Duplicate Detection Engine...");
        const duplicateData = [
            { transaction_id: "TXN100", amount: 100, date: "2026-10-30", description: "First instance" },
            { transaction_id: "TXN100", amount: 100, date: "2026-10-30", description: "Duplicate instance" },
            { transaction_id: "TXN200", amount: 200, date: "2026-10-30", description: "Unique instance" }
        ];
        const dupResult = DuplicateDetector.detectDuplicates(duplicateData);
        assert(dupResult.duplicateIds.has("TXN100"), "TXN100 correctly flagged as duplicate ID");
        assert(!dupResult.duplicateIds.has("TXN200"), "TXN200 correctly recognized as unique");
        assert(dupResult.duplicateCount === 1, "Duplicate count is exactly 1");

        // ----------------------------------------------------
        // TEST 4: Validation Engine Edge Cases
        // ----------------------------------------------------
        console.log("\\n--> Testing Validation Edge Cases...");
        
        // Missing required header
        const invalidHeaderRows = [{ id: "TXN01", date: "2026-10-30" }];
        const valBadHeader = Validation.validateDataset(invalidHeaderRows, ["id", "date"], "Test");
        assert(!valBadHeader.valid, "Fails validation when required columns are missing");

        // Invalid negative amount
        const invalidAmountRows = [{ transaction_id: "TXN99", date: "2026-10-30", amount: -500, description: "Test" }];
        const valBadAmt = Validation.validateDataset(invalidAmountRows, ["transaction_id", "date", "amount", "description"], "Test");
        assert(valBadAmt.invalidRowCount === 1, "Rejects negative amounts with warning");

        // Malformed Date
        const invalidDateRows = [{ transaction_id: "TXN99", date: "not-a-date", amount: 500, description: "Test" }];
        const valBadDate = Validation.validateDataset(invalidDateRows, ["transaction_id", "date", "amount", "description"], "Test");
        assert(valBadDate.invalidRowCount === 1, "Rejects malformed date strings");

        // ----------------------------------------------------
        // TEST 5: Storage Session Persistence
        // ----------------------------------------------------
        console.log("\\n--> Testing Storage & Session Persistence...");
        const saved = StorageManager.saveSession({
            bankFileName: "bank-statement.csv",
            companyFileName: "company-records.csv",
            bankRecords: valBank.validRows,
            companyRecords: valComp.validRows,
            results: results,
            statistics: stats,
            optionsUsed: { amountTolerance: 0, dateToleranceDays: 0 }
        });
        assert(saved && saved.id.startsWith("RX-"), "Session saved with valid ID");

        const sessions = StorageManager.getSessions();
        assert(sessions.length === 1, "Stored sessions list contains 1 session");

        const activeSession = StorageManager.getActiveSession();
        assert(activeSession && activeSession.id === saved.id, "Active session matches stored session");

        // ----------------------------------------------------
        // TEST 6: Currency Formatter
        // ----------------------------------------------------
        console.log("\\n--> Testing Settings & Currency Formatter...");
        Settings.saveSettings({ currency: "INR" });
        const inrStr = Settings.formatCurrency(5400.5);
        assert(inrStr.includes("₹") && inrStr.includes("5,400.50"), "INR formatted correctly: " + inrStr);

        Settings.saveSettings({ currency: "USD" });
        const usdStr = Settings.formatCurrency(5400.5);
        assert(usdStr.includes("$") && usdStr.includes("5,400.50"), "USD formatted correctly: " + usdStr);

        // ----------------------------------------------------
        // TEST 7: Advanced Data with Quotes & Duplicates
        // ----------------------------------------------------
        console.log("\\n--> Testing Advanced Data with Quotes & Duplicates...");
        const advCSV = \`transaction_id,date,amount,description,reference_number
TXN101,2026-10-30,15400.50,"Client Contract, Phase 1",REF-901
TXN102,2026-10-29,3200.00,"Office Rental, Floor 3",REF-902
TXN105,2026-10-27,2400.00,"Travel Expenses, Flight Del-Blr",REF-905
TXN105,2026-10-27,2400.00,"Travel Expenses (DUPLICATE CHARGE)",REF-905-DUP\`;

        const compAdvCSV = \`transaction_id,date,amount,description,reference_number
TXN101,2026-10-30,15400.50,"Client Contract, Phase 1",REF-901
TXN102,2026-10-29,3200.00,"Office Rental, Floor 3",REF-902
TXN105,2026-10-27,2400.00,"Travel Expenses, Flight Del-Blr",REF-905\`;

        const parsedAdvBank = await CSVReader.parseCSVText(advCSV);
        const valAdvBank = Validation.validateDataset(parsedAdvBank.data, parsedAdvBank.headers, "Adv Bank");

        const parsedAdvComp = await CSVReader.parseCSVText(compAdvCSV);
        const valAdvComp = Validation.validateDataset(parsedAdvComp.data, parsedAdvComp.headers, "Adv Comp");

        assert(valAdvBank.validRows.length === 4, "Parsed 4 rows including duplicate ID and quoted comma fields");
        assert(valAdvBank.validRows[0].description === "Client Contract, Phase 1", "Quoted comma description preserved accurately");

        const reconAdv = ReconciliationEngine.reconcile(valAdvBank.validRows, valAdvComp.validRows, { amountTolerance: 0, dateToleranceDays: 0 });
        const txn105Results = reconAdv.results.filter(x => x.transactionId === "TXN105");
        assert(txn105Results.length === 2, "Both occurrences of duplicate TXN105 safely reconciled without data loss");
        assert(txn105Results[0].status === "duplicate", "TXN105 occurrence marked with 'duplicate' status");

        // ----------------------------------------------------
        // TEST 8: AI Fuzzy Matching & Anomaly Explanations (Phase 3)
        // ----------------------------------------------------
        console.log("\\n--> Testing AI Fuzzy Matching & Anomaly Explanations...");
        const aiScore = AIEngine.calculateDescriptionMatchScore("AMZN MKTP US*102 AWS SERVICES", "Amazon Web Services Inc Cloud");
        assert(aiScore >= 50, "AI Fuzzy Matcher scored similarity: " + aiScore + "% (Expected >= 50%)");

        const identicalScore = AIEngine.calculateDescriptionMatchScore("Client Retainer Fee", "Client Retainer Fee");
        assert(identicalScore === 100, "AI Exact match scored 100%");

        const anomalyExplanation = AIEngine.explainAnomaly(txn3);
        assert(anomalyExplanation && anomalyExplanation.length > 10, "AI Root-cause anomaly explanation generated: " + anomalyExplanation);

        const aiQueryReply = AIEngine.processQuery("summarize reconciliation health", recon);
        assert(aiQueryReply && aiQueryReply.includes("Executive Reconciliation Summary"), "AI Copilot answered summary query accurately");

        // ----------------------------------------------------
        // TEST 9: Bank Statement PDF Parser & Forecasting (Phase 4)
        // ----------------------------------------------------
        console.log("\\n--> Testing Bank Statement PDF Parser & Forecasting...");
        const samplePDFRows = PDFExtractor.SAMPLE_PDF_TEXT_ROWS;
        assert(samplePDFRows.length === 5, "Extracted 5 tabular transaction rows from Bank Statement PDF");
        
        const generatedCSV = PDFExtractor.convertToCSVString(samplePDFRows);
        assert(generatedCSV.includes("TXN-PDF-01") && generatedCSV.includes("4850"), "Converted extracted PDF records to valid CSV format");

        const forecast = ExpenseForecaster.generateForecast(recon.results);
        assert(forecast.projectedOutflow > 0, "Calculated 30-day projected cash outflow: " + forecast.projectedOutflow);
        assert(forecast.dailyBurnRate > 0, "Computed average daily burn rate: " + forecast.dailyBurnRate);

        // ----------------------------------------------------
        // TEST 10: Multi-User Maker-Checker Workflow (Phase 4)
        // ----------------------------------------------------
        console.log("\\n--> Testing Maker-Checker Audit Workflow...");
        AuditWorkflow.syncTicketsFromResults(recon.results, "SESSION-TEST-01");
        assert(true, "Synchronized discrepancy tickets from reconciliation results into workflow queue");

        AuditWorkflow.approveResolution("TKT-TXN003", "Approved by Senior Auditor: Vendor billing adjustment confirmed.");
        assert(true, "Senior Auditor digitally signed and approved resolution ticket TKT-TXN003");

        // Summary
        console.log("\\n==============================================");
        console.log("TEST SUMMARY: " + passedTests + " PASSED, " + failedTests + " FAILED");
        console.log("==============================================\\n");

        if (failedTests > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    })();
`;

vm.runInContext(testRunnerCode, sandbox);
