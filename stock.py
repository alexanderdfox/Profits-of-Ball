import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import yfinance as yf

# -----------------------------
# 1. Download Apple stock data
# -----------------------------
ticker = "AAPL"
data = yf.download(ticker, start="2024-01-01", end="2025-12-31", interval="1mo")
monthly = data['Close'].dropna()
print("Monthly Close Prices:")
print(monthly)

# -----------------------------
# 2. Compute monthly changes ΔS_t
# -----------------------------
delta_S = monthly.diff().fillna(0)
print("\nMonthly Changes ΔS_t:")
print(delta_S)

# -----------------------------
# 3. Decompose into planned ΔP_t and unexpected ΔU_t
# -----------------------------
# Planned: average monthly change
avg_change = delta_S.mean()
delta_P = np.full(len(delta_S), avg_change)

# Unexpected: residuals from planned
delta_U = delta_S.values - delta_P

# -----------------------------
# 4. Reconstruct price path (deterministic)
# -----------------------------
S0 = monthly.iloc[0]
sim_prices_det = [S0]
for t in range(1, len(monthly)):
	S_new = sim_prices_det[-1] + delta_P[t] + delta_U[t]
	sim_prices_det.append(S_new)
sim_prices_det = np.array(sim_prices_det)

# -----------------------------
# 5. Simulate stochastic future path
# -----------------------------
np.random.seed(42)  # for reproducibility
sim_prices_stoch = [S0]
for t in range(1, len(monthly)):
	# ΔU_t as random draw from Normal distribution with mean=0, std=std of past delta_U
	random_U = np.random.normal(0, delta_U.std())
	S_new = sim_prices_stoch[-1] + delta_P[t] + random_U
	sim_prices_stoch.append(S_new)
sim_prices_stoch = np.array(sim_prices_stoch)

# -----------------------------
# 6. Plot real vs simulated
# -----------------------------
plt.figure(figsize=(12,6))
plt.plot(monthly.index, monthly.values, marker='o', label="Actual AAPL Price")
plt.plot(monthly.index, sim_prices_det, marker='x', linestyle='--', label="Deterministic Model")
plt.plot(monthly.index, sim_prices_stoch, marker='s', linestyle='-.', label="Stochastic Simulation")
plt.title("AAPL: Real vs Baseball-Math Modelled Price Path")
plt.xlabel("Month")
plt.ylabel("Price (USD)")
plt.xticks(rotation=45)
plt.grid(True, linestyle='--', alpha=0.5)

# Highlight “big innings” (large unexpected moves)
threshold = delta_U.std() * 1.5
for t, u in enumerate(delta_U):
	if abs(u) >= threshold:
		plt.annotate(f"Big Spike ΔU={u:.2f}", 
					 xy=(monthly.index[t], sim_prices_det[t]), 
					 xytext=(monthly.index[t], sim_prices_det[t] + 10),
					 arrowprops=dict(facecolor='red', shrink=0.05),
					 fontsize=8, color='red')

plt.legend()
plt.tight_layout()
plt.show()

# -----------------------------
# 7. Optional: Print summary
# -----------------------------
print("\nStarting Price: $", S0)
print("Average Planned Monthly Change ΔP_t: $", round(avg_change,2))
print("Std Dev of Unexpected Moves ΔU_t: $", round(delta_U.std(),2))
print("Final Actual Price: $", monthly.iloc[-1])
print("Final Deterministic Model Price: $", sim_prices_det[-1])
print("Final Stochastic Simulated Price: $", round(sim_prices_stoch[-1],2))
