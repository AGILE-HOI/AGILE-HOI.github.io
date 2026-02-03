// Quantitative Results Visualization Script

// Data structure from paper's LaTeX tables
const quantitativeData = {
    dexycb: {
        name: 'DexYCB',
        methods: ['Ours', 'HOLD', 'MagicHOI'],
        metrics: {
            mpjpe: {
                name: 'MPJPE (mm)',
                values: [19.06, 30.86, 21.20],
                lowerIsBetter: true,
                description: 'Hand pose accuracy'
            },
            cd: {
                name: 'CD (cm²)',
                values: [0.52, 19.30, 2.05],
                lowerIsBetter: true,
                description: 'Object geometry fidelity'
            },
            f5: {
                name: 'F@5mm (%)',
                values: [83.21, 33.20, 45.67],
                lowerIsBetter: false,
                description: 'Precision at 5mm threshold'
            },
            f10: {
                name: 'F@10mm (%)',
                values: [95.43, 54.94, 67.14],
                lowerIsBetter: false,
                description: 'Precision at 10mm threshold'
            },
            cdh: {
                name: 'CD_h (cm²)',
                values: [94.60, 170.9, 661.90],
                lowerIsBetter: true,
                description: 'Hand-relative object accuracy'
            },
            sr: {
                name: 'SR (%)',
                values: [100.0, 45.0, 25.0],
                lowerIsBetter: false,
                description: 'Success rate'
            }
        },
        successRates: [100.0, 45.0, 25.0]
    },
    ho3d: {
        name: 'HO3D-v3',
        methods: ['Ours', 'HOLD', 'MagicHOI'],
        metrics: {
            mpjpe: {
                name: 'MPJPE (mm)',
                values: [3.92, 22.09, 7.38],
                lowerIsBetter: true,
                description: 'Hand pose accuracy'
            },
            cd: {
                name: 'CD (cm²)',
                values: [0.27, 1.11, 0.90],
                lowerIsBetter: true,
                description: 'Object geometry fidelity'
            },
            f5: {
                name: 'F@5mm (%)',
                values: [86.63, 81.75, 76.74],
                lowerIsBetter: false,
                description: 'Precision at 5mm threshold'
            },
            f10: {
                name: 'F@10mm (%)',
                values: [97.77, 92.42, 91.59],
                lowerIsBetter: false,
                description: 'Precision at 10mm threshold'
            },
            cdh: {
                name: 'CD_h (cm²)',
                values: [15.81, 18.66, 21.81],
                lowerIsBetter: true,
                description: 'Hand-relative object accuracy'
            },
            sr: {
                name: 'SR (%)',
                values: [100.0, 100.0, 83.3],
                lowerIsBetter: false,
                description: 'Success rate'
            }
        },
        successRates: [100.0, 100.0, 83.3]
    }
};

// Color scheme for methods
const methodColors = {
    'Ours': '#8B9D6F',      // Warm green/olive
    'HOLD': '#7B9CB8',       // Soft blue
    'MagicHOI': '#D4A574'    // Warm orange/terracotta
};

// Current state
let currentDataset = 'dexycb';
let currentView = 'table';
let currentChartMode = 'individual';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Render initial table
    renderTable(currentDataset);

    // Setup event listeners
    setupToggleHandlers();
});

// Setup all toggle button handlers
function setupToggleHandlers() {
    // Dataset toggle
    document.querySelectorAll('.dataset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentDataset = btn.dataset.dataset;

            // Update button states
            document.querySelectorAll('.dataset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Re-render current view
            if (currentView === 'table') {
                renderTable(currentDataset);
            } else {
                if (currentChartMode === 'individual') {
                    renderIndividualCharts(currentDataset);
                } else {
                    renderComprehensiveChart(currentDataset);
                }
            }
        });
    });

    // View toggle (Table vs Chart)
    document.querySelectorAll('.quant-viz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentView = btn.dataset.view;

            // Update button states
            document.querySelectorAll('.quant-viz-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update view visibility
            document.querySelectorAll('.quant-view').forEach(v => v.classList.remove('active'));
            document.getElementById(`${currentView}-view`).classList.add('active');

            // Render appropriate view
            if (currentView === 'chart') {
                if (currentChartMode === 'individual') {
                    renderIndividualCharts(currentDataset);
                } else {
                    renderComprehensiveChart(currentDataset);
                }
            }
        });
    });

    // Chart mode toggle
    document.querySelectorAll('.chart-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentChartMode = btn.dataset.mode;

            // Update button states
            document.querySelectorAll('.chart-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Re-render chart
            if (currentChartMode === 'individual') {
                renderIndividualCharts(currentDataset);
            } else {
                renderComprehensiveChart(currentDataset);
            }
        });
    });
}

// Render comparison table
function renderTable(dataset) {
    const data = quantitativeData[dataset];
    const container = document.getElementById('comparison-table');

    let html = '<table class="comparison-table">';

    // Header row
    html += '<thead><tr>';
    html += '<th>Method</th>';
    Object.values(data.metrics).forEach(metric => {
        const arrow = metric.lowerIsBetter ? '↓' : '↑';
        html += `<th class="metric-header">${metric.name} ${arrow}</th>`;
    });
    html += '</tr></thead>';

    // Data rows
    html += '<tbody>';
    data.methods.forEach((method, methodIdx) => {
        const rowClass = method === 'Ours' ? 'ours-row' : '';
        html += `<tr class="${rowClass}">`;

        // Method name with footnote for baselines
        const footnote = method !== 'Ours' ? '<sup>†</sup>' : '';
        html += `<td>${method}${footnote}</td>`;

        // Metric values
        Object.keys(data.metrics).forEach(metricKey => {
            const metric = data.metrics[metricKey];
            const value = metric.values[methodIdx];
            const valueClass = getValueClass(metric.values, methodIdx, metric.lowerIsBetter);
            html += `<td class="${valueClass}">${value.toFixed(2)}</td>`;
        });

        html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;
}

// Determine if value is best or second best
function getValueClass(values, index, lowerIsBetter) {
    const sortedIndices = values
        .map((val, idx) => ({val, idx}))
        .sort((a, b) => lowerIsBetter ? a.val - b.val : b.val - a.val)
        .map(item => item.idx);

    if (sortedIndices[0] === index) return 'best-value';
    if (sortedIndices[1] === index) return 'second-best';
    return '';
}

// Render individual metric charts (6 separate charts)
function renderIndividualCharts(dataset) {
    const data = quantitativeData[dataset];
    const container = document.getElementById('comparison-chart');

    // Clear previous content
    container.innerHTML = '<div class="charts-grid" id="charts-grid"></div>';
    const grid = document.getElementById('charts-grid');

    // Create a chart for each metric
    Object.entries(data.metrics).forEach(([key, metric]) => {
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart-item';
        chartDiv.id = `chart-${key}`;
        grid.appendChild(chartDiv);

        renderSingleBarChart(chartDiv.id, metric, data.methods, dataset);
    });
}

// Render a single bar chart for one metric
function renderSingleBarChart(containerId, metric, methods, dataset) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();

    // Add title
    container.append('div')
        .attr('class', 'chart-title')
        .text(metric.name);

    // Dimensions
    const margin = {top: 20, right: 20, bottom: 60, left: 60};
    const width = 350 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    // Create SVG
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .attr('style', 'max-width: 100%; height: auto;')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale
    const x = d3.scaleBand()
        .domain(methods)
        .range([0, width])
        .padding(0.3);

    // Y scale
    const maxValue = d3.max(metric.values) * 1.1;
    const y = d3.scaleLinear()
        .domain([0, maxValue])
        .range([height, 0]);

    // Bars
    svg.selectAll('.bar')
        .data(methods)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d))
        .attr('width', x.bandwidth())
        .attr('y', (d, i) => y(metric.values[i]))
        .attr('height', (d, i) => height - y(metric.values[i]))
        .attr('fill', d => methodColors[d])
        .attr('opacity', 0.85)
        .on('mouseover', function(d, i) {
            d3.select(this).attr('opacity', 1);
            showTooltip(d, metric.values[methods.indexOf(d)], metric.name);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85);
            hideTooltip();
        });

    // X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('font-size', '12px');

    // Y axis
    svg.append('g')
        .call(d3.axisLeft(y).ticks(5))
        .selectAll('text')
        .style('font-size', '11px');
}

// Render comprehensive normalized chart
function renderComprehensiveChart(dataset) {
    const data = quantitativeData[dataset];
    const container = d3.select('#comparison-chart');

    // Clear previous content
    container.selectAll('*').remove();

    // Add container div
    const chartContainer = container.append('div')
        .attr('class', 'comprehensive-chart');

    // Add legend
    const legend = chartContainer.append('div')
        .attr('class', 'chart-legend');

    data.methods.forEach(method => {
        const item = legend.append('div')
            .attr('class', 'legend-item');

        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', methodColors[method]);

        item.append('span')
            .text(method);
    });

    // Dimensions
    const margin = {top: 40, right: 80, bottom: 80, left: 70};
    const containerWidth = document.getElementById('comparison-chart').offsetWidth;
    const width = Math.min(containerWidth, 900) - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    // Create SVG
    const svg = chartContainer.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .attr('style', 'max-width: 100%; height: auto;')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Normalize data
    const normalizedData = normalizeMetrics(data);

    // Prepare data for grouped bar chart
    const metricKeys = Object.keys(data.metrics);

    // X0 scale (metric groups)
    const x0 = d3.scaleBand()
        .domain(metricKeys)
        .range([0, width])
        .padding(0.2);

    // X1 scale (methods within each metric)
    const x1 = d3.scaleBand()
        .domain(data.methods)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    // Y scale
    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);

    // Draw bars
    metricKeys.forEach(metricKey => {
        const metricGroup = svg.append('g')
            .attr('transform', `translate(${x0(metricKey)},0)`);

        data.methods.forEach((method, methodIdx) => {
            const normalizedValue = normalizedData[metricKey][methodIdx];
            const originalValue = data.metrics[metricKey].values[methodIdx];

            metricGroup.append('rect')
                .attr('x', x1(method))
                .attr('y', y(normalizedValue))
                .attr('width', x1.bandwidth())
                .attr('height', height - y(normalizedValue))
                .attr('fill', methodColors[method])
                .attr('opacity', 0.85)
                .on('mouseover', function() {
                    d3.select(this).attr('opacity', 1);
                    showTooltip(method, originalValue, data.metrics[metricKey].name, normalizedValue);
                })
                .on('mouseout', function() {
                    d3.select(this).attr('opacity', 0.85);
                    hideTooltip();
                });
        });
    });

    // X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x0).tickFormat(key => data.metrics[key].name.split(' ')[0]))
        .selectAll('text')
        .style('font-size', '11px')
        .attr('transform', 'rotate(-15)')
        .style('text-anchor', 'end');

    // Y axis
    svg.append('g')
        .call(d3.axisLeft(y).ticks(10))
        .selectAll('text')
        .style('font-size', '11px');

    // Y axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left + 15)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', '500')
        .text('Normalized Score (100 = Best)');
}

// Normalize metrics to 0-100 scale
function normalizeMetrics(data) {
    const normalized = {};

    Object.entries(data.metrics).forEach(([key, metric]) => {
        const values = metric.values;

        if (metric.lowerIsBetter) {
            // For "lower is better": score = (best_value / current_value) * 100
            const bestValue = Math.min(...values);
            normalized[key] = values.map(v => (bestValue / v) * 100);
        } else {
            // For "higher is better": score = (current_value / best_value) * 100
            const bestValue = Math.max(...values);
            normalized[key] = values.map(v => (v / bestValue) * 100);
        }
    });

    return normalized;
}

// Tooltip functions
let tooltip = null;

function showTooltip(method, value, metricName, normalizedScore = null) {
    if (!tooltip) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'd3-tooltip');
    }

    let html = `<div class="method-name">${method}</div>`;
    html += `<div class="metric-value">${metricName}: ${value.toFixed(2)}</div>`;
    if (normalizedScore !== null) {
        html += `<div style="font-size:0.85rem; margin-top:3px;">Score: ${normalizedScore.toFixed(1)}</div>`;
    }

    tooltip.html(html)
        .classed('show', true);

    // Position tooltip near mouse
    d3.select('body').on('mousemove', function() {
        const event = d3.event;
        tooltip
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 28) + 'px');
    });
}

function hideTooltip() {
    if (tooltip) {
        tooltip.classed('show', false);
    }
}
