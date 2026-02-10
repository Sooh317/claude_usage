// Utility functions for date and number formatting

/**
 * Format a date string to human-readable format
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format a number as currency
 * @param {number} value - Numeric value
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
    if (value === null || value === undefined) return '$0.00';
    return '$' + value.toFixed(4);
}

/**
 * Format a number with specified decimals
 * @param {number} value - Numeric value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined) return '0';
    return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
function getToday() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

/**
 * Get the Monday of the week containing the given date
 * @param {Date|string} date - Date object or string
 * @returns {string} Monday's date in YYYY-MM-DD format
 */
function getWeekStart(date) {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

/**
 * Get month string (YYYY-MM) from a date
 * @param {Date|string} date - Date object or string
 * @returns {string} Month in YYYY-MM format
 */
function getMonthString(date) {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Show loading overlay
 */
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    alert('Error: ' + message);
    console.error(message);
}
