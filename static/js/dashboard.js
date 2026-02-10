// Main dashboard logic

// Global state
let currentPeriod = 'daily';
let currentDate = getToday();
let currentData = null;

/**
 * Initialize dashboard
 */
async function init() {
    console.log('Initializing dashboard...');

    // Set up event listeners
    setupEventListeners();

    // Set initial date picker value
    const datePicker = document.getElementById('date-picker');
    datePicker.value = currentDate;

    // Load initial data
    await loadData();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Period tabs
    const periodTabs = document.querySelectorAll('.period-tab');
    periodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const period = tab.dataset.period;
            switchPeriod(period);
        });
    });

    // Date picker
    const datePicker = document.getElementById('date-picker');
    datePicker.addEventListener('change', (e) => {
        onDateChange(e.target.value);
    });

    // Export button
    const exportBtn = document.getElementById('export-btn');
    exportBtn.addEventListener('click', exportToCSV);
}

/**
 * Switch to a different period view
 * @param {string} newPeriod - 'daily', 'weekly', or 'monthly'
 */
function switchPeriod(newPeriod) {
    currentPeriod = newPeriod;

    // Update active tab
    document.querySelectorAll('.period-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.period === newPeriod);
    });

    // Update date picker type and date
    const datePicker = document.getElementById('date-picker');
    if (newPeriod === 'daily') {
        datePicker.type = 'date';
        // Reset to today when switching to daily view
        currentDate = getToday();
        datePicker.value = currentDate;
    } else if (newPeriod === 'weekly') {
        datePicker.type = 'date';
        // Set to Monday of current week
        currentDate = getWeekStart(new Date());
        datePicker.value = currentDate;
    } else if (newPeriod === 'monthly') {
        datePicker.type = 'month';
        currentDate = getMonthString(new Date());
        datePicker.value = currentDate;
    }

    // Hide hourly chart when switching away from daily
    if (newPeriod !== 'daily') {
        hideHourlyChart();
    }

    // Reload data
    loadData();
}

/**
 * Handle date picker change
 * @param {string} newDate - New date value
 */
function onDateChange(newDate) {
    currentDate = newDate;
    loadData();
}

/**
 * Load data based on current period and date
 */
async function loadData() {
    try {
        showLoading();

        let data;

        if (currentPeriod === 'daily') {
            data = await fetchDailyStats(currentDate);
        } else if (currentPeriod === 'weekly') {
            data = await fetchWeeklyStats(currentDate);
        } else if (currentPeriod === 'monthly') {
            data = await fetchMonthlyStats(currentDate);
        }

        currentData = data;

        // Render the data
        renderMetricCards(data);
        renderCharts(data);

        hideLoading();

    } catch (error) {
        hideLoading();

        // Show more user-friendly error messages
        if (error.message.includes('404')) {
            showError(`No data available for ${currentDate}. Please select a different date.`);
        } else if (error.message.includes('500')) {
            showError(`Server error while loading data. Please try again or contact support.`);
        } else {
            showError(`Failed to load data: ${error.message}`);
        }
    }
}

/**
 * Render metric cards
 * @param {Object} data - Statistics data
 */
function renderMetricCards(data) {
    // For daily view, use the data directly
    // For weekly/monthly, use the aggregate
    const stats = data.aggregate || data;

    // Cost card
    const costValue = stats['Total Cost ($)'];
    document.querySelector('#cost-card .metric-value').textContent =
        formatCurrency(costValue);

    // Time card
    const timeValue = stats['Active Time (hrs)'] || stats['Avg Active Time/day (hrs)'];
    document.querySelector('#time-card .metric-value').textContent =
        formatNumber(timeValue, 1) + ' hrs';

    // Calls card
    const callsValue = stats['API Calls'];
    document.querySelector('#calls-card .metric-value').textContent =
        formatNumber(callsValue);

    // Efficiency card (Cache hit rate - Phase 4, for now show total tokens)
    const tokensValue = stats['Total Tokens'];
    document.querySelector('#efficiency-card .metric-value').textContent =
        formatNumber(tokensValue);
    document.querySelector('#efficiency-card .metric-label').textContent =
        'Total Tokens';
}

/**
 * Render all charts
 * @param {Object} data - Statistics data
 */
function renderCharts(data) {
    console.log('Rendering charts with data:', data);

    // Create all charts
    createCostTrendChart(data);
    createTokenPieChart(data);
    createModelBarChart(data);
    createToolBarChart(data);
    createCodeStackChart(data);

    // Show hourly chart only in daily view
    if (currentPeriod === 'daily') {
        showHourlyChart(currentDate);
    } else {
        hideHourlyChart();
    }
}

/**
 * Export data to CSV
 */
async function exportToCSV() {
    try {
        // Determine date range based on current period
        let startDate, endDate;

        if (currentPeriod === 'daily') {
            startDate = endDate = currentDate;
        } else if (currentPeriod === 'weekly') {
            startDate = currentDate;
            const end = new Date(currentDate + 'T00:00:00');
            end.setDate(end.getDate() + 6);
            endDate = end.toISOString().split('T')[0];
        } else if (currentPeriod === 'monthly') {
            // currentDate is in YYYY-MM format for monthly
            const [year, month] = currentDate.split('-');
            startDate = `${year}-${month}-01`;
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        }

        // Open CSV export URL
        const url = `/api/export/csv?start_date=${startDate}&end_date=${endDate}`;
        window.location.href = url;

    } catch (error) {
        showError(`Failed to export CSV: ${error.message}`);
    }
}

/**
 * Show hourly activity chart for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function showHourlyChart(date) {
    try {
        const chartRow = document.getElementById('hourly-chart-row');
        if (!chartRow) return;

        // Show the chart container
        chartRow.style.display = 'block';

        // Fetch hourly data
        const hourlyData = await fetchHourlyStats(date);

        // Render the chart
        createHourlyActivityChart(hourlyData);

    } catch (error) {
        // Silently hide chart if no hourly data available (404)
        // This is expected for dates without data
        console.info('Hourly chart not available for this date:', error.message);
        hideHourlyChart();
    }
}

/**
 * Hide hourly activity chart
 */
function hideHourlyChart() {
    const chartRow = document.getElementById('hourly-chart-row');
    if (chartRow) {
        chartRow.style.display = 'none';
    }

    // Destroy chart instance if exists
    destroyChart('hourlyActivityChart');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
