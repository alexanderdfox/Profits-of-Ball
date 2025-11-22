# 🚀 How to Run Profits of Ball

## ⚡ Quick Start (Choose ONE method)

### Method 1: Python Server (Easiest - Works on Mac/Windows/Linux)

1. **Open Terminal/Command Prompt** in this folder
2. **Run:** `python3 simple-server.py`
   - (If that doesn't work, try: `python simple-server.py`)
3. **Open browser:** http://localhost:8000
4. **Enter stock ticker** (e.g., AAPL) and click "Analyze Stock"

✅ **This method bypasses all CORS issues!**

---

### Method 2: Node.js Server (If you have Node.js installed)

1. **Open Terminal** in this folder  
2. **Run:** `node proxy-server.js`
3. **Open browser:** http://localhost:3000
4. **Enter stock ticker** and analyze!

---

### Method 3: Direct File (May have CORS errors)

1. **Double-click** `index.html`
2. If you get CORS errors, use Method 1 or Method 2 instead

---

## 📋 Troubleshooting

**"python3: command not found"?**
- Try: `python simple-server.py` instead
- Or install Python from python.org

**"node: command not found"?**
- Use Method 1 (Python) instead
- Or install Node.js from nodejs.org

**Still getting errors?**
- Make sure you're opening the URL shown by the server (e.g., http://localhost:8000)
- Don't just double-click the HTML file
- Check your internet connection
- Verify the stock ticker is correct (e.g., AAPL, MSFT, GOOGL)

---

## 💡 Why do I need a server?

Browsers block direct access to Yahoo Finance due to CORS security. The server acts as a middleman and bypasses this restriction.

