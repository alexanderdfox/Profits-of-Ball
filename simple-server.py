#!/usr/bin/env python3
"""
Simple HTTP server with CORS proxy for Yahoo Finance API
Run this script, then open http://localhost:8000 in your browser

Usage:
    python3 simple-server.py
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import urlopen
import json
import os

class CORSProxyHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Handle API proxy requests
        if parsed_path.path == '/api/stock':
            query_params = parse_qs(parsed_path.query)
            ticker = query_params.get('ticker', [None])[0]
            start_date = query_params.get('startDate', [None])[0]
            end_date = query_params.get('endDate', [None])[0]
            
            if not all([ticker, start_date, end_date]):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing parameters'}).encode())
                return
            
            # Get interval parameter (default to 1mo for monthly)
            interval = query_params.get('interval', ['1mo'])[0]
            
            # Fetch from Yahoo Finance
            from datetime import datetime
            import time
            period1 = int(time.mktime(datetime.strptime(start_date, '%Y-%m-%d').timetuple()))
            period2 = int(time.mktime(datetime.strptime(end_date, '%Y-%m-%d').timetuple()))
            
            yahoo_url = f'https://query1.finance.yahoo.com/v7/finance/download/{ticker}?period1={period1}&period2={period2}&interval={interval}&events=history&includeAdjustedClose=true'
            
            try:
                response = urlopen(yahoo_url, timeout=10)
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv')
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            # Serve static files from current directory
            file_path = parsed_path.path
            if file_path == '/' or file_path == '/index.html':
                file_path = '/index.html'
            elif not file_path.startswith('/'):
                file_path = '/' + file_path
            
            # Remove leading slash for file system
            file_path = file_path.lstrip('/')
            if not file_path:
                file_path = 'index.html'
            
            # Security: prevent directory traversal
            if '..' in file_path:
                self.send_response(403)
                self.end_headers()
                return
            
            # Try to serve the file
            try:
                if not os.path.exists(file_path):
                    self.send_response(404)
                    self.send_header('Content-Type', 'text/plain')
                    self.end_headers()
                    self.wfile.write(b'File not found')
                    return
                
                with open(file_path, 'rb') as f:
                    content = f.read()
                
                # Set content type
                content_type = 'text/html'
                if file_path.endswith('.css'):
                    content_type = 'text/css'
                elif file_path.endswith('.js'):
                    content_type = 'application/javascript'
                elif file_path.endswith('.png'):
                    content_type = 'image/png'
                elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(f'Error: {str(e)}'.encode())

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSProxyHandler)
    print(f'\n✅ Server running at http://localhost:{port}')
    print(f'📊 Open http://localhost:{port}/index.html in your browser')
    print('\nPress Ctrl+C to stop the server\n')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n👋 Server stopped')
        httpd.shutdown()

if __name__ == '__main__':
    run_server()

