let priceChart = null;

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const ticker = document.getElementById('ticker').value.trim().toUpperCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!ticker) {
        showError('Please enter a stock ticker symbol');
        return;
    }

    // Hide previous results and show loading
    document.getElementById('results').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');

    try {
        const data = await fetchStockData(ticker, startDate, endDate);
        if (!data || data.length === 0) {
            throw new Error('No data found for this ticker and date range');
        }
        
        const forecastMonths = parseInt(document.getElementById('forecastMonths').value) || 0;
        const buyPrice = parseFloat(document.getElementById('buyPrice').value);
        const numShares = parseInt(document.getElementById('numShares').value) || 1;
        analyzeStock(data, ticker, forecastMonths, buyPrice, numShares);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('results').classList.remove('hidden');
    } catch (error) {
        document.getElementById('loading').classList.add('hidden');
        showError(error.message);
    }
});

async function fetchStockData(ticker, startDate, endDate) {
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);
    
    // Strategy 1: Try local proxy server if available (works with both Python and Node servers)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';
    if (isLocalhost) {
        try {
            const proxyUrl = `/api/stock?ticker=${encodeURIComponent(ticker)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
            const response = await fetch(proxyUrl);
            if (response.ok) {
                const csv = await response.text();
                // Check if response is error JSON
                if (csv.trim().startsWith('{') && csv.includes('error')) {
                    throw new Error('Server returned error');
                }
                const parsed = parseCSV(csv);
                if (parsed && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn('Local proxy failed, trying other methods...', error);
        }
    }
    
    // Strategy 2: Try Yahoo Finance v8 API with JSONP-like approach via a working CORS proxy
    try {
        const v8Url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1mo&period1=${period1}&period2=${period2}`;
        
        // Try using corsproxy.io which is more reliable
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(v8Url)}`;
        const response = await fetch(proxiedUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const json = await response.json();
            if (json && json.chart && json.chart.result && json.chart.result[0]) {
                const result = json.chart.result[0];
                const timestamps = result.timestamp || [];
                const closes = result.indicators?.quote?.[0]?.close || [];
                
                if (timestamps.length > 0 && closes.length > 0) {
                    const data = [];
                    for (let i = 0; i < timestamps.length; i++) {
                        if (closes[i] !== null && closes[i] !== undefined && !isNaN(closes[i])) {
                            data.push({
                                date: new Date(timestamps[i] * 1000),
                                close: closes[i]
                            });
                        }
                    }
                    if (data.length > 0) {
                        return data.sort((a, b) => a.date - b.date);
                    }
                }
            }
        }
    } catch (error) {
        console.warn('v8 API via proxy failed, trying alternatives...', error);
    }
    
    // Strategy 3: Try Yahoo Finance download via multiple CORS proxies
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${period1}&period2=${period2}&interval=1mo&events=history&includeAdjustedClose=true`;
    
    const proxyServices = [
        `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
        `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`,
        `https://cors-anywhere.herokuapp.com/${yahooUrl}`,
    ];
    
    for (const proxyUrl of proxyServices) {
        try {
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/csv'
                }
            });
            
            if (!response.ok) {
                continue;
            }
            
            let csv = await response.text();
            
            // Handle allorigins.win wrapper format
            if (csv.includes('{"contents":')) {
                try {
                    const json = JSON.parse(csv);
                    csv = json.contents || csv;
                } catch (e) {
                    // Not JSON wrapped, use as is
                }
            }
            
            if (!csv || csv.trim().length === 0) {
                continue;
            }
            
            // Validate it's actual CSV data
            if (csv.includes('<html>') || csv.includes('Error') || csv.includes('error') || csv.includes('CORS')) {
                continue;
            }
            
            // Check if it has stock data headers
            if (!csv.toLowerCase().includes('date') && !csv.toLowerCase().includes('close')) {
                continue;
            }
            
            const parsed = parseCSV(csv);
            if (parsed && parsed.length > 0) {
                return parsed;
            }
        } catch (error) {
            console.warn('Proxy service failed:', proxyUrl.substring(0, 50) + '...', error.message);
            continue;
        }
    }
    
    // Strategy 4: Try direct fetch (may work with some browser extensions)
    try {
        const response = await fetch(yahooUrl, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'text/csv'
            }
        });
        
        if (response.ok) {
            const csv = await response.text();
            const parsed = parseCSV(csv);
            if (parsed && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn('Direct fetch failed:', error.message);
    }
    
    // If all strategies fail, provide helpful error message with instructions
    let errorMsg = '❌ Could not fetch stock data due to CORS restrictions.\n\n';
    errorMsg += '📋 SOLUTION - Use the Python server:\n\n';
    errorMsg += '1. Open Terminal in this folder\n';
    errorMsg += '2. Run: python3 simple-server.py\n';
    errorMsg += '   (or: python simple-server.py)\n';
    errorMsg += '3. Open the URL shown (e.g., http://localhost:8000)\n';
    errorMsg += '4. Try analyzing the stock again\n\n';
    errorMsg += 'This bypasses all CORS issues!\n\n';
    errorMsg += 'See START-HERE.md for more details.';
    
    throw new Error(errorMsg);
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('Invalid CSV data: insufficient lines');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const closeIndex = headers.indexOf('Close') !== -1 ? headers.indexOf('Close') : 
                      headers.indexOf('Adj Close') !== -1 ? headers.indexOf('Adj Close') : 4;
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle CSV with quoted values
        const values = parseCSVLine(line);
        if (values.length < closeIndex + 1) continue;
        
        const dateStr = values[0].replace(/"/g, '').trim();
        const closeStr = values[closeIndex].replace(/"/g, '').trim();
        
        const date = new Date(dateStr);
        const close = parseFloat(closeStr);
        
        if (!isNaN(close) && !isNaN(date.getTime()) && date.getTime() > 0) {
            data.push({
                date: date,
                close: close
            });
        }
    }
    
    if (data.length === 0) {
        throw new Error('No valid data points found in CSV');
    }
    
    return data.sort((a, b) => a.date - b.date);
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    
    return result;
}

function analyzeStock(data, ticker, forecastMonths = 0, buyPrice = null, numShares = 1) {
    if (data.length < 2) {
        throw new Error('Insufficient data for analysis');
    }

    // Extract monthly close prices
    const monthly = data.map(d => d.close);
    const dates = data.map(d => d.date);

    // Calculate monthly changes ΔS_t
    const delta_S = [0];
    for (let i = 1; i < monthly.length; i++) {
        delta_S.push(monthly[i] - monthly[i - 1]);
    }

    // Decompose into planned (ΔP_t) and unexpected (ΔU_t)
    const avg_change = delta_S.slice(1).reduce((a, b) => a + b, 0) / (delta_S.length - 1);
    const delta_P = new Array(delta_S.length).fill(avg_change);
    delta_P[0] = 0;

    const delta_U = delta_S.map((ds, i) => ds - delta_P[i]);

    // Reconstruct price path (deterministic)
    const S0 = monthly[0];
    const sim_prices_det = [S0];
    for (let i = 1; i < monthly.length; i++) {
        // delta_P[0] is 0, so for index i, we use delta_P[i] and delta_U[i]
        const S_new = sim_prices_det[i - 1] + delta_P[i] + delta_U[i];
        sim_prices_det.push(S_new);
    }

    // Simulate stochastic future path
    const delta_U_std = calculateStdDev(delta_U.slice(1));
    const sim_prices_stoch = [S0];
    // Use a simple seeded random for reproducibility
    let seed = 42;
    for (let i = 1; i < monthly.length; i++) {
        const random_U = seededNormal(seed + i, 0, delta_U_std);
        const S_new = sim_prices_stoch[i - 1] + delta_P[i] + random_U;
        sim_prices_stoch.push(S_new);
    }

    // Generate future predictions if requested
    let predictedDates = [];
    let predictedPrices = [];
    let predictedPricesOptimistic = [];
    let predictedPricesPessimistic = [];
    let finalPredictedPrice = null;

    if (forecastMonths > 0) {
        const lastDate = dates[dates.length - 1];
        const lastPrice = monthly[monthly.length - 1];
        
        // Generate future dates (monthly intervals)
        predictedDates = [];
        predictedPrices = [lastPrice];
        predictedPricesOptimistic = [lastPrice];
        predictedPricesPessimistic = [lastPrice];
        
        for (let i = 1; i <= forecastMonths; i++) {
            const nextDate = new Date(lastDate);
            nextDate.setMonth(nextDate.getMonth() + i);
            predictedDates.push(nextDate);
            
            // Base prediction: use average planned change
            const baseChange = avg_change;
            
            // Generate multiple scenarios
            // Optimistic: avg_change + 0.5 * std
            // Pessimistic: avg_change - 0.5 * std
            // Base: avg_change
            const optimisticChange = baseChange + 0.5 * delta_U_std;
            const pessimisticChange = baseChange - 0.5 * delta_U_std;
            const randomChange = baseChange + seededNormal(seed + 1000 + i, 0, delta_U_std);
            
            predictedPrices.push(predictedPrices[predictedPrices.length - 1] + randomChange);
            predictedPricesOptimistic.push(predictedPricesOptimistic[predictedPricesOptimistic.length - 1] + optimisticChange);
            predictedPricesPessimistic.push(predictedPricesPessimistic[predictedPricesPessimistic.length - 1] + pessimisticChange);
        }
        
        finalPredictedPrice = predictedPrices[predictedPrices.length - 1];
    }

    // Update statistics
    document.getElementById('startingPrice').textContent = `$${S0.toFixed(2)}`;
    document.getElementById('avgChange').textContent = `$${avg_change.toFixed(2)}`;
    document.getElementById('stdDev').textContent = `$${delta_U_std.toFixed(2)}`;
    document.getElementById('finalActual').textContent = `$${monthly[monthly.length - 1].toFixed(2)}`;
    document.getElementById('finalDet').textContent = `$${sim_prices_det[sim_prices_det.length - 1].toFixed(2)}`;
    document.getElementById('finalStoch').textContent = `$${sim_prices_stoch[sim_prices_stoch.length - 1].toFixed(2)}`;
    
    // Show/hide prediction card
    const predictionCard = document.getElementById('predictionCard');
    if (forecastMonths > 0 && finalPredictedPrice) {
        predictionCard.style.display = 'block';
        document.getElementById('predictedPrice').textContent = `$${finalPredictedPrice.toFixed(2)}`;
        document.getElementById('predictedPrice').title = `After ${forecastMonths} month(s)`;
    } else {
        predictionCard.style.display = 'none';
    }

    // Calculate and display profit if buy price is provided
    calculateProfit(buyPrice, numShares, monthly[monthly.length - 1], finalPredictedPrice, forecastMonths);

    // Create chart with predictions
    createChart(dates, monthly, sim_prices_det, sim_prices_stoch, ticker, 
                predictedDates, predictedPrices, predictedPricesOptimistic, predictedPricesPessimistic,
                buyPrice);

    // Show big moves (threshold is 1.5 * standard deviation)
    const thresholdValue = delta_U_std * 1.5;
    showBigMoves(dates, delta_U, thresholdValue);
}

function calculateProfit(buyPrice, numShares, currentPrice, predictedPrice, forecastMonths) {
    const profitSection = document.getElementById('profitSection');
    
    if (!buyPrice || buyPrice <= 0) {
        profitSection.classList.add('hidden');
        return;
    }
    
    profitSection.classList.remove('hidden');
    
    // Calculate current profit/loss
    const currentValue = currentPrice * numShares;
    const totalCost = buyPrice * numShares;
    const currentProfit = currentValue - totalCost;
    const currentProfitPercent = ((currentPrice - buyPrice) / buyPrice) * 100;
    
    // Display current profit
    const currentProfitCard = document.getElementById('currentProfitCard');
    const profitValueEl = document.getElementById('currentProfit');
    const profitPercentEl = document.getElementById('currentProfitPercent');
    const profitDetailsEl = document.getElementById('currentProfitDetails');
    
    const profitColor = currentProfit >= 0 ? 'profit-positive' : 'profit-negative';
    profitValueEl.className = `profit-value ${profitColor}`;
    profitValueEl.textContent = currentProfit >= 0 ? 
        `+$${currentProfit.toFixed(2)}` : 
        `-$${Math.abs(currentProfit).toFixed(2)}`;
    
    profitPercentEl.className = `profit-percentage ${profitColor}`;
    profitPercentEl.textContent = currentProfitPercent >= 0 ? 
        `+${currentProfitPercent.toFixed(2)}%` : 
        `${currentProfitPercent.toFixed(2)}%`;
    
    profitDetailsEl.textContent = `${numShares} share${numShares > 1 ? 's' : ''} @ $${buyPrice.toFixed(2)} = $${currentPrice.toFixed(2)}`;
    
    // Calculate predicted profit if forecast is available
    const predictedProfitCard = document.getElementById('predictedProfitCard');
    if (predictedPrice && forecastMonths > 0) {
        const predictedValue = predictedPrice * numShares;
        const predictedProfit = predictedValue - totalCost;
        const predictedProfitPercent = ((predictedPrice - buyPrice) / buyPrice) * 100;
        
        predictedProfitCard.style.display = 'block';
        
        const predProfitValueEl = document.getElementById('predictedProfit');
        const predProfitPercentEl = document.getElementById('predictedProfitPercent');
        const predProfitDetailsEl = document.getElementById('predictedProfitDetails');
        
        const predProfitColor = predictedProfit >= 0 ? 'profit-positive' : 'profit-negative';
        predProfitValueEl.className = `profit-value ${predProfitColor}`;
        predProfitValueEl.textContent = predictedProfit >= 0 ? 
            `+$${predictedProfit.toFixed(2)}` : 
            `-$${Math.abs(predictedProfit).toFixed(2)}`;
        
        predProfitPercentEl.className = `profit-percentage ${predProfitColor}`;
        predProfitPercentEl.textContent = predictedProfitPercent >= 0 ? 
            `+${predictedProfitPercent.toFixed(2)}%` : 
            `${predictedProfitPercent.toFixed(2)}%`;
        
        predProfitDetailsEl.textContent = `After ${forecastMonths} month${forecastMonths > 1 ? 's' : ''} @ $${predictedPrice.toFixed(2)}`;
    } else {
        predictedProfitCard.style.display = 'none';
    }
}

function calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

// Seeded random number generator for reproducibility
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function seededNormal(seed, mean, stdDev) {
    // Box-Muller transform
    let u1 = seededRandom(seed);
    let u2 = seededRandom(seed + 1);
    
    // Avoid u1 being 0 or too close to 0 (would cause log(0))
    if (u1 === 0 || u1 < 0.0001) {
        u1 = 0.0001;
    }
    
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
}

function createChart(dates, actual, deterministic, stochastic, ticker, 
                    predictedDates = [], predictedPrices = [], 
                    predictedOptimistic = [], predictedPessimistic = [],
                    buyPrice = null) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    if (priceChart) {
        priceChart.destroy();
    }

    // Combine historical and predicted dates
    const allDates = [...dates];
    const allActual = [...actual];
    
    // Add null values for predicted dates to create gap in historical line
    if (predictedDates.length > 0) {
        const lastHistoricalDate = dates[dates.length - 1];
        allDates.push(null); // Gap marker
        allActual.push(null);
        
        // Add predicted dates
        allDates.push(...predictedDates);
        // Add last historical value to connect
        allActual.push(actual[actual.length - 1], ...predictedPrices);
    }

    const datasets = [
        {
            label: `Actual ${ticker} Price`,
            data: actual.map((price, i) => ({ x: dates[i], y: price })),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.1
        },
        {
            label: 'Deterministic Model',
            data: deterministic.map((price, i) => ({ x: dates[i], y: price })),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.1
        },
        {
            label: 'Stochastic Simulation',
            data: stochastic.map((price, i) => ({ x: dates[i], y: price })),
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            borderWidth: 2,
            borderDash: [2, 2],
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.1
        }
    ];

    // Add prediction datasets if available
    if (predictedDates.length > 0 && predictedPrices.length > 0) {
        const lastHistoricalDate = dates[dates.length - 1];
        const lastHistoricalPrice = actual[actual.length - 1];
        
        // Prediction line (connect to last historical point)
        const predictionData = [
            { x: lastHistoricalDate, y: lastHistoricalPrice },
            ...predictedPrices.map((price, i) => ({ x: predictedDates[i], y: price }))
        ];
        
        datasets.push({
            label: `Predicted Price (${predictedDates.length} month${predictedDates.length > 1 ? 's' : ''})`,
            data: predictionData,
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            borderWidth: 2.5,
            borderDash: [10, 5],
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.1
        });

        // Optimistic scenario
        if (predictedOptimistic.length > 0) {
            const optimisticData = [
                { x: lastHistoricalDate, y: lastHistoricalPrice },
                ...predictedOptimistic.map((price, i) => ({ x: predictedDates[i], y: price }))
            ];
            
            datasets.push({
                label: 'Optimistic Scenario',
                data: optimisticData,
                borderColor: 'rgba(34, 197, 94, 0.5)',
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                borderWidth: 1.5,
                borderDash: [5, 10],
                pointRadius: 0,
                tension: 0.1,
                fill: false
            });
        }

        // Pessimistic scenario
        if (predictedPessimistic.length > 0) {
            const pessimisticData = [
                { x: lastHistoricalDate, y: lastHistoricalPrice },
                ...predictedPessimistic.map((price, i) => ({ x: predictedDates[i], y: price }))
            ];
            
            datasets.push({
                label: 'Pessimistic Scenario',
                data: pessimisticData,
                borderColor: 'rgba(239, 68, 68, 0.5)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                borderWidth: 1.5,
                borderDash: [5, 10],
                pointRadius: 0,
                tension: 0.1,
                fill: false
            });
        }
    }
    
    // Add buy price reference line if provided
    if (buyPrice && buyPrice > 0) {
        const allDatesCombined = [...dates];
        if (predictedDates.length > 0) {
            allDatesCombined.push(...predictedDates);
        }
        const firstDate = dates[0];
        const lastDate = predictedDates.length > 0 ? predictedDates[predictedDates.length - 1] : dates[dates.length - 1];
        
        datasets.push({
            label: `Buy Price @ $${buyPrice.toFixed(2)}`,
            data: [
                { x: firstDate, y: buyPrice },
                { x: lastDate, y: buyPrice }
            ],
            borderColor: 'rgba(59, 130, 246, 0.7)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            borderDash: [15, 5],
            pointRadius: 0,
            tension: 0,
            fill: false
        });
    }

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: predictedDates.length > 0 ? 
                        `${ticker}: Price Analysis with ${predictedDates.length}-Month Forecast` : 
                        `${ticker}: Real vs Baseball-Math Modelled Price Path`,
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    padding: 20
                },
                legend: {
                    display: true,
                    position: 'top',
                    padding: 15
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Price (USD)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                },
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'MMM yyyy'
                        },
                        tooltipFormat: 'MMM dd, yyyy'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    // Add annotations for big moves manually since Chart.js annotation plugin might not be loaded
    // This is a simplified version - the chart will show the data, and we'll list big moves separately
}

function showBigMoves(dates, delta_U, thresholdValue) {
    const bigMovesList = document.getElementById('bigMovesList');
    bigMovesList.innerHTML = '';

    const bigMoves = [];
    for (let i = 0; i < delta_U.length; i++) {
        if (Math.abs(delta_U[i]) >= thresholdValue) {
            bigMoves.push({
                date: dates[i],
                value: delta_U[i]
            });
        }
    }

    if (bigMoves.length === 0) {
        bigMovesList.innerHTML = '<p style="color: #666; padding: 20px; text-align: center;">No significant unexpected moves detected.</p>';
        return;
    }

    bigMoves.forEach(move => {
        const item = document.createElement('div');
        item.className = `big-move-item ${move.value >= 0 ? 'positive' : 'negative'}`;
        item.innerHTML = `
            <span class="date">${move.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span class="value">${move.value >= 0 ? '+' : ''}$${move.value.toFixed(2)}</span>
        `;
        bigMovesList.appendChild(item);
    });
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    // Convert newlines to HTML breaks
    const formattedMessage = message.replace(/\n/g, '<br>');
    errorDiv.innerHTML = `<strong>⚠️ Error:</strong><br>${formattedMessage}`;
    errorDiv.classList.remove('hidden');
    
    // Scroll to error
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Allow Enter key to trigger analysis
document.getElementById('ticker').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('analyzeBtn').click();
    }
});

// Set default end date to today
document.getElementById('endDate').valueAsDate = new Date();

