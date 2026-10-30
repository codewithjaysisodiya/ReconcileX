/**
 * ReconcileX - Transactions Table & Details Controller
 * Handles search, multi-criteria filtering, sorting, pagination, and detail modal inspection.
 */

const TransactionsUI = (() => {
    "use strict";

    let allResults = [];
    let filteredResults = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortColumn = "transactionId";
    let sortDirection = "asc"; // "asc" | "desc"

    // DOM Cache
    const dom = {
        tableBody: null,
        searchInput: null,
        statusFilter: null,
        dateFrom: null,
        dateTo: null,
        pageSizeSelect: null,
        paginationInfo: null,
        prevPageBtn: null,
        nextPageBtn: null,
        totalRecordsBadge: null,
        detailModal: null,
        modalContent: null,
        closeModalBtn: null
    };

    /**
     * Escape HTML helper for security
     */
    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(/[&<>"']/g, c => {
            const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
            return entities[c];
        });
    }

    /**
     * Initialize DOM elements
     */
    function initDOM() {
        dom.tableBody = document.getElementById("transactionsTableBody");
        dom.searchInput = document.getElementById("searchTransactions");
        dom.statusFilter = document.getElementById("filterStatus");
        dom.dateFrom = document.getElementById("filterDateFrom");
        dom.dateTo = document.getElementById("filterDateTo");
        dom.pageSizeSelect = document.getElementById("pageSizeSelect");
        dom.paginationInfo = document.getElementById("paginationInfo");
        dom.prevPageBtn = document.getElementById("prevPageBtn");
        dom.nextPageBtn = document.getElementById("nextPageBtn");
        dom.totalRecordsBadge = document.getElementById("tableRecordCount");
        dom.detailModal = document.getElementById("transactionDetailModal");
        dom.modalContent = document.getElementById("modalDetailContent");
        dom.closeModalBtn = document.getElementById("closeDetailModal");

        attachEventListeners();
    }

    let listenersAttached = false;
    function attachEventListeners() {
        if (listenersAttached) return;

        if (dom.searchInput) {
            dom.searchInput.addEventListener("input", () => {
                currentPage = 1;
                applyFilters();
            });
        }

        if (dom.statusFilter) {
            dom.statusFilter.addEventListener("change", () => {
                currentPage = 1;
                applyFilters();
            });
        }

        if (dom.dateFrom) {
            dom.dateFrom.addEventListener("change", () => {
                currentPage = 1;
                applyFilters();
            });
        }

        if (dom.dateTo) {
            dom.dateTo.addEventListener("change", () => {
                currentPage = 1;
                applyFilters();
            });
        }

        if (dom.pageSizeSelect) {
            dom.pageSizeSelect.addEventListener("change", e => {
                pageSize = parseInt(e.target.value, 10) || 10;
                currentPage = 1;
                renderTable();
            });
        }

        if (dom.prevPageBtn) {
            dom.prevPageBtn.addEventListener("click", () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderTable();
                }
            });
        }

        if (dom.nextPageBtn) {
            dom.nextPageBtn.addEventListener("click", () => {
                const totalPages = Math.ceil(filteredResults.length / pageSize) || 1;
                if (currentPage < totalPages) {
                    currentPage++;
                    renderTable();
                }
            });
        }

        if (dom.closeModalBtn) {
            dom.closeModalBtn.addEventListener("click", closeModal);
        }

        if (dom.detailModal) {
            dom.detailModal.addEventListener("click", e => {
                if (e.target === dom.detailModal) closeModal();
            });
        }

        // Sorting column click delegation
        document.querySelectorAll("[data-sort]").forEach(header => {
            header.addEventListener("click", () => {
                const col = header.getAttribute("data-sort");
                if (sortColumn === col) {
                    sortDirection = sortDirection === "asc" ? "desc" : "asc";
                } else {
                    sortColumn = col;
                    sortDirection = "asc";
                }
                updateSortIcons();
                applySorting();
                renderTable();
            });
        });

        listenersAttached = true;
    }

    function updateSortIcons() {
        document.querySelectorAll("[data-sort]").forEach(th => {
            const icon = th.querySelector(".sort-icon");
            if (!icon) return;
            const col = th.getAttribute("data-sort");
            if (col === sortColumn) {
                icon.className = `sort-icon fas fa-sort-${sortDirection === "asc" ? "up" : "down"}`;
                th.classList.add("sorted");
            } else {
                icon.className = "sort-icon fas fa-sort";
                th.classList.remove("sorted");
            }
        });
    }

    /**
     * Load new results into the table
     * @param {Array<Object>} results 
     */
    function setResults(results) {
        initDOM();
        allResults = results || [];
        currentPage = 1;
        applyFilters();
    }

    /**
     * Filter results based on search keyword, status, and date range
     */
    function applyFilters() {
        const query = dom.searchInput ? dom.searchInput.value.trim().toLowerCase() : "";
        const status = dom.statusFilter ? dom.statusFilter.value : "all";
        const fromDate = dom.dateFrom ? dom.dateFrom.value : "";
        const toDate = dom.dateTo ? dom.dateTo.value : "";

        filteredResults = allResults.filter(item => {
            // Status filter
            if (status !== "all") {
                if (status === "unmatched") {
                    if (item.status !== "unmatched_bank" && item.status !== "unmatched_company") return false;
                } else if (item.status !== status) {
                    return false;
                }
            }

            // Keyword filter
            if (query) {
                const idMatch = (item.transactionId || "").toLowerCase().includes(query);
                const bankDescMatch = (item.bankDescription || "").toLowerCase().includes(query);
                const compDescMatch = (item.companyDescription || "").toLowerCase().includes(query);
                const bankRefMatch = (item.bankReference || "").toLowerCase().includes(query);
                const compRefMatch = (item.companyReference || "").toLowerCase().includes(query);

                if (!idMatch && !bankDescMatch && !compDescMatch && !bankRefMatch && !compRefMatch) {
                    return false;
                }
            }

            // Date Range filter
            const itemDate = item.bankDate || item.companyDate;
            if (fromDate && itemDate && itemDate < fromDate) return false;
            if (toDate && itemDate && itemDate > toDate) return false;

            return true;
        });

        if (dom.totalRecordsBadge) {
            dom.totalRecordsBadge.textContent = filteredResults.length === allResults.length
                ? `${filteredResults.length} audit entries`
                : `${filteredResults.length} of ${allResults.length} audit entries`;
        }

        applySorting();
        renderTable();
    }

    /**
     * Sort filtered results
     */
    function applySorting() {
        filteredResults.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];

            if (sortColumn === "date") {
                valA = a.bankDate || a.companyDate || "";
                valB = b.bankDate || b.companyDate || "";
            } else if (sortColumn === "difference") {
                valA = Math.abs(a.difference || 0);
                valB = Math.abs(b.difference || 0);
            }

            if (valA === null || valA === undefined) valA = "";
            if (valB === null || valB === undefined) valB = "";

            if (typeof valA === "number" && typeof valB === "number") {
                return sortDirection === "asc" ? valA - valB : valB - valA;
            }

            const cmp = String(valA).localeCompare(String(valB));
            return sortDirection === "asc" ? cmp : -cmp;
        });
    }

    /**
     * Render the paginated rows to the table DOM
     */
    function renderTable() {
        if (!dom.tableBody) return;

        if (filteredResults.length === 0) {
            dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <div class="empty-table-state">
                            <i class="fas fa-folder-open empty-icon"></i>
                            <p class="empty-title">No transactions match your current filters</p>
                            <p class="empty-sub">Try adjusting the search query, status dropdown, or date range.</p>
                        </div>
                    </td>
                </tr>
            `;
            if (dom.paginationInfo) dom.paginationInfo.textContent = "Showing 0 of 0";
            if (dom.prevPageBtn) dom.prevPageBtn.disabled = true;
            if (dom.nextPageBtn) dom.nextPageBtn.disabled = true;
            return;
        }

        const totalPages = Math.ceil(filteredResults.length / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, filteredResults.length);
        const pageItems = filteredResults.slice(startIndex, endIndex);

        const rowsHTML = pageItems.map(item => {
            const bankAmtStr = item.bankAmount !== null ? Settings.formatCurrency(item.bankAmount) : '<span class="text-muted">—</span>';
            const compAmtStr = item.companyAmount !== null ? Settings.formatCurrency(item.companyAmount) : '<span class="text-muted">—</span>';
            
            let diffDisplay = "—";
            let diffClass = "diff-zero";
            if (item.difference !== 0) {
                const diffAbs = Math.abs(item.difference);
                diffDisplay = `${item.difference > 0 ? "+" : "-"}${Settings.formatCurrency(diffAbs)}`;
                diffClass = item.difference > 0 ? "diff-positive" : "diff-negative";
            }

            const bankDateStr = item.bankDate || '<span class="text-muted">—</span>';
            const compDateStr = item.companyDate || '<span class="text-muted">—</span>';

            return `
                <tr>
                    <td class="font-mono font-medium">${escapeHTML(item.transactionId)}</td>
                    <td class="font-mono">${bankAmtStr}</td>
                    <td class="font-mono">${compAmtStr}</td>
                    <td class="font-mono ${diffClass}">${diffDisplay}</td>
                    <td class="text-sm">${bankDateStr}</td>
                    <td class="text-sm">${compDateStr}</td>
                    <td>
                        <span class="status-badge ${escapeHTML(item.badgeClass)}">
                            ${escapeHTML(item.statusLabel)}
                        </span>
                    </td>
                    <td>
                        <button class="btn-action-view" onclick="TransactionsUI.openDetailModal('${escapeHTML(item.id)}')">
                            <i class="fas fa-eye"></i> Details
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        dom.tableBody.innerHTML = rowsHTML;

        // Update pagination indicators
        if (dom.paginationInfo) {
            dom.paginationInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${filteredResults.length} records (Page ${currentPage} of ${totalPages})`;
        }
        if (dom.prevPageBtn) dom.prevPageBtn.disabled = currentPage <= 1;
        if (dom.nextPageBtn) dom.nextPageBtn.disabled = currentPage >= totalPages;
    }

    /**
     * Open details modal for a single transaction record
     * @param {string} recordId 
     */
    function openDetailModal(recordId) {
        initDOM();
        const item = allResults.find(r => r.id === recordId || r.transactionId === recordId);
        if (!item || !dom.detailModal || !dom.modalContent) return;

        const bankAmtStr = item.bankAmount !== null ? Settings.formatCurrency(item.bankAmount) : "Not Present in Bank Statement";
        const compAmtStr = item.companyAmount !== null ? Settings.formatCurrency(item.companyAmount) : "Not Present in Company Ledger";
        const diffStr = item.difference !== 0 ? Settings.formatCurrency(item.difference) : "Zero (Exact Match)";

        dom.modalContent.innerHTML = `
            <div class="modal-header-section">
                <div class="modal-title-row">
                    <h3>Transaction: <span class="font-mono text-cyan">${escapeHTML(item.transactionId)}</span></h3>
                    <span class="status-badge ${escapeHTML(item.badgeClass)}">${escapeHTML(item.statusLabel)}</span>
                </div>
                <p class="modal-notes">${escapeHTML(item.notes || "No additional audit notes.")}</p>
            </div>

            <div class="comparison-grid">
                <div class="compare-card bank-card">
                    <div class="card-tag"><i class="fas fa-university"></i> Bank Statement Record</div>
                    <div class="compare-row">
                        <span class="row-label">Amount:</span>
                        <span class="row-value font-mono font-bold">${bankAmtStr}</span>
                    </div>
                    <div class="compare-row">
                        <span class="row-label">Date:</span>
                        <span class="row-value font-mono">${escapeHTML(item.bankDate || "—")}</span>
                    </div>
                    <div class="compare-row">
                        <span class="row-label">Description:</span>
                        <span class="row-value">${escapeHTML(item.bankDescription || "—")}</span>
                    </div>
                    <div class="compare-row">
                        <span class="row-label">Reference No:</span>
                        <span class="row-value font-mono">${escapeHTML(item.bankReference || "—")}</span>
                    </div>
                </div>

                <div class="compare-card company-card">
                    <div class="card-tag"><i class="fas fa-building"></i> Company Ledger Record</div>
                    <div class="compare-row">
                        <span class="row-label">Amount:</span>
                        <span class="row-value font-mono font-bold">${compAmtStr}</span>
                    </div>
                    <div class="compare-row">
                        <span class="row-label">Date:</span>
                        <span class="row-value font-mono">${escapeHTML(item.companyDate || "—")}</span>
                    </div>
                    <div class="compare-row">
                        <span class="row-label">Description:</span>
                        <span class="row-value">${escapeHTML(item.companyDescription || "—")}</span>
                    </div>
                    <div class="compare-row">
                        <span class="row-label">Reference No:</span>
                        <span class="row-value font-mono">${escapeHTML(item.companyReference || "—")}</span>
                    </div>
                </div>
            </div>

            <div class="audit-summary-box">
                <h4><i class="fas fa-shield-alt"></i> Reconciliation Breakdown</h4>
                <div class="audit-row">
                    <span>Variance (Bank - Company):</span>
                    <span class="font-mono font-bold ${item.difference !== 0 ? 'text-red' : 'text-green'}">${diffStr}</span>
                </div>
                <div class="audit-row">
                    <span>Date Variance:</span>
                    <span class="font-mono">${item.dateDiffDays !== null ? `${Math.abs(item.dateDiffDays)} day(s)` : "N/A"}</span>
                </div>
                <div class="audit-row">
                    <span>Occurrences Processed:</span>
                    <span class="font-mono">${item.totalOccurrences || 1} instance(s) detected</span>
                </div>
            </div>
        `;

        dom.detailModal.classList.add("active");
    }

    /**
     * Close modal
     */
    function closeModal() {
        if (dom.detailModal) {
            dom.detailModal.classList.remove("active");
        }
    }

    return {
        setResults,
        openDetailModal,
        closeModal,
        applyFilters
    };
})();
