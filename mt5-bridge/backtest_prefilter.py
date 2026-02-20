"""
GATEKEEPER Pre-Filter Backtester v3
Tests the pre-filter logic against historical MT5 data to measure precision.

Usage:
  1. Make sure MT5 is running (needs historical data access)
  2. python backtest_prefilter.py

What it does:
  - Pulls 3 months of H4, H1, M15 candles for 8 pairs
  - Walks forward in 15-min steps (simulating the scanner interval)
  - Tests a 2D grid of wick threshold x displacement threshold
  - When PASS: checks if price achieved 1:2 R:R within 24 H1 candles
  - Outputs comparison table across all threshold combos
"""

import MetaTrader5 as mt5
import sys
from datetime import datetime, timedelta

# === CONFIG ===
# Tier 1: Profitable pairs (keep)
# Tier 2: Breakeven/marginal (test)
# Tier 3: Loss-making (exclude) — EURJPY, EURGBP, NZDUSD
PAIRS = [
    "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "GBPJPY",
]
LOOKBACK_DAYS = 90
H4_LOOKBACK = 50
H1_LOOKBACK = 50
OUTCOME_WINDOW_H1 = 24  # Extended from 12 to 24 for more decisive outcomes
SL_ATR_MULTIPLIER = 1.5
RR_TARGET = 2.0
COOLDOWN_SECONDS = 14400  # 4 hours (reduced — fewer pairs need less dedup)

# Kill zone hours (UTC)
KILL_ZONES = [
    (7, 10, "LONDON"),
    (12, 15, "NEW_YORK"),
    (15, 17, "LONDON_CLOSE"),
]

# 2D grid to test
WICK_THRESHOLDS = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65]
DISP_THRESHOLDS = [0.50, 0.55, 0.60, 0.65, 0.70]


def connect_mt5():
    if not mt5.initialize():
        print(f"[ERROR] MT5 init failed: {mt5.last_error()}")
        sys.exit(1)
    print("[OK] Connected to MT5")


def fetch_candles(symbol, timeframe, start_date, end_date):
    """Fetch all candles between two dates"""
    mt5.symbol_select(symbol, True)
    rates = mt5.copy_rates_range(symbol, timeframe, start_date, end_date)
    if rates is None or len(rates) == 0:
        return []
    return [
        {
            "time": int(r["time"]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": int(r["tick_volume"]),
        }
        for r in rates
    ]


def get_pip_size(symbol):
    if "JPY" in symbol:
        return 0.01
    return 0.0001


# ============================================================
# PRE-FILTER LOGIC (mirrors prefilter.ts)
# ============================================================

def find_swing_points(candles):
    points = []
    for i in range(2, len(candles) - 2):
        c = candles[i]
        if (c["high"] > candles[i-1]["high"] and c["high"] > candles[i-2]["high"]
                and c["high"] > candles[i+1]["high"] and c["high"] > candles[i+2]["high"]):
            points.append({"index": i, "price": c["high"], "type": "high"})
        if (c["low"] < candles[i-1]["low"] and c["low"] < candles[i-2]["low"]
                and c["low"] < candles[i+1]["low"] and c["low"] < candles[i+2]["low"]):
            points.append({"index": i, "price": c["low"], "type": "low"})
    return points


def check_h4_trend(candles):
    if len(candles) < 10:
        return "RANGING", False
    swings = find_swing_points(candles)
    highs = [s for s in swings if s["type"] == "high"][-4:]
    lows = [s for s in swings if s["type"] == "low"][-4:]
    if len(highs) < 2 or len(lows) < 2:
        return "RANGING", False

    hh = sum(1 for i in range(1, len(highs)) if highs[i]["price"] > highs[i-1]["price"])
    hl = sum(1 for i in range(1, len(lows)) if lows[i]["price"] > lows[i-1]["price"])
    lh = sum(1 for i in range(1, len(highs)) if highs[i]["price"] < highs[i-1]["price"])
    ll = sum(1 for i in range(1, len(lows)) if lows[i]["price"] < lows[i-1]["price"])

    bull, bear = hh + hl, lh + ll
    if bull >= 3: return "BULLISH", bull >= 4
    if bear >= 3: return "BEARISH", bear >= 4
    if bull > bear and bull >= 2: return "BULLISH", False
    if bear > bull and bear >= 2: return "BEARISH", False
    return "RANGING", False


def check_premium_discount(h4_candles, trend_dir):
    if len(h4_candles) < 5:
        return "EQUILIBRIUM", False
    range_high = max(c["high"] for c in h4_candles)
    range_low = min(c["low"] for c in h4_candles)
    rng = range_high - range_low
    if rng <= 0:
        return "EQUILIBRIUM", False
    pos = (h4_candles[-1]["close"] - range_low) / rng
    if pos > 0.667:
        zone = "PREMIUM"
    elif pos < 0.333:
        zone = "DISCOUNT"
    else:
        zone = "EQUILIBRIUM"
    aligned = (trend_dir == "BULLISH" and zone == "DISCOUNT") or \
              (trend_dir == "BEARISH" and zone == "PREMIUM")
    return zone, aligned


def check_kill_zone_at(timestamp):
    dt = datetime.utcfromtimestamp(timestamp)
    hour = dt.hour
    for start_h, end_h, name in KILL_ZONES:
        if start_h <= hour < end_h:
            return True, name
    return False, "NONE"


def check_h1_sweep(candles, trend_dir, wick_threshold):
    if len(candles) < 5 or trend_dir == "RANGING":
        return False, 0.0
    recent = candles[-8:]
    max_wick_ratio = 0.0
    for c in recent:
        total_range = c["high"] - c["low"]
        if total_range <= 0:
            continue
        upper_wick = c["high"] - max(c["open"], c["close"])
        lower_wick = min(c["open"], c["close"]) - c["low"]
        relevant_wick = lower_wick if trend_dir == "BULLISH" else upper_wick
        ratio = relevant_wick / total_range
        if ratio > max_wick_ratio:
            max_wick_ratio = ratio
    return max_wick_ratio >= wick_threshold, round(max_wick_ratio, 3)


def check_h1_displacement(candles, trend_dir, disp_threshold):
    if len(candles) < 3 or trend_dir == "RANGING":
        return False, 0.0
    recent = candles[-3:]
    max_body_ratio = 0.0
    for c in recent:
        total_range = c["high"] - c["low"]
        if total_range <= 0:
            continue
        body = abs(c["close"] - c["open"])
        body_ratio = body / total_range
        is_bullish = c["close"] > c["open"]
        direction_match = (trend_dir == "BULLISH" and is_bullish) or \
                          (trend_dir == "BEARISH" and not is_bullish)
        if direction_match and body_ratio > max_body_ratio:
            max_body_ratio = body_ratio
    return max_body_ratio >= disp_threshold, round(max_body_ratio, 3)


# ============================================================
# OUTCOME CHECKING
# ============================================================

def check_outcome(h1_candles_after, direction, sl_pips, rr_target):
    if not h1_candles_after or direction == "NONE":
        return "NEUTRAL"
    tp_pips = sl_pips * rr_target
    entry_price = h1_candles_after[0]["open"]
    for candle in h1_candles_after:
        if direction == "BUY":
            if candle["low"] <= entry_price - sl_pips:
                return "LOSS"
            if candle["high"] >= entry_price + tp_pips:
                return "WIN"
        elif direction == "SELL":
            if candle["high"] >= entry_price + sl_pips:
                return "LOSS"
            if candle["low"] <= entry_price - tp_pips:
                return "WIN"
    return "NEUTRAL"


def calculate_avg_h1_range(h1_candles):
    if not h1_candles:
        return 0
    ranges = [c["high"] - c["low"] for c in h1_candles[-20:]]
    return sum(ranges) / len(ranges)


# ============================================================
# DATA PREFETCH
# ============================================================

def prefetch_all_data(pairs, start_date, end_date):
    """Fetch H4/H1/M15 data for all pairs upfront"""
    data = {}
    for symbol in pairs:
        print(f"  Fetching {symbol}...", end=" ", flush=True)
        h4 = fetch_candles(symbol, mt5.TIMEFRAME_H4, start_date, end_date)
        h1 = fetch_candles(symbol, mt5.TIMEFRAME_H1, start_date, end_date)
        m15 = fetch_candles(symbol, mt5.TIMEFRAME_M15, start_date, end_date)
        if h4 and h1 and m15:
            data[symbol] = {"h4": h4, "h1": h1, "m15": m15}
            print(f"{len(h4)} H4, {len(h1)} H1, {len(m15)} M15")
        else:
            print("SKIPPED (no data)")
    return data


# ============================================================
# SINGLE PAIR BACKTEST (threshold-aware)
# ============================================================

def backtest_pair(symbol, pair_data, wick_threshold, disp_threshold, verbose=False):
    """Run backtest for a single pair with given thresholds"""
    h4_all = pair_data["h4"]
    h1_all = pair_data["h1"]
    m15_all = pair_data["m15"]

    results = {"total_signals": 0, "wins": 0, "losses": 0, "neutrals": 0, "signals": []}

    min_m15_index = H4_LOOKBACK * 16
    cooldown_until = 0

    for i in range(min_m15_index, len(m15_all) - OUTCOME_WINDOW_H1 * 4):
        current_time = m15_all[i]["time"]
        if current_time < cooldown_until:
            continue

        h4_window = [c for c in h4_all if c["time"] <= current_time][-H4_LOOKBACK:]
        h1_window = [c for c in h1_all if c["time"] <= current_time][-H1_LOOKBACK:]

        if len(h4_window) < 10 or len(h1_window) < 10:
            continue

        # Run checks
        trend_dir, trend_clarity = check_h4_trend(h4_window)
        if trend_dir == "RANGING":
            continue

        in_kz, kz_name = check_kill_zone_at(current_time)
        if not in_kz:
            continue

        zone, zone_aligned = check_premium_discount(h4_window, trend_dir)
        if not zone_aligned:
            continue

        sweep_detected, wick_ratio = check_h1_sweep(h1_window, trend_dir, wick_threshold)
        if not sweep_detected:
            continue

        displacement, body_ratio = check_h1_displacement(h1_window, trend_dir, disp_threshold)
        if not displacement:
            continue

        # All 5 passed! Check outcome
        direction = "BUY" if trend_dir == "BULLISH" else "SELL"
        results["total_signals"] += 1

        h1_after = [c for c in h1_all if c["time"] > current_time][:OUTCOME_WINDOW_H1]
        avg_range = calculate_avg_h1_range(h1_window)
        sl_price = avg_range * SL_ATR_MULTIPLIER
        outcome = check_outcome(h1_after, direction, sl_price, RR_TARGET)

        if outcome == "WIN":
            results["wins"] += 1
        elif outcome == "LOSS":
            results["losses"] += 1
        else:
            results["neutrals"] += 1

        if verbose:
            signal_dt = datetime.utcfromtimestamp(current_time)
            emoji = "+" if outcome == "WIN" else "-" if outcome == "LOSS" else "~"
            print(f"  [{emoji}] {symbol:6s} {signal_dt.strftime('%m/%d %H:%M')} {direction:4s} "
                  f"| {trend_dir:7s} {zone:12s} KZ={kz_name:13s} "
                  f"wick={wick_ratio:.2f} disp={body_ratio:.2f} -> {outcome}")

        cooldown_until = current_time + COOLDOWN_SECONDS

    return results


# ============================================================
# MAIN GRID TEST
# ============================================================

def run_grid_test():
    end_date = datetime.now()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS)

    print(f"\n{'='*70}")
    print(f"  GATEKEEPER Pre-Filter Backtester v3")
    print(f"  Period: {start_date.date()} to {end_date.date()} ({LOOKBACK_DAYS} days)")
    print(f"  Pairs: {', '.join(PAIRS)}")
    print(f"  Outcome window: {OUTCOME_WINDOW_H1} H1 candles")
    print(f"  Wick thresholds: {WICK_THRESHOLDS}")
    print(f"  Disp thresholds: {DISP_THRESHOLDS}")
    print(f"{'='*70}\n")

    # Prefetch all data once
    print("  FETCHING DATA...")
    all_data = prefetch_all_data(PAIRS, start_date, end_date)
    print(f"\n  {len(all_data)} pairs loaded.\n")

    if not all_data:
        print("  [ERROR] No data available")
        return

    # First run verbose output for default thresholds (wick=0.55, disp=0.60)
    print(f"\n{'#'*70}")
    print(f"  DETAILED SIGNALS (wick=0.55, disp=0.60)")
    print(f"{'#'*70}")
    for symbol in all_data:
        backtest_pair(symbol, all_data[symbol], 0.55, 0.60, verbose=True)

    # Run the full 2D grid
    grid_results = {}

    for wt in WICK_THRESHOLDS:
        for dt in DISP_THRESHOLDS:
            total_s, total_w, total_l, total_n = 0, 0, 0, 0
            for symbol, pair_data in all_data.items():
                r = backtest_pair(symbol, pair_data, wt, dt, verbose=False)
                total_s += r["total_signals"]
                total_w += r["wins"]
                total_l += r["losses"]
                total_n += r["neutrals"]

            decided = total_w + total_l
            wr = (total_w / decided * 100) if decided > 0 else 0
            ev = ((total_w / decided) * RR_TARGET - (total_l / decided)) if decided > 0 else 0
            spw = total_s / (LOOKBACK_DAYS / 7)

            grid_results[(wt, dt)] = {
                "signals": total_s,
                "wins": total_w,
                "losses": total_l,
                "neutrals": total_n,
                "win_rate": wr,
                "ev": ev,
                "spw": spw,
            }

    # Print grid comparison
    print(f"\n\n{'='*90}")
    print(f"  2D THRESHOLD GRID RESULTS ({len(all_data)} pairs, {LOOKBACK_DAYS} days)")
    print(f"{'='*90}")
    print(f"\n  {'Wick':>5s} | {'Disp':>5s} | {'Sig':>4s} | {'S/Wk':>5s} | {'W':>3s} | {'L':>3s} | {'N':>3s} | {'WR%':>6s} | {'EV/Trade':>9s} | {'Mo.R':>6s}")
    print(f"  {'─'*5}─┼─{'─'*5}─┼─{'─'*4}─┼─{'─'*5}─┼─{'─'*3}─┼─{'─'*3}─┼─{'─'*3}─┼─{'─'*6}─┼─{'─'*9}─┼─{'─'*6}")

    best_key = None
    best_score = -999  # score = EV * sqrt(signals) to balance quality and quantity

    for (wt, dt), d in sorted(grid_results.items()):
        monthly_r = d["ev"] * d["spw"] * 4.3
        marker = ""

        # Score: balance EV with sample size
        score = d["ev"] * (d["signals"] ** 0.5) if d["signals"] > 0 else -999
        if score > best_score and d["signals"] >= 5:
            best_score = score
            best_key = (wt, dt)

        print(f"  {wt:>5.2f} | {dt:>5.2f} | {d['signals']:>4d} | {d['spw']:>5.1f} | "
              f"{d['wins']:>3d} | {d['losses']:>3d} | {d['neutrals']:>3d} | {d['win_rate']:>5.1f}% | "
              f"{d['ev']:>+8.2f}R | {monthly_r:>+5.1f}R")

    # Highlight best
    if best_key:
        d = grid_results[best_key]
        monthly_r = d["ev"] * d["spw"] * 4.3
        print(f"\n  RECOMMENDED: wick={best_key[0]}, disp={best_key[1]}")
        print(f"  -> {d['signals']} signals ({d['spw']:.1f}/wk), {d['win_rate']:.1f}% WR, "
              f"{d['ev']:+.2f}R/trade, {monthly_r:+.1f}R/month")
    else:
        print(f"\n  Not enough signals to recommend. Try more pairs or longer period.")

    # Per-pair breakdown for best combo
    if best_key:
        wt, dt = best_key
        print(f"\n  {'─'*60}")
        print(f"  PER-PAIR BREAKDOWN (wick={wt}, disp={dt})")
        print(f"  {'─'*60}")
        for symbol, pair_data in all_data.items():
            r = backtest_pair(symbol, pair_data, wt, dt, verbose=False)
            s, w, l, n = r["total_signals"], r["wins"], r["losses"], r["neutrals"]
            decided = w + l
            wr = (w / decided * 100) if decided > 0 else 0
            ev = ((w / decided) * RR_TARGET - (l / decided)) if decided > 0 else 0
            print(f"    {symbol:8s}: {s:2d} signals, {w}W/{l}L/{n}N, "
                  f"WR={wr:5.1f}%, EV={ev:+.2f}R")


def main():
    connect_mt5()
    run_grid_test()
    mt5.shutdown()
    print("\n\nDone. Update prefilter.ts thresholds based on the recommended values above.")


if __name__ == "__main__":
    main()
