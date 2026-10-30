const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = {
    console, require, Buffer, Set, Map, Date, Math, parseFloat, parseInt, isNaN, isFinite, String, Array, Object,
    localStorage: { getItem: () => null, setItem: () => {} },
    File: class {
        constructor(parts, name) {
            this.name = name;
            this._buffer = parts[0];
        }
        async arrayBuffer() {
            return this._buffer.buffer.slice(this._buffer.byteOffset, this._buffer.byteOffset + this._buffer.byteLength);
        }
    }
};

vm.createContext(sandbox);

function load(file) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf-8'), sandbox);
}

load('js/settings.js');
load('js/validation.js');
load('js/duplicateDetector.js');
load('js/reconciliation.js');
load('js/pdfExtractor.js');

async function testPdfPair(bankPath, compPath, label) {
    console.log(`\n==============================================`);
    console.log(`Testing Pair: ${label}`);
    console.log(`==============================================`);
    
    const bankBuf = fs.readFileSync(bankPath);
    const bankFile = new sandbox.File([bankBuf], path.basename(bankPath));
    const bankRows = await vm.runInContext('PDFExtractor.extractTransactionsFromPDF(bankFile, "Bank Statement")', Object.assign(sandbox, { bankFile }));
    console.log(`[Bank PDF] Extracted Rows: ${bankRows.length}`);

    const compBuf = fs.readFileSync(compPath);
    const compFile = new sandbox.File([compBuf], path.basename(compPath));
    const compRows = await vm.runInContext('PDFExtractor.extractTransactionsFromPDF(compFile, "Company Records")', Object.assign(sandbox, { compFile }));
    console.log(`[Company PDF] Extracted Rows: ${compRows.length}`);

    const valBank = vm.runInContext('Validation.validateDataset(bankRows, ["transaction_id","date","amount","description","reference_number"], "Bank Statement")', Object.assign(sandbox, { bankRows }));
    const valComp = vm.runInContext('Validation.validateDataset(compRows, ["transaction_id","date","amount","description","reference_number"], "Company Records")', Object.assign(sandbox, { compRows }));
    console.log(`[Validation] Bank: ${valBank.valid} (${valBank.validRows.length} rows), Company: ${valComp.valid} (${valComp.validRows.length} rows)`);

    const recon = vm.runInContext('ReconciliationEngine.reconcile(valBank.validRows, valComp.validRows, { amountTolerance: 0, dateToleranceDays: 0 })', Object.assign(sandbox, { valBank, valComp }));
    console.log(`[Reconciled] Total Processed: ${recon.statistics.totalProcessedRows}`);
    console.log(`[Reconciled] Matched: ${recon.statistics.matchedCount}`);
    console.log(`[Reconciled] Discrepancies: ${recon.statistics.totalDiscrepancyCount}`);
    console.log(`[Reconciled] Accuracy Rate: ${recon.statistics.matchPercentage}%`);
    console.log(`[Reconciled] Total Discrepancy Amount: ₹${recon.statistics.totalDiscrepancyAmount}`);
}

async function runAll() {
    // Pair 1: Standard 10-Row PDF Dataset
    await testPdfPair(
        path.join(__dirname, '..', 'sample-data', 'Bank_Statement_Standard.pdf'),
        path.join(__dirname, '..', 'sample-data', 'Company_Records_Standard.pdf'),
        'Standard 10-Row PDFs (Bank_Statement_Standard.pdf vs Company_Records_Standard.pdf)'
    );

    // Pair 2: Complex 31-Row Multi-Page Aarav Dataset
    await testPdfPair(
        path.join(__dirname, '..', 'sample-data', 'aarav-bank-statement.pdf'),
        path.join(__dirname, '..', 'sample-data', 'aarav-company-records.pdf'),
        'Aarav Multi-Page 31-Row PDFs (aarav-bank-statement.pdf vs aarav-company-records.pdf)'
    );
}

runAll();
