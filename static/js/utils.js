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
 * Format a Date object as YYYY-MM-DD using local timezone
 * @param {Date} d - Date object
 * @returns {string} Date in YYYY-MM-DD format (local)
 */
function toLocalDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Convert a UTC hour to local hour for a given date
 * @param {number} utcHour - Hour in UTC (0-23)
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {{hour: number, timeRange: string}} Local hour and formatted time range
 */
function utcHourToLocal(utcHour, dateStr) {
    // Use noon of the target date to get timezone offset (avoids DST boundary issues)
    const noon = new Date(dateStr + 'T12:00:00');
    const offsetMinutes = noon.getTimezoneOffset(); // negative for east of UTC
    const offsetHours = -offsetMinutes / 60;

    let localHour = utcHour + Math.round(offsetHours);
    // Wrap around 0-23
    localHour = ((localHour % 24) + 24) % 24;

    const nextHour = (localHour + 1) % 24;
    const timeRange = `${String(localHour).padStart(2, '0')}:00-${String(nextHour).padStart(2, '0')}:00`;

    return { hour: localHour, timeRange };
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
function getToday() {
    return toLocalDateString(new Date());
}

/**
 * Get the Monday of the week containing the given date
 * @param {Date|string} date - Date object or string
 * @returns {string} Monday's date in YYYY-MM-DD format
 */
function getWeekStart(date) {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    return toLocalDateString(d);
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
