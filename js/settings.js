/**
 * ReconcileX - Settings Manager
 * Manages configuration preferences: tolerances, currency symbol, theme, and LocalStorage persistence.
 */

const Settings = (() => {
    "use strict";

    const STORAGE_KEY = "reconcilex_settings_v1";

    const CURRENCY_CONFIG = {
        INR: { symbol: "₹", code: "INR", locale: "en-IN", name: "Indian Rupee (₹)" },
        USD: { symbol: "$", code: "USD", locale: "en-US", name: "US Dollar ($)" },
        EUR: { symbol: "€", code: "EUR", locale: "de-DE", name: "Euro (€)" },
        GBP: { symbol: "£", code: "GBP", locale: "en-GB", name: "British Pound (£)" },
        JPY: { symbol: "¥", code: "JPY", locale: "ja-JP", name: "Japanese Yen (¥)" }
    };

    const DEFAULT_SETTINGS = {
        amountTolerance: 0.00,
        dateToleranceDays: 0,
        currency: "INR",
        theme: "dark-fintech",
        autoReconcile: true,
        pageSize: 10
    };

    let currentSettings = { ...DEFAULT_SETTINGS };

    /**
     * Load settings from LocalStorage
     */
    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.warn("Failed to load settings from storage, using defaults:", e);
            currentSettings = { ...DEFAULT_SETTINGS };
        }
        return currentSettings;
    }

    /**
     * Save settings to LocalStorage
     * @param {Object} newSettings 
     */
    function saveSettings(newSettings) {
        try {
            currentSettings = { ...currentSettings, ...newSettings };
            // Ensure numbers
            currentSettings.amountTolerance = Math.max(0, parseFloat(currentSettings.amountTolerance) || 0);
            currentSettings.dateToleranceDays = Math.max(0, parseInt(currentSettings.dateToleranceDays, 10) || 0);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
            return true;
        } catch (e) {
            console.error("Failed to save settings:", e);
            return false;
        }
    }

    /**
     * Reset settings to factory defaults
     */
    function resetDefaults() {
        currentSettings = { ...DEFAULT_SETTINGS };
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        return currentSettings;
    }

    /**
     * Get current settings object
     */
    function get() {
        return { ...currentSettings };
    }

    /**
     * Format a numeric amount using active currency and locale
     * @param {number|null|undefined} amount 
     * @param {boolean} includeSymbol 
     * @returns {string}
     */
    function formatCurrency(amount, includeSymbol = true) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return "—";
        }

        const curr = CURRENCY_CONFIG[currentSettings.currency] || CURRENCY_CONFIG.INR;
        const absVal = Math.abs(amount);
        const sign = amount < 0 ? "-" : "";

        const formattedNumber = absVal.toLocaleString(curr.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        if (!includeSymbol) {
            return `${sign}${formattedNumber}`;
        }

        return `${sign}${curr.symbol}${formattedNumber}`;
    }

    /**
     * Get currency symbol
     */
    function getCurrencySymbol() {
        const curr = CURRENCY_CONFIG[currentSettings.currency] || CURRENCY_CONFIG.INR;
        return curr.symbol;
    }

    // Auto-load on script execution
    loadSettings();

    return {
        CURRENCY_CONFIG,
        DEFAULT_SETTINGS,
        loadSettings,
        saveSettings,
        resetDefaults,
        get,
        formatCurrency,
        getCurrencySymbol
    };
})();
