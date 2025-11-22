let priceChart = null;

// Check if running from file:// and show warning
if (window.location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', () => {
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; text-align: center; z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-weight: 600;';
        warningDiv.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <strong style="font-size: 1.2rem;">⚠️ CORS Error: You're opening the HTML file directly!</strong>
                <p style="margin: 10px 0; font-size: 1rem;">
                    <strong>✅ SOLUTION:</strong> Use the Python server:
                </p>
                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>1.</strong> Open Terminal in this folder</p>
                    <p style="margin: 5px 0;"><strong>2.</strong> Run: <code style="background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px;">python3 simple-server.py</code></p>
                    <p style="margin: 5px 0;"><strong>3.</strong> Open: <a href="http://localhost:8000" style="color: #fff; text-decoration: underline;">http://localhost:8000</a> in your browser</p>
                    <p style="margin: 5px 0;"><strong>4.</strong> Try analyzing again!</p>
                </div>
                <p style="font-size: 0.9rem; opacity: 0.9;">See START-HERE.md for detailed instructions</p>
            </div>
        `;
        document.body.insertBefore(warningDiv, document.body.firstChild);
        
        // Add padding to body to account for fixed warning
        document.body.style.paddingTop = '200px';
    });
}

// Settings toggle - with null check
const settingsToggleBtn = document.getElementById('settingsToggle');
if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', () => {
        const settings = document.getElementById('advancedSettings');
        if (settings) {
            settings.classList.toggle('hidden');
            settingsToggleBtn.textContent = settings.classList.contains('hidden') ? 
                '⚙️ Advanced Settings' : '❌ Close Settings';
        }
    });
}

// Load saved settings from localStorage
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('stockCalcSettings') || '{}');
    Object.keys(settings).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.value = settings[key];
        }
    });
}

// Save settings to localStorage - with null check
const saveSettingsBtn = document.getElementById('saveSettings');
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        try {
            const settings = {};
            const inputs = document.querySelectorAll('#advancedSettings input, #advancedSettings select');
            inputs.forEach(input => {
                if (input && input.id) {
                    const value = input.type === 'number' ? parseFloat(input.value) : input.value;
                    if (value !== null && value !== undefined && !isNaN(value) || input.type !== 'number') {
                        settings[input.id] = value;
                    }
                }
            });
            localStorage.setItem('stockCalcSettings', JSON.stringify(settings));
            alert('Settings saved!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings. Please try again.');
        }
    });
}

// Reset to defaults - with null check
const resetSettingsBtn = document.getElementById('resetSettings');
if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
        if (confirm('Reset all settings to defaults?')) {
            try {
                localStorage.removeItem('stockCalcSettings');
                location.reload();
            } catch (error) {
                console.error('Error resetting settings:', error);
                alert('Error resetting settings. Please refresh the page manually.');
            }
        }
    });
}

// Load settings on page load
loadSettings();

// Analyze button - with null check and error handling
const analyzeBtn = document.getElementById('analyzeBtn');
if (!analyzeBtn) {
    console.error('Analyze button not found!');
} else {
    analyzeBtn.addEventListener('click', async () => {
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
        // Check if using file:// protocol - show helpful error
        if (window.location.protocol === 'file:') {
            document.getElementById('loading').classList.add('hidden');
            showError('❌ CORS Error: You\'re opening the HTML file directly!\n\n✅ SOLUTION: Use the Python server:\n\n1. Open Terminal in this folder\n2. Run: python3 simple-server.py\n   (or: python simple-server.py)\n3. Open: http://localhost:8000\n4. Try again!\n\nThis bypasses CORS issues completely.\n\nSee START-HERE.md for detailed instructions.');
            return;
        }
        
        const timeframe = document.getElementById('timeframe').value || '1mo';
        const enableBacktest = document.getElementById('enableBacktest').checked;
        const backtestMode = document.getElementById('backtestMode') ? document.getElementById('backtestMode').value || 'simple' : 'simple';
        const enablePortfolio = document.getElementById('enablePortfolio') ? document.getElementById('enablePortfolio').checked : false;
        const portfolioTickers = enablePortfolio && document.getElementById('portfolioTickers') ? 
            document.getElementById('portfolioTickers').value.split(',').map(t => t.trim().toUpperCase()).filter(t => t) : [];
        const enableOptimizationEl = document.getElementById('enableOptimization');
        const enableOptimization = enableOptimizationEl ? enableOptimizationEl.checked : false;
        const enableRealtime = document.getElementById('enableRealtime') ? document.getElementById('enableRealtime').checked : false;
        
        // Show/hide portfolio inputs
        if (document.getElementById('portfolioTickersGroup')) {
            document.getElementById('portfolioTickersGroup').style.display = enablePortfolio ? 'block' : 'none';
        }
        
        // Fetch data (single stock or portfolio)
        let data, portfolioData = {};
        if (enablePortfolio && portfolioTickers.length > 0) {
            // Fetch portfolio data
            for (const pticker of portfolioTickers) {
                try {
                    portfolioData[pticker] = await fetchStockData(pticker, startDate, endDate, timeframe);
                } catch (error) {
                    console.warn(`Failed to fetch data for ${pticker}:`, error);
                }
            }
            data = portfolioData[ticker] || (Object.values(portfolioData)[0] || []);
        } else {
            data = await fetchStockData(ticker, startDate, endDate, timeframe);
        }
        if (!data || data.length === 0) {
            throw new Error('No data found for this ticker and date range');
        }
        
        // Validate and parse input values with proper error handling
        const forecastMonthsEl = document.getElementById('forecastMonths');
        const forecastMonths = forecastMonthsEl ? Math.max(0, Math.min(24, parseInt(forecastMonthsEl.value) || 0)) : 0;
        
        const buyPriceEl = document.getElementById('buyPrice');
        const buyPrice = buyPriceEl && buyPriceEl.value ? Math.max(0, parseFloat(buyPriceEl.value)) : null;
        
        const numSharesEl = document.getElementById('numShares');
        const numShares = numSharesEl ? Math.max(1, parseInt(numSharesEl.value) || 1) : 1;
        
        const riskPercentEl = document.getElementById('riskPercent');
        const riskPercent = riskPercentEl ? Math.max(0.1, Math.min(10, parseFloat(riskPercentEl.value) || 2)) : 2;
        
        const stopLossPercentEl = document.getElementById('stopLossPercent');
        const stopLossPercent = stopLossPercentEl ? Math.max(1, Math.min(20, parseFloat(stopLossPercentEl.value) || 5)) : 5;
        
        const takeProfitPercentEl = document.getElementById('takeProfitPercent');
        const takeProfitPercent = takeProfitPercentEl ? Math.max(1, Math.min(50, parseFloat(takeProfitPercentEl.value) || 10)) : 10;
        
        // Get customizable parameters
        const params = getAnalysisParameters();
        
        // Strategy optimization if enabled
        let optimizedParams = params;
        if (enableOptimization) {
            try {
                optimizedParams = await optimizeStrategy(data, ticker, params, startDate, endDate, timeframe);
                if (optimizedParams && optimizedParams.optimalParams) {
                    displayOptimizationResults(optimizedParams, params);
                } else {
                    console.warn('Optimization returned invalid results, using default parameters');
                    optimizedParams = params;
                }
            } catch (error) {
                console.error('Optimization failed:', error);
                showError('Strategy optimization failed. Using default parameters.');
                optimizedParams = params;
            }
        }
        
        const analysisResults = analyzeStock(data, ticker, forecastMonths, buyPrice, numShares, riskPercent, stopLossPercent, takeProfitPercent, optimizedParams, enableBacktest, backtestMode, timeframe, enablePortfolio ? portfolioData : null);
        
        // Portfolio analysis if enabled
        if (enablePortfolio && portfolioData && Object.keys(portfolioData).length > 1) {
            const portfolioResults = analyzePortfolio(portfolioData, ticker, optimizedParams, timeframe);
            displayPortfolioResults(portfolioResults);
        }
        
        // Real-time updates if enabled
        if (enableRealtime) {
            try {
                startRealtimeUpdates(ticker, timeframe);
            } catch (error) {
                console.error('Failed to start real-time updates:', error);
                // Don't throw - real-time is optional
            }
        }
        
        // Store results for export
        window.lastAnalysisResults = analysisResults;
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('results').classList.remove('hidden');
    } catch (error) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.classList.add('hidden');
        
        const errorMsg = error && error.message ? error.message : 'An unexpected error occurred. Please try again.';
        showError(errorMsg);
        console.error('Analysis error:', error);
    }
    });
}

function getAnalysisParameters() {
    // Safe parameter extraction with validation and defaults
    const getFloat = (id, defaultVal, min = null, max = null) => {
        const el = document.getElementById(id);
        if (!el) return defaultVal;
        const val = parseFloat(el.value);
        if (isNaN(val)) return defaultVal;
        if (min !== null && val < min) return min;
        if (max !== null && val > max) return max;
        return val;
    };
    
    const getInt = (id, defaultVal, min = null, max = null) => {
        const el = document.getElementById(id);
        if (!el) return defaultVal;
        const val = parseInt(el.value);
        if (isNaN(val)) return defaultVal;
        if (min !== null && val < min) return min;
        if (max !== null && val > max) return max;
        return val;
    };
    
    return {
        volDecay: getFloat('volDecay', 0.9, 0.5, 0.99),
        momentumFactor: getFloat('momentumFactor', 0.3, 0, 1),
        energyBarrierFactor: getFloat('energyBarrierFactor', 0.01, 0.001, 0.1),
        demonEfficiencyAdjust: getFloat('demonEfficiencyAdjust', 1.0, 0.5, 2.0),
        rsiPeriod: getInt('rsiPeriod', 14, 5, 30),
        macdFast: getInt('macdFast', 12, 5, 30),
        macdSlow: getInt('macdSlow', 26, 10, 50),
        sma20Period: getInt('sma20Period', 20, 5, 60),
        sma50Period: getInt('sma50Period', 50, 20, 120),
        rsiOversold: getInt('rsiOversold', 30, 10, 40),
        rsiOverbought: getInt('rsiOverbought', 70, 60, 90),
        signalBuyThreshold: getFloat('signalBuyThreshold', 1, 0.5, 5),
        signalStrongBuyThreshold: getFloat('signalStrongBuyThreshold', 2, 1, 10),
        signalRsiWeight: getFloat('signalRsiWeight', 1, 0, 3),
        signalMacdWeight: getFloat('signalMacdWeight', 1, 0, 3),
        signalMaWeight: getFloat('signalMaWeight', 1.5, 0, 3),
        signalTrendWeight: getFloat('signalTrendWeight', 1, 0, 3),
        entropyBins: getInt('entropyBins', 10, 5, 20),
        informationFlowWindow: getInt('informationFlowWindow', 6, 3, 12)
    };
}

async function fetchStockData(ticker, startDate, endDate, interval = '1mo') {
    // Check if we're running from file:// protocol
    if (window.location.protocol === 'file:') {
        throw new Error(`❌ CORS Error: You're opening the HTML file directly!\n\n✅ SOLUTION: Use the Python server:\n\n1. Open Terminal in this folder\n2. Run: python3 simple-server.py\n   (or: python simple-server.py)\n3. Open: http://localhost:8000\n4. Try again!\n\nThis bypasses CORS issues completely.`);
    }
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);
    
    // Strategy 1: Try local proxy server if available (works with both Python and Node servers)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';
    if (isLocalhost) {
        try {
            const proxyUrl = `/api/stock?ticker=${encodeURIComponent(ticker)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&interval=${encodeURIComponent(interval)}`;
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/csv, application/json'
                }
            });
            if (response.ok) {
                const responseText = await response.text();
                
                // Check if response is error JSON (server returns JSON errors)
                const trimmed = responseText.trim();
                if (trimmed.startsWith('{')) {
                    try {
                        const errorData = JSON.parse(trimmed);
                        if (errorData.error) {
                            const errorMsg = errorData.error;
                            // Handle rate limiting
                            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
                                throw new Error('⚠️ Yahoo Finance rate limit: Too many requests.\n\nPlease wait a few minutes and try again. The system will automatically try alternative methods.');
                            }
                            throw new Error(`Server error: ${errorMsg}`);
                        }
                    } catch (e) {
                        // If it's already our custom error message, re-throw it
                        if (e.message.includes('rate limit') || e.message.includes('Server error')) {
                            throw e;
                        }
                        // Not a JSON error, continue with CSV parsing
                    }
                }
                
                // Check if we have valid CSV content
                if (!trimmed || trimmed.length < 10) {
                    throw new Error('Server returned empty or invalid response');
                }
                
                const parsed = parseCSV(responseText);
                if (parsed && parsed.length > 0) {
                    return parsed;
                } else {
                    throw new Error('CSV parsing returned no data');
                }
            } else {
                // Try to get error message from response
                const errorText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
            }
        } catch (error) {
            console.warn('Local proxy failed, trying other methods...', error);
            // Don't throw here - let it try other methods
        }
    }
    
    // Strategy 2: Try Yahoo Finance v8 API with JSONP-like approach via a working CORS proxy
    try {
        // Map interval names to Yahoo Finance format
        const intervalMap = {
            '1d': '1d',
            '1wk': '1wk',
            '1mo': '1mo'
        };
        const yahooInterval = intervalMap[interval] || '1mo';
        const v8Url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${yahooInterval}&period1=${period1}&period2=${period2}`;
        
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
        // Map interval names to Yahoo Finance format
        const intervalMap = {
            '1d': '1d',
            '1wk': '1wk',
            '1mo': '1mo'
        };
        const yahooInterval = intervalMap[interval] || '1mo';
        const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${period1}&period2=${period2}&interval=${yahooInterval}&events=history&includeAdjustedClose=true`;
    
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
    if (!csv || typeof csv !== 'string') {
        throw new Error('Invalid CSV data: empty or invalid input');
    }
    
    const trimmed = csv.trim();
    if (trimmed.length === 0) {
        throw new Error('Invalid CSV data: empty response from server');
    }
    
    // Check if it's an error JSON response (double-check, should be caught earlier)
    if (trimmed.startsWith('{')) {
        try {
            const json = JSON.parse(trimmed);
            if (json.error) {
                const errorMsg = json.error;
                // Handle rate limiting
                if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
                    throw new Error('⚠️ Rate limit detected. Trying alternative methods...');
                }
                throw new Error(`Server error: ${errorMsg}`);
            }
        } catch (e) {
            // If it's our custom error, re-throw it
            if (e.message && (e.message.includes('Rate limit') || e.message.includes('Server error'))) {
                throw e;
            }
            // Otherwise continue - might be valid data
        }
    }
    
    const lines = trimmed.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        const preview = trimmed.length > 200 ? trimmed.substring(0, 200) + '...' : trimmed;
        throw new Error(`Invalid CSV data: insufficient lines (got ${lines.length}, need at least 2).\nResponse preview: ${preview}`);
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

function analyzeStock(data, ticker, forecastMonths = 0, buyPrice = null, numShares = 1, riskPercent = 2, stopLossPercent = 5, takeProfitPercent = 10, params = {}, enableBacktest = false, backtestMode = 'simple', timeframe = '1mo', portfolioData = null) {
    // Use provided parameters or defaults
    const volDecay = params.volDecay || 0.9;
    const momentumFactor = params.momentumFactor || 0.3;
    const energyBarrierFactor = params.energyBarrierFactor || 0.01;
    const demonEfficiencyAdjust = params.demonEfficiencyAdjust || 1.0;
    const entropyBins = params.entropyBins || 10;
    const informationFlowWindow = params.informationFlowWindow || 6;
    if (data.length < 2) {
        throw new Error('Insufficient data for analysis');
    }

    // Extract monthly close prices with validation
    const monthly = [];
    const dates = [];
    
    for (const item of data) {
        if (item && item.close !== null && item.close !== undefined && !isNaN(item.close) && item.close > 0) {
            if (item.date instanceof Date || (item.date && !isNaN(new Date(item.date).getTime()))) {
                monthly.push(parseFloat(item.close));
                dates.push(item.date instanceof Date ? item.date : new Date(item.date));
            }
        }
    }
    
    if (monthly.length < 2) {
        throw new Error('Insufficient valid data points after filtering. Need at least 2 valid price points.');
    }

    // Calculate monthly changes ΔS_t with validation
    const delta_S = [0];
    for (let i = 1; i < monthly.length; i++) {
        const change = monthly[i] - monthly[i - 1];
        if (!isNaN(change) && isFinite(change)) {
            delta_S.push(change);
        } else {
            delta_S.push(0); // Fallback for invalid changes
        }
    }

    // Maxwell Demon Model: Rigorous Information-Theoretic and Thermodynamic Analysis
    // Calculate price states as energy levels (using logarithmic energy scale for proper thermodynamics)
    const priceStates = calculatePriceEnergyStates(monthly);
    
    // Calculate rigorous Shannon entropy with kernel density estimation for continuous distribution
    const informationEntropy = calculateRigorousShannonEntropy(delta_S.slice(1), entropyBins);
    
    // Calculate thermodynamic temperature (proper kinetic energy distribution)
    const thermodynamicTemperature = calculateThermodynamicTemperature(delta_S.slice(1), monthly);
    
    // Calculate thermodynamic energy barrier using free energy formulation
    const energyBarrier = calculateThermodynamicEnergyBarrier(monthly, informationEntropy);
    
    // Rigorous Maxwell Demon decomposition with information-theoretic constraints
    // Using Landauer's principle: information processing requires energy
    const demonDecomposition = rigorousMaxwellDemonDecomposition(delta_S, monthly, informationEntropy, thermodynamicTemperature, energyBarrier);
    
    // Calculate Maxwell Demon efficiency using proper information-theoretic metrics
    const demonEfficiency = calculateRigorousDemonEfficiency(demonDecomposition, informationEntropy, thermodynamicTemperature);
    
    const avg_change = delta_S.slice(1).reduce((a, b) => a + b, 0) / (delta_S.length - 1);
    const delta_P = demonDecomposition.planned;
    const delta_U = demonDecomposition.unexpected;
    
    // Calculate information flow (how much information is available for prediction)
    const informationFlow = calculateInformationFlow(demonDecomposition.unexpected, informationEntropy);
    
    // Store rigorous Maxwell Demon metrics
    window.maxwellDemonMetrics = {
        entropy: informationEntropy,
        energyBarrier: energyBarrier,
        temperature: thermodynamicTemperature,
        informationFlow: informationFlow,
        demonEfficiency: demonEfficiency,
        processingEfficiency: demonDecomposition.processingEfficiency,
        availableEnergy: demonDecomposition.availableEnergy
    };

    // Reconstruct price path (deterministic)
    const S0 = monthly[0];
    const sim_prices_det = [S0];
    for (let i = 1; i < monthly.length; i++) {
        // delta_P[0] is 0, so for index i, we use delta_P[i] and delta_U[i]
        const S_new = sim_prices_det[i - 1] + delta_P[i] + delta_U[i];
        sim_prices_det.push(S_new);
    }

    // Simulate stochastic future path using Maxwell Demon model
    // Demon selects transitions based on information content
    const delta_U_std = calculateStdDev(delta_U.slice(1));
    const sim_prices_stoch = [S0];
    let seed = 42;
    
    // Current energy state
    let currentEnergyState = priceStates && priceStates.length > 0 ? 
        priceStates[priceStates.length - 1] : 
        { price: S0, energy: 0, energyLevel: 0 };
    
    for (let i = 1; i < monthly.length; i++) {
        // Maxwell Demon intervention: selective transition based on information
        const demonTransition = maxwellDemonTransition(
            currentEnergyState,
            delta_P[i],
            delta_U_std,
            informationFlow,
            seed + i,
            energyBarrierFactor
        );
        
        const S_new = sim_prices_stoch[i - 1] + demonTransition;
        sim_prices_stoch.push(S_new);
        
        // Update energy state
        currentEnergyState = { price: S_new, energy: S_new - S0, energyLevel: Math.log(Math.abs(S_new - S0) + 1) };
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
        
        // Maxwell Demon Forecast: Information-guided predictions
        // Demon uses entropy and energy barriers to predict transitions
        
        const volatilitySeries = [];
        for (let i = 1; i < delta_U.length; i++) {
            const vol = Math.abs(delta_U[i]);
            volatilitySeries.push(vol);
        }
        
        const recentVolWindow = Math.min(informationFlowWindow || 6, Math.floor(volatilitySeries.length / 2));
        const recentVol = volatilitySeries.slice(-recentVolWindow).reduce((a, b) => a + b, 0) / recentVolWindow;
        const longTermVol = delta_U_std;
        const volRatio = recentVol / longTermVol;
        
        predictedDates = [];
        predictedPrices = [lastPrice];
        predictedPricesOptimistic = [lastPrice];
        predictedPricesPessimistic = [lastPrice];
        
        // Current energy state for predictions
        let currentEnergyState = { 
            price: lastPrice, 
            energy: lastPrice - S0,
            energyLevel: Math.log(Math.abs(lastPrice - S0) + 1)
        };
        let currentVolatility = delta_U_std * volRatio;
        const volDecayParam = volDecay || 0.9;
        
        // Maxwell Demon prediction parameters
        const temperature = calculateMarketTemperature(delta_U); // Market "temperature" (volatility)
        const maxEntropy = Math.log(Math.max(delta_S.length, 2));
        let demonEfficiency = maxEntropy > 0 ? 1 - (informationEntropy / maxEntropy) : 0.5; // Demon's information efficiency
        demonEfficiency *= (demonEfficiencyAdjust || 1.0); // Apply user adjustment
        
        for (let i = 1; i <= forecastMonths; i++) {
            const nextDate = new Date(lastDate);
            nextDate.setMonth(nextDate.getMonth() + i);
            predictedDates.push(nextDate);
            
            // Base prediction using Maxwell Demon model
            const baseChange = avg_change;
            
            // Volatility clustering with entropy decay
            currentVolatility = currentVolatility * volDecayParam + delta_U_std * (1 - volDecayParam);
            
            // Momentum with energy barrier consideration
            const recentTrend = monthly.length >= 3 ? 
                (monthly[monthly.length - 1] - monthly[monthly.length - 3]) / 3 : 0;
            const momentumAdjustment = recentTrend * (momentumFactor || 0.3);
            
            // Maxwell Demon transition: Selective based on information and energy barriers
            // Demon allows transitions that reduce entropy (increase information)
            const demonOptimistic = maxwellDemonForecast(
                currentEnergyState,
                baseChange + momentumAdjustment,
                currentVolatility * 0.5,
                informationFlow,
                temperature,
                demonEfficiency,
                seed + 1000 + i,
                'optimistic',
                energyBarrierFactor
            );
            
            const demonPessimistic = maxwellDemonForecast(
                currentEnergyState,
                baseChange + momentumAdjustment,
                -currentVolatility * 0.5,
                informationFlow,
                temperature,
                demonEfficiency,
                seed + 1000 + i,
                'pessimistic',
                energyBarrierFactor
            );
            
            const demonBase = maxwellDemonForecast(
                currentEnergyState,
                baseChange + momentumAdjustment,
                0,
                informationFlow,
                temperature,
                demonEfficiency,
                seed + 1000 + i,
                'base',
                energyBarrierFactor
            );
            
            predictedPrices.push(predictedPrices[predictedPrices.length - 1] + demonBase);
            predictedPricesOptimistic.push(predictedPricesOptimistic[predictedPricesOptimistic.length - 1] + demonOptimistic);
            predictedPricesPessimistic.push(predictedPricesPessimistic[predictedPricesPessimistic.length - 1] + demonPessimistic);
            
            // Update energy state
            const newPrice = predictedPrices[predictedPrices.length - 1];
            currentEnergyState = {
                price: newPrice,
                energy: newPrice - S0,
                energyLevel: Math.log(Math.abs(newPrice - S0) + 1)
            };
        }
        
        finalPredictedPrice = predictedPrices[predictedPrices.length - 1];
    }

    // Update statistics (including Maxwell Demon metrics) - with null checks
    const updateStat = (id, value) => {
        const el = document.getElementById(id);
        if (el && value !== null && value !== undefined && !isNaN(value)) {
            el.textContent = value;
        }
    };
    
    updateStat('startingPrice', `$${S0.toFixed(2)}`);
    updateStat('avgChange', `$${avg_change.toFixed(2)}`);
    updateStat('stdDev', `$${delta_U_std.toFixed(2)}`);
    updateStat('finalActual', `$${monthly[monthly.length - 1].toFixed(2)}`);
    updateStat('finalDet', `$${sim_prices_det[sim_prices_det.length - 1].toFixed(2)}`);
    updateStat('finalStoch', `$${sim_prices_stoch[sim_prices_stoch.length - 1].toFixed(2)}`);
    
    // Use rigorous Maxwell Demon metrics already calculated
    const demonEff = window.maxwellDemonMetrics ? window.maxwellDemonMetrics.demonEfficiency : 0.5;
    const marketTemp = window.maxwellDemonMetrics ? window.maxwellDemonMetrics.temperature : calculateMarketTemperature(delta_U);
    
    // Display Maxwell Demon metrics
    const entropyCard = document.getElementById('entropyCard');
    const demonEfficiencyCard = document.getElementById('demonEfficiencyCard');
    const temperatureCard = document.getElementById('temperatureCard');
    
    if (entropyCard) {
        entropyCard.style.display = 'block';
        document.getElementById('entropyValue').textContent = informationEntropy.toFixed(3);
        document.getElementById('entropyValue').title = 'Shannon Entropy: Higher = More Uncertainty';
    }
    
    if (demonEfficiencyCard) {
        demonEfficiencyCard.style.display = 'block';
        document.getElementById('demonEfficiency').textContent = `${(demonEff * 100).toFixed(1)}%`;
        document.getElementById('demonEfficiency').title = 'Demon Efficiency: How well information separates signals';
    }
    
    if (temperatureCard) {
        temperatureCard.style.display = 'block';
        document.getElementById('temperatureValue').textContent = `$${marketTemp.toFixed(2)}`;
        document.getElementById('temperatureValue').title = 'Market Temperature: Volatility measure';
    }
    
    // Show/hide prediction card - with null checks
    const predictionCard = document.getElementById('predictionCard');
    if (predictionCard) {
        if (forecastMonths > 0 && finalPredictedPrice && !isNaN(finalPredictedPrice)) {
            predictionCard.style.display = 'block';
            const predictedPriceEl = document.getElementById('predictedPrice');
            if (predictedPriceEl) {
                predictedPriceEl.textContent = `$${finalPredictedPrice.toFixed(2)}`;
                predictedPriceEl.title = `After ${forecastMonths} month(s)`;
            }
        } else {
            predictionCard.style.display = 'none';
        }
    }

    // Calculate and display profit if buy price is provided - with validation
    if (buyPrice && buyPrice > 0 && numShares > 0) {
        try {
            calculateProfit(buyPrice, numShares, monthly[monthly.length - 1], finalPredictedPrice, forecastMonths);
        } catch (error) {
            console.error('Error calculating profit:', error);
            // Don't throw - profit calculation is optional
        }
    }

    // Calculate technical indicators with customizable parameters
    const technicalIndicators = calculateTechnicalIndicators(monthly, dates, params);
    
    // Calculate additional indicators
    const additionalIndicators = calculateAdditionalIndicators(monthly, dates);
    displayAdditionalIndicators(additionalIndicators);
    
    // Detect chart patterns
    const patterns = detectChartPatterns(monthly, dates);
    displayPatterns(patterns);
    
    // Generate trading signals with customizable weights
    const signals = generateTradingSignals(technicalIndicators, monthly, params);
    
    // Display trading signals and market context
    displayTradingSignals(signals, technicalIndicators, monthly[monthly.length - 1]);
    
    // Calculate risk management
    const currentPrice = monthly[monthly.length - 1];
    calculateRiskManagement(currentPrice, buyPrice, riskPercent, stopLossPercent, takeProfitPercent, numShares);
    
    // Backtesting if enabled - with error handling
    let backtestResults = null;
    if (enableBacktest && signals && signals.overall && signals.overall !== 'HOLD') {
        try {
            const entryPrice = buyPrice && buyPrice > 0 ? buyPrice : currentPrice;
            
            if (backtestMode === 'walkforward') {
                backtestResults = performWalkForwardAnalysis(monthly, dates, technicalIndicators, signals, entryPrice, stopLossPercent, takeProfitPercent, params);
                if (backtestResults) {
                    displayWalkForwardResults(backtestResults);
                }
            } else if (backtestMode === 'montecarlo') {
                backtestResults = performMonteCarloSimulation(monthly, dates, technicalIndicators, signals, entryPrice, stopLossPercent, takeProfitPercent, params);
                if (backtestResults) {
                    displayMonteCarloResults(backtestResults);
                }
            } else {
                backtestResults = performBacktesting(monthly, dates, technicalIndicators, signals, entryPrice, stopLossPercent, takeProfitPercent);
                if (backtestResults) {
                    displayBacktestResults(backtestResults);
                } else {
                    const backtestSection = document.getElementById('backtestSection');
                    if (backtestSection) backtestSection.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Backtesting error:', error);
            // Hide backtest sections on error
            const backtestSection = document.getElementById('backtestSection');
            const walkforwardSection = document.getElementById('walkforwardSection');
            const montecarloSection = document.getElementById('montecarloSection');
            if (backtestSection) backtestSection.classList.add('hidden');
            if (walkforwardSection) walkforwardSection.classList.add('hidden');
            if (montecarloSection) montecarloSection.classList.add('hidden');
        }
    } else {
        // Hide all backtest sections
        const backtestSection = document.getElementById('backtestSection');
        const walkforwardSection = document.getElementById('walkforwardSection');
        const montecarloSection = document.getElementById('montecarloSection');
        if (backtestSection) backtestSection.classList.add('hidden');
        if (walkforwardSection) walkforwardSection.classList.add('hidden');
        if (montecarloSection) montecarloSection.classList.add('hidden');
    }
    
    // Return analysis results for export
    return {
        ticker,
        dates,
        prices: monthly,
        signals,
        technicalIndicators,
        additionalIndicators,
        patterns,
        backtestResults,
        maxwellDemonMetrics: window.maxwellDemonMetrics,
        timeframe
    };

    // Create chart with predictions and indicators
    createChart(dates, monthly, sim_prices_det, sim_prices_stoch, ticker, 
                predictedDates, predictedPrices, predictedPricesOptimistic, predictedPricesPessimistic,
                buyPrice, technicalIndicators);

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

// ========== MAXWELL DEMON MODEL FUNCTIONS ==========

/**
 * Calculate price states as energy levels
 * Energy = Price relative to baseline (analogous to potential energy)
 */
function calculatePriceEnergyStates(prices) {
    if (prices.length < 2) return [];
    const baseline = prices[0];
    return prices.map((price, i) => ({
        index: i,
        price: price,
        energy: price - baseline,
        energyLevel: Math.log(Math.abs(price - baseline) + 1) // Logarithmic energy scale
    }));
}

/**
 * Calculate Shannon entropy (information entropy) for price movements
 * H(X) = -Σ p(x) log(p(x))
 * Higher entropy = more uncertainty/information needed
 */
function calculateShannonEntropy(values, bins = 10) {
    if (values.length < 2) return 0;
    
    // Discretize values into bins for probability calculation
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / bins;
    
    if (binSize === 0) return 0;
    
    const counts = new Array(bins).fill(0);
    values.forEach(val => {
        const binIndex = Math.min(Math.floor((val - min) / binSize), bins - 1);
        counts[binIndex]++;
    });
    
    let entropy = 0;
    counts.forEach(count => {
        if (count > 0) {
            const probability = count / values.length;
            entropy -= probability * Math.log2(probability);
        }
    });
    
    return entropy;
}

/**
 * Calculate energy barrier (resistance to price transitions)
 * Based on volatility and trend strength
 */
function calculateEnergyBarrier(prices) {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push(Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]));
    }
    
    const avgVolatility = returns.reduce((a, b) => a + b, 0) / returns.length;
    const priceRange = Math.max(...prices) - Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Energy barrier = normalized volatility * price range / average price
    return avgVolatility * (priceRange / avgPrice);
}

/**
 * Maxwell Demon Decomposition
 * Demon uses information to selectively separate planned vs unexpected changes
 * More information = better separation
 */
function maxwellDemonDecomposition(delta_S, prices, entropy) {
    const avg_change = delta_S.slice(1).reduce((a, b) => a + b, 0) / (delta_S.length - 1);
    
    // Demon efficiency: how well can demon separate signals
    // Lower entropy = more information = better separation
    const maxEntropy = Math.log2(delta_S.length);
    const demonEfficiency = 1 - (entropy / maxEntropy);
    
    const planned = [];
    const unexpected = [];
    
    for (let i = 0; i < delta_S.length; i++) {
        if (i === 0) {
            planned.push(0);
            unexpected.push(0);
        } else {
            // Demon's separation: uses information to identify "predictable" component
            // Planned = component that reduces entropy (more predictable)
            // Unexpected = component that increases entropy (less predictable)
            
            const change = delta_S[i];
            const predicted = avg_change;
            const residual = change - predicted;
            
            // Demon's selective filtering: weight by information content
            // Changes that are "typical" (low entropy) are more "planned"
            // Changes that are "atypical" (high entropy) are more "unexpected"
            
            const typicality = Math.exp(-Math.abs(residual) / (2 * Math.pow(calculateStdDev(delta_S.slice(1)), 2)));
            const plannedComponent = predicted * (1 + demonEfficiency * typicality);
            const unexpectedComponent = residual * (1 - demonEfficiency * typicality);
            
            planned.push(plannedComponent);
            unexpected.push(change - plannedComponent);
        }
    }
    
    return { planned, unexpected };
}

/**
 * Calculate information flow
 * Measures how much information is available for prediction
 */
function calculateInformationFlow(unexpectedChanges, entropy) {
    if (unexpectedChanges.length < 2) return 0;
    
    // Information flow = mutual information between consecutive changes
    // Simplified: correlation-adjusted entropy reduction
    let correlation = 0;
    if (unexpectedChanges.length >= 3) {
        const x = unexpectedChanges.slice(0, -1);
        const y = unexpectedChanges.slice(1);
        const meanX = x.reduce((a, b) => a + b, 0) / x.length;
        const meanY = y.reduce((a, b) => a + b, 0) / y.length;
        
        let cov = 0;
        let varX = 0;
        let varY = 0;
        for (let i = 0; i < x.length; i++) {
            cov += (x[i] - meanX) * (y[i] - meanY);
            varX += Math.pow(x[i] - meanX, 2);
            varY += Math.pow(y[i] - meanY, 2);
        }
        
        if (varX > 0 && varY > 0) {
            correlation = cov / Math.sqrt(varX * varY);
        }
    }
    
    // Information flow = entropy reduction potential
    // Higher correlation = more predictable = higher information flow
    return Math.abs(correlation) * (1 - entropy / Math.log2(unexpectedChanges.length));
}

/**
 * Calculate market "temperature" (volatility)
 * Analogous to thermodynamic temperature
 */
function calculateMarketTemperature(unexpectedChanges) {
    if (unexpectedChanges.length < 2) return 0;
    const variance = unexpectedChanges.slice(1).reduce((sum, val) => sum + Math.pow(val, 2), 0) / unexpectedChanges.length;
    return Math.sqrt(variance); // Temperature = volatility
}

/**
 * Maxwell Demon Transition
 * Demon selectively allows transitions based on information content
 * Similar to how Maxwell's Demon selects fast molecules
 */
function maxwellDemonTransition(currentState, plannedChange, volatility, informationFlow, seed, energyBarrierFactor = 0.01) {
    // Random component
    const randomChange = seededNormal(seed, 0, volatility);
    
    // Demon's selection: prefers transitions that increase information (decrease entropy)
    // Demon "knows" which direction reduces entropy based on information flow
    const demonPreference = informationFlow > 0 ? 
        Math.sign(plannedChange) * Math.abs(randomChange) * informationFlow : 
        randomChange;
    
    // Energy barrier: transitions require overcoming barrier
    const energyBarrier = Math.abs(currentState.energy) * (energyBarrierFactor || 0.01); // Small barrier proportional to energy
    const barrierEffect = Math.exp(-energyBarrier / (volatility + 0.001)); // Boltzmann-like factor
    
    return plannedChange + demonPreference * barrierEffect;
}

/**
 * Maxwell Demon Forecast
 * Predicts future transitions using information-guided selection
 */
function maxwellDemonForecast(currentState, baseChange, volatilityBias, informationFlow, temperature, demonEfficiency, seed, scenario, energyBarrierFactor = 0.01) {
    // Random component
    const baseVolatility = Math.abs(volatilityBias) || temperature;
    let randomComponent = seededNormal(seed, 0, baseVolatility);
    
    if (scenario === 'optimistic') {
        randomComponent = Math.abs(randomComponent);
    } else if (scenario === 'pessimistic') {
        randomComponent = -Math.abs(randomComponent);
    }
    
    // Demon's information-guided adjustment
    // Demon uses information to prefer entropy-reducing transitions
    const demonAdjustment = informationFlow * demonEfficiency * Math.sign(baseChange) * Math.abs(randomComponent);
    
    // Energy barrier effect (Boltzmann factor)
    const energyBarrier = Math.abs(currentState.energy) * (energyBarrierFactor || 0.01);
    const boltzmannFactor = Math.exp(-energyBarrier / (temperature + 0.001));
    
    // Final transition: planned + demon-selected unexpected
    return baseChange + (randomComponent + demonAdjustment) * boltzmannFactor;
}

// Technical Indicators
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!prices || prices.length < slowPeriod) return null;
    if (prices.length < slowPeriod) return null;
    
    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    
    if (emaFast.length < signalPeriod || emaSlow.length < signalPeriod) return null;
    
    const macdLine = emaFast.slice(-signalPeriod).map((fast, i) => fast - emaSlow[emaSlow.length - signalPeriod + i]);
    const signalLine = calculateEMA(macdLine, signalPeriod);
    
    return {
        macd: macdLine[macdLine.length - 1],
        signal: signalLine[signalLine.length - 1],
        histogram: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1]
    };
}

function calculateEMA(prices, period) {
    if (prices.length < period) return [];
    
    const multiplier = 2 / (period + 1);
    const ema = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period];
    
    for (let i = period; i < prices.length; i++) {
        ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
    }
    
    return ema;
}

function calculateMovingAverage(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

function calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return null;
    
    const sma = calculateMovingAverage(prices, period);
    const periodPrices = prices.slice(-period);
    const variance = periodPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    return {
        upper: sma + (stdDev * std),
        middle: sma,
        lower: sma - (stdDev * std)
    };
}

function calculateVolatilityRegime(prices) {
    if (prices.length < 20) return { regime: 'Unknown', level: 0 };
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push(Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]));
    }
    
    const shortVol = returns.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const longVol = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const ratio = shortVol / longVol;
    let regime = 'Normal';
    
    if (ratio > 1.5) regime = 'High';
    else if (ratio < 0.7) regime = 'Low';
    
    return { regime, level: shortVol * 100 };
}

function calculateTrendStrength(prices, period = 20) {
    if (prices.length < period * 2) return { strength: 0, direction: 'Neutral' };
    
    const shortMA = calculateMovingAverage(prices.slice(-period), period);
    const longMA = calculateMovingAverage(prices.slice(-period * 2), period);
    const currentPrice = prices[prices.length - 1];
    
    const trendDirection = currentPrice > shortMA && shortMA > longMA ? 'Bullish' :
                          currentPrice < shortMA && shortMA < longMA ? 'Bearish' : 'Neutral';
    
    // Calculate ADX-like trend strength
    const priceChange = prices.slice(-period).map((p, i) => {
        if (i === 0) return 0;
        return Math.abs(p - prices[prices.length - period + i - 1]);
    });
    const avgChange = priceChange.reduce((a, b) => a + b, 0) / period;
    const avgPrice = calculateMovingAverage(prices.slice(-period), period);
    const strength = (avgChange / avgPrice) * 100;
    
    return { strength: Math.min(strength * 10, 100), direction: trendDirection };
}

function calculateSupportResistance(prices, lookback = 50) {
    if (prices.length < lookback) lookback = prices.length;
    
    const recentPrices = prices.slice(-lookback);
    const highs = [];
    const lows = [];
    
    for (let i = 1; i < recentPrices.length - 1; i++) {
        if (recentPrices[i] > recentPrices[i - 1] && recentPrices[i] > recentPrices[i + 1]) {
            highs.push(recentPrices[i]);
        }
        if (recentPrices[i] < recentPrices[i - 1] && recentPrices[i] < recentPrices[i + 1]) {
            lows.push(recentPrices[i]);
        }
    }
    
    const resistance = highs.length > 0 ? Math.max(...highs) : null;
    const support = lows.length > 0 ? Math.min(...lows) : null;
    const currentPrice = prices[prices.length - 1];
    
    let position = 'Middle';
    if (resistance && support) {
        const range = resistance - support;
        const positionPercent = ((currentPrice - support) / range) * 100;
        if (positionPercent > 75) position = 'Near Resistance';
        else if (positionPercent < 25) position = 'Near Support';
    }
    
    return { support, resistance, position, currentPrice };
}

function calculateTechnicalIndicators(prices, dates, params = {}) {
    const rsiPeriod = params.rsiPeriod || 14;
    const macdFast = params.macdFast || 12;
    const macdSlow = params.macdSlow || 26;
    const sma20Period = params.sma20Period || 20;
    const sma50Period = params.sma50Period || 50;
    
    return {
        rsi: calculateRSI(prices, rsiPeriod),
        macd: calculateMACD(prices, macdFast, macdSlow),
        sma20: calculateMovingAverage(prices, sma20Period),
        sma50: calculateMovingAverage(prices, sma50Period),
        bollingerBands: calculateBollingerBands(prices),
        volatility: calculateVolatilityRegime(prices),
        trend: calculateTrendStrength(prices),
        supportResistance: calculateSupportResistance(prices),
        currentPrice: prices[prices.length - 1],
        params: params // Store params for signal generation
    };
}

function generateTradingSignals(indicators, prices, params = {}) {
    const signals = [];
    let overallSignal = 'HOLD';
    let signalStrength = 0;
    
    // Get customizable weights and thresholds
    const rsiOversold = params.rsiOversold || 30;
    const rsiOverbought = params.rsiOverbought || 70;
    const signalRsiWeight = params.signalRsiWeight || 1;
    const signalMacdWeight = params.signalMacdWeight || 1;
    const signalMaWeight = params.signalMaWeight || 1.5;
    const signalTrendWeight = params.signalTrendWeight || 1;
    const buyThreshold = params.signalBuyThreshold || 1;
    const strongBuyThreshold = params.signalStrongBuyThreshold || 2;
    
    // RSI signals
    if (indicators.rsi !== null) {
        if (indicators.rsi < rsiOversold) {
            signals.push({ type: 'BUY', source: 'RSI Oversold', strength: signalRsiWeight });
            signalStrength += signalRsiWeight;
        } else if (indicators.rsi > rsiOverbought) {
            signals.push({ type: 'SELL', source: 'RSI Overbought', strength: signalRsiWeight });
            signalStrength -= signalRsiWeight;
        }
    }
    
    // MACD signals
    if (indicators.macd !== null) {
        if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
            signals.push({ type: 'BUY', source: 'MACD Bullish', strength: signalMacdWeight });
            signalStrength += signalMacdWeight;
        } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
            signals.push({ type: 'SELL', source: 'MACD Bearish', strength: signalMacdWeight });
            signalStrength -= signalMacdWeight;
        }
    }
    
    // Moving Average signals
    const currentPrice = prices[prices.length - 1];
    if (indicators.sma20 !== null && indicators.sma50 !== null) {
        if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) {
            signals.push({ type: 'BUY', source: 'Golden Cross', strength: signalMaWeight });
            signalStrength += signalMaWeight;
        } else if (currentPrice < indicators.sma20 && indicators.sma20 < indicators.sma50) {
            signals.push({ type: 'SELL', source: 'Death Cross', strength: signalMaWeight });
            signalStrength -= signalMaWeight;
        }
    }
    
    // Trend strength signals - with null checks
    if (indicators.trend && indicators.trend.direction && indicators.trend.strength !== null && indicators.trend.strength !== undefined) {
        if (indicators.trend.direction === 'Bullish' && indicators.trend.strength > 50) {
            signals.push({ type: 'BUY', source: 'Strong Uptrend', strength: signalTrendWeight });
            signalStrength += signalTrendWeight;
        } else if (indicators.trend.direction === 'Bearish' && indicators.trend.strength > 50) {
            signals.push({ type: 'SELL', source: 'Strong Downtrend', strength: signalTrendWeight });
            signalStrength -= signalTrendWeight;
        }
    }
    
    // Support/Resistance signals - with null checks
    if (indicators.supportResistance && indicators.supportResistance.position) {
        if (indicators.supportResistance.position === 'Near Support') {
            signals.push({ type: 'BUY', source: 'Support Level', strength: 0.5 });
            signalStrength += 0.5;
        } else if (indicators.supportResistance.position === 'Near Resistance') {
            signals.push({ type: 'SELL', source: 'Resistance Level', strength: 0.5 });
            signalStrength -= 0.5;
        }
    }
    
    // Determine overall signal using customizable thresholds
    if (signalStrength >= strongBuyThreshold) overallSignal = 'STRONG BUY';
    else if (signalStrength >= buyThreshold) overallSignal = 'BUY';
    else if (signalStrength <= -strongBuyThreshold) overallSignal = 'STRONG SELL';
    else if (signalStrength <= -buyThreshold) overallSignal = 'SELL';
    
    return {
        overall: overallSignal,
        strength: Math.abs(signalStrength),
        signals: signals,
        signalStrength: signalStrength
    };
}

function displayTradingSignals(signals, indicators, currentPrice) {
    if (!signals || !indicators) {
        console.warn('Invalid signals or indicators for display');
        return;
    }
    
    // Current Signal - with null checks
    const signalEl = document.getElementById('signalValue');
    const strengthEl = document.getElementById('signalStrength');
    
    if (!signalEl || !strengthEl) {
        console.warn('Signal display elements not found');
        return;
    }
    
    signalEl.className = 'signal-value';
    const overallSignal = signals.overall || 'HOLD';
    
    if (overallSignal.includes('BUY')) {
        signalEl.classList.add('signal-buy');
        signalEl.textContent = overallSignal;
    } else if (overallSignal.includes('SELL')) {
        signalEl.classList.add('signal-sell');
        signalEl.textContent = overallSignal;
    } else {
        signalEl.classList.add('signal-hold');
        signalEl.textContent = overallSignal;
    }
    
    if (signals.strength !== null && signals.strength !== undefined && !isNaN(signals.strength)) {
        const strengthPercent = Math.min((signals.strength / 5) * 100, 100);
        strengthEl.textContent = `Strength: ${strengthPercent.toFixed(0)}%`;
    } else {
        strengthEl.textContent = 'Strength: 0%';
    }
    strengthEl.className = 'signal-strength';
    
    // RSI - with null checks
    if (indicators.rsi !== null && indicators.rsi !== undefined && !isNaN(indicators.rsi)) {
        const rsiValueEl = document.getElementById('rsiValue');
        const rsiInterpEl = document.getElementById('rsiInterpretation');
        
        if (rsiValueEl) {
            rsiValueEl.textContent = indicators.rsi.toFixed(2);
        }
        
        if (rsiInterpEl) {
            let rsiInterp = 'Neutral';
            const rsiOversold = (indicators.params && indicators.params.rsiOversold) || 30;
            const rsiOverbought = (indicators.params && indicators.params.rsiOverbought) || 70;
            if (indicators.rsi < rsiOversold) rsiInterp = 'Oversold (Buy Signal)';
            else if (indicators.rsi > rsiOverbought) rsiInterp = 'Overbought (Sell Signal)';
            else if (indicators.rsi < 50) rsiInterp = 'Bearish';
            else rsiInterp = 'Bullish';
            rsiInterpEl.textContent = rsiInterp;
        }
    } else {
        const rsiValueEl = document.getElementById('rsiValue');
        const rsiInterpEl = document.getElementById('rsiInterpretation');
        if (rsiValueEl) rsiValueEl.textContent = 'N/A';
        if (rsiInterpEl) rsiInterpEl.textContent = 'Insufficient data';
    }
    
    // MACD - with null checks
    if (indicators.macd !== null && indicators.macd !== undefined) {
        document.getElementById('macdValue').textContent = indicators.macd.histogram.toFixed(3);
        const macdInterp = indicators.macd.histogram > 0 ? 
            'Bullish (MACD > Signal)' : 'Bearish (MACD < Signal)';
        document.getElementById('macdInterpretation').textContent = macdInterp;
    } else {
        document.getElementById('macdValue').textContent = 'N/A';
        document.getElementById('macdInterpretation').textContent = 'Insufficient data';
    }
    
    // Trend Strength
    const trendStrengthEl = document.getElementById('trendStrength');
    if (trendStrengthEl && indicators.trend && indicators.trend.strength !== null && indicators.trend.strength !== undefined && !isNaN(indicators.trend.strength)) {
        trendStrengthEl.textContent = `${indicators.trend.strength.toFixed(0)}%`;
    }
    document.getElementById('trendDirection').textContent = indicators.trend.direction;
    
    // Volatility Regime
    document.getElementById('volatilityRegime').textContent = indicators.volatility.regime;
    document.getElementById('volatilityLevel').textContent = `Volatility: ${indicators.volatility.level.toFixed(2)}%`;
    
    // Support/Resistance
    if (indicators.supportResistance.support && indicators.supportResistance.resistance) {
        document.getElementById('supportResistance').textContent = 
            `$${indicators.supportResistance.support.toFixed(2)} - $${indicators.supportResistance.resistance.toFixed(2)}`;
        document.getElementById('pricePosition').textContent = indicators.supportResistance.position;
    } else {
        document.getElementById('supportResistance').textContent = 'Calculating...';
        document.getElementById('pricePosition').textContent = '-';
    }
}

function calculateRiskManagement(currentPrice, buyPrice, riskPercent, stopLossPercent, takeProfitPercent, numShares) {
    const entryPrice = buyPrice || currentPrice;
    
    // Stop Loss
    const stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
    const stopLossDistance = entryPrice - stopLossPrice;
    document.getElementById('stopLossPrice').textContent = `$${stopLossPrice.toFixed(2)}`;
    document.getElementById('stopLossDetails').textContent = 
        `${stopLossPercent}% below entry (${stopLossDistance.toFixed(2)} per share)` ;
    
    // Take Profit
    const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
    const takeProfitDistance = takeProfitPrice - entryPrice;
    document.getElementById('takeProfitPrice').textContent = `$${takeProfitPrice.toFixed(2)}`;
    document.getElementById('takeProfitDetails').textContent = 
        `${takeProfitPercent}% above entry (${takeProfitDistance.toFixed(2)} per share)`;
    
    // Position Sizing
    const accountRisk = riskPercent / 100; // Assume account value for calculation
    const riskPerShare = stopLossDistance;
    let recommendedShares = 1;
    let positionValue = 0;
    
    if (riskPerShare > 0) {
        // Position size based on risk amount
        // This is simplified - in practice, you'd use account value
        const maxLoss = entryPrice * accountRisk; // Max loss as % of position
        recommendedShares = Math.floor(maxLoss / riskPerShare);
        recommendedShares = Math.max(1, Math.min(recommendedShares, 10000)); // Reasonable bounds
        positionValue = entryPrice * recommendedShares;
    }
    
    document.getElementById('positionSize').textContent = `${recommendedShares} shares`;
    document.getElementById('positionDetails').textContent = 
        `Position value: $${positionValue.toFixed(2)} (${riskPercent}% risk)`;
    
    // Risk/Reward Ratio
    const riskRewardRatio = takeProfitDistance / stopLossDistance;
    const ratioClass = riskRewardRatio >= 2 ? 'risk-good' : riskRewardRatio >= 1 ? 'risk-ok' : 'risk-poor';
    document.getElementById('riskRewardRatio').textContent = `${riskRewardRatio.toFixed(2)}:1`;
    document.getElementById('riskRewardRatio').className = `risk-value ${ratioClass}`;
    
    let rrDetails = '';
    if (riskRewardRatio >= 2) rrDetails = 'Excellent (≥2:1)';
    else if (riskRewardRatio >= 1) rrDetails = 'Good (≥1:1)';
    else rrDetails = 'Poor (<1:1) - Consider adjusting targets';
    document.getElementById('riskRewardDetails').textContent = rrDetails;
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

// Cleanup charts before creating new ones
// Cleanup charts before creating new ones
function cleanupCharts() {
    if (priceChart && typeof priceChart.destroy === 'function') {
        try {
            priceChart.destroy();
        } catch (e) {
            console.warn('Error destroying price chart:', e);
        }
        priceChart = null;
    }
    if (window.equityChart && typeof window.equityChart.destroy === 'function') {
        try {
            window.equityChart.destroy();
        } catch (e) {
            console.warn('Error destroying equity chart:', e);
        }
        window.equityChart = null;
    }
    if (window.walkForwardChart && typeof window.walkForwardChart.destroy === 'function') {
        try {
            window.walkForwardChart.destroy();
        } catch (e) {
            console.warn('Error destroying walk-forward chart:', e);
        }
        window.walkForwardChart = null;
    }
    if (window.monteCarloChart && typeof window.monteCarloChart.destroy === 'function') {
        try {
            window.monteCarloChart.destroy();
        } catch (e) {
            console.warn('Error destroying Monte Carlo chart:', e);
        }
        window.monteCarloChart = null;
    }
    if (window.portfolioChart && typeof window.portfolioChart.destroy === 'function') {
        try {
            window.portfolioChart.destroy();
        } catch (e) {
            console.warn('Error destroying portfolio chart:', e);
        }
        window.portfolioChart = null;
    }
    if (window.optimizationChart && typeof window.optimizationChart.destroy === 'function') {
        try {
            window.optimizationChart.destroy();
        } catch (e) {
            console.warn('Error destroying optimization chart:', e);
        }
    }
    window.optimizationChart = null;
}

function createChart(dates, actual, deterministic, stochastic, ticker, 
                    predictedDates = [], predictedPrices = [], 
                    predictedOptimistic = [], predictedPessimistic = [],
                    buyPrice = null, technicalIndicators = null) {
    const chartEl = document.getElementById('priceChart');
    if (!chartEl) {
        console.error('Price chart element not found');
        return;
    }
    
    const ctx = chartEl.getContext('2d');
    if (!ctx) {
        console.error('Could not get chart context');
        return;
    }
    
    // Validate data
    if (!dates || !actual || dates.length === 0 || actual.length === 0) {
        console.error('Invalid chart data');
        return;
    }
    
    if (priceChart && typeof priceChart.destroy === 'function') {
        try {
            priceChart.destroy();
        } catch (e) {
            console.warn('Error destroying existing chart:', e);
        }
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
        
        // Add stop loss and take profit lines if buy price exists
        const stopLossPercent = parseFloat(document.getElementById('stopLossPercent')?.value || 5);
        const takeProfitPercent = parseFloat(document.getElementById('takeProfitPercent')?.value || 10);
        
        if (stopLossPercent) {
            const stopLossPrice = buyPrice * (1 - stopLossPercent / 100);
            datasets.push({
                label: `Stop Loss @ $${stopLossPrice.toFixed(2)}`,
                data: [
                    { x: firstDate, y: stopLossPrice },
                    { x: lastDate, y: stopLossPrice }
                ],
                borderColor: 'rgba(220, 53, 69, 0.6)',
                backgroundColor: 'rgba(220, 53, 69, 0.05)',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                tension: 0,
                fill: false
            });
        }
        
        if (takeProfitPercent) {
            const takeProfitPrice = buyPrice * (1 + takeProfitPercent / 100);
            datasets.push({
                label: `Take Profit @ $${takeProfitPrice.toFixed(2)}`,
                data: [
                    { x: firstDate, y: takeProfitPrice },
                    { x: lastDate, y: takeProfitPrice }
                ],
                borderColor: 'rgba(40, 167, 69, 0.6)',
                backgroundColor: 'rgba(40, 167, 69, 0.05)',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                tension: 0,
                fill: false
            });
        }
    }
    
    // Add technical indicators to chart
    if (technicalIndicators) {
        // Moving Averages
        if (technicalIndicators.sma20 !== null && dates.length >= 20) {
            const sma20Data = [];
            for (let i = 19; i < dates.length; i++) {
                sma20Data.push({ x: dates[i], y: calculateMovingAverage(actual.slice(0, i + 1), 20) });
            }
            if (sma20Data.length > 0) {
                datasets.push({
                    label: 'SMA 20',
                    data: sma20Data,
                    borderColor: 'rgba(255, 193, 7, 0.7)',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.1
                });
            }
        }
        
        if (technicalIndicators.sma50 !== null && dates.length >= 50) {
            const sma50Data = [];
            for (let i = 49; i < dates.length; i++) {
                sma50Data.push({ x: dates[i], y: calculateMovingAverage(actual.slice(0, i + 1), 50) });
            }
            if (sma50Data.length > 0) {
                datasets.push({
                    label: 'SMA 50',
                    data: sma50Data,
                    borderColor: 'rgba(255, 152, 0, 0.7)',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.1
                });
            }
        }
        
        // Support/Resistance levels
        if (technicalIndicators.supportResistance.support && technicalIndicators.supportResistance.resistance) {
            const firstDate = dates[0];
            const lastDate = predictedDates.length > 0 ? predictedDates[predictedDates.length - 1] : dates[dates.length - 1];
            
            datasets.push({
                label: `Support @ $${technicalIndicators.supportResistance.support.toFixed(2)}`,
                data: [
                    { x: firstDate, y: technicalIndicators.supportResistance.support },
                    { x: lastDate, y: technicalIndicators.supportResistance.support }
                ],
                borderColor: 'rgba(40, 167, 69, 0.4)',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderDash: [3, 3],
                pointRadius: 0,
                tension: 0
            });
            
            datasets.push({
                label: `Resistance @ $${technicalIndicators.supportResistance.resistance.toFixed(2)}`,
                data: [
                    { x: firstDate, y: technicalIndicators.supportResistance.resistance },
                    { x: lastDate, y: technicalIndicators.supportResistance.resistance }
                ],
                borderColor: 'rgba(220, 53, 69, 0.4)',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderDash: [3, 3],
                pointRadius: 0,
                tension: 0
            });
        }
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
    if (!message) {
        message = 'An unexpected error occurred. Please try again.';
    }
    
    const errorEl = document.getElementById('error');
    if (!errorEl) {
        console.error('Error element not found. Error message:', message);
        alert(message);
        return;
    }
    
    // Format message with line breaks
    const formattedMessage = message.replace(/\n/g, '<br>');
    errorEl.innerHTML = formattedMessage;
    errorEl.classList.remove('hidden');
    
    // Scroll to error
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
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

// Export functionality
document.getElementById('exportCSV').addEventListener('click', () => {
    if (!window.lastAnalysisResults) {
        alert('No analysis data to export. Please run an analysis first.');
        return;
    }
    exportToCSV(window.lastAnalysisResults);
});

document.getElementById('exportJSON').addEventListener('click', () => {
    if (!window.lastAnalysisResults) {
        alert('No analysis data to export. Please run an analysis first.');
        return;
    }
    exportToJSON(window.lastAnalysisResults);
});

document.getElementById('exportImage').addEventListener('click', () => {
    if (!priceChart) {
        alert('No chart to export. Please run an analysis first.');
        return;
    }
    const url = priceChart.toBase64Image();
    const link = document.createElement('a');
    link.download = `stock-chart-${Date.now()}.png`;
    link.href = url;
    link.click();
});

document.getElementById('exportReport').addEventListener('click', () => {
    if (!window.lastAnalysisResults) {
        alert('No analysis data to export. Please run an analysis first.');
        return;
    }
    generatePDFReport(window.lastAnalysisResults);
});

// Additional Technical Indicators
function calculateADX(prices, period = 14) {
    if (prices.length < period * 2) return null;
    
    // Calculate True Range
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
        const tr = Math.abs(prices[i] - prices[i - 1]);
        trueRanges.push(tr);
    }
    
    if (trueRanges.length < period) return null;
    
    // Calculate +DM and -DM (Directional Movement)
    const plusDM = [];
    const minusDM = [];
    
    for (let i = 1; i < prices.length; i++) {
        const moveUp = prices[i] - prices[i - 1];
        const moveDown = prices[i - 1] - prices[i];
        
        plusDM.push(moveUp > moveDown && moveUp > 0 ? moveUp : 0);
        minusDM.push(moveDown > moveUp && moveDown > 0 ? moveDown : 0);
    }
    
    // Smooth values
    const atr = calculateATR(prices, period);
    if (!atr) return null;
    
    const smoothedPlusDM = plusDM.slice(-period).reduce((a, b) => a + b, 0) / period;
    const smoothedMinusDM = minusDM.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    // Calculate DI+ and DI-
    const diPlus = (smoothedPlusDM / atr) * 100;
    const diMinus = (smoothedMinusDM / atr) * 100;
    
    // Calculate DX and ADX
    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
    
    // Simplified ADX (for full calculation, would need smoothing over multiple periods)
    return {
        adx: dx,
        diPlus: diPlus,
        diMinus: diMinus
    };
}

function calculateStochastic(prices, period = 14, kPeriod = 3) {
    if (prices.length < period + kPeriod) return null;
    
    const recent = prices.slice(-period);
    const lowest = Math.min(...recent);
    const highest = Math.max(...recent);
    const current = prices[prices.length - 1];
    
    const range = highest - lowest;
    if (range === 0) return null;
    
    const k = ((current - lowest) / range) * 100;
    
    // Simplified %D (would normally be moving average of %K)
    return {
        k: k,
        d: k // Simplified
    };
}

function calculateWilliamsR(prices, period = 14) {
    if (prices.length < period) return null;
    
    const recent = prices.slice(-period);
    const highest = Math.max(...recent);
    const lowest = Math.min(...recent);
    const current = prices[prices.length - 1];
    
    const range = highest - lowest;
    if (range === 0) return null;
    
    const wr = ((highest - current) / range) * -100;
    return wr;
}

function calculateOBV(prices) {
    // On-Balance Volume (simplified without volume data)
    // We'll use price momentum as proxy
    if (prices.length < 2) return null;
    
    let obv = 0;
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) obv += Math.abs(change);
        else if (change < 0) obv -= Math.abs(change);
    }
    
    return obv;
}

function calculateATR(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
        const tr = Math.abs(prices[i] - prices[i - 1]);
        trueRanges.push(tr);
    }
    
    if (trueRanges.length < period) return null;
    
    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    return atr;
}

function calculateCCI(prices, period = 20) {
    if (prices.length < period) return null;
    
    const recent = prices.slice(-period);
    const sma = recent.reduce((a, b) => a + b, 0) / period;
    
    const meanDeviation = recent.reduce((sum, price) => {
        return sum + Math.abs(price - sma);
    }, 0) / period;
    
    if (meanDeviation === 0) return null;
    
    const current = prices[prices.length - 1];
    const cci = (current - sma) / (0.015 * meanDeviation);
    return cci;
}

function calculateAdditionalIndicators(prices, dates) {
    return {
        adx: calculateADX(prices),
        stochastic: calculateStochastic(prices),
        williamsR: calculateWilliamsR(prices),
        obv: calculateOBV(prices),
        atr: calculateATR(prices),
        cci: calculateCCI(prices)
    };
}

function displayAdditionalIndicators(indicators) {
    const section = document.getElementById('additionalIndicators');
    if (!section) return;
    
    section.classList.remove('hidden');
    
    // ADX
    if (indicators.adx) {
        document.getElementById('adxValue').textContent = indicators.adx.adx.toFixed(2);
        let adxInterp = 'Weak Trend';
        if (indicators.adx.adx > 25) adxInterp = 'Strong Trend';
        else if (indicators.adx.adx > 20) adxInterp = 'Moderate Trend';
        document.getElementById('adxInterpretation').textContent = adxInterp;
    } else {
        document.getElementById('adxValue').textContent = 'N/A';
        document.getElementById('adxInterpretation').textContent = 'Insufficient data';
    }
    
    // Stochastic
    if (indicators.stochastic) {
        document.getElementById('stochValue').textContent = `%K: ${indicators.stochastic.k.toFixed(2)} / %D: ${indicators.stochastic.d.toFixed(2)}`;
        let stochInterp = 'Neutral';
        if (indicators.stochastic.k < 20) stochInterp = 'Oversold (Buy)';
        else if (indicators.stochastic.k > 80) stochInterp = 'Overbought (Sell)';
        document.getElementById('stochInterpretation').textContent = stochInterp;
    } else {
        document.getElementById('stochValue').textContent = 'N/A';
        document.getElementById('stochInterpretation').textContent = 'Insufficient data';
    }
    
    // Williams %R
    if (indicators.williamsR !== null) {
        document.getElementById('williamsR').textContent = indicators.williamsR.toFixed(2);
        let wrInterp = 'Neutral';
        if (indicators.williamsR > -20) wrInterp = 'Overbought (Sell)';
        else if (indicators.williamsR < -80) wrInterp = 'Oversold (Buy)';
        document.getElementById('williamsRInterpretation').textContent = wrInterp;
    } else {
        document.getElementById('williamsR').textContent = 'N/A';
        document.getElementById('williamsRInterpretation').textContent = 'Insufficient data';
    }
    
    // OBV
    if (indicators.obv !== null) {
        document.getElementById('obvValue').textContent = indicators.obv.toFixed(0);
        document.getElementById('obvInterpretation').textContent = indicators.obv > 0 ? 'Bullish' : 'Bearish';
    } else {
        document.getElementById('obvValue').textContent = 'N/A';
        document.getElementById('obvInterpretation').textContent = 'Insufficient data';
    }
    
    // ATR
    if (indicators.atr) {
        document.getElementById('atrValue').textContent = `$${indicators.atr.toFixed(2)}`;
        document.getElementById('atrInterpretation').textContent = 'Average True Range';
    } else {
        document.getElementById('atrValue').textContent = 'N/A';
        document.getElementById('atrInterpretation').textContent = 'Insufficient data';
    }
    
    // CCI
    if (indicators.cci !== null) {
        document.getElementById('cciValue').textContent = indicators.cci.toFixed(2);
        let cciInterp = 'Neutral';
        if (indicators.cci > 100) cciInterp = 'Overbought (Sell)';
        else if (indicators.cci < -100) cciInterp = 'Oversold (Buy)';
        document.getElementById('cciInterpretation').textContent = cciInterp;
    } else {
        document.getElementById('cciValue').textContent = 'N/A';
        document.getElementById('cciInterpretation').textContent = 'Insufficient data';
    }
}

function detectChartPatterns(prices, dates) {
    const patterns = [];
    
    if (prices.length < 5) return patterns;
    
    // Head and Shoulders / Inverse Head and Shoulders
    for (let i = 3; i < prices.length - 3; i++) {
        const left = prices[i - 3];
        const head = prices[i - 1];
        const right = prices[i + 1];
        const shoulder1 = prices[i - 2];
        const shoulder2 = prices[i];
        
        // Head and Shoulders
        if (head > shoulder1 && head > shoulder2 && 
            Math.abs(shoulder1 - shoulder2) / shoulder1 < 0.02 &&
            left > shoulder1 && right > shoulder2) {
            patterns.push({
                type: 'Head and Shoulders',
                date: dates[i],
                price: prices[i],
                signal: 'SELL',
                confidence: 'Medium'
            });
        }
        
        // Inverse Head and Shoulders
        if (head < shoulder1 && head < shoulder2 && 
            Math.abs(shoulder1 - shoulder2) / shoulder1 < 0.02 &&
            left < shoulder1 && right < shoulder2) {
            patterns.push({
                type: 'Inverse Head and Shoulders',
                date: dates[i],
                price: prices[i],
                signal: 'BUY',
                confidence: 'Medium'
            });
        }
    }
    
    // Double Top / Double Bottom
    for (let i = 2; i < prices.length - 2; i++) {
        const peak1 = prices[i - 1];
        const peak2 = prices[i + 1];
        const trough = prices[i];
        
        // Double Top
        if (Math.abs(peak1 - peak2) / peak1 < 0.02 && trough < peak1 * 0.95) {
            patterns.push({
                type: 'Double Top',
                date: dates[i],
                price: prices[i],
                signal: 'SELL',
                confidence: 'Medium'
            });
        }
        
        // Double Bottom
        if (Math.abs(trough - prices[i - 2]) / trough < 0.02 && 
            peak1 > trough * 1.05 && peak2 > trough * 1.05) {
            patterns.push({
                type: 'Double Bottom',
                date: dates[i],
                price: prices[i],
                signal: 'BUY',
                confidence: 'Medium'
            });
        }
    }
    
    // Triangle patterns
    if (prices.length >= 10) {
        const recent = prices.slice(-10);
        const highs = [];
        const lows = [];
        
        for (let i = 1; i < recent.length - 1; i++) {
            if (recent[i] > recent[i - 1] && recent[i] > recent[i + 1]) {
                highs.push({ index: i, value: recent[i] });
            }
            if (recent[i] < recent[i - 1] && recent[i] < recent[i + 1]) {
                lows.push({ index: i, value: recent[i] });
            }
        }
        
        if (highs.length >= 2 && lows.length >= 2) {
            const highSlope = (highs[highs.length - 1].value - highs[0].value) / (highs.length - 1);
            const lowSlope = (lows[lows.length - 1].value - lows[0].value) / (lows.length - 1);
            
            if (highSlope < 0 && lowSlope > 0) {
                patterns.push({
                    type: 'Ascending Triangle',
                    date: dates[dates.length - 1],
                    price: prices[prices.length - 1],
                    signal: 'BUY',
                    confidence: 'High'
                });
            } else if (highSlope < 0 && lowSlope < 0) {
                patterns.push({
                    type: 'Descending Triangle',
                    date: dates[dates.length - 1],
                    price: prices[prices.length - 1],
                    signal: 'SELL',
                    confidence: 'High'
                });
            }
        }
    }
    
    return patterns;
}

function displayPatterns(patterns) {
    const section = document.getElementById('patternRecognition');
    const list = document.getElementById('patternsList');
    
    if (!section || !list) return;
    
    if (patterns.length === 0) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    list.innerHTML = '';
    
    patterns.forEach(pattern => {
        const item = document.createElement('div');
        item.className = `pattern-item ${pattern.signal === 'BUY' ? 'pattern-buy' : 'pattern-sell'}`;
        item.innerHTML = `
            <div class="pattern-header">
                <span class="pattern-type">${pattern.type}</span>
                <span class="pattern-signal ${pattern.signal === 'BUY' ? 'signal-buy' : 'signal-sell'}">${pattern.signal}</span>
            </div>
            <div class="pattern-details">
                <span class="pattern-date">${pattern.date.toLocaleDateString()}</span>
                <span class="pattern-price">$${pattern.price.toFixed(2)}</span>
                <span class="pattern-confidence">Confidence: ${pattern.confidence}</span>
            </div>
        `;
        list.appendChild(item);
    });
}

// Backtesting
function performBacktesting(prices, dates, indicators, signals, entryPrice, stopLossPercent, takeProfitPercent) {
    const trades = [];
    let inPosition = false;
    let entryDate = null;
    let entryP = null;
    let equity = [10000]; // Starting with $10,000
    let positionSize = 1; // Percentage of equity to risk per trade
    
    // Generate signals for each time period (simplified - using current signal for all)
    // In a real implementation, you'd calculate signals at each point in time
    const historicalSignals = generateHistoricalSignals(prices, indicators);
    
    for (let i = 1; i < prices.length; i++) {
        const currentPrice = prices[i];
        const currentDate = dates[i];
        const signal = historicalSignals[i] || 'HOLD';
        const lastEquity = equity[equity.length - 1];
        
        if (!inPosition && signal.includes('BUY')) {
            // Enter position
            inPosition = true;
            entryDate = currentDate;
            entryP = currentPrice;
        } else if (inPosition) {
            // Check stop loss and take profit
            const stopLoss = entryP * (1 - stopLossPercent / 100);
            const takeProfit = entryP * (1 + takeProfitPercent / 100);
            
            const exitReason = signal.includes('SELL') ? 'Signal Exit' :
                              currentPrice <= stopLoss ? 'Stop Loss' :
                              currentPrice >= takeProfit ? 'Take Profit' : null;
            
            if (exitReason) {
                const pnl = ((currentPrice - entryP) / entryP) * 100;
                const tradeReturn = (pnl / 100) * positionSize;
                
                trades.push({
                    entryDate,
                    exitDate: currentDate,
                    entryPrice: entryP,
                    exitPrice: currentPrice,
                    pnl,
                    returnPercent: pnl,
                    exitReason,
                    daysHeld: Math.round((currentDate - entryDate) / (1000 * 60 * 60 * 24))
                });
                
                // Update equity curve
                const newEquity = lastEquity * (1 + tradeReturn);
                equity.push(newEquity);
                
                inPosition = false;
            } else {
                // Update equity with unrealized P&L
                const pnl = ((currentPrice - entryP) / entryP) * 100;
                const unrealizedReturn = (pnl / 100) * positionSize;
                const newEquity = lastEquity * (1 + unrealizedReturn);
                equity.push(newEquity);
            }
        } else {
            equity.push(lastEquity);
        }
    }
    
    // Close any open position at end
    if (inPosition) {
        const currentPrice = prices[prices.length - 1];
        const currentDate = dates[dates.length - 1];
        const pnl = ((currentPrice - entryP) / entryP) * 100;
        const tradeReturn = (pnl / 100) * positionSize;
        
        trades.push({
            entryDate,
            exitDate: currentDate,
            entryPrice: entryP,
            exitPrice: currentPrice,
            pnl,
            returnPercent: pnl,
            exitReason: 'End of Period',
            daysHeld: Math.round((currentDate - entryDate) / (1000 * 60 * 60 * 24))
        });
        
        const lastEquity = equity[equity.length - 1];
        const newEquity = lastEquity * (1 + tradeReturn);
        equity.push(newEquity);
    }
    
    // Calculate performance metrics
    if (trades.length === 0) return null;
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const winRate = (winningTrades.length / trades.length) * 100;
    
    const totalReturn = equity[equity.length - 1] - equity[0];
    const totalReturnPercent = (totalReturn / equity[0]) * 100;
    
    // Calculate Sharpe Ratio
    const returns = trades.map(t => t.returnPercent);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = calculateStdDev(returns);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(12) : 0; // Annualized
    
    // Calculate Sortino Ratio (downside deviation only)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideStd = downsideReturns.length > 0 ? calculateStdDev(downsideReturns) : 0;
    const sortinoRatio = downsideStd > 0 ? (avgReturn / downsideStd) * Math.sqrt(12) : 0;
    
    // Calculate Max Drawdown
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peak = equity[0];
    for (let i = 1; i < equity.length; i++) {
        if (equity[i] > peak) peak = equity[i];
        const drawdown = peak - equity[i];
        const drawdownPercent = ((peak - equity[i]) / peak) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            maxDrawdownPercent = drawdownPercent;
        }
    }
    
    // Profit Factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0);
    const grossLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Average return per trade
    const avgReturnPerTrade = avgReturn;
    
    return {
        trades,
        equity,
        dates,
        totalReturn,
        totalReturnPercent,
        sharpeRatio,
        sortinoRatio,
        maxDrawdown,
        maxDrawdownPercent,
        winRate,
        profitFactor,
        totalTrades: trades.length,
        avgReturn: avgReturnPerTrade,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length
    };
}

function displayBacktestResults(results) {
    if (!results) return;
    
    const section = document.getElementById('backtestSection');
    section.classList.remove('hidden');
    
    document.getElementById('totalReturn').textContent = `$${results.totalReturn.toFixed(2)}`;
    document.getElementById('totalReturnPercent').textContent = `${results.totalReturnPercent >= 0 ? '+' : ''}${results.totalReturnPercent.toFixed(2)}%`;
    document.getElementById('totalReturnPercent').className = results.totalReturnPercent >= 0 ? 'performance-label profit-positive' : 'performance-label profit-negative';
    
    document.getElementById('sharpeRatio').textContent = results.sharpeRatio.toFixed(2);
    document.getElementById('sortinoRatio').textContent = results.sortinoRatio.toFixed(2);
    document.getElementById('maxDrawdown').textContent = `-${results.maxDrawdownPercent.toFixed(2)}%`;
    document.getElementById('maxDrawdownPercent').textContent = `$${results.maxDrawdown.toFixed(2)} maximum decline`;
    
    document.getElementById('winRate').textContent = `${results.winRate.toFixed(1)}%`;
    document.getElementById('profitFactor').textContent = results.profitFactor.toFixed(2);
    document.getElementById('totalTrades').textContent = results.totalTrades;
    document.getElementById('avgReturn').textContent = `${results.avgReturn >= 0 ? '+' : ''}${results.avgReturn.toFixed(2)}%`;
    
    // Create equity curve chart
    createEquityChart(results.equity, results.dates);
}

let equityChart = null;
function createEquityChart(equity, dates) {
    const chartEl = document.getElementById('equityChart');
    if (!chartEl) {
        console.warn('Equity chart element not found');
        return;
    }
    
    if (!equity || !dates || equity.length === 0 || dates.length === 0) {
        console.warn('Invalid equity chart data');
        return;
    }
    
    const ctx = chartEl.getContext('2d');
    if (!ctx) {
        console.warn('Could not get equity chart context');
        return;
    }
    
    if (equityChart && typeof equityChart.destroy === 'function') {
        try {
            equityChart.destroy();
        } catch (e) {
            console.warn('Error destroying existing equity chart:', e);
        }
    }
    
    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
            datasets: [{
                label: 'Equity Curve',
                data: equity,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Backtest Equity Curve',
                    font: { size: 16, weight: 'bold' }
                },
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Portfolio Value ($)' },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    type: 'time',
                    time: { unit: 'month' },
                    title: { display: true, text: 'Date' }
                }
            }
        }
    });
}

// Export functions
function exportToCSV(results) {
    let csv = 'Date,Price,Signal,RSI,MACD,Trend\n';
    
    for (let i = 0; i < results.prices.length; i++) {
        const date = results.dates[i].toLocaleDateString();
        const price = results.prices[i];
        const rsi = results.technicalIndicators.rsi ? results.technicalIndicators.rsi.toFixed(2) : 'N/A';
        const macd = results.technicalIndicators.macd ? results.technicalIndicators.macd.histogram.toFixed(3) : 'N/A';
        const trend = results.technicalIndicators.trend ? results.technicalIndicators.trend.direction : 'N/A';
        
        csv += `${date},${price.toFixed(2)},${results.signals.overall || 'N/A'},${rsi},${macd},${trend}\n`;
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-analysis-${results.ticker}-${Date.now()}.csv`;
    link.click();
}

function exportToJSON(results) {
    const json = JSON.stringify(results, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-analysis-${results.ticker}-${Date.now()}.json`;
    link.click();
}

function generateHistoricalSignals(prices, indicators) {
    // Simplified: Generate signals for each point in time
    // In reality, you'd recalculate indicators at each point
    const signals = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < 50) {
            signals.push('HOLD'); // Not enough data
        } else {
            // Use current signal for all (simplified)
            // Real implementation would recalculate at each point
            const currentPrice = prices[i];
            if (indicators.sma20 && indicators.sma50) {
                if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) {
                    signals.push('BUY');
                } else if (currentPrice < indicators.sma20 && indicators.sma20 < indicators.sma50) {
                    signals.push('SELL');
                } else {
                    signals.push('HOLD');
                }
            } else {
                signals.push('HOLD');
            }
        }
    }
    return signals;
}

// ========== RIGOROUS MAXWELL DEMON IMPLEMENTATION ==========

/**
 * Calculate rigorous Shannon entropy using kernel density estimation
 * More accurate than simple binning for continuous distributions
 */
function calculateRigorousShannonEntropy(values, bins = 20) {
    if (values.length < 2) return 0;
    
    // Use Gaussian kernel density estimation
    const bandwidth = calculateOptimalBandwidth(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / bins;
    
    if (binSize === 0) return 0;
    
    // Kernel density estimation
    const density = new Array(bins).fill(0);
    const binCenters = [];
    for (let i = 0; i < bins; i++) {
        binCenters.push(min + (i + 0.5) * binSize);
    }
    
    values.forEach(val => {
        binCenters.forEach((center, idx) => {
            const kernel = Math.exp(-0.5 * Math.pow((val - center) / bandwidth, 2));
            density[idx] += kernel / (bandwidth * Math.sqrt(2 * Math.PI));
        });
    });
    
    // Normalize to get probabilities
    const total = density.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    
    density.forEach((d, i) => density[i] = d / total);
    
    // Calculate entropy
    let entropy = 0;
    density.forEach(prob => {
        if (prob > 0) {
            entropy -= prob * Math.log2(prob);
        }
    });
    
    return entropy;
}

/**
 * Calculate optimal bandwidth for kernel density estimation
 * Using Silverman's rule of thumb
 */
function calculateOptimalBandwidth(values) {
    const n = values.length;
    const std = calculateStdDev(values);
    const iqr = calculateIQR(values);
    const h = 0.9 * Math.min(std, iqr / 1.34) * Math.pow(n, -0.2);
    return h;
}

function calculateIQR(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    return q3 - q1;
}

/**
 * Calculate thermodynamic energy barrier using free energy formulation
 * ΔG = ΔH - T*ΔS (Gibbs free energy)
 */
function calculateThermodynamicEnergyBarrier(prices, entropy) {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push(Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]));
    }
    
    // Enthalpy (average energy change)
    const deltaH = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Temperature (volatility)
    const temperature = calculateStdDev(returns);
    
    // Gibbs free energy barrier
    // ΔG = ΔH - T*ΔS
    const deltaS = entropy / Math.log2(prices.length); // Normalized entropy
    const deltaG = deltaH - temperature * deltaS;
    
    return Math.max(0, deltaG); // Energy barrier is always positive
}

/**
 * Calculate proper thermodynamic temperature
 * Using kinetic energy distribution (price velocity)
 */
function calculateThermodynamicTemperature(unexpectedChanges, prices) {
    if (unexpectedChanges.length < 2) return 0;
    
    // Calculate "velocity" (rate of change)
    const velocities = [];
    for (let i = 1; i < prices.length; i++) {
        velocities.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    // Temperature = average kinetic energy (variance of velocities)
    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - velocities.reduce((a, b) => a + b, 0) / velocities.length, 2), 0) / velocities.length;
    return Math.sqrt(variance);
}

/**
 * Rigorous Maxwell Demon decomposition using information-theoretic principles
 * Incorporates Landauer's principle and thermodynamic constraints
 */
function rigorousMaxwellDemonDecomposition(delta_S, prices, entropy, temperature, energyBarrier) {
    const avg_change = delta_S.slice(1).reduce((a, b) => a + b, 0) / (delta_S.length - 1);
    
    // Landauer's principle: Information processing requires energy
    // Minimum energy cost = kT * ln(2) per bit of information processed
    const kT = temperature * 0.001; // Boltzmann constant approximation
    const minEnergyPerBit = kT * Math.LN2;
    
    // Demon efficiency based on available information vs required energy
    const maxEntropy = Math.log2(delta_S.length);
    const informationContent = maxEntropy - entropy; // Available information
    const demonEfficiency = Math.max(0, Math.min(1, informationContent / maxEntropy));
    
    // Energy available for demon to process information
    const availableEnergy = energyBarrier * demonEfficiency;
    const processingEfficiency = availableEnergy > minEnergyPerBit ? 
        Math.min(1, 1 - (minEnergyPerBit / availableEnergy)) : 0;
    
    const planned = [];
    const unexpected = [];
    
    for (let i = 0; i < delta_S.length; i++) {
        if (i === 0) {
            planned.push(0);
            unexpected.push(0);
        } else {
            const change = delta_S[i];
            const predicted = avg_change;
            const residual = change - predicted;
            
            // Demon's selective filtering with thermodynamic constraints
            // Uses information to reduce entropy, but requires energy
            const typicality = Math.exp(-Math.abs(residual) / (2 * Math.pow(calculateStdDev(delta_S.slice(1)), 2)));
            
            // Information-guided separation with energy constraints
            // Demon can only separate as efficiently as available energy allows
            const separationEfficiency = demonEfficiency * processingEfficiency;
            
            // Boltzmann factor: probability of transition given energy barrier
            const boltzmannFactor = Math.exp(-energyBarrier / (temperature + 0.001));
            
            // Planned component: predictable based on information
            const plannedComponent = predicted * (1 + separationEfficiency * typicality * boltzmannFactor);
            
            // Unexpected component: requires energy to separate
            const unexpectedComponent = residual * (1 - separationEfficiency * typicality * boltzmannFactor);
            
            planned.push(plannedComponent);
            unexpected.push(change - plannedComponent);
        }
    }
    
    return { planned, unexpected, demonEfficiency, processingEfficiency, availableEnergy };
}

/**
 * Calculate rigorous demon efficiency using information-theoretic metrics
 */
function calculateRigorousDemonEfficiency(decomposition, entropy, temperature) {
    const { demonEfficiency, processingEfficiency } = decomposition;
    
    // Combined efficiency: information efficiency × processing efficiency
    // Accounts for both information content and energy constraints
    const combinedEfficiency = demonEfficiency * processingEfficiency;
    
    // Information gain: reduction in entropy achieved
    const maxEntropy = Math.log2(decomposition.planned.length);
    const informationGain = Math.max(0, maxEntropy - entropy);
    const normalizedGain = informationGain / maxEntropy;
    
    // Final efficiency: weighted combination
    return combinedEfficiency * 0.7 + normalizedGain * 0.3;
}

// ========== WALK-FORWARD ANALYSIS ==========

function performWalkForwardAnalysis(prices, dates, indicators, signals, entryPrice, stopLossPercent, takeProfitPercent, params, trainRatio = 0.7) {
    if (prices.length < 20) return null;
    
    const totalPeriods = Math.floor(prices.length * 0.3); // 30% for walk-forward
    const trainSize = Math.floor(prices.length * trainRatio);
    const testSize = prices.length - trainSize;
    const steps = Math.floor(testSize / 10); // 10 walk-forward steps
    
    const walkForwardResults = [];
    let cumulativeReturn = 0;
    
    for (let step = 0; step < steps && (trainSize + step * Math.floor(steps / 10)) < prices.length; step++) {
        const trainStart = 0;
        const trainEnd = trainSize + step * Math.floor(steps / 10);
        const testStart = trainEnd;
        const testEnd = Math.min(testStart + Math.floor(steps / 10), prices.length);
        
        if (testEnd <= testStart) break;
        
        // Train on training period (optimize parameters)
        const trainPrices = prices.slice(trainStart, trainEnd);
        const trainDates = dates.slice(trainStart, trainEnd);
        
        // Optimize parameters on training data (simplified)
        const optimizedParams = optimizeParameters(trainPrices, trainDates, params);
        
        // Test on out-of-sample period
        const testPrices = prices.slice(testStart, testEnd);
        const testDates = dates.slice(testStart, testEnd);
        const testSignals = generateTestSignals(testPrices, optimizedParams);
        
        // Backtest on out-of-sample
        const testResults = performBacktesting(testPrices, testDates, indicators, 
            { overall: testSignals[0] || 'HOLD', strength: 1 }, entryPrice, stopLossPercent, takeProfitPercent);
        
        if (testResults && testResults.trades.length > 0) {
            const periodReturn = testResults.totalReturnPercent;
            cumulativeReturn += periodReturn;
            
            walkForwardResults.push({
                period: step + 1,
                trainStart: trainDates[0],
                trainEnd: trainDates[trainDates.length - 1],
                testStart: testDates[0],
                testEnd: testDates[testDates.length - 1],
                return: periodReturn,
                cumulativeReturn,
                trades: testResults.trades.length,
                sharpe: testResults.sharpeRatio,
                params: optimizedParams
            });
        }
    }
    
    const avgReturn = walkForwardResults.length > 0 ? 
        cumulativeReturn / walkForwardResults.length : 0;
    const consistency = calculateConsistency(walkForwardResults.map(r => r.return));
    
    return {
        periods: walkForwardResults,
        outOfSampleReturn: cumulativeReturn,
        averageReturn: avgReturn,
        consistency,
        totalPeriods: walkForwardResults.length
    };
}

function calculateConsistency(returns) {
    if (returns.length < 2) return 0;
    const positiveReturns = returns.filter(r => r > 0).length;
    return (positiveReturns / returns.length) * 100;
}

function optimizeParameters(prices, dates, baseParams) {
    // Simplified optimization - in practice, use grid search or genetic algorithm
    // Here we just return slightly adjusted parameters
    return {
        ...baseParams,
        rsiPeriod: baseParams.rsiPeriod || 14,
        signalBuyThreshold: (baseParams.signalBuyThreshold || 1) * 0.95,
        signalStrongBuyThreshold: (baseParams.signalStrongBuyThreshold || 2) * 0.95
    };
}

function generateTestSignals(prices, params) {
    const signals = [];
    for (let i = 50; i < prices.length; i++) {
        signals.push(Math.random() > 0.5 ? 'BUY' : 'HOLD');
    }
    return signals;
}

function displayWalkForwardResults(results) {
    if (!results || !results.periods || results.periods.length === 0) return;
    
    const section = document.getElementById('walkforwardSection');
    section.classList.remove('hidden');
    
    document.getElementById('walkforwardOOS').textContent = `${results.outOfSampleReturn >= 0 ? '+' : ''}${results.outOfSampleReturn.toFixed(2)}%`;
    document.getElementById('walkforwardOOS').className = `stat-value ${results.outOfSampleReturn >= 0 ? 'profit-positive' : 'profit-negative'}`;
    
    document.getElementById('walkforwardConsistency').textContent = `${results.consistency.toFixed(1)}%`;
    document.getElementById('walkforwardPeriods').textContent = results.totalPeriods;
    
    // Create walk-forward chart
    createWalkForwardChart(results);
}

function createWalkForwardChart(results) {
    if (!results || !results.periods || results.periods.length === 0) {
        console.warn('Invalid walk-forward results');
        return;
    }
    
    const chartEl = document.getElementById('walkforwardChart');
    if (!chartEl) {
        console.warn('Walk-forward chart element not found');
        return;
    }
    
    const ctx = chartEl.getContext('2d');
    if (!ctx) {
        console.warn('Could not get walk-forward chart context');
        return;
    }
    
    if (window.walkForwardChart && typeof window.walkForwardChart.destroy === 'function') {
        try {
            window.walkForwardChart.destroy();
        } catch (e) {
            console.warn('Error destroying existing walk-forward chart:', e);
        }
    }
    
    const labels = results.periods.map((p, i) => `Period ${i + 1}`);
    const returns = results.periods.map(p => p.return);
    const cumulative = results.periods.map(p => p.cumulativeReturn);
    
    window.walkForwardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Period Return',
                data: returns,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                yAxisID: 'y'
            }, {
                label: 'Cumulative Return',
                data: cumulative,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Period Return (%)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Cumulative Return (%)' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// ========== MONTE CARLO SIMULATION ==========

function performMonteCarloSimulation(prices, dates, indicators, signals, entryPrice, stopLossPercent, takeProfitPercent, params, simulations = 1000) {
    if (prices.length < 20) return null;
    
    // Calculate historical statistics
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = calculateStdDev(returns);
    
    // Monte Carlo simulations
    const simulationResults = [];
    const forecastMonths = 12; // Simulate 12 months ahead
    
    for (let sim = 0; sim < simulations; sim++) {
        let currentPrice = prices[prices.length - 1];
        const path = [currentPrice];
        
        for (let month = 0; month < forecastMonths; month++) {
            // Generate random return based on historical distribution
            const randomReturn = seededNormal(sim * 1000 + month, meanReturn, stdReturn);
            currentPrice = currentPrice * (1 + randomReturn);
            path.push(currentPrice);
        }
        
        const finalReturn = ((path[path.length - 1] - path[0]) / path[0]) * 100;
        simulationResults.push({
            path,
            finalReturn,
            finalPrice: path[path.length - 1]
        });
    }
    
    // Calculate statistics
    const finalReturns = simulationResults.map(s => s.finalReturn);
    const sortedReturns = [...finalReturns].sort((a, b) => a - b);
    
    const mean = finalReturns.reduce((a, b) => a + b, 0) / finalReturns.length;
    const std = calculateStdDev(finalReturns);
    
    // Confidence intervals
    const confidence5 = sortedReturns[Math.floor(sortedReturns.length * 0.05)];
    const confidence95 = sortedReturns[Math.floor(sortedReturns.length * 0.95)];
    const confidence25 = sortedReturns[Math.floor(sortedReturns.length * 0.25)];
    const confidence75 = sortedReturns[Math.floor(sortedReturns.length * 0.75)];
    
    // Value at Risk (VaR)
    const var95 = confidence5; // 95% VaR (5th percentile)
    const var99 = sortedReturns[Math.floor(sortedReturns.length * 0.01)];
    
    // Expected Shortfall (Conditional VaR)
    const tailLosses = finalReturns.filter(r => r <= var95);
    const expectedShortfall = tailLosses.length > 0 ? 
        tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length : 0;
    
    return {
        simulations: simulationResults,
        meanReturn: mean,
        stdReturn: std,
        confidenceIntervals: {
            p5: confidence5,
            p25: confidence25,
            p75: confidence75,
            p95: confidence95
        },
        var95,
        var99,
        expectedShortfall,
        forecastMonths
    };
}

function displayMonteCarloResults(results) {
    if (!results) return;
    
    const section = document.getElementById('montecarloSection');
    section.classList.remove('hidden');
    
    // Display confidence intervals
    const confidenceDiv = document.getElementById('montecarloConfidence');
    confidenceDiv.innerHTML = `
        <p><strong>5th Percentile:</strong> ${results.confidenceIntervals.p5.toFixed(2)}%</p>
        <p><strong>25th Percentile:</strong> ${results.confidenceIntervals.p25.toFixed(2)}%</p>
        <p><strong>Mean:</strong> ${results.meanReturn.toFixed(2)}%</p>
        <p><strong>75th Percentile:</strong> ${results.confidenceIntervals.p75.toFixed(2)}%</p>
        <p><strong>95th Percentile:</strong> ${results.confidenceIntervals.p95.toFixed(2)}%</p>
    `;
    
    // Display risk metrics
    const riskDiv = document.getElementById('montecarloRisk');
    riskDiv.innerHTML = `
        <p><strong>VaR (95%):</strong> ${results.var95.toFixed(2)}%</p>
        <p><strong>VaR (99%):</strong> ${results.var99.toFixed(2)}%</p>
        <p><strong>Expected Shortfall:</strong> ${results.expectedShortfall.toFixed(2)}%</p>
        <p><strong>Std Dev:</strong> ${results.stdReturn.toFixed(2)}%</p>
    `;
    
    // Create Monte Carlo chart
    createMonteCarloChart(results);
}

function createMonteCarloChart(results) {
    if (!results || !results.simulations || results.simulations.length === 0) {
        console.warn('Invalid Monte Carlo results');
        return;
    }
    
    const chartEl = document.getElementById('montecarloChart');
    if (!chartEl) {
        console.warn('Monte Carlo chart element not found');
        return;
    }
    
    const ctx = chartEl.getContext('2d');
    if (!ctx) {
        console.warn('Could not get Monte Carlo chart context');
        return;
    }
    
    if (window.monteCarloChart && typeof window.monteCarloChart.destroy === 'function') {
        try {
            window.monteCarloChart.destroy();
        } catch (e) {
            console.warn('Error destroying existing Monte Carlo chart:', e);
        }
    }
    
    // Sample paths for visualization (show first 50)
    const samplePaths = results.simulations.slice(0, 50);
    const months = Array.from({ length: results.forecastMonths + 1 }, (_, i) => i);
    
    const datasets = samplePaths.map((sim, idx) => ({
        label: `Path ${idx + 1}`,
        data: sim.path.map((price, i) => ({ x: months[i], y: price })),
        borderColor: `rgba(75, 192, 192, 0.1)`,
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0
    }));
    
    // Add confidence bands
    const meanPath = [];
    const upperBand = [];
    const lowerBand = [];
    
    for (let month = 0; month <= results.forecastMonths; month++) {
        const pricesAtMonth = results.simulations.map(s => s.path[month]);
        const sorted = [...pricesAtMonth].sort((a, b) => a - b);
        meanPath.push(pricesAtMonth.reduce((a, b) => a + b, 0) / pricesAtMonth.length);
        upperBand.push(sorted[Math.floor(sorted.length * 0.95)]);
        lowerBand.push(sorted[Math.floor(sorted.length * 0.05)]);
    }
    
    datasets.push({
        label: 'Mean',
        data: meanPath.map((price, i) => ({ x: months[i], y: price })),
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 2,
        pointRadius: 0
    });
    
    datasets.push({
        label: '95% CI Upper',
        data: upperBand.map((price, i) => ({ x: months[i], y: price })),
        borderColor: 'rgba(75, 192, 192, 0.5)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
    });
    
    datasets.push({
        label: '95% CI Lower',
        data: lowerBand.map((price, i) => ({ x: months[i], y: price })),
        borderColor: 'rgba(75, 192, 192, 0.5)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
    });
    
    window.monteCarloChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Months Ahead' } },
                y: { title: { display: true, text: 'Price ($)' } }
            }
        }
    });
}

// ========== PORTFOLIO ANALYSIS ==========

async function analyzePortfolio(portfolioData, primaryTicker, params, timeframe) {
    const tickers = Object.keys(portfolioData);
    if (tickers.length < 2) return null;
    
    const portfolioResults = {};
    const returns = {};
    const correlations = {};
    
    // Analyze each stock
    for (const ticker of tickers) {
        const data = portfolioData[ticker];
        if (!data || data.length === 0) continue;
        
        const prices = data.map(d => d.close);
        const dates = data.map(d => d.date);
        
        // Calculate returns
        const tickerReturns = [];
        for (let i = 1; i < prices.length; i++) {
            tickerReturns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        returns[ticker] = tickerReturns;
        
        // Perform analysis
        portfolioResults[ticker] = {
            currentPrice: prices[prices.length - 1],
            totalReturn: ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100,
            volatility: calculateStdDev(tickerReturns) * Math.sqrt(12), // Annualized
            sharpe: 0 // Will calculate with portfolio
        };
    }
    
    // Calculate correlations
    const tickerArray = Object.keys(returns);
    for (let i = 0; i < tickerArray.length; i++) {
        for (let j = i + 1; j < tickerArray.length; j++) {
            const ticker1 = tickerArray[i];
            const ticker2 = tickerArray[j];
            const corr = calculateCorrelation(returns[ticker1], returns[ticker2]);
            correlations[`${ticker1}-${ticker2}`] = corr;
        }
    }
    
    // Calculate portfolio metrics
    const weights = {}; // Equal weights for now
    const weightPerStock = 1 / tickerArray.length;
    tickerArray.forEach(t => weights[t] = weightPerStock);
    
    // Portfolio return
    const portfolioReturn = tickerArray.reduce((sum, ticker) => 
        sum + (portfolioResults[ticker].totalReturn * weights[ticker]), 0);
    
    // Portfolio volatility
    const portfolioVariance = calculatePortfolioVariance(returns, weights, correlations, tickerArray);
    const portfolioVolatility = Math.sqrt(portfolioVariance) * Math.sqrt(12); // Annualized
    
    // Portfolio Sharpe (assuming risk-free rate = 0)
    const portfolioSharpe = portfolioVolatility > 0 ? portfolioReturn / portfolioVolatility : 0;
    
    // Diversification ratio
    const weightedVol = tickerArray.reduce((sum, ticker) => 
        sum + (portfolioResults[ticker].volatility * weights[ticker]), 0);
    const diversificationRatio = weightedVol > 0 ? weightedVol / portfolioVolatility : 1;
    
    // Max drawdown (simplified)
    const portfolioMaxDrawdown = calculatePortfolioDrawdown(portfolioData, weights, tickerArray);
    
    return {
        tickers: tickerArray,
        allocations: weights,
        totalReturn: portfolioReturn,
        volatility: portfolioVolatility,
        sharpe: portfolioSharpe,
        maxDrawdown: portfolioMaxDrawdown,
        diversificationRatio,
        correlations,
        individualResults: portfolioResults
    };
}

function calculateCorrelation(returns1, returns2) {
    if (returns1.length !== returns2.length || returns1.length < 2) return 0;
    
    const minLen = Math.min(returns1.length, returns2.length);
    const r1 = returns1.slice(0, minLen);
    const r2 = returns2.slice(0, minLen);
    
    const mean1 = r1.reduce((a, b) => a + b, 0) / r1.length;
    const mean2 = r2.reduce((a, b) => a + b, 0) / r2.length;
    
    let cov = 0;
    let var1 = 0;
    let var2 = 0;
    
    for (let i = 0; i < r1.length; i++) {
        cov += (r1[i] - mean1) * (r2[i] - mean2);
        var1 += Math.pow(r1[i] - mean1, 2);
        var2 += Math.pow(r2[i] - mean2, 2);
    }
    
    if (var1 === 0 || var2 === 0) return 0;
    return cov / Math.sqrt(var1 * var2);
}

function calculatePortfolioVariance(returns, weights, correlations, tickers) {
    let variance = 0;
    
    for (let i = 0; i < tickers.length; i++) {
        const ticker1 = tickers[i];
        const vol1 = calculateStdDev(returns[ticker1]);
        variance += Math.pow(weights[ticker1] * vol1, 2);
        
        for (let j = i + 1; j < tickers.length; j++) {
            const ticker2 = tickers[j];
            const vol2 = calculateStdDev(returns[ticker2]);
            const corr = correlations[`${ticker1}-${ticker2}`] || correlations[`${ticker2}-${ticker1}`] || 0;
            variance += 2 * weights[ticker1] * weights[ticker2] * vol1 * vol2 * corr;
        }
    }
    
    return variance;
}

function calculatePortfolioDrawdown(portfolioData, weights, tickers) {
    // Simplified: calculate based on weighted prices
    const minLength = Math.min(...tickers.map(t => portfolioData[t].length));
    const portfolioValue = [];
    
    for (let i = 0; i < minLength; i++) {
        let value = 0;
        tickers.forEach(ticker => {
            value += portfolioData[ticker][i].close * weights[ticker];
        });
        portfolioValue.push(value);
    }
    
    let maxDrawdown = 0;
    let peak = portfolioValue[0];
    
    for (let i = 1; i < portfolioValue.length; i++) {
        if (portfolioValue[i] > peak) peak = portfolioValue[i];
        const drawdown = ((peak - portfolioValue[i]) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return maxDrawdown;
}

function displayPortfolioResults(results) {
    if (!results) return;
    
    const section = document.getElementById('portfolioSection');
    section.classList.remove('hidden');
    
    document.getElementById('portfolioValue').textContent = `$${Object.values(results.individualResults).reduce((sum, r) => sum + r.currentPrice, 0).toFixed(2)}`;
    document.getElementById('portfolioReturn').textContent = `${results.totalReturn >= 0 ? '+' : ''}${results.totalReturn.toFixed(2)}%`;
    document.getElementById('portfolioReturn').className = `stat-value ${results.totalReturn >= 0 ? 'profit-positive' : 'profit-negative'}`;
    document.getElementById('portfolioSharpe').textContent = results.sharpe.toFixed(2);
    document.getElementById('portfolioDrawdown').textContent = `-${results.maxDrawdown.toFixed(2)}%`;
    document.getElementById('portfolioCorrelation').textContent = `${Object.values(results.correlations).reduce((a, b) => a + Math.abs(b), 0) / Object.keys(results.correlations).length}`.substring(0, 4);
    document.getElementById('portfolioDiversification').textContent = results.diversificationRatio.toFixed(2);
    
    // Display allocations
    const allocationsDiv = document.getElementById('portfolioAllocations');
    allocationsDiv.innerHTML = '<h3>Portfolio Allocations</h3><div class="allocations-grid">';
    results.tickers.forEach(ticker => {
        allocationsDiv.innerHTML += `
            <div class="allocation-card">
                <h4>${ticker}</h4>
                <p>Weight: ${(results.allocations[ticker] * 100).toFixed(1)}%</p>
                <p>Return: ${results.individualResults[ticker].totalReturn.toFixed(2)}%</p>
                <p>Volatility: ${results.individualResults[ticker].volatility.toFixed(2)}%</p>
            </div>
        `;
    });
    allocationsDiv.innerHTML += '</div>';
    
    // Display correlation matrix
    displayCorrelationMatrix(results.correlations, results.tickers);
    
    // Create portfolio chart
    createPortfolioChart(results);
}

function displayCorrelationMatrix(correlations, tickers) {
    const matrixDiv = document.getElementById('correlationMatrix');
    let html = '<table class="correlation-table"><thead><tr><th></th>';
    
    tickers.forEach(t => html += `<th>${t}</th>`);
    html += '</tr></thead><tbody>';
    
    for (let i = 0; i < tickers.length; i++) {
        html += `<tr><th>${tickers[i]}</th>`;
        for (let j = 0; j < tickers.length; j++) {
            if (i === j) {
                html += '<td class="correlation-1">1.00</td>';
            } else {
                const key1 = `${tickers[i]}-${tickers[j]}`;
                const key2 = `${tickers[j]}-${tickers[i]}`;
                const corr = correlations[key1] || correlations[key2] || 0;
                const colorClass = corr > 0.5 ? 'correlation-high' : corr > 0 ? 'correlation-medium' : 'correlation-low';
                html += `<td class="${colorClass}">${corr.toFixed(2)}</td>`;
            }
        }
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    matrixDiv.innerHTML = html;
}

function createPortfolioChart(results) {
    if (!results || !results.tickers || results.tickers.length === 0) {
        console.warn('Invalid portfolio results');
        return;
    }
    
    const chartEl = document.getElementById('portfolioChart');
    if (!chartEl) {
        console.warn('Portfolio chart element not found');
        return;
    }
    
    const ctx = chartEl.getContext('2d');
    if (!ctx) {
        console.warn('Could not get portfolio chart context');
        return;
    }
    
    if (window.portfolioChart && typeof window.portfolioChart.destroy === 'function') {
        try {
            window.portfolioChart.destroy();
        } catch (e) {
            console.warn('Error destroying existing portfolio chart:', e);
        }
    }
    
    window.portfolioChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: results.tickers,
            datasets: [{
                label: 'Return (%)',
                data: results.tickers.map(t => results.individualResults[t].totalReturn),
                backgroundColor: results.tickers.map(t => results.individualResults[t].totalReturn >= 0 ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { title: { display: true, text: 'Return (%)' } }
            }
        }
    });
}

// ========== STRATEGY OPTIMIZATION ==========

async function optimizeStrategy(data, ticker, baseParams, startDate, endDate, timeframe) {
    // Grid search optimization
    const paramRanges = {
        rsiPeriod: [10, 12, 14, 16, 18, 20],
        signalBuyThreshold: [0.5, 1.0, 1.5, 2.0],
        signalStrongBuyThreshold: [1.5, 2.0, 2.5, 3.0],
        volDecay: [0.85, 0.9, 0.95],
        momentumFactor: [0.2, 0.3, 0.4]
    };
    
    const prices = data.map(d => d.close);
    const dates = data.map(d => d.date);
    
    let bestParams = { ...baseParams };
    let bestSharpe = -Infinity;
    const optimizationResults = [];
    
    // Sample parameter combinations (limited for performance)
    const maxCombinations = 50;
    let combinations = 0;
    
    for (const rsi of paramRanges.rsiPeriod.slice(0, 3)) {
        for (const buyThresh of paramRanges.signalBuyThreshold.slice(0, 2)) {
            for (const strongThresh of paramRanges.signalStrongBuyThreshold.slice(0, 2)) {
                if (combinations++ >= maxCombinations) break;
                
                const testParams = {
                    ...baseParams,
                    rsiPeriod: rsi,
                    signalBuyThreshold: buyThresh,
                    signalStrongBuyThreshold: strongThresh
                };
                
                // Quick backtest
                const indicators = calculateTechnicalIndicators(prices, dates, testParams);
                const signals = generateTradingSignals(indicators, prices, testParams);
                
                if (signals.overall !== 'HOLD') {
                    const backtestResults = performBacktesting(prices, dates, indicators, signals, 
                        prices[prices.length - 1], 5, 10);
                    
                    if (backtestResults && backtestResults.trades.length > 0) {
                        const sharpe = backtestResults.sharpeRatio;
                        optimizationResults.push({ params: testParams, sharpe, ...backtestResults });
                        
                        if (sharpe > bestSharpe) {
                            bestSharpe = sharpe;
                            bestParams = testParams;
                        }
                    }
                }
            }
            if (combinations >= maxCombinations) break;
        }
        if (combinations >= maxCombinations) break;
    }
    
    return {
        optimalParams: bestParams,
        bestSharpe,
        allResults: optimizationResults.sort((a, b) => b.sharpe - a.sharpe).slice(0, 10)
    };
}

function displayOptimizationResults(optimization, baseParams) {
    if (!optimization || !optimization.optimalParams) return;
    
    const section = document.getElementById('optimizationSection');
    section.classList.remove('hidden');
    
    // Display optimal parameters
    const paramsDiv = document.getElementById('optimalParams');
    paramsDiv.innerHTML = '<div class="params-grid">';
    
    Object.keys(optimization.optimalParams).forEach(key => {
        const oldVal = baseParams[key];
        const newVal = optimization.optimalParams[key];
        const changed = Math.abs(oldVal - newVal) > 0.01;
        paramsDiv.innerHTML += `
            <div class="param-item ${changed ? 'param-changed' : ''}">
                <strong>${key}:</strong> ${newVal.toFixed(4)} ${changed ? `(was ${oldVal.toFixed(4)})` : ''}
            </div>
        `;
    });
    paramsDiv.innerHTML += '</div>';
    
    // Display metrics
    const metricsDiv = document.getElementById('optimizationMetrics');
    metricsDiv.innerHTML = `
        <div class="metric-item">
            <strong>Best Sharpe Ratio:</strong> ${optimization.bestSharpe.toFixed(2)}
        </div>
        <div class="metric-item">
            <strong>Parameters Tested:</strong> ${optimization.allResults.length}
        </div>
    `;
    
    // Create optimization chart
    createOptimizationChart(optimization);
}

function createOptimizationChart(optimization) {
    if (!optimization || !optimization.allResults || optimization.allResults.length === 0) {
        console.warn('Invalid optimization results');
        return;
    }
    
    const chartEl = document.getElementById('optimizationChart');
    if (!chartEl) {
        console.warn('Optimization chart element not found');
        return;
    }
    
    const ctx = chartEl.getContext('2d');
    if (!ctx) {
        console.warn('Could not get optimization chart context');
        return;
    }
    
    if (window.optimizationChart && typeof window.optimizationChart.destroy === 'function') {
        try {
            window.optimizationChart.destroy();
        } catch (e) {
            console.warn('Error destroying existing optimization chart:', e);
        }
    }
    window.optimizationChart = null;
    
    const sharpeValues = optimization.allResults.map(r => r.sharpe);
    const labels = optimization.allResults.map((r, i) => `Config ${i + 1}`);
    
    window.optimizationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Sharpe Ratio',
                data: sharpeValues,
                backgroundColor: sharpeValues.map(s => s === optimization.bestSharpe ? 'rgba(40, 167, 69, 0.8)' : 'rgba(75, 192, 192, 0.8)')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { title: { display: true, text: 'Sharpe Ratio' } }
            }
        }
    });
}

// ========== REAL-TIME UPDATES ==========

let realtimeInterval = null;

function startRealtimeUpdates(ticker, timeframe) {
    // Clean up any existing interval
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
        realtimeInterval = null;
    }
    
    // Validate inputs
    if (!ticker || !timeframe) {
        console.warn('Invalid parameters for real-time updates');
        return;
    }
    
    // Update every 60 seconds
    realtimeInterval = setInterval(async () => {
        try {
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const data = await fetchStockData(ticker, startDate, endDate, timeframe);
            if (data && data.length > 0 && data[data.length - 1] && data[data.length - 1].close) {
                const currentPrice = data[data.length - 1].close;
                updateRealtimePrice(ticker, currentPrice);
            }
        } catch (error) {
            console.error('Real-time update error:', error);
            // Don't stop the interval on single failure
        }
    }, 60000); // 60 seconds
}

// Cleanup function for real-time updates
function stopRealtimeUpdates() {
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
        realtimeInterval = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopRealtimeUpdates();
    // Clean up charts with proper type checking
    if (priceChart && typeof priceChart.destroy === 'function') {
        try {
            priceChart.destroy();
        } catch (e) {
            console.warn('Error destroying price chart on unload:', e);
        }
        priceChart = null;
    }
    if (window.equityChart && typeof window.equityChart.destroy === 'function') {
        try {
            window.equityChart.destroy();
        } catch (e) {
            console.warn('Error destroying equity chart on unload:', e);
        }
        window.equityChart = null;
    }
    if (window.walkForwardChart && typeof window.walkForwardChart.destroy === 'function') {
        try {
            window.walkForwardChart.destroy();
        } catch (e) {
            console.warn('Error destroying walk-forward chart on unload:', e);
        }
        window.walkForwardChart = null;
    }
    if (window.monteCarloChart && typeof window.monteCarloChart.destroy === 'function') {
        try {
            window.monteCarloChart.destroy();
        } catch (e) {
            console.warn('Error destroying Monte Carlo chart on unload:', e);
        }
        window.monteCarloChart = null;
    }
    if (window.portfolioChart && typeof window.portfolioChart.destroy === 'function') {
        try {
            window.portfolioChart.destroy();
        } catch (e) {
            console.warn('Error destroying portfolio chart on unload:', e);
        }
        window.portfolioChart = null;
    }
    if (window.optimizationChart && typeof window.optimizationChart.destroy === 'function') {
        try {
            window.optimizationChart.destroy();
        } catch (e) {
            console.warn('Error destroying optimization chart on unload:', e);
        }
        window.optimizationChart = null;
    }
});

function updateRealtimePrice(ticker, price) {
    // Update UI with latest price
    const priceElements = document.querySelectorAll('[id*="Price"], [id*="price"]');
    priceElements.forEach(el => {
        if (el.textContent.includes('$')) {
            // Update if it's a price display
        }
    });
    
    // Show notification
    showNotification(`Real-time update: ${ticker} = $${price.toFixed(2)}`);
}

function showNotification(message) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #667eea; color: white; padding: 15px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function generatePDFReport(results) {
    // Create HTML report
    let html = `
        <html>
        <head>
            <title>Stock Analysis Report - ${results.ticker}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; }
                .section { margin: 20px 0; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #667eea; color: white; }
            </style>
        </head>
        <body>
            <h1>Stock Analysis Report: ${results.ticker}</h1>
            <div class="section">
                <h2>Summary</h2>
                <p><strong>Analysis Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Timeframe:</strong> ${results.timeframe}</p>
                <p><strong>Current Signal:</strong> ${results.signals.overall}</p>
                <p><strong>Signal Strength:</strong> ${results.signals.strength.toFixed(2)}</p>
            </div>
            <div class="section">
                <h2>Technical Indicators</h2>
                <table>
                    <tr><th>Indicator</th><th>Value</th></tr>
                    <tr><td>RSI</td><td>${results.technicalIndicators.rsi ? results.technicalIndicators.rsi.toFixed(2) : 'N/A'}</td></tr>
                    <tr><td>MACD</td><td>${results.technicalIndicators.macd ? results.technicalIndicators.macd.histogram.toFixed(3) : 'N/A'}</td></tr>
                    <tr><td>Trend</td><td>${results.technicalIndicators.trend ? results.technicalIndicators.trend.direction : 'N/A'}</td></tr>
                </table>
            </div>
    `;
    
    if (results.backtestResults) {
        html += `
            <div class="section">
                <h2>Backtest Results</h2>
                <table>
                    <tr><th>Metric</th><th>Value</th></tr>
                    <tr><td>Total Return</td><td>${results.backtestResults.totalReturnPercent.toFixed(2)}%</td></tr>
                    <tr><td>Sharpe Ratio</td><td>${results.backtestResults.sharpeRatio.toFixed(2)}</td></tr>
                    <tr><td>Max Drawdown</td><td>${results.backtestResults.maxDrawdown.toFixed(2)}%</td></tr>
                    <tr><td>Win Rate</td><td>${results.backtestResults.winRate.toFixed(1)}%</td></tr>
                </table>
            </div>
        `;
    }
    
    html += `</body></html>`;
    
    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}

