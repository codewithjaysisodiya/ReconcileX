/**
 * ReconcileX - Dashboard UI Controller
 * Populates and animates KPI metric cards, manages empty state vs populated dashboard,
 * and delegates chart updates to ChartManager.
 */

const Dashboard = (() => {
    "use strict";

    // DOM Elements cache
    const dom = {
        emptyState: null,
        dashboardContent: null,
        totalCount: null,
        matchedCount: null,
        unmatchedCount: null,
        mismatchCount: null,
        duplicateCount: null,
        matchPercentage: null,
        discrepancyAmount: null,
        bankVolumeText: null,
        companyVolumeText: null,
        netVarianceText: null
    };

    /**
     * Cache DOM elements
     */
    function initDOM() {
        dom.emptyState = document.getElementById("dashboardEmptyState");
        dom.dashboardContent = document.getElementById("dashboardActiveContent");
        dom.totalCount = document.getElementById("kpiTotalCount");
        dom.matchedCount = document.getElementById("kpiMatchedCount");
        dom.unmatchedCount = document.getElementById("kpiUnmatchedCount");
        dom.mismatchCount = document.getElementById("kpiMismatchCount");
        dom.duplicateCount = document.getElementById("kpiDuplicateCount");
        dom.matchPercentage = document.getElementById("kpiMatchPercentage");
        dom.discrepancyAmount = document.getElementById("kpiDiscrepancyAmount");
        dom.bankVolumeText = document.getElementById("kpiBankVolume");
        dom.companyVolumeText = document.getElementById("kpiCompanyVolume");
        dom.netVarianceText = document.getElementById("kpiNetVariance");
    }

    /**
     * Animate numeric value counter
     * @param {HTMLElement} element 
     * @param {number} targetValue 
     * @param {string} suffix 
     */
    function animateCounter(element, targetValue, suffix = "") {
        if (!element) return;
        const duration = 600;
        const startTime = performance.now();
        const startValue = 0;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(startValue + (targetValue - startValue) * easeProgress);

            element.textContent = current.toLocaleString() + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = targetValue.toLocaleString() + suffix;
            }
        }

        requestAnimationFrame(update);
    }

    /**
     * Render dashboard metrics and charts from reconciliation results
     * @param {Object} statistics 
     * @param {Array<Object>} results 
     */
    function render(statistics, results) {
        initDOM();

        if (!statistics || !results || results.length === 0) {
            showEmptyState();
            return;
        }

        if (dom.emptyState) dom.emptyState.style.display = "none";
        if (dom.dashboardContent) dom.dashboardContent.style.display = "block";

        // Update KPI Cards
        animateCounter(dom.totalCount, statistics.totalProcessedRows || 0);
        animateCounter(dom.matchedCount, statistics.matchedCount || 0);
        animateCounter(dom.unmatchedCount, statistics.totalUnmatchedCount || 0);
        animateCounter(dom.mismatchCount, (statistics.amountMismatchCount || 0) + (statistics.dateMismatchCount || 0));
        animateCounter(dom.duplicateCount, statistics.duplicateCount || 0);

        if (dom.matchPercentage) {
            dom.matchPercentage.textContent = `${statistics.matchPercentage.toFixed(1)}%`;
        }

        if (dom.discrepancyAmount) {
            dom.discrepancyAmount.textContent = Settings.formatCurrency(statistics.totalDiscrepancyAmount);
        }

        if (dom.bankVolumeText) {
            dom.bankVolumeText.textContent = Settings.formatCurrency(statistics.totalBankVolume);
        }

        if (dom.companyVolumeText) {
            dom.companyVolumeText.textContent = Settings.formatCurrency(statistics.totalCompanyVolume);
        }

        if (dom.netVarianceText) {
            const variance = statistics.netDiscrepancy;
            const sign = variance > 0 ? "+" : "";
            dom.netVarianceText.textContent = `${sign}${Settings.formatCurrency(variance)}`;
            dom.netVarianceText.style.color = variance === 0 ? "var(--green)" : (variance > 0 ? "var(--primary)" : "var(--red)");
        }

        // Render Charts
        ChartManager.updateCharts(statistics, results);
    }

    /**
     * Show empty state
     */
    function showEmptyState() {
        initDOM();
        if (dom.emptyState) dom.emptyState.style.display = "block";
        if (dom.dashboardContent) dom.dashboardContent.style.display = "none";
        ChartManager.resetCharts();
    }

    return {
        render,
        showEmptyState
    };
})();
