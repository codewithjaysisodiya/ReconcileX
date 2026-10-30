/**
 * ReconcileX - Data Visualizations & Chart Engine
 * Powered by Chart.js with fintech dark theme styling.
 * Manages:
 * 1. Matched vs Unmatched Doughnut Chart
 * 2. Transaction Status Breakdown Bar Chart
 * 3. Volume & Discrepancy Comparison Bar Chart
 * 4. Date-wise Transaction Trend Chart
 */

const ChartManager = (() => {
    "use strict";

    // Chart instances registry to safely destroy and re-create on data updates
    const chartInstances = {
        matchDoughnut: null,
        statusBar: null,
        amountComparison: null,
        dateTrend: null
    };

    const PALETTE = {
        matched: "#10b981",       // emerald green
        unmatchedBank: "#f59e0b", // amber/orange
        unmatchedComp: "#fbbf24", // yellow amber
        amountMismatch: "#ef4444",// rose red
        dateMismatch: "#06b6d4",  // cyan
        duplicate: "#ec4899",     // pink/fuchsia
        multiple: "#8b5cf6",      // purple
        bankVolume: "#38bdf8",    // sky blue
        companyVolume: "#6366f1", // indigo
        discrepancy: "#f43f5e",   // rose
        gridColor: "rgba(255, 255, 255, 0.06)",
        textColor: "#94a3b8"
    };

    /**
     * Safely destroy an existing chart before creating a new one
     * @param {string} chartKey 
     */
    function destroyChart(chartKey) {
        if (chartInstances[chartKey]) {
            try {
                chartInstances[chartKey].destroy();
            } catch (e) {
                console.warn(`Error destroying chart ${chartKey}:`, e);
            }
            chartInstances[chartKey] = null;
        }
    }

    /**
     * Check if Chart.js is available on window
     */
    function isChartAvailable() {
        return typeof Chart !== "undefined";
    }

    /**
     * Render the Matched vs Unmatched Doughnut Chart
     */
    function renderMatchDoughnut(statistics) {
        const ctx = document.getElementById("chartMatchDoughnut");
        if (!ctx || !isChartAvailable()) return;

        destroyChart("matchDoughnut");

        const matched = statistics.matchedCount || 0;
        const unmatched = (statistics.unmatchedBankCount || 0) + (statistics.unmatchedCompanyCount || 0);
        const mismatches = (statistics.amountMismatchCount || 0) + (statistics.dateMismatchCount || 0) + (statistics.multipleIssuesCount || 0);
        const duplicates = statistics.duplicateCount || 0;

        chartInstances.matchDoughnut = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Matched", "Unmatched", "Mismatches", "Duplicates"],
                datasets: [{
                    data: [matched, unmatched, mismatches, duplicates],
                    backgroundColor: [
                        PALETTE.matched,
                        PALETTE.unmatchedBank,
                        PALETTE.amountMismatch,
                        PALETTE.duplicate
                    ],
                    borderColor: "#0f172a",
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "70%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: PALETTE.textColor,
                            boxWidth: 12,
                            padding: 16,
                            font: { family: "'Inter', sans-serif", size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#cbd5e1",
                        borderColor: "#334155",
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8
                    }
                }
            }
        });
    }

    /**
     * Render the Status Breakdown Horizontal/Vertical Bar Chart
     */
    function renderStatusBar(statistics) {
        const ctx = document.getElementById("chartStatusBar");
        if (!ctx || !isChartAvailable()) return;

        destroyChart("statusBar");

        chartInstances.statusBar = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [
                    "Matched",
                    "Bank Only",
                    "Company Only",
                    "Amt Mismatch",
                    "Date Mismatch",
                    "Duplicates",
                    "Multiple Issues"
                ],
                datasets: [{
                    label: "Transactions",
                    data: [
                        statistics.matchedCount || 0,
                        statistics.unmatchedBankCount || 0,
                        statistics.unmatchedCompanyCount || 0,
                        statistics.amountMismatchCount || 0,
                        statistics.dateMismatchCount || 0,
                        statistics.duplicateCount || 0,
                        statistics.multipleIssuesCount || 0
                    ],
                    backgroundColor: [
                        PALETTE.matched,
                        PALETTE.unmatchedBank,
                        PALETTE.unmatchedComp,
                        PALETTE.amountMismatch,
                        PALETTE.dateMismatch,
                        PALETTE.duplicate,
                        PALETTE.multiple
                    ],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#cbd5e1",
                        borderColor: "#334155",
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: PALETTE.textColor, font: { size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: PALETTE.gridColor },
                        ticks: { color: PALETTE.textColor, precision: 0 }
                    }
                }
            }
        });
    }

    /**
     * Render Total Volume Comparison Bar Chart
     */
    function renderAmountComparison(statistics) {
        const ctx = document.getElementById("chartAmountComparison");
        if (!ctx || !isChartAvailable()) return;

        destroyChart("amountComparison");

        const currencySymbol = Settings.getCurrencySymbol();

        chartInstances.amountComparison = new Chart(ctx, {
            type: "bar",
            data: {
                labels: ["Total Bank Volume", "Total Company Volume", "Total Discrepancy"],
                datasets: [{
                    label: `Amount (${currencySymbol})`,
                    data: [
                        statistics.totalBankVolume || 0,
                        statistics.totalCompanyVolume || 0,
                        statistics.totalDiscrepancyAmount || 0
                    ],
                    backgroundColor: [
                        PALETTE.bankVolume,
                        PALETTE.companyVolume,
                        PALETTE.discrepancy
                    ],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        callbacks: {
                            label: context => ` ${currencySymbol}${context.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: PALETTE.textColor, font: { size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: PALETTE.gridColor },
                        ticks: {
                            color: PALETTE.textColor,
                            callback: value => currencySymbol + Number(value).toLocaleString()
                        }
                    }
                }
            }
        });
    }

    /**
     * Render Date-wise Transaction Trend Line Chart
     */
    function renderDateTrend(results) {
        const ctx = document.getElementById("chartDateTrend");
        if (!ctx || !isChartAvailable()) return;

        destroyChart("dateTrend");

        // Group by date (using bankDate or companyDate)
        const dateMap = new Map();

        results.forEach(item => {
            const date = item.bankDate || item.companyDate || "Unknown";
            if (!dateMap.has(date)) {
                dateMap.set(date, { matched: 0, issues: 0, totalAmount: 0 });
            }
            const stat = dateMap.get(date);
            if (item.status === "matched") {
                stat.matched++;
            } else {
                stat.issues++;
            }
            stat.totalAmount += (item.bankAmount || item.companyAmount || 0);
        });

        // Sort dates chronologically
        const sortedDates = Array.from(dateMap.keys()).sort();
        const matchedData = sortedDates.map(d => dateMap.get(d).matched);
        const issuesData = sortedDates.map(d => dateMap.get(d).issues);

        chartInstances.dateTrend = new Chart(ctx, {
            type: "line",
            data: {
                labels: sortedDates,
                datasets: [
                    {
                        label: "Matched Records",
                        data: matchedData,
                        borderColor: PALETTE.matched,
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4
                    },
                    {
                        label: "Discrepancies / Unmatched",
                        data: issuesData,
                        borderColor: PALETTE.amountMismatch,
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        labels: { color: PALETTE.textColor, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        borderColor: "#334155",
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { color: PALETTE.gridColor },
                        ticks: { color: PALETTE.textColor, maxRotation: 45, minRotation: 0 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: PALETTE.gridColor },
                        ticks: { color: PALETTE.textColor, precision: 0 }
                    }
                }
            }
        });
    }

    /**
     * Update all dashboard charts
     */
    function updateCharts(statistics, results) {
        if (!statistics || !results) return;
        renderMatchDoughnut(statistics);
        renderStatusBar(statistics);
        renderAmountComparison(statistics);
        renderDateTrend(results);
    }

    /**
     * Destroy all chart instances (e.g. when clearing data)
     */
    function resetCharts() {
        Object.keys(chartInstances).forEach(destroyChart);
    }

    return {
        updateCharts,
        resetCharts,
        renderMatchDoughnut,
        renderStatusBar,
        renderAmountComparison,
        renderDateTrend
    };
})();
