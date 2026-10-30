/**
 * ReconcileX - Main Application Controller
 * Coordinates navigation, file upload drag-and-drop, reconciliation execution,
 * session restoration, history management, and global toast notifications.
 */

const App = (() => {
    "use strict";

    // Application Global State
    let currentTab = "dashboard";
    let bankParsedData = null; // { file, text, rows, headers, fileName }
    let companyParsedData = null; // { file, text, rows, headers, fileName }
    let activeReconciliation = null; // { results, statistics, optionsUsed, bankFileName, companyFileName }

    // DOM Cache
    const dom = {
        navLinks: null,
        tabSections: null,
        mobileMenuToggle: null,
        sidebar: null,
        pageTitle: null,
        headerCurrencyBadge: null,

        // Upload zone
        bankDropzone: null,
        bankFileInput: null,
        bankFileInfo: null,
        companyDropzone: null,
        companyFileInput: null,
        companyFileInfo: null,
        runReconcileBtn: null,
        loadDemoBtn: null,
        uploadValidationAlert: null,

        // Quick action buttons
        navQuickNewBtn: null,
        navQuickDemoBtn: null,

        // History
        historyListBody: null,
        clearHistoryBtn: null,

        // Settings
        settingAmountTol: null,
        settingDateTol: null,
        settingCurrency: null,
        settingTheme: null,
        settingAutoReconcile: null,
        saveSettingsBtn: null,
        resetSettingsBtn: null,
        clearDataBtn: null,

        // Reports
        btnExportAllCSV: null,
        btnExportMismatchesCSV: null,
        btnExportUnmatchedCSV: null,
        btnExportDuplicatesCSV: null,
        btnExportPDF: null,

        // Toast container
        toastContainer: null
    };

    /**
     * Initialize Application on DOM Ready
     */
    function init() {
        cacheDOM();
        bindNavigation();
        bindUploadHandlers();
        bindSettingsHandlers();
        bindReportHandlers();
        bindHistoryHandlers();
        loadActiveSettingsToUI();

        // Restore active session if available from LocalStorage
        restorePreviousSession();

        // Initial currency badge
        updateHeaderCurrencyBadge();

        console.log("ReconcileX Application initialized successfully.");
    }

    /**
     * Cache DOM elements
     */
    function cacheDOM() {
        dom.navLinks = document.querySelectorAll(".nav-item");
        dom.tabSections = document.querySelectorAll(".view-section");
        dom.mobileMenuToggle = document.getElementById("mobileMenuToggle");
        dom.sidebar = document.getElementById("appSidebar");
        dom.pageTitle = document.getElementById("pageTitle");
        dom.headerCurrencyBadge = document.getElementById("headerCurrencyBadge");

        dom.bankDropzone = document.getElementById("bankDropzone");
        dom.bankFileInput = document.getElementById("bankFileInput");
        dom.bankFileInfo = document.getElementById("bankFileInfo");

        dom.companyDropzone = document.getElementById("companyDropzone");
        dom.companyFileInput = document.getElementById("companyFileInput");
        dom.companyFileInfo = document.getElementById("companyFileInfo");

        dom.runReconcileBtn = document.getElementById("runReconcileBtn");
        dom.loadDemoBtn = document.getElementById("loadDemoDataBtn");
        dom.uploadValidationAlert = document.getElementById("uploadValidationAlert");

        dom.navQuickNewBtn = document.getElementById("navQuickNewBtn");
        dom.navQuickDemoBtn = document.getElementById("navQuickDemoBtn");

        dom.historyListBody = document.getElementById("historyListBody");
        dom.clearHistoryBtn = document.getElementById("clearHistoryBtn");

        dom.settingAmountTol = document.getElementById("settingAmountTol");
        dom.settingDateTol = document.getElementById("settingDateTol");
        dom.settingCurrency = document.getElementById("settingCurrency");
        dom.settingTheme = document.getElementById("settingTheme");
        dom.settingAutoReconcile = document.getElementById("settingAutoReconcile");
        dom.saveSettingsBtn = document.getElementById("saveSettingsBtn");
        dom.resetSettingsBtn = document.getElementById("resetSettingsBtn");
        dom.clearDataBtn = document.getElementById("clearDataBtn");

        dom.btnExportAllCSV = document.getElementById("btnExportAllCSV");
        dom.btnExportMismatchesCSV = document.getElementById("btnExportMismatchesCSV");
        dom.btnExportUnmatchedCSV = document.getElementById("btnExportUnmatchedCSV");
        dom.btnExportDuplicatesCSV = document.getElementById("btnExportDuplicatesCSV");
        dom.btnExportPDF = document.getElementById("btnExportPDF");

        dom.toastContainer = document.getElementById("toastContainer");
    }

    /**
     * Bind Sidebar and Navbar Navigation Tabs
     */
    function bindNavigation() {
        dom.navLinks.forEach(link => {
            link.addEventListener("click", e => {
                e.preventDefault();
                const targetView = link.getAttribute("data-view");
                if (targetView) {
                    switchView(targetView);
                    // Close mobile sidebar if open
                    if (dom.sidebar) dom.sidebar.classList.remove("sidebar-open");
                }
            });
        });

        if (dom.mobileMenuToggle) {
            dom.mobileMenuToggle.addEventListener("click", () => {
                if (dom.sidebar) dom.sidebar.classList.toggle("sidebar-open");
            });
        }

        if (dom.navQuickNewBtn) {
            dom.navQuickNewBtn.addEventListener("click", () => {
                switchView("reconciliation");
            });
        }

        if (dom.navQuickDemoBtn) {
            dom.navQuickDemoBtn.addEventListener("click", loadDemoData);
        }
    }

    /**
     * Switch view between SPA sections
     * @param {string} viewName 
     */
    function switchView(viewName) {
        currentTab = viewName;

        // Update nav item active states
        dom.navLinks.forEach(item => {
            if (item.getAttribute("data-view") === viewName) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Hide all view sections, show target
        dom.tabSections.forEach(sec => {
            if (sec.id === `view-${viewName}`) {
                sec.classList.add("active");
            } else {
                sec.classList.remove("active");
            }
        });

        // Update Page Title
        const titleMap = {
            dashboard: "Dashboard Overview",
            reconciliation: "CSV File Upload & Reconciliation",
            transactions: "Transactions Ledger",
            analytics: "Financial Analytics & Insights",
            reports: "Audit Reports & Exports",
            workflow: "Enterprise Maker-Checker Audit Workflow",
            history: "Reconciliation Session History",
            settings: "System Preferences & Tolerances"
        };
        if (dom.pageTitle) {
            dom.pageTitle.textContent = titleMap[viewName] || "Financial Reconciliation";
        }

        // View specific refresh triggers
        if (viewName === "history") {
            renderHistoryTable();
        } else if (viewName === "reports") {
            updateReportSectionCounters();
        } else if (viewName === "workflow") {
            if (typeof AuditWorkflow !== "undefined") AuditWorkflow.renderWorkflowTable();
        }
    }

    /**
     * File Upload and Drag-and-Drop Handlers
     */
    function bindUploadHandlers() {
        // Bank Dropzone
        setupDropzone(
            dom.bankDropzone,
            dom.bankFileInput,
            async file => handleBankFileSelected(file)
        );

        // Company Dropzone
        setupDropzone(
            dom.companyDropzone,
            dom.companyFileInput,
            async file => handleCompanyFileSelected(file)
        );

        // Run Reconciliation button
        if (dom.runReconcileBtn) {
            dom.runReconcileBtn.addEventListener("click", runReconciliation);
        }

        // Load Demo Data button
        if (dom.loadDemoBtn) {
            dom.loadDemoBtn.addEventListener("click", loadDemoData);
        }

        // Sample Template Download triggers
        const dlBankTpl = document.getElementById("downloadBankTemplate");
        const dlCompTpl = document.getElementById("downloadCompanyTemplate");
        if (dlBankTpl) dlBankTpl.addEventListener("click", () => CSVReader.downloadSampleTemplate("bank"));
        if (dlCompTpl) dlCompTpl.addEventListener("click", () => CSVReader.downloadSampleTemplate("company"));
    }

    /**
     * Setup drag and drop for a dropzone container
     */
    function setupDropzone(dropzoneEl, fileInputEl, onFileReady) {
        if (!dropzoneEl || !fileInputEl) return;

        // Click to trigger input
        dropzoneEl.addEventListener("click", e => {
            if (e.target.tagName !== "BUTTON" && !e.target.closest("button")) {
                fileInputEl.click();
            }
        });

        fileInputEl.addEventListener("change", e => {
            const file = e.target.files[0];
            if (file) onFileReady(file);
        });

        // Drag events
        ["dragenter", "dragover"].forEach(evtName => {
            dropzoneEl.addEventListener(evtName, e => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneEl.classList.add("drag-over");
            });
        });

        ["dragleave", "drop"].forEach(evtName => {
            dropzoneEl.addEventListener(evtName, e => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneEl.classList.remove("drag-over");
            });
        });

        dropzoneEl.addEventListener("drop", e => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            if (file) onFileReady(file);
        });
    }

    /**
     * Handle Bank File Selection (Supports CSV, PDF, TXT, DOCX, DOC)
     */
    async function handleBankFileSelected(file) {
        try {
            showValidationAlert("", false);
            const parsed = await CSVReader.readAndParseDocument(file, "Bank Statement");

            const validation = Validation.validateDataset(parsed.data, parsed.headers, "Bank Statement");
            if (!validation.valid) {
                showValidationAlert(validation.errors.join("<br>"), true, "error");
                return;
            }

            bankParsedData = {
                file,
                fileName: file.name,
                fileSize: file.size,
                rawRows: parsed.data,
                validRows: validation.validRows,
                headers: parsed.headers,
                warnings: validation.warnings
            };

            renderFileInfo(dom.bankFileInfo, bankParsedData, "bank");
            checkEnableReconcile();

            if (validation.warnings.length > 0) {
                showValidationAlert(`Bank Statement parsed with ${validation.warnings.length} warning(s):<br>${validation.warnings.slice(0, 3).join("<br>")}`, true, "warning");
            } else {
                showToast(`Bank statement "${file.name}" uploaded (${validation.validRows.length} valid rows).`, "success");
            }

            // Check auto-reconcile setting
            if (Settings.get().autoReconcile && companyParsedData) {
                runReconciliation();
            }
        } catch (err) {
            showValidationAlert(err.message, true, "error");
            showToast(err.message, "danger");
        }
    }

    /**
     * Handle Company File Selection (Supports CSV, PDF, TXT, DOCX, DOC)
     */
    async function handleCompanyFileSelected(file) {
        try {
            showValidationAlert("", false);
            const parsed = await CSVReader.readAndParseDocument(file, "Company Records");

            const validation = Validation.validateDataset(parsed.data, parsed.headers, "Company Records");
            if (!validation.valid) {
                showValidationAlert(validation.errors.join("<br>"), true, "error");
                return;
            }

            companyParsedData = {
                file,
                fileName: file.name,
                fileSize: file.size,
                rawRows: parsed.data,
                validRows: validation.validRows,
                headers: parsed.headers,
                warnings: validation.warnings
            };

            renderFileInfo(dom.companyFileInfo, companyParsedData, "company");
            checkEnableReconcile();

            if (validation.warnings.length > 0) {
                showValidationAlert(`Company Records parsed with ${validation.warnings.length} warning(s):<br>${validation.warnings.slice(0, 3).join("<br>")}`, true, "warning");
            } else {
                showToast(`Company records "${file.name}" uploaded (${validation.validRows.length} valid rows).`, "success");
            }

            // Check auto-reconcile setting
            if (Settings.get().autoReconcile && bankParsedData) {
                runReconciliation();
            }
        } catch (err) {
            showValidationAlert(err.message, true, "error");
            showToast(err.message, "danger");
        }
    }

    /**
     * Render uploaded file badge/info box with dynamic format badge
     */
    function renderFileInfo(containerEl, data, type) {
        if (!containerEl) return;
        const sizeStr = CSVReader.formatFileSize(data.fileSize);
        const nameLower = (data.fileName || "").toLowerCase();

        let iconHtml = '<i class="fas fa-file-csv" style="color: #10b981;"></i>';
        let badgeType = "CSV";
        let badgeClass = "badge-matched";

        if (nameLower.endsWith(".pdf")) {
            iconHtml = '<i class="fas fa-file-pdf" style="color: #ef4444;"></i>';
            badgeType = "PDF Statement";
            badgeClass = "badge-unmatched-bank";
        } else if (nameLower.endsWith(".docx") || nameLower.endsWith(".doc")) {
            iconHtml = '<i class="fas fa-file-word" style="color: #3b82f6;"></i>';
            badgeType = "Word Document";
            badgeClass = "badge-matched";
        } else if (nameLower.endsWith(".txt") || nameLower.endsWith(".tsv") || nameLower.endsWith(".text")) {
            iconHtml = '<i class="fas fa-file-alt" style="color: #f59e0b;"></i>';
            badgeType = "Text File";
            badgeClass = "badge-date-mismatch";
        }

        containerEl.innerHTML = `
            <div class="file-loaded-badge">
                <div class="file-icon">${iconHtml}</div>
                <div class="file-details">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span class="file-name" title="${data.fileName}">${data.fileName}</span>
                        <span class="status-badge ${badgeClass}" style="font-size: 9px; padding: 1px 6px;">${badgeType}</span>
                    </div>
                    <span class="file-meta">${sizeStr} • <strong>${data.validRows.length}</strong> records</span>
                </div>
                <button class="btn-remove-file" title="Remove file" onclick="App.clearFile('${type}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        containerEl.style.display = "block";
    }

    /**
     * Clear a selected file
     */
    function clearFile(type) {
        if (type === "bank") {
            bankParsedData = null;
            if (dom.bankFileInput) dom.bankFileInput.value = "";
            if (dom.bankFileInfo) {
                dom.bankFileInfo.innerHTML = "";
                dom.bankFileInfo.style.display = "none";
            }
        } else {
            companyParsedData = null;
            if (dom.companyFileInput) dom.companyFileInput.value = "";
            if (dom.companyFileInfo) {
                dom.companyFileInfo.innerHTML = "";
                dom.companyFileInfo.style.display = "none";
            }
        }
        checkEnableReconcile();
        showToast(`Cleared ${type === "bank" ? "Bank Statement" : "Company Records"} file.`, "info");
    }

    function checkEnableReconcile() {
        if (dom.runReconcileBtn) {
            const canRun = bankParsedData && companyParsedData;
            dom.runReconcileBtn.disabled = !canRun;
        }
    }

    /**
     * Load Demo Data for one-click hackathon demonstration
     */
    async function loadDemoData() {
        try {
            showToast("Loading sample financial datasets...", "info");

            const parsedBank = await CSVReader.parseCSVText(CSVReader.DEMO_BANK_CSV);
            const valBank = Validation.validateDataset(parsedBank.data, parsedBank.headers, "Demo Bank");

            const parsedComp = await CSVReader.parseCSVText(CSVReader.DEMO_COMPANY_CSV);
            const valComp = Validation.validateDataset(parsedComp.data, parsedComp.headers, "Demo Company");

            bankParsedData = {
                file: null,
                fileName: "demo-bank-statement.csv",
                fileSize: CSVReader.DEMO_BANK_CSV.length,
                rawRows: parsedBank.data,
                validRows: valBank.validRows,
                headers: parsedBank.headers,
                warnings: []
            };

            companyParsedData = {
                file: null,
                fileName: "demo-company-records.csv",
                fileSize: CSVReader.DEMO_COMPANY_CSV.length,
                rawRows: parsedComp.data,
                validRows: valComp.validRows,
                headers: parsedComp.headers,
                warnings: []
            };

            renderFileInfo(dom.bankFileInfo, bankParsedData, "bank");
            renderFileInfo(dom.companyFileInfo, companyParsedData, "company");
            checkEnableReconcile();

            showToast("Demo datasets loaded successfully! Running reconciliation...", "success");

            // Execute reconciliation
            runReconciliation();
        } catch (e) {
            showToast("Failed to load demo data: " + e.message, "danger");
        }
    }

    /**
     * Run Core Reconciliation
     */
    function runReconciliation() {
        if (!bankParsedData || !companyParsedData) {
            showToast("Please upload both Bank Statement and Company Records CSV files.", "warning");
            return;
        }

        if (dom.runReconcileBtn) {
            dom.runReconcileBtn.disabled = true;
            dom.runReconcileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        try {
            const settings = Settings.get();
            const reconciliation = ReconciliationEngine.reconcile(
                bankParsedData.validRows,
                companyParsedData.validRows,
                {
                    amountTolerance: settings.amountTolerance,
                    dateToleranceDays: settings.dateToleranceDays
                }
            );

            activeReconciliation = {
                results: reconciliation.results,
                statistics: reconciliation.statistics,
                optionsUsed: reconciliation.optionsUsed,
                bankFileName: bankParsedData.fileName,
                companyFileName: companyParsedData.fileName,
                bankRecords: bankParsedData.validRows,
                companyRecords: companyParsedData.validRows
            };

            // Update UI modules
            Dashboard.render(reconciliation.statistics, reconciliation.results);
            TransactionsUI.setResults(reconciliation.results);
            AnalyticsUI.render(reconciliation.statistics, reconciliation.results);
            if (typeof AuditWorkflow !== "undefined") AuditWorkflow.syncTicketsFromResults(reconciliation.results);
            if (typeof ExpenseForecaster !== "undefined") ExpenseForecaster.renderForecastingUI(reconciliation.results);

            // Persist to storage
            StorageManager.saveSession(activeReconciliation);

            // Toast notification
            showToast(`Reconciliation complete! ${reconciliation.statistics.matchedCount} matched, ${reconciliation.statistics.discrepancyCount} items flagged.`, "success");

            // Switch to Dashboard
            switchView("dashboard");
        } catch (err) {
            console.error("Reconciliation execution failure:", err);
            showToast("Reconciliation error: " + err.message, "danger");
        } finally {
            if (dom.runReconcileBtn) {
                dom.runReconcileBtn.disabled = false;
                dom.runReconcileBtn.innerHTML = '<i class="fas fa-play"></i> Start Reconciliation';
            }
        }
    }

    /**
     * Restore previous session from LocalStorage
     */
    function restorePreviousSession() {
        const active = StorageManager.getActiveSession();
        if (active && active.results && active.statistics) {
            activeReconciliation = active;
            Dashboard.render(active.statistics, active.results);
            TransactionsUI.setResults(active.results);
            AnalyticsUI.render(active.statistics, active.results);
            console.log("Restored previous reconciliation session:", active.id);
        } else {
            Dashboard.showEmptyState();
        }
    }

    /**
     * Render the History table list
     */
    function renderHistoryTable() {
        if (!dom.historyListBody) return;
        const sessions = StorageManager.getSessions();

        if (sessions.length === 0) {
            dom.historyListBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="empty-table-state">
                            <i class="fas fa-history empty-icon"></i>
                            <p class="empty-title">No reconciliation sessions saved yet</p>
                            <p class="empty-sub">Completed reconciliation runs will automatically appear here.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        dom.historyListBody.innerHTML = sessions.map(s => {
            const dateStr = new Date(s.timestamp).toLocaleString();
            const discStr = Settings.formatCurrency(s.totalDiscrepancyAmount);
            return `
                <tr>
                    <td class="font-mono font-medium">${s.id}</td>
                    <td class="text-sm">${dateStr}</td>
                    <td class="text-sm">
                        <div><i class="fas fa-university text-cyan"></i> ${s.bankFileName}</div>
                        <div><i class="fas fa-building text-indigo"></i> ${s.companyFileName}</div>
                    </td>
                    <td>
                        <span class="badge-matched font-bold">${s.matchedCount} Matched</span> / 
                        <span class="badge-amount-mismatch">${s.mismatchCount + s.unmatchedCount} Issues</span>
                    </td>
                    <td class="font-bold text-cyan">${s.matchPercentage}%</td>
                    <td class="font-mono text-right font-medium text-red">${discStr}</td>
                    <td>
                        <div class="history-actions">
                            <button class="btn-history-restore" title="Open and reload this session" onclick="App.openSavedSession('${s.id}')">
                                <i class="fas fa-folder-open"></i> Open
                            </button>
                            <button class="btn-history-delete" title="Delete session" onclick="App.deleteSavedSession('${s.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    /**
     * Open / Restore a specific saved session
     */
    function openSavedSession(sessionId) {
        const session = StorageManager.getSessionById(sessionId);
        if (!session) {
            showToast("Session not found.", "warning");
            return;
        }

        activeReconciliation = session;
        Dashboard.render(session.statistics, session.results);
        TransactionsUI.setResults(session.results);
        AnalyticsUI.render(session.statistics, session.results);

        showToast(`Loaded session ${sessionId} successfully.`, "success");
        switchView("dashboard");
    }

    /**
     * Delete a saved session
     */
    function deleteSavedSession(sessionId) {
        if (!confirm(`Are you sure you want to delete session ${sessionId}?`)) return;
        StorageManager.deleteSession(sessionId);
        renderHistoryTable();
        showToast("Session deleted.", "info");
    }

    /**
     * Clear all history
     */
    function bindHistoryHandlers() {
        if (dom.clearHistoryBtn) {
            dom.clearHistoryBtn.addEventListener("click", () => {
                if (!confirm("Are you sure you want to clear all reconciliation history? This cannot be undone.")) return;
                StorageManager.clearAllHistory();
                renderHistoryTable();
                showToast("All reconciliation history cleared.", "info");
            });
        }
    }

    /**
     * Settings handlers
     */
    function bindSettingsHandlers() {
        if (dom.saveSettingsBtn) {
            dom.saveSettingsBtn.addEventListener("click", () => {
                const amtTol = parseFloat(dom.settingAmountTol.value) || 0;
                const dateTol = parseInt(dom.settingDateTol.value, 10) || 0;
                const curr = dom.settingCurrency.value || "INR";
                const theme = dom.settingTheme.value || "dark-fintech";
                const autoRec = dom.settingAutoReconcile.checked;

                Settings.saveSettings({
                    amountTolerance: amtTol,
                    dateToleranceDays: dateTol,
                    currency: curr,
                    theme: theme,
                    autoReconcile: autoRec
                });

                updateHeaderCurrencyBadge();

                // Re-render active views to reflect new currency / tolerance
                if (activeReconciliation) {
                    Dashboard.render(activeReconciliation.statistics, activeReconciliation.results);
                    TransactionsUI.setResults(activeReconciliation.results);
                    AnalyticsUI.render(activeReconciliation.statistics, activeReconciliation.results);
                }

                showToast("Settings saved successfully!", "success");
            });
        }

        if (dom.resetSettingsBtn) {
            dom.resetSettingsBtn.addEventListener("click", () => {
                if (!confirm("Reset all settings to defaults?")) return;
                Settings.resetDefaults();
                loadActiveSettingsToUI();
                updateHeaderCurrencyBadge();
                showToast("Settings reset to defaults.", "info");
            });
        }

        if (dom.clearDataBtn) {
            dom.clearDataBtn.addEventListener("click", () => {
                if (!confirm("WARNING: This will erase all saved sessions, active reconciliation, and preferences. Continue?")) return;
                StorageManager.clearAllHistory();
                Settings.resetDefaults();
                activeReconciliation = null;
                bankParsedData = null;
                companyParsedData = null;
                clearFile("bank");
                clearFile("company");
                Dashboard.showEmptyState();
                TransactionsUI.setResults([]);
                loadActiveSettingsToUI();
                updateHeaderCurrencyBadge();
                showToast("Application data reset successfully.", "info");
                switchView("dashboard");
            });
        }
    }

    function loadActiveSettingsToUI() {
        const s = Settings.get();
        if (dom.settingAmountTol) dom.settingAmountTol.value = s.amountTolerance;
        if (dom.settingDateTol) dom.settingDateTol.value = s.dateToleranceDays;
        if (dom.settingCurrency) dom.settingCurrency.value = s.currency;
        if (dom.settingTheme) dom.settingTheme.value = s.theme;
        if (dom.settingAutoReconcile) dom.settingAutoReconcile.checked = !!s.autoReconcile;
    }

    function updateHeaderCurrencyBadge() {
        if (dom.headerCurrencyBadge) {
            dom.headerCurrencyBadge.textContent = `${Settings.get().currency} (${Settings.getCurrencySymbol()})`;
        }
    }

    /**
     * Reports Handlers
     */
    function bindReportHandlers() {
        if (dom.btnExportAllCSV) {
            dom.btnExportAllCSV.addEventListener("click", () => {
                if (!activeReconciliation) return showToast("No active data to export. Please reconcile first.", "warning");
                ReportGenerator.exportAllCSV(activeReconciliation.results);
                showToast("Complete CSV report downloaded.", "success");
            });
        }

        if (dom.btnExportMismatchesCSV) {
            dom.btnExportMismatchesCSV.addEventListener("click", () => {
                if (!activeReconciliation) return showToast("No active data to export. Please reconcile first.", "warning");
                ReportGenerator.exportMismatchesCSV(activeReconciliation.results);
                showToast("Mismatches-only CSV report downloaded.", "success");
            });
        }

        if (dom.btnExportUnmatchedCSV) {
            dom.btnExportUnmatchedCSV.addEventListener("click", () => {
                if (!activeReconciliation) return showToast("No active data to export. Please reconcile first.", "warning");
                ReportGenerator.exportUnmatchedCSV(activeReconciliation.results);
                showToast("Unmatched-only CSV report downloaded.", "success");
            });
        }

        if (dom.btnExportDuplicatesCSV) {
            dom.btnExportDuplicatesCSV.addEventListener("click", () => {
                if (!activeReconciliation) return showToast("No active data to export. Please reconcile first.", "warning");
                ReportGenerator.exportDuplicatesCSV(activeReconciliation.results);
                showToast("Duplicates-only CSV report downloaded.", "success");
            });
        }

        if (dom.btnExportPDF) {
            dom.btnExportPDF.addEventListener("click", () => {
                if (!activeReconciliation) return showToast("No active data to export. Please reconcile first.", "warning");
                ReportGenerator.exportAuditPDF(
                    activeReconciliation.statistics,
                    activeReconciliation.results,
                    {
                        bankFileName: activeReconciliation.bankFileName,
                        companyFileName: activeReconciliation.companyFileName
                    }
                );
                showToast("Audit PDF report generated.", "success");
            });
        }
    }

    function updateReportSectionCounters() {
        const countAll = document.getElementById("repCountAll");
        const countMis = document.getElementById("repCountMismatches");
        const countUnm = document.getElementById("repCountUnmatched");
        const countDup = document.getElementById("repCountDuplicates");

        if (!activeReconciliation || !activeReconciliation.statistics) {
            if (countAll) countAll.textContent = "0 records";
            if (countMis) countMis.textContent = "0 records";
            if (countUnm) countUnm.textContent = "0 records";
            if (countDup) countDup.textContent = "0 records";
            return;
        }

        const s = activeReconciliation.statistics;
        if (countAll) countAll.textContent = `${s.totalProcessedRows} records`;
        if (countMis) countMis.textContent = `${s.amountMismatchCount + s.dateMismatchCount + s.multipleIssuesCount} records`;
        if (countUnm) countUnm.textContent = `${s.totalUnmatchedCount} records`;
        if (countDup) countDup.textContent = `${s.duplicateCount} records`;
    }

    /**
     * Show validation feedback alert box
     */
    function showValidationAlert(messageHTML, isVisible, alertType = "error") {
        if (!dom.uploadValidationAlert) return;
        if (!isVisible) {
            dom.uploadValidationAlert.style.display = "none";
            return;
        }

        dom.uploadValidationAlert.className = `alert-box alert-${alertType}`;
        dom.uploadValidationAlert.innerHTML = `
            <div class="alert-icon"><i class="fas fa-${alertType === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i></div>
            <div class="alert-content">${messageHTML}</div>
        `;
        dom.uploadValidationAlert.style.display = "flex";
    }

    /**
     * Global Toast Notification
     * @param {string} message 
     * @param {'success'|'danger'|'warning'|'info'} type 
     * @param {number} duration 
     */
    function showToast(message, type = "info", duration = 4000) {
        if (!dom.toastContainer) return;

        const iconMap = {
            success: "fa-check-circle",
            danger: "fa-times-circle",
            warning: "fa-exclamation-triangle",
            info: "fa-info-circle"
        };

        const toast = document.createElement("div");
        toast.className = `toast-pill toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${iconMap[type] || 'fa-bell'}"></i>
            <span>${message}</span>
        `;

        dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-fadeout");
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, duration);
    }

    // Initialize on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", init);

    return {
        init,
        switchView,
        clearFile,
        openSavedSession,
        deleteSavedSession,
        showToast,
        handleBankFileSelected,
        handleCompanyFileSelected,
        removeFile: clearFile,
        getActiveReconciliation: () => activeReconciliation
    };
})();
