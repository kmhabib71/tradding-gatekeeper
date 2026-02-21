"""
GATEKEEPER Pre-Filter Backtester v4
Tests pre-filter as a SCREENING tool — its job is to surface potential setups
for the AI to evaluate, not to find winning trades by itself.

Three pass modes tested:
  A) KZ + Trend + Zone + Sweep + Displacement (AND — current strict)
  B) KZ + Trend + Zone + (Sweep OR Displacement) (OR — recommended)
  C) KZ + Trend + Zone only (baseline — no H1 activity check)

The AI (Stage 2) is the real decision-maker. The prefilter just needs to:
  1. Not waste AI calls on obvious junk
  2. Not miss genuine setups

Usage: python backtest_prefilter.py
"""

import MetaTrader5 as mt5
import sys
from datetime import datetime, timedelta

# === CONFIG ===
PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "GBPJPY"]
LOOKBACK_DAYS = 90
H4_LOOKBACK = 50
H1_LOOKBACK = 50
OUTCOME_WINDOW_H1 = 24
SL_ATR_MULTIPLIER = 1.5
RR_TARGET = 2.0
COOLDOWN_SECONDS = 14400  # 4 hours

KILL_ZONES = [
    (7, 10, "LONDON"),
    (12, 15, "NEW_YORK"),
    (15, 17, "LONDON_CLOSE"),
]

# Thresholds for sweep and displacement
WICK_THRESHOLD = 0.50
DISP_THRESHOLD = 0.60


def connect_mt5():
    if not mt5.initialize():
        print(f"[ERROR] MT5 init failed: {mt5.last_error()}")
        sys.exit(1)
    print("[OK] Connected to MT5")


def fetch_candles(symbol, timeframe, start_date, end_date):
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
    return 0.01 if "JPY" in symbol else 0.0001


# ============================================================
# PRE-FILTER CHECKS
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
    if pos > 0.667: zone = "PREMIUM"
    elif pos < 0.333: zone = "DISCOUNT"
    else: zone = "EQUILIBRIUM"
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


def check_h1_sweep(candles, trend_dir, threshold):
    if len(candles) < 5 or trend_dir == "RANGING":
        return False, 0.0
    recent = candles[-8:]
    max_ratio = 0.0
    for c in recent:
        total_range = c["high"] - c["low"]
        if total_range <= 0: continue
        upper = c["high"] - max(c["open"], c["close"])
        lower = min(c["open"], c["close"]) - c["low"]
        relevant = lower if trend_dir == "BULLISH" else upper
        ratio = relevant / total_range
        if ratio > max_ratio: max_ratio = ratio
    return max_ratio >= threshold, round(max_ratio, 3)


def check_h1_displacement(candles, trend_dir, threshold):
    if len(candles) < 3 or trend_dir == "RANGING":
        return False, 0.0
    recent = candles[-3:]
    max_ratio = 0.0
    for c in recent:
        total_range = c["high"] - c["low"]
        if total_range <= 0: continue
        body = abs(c["close"] - c["open"])
        ratio = body / total_range
        is_bull = c["close"] > c["open"]
        match = (trend_dir == "BULLISH" and is_bull) or (trend_dir == "BEARISH" and not is_bull)
        if match and ratio > max_ratio: max_ratio = ratio
    return max_ratio >= threshold, round(max_ratio, 3)


# ============================================================
# OUTCOME CHECKING
# ============================================================

def check_outcome(h1_after, direction, sl_pips, rr_target):
    if not h1_after or direction == "NONE":
        return "NEUTRAL"
    tp_pips = sl_pips * rr_target
    entry = h1_after[0]["open"]
    for c in h1_after:
        if direction == "BUY":
            if c["low"] <= entry - sl_pips: return "LOSS"
            if c["high"] >= entry + tp_pips: return "WIN"
        elif direction == "SELL":
            if c["high"] >= entry + sl_pips: return "LOSS"
            if c["low"] <= entry - tp_pips: return "WIN"
    return "NEUTRAL"


def calc_avg_h1_range(candles):
    if not candles: return 0
    ranges = [c["high"] - c["low"] for c in candles[-20:]]
    return sum(ranges) / len(ranges)


# ============================================================
# DATA PREFETCH
# ============================================================

def prefetch_all_data(pairs, start_date, end_date):
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
# BACKTEST WITH MODE PARAMETER
# ============================================================

def backtest_pair(symbol, pair_data, mode, verbose=False):
    """
    mode: "AND" = sweep AND displacement
          "OR"  = sweep OR displacement
          "BASE" = no H1 check (just KZ + trend + zone)
    """
    h4_all, h1_all, m15_all = pair_data["h4"], pair_data["h1"], pair_data["m15"]
    results = {"total_signals": 0, "wins": 0, "losses": 0, "neutrals": 0}

    min_m15_index = H4_LOOKBACK * 16
    cooldown_until = 0

    for i in range(min_m15_index, len(m15_all) - OUTCOME_WINDOW_H1 * 4):
        current_time = m15_all[i]["time"]
        if current_time < cooldown_until:
            continue

        h4_w = [c for c in h4_all if c["time"] <= current_time][-H4_LOOKBACK:]
        h1_w = [c for c in h1_all if c["time"] <= current_time][-H1_LOOKBACK:]
        if len(h4_w) < 10 or len(h1_w) < 10:
            continue

        # Mandatory checks
        trend_dir, clarity = check_h4_trend(h4_w)
        if trend_dir == "RANGING": continue

        in_kz, kz_name = check_kill_zone_at(current_time)
        if not in_kz: continue

        zone, zone_aligned = check_premium_discount(h4_w, trend_dir)
        if not zone_aligned: continue

        # H1 activity checks (mode-dependent)
        sweep, wick_r = check_h1_sweep(h1_w, trend_dir, WICK_THRESHOLD)
        disp, body_r = check_h1_displacement(h1_w, trend_dir, DISP_THRESHOLD)

        if mode == "AND" and not (sweep and disp): continue
        if mode == "OR" and not (sweep or disp): continue
        # mode == "BASE" — no H1 filter

        direction = "BUY" if trend_dir == "BULLISH" else "SELL"
        results["total_signals"] += 1

        h1_after = [c for c in h1_all if c["time"] > current_time][:OUTCOME_WINDOW_H1]
        sl = calc_avg_h1_range(h1_w) * SL_ATR_MULTIPLIER
        outcome = check_outcome(h1_after, direction, sl, RR_TARGET)

        if outcome == "WIN": results["wins"] += 1
        elif outcome == "LOSS": results["losses"] += 1
        else: results["neutrals"] += 1

        if verbose:
            dt = datetime.utcfromtimestamp(current_time)
            e = "+" if outcome == "WIN" else "-" if outcome == "LOSS" else "~"
            sw_tag = "SW" if sweep else "  "
            dp_tag = "DP" if disp else "  "
            print(f"  [{e}] {symbol:6s} {dt.strftime('%m/%d %H:%M')} {direction:4s} "
                  f"| {trend_dir:7s} {zone:12s} KZ={kz_name:13s} "
                  f"{sw_tag} {dp_tag} wick={wick_r:.2f} disp={body_r:.2f} -> {outcome}")

        cooldown_until = current_time + COOLDOWN_SECONDS

    return results


# ============================================================
# MAIN
# ============================================================

def run_mode_comparison():
    end_date = datetime.now()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS)

    print(f"\n{'='*75}")
    print(f"  GATEKEEPER Pre-Filter Backtester v4 — MODE COMPARISON")
    print(f"  Period: {start_date.date()} to {end_date.date()} ({LOOKBACK_DAYS} days)")
    print(f"  Pairs: {', '.join(PAIRS)}")
    print(f"  Wick threshold: {WICK_THRESHOLD}, Disp threshold: {DISP_THRESHOLD}")
    print(f"  Outcome window: {OUTCOME_WINDOW_H1} H1, Cooldown: {COOLDOWN_SECONDS//3600}h")
    print(f"{'='*75}\n")

    print("  FETCHING DATA...")
    all_data = prefetch_all_data(PAIRS, start_date, end_date)
    print(f"\n  {len(all_data)} pairs loaded.\n")

    if not all_data:
        print("  [ERROR] No data")
        return

    modes = [
        ("BASE", "KZ + Trend + Zone (no H1 check)"),
        ("OR",   "KZ + Trend + Zone + (Sweep OR Disp)"),
        ("AND",  "KZ + Trend + Zone + Sweep + Disp"),
    ]

    mode_totals = {}

    for mode, desc in modes:
        print(f"\n{'#'*75}")
        print(f"  MODE: {mode} — {desc}")
        print(f"{'#'*75}")

        total_s, total_w, total_l, total_n = 0, 0, 0, 0

        for symbol in all_data:
            r = backtest_pair(symbol, all_data[symbol], mode, verbose=True)
            total_s += r["total_signals"]
            total_w += r["wins"]
            total_l += r["losses"]
            total_n += r["neutrals"]

        decided = total_w + total_l
        wr = (total_w / decided * 100) if decided > 0 else 0
        ev = ((total_w / decided) * RR_TARGET - (total_l / decided)) if decided > 0 else 0
        spw = total_s / (LOOKBACK_DAYS / 7)

        mode_totals[mode] = {
            "signals": total_s, "wins": total_w, "losses": total_l,
            "neutrals": total_n, "wr": wr, "ev": ev, "spw": spw,
        }

        print(f"\n  {mode} SUMMARY: {total_s} signals ({spw:.1f}/wk), "
              f"{total_w}W/{total_l}L/{total_n}N, WR={wr:.1f}%, EV={ev:+.2f}R")

    # Comparison table
    print(f"\n\n{'='*75}")
    print(f"  MODE COMPARISON TABLE")
    print(f"{'='*75}")
    print(f"\n  {'Mode':>5s} | {'Signals':>8s} | {'S/Wk':>5s} | {'W':>3s} | {'L':>3s} | {'N':>3s} | {'WR%':>6s} | {'EV':>7s} | {'Mo.R':>6s} | Description")
    print(f"  {'─'*5}─┼─{'─'*8}─┼─{'─'*5}─┼─{'─'*3}─┼─{'─'*3}─┼─{'─'*3}─┼─{'─'*6}─┼─{'─'*7}─┼─{'─'*6}─┼─{'─'*30}")

    for mode, desc in modes:
        d = mode_totals[mode]
        mr = d["ev"] * d["spw"] * 4.3
        print(f"  {mode:>5s} | {d['signals']:>8d} | {d['spw']:>5.1f} | "
              f"{d['wins']:>3d} | {d['losses']:>3d} | {d['neutrals']:>3d} | "
              f"{d['wr']:>5.1f}% | {d['ev']:>+6.2f}R | {mr:>+5.1f}R | {desc}")

    # Per-pair for OR mode (recommended)
    print(f"\n  {'─'*60}")
    print(f"  PER-PAIR BREAKDOWN (OR mode)")
    print(f"  {'─'*60}")
    for symbol in all_data:
        r = backtest_pair(symbol, all_data[symbol], "OR", verbose=False)
        s, w, l, n = r["total_signals"], r["wins"], r["losses"], r["neutrals"]
        decided = w + l
        wr = (w / decided * 100) if decided > 0 else 0
        ev = ((w / decided) * RR_TARGET - (l / decided)) if decided > 0 else 0
        print(f"    {symbol:8s}: {s:2d} signals ({s/(LOOKBACK_DAYS/7):.1f}/wk), "
              f"{w}W/{l}L/{n}N, WR={wr:5.1f}%, EV={ev:+.2f}R")

    print(f"\n  NOTE: These are PRE-FILTER signals fed to the AI.")
    print(f"  The AI (Stage 2) will reject ~50% of these, improving the final WR.")
    print(f"  Target: ~3-5 AI calls/week at ~$0.05/call = $0.75-1.25/week")


def main():
    connect_mt5()
    run_mode_comparison()
    mt5.shutdown()
    print("\n\nDone.")


if __name__ == "__main__":
    main()
