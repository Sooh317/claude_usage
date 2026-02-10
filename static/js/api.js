// API client for fetching analytics data

const API_BASE = '/api';

/**
 * Fetch daily statistics
 * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
 * @returns {Promise<Object>} Daily statistics
 */
async function fetchDailyStats(date = null) {
    try {
        const url = date
            ? `${API_BASE}/stats/daily?date=${date}`
            : `${API_BASE}/stats/daily`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching daily stats:', error);
        throw error;
    }
}

/**
 * Fetch weekly statistics
 * @param {string} startDate - Week start date (YYYY-MM-DD)
 * @returns {Promise<Object>} Weekly statistics
 */
async function fetchWeeklyStats(startDate) {
    try {
        const url = `${API_BASE}/stats/weekly?start_date=${startDate}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching weekly stats:', error);
        throw error;
    }
}

/**
 * Fetch monthly statistics
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Object>} Monthly statistics
 */
async function fetchMonthlyStats(month) {
    try {
        const url = `${API_BASE}/stats/monthly?month=${month}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching monthly stats:', error);
        throw error;
    }
}

/**
 * Fetch custom date range statistics
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Range statistics
 */
async function fetchRangeStats(startDate, endDate) {
    try {
        const url = `${API_BASE}/stats/range?start_date=${startDate}&end_date=${endDate}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching range stats:', error);
        throw error;
    }
}

/**
 * Fetch list of available dates
 * @returns {Promise<Object>} Available dates info
 */
async function fetchAvailableDates() {
    try {
        const url = `${API_BASE}/stats/available-dates`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching available dates:', error);
        throw error;
    }
}

/**
 * Fetch hourly statistics for a single day
 * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
 * @param {string} granularity - Time bucket size (default: "1h")
 * @returns {Promise<Object>} Hourly statistics
 */
async function fetchHourlyStats(date = null, granularity = "1h") {
    try {
        let url = `${API_BASE}/stats/hourly?granularity=${granularity}`;
        if (date) {
            url += `&date=${date}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching hourly stats:', error);
        throw error;
    }
}
