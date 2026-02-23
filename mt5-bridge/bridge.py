"""
GATEKEEPER MT5 Bridge
Connects to MetaTrader 5, captures screenshots, reads account/position data,
and sends everything to the Gatekeeper web app for AI analysis.

Usage:
  1. Make sure MT5 is running with your prop firm account
  2. pip install -r requirements.txt
  3. python bridge.py

Controls:
  - Press F8  to minimize/restore the console window
  - Press F9  to capture screenshot + data and send to Gatekeeper
  - Press F10 to refresh account data only (no screenshot)
  - Press F11 to start auto-scanner (pre-filter every 15 min during kill zones)
  - Press F12 to stop auto-scanner
  - Press Ctrl+Q to quit
"""

import MetaTrader5 as mt5
import time
import sys
import json
import base64
import io
import os
import threading
from datetime import datetime
from PIL import ImageGrab
import requests
import keyboard
import ctypes

# === CONFIG ===
GATEKEEPER_URL = os.environ.get("GATEKEEPER_URL", "http://localhost:3000")
GATEKEEPER_PASSWORD = os.environ.get("GATEKEEPER_PASSWORD", "gatekeeper123")
CAPTURE_HOTKEY = "F9"
REFRESH_HOTKEY = "F10"
SCAN_START_HOTKEY = "F11"
SCAN_STOP_HOTKEY = "F12"
MINIMIZE_HOTKEY = "F8"
QUIT_HOTKEY = "ctrl+q"

# MT5 timeframe mapping for OHLC data
TIMEFRAME_MAP = {
    "H4": mt5.TIMEFRAME_H4,
    "H1": mt5.TIMEFRAME_H1,
    "M15": mt5.TIMEFRAME_M15,
    "M5": mt5.TIMEFRAME_M5,
}

# Scanner state
scanner_running = False
scanner_thread = None

# Console window state
console_minimized = False


def get_console_window():
    """Get the handle to the console window"""
    return ctypes.windll.kernel32.GetConsoleWindow()


def on_minimize_toggle():
    """Toggle minimize/restore of the console window"""
    global console_minimized
    hwnd = get_console_window()
    if hwnd == 0:
        return

    SW_MINIMIZE = 6
    SW_RESTORE = 9

    if console_minimized:
        ctypes.windll.user32.ShowWindow(hwnd, SW_RESTORE)
        ctypes.windll.user32.SetForegroundWindow(hwnd)
        console_minimized = False
    else:
        ctypes.windll.user32.ShowWindow(hwnd, SW_MINIMIZE)
        console_minimized = True


def connect_mt5():
    """Initialize connection to MetaTrader 5"""
    if not mt5.initialize():
        print(f"[ERROR] MT5 initialization failed: {mt5.last_error()}")
        print("Make sure MetaTrader 5 is running.")
        sys.exit(1)

    info = mt5.terminal_info()
    if info is None:
        print("[ERROR] Could not get terminal info")
        sys.exit(1)

    print(f"[OK] Connected to MT5: {info.name}")
    print(f"     Build: {info.build}")
    print(f"     Path:  {info.path}")
    return True


def get_account_data():
    """Read account information from MT5"""
    account = mt5.account_info()
    if account is None:
        return None

    return {
        "balance": account.balance,
        "equity": account.equity,
        "profit": account.profit,
        "margin": account.margin,
        "marginFree": account.margin_free,
        "marginLevel": account.margin_level,
        "leverage": account.leverage,
        "currency": account.currency,
        "server": account.server,
        "name": account.name,
    }


def get_open_positions():
    """Get all currently open positions"""
    positions = mt5.positions_get()
    if positions is None or len(positions) == 0:
        return []

    result = []
    for pos in positions:
        result.append({
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "type": "BUY" if pos.type == 0 else "SELL",
            "volume": pos.volume,
            "openPrice": pos.price_open,
            "currentPrice": pos.price_current,
            "sl": pos.sl,
            "tp": pos.tp,
            "profit": pos.profit,
            "swap": pos.swap,
            "openTime": datetime.fromtimestamp(pos.time).isoformat(),
            "comment": pos.comment,
        })
    return result


def get_symbol_data(symbol):
    """Get current price data for a symbol"""
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return None

    info = mt5.symbol_info(symbol)
    spread = info.spread if info else 0

    return {
        "symbol": symbol,
        "bid": tick.bid,
        "ask": tick.ask,
        "spread": spread,
        "time": datetime.fromtimestamp(tick.time).isoformat(),
    }


def get_todays_history():
    """Get today's closed trades"""
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    deals = mt5.history_deals_get(today_start, datetime.now())
    if deals is None or len(deals) == 0:
        return []

    result = []
    for deal in deals:
        if deal.entry == 1:  # Only exits (closed trades)
            result.append({
                "ticket": deal.ticket,
                "symbol": deal.symbol,
                "type": "BUY" if deal.type == 0 else "SELL",
                "volume": deal.volume,
                "price": deal.price,
                "profit": deal.profit,
                "time": datetime.fromtimestamp(deal.time).isoformat(),
                "comment": deal.comment,
            })
    return result


def capture_screenshot():
    """Capture full screen screenshot - no cropping"""
    img = ImageGrab.grab()

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    base64_data = base64.b64encode(buffer.read()).decode("utf-8")

    # Also save locally for reference
    screenshots_dir = os.path.join(os.path.dirname(__file__), "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)
    filename = f"mt5_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    filepath = os.path.join(screenshots_dir, filename)
    img.save(filepath)
    print(f"  Screenshot saved: {filepath}")

    return base64_data


def login_to_gatekeeper():
    """Authenticate with the Gatekeeper app and get session cookie"""
    try:
        res = requests.post(
            f"{GATEKEEPER_URL}/api/auth/login",
            json={"password": GATEKEEPER_PASSWORD},
            timeout=5,
        )
        if res.status_code == 200:
            print("[OK] Authenticated with Gatekeeper")
            return res.cookies
        else:
            print(f"[ERROR] Auth failed: {res.status_code}")
            return None
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Cannot connect to Gatekeeper at {GATEKEEPER_URL}")
        print("  Make sure the Next.js app is running (npm run dev)")
        return None


def send_to_gatekeeper(cookies, data):
    """Send MT5 data to Gatekeeper app"""
    try:
        res = requests.post(
            f"{GATEKEEPER_URL}/api/mt5",
            json=data,
            cookies=cookies,
            timeout=10,
        )
        if res.status_code == 200:
            print("[OK] Data sent to Gatekeeper")
            return True
        else:
            print(f"[ERROR] Send failed: {res.status_code} - {res.text}")
            return False
    except Exception as e:
        print(f"[ERROR] Send failed: {e}")
        return False


def get_ohlc_data(symbol, timeframe_str, count=50):
    """Fetch OHLC candle data for a symbol and timeframe"""
    tf = TIMEFRAME_MAP.get(timeframe_str)
    if tf is None:
        return None

    # Ensure symbol is available in Market Watch
    mt5.symbol_select(symbol, True)

    rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
    if rates is None or len(rates) == 0:
        return None

    result = []
    for r in rates:
        result.append({
            "time": int(r["time"]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": int(r["tick_volume"]),
        })
    return result


def auto_scan(cookies):
    """Automated scan loop - runs every N minutes, sends OHLC to pre-filter"""
    global scanner_running

    print("[SCANNER] Auto-scanner started. Checking settings each cycle...")

    while scanner_running:
        try:
            # 1. Fetch settings from Gatekeeper
            settings_res = requests.get(
                f"{GATEKEEPER_URL}/api/scanner/control",
                cookies=cookies,
                timeout=5,
            )
            if settings_res.status_code != 200:
                print("[SCANNER] Failed to fetch settings, retrying in 30s...")
                time.sleep(30)
                continue

            settings = settings_res.json()
            if not settings.get("scannerEnabled", False):
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [SCANNER] Disabled in settings, checking again in 30s...")
                time.sleep(30)
                continue

            pairs = settings.get("scannerPairs", ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"])
            interval = settings.get("scanIntervalMinutes", 15)

            # 2. Fetch OHLC data for all pairs
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] [SCANNER] Scanning {len(pairs)} pairs...")
            all_ohlc = {}
            for pair in pairs:
                pair_data = {}
                for tf in ["H4", "H1", "M15", "M5"]:
                    candles = get_ohlc_data(pair, tf, 50)
                    if candles:
                        pair_data[tf.lower()] = candles
                if len(pair_data) == 4:  # All 4 timeframes available
                    all_ohlc[pair] = pair_data
                else:
                    print(f"  [SCANNER] {pair}: Missing timeframe data, skipping")

            if not all_ohlc:
                print("[SCANNER] No valid OHLC data collected, retrying next cycle")
                _scanner_sleep(interval * 60)
                continue

            # 3. Send to pre-filter endpoint
            prefilter_res = requests.post(
                f"{GATEKEEPER_URL}/api/scanner/prefilter",
                json={"pairs": all_ohlc},
                cookies=cookies,
                timeout=30,
            )

            if prefilter_res.status_code == 200:
                result = prefilter_res.json()
                triggered = result.get("triggeredPairs", [])
                results = result.get("results", {})

                # Print summary for each pair
                for pair, data in results.items():
                    status = "PASS" if data["passed"] else "FAIL"
                    reasons = ", ".join(data["reasons"]) if data["reasons"] else "no conditions met"
                    print(f"  [SCANNER] {pair}: {status} ({reasons})")

                if triggered:
                    print(f"\n  >>> SETUP POTENTIAL DETECTED: {', '.join(triggered)}")
                    print(f"  >>> Open Gatekeeper -> Analyze, select the pair, and capture screenshot with F9")
                else:
                    print(f"  [SCANNER] No pairs triggered. Waiting {interval} min...")
            else:
                print(f"[SCANNER] Pre-filter request failed: {prefilter_res.status_code}")

            # 4. Sleep for the interval
            _scanner_sleep(interval * 60)

        except Exception as e:
            print(f"[SCANNER] Error: {e}")
            time.sleep(60)

    print("[SCANNER] Auto-scanner stopped.")


def _scanner_sleep(seconds):
    """Sleep in 1-second increments so scanner can be stopped quickly"""
    for _ in range(seconds):
        if not scanner_running:
            break
        time.sleep(1)


def on_scan_start():
    """Start the auto-scanner"""
    global scanner_running, scanner_thread

    if scanner_running:
        print("[SCANNER] Already running")
        return

    cookies = login_to_gatekeeper()
    if not cookies:
        print("[SCANNER] Cannot start - authentication failed")
        return

    # Enable in settings
    try:
        requests.post(
            f"{GATEKEEPER_URL}/api/scanner/control",
            json={"action": "start"},
            cookies=cookies,
            timeout=5,
        )
    except Exception:
        pass

    scanner_running = True
    scanner_thread = threading.Thread(target=auto_scan, args=(cookies,), daemon=True)
    scanner_thread.start()
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] [SCANNER] Started (F12 to stop)")


def on_scan_stop():
    """Stop the auto-scanner"""
    global scanner_running

    if not scanner_running:
        print("[SCANNER] Not running")
        return

    scanner_running = False

    # Disable in settings
    cookies = login_to_gatekeeper()
    if cookies:
        try:
            requests.post(
                f"{GATEKEEPER_URL}/api/scanner/control",
                json={"action": "stop"},
                cookies=cookies,
                timeout=5,
            )
        except Exception:
            pass

    print(f"[{datetime.now().strftime('%H:%M:%S')}] [SCANNER] Stopping...")


def on_capture():
    """Handle capture hotkey press"""
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Capturing MT5 data + screenshot...")

    # Gather all data
    account = get_account_data()
    positions = get_open_positions()
    history = get_todays_history()
    screenshot = capture_screenshot()

    # Get data for tracked symbols
    symbols_data = {}
    for sym in ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"]:
        data = get_symbol_data(sym)
        if data:
            symbols_data[sym] = data

    payload = {
        "account": account,
        "positions": positions,
        "todayHistory": history,
        "symbols": symbols_data,
        "screenshot": f"data:image/png;base64,{screenshot}",
        "capturedAt": datetime.now().isoformat(),
    }

    # Print summary
    if account:
        print(f"  Balance: ${account['balance']:.2f}  Equity: ${account['equity']:.2f}  P/L: ${account['profit']:.2f}")
    print(f"  Open positions: {len(positions)}")
    print(f"  Today's closed: {len(history)}")
    today_pnl = sum(d["profit"] for d in history)
    print(f"  Today's P&L: ${today_pnl:.2f}")

    # Send to Gatekeeper
    cookies = login_to_gatekeeper()
    if cookies:
        send_to_gatekeeper(cookies, payload)


def on_refresh():
    """Handle refresh hotkey - send account data only (no screenshot)"""
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Refreshing account data...")

    account = get_account_data()
    positions = get_open_positions()

    if account:
        print(f"  Balance: ${account['balance']:.2f}  Equity: ${account['equity']:.2f}")

    payload = {
        "account": account,
        "positions": positions,
        "capturedAt": datetime.now().isoformat(),
    }

    cookies = login_to_gatekeeper()
    if cookies:
        send_to_gatekeeper(cookies, payload)


def main():
    print("=" * 50)
    print("  GATEKEEPER MT5 Bridge")
    print("=" * 50)
    print()

    # Connect to MT5
    connect_mt5()

    # Show initial account info
    account = get_account_data()
    if account:
        print(f"\nAccount: {account['name']}")
        print(f"Server:  {account['server']}")
        print(f"Balance: ${account['balance']:.2f}")
        print(f"Equity:  ${account['equity']:.2f}")

    print(f"\nHotkeys:")
    print(f"  {MINIMIZE_HOTKEY}     - Minimize/restore console window")
    print(f"  {CAPTURE_HOTKEY}     - Capture screenshot + data -> send to Gatekeeper")
    print(f"  {REFRESH_HOTKEY}    - Refresh account data only")
    print(f"  {SCAN_START_HOTKEY}    - Start auto-scanner (pre-filter every N min)")
    print(f"  {SCAN_STOP_HOTKEY}    - Stop auto-scanner")
    print(f"  {QUIT_HOTKEY} - Quit")
    print(f"\nGatekeeper URL: {GATEKEEPER_URL}")
    print("\nWaiting for hotkey press...\n")

    # Register hotkeys
    keyboard.add_hotkey(MINIMIZE_HOTKEY, on_minimize_toggle)
    keyboard.add_hotkey(CAPTURE_HOTKEY, on_capture)
    keyboard.add_hotkey(REFRESH_HOTKEY, on_refresh)
    keyboard.add_hotkey(SCAN_START_HOTKEY, on_scan_start)
    keyboard.add_hotkey(SCAN_STOP_HOTKEY, on_scan_stop)

    # Wait for quit
    keyboard.wait(QUIT_HOTKEY)

    print("\nShutting down...")
    global scanner_running
    scanner_running = False
    mt5.shutdown()
    print("Done.")


if __name__ == "__main__":
    main()
