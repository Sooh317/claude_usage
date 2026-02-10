// Chart.js configuration and rendering
// This will be fully implemented in Phase 3

// Store chart instances
const chartInstances = {};

/**
 * Destroy a chart instance
 * @param {string} chartId - Canvas element ID
 */
function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

/**
 * Configure Chart.js defaults
 */
function configureChartDefaults() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet');
        return;
    }

    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    Chart.defaults.color = '#6b7280';
}

// Configure defaults when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configureChartDefaults);
} else {
    configureChartDefaults();
}

/**
 * Create Cost Trend Chart (Line chart)
 * @param {Object} data - Statistics data
 */
function createCostTrendChart(data) {
    const daily = data.daily || [data];
    if (!daily || daily.length === 0) return;

    // Show day numbers (1, 2, ...) on x-axis
    const labels = daily.map(d => {
        const parts = d.Date.split('-');
        return parseInt(parts[2], 10);
    });
    const costs = daily.map(d => {
        const v = d['Total Cost ($)'];
        return (typeof v === 'string') ? parseFloat(v.replace('$', '').replace(',', '')) || 0 : (v || 0);
    });

    destroyChart('costTrendChart');

    const ctx = document.getElementById('costTrendChart');
    if (!ctx) return;

    chartInstances['costTrendChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Cost',
                data: costs,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Cost Trend',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Cost: $${context.parsed.y.toFixed(4)}`;
                        },
                        title: function(tooltipItems) {
                            return `Day ${tooltipItems[0].label}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Day of Month'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Shorten a full model ID to a readable legend label.
 * e.g. "claude-sonnet-4-5-20250929" → "Sonnet 4.5"
 * @param {string} modelId
 * @returns {string}
 */
function shortenModelName(modelId) {
    const m = modelId.match(/claude-(\w+)-([\d]+(?:-[\d]+)*)/);
    if (!m) return modelId;
    const family = m[1].charAt(0).toUpperCase() + m[1].slice(1); // Sonnet, Opus, Haiku
    const ver = m[2].split('-').slice(0, 2).join('.');           // "4-5" → "4.5"
    return `${family} ${ver}`;
}

// Palette for per-model datasets (up to 8 models)
const MODEL_COLORS = [
    { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.20)' },
    { border: '#10b981', bg: 'rgba(16, 185, 129, 0.20)' },
    { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.20)' },
    { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.20)' },
    { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.20)' },
    { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.20)' },
    { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.20)' },
    { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.20)' },
];

/**
 * Create Token Trend Chart (Per-model stacked area chart for monthly view)
 * @param {Object} data - Statistics data with daily array
 */
function createTokenTrendChart(data) {
    const daily = data.daily || [data];
    if (!daily || daily.length === 0) return;

    const labels = daily.map(d => {
        const parts = d.Date.split('-');
        return parseInt(parts[2], 10);
    });

    // Collect all model IDs across all days
    const modelSet = new Set();
    daily.forEach(d => {
        const md = d.model_details || {};
        Object.keys(md).forEach(m => modelSet.add(m));
    });
    const models = Array.from(modelSet).sort();

    // Build one stacked dataset per model (total tokens in K)
    const datasets = models.map((model, idx) => {
        const color = MODEL_COLORS[idx % MODEL_COLORS.length];
        const dataPoints = daily.map(d => {
            const md = (d.model_details || {})[model];
            if (!md) return 0;
            const total = (md.input_tokens || 0) + (md.output_tokens || 0)
                        + (md.cache_read_tokens || 0) + (md.cache_creation_tokens || 0);
            return total / 1000;
        });
        return {
            label: shortenModelName(model),
            data: dataPoints,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
            // Stash full model id + daily details for tooltip
            _modelId: model,
            _dailyDetails: daily.map(d => (d.model_details || {})[model] || null),
        };
    });

    // Fallback: if no model_details at all, show legacy total-token view
    if (datasets.length === 0) {
        const toNum = (v) => (typeof v === 'string') ? parseFloat(v.replace(/[$,%]/g, '')) || 0 : (v || 0);
        datasets.push({
            label: 'Total (K)',
            data: daily.map(d => toNum(d['Total Tokens']) / 1000),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
        });
    }

    destroyChart('tokenTrendChart');

    const ctx = document.getElementById('tokenTrendChart');
    if (!ctx) return;

    chartInstances['tokenTrendChart'] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Token Usage by Model',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return `Day ${tooltipItems[0].label}`;
                        },
                        label: function(context) {
                            const ds = context.dataset;
                            const details = ds._dailyDetails && ds._dailyDetails[context.dataIndex];
                            if (details) {
                                const inp = (details.input_tokens || 0) / 1000;
                                const out = (details.output_tokens || 0) / 1000;
                                const cr = (details.cache_read_tokens || 0) / 1000;
                                const cc = (details.cache_creation_tokens || 0) / 1000;
                                const cost = details.cost || 0;
                                return `${ds.label}: ${context.parsed.y.toFixed(1)}K `
                                     + `(In:${inp.toFixed(1)} Out:${out.toFixed(1)} `
                                     + `CR:${cr.toFixed(1)} CW:${cc.toFixed(1)}) `
                                     + `$${cost.toFixed(4)}`;
                            }
                            return `${ds.label}: ${context.parsed.y.toFixed(1)}K`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Day of Month'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Tokens (K)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(0) + 'K';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create Token Usage Chart (Pie chart)
 * @param {Object} data - Statistics data
 */
function createTokenPieChart(data) {
    const stats = data.aggregate || data;
    if (!stats) return;

    const input = stats['Input Tokens'] || 0;
    const output = stats['Output Tokens'] || 0;
    const cacheRead = stats['Cache Read Tokens'] || 0;
    const cacheCreation = stats['Cache Creation Tokens'] || 0;

    destroyChart('tokenPieChart');

    const ctx = document.getElementById('tokenPieChart');
    if (!ctx) return;

    chartInstances['tokenPieChart'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Input', 'Output', 'Cache Read', 'Cache Creation'],
            datasets: [{
                data: [input, output, cacheRead, cacheCreation],
                backgroundColor: [
                    '#3b82f6',  // Blue
                    '#10b981',  // Green
                    '#f59e0b',  // Orange
                    '#8b5cf6'   // Purple
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Token Usage Distribution',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create Model Breakdown Chart (Horizontal bar chart)
 * @param {Object} data - Statistics data
 */
function createModelBarChart(data) {
    const stats = data.aggregate || data;
    if (!stats || !stats['Model Breakdown']) return;

    // Parse "model1: $X, model2: $Y"
    const breakdown = stats['Model Breakdown'];
    const models = [];
    const costs = [];

    const parts = breakdown.split(',');
    parts.forEach(part => {
        const match = part.trim().match(/^(.+?):\s*\$(.+)$/);
        if (match) {
            models.push(match[1].trim());
            costs.push(parseFloat(match[2]));
        }
    });

    if (models.length === 0) return;

    destroyChart('modelBarChart');

    const ctx = document.getElementById('modelBarChart');
    if (!ctx) return;

    chartInstances['modelBarChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: models,
            datasets: [{
                label: 'Cost ($)',
                data: costs,
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',  // Horizontal bars
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Model Cost Breakdown',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.x.toFixed(4)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create Tool Usage Chart (Bar chart)
 * @param {Object} data - Statistics data
 */
function createToolBarChart(data) {
    const stats = data.aggregate || data;
    if (!stats || !stats['Top Tools']) return;

    // Parse "Tool1, Tool2, Tool3"
    const topTools = stats['Top Tools'].split(',').map(t => t.trim()).filter(t => t);

    if (topTools.length === 0) {
        // No tools data
        return;
    }

    // For now, just show the tool names with dummy counts
    // Phase 4 will add detailed tool usage tracking
    const dummyCounts = topTools.map((_, i) => (topTools.length - i) * 10);

    destroyChart('toolBarChart');

    const ctx = document.getElementById('toolBarChart');
    if (!ctx) return;

    chartInstances['toolBarChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topTools,
            datasets: [{
                label: 'Usage Count',
                data: dummyCounts,
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Top Tools Used',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Create Code Activity Chart (Stacked bar chart)
 * @param {Object} data - Statistics data
 */
function createCodeStackChart(data) {
    const daily = data.daily || [data];
    if (!daily || daily.length === 0) return;

    const labels = daily.map(d => d.Date);
    const linesAdded = daily.map(d => d['Lines Added'] || 0);
    const linesRemoved = daily.map(d => d['Lines Removed'] || 0);

    // Check if all values are 0 (no data)
    const hasData = linesAdded.some(v => v > 0) || linesRemoved.some(v => v > 0);

    destroyChart('codeStackChart');

    const ctx = document.getElementById('codeStackChart');
    if (!ctx) return;

    // If no data, show placeholder message
    if (!hasData) {
        const container = ctx.closest('.chart-container');
        if (container) {
            container.innerHTML = \`
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">
                    <div style="text-align: center;">
                        <h3 style="margin-bottom: 0.5rem;">Code Activity</h3>
                        <p>No code metrics available</p>
                        <p style="font-size: 0.875rem; color: #9ca3af;">
                            Code metrics (lines added/removed) are not yet captured by telemetry
                        </p>
                    </div>
                </div>
            \`;
        }
        return;
    }

    // Otherwise, render chart normally
    chartInstances['codeStackChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Lines Added',
                    data: linesAdded,
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1
                },
                {
                    label: 'Lines Removed',
                    data: linesRemoved,
                    backgroundColor: '#ef4444',
                    borderColor: '#dc2626',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Code Activity',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Create Hourly Activity Chart (Multi-line chart)
 * @param {Object} data - Hourly statistics data
 */
function createHourlyActivityChart(data) {
    if (!data || !data.hourly || data.hourly.length === 0) {
        console.warn('No hourly data available');
        return;
    }

    // Convert UTC hours to local time
    let hourly = data.hourly.map(h => {
        const local = utcHourToLocal(h.hour, data.date);
        return { ...h, localHour: local.hour, localTimeRange: local.timeRange };
    });

    // Sort by local hour (0-23)
    hourly.sort((a, b) => a.localHour - b.localHour);

    // For today's data, truncate future hours so current hour is at the right edge
    const isToday = data.date === getToday();
    if (isToday) {
        const currentLocalHour = new Date().getHours();
        hourly = hourly.filter(h => h.localHour <= currentLocalHour);
        if (hourly.length === 0) {
            console.warn('No hourly data available for current hours');
            return;
        }
    }

    // Extract data
    const labels = hourly.map(h => h.localTimeRange);
    const apiCalls = hourly.map(h => h.api_calls || 0);
    const tokensInK = hourly.map(h => (h.total_tokens || 0) / 1000);
    const costs = hourly.map(h => h.total_cost || 0);

    destroyChart('hourlyActivityChart');

    const ctx = document.getElementById('hourlyActivityChart');
    if (!ctx) return;

    chartInstances['hourlyActivityChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'API Calls',
                    data: apiCalls,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y-calls'
                },
                {
                    label: 'Tokens (K)',
                    data: tokensInK,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y-tokens'
                },
                {
                    label: 'Cost ($)',
                    data: costs,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y-cost'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Hourly Activity Pattern',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;

                            if (label === 'API Calls') {
                                return `${label}: ${value.toFixed(0)}`;
                            } else if (label === 'Tokens (K)') {
                                return `${label}: ${value.toFixed(1)}K`;
                            } else if (label === 'Cost ($)') {
                                return `${label}: $${value.toFixed(4)}`;
                            }
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Hour of Day'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                'y-calls': {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'API Calls',
                        color: '#3b82f6'
                    },
                    beginAtZero: true,
                    ticks: {
                        color: '#3b82f6'
                    }
                },
                'y-tokens': {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Tokens (K)',
                        color: '#10b981'
                    },
                    beginAtZero: true,
                    ticks: {
                        color: '#10b981'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                'y-cost': {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    beginAtZero: true
                }
            }
        }
    });
}
