// Simple CORS proxy server for Yahoo Finance API
// Run this with: node proxy-server.js
// Then access the app at http://localhost:3000

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Create a simple HTTP server
const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    
    // Serve static files
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
        serveFile(res, 'index.html', 'text/html');
    } else if (parsedUrl.pathname === '/styles.css') {
        serveFile(res, 'styles.css', 'text/css');
    } else if (parsedUrl.pathname === '/script.js') {
        serveFile(res, 'script.js', 'application/javascript');
    }
    // Proxy Yahoo Finance API requests
    else if (parsedUrl.pathname === '/api/stock') {
        const ticker = parsedUrl.query.ticker;
        const startDate = parsedUrl.query.startDate;
        const endDate = parsedUrl.query.endDate;
        
        if (!ticker || !startDate || !endDate) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required parameters' }));
            return;
        }
        
        const period1 = Math.floor(new Date(startDate).getTime() / 1000);
        const period2 = Math.floor(new Date(endDate).getTime() / 1000);
        
        const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${period1}&period2=${period2}&interval=1mo&events=history&includeAdjustedClose=true`;
        
        https.get(yahooUrl, (yahooRes) => {
            let data = '';
            
            yahooRes.on('data', (chunk) => {
                data += chunk;
            });
            
            yahooRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/csv' });
                res.end(data);
            });
        }).on('error', (error) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

function serveFile(res, filename, contentType) {
    const filePath = path.join(__dirname, filename);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

server.listen(PORT, () => {
    console.log(`\n✅ Proxy server running at http://localhost:${PORT}`);
    console.log(`📊 Open http://localhost:${PORT} in your browser\n`);
    console.log('Press Ctrl+C to stop the server\n');
});

