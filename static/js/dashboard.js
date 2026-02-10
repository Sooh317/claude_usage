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

    // Update date picker type
    const datePicker = document.getElementById('date-picker');
    if (newPeriod === 'daily') {
        datePicker.type = 'date';
        datePicker.value = currentDate;
    } else if (newPeriod === 'weekly') {
        datePicker.type = 'date';
        // Set to Monday of current week
        currentDate = getWeekStart(new Date());
        datePicker.value = currentDate;
    } else if (newPeriod === 'monthly') {
        datePicker.type = 'month';
        datePicker.value = getMonthString(new Date());
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
        showError(`Failed to load data: ${error.message}`);
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
