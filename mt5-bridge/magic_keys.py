"""
Magic Keys On-Screen — Digital Trading Keypad for MetaTrader 5

A standalone, always-on-top overlay that replicates the physical Magic Keys
trading pad. Sends trade commands directly to MT5 via the MetaTrader5 Python API.

Usage:
  1. Make sure MT5 is running
  2. python magic_keys.py
"""

import tkinter as tk
from tkinter import simpledialog, messagebox
import json
import os
import sys
import shutil
import threading
import time
from datetime import datetime

try:
    import MetaTrader5 as mt5
except ImportError:
    print("[ERROR] MetaTrader5 package not installed. Run: pip install MetaTrader5")
    sys.exit(1)

# ============================================================================
#  CONFIG & PERSISTENCE
# ============================================================================

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "magic_keys_config.json")

DEFAULT_CONFIG = {
    "risk_percent": 1.0,
    "risk_fixed": 0.0,        # if > 0, use fixed $ instead of %
    "sl_pips": 30,
    "default_rr": 2.0,
    "partial_tp_percent": 50,
    "partial_sl_lock_pips": 10,
    "sl_in_profit_pips": 5,
    "opacity": 0.92,
    "win_x": 100,
    "win_y": 100,
    "close_custom_percent": 50,
}


def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                saved = json.load(f)
            cfg = {**DEFAULT_CONFIG, **saved}
            return cfg
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)


def save_config(cfg):
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"[WARN] Could not save config: {e}")


# ============================================================================
#  MT5 CONNECTION & HELPERS
# ============================================================================

_mt5_connected = False
_mt5_files_path = None  # MQL5/Files/ sandbox path


def ensure_mt5():
    """Initialize MT5 if not already connected."""
    global _mt5_connected, _mt5_files_path
    if _mt5_connected:
        return True
    if not mt5.initialize():
        return False
    _mt5_connected = True
    # Use terminal's own MQL5/Files/ sandbox for EA communication
    info = mt5.terminal_info()
    if info and info.data_path:
        _mt5_files_path = os.path.join(info.data_path, "MQL5", "Files")
        os.makedirs(_mt5_files_path, exist_ok=True)
        print(f"[OK] File bridge path: {_mt5_files_path}")
    return True


def get_mt5_files_path():
    """Return the MQL5/Files/ sandbox path."""
    ensure_mt5()
    return _mt5_files_path


def install_ea_if_needed():
    """Copy MagicKeysBridge.mq5 to MT5 Experts folder if not already there."""
    ensure_mt5()
    info = mt5.terminal_info()
    if info is None:
        return
    experts_dir = os.path.join(info.data_path, "MQL5", "Experts")
    ea_src = os.path.join(os.path.dirname(__file__), "MagicKeysBridge.mq5")
    ea_dst = os.path.join(experts_dir, "MagicKeysBridge.mq5")
    if os.path.exists(ea_src):
        try:
            shutil.copy2(ea_src, ea_dst)
            print(f"[OK] Copied MagicKeysBridge.mq5 to {experts_dir}")
            print("     IMPORTANT: Open MetaEditor (F4), open the file, press F7 to compile!")
        except Exception as e:
            print(f"[WARN] Could not copy EA: {e}")


def write_ea_command(cmd_dict):
    """Write a command JSON file for the EA to read."""
    files_path = get_mt5_files_path()
    if files_path is None:
        print("[WARN] MT5 files path not available")
        return False
    filepath = os.path.join(files_path, "python_to_ea.json")
    try:
        text = json.dumps(cmd_dict, separators=(',', ':'))
        with open(filepath, "w", encoding="ascii", newline="") as f:
            f.write(text)
        print(f"[DEBUG] Wrote command: {text}")
        return True
    except Exception as e:
        print(f"[WARN] Could not write command: {e}")
        return False


def read_ea_response():
    """Read the response JSON file from the EA."""
    files_path = get_mt5_files_path()
    if files_path is None:
        return None
    filepath = os.path.join(files_path, "ea_to_python.json")
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except Exception:
        return None


def get_account():
    if not ensure_mt5():
        return None
    acc = mt5.account_info()
    if acc is None:
        return None
    return {
        "balance": acc.balance,
        "equity": acc.equity,
        "profit": acc.profit,
        "margin": acc.margin,
        "margin_free": acc.margin_free,
        "leverage": acc.leverage,
        "currency": acc.currency,
        "server": acc.server,
        "name": acc.name,
    }


def get_positions():
    if not ensure_mt5():
        return []
    positions = mt5.positions_get()
    if positions is None:
        return []
    return list(positions)


def get_symbol_info(symbol):
    if not ensure_mt5():
        return None
    info = mt5.symbol_info(symbol)
    if info is None:
        mt5.symbol_select(symbol, True)
        info = mt5.symbol_info(symbol)
    return info


def get_tick(symbol):
    if not ensure_mt5():
        return None
    return mt5.symbol_info_tick(symbol)


def pip_value(symbol_info):
    """Return the size of 1 pip for this symbol."""
    if symbol_info is None:
        return 0.0001
    digits = symbol_info.digits
    if digits == 3 or digits == 5:
        return 10 * symbol_info.point
    return symbol_info.point


def calculate_lots(balance, risk_pct, risk_fixed, sl_pips, symbol):
    """Calculate position size from risk and SL distance."""
    info = get_symbol_info(symbol)
    if info is None or sl_pips <= 0:
        return info.volume_min if info else 0.01

    risk_amount = risk_fixed if risk_fixed > 0 else balance * (risk_pct / 100.0)
    one_pip = pip_value(info)
    tick = get_tick(symbol)
    if tick is None:
        return info.volume_min

    # Value of 1 pip for 1 lot
    pip_val_per_lot = info.trade_tick_value * (one_pip / info.trade_tick_size) if info.trade_tick_size > 0 else 10.0

    if pip_val_per_lot <= 0:
        return info.volume_min

    lots = risk_amount / (sl_pips * pip_val_per_lot)

    # Round to lot step
    step = info.volume_step
    if step > 0:
        lots = round(lots / step) * step
    lots = max(info.volume_min, min(lots, info.volume_max))
    return round(lots, 2)


def get_focused_symbol():
    """Try to determine which symbol chart is focused in MT5.
    Falls back to the first symbol with an open position, or EURUSD."""
    # MT5 Python API doesn't expose focused chart, so we try:
    # 1. symbol of the selected position
    # 2. first open position symbol
    # 3. EURUSD
    positions = get_positions()
    if positions:
        return positions[0].symbol
    return "EURUSD"


# ============================================================================
#  TRADE OPERATIONS
# ============================================================================

def place_market_order(symbol, direction, lots, sl_pips, tp_pips):
    """Place a market BUY or SELL order."""
    if not ensure_mt5():
        return "MT5 not connected"

    info = get_symbol_info(symbol)
    tick = get_tick(symbol)
    if info is None or tick is None:
        return f"Cannot get info for {symbol}"

    one_pip = pip_value(info)
    point = info.point

    if direction == "BUY":
        price = tick.ask
        sl = price - sl_pips * one_pip if sl_pips > 0 else 0.0
        tp = price + tp_pips * one_pip if tp_pips > 0 else 0.0
        order_type = mt5.ORDER_TYPE_BUY
    else:
        price = tick.bid
        sl = price + sl_pips * one_pip if sl_pips > 0 else 0.0
        tp = price - tp_pips * one_pip if tp_pips > 0 else 0.0
        order_type = mt5.ORDER_TYPE_SELL

    # Normalize prices
    digits = info.digits
    price = round(price, digits)
    sl = round(sl, digits) if sl > 0 else 0.0
    tp = round(tp, digits) if tp > 0 else 0.0

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lots,
        "type": order_type,
        "price": price,
        "sl": sl,
        "tp": tp,
        "deviation": 20,
        "magic": 123456,
        "comment": "MagicKeys",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result is None:
        return f"Order failed: {mt5.last_error()}"
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return f"Order failed: {result.comment} (code {result.retcode})"
    return f"OK: {direction} {lots} {symbol} @ {price}"


def place_pending_order(symbol, direction, lots, sl_pips, tp_pips, entry_price):
    """Place a pending limit or stop order."""
    if not ensure_mt5():
        return "MT5 not connected"

    info = get_symbol_info(symbol)
    tick = get_tick(symbol)
    if info is None or tick is None:
        return f"Cannot get info for {symbol}"

    one_pip = pip_value(info)
    digits = info.digits
    entry_price = round(entry_price, digits)

    if direction == "BUY":
        sl = entry_price - sl_pips * one_pip if sl_pips > 0 else 0.0
        tp = entry_price + tp_pips * one_pip if tp_pips > 0 else 0.0
        # Buy below current = limit, above = stop
        if entry_price < tick.ask:
            order_type = mt5.ORDER_TYPE_BUY_LIMIT
        else:
            order_type = mt5.ORDER_TYPE_BUY_STOP
    else:
        sl = entry_price + sl_pips * one_pip if sl_pips > 0 else 0.0
        tp = entry_price - tp_pips * one_pip if tp_pips > 0 else 0.0
        if entry_price > tick.bid:
            order_type = mt5.ORDER_TYPE_SELL_LIMIT
        else:
            order_type = mt5.ORDER_TYPE_SELL_STOP

    sl = round(sl, digits) if sl > 0 else 0.0
    tp = round(tp, digits) if tp > 0 else 0.0

    request = {
        "action": mt5.TRADE_ACTION_PENDING,
        "symbol": symbol,
        "volume": lots,
        "type": order_type,
        "price": entry_price,
        "sl": sl,
        "tp": tp,
        "deviation": 20,
        "magic": 123456,
        "comment": "MagicKeys",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result is None:
        return f"Pending order failed: {mt5.last_error()}"
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return f"Pending order failed: {result.comment} (code {result.retcode})"
    return f"OK: Pending {direction} {lots} {symbol} @ {entry_price}"


def close_position(position, fraction=1.0):
    """Close a position (full or partial)."""
    if not ensure_mt5():
        return "MT5 not connected"

    volume = round(position.volume * fraction, 2)
    info = get_symbol_info(position.symbol)
    if info and info.volume_step > 0:
        volume = round(round(volume / info.volume_step) * info.volume_step, 2)
    volume = max(info.volume_min if info else 0.01, volume)

    tick = get_tick(position.symbol)
    if tick is None:
        return f"Cannot get tick for {position.symbol}"

    if position.type == 0:  # BUY -> close by SELL
        price = tick.bid
        order_type = mt5.ORDER_TYPE_SELL
    else:
        price = tick.ask
        order_type = mt5.ORDER_TYPE_BUY

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": position.symbol,
        "volume": volume,
        "type": order_type,
        "position": position.ticket,
        "price": price,
        "deviation": 20,
        "magic": 123456,
        "comment": "MK Close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result is None:
        return f"Close failed: {mt5.last_error()}"
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return f"Close failed: {result.comment} (code {result.retcode})"
    pct = int(fraction * 100)
    return f"OK: Closed {pct}% of #{position.ticket}"


def modify_sl_tp(position, new_sl=None, new_tp=None):
    """Modify SL and/or TP of an open position."""
    if not ensure_mt5():
        return "MT5 not connected"

    info = get_symbol_info(position.symbol)
    digits = info.digits if info else 5

    sl = round(new_sl, digits) if new_sl is not None else position.sl
    tp = round(new_tp, digits) if new_tp is not None else position.tp

    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": position.symbol,
        "position": position.ticket,
        "sl": sl,
        "tp": tp,
    }

    result = mt5.order_send(request)
    if result is None:
        return f"Modify failed: {mt5.last_error()}"
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return f"Modify failed: {result.comment} (code {result.retcode})"
    return f"OK: Modified #{position.ticket} SL={sl} TP={tp}"


# ============================================================================
#  TIMEFRAME / ZOOM — keyboard simulation to MT5 terminal
# ============================================================================

# MT5 chart timeframe shortcuts: we use keyboard lib to send keypresses
try:
    import keyboard as kb
    _has_keyboard = True
except ImportError:
    _has_keyboard = False

# MT5 uses these chart period shortcuts (when chart is focused):
# Ctrl+1 = M1, Ctrl+2 = M5, Ctrl+3 = M15, Ctrl+4 = M30,
# Ctrl+5 = H1, Ctrl+6 = H4, Ctrl+7 = D1, Ctrl+8 = W1, Ctrl+9 = MN

TF_ORDER = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"]
TF_KEYS = {
    "M1": "ctrl+1", "M5": "ctrl+2", "M15": "ctrl+3", "M30": "ctrl+4",
    "H1": "ctrl+5", "H4": "ctrl+6", "D1": "ctrl+7", "W1": "ctrl+8", "MN": "ctrl+9",
}


def send_tf_change(direction, current_tf_idx):
    """Send timeframe change hotkey to MT5. Returns new TF index."""
    if not _has_keyboard:
        return current_tf_idx
    new_idx = current_tf_idx + direction
    new_idx = max(0, min(len(TF_ORDER) - 1, new_idx))
    tf = TF_ORDER[new_idx]
    hotkey = TF_KEYS.get(tf)
    if hotkey:
        kb.send(hotkey)
    return new_idx


def send_zoom(direction):
    """Send zoom in/out to MT5 chart. + for in, - for out."""
    if not _has_keyboard:
        return
    if direction > 0:
        kb.send("+")
    else:
        kb.send("-")


# ============================================================================
#  MAIN APPLICATION
# ============================================================================

class MagicKeysApp:
    def __init__(self):
        self.cfg = load_config()
        self.root = tk.Tk()
        self.root.title("Magic Keys")
        self.root.overrideredirect(True)
        self.root.wm_attributes("-topmost", True)
        try:
            self.root.wm_attributes("-alpha", self.cfg["opacity"])
        except Exception:
            pass
        self.root.configure(bg="#1a1a1a")

        # State
        self.mode = "MARKET"        # MARKET or PENDING
        self.direction = "BUY"      # BUY or SELL
        self.fn_layer = 0           # 0=normal, 1=FN1, 2=FN2
        self.selected_pos_idx = -1  # index into open positions list
        self.current_tf_idx = 5     # H4 default
        self.last_order = None      # for DOUBLE ORDER
        self.status_text = tk.StringVar(value="Ready")
        self.lines_active = False   # True when SL/TP lines are shown on chart
        self._poll_id = None        # tkinter after() ID for EA polling
        self.minimized = False      # True when window is collapsed to title bar only
        self._saved_geometry = None  # saved geometry string before minimize
        self._hidden_widgets = []
        self._hidden_pack_info = {}

        # Window drag state
        self._drag_x = 0
        self._drag_y = 0

        # Position window
        self.root.geometry(f"+{self.cfg['win_x']}+{self.cfg['win_y']}")

        self._build_ui()

        # Connect MT5 in background
        self.root.after(100, self._init_mt5)

        # Save position on close
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _init_mt5(self):
        if ensure_mt5():
            install_ea_if_needed()
            acc = get_account()
            if acc:
                self.status_text.set(f"MT5: {acc['name']} | ${acc['balance']:.0f}")
            else:
                self.status_text.set("MT5: Connected (no account)")
        else:
            self.status_text.set("MT5: NOT CONNECTED")

    def _on_close(self):
        # Clean up chart lines if active
        if self.lines_active:
            write_ea_command({"action": "clear_lines"})
        # Save window position
        try:
            geo = self.root.geometry()
            parts = geo.split("+")
            self.cfg["win_x"] = int(parts[1])
            self.cfg["win_y"] = int(parts[2])
        except Exception:
            pass
        save_config(self.cfg)
        self.root.destroy()

    # ------ Drag support ------
    def _start_drag(self, event):
        self._drag_x = event.x
        self._drag_y = event.y

    def _do_drag(self, event):
        x = self.root.winfo_x() + event.x - self._drag_x
        y = self.root.winfo_y() + event.y - self._drag_y
        self.root.geometry(f"+{x}+{y}")

    # ------ Minimize / Restore ------
    def _toggle_minimize(self):
        """Collapse the window to just the title bar, or restore it."""
        if self.minimized:
            # Restore all hidden widgets in original order
            for widget in self._hidden_widgets:
                widget.pack(**self._hidden_pack_info[widget])
            self._hidden_widgets = []
            self._hidden_pack_info = {}
            self.min_btn.config(text=" \u2014 ")
            # Restore saved geometry
            if self._saved_geometry:
                self.root.geometry(self._saved_geometry)
            self.minimized = False
        else:
            # Save current geometry before collapsing
            self.root.update_idletasks()
            self._saved_geometry = self.root.geometry()
            # Hide everything except the title bar (first child)
            children = self.root.pack_slaves()
            self._hidden_widgets = []
            self._hidden_pack_info = {}
            for child in children[1:]:  # skip title_frame (index 0)
                # Save pack info before hiding
                info = child.pack_info()
                self._hidden_pack_info[child] = {
                    k: v for k, v in info.items() if k != 'in'
                }
                self._hidden_widgets.append(child)
                child.pack_forget()
            self.min_btn.config(text=" \u25a1 ")
            # Force a compact size — just the title bar width, pinned at current position
            x = self.root.winfo_x()
            y = self.root.winfo_y()
            self.root.geometry(f"200x28+{x}+{y}")
            self.minimized = True

    # ------ UI Building ------
    def _build_ui(self):
        # Colors matching the physical keypad
        WHITE = "#e8e8e8"
        GREEN = "#4caf50"
        YELLOW = "#ffc107"
        RED = "#f44336"
        DARK_BG = "#1a1a1a"
        BTN_FG_DARK = "#1a1a1a"
        BTN_FG_LIGHT = "#ffffff"

        # Title / drag bar
        title_frame = tk.Frame(self.root, bg="#111111", height=28)
        title_frame.pack(fill=tk.X)
        title_frame.pack_propagate(False)

        title_lbl = tk.Label(
            title_frame, text="  MK  Magic Keys", font=("Segoe UI", 9, "bold"),
            bg="#111111", fg="#888888", anchor="w"
        )
        title_lbl.pack(side=tk.LEFT, padx=4)

        close_btn = tk.Label(
            title_frame, text=" X ", font=("Segoe UI", 9, "bold"),
            bg="#111111", fg="#666666", cursor="hand2"
        )
        close_btn.pack(side=tk.RIGHT, padx=2)
        close_btn.bind("<Button-1>", lambda e: self._on_close())

        self.min_btn = tk.Label(
            title_frame, text=" \u2014 ", font=("Segoe UI", 9, "bold"),
            bg="#111111", fg="#666666", cursor="hand2"
        )
        self.min_btn.pack(side=tk.RIGHT, padx=0)
        self.min_btn.bind("<Button-1>", lambda e: self._toggle_minimize())

        # Make title bar draggable + double-click to restore
        title_frame.bind("<Button-1>", self._start_drag)
        title_frame.bind("<B1-Motion>", self._do_drag)
        title_frame.bind("<Double-Button-1>", lambda e: self._toggle_minimize())
        title_lbl.bind("<Button-1>", self._start_drag)
        title_lbl.bind("<B1-Motion>", self._do_drag)
        title_lbl.bind("<Double-Button-1>", lambda e: self._toggle_minimize())

        # Status bar
        status_frame = tk.Frame(self.root, bg="#111111", height=22)
        status_frame.pack(fill=tk.X)
        status_frame.pack_propagate(False)

        self.mode_label = tk.Label(
            status_frame, textvariable=self.status_text,
            font=("Segoe UI", 8), bg="#111111", fg="#888888"
        )
        self.mode_label.pack(side=tk.LEFT, padx=6)

        self.dir_label = tk.Label(
            status_frame, text="BUY", font=("Segoe UI", 8, "bold"),
            bg="#111111", fg="#4caf50"
        )
        self.dir_label.pack(side=tk.RIGHT, padx=6)

        self.mode_ind = tk.Label(
            status_frame, text="MARKET", font=("Segoe UI", 8, "bold"),
            bg="#111111", fg="#ffc107"
        )
        self.mode_ind.pack(side=tk.RIGHT, padx=6)

        # Button grid
        grid = tk.Frame(self.root, bg=DARK_BG, padx=4, pady=4)
        grid.pack(fill=tk.BOTH, expand=True)

        def make_btn(parent, text, color, row, col, colspan=1, command=None):
            bg = color
            fg = BTN_FG_DARK if color in (WHITE, GREEN, YELLOW) else BTN_FG_LIGHT
            if color == RED:
                fg = "#ffffff"

            btn = tk.Button(
                parent, text=text, font=("Segoe UI", 8, "bold"),
                bg=bg, fg=fg, activebackground=bg, activeforeground=fg,
                relief=tk.FLAT, bd=0, padx=2, pady=2,
                width=9 * colspan, height=2,
                cursor="hand2",
                command=command or (lambda: None),
            )
            btn.grid(row=row, column=col, columnspan=colspan, padx=2, pady=2, sticky="nsew")
            return btn

        # Configure grid weights for even sizing
        for c in range(6):
            grid.columnconfigure(c, weight=1, minsize=72)
        for r in range(6):
            grid.rowconfigure(r, weight=1, minsize=42)

        # === ROW 0 ===
        make_btn(grid, "\u2630\nSettings", WHITE, 0, 0, command=self.cmd_settings)
        make_btn(grid, "FN 1", WHITE, 0, 1, command=lambda: self.cmd_fn(1))
        make_btn(grid, "FN 2", WHITE, 0, 2, command=lambda: self.cmd_fn(2))
        make_btn(grid, "TF DW", WHITE, 0, 3, command=self.cmd_tf_down)
        make_btn(grid, "TF UP", WHITE, 0, 4, command=self.cmd_tf_up)

        # === ROW 1 ===
        make_btn(grid, "PARTIAL\nSL", GREEN, 1, 0, command=self.cmd_partial_sl)
        self.fn_btn = make_btn(grid, "FN", WHITE, 1, 1, command=lambda: self.cmd_fn(0))
        make_btn(grid, "INPUT\nRISK", RED, 1, 2, command=self.cmd_input_risk)
        make_btn(grid, "INPUT\nPIPS", YELLOW, 1, 3, command=self.cmd_input_pips)
        make_btn(grid, "SL\nin profit", WHITE, 1, 4, command=self.cmd_sl_in_profit)

        # === ROW 2 ===
        make_btn(grid, "AUTO\nBE", GREEN, 2, 0, command=self.cmd_auto_be)
        make_btn(grid, "OPEN\nCALC", GREEN, 2, 1, command=self.cmd_open_calc)
        make_btn(grid, "OPEN\nTRADE", RED, 2, 2, command=self.cmd_open_trade)
        make_btn(grid, "DOUBLE\nORDER", YELLOW, 2, 3, command=self.cmd_double_order)
        make_btn(grid, "ZOOM\nOUT", WHITE, 2, 4, command=self.cmd_zoom_out)

        # === ROW 3 ===
        make_btn(grid, "PARTIAL\nTP", GREEN, 3, 0, command=self.cmd_partial_tp)
        make_btn(grid, "SL\n@entry", YELLOW, 3, 1, command=self.cmd_sl_at_entry)
        make_btn(grid, "TARGET\n@default", YELLOW, 3, 2, command=self.cmd_target_default)
        make_btn(grid, "TARGET\n@1:x", YELLOW, 3, 3, command=self.cmd_target_custom)
        make_btn(grid, "ZOOM\nIN", WHITE, 3, 4, command=self.cmd_zoom_in)

        # === ROW 4 ===
        make_btn(grid, "SELECT", WHITE, 4, 0, command=self.cmd_select)
        make_btn(grid, "CLOSE\nFULL", RED, 4, 1, command=self.cmd_close_full)
        make_btn(grid, "CLOSE\nHALF", RED, 4, 2, command=self.cmd_close_half)
        make_btn(grid, "CLOSE\nCUSTOM", RED, 4, 3, command=self.cmd_close_custom)
        # empty cell at (4, 4) — leave blank

        # === ROW 5 ===
        make_btn(grid, "SWITCH", WHITE, 5, 0, command=self.cmd_switch)
        make_btn(grid, "MARKET\nPENDING", YELLOW, 5, 1, colspan=2, command=self.cmd_toggle_mode)
        make_btn(grid, "SHOW\nSTATS", GREEN, 5, 3, command=self.cmd_show_stats)
        make_btn(grid, "ENTER", WHITE, 5, 4, command=self.cmd_enter)

        # Bottom info bar
        info = tk.Frame(self.root, bg="#111111", height=18)
        info.pack(fill=tk.X)
        info.pack_propagate(False)

        self.info_label = tk.Label(
            info, text="", font=("Segoe UI", 7), bg="#111111", fg="#555555"
        )
        self.info_label.pack(side=tk.LEFT, padx=6)

    def _show_msg(self, text, duration=3000):
        """Show a message in the info bar that auto-clears."""
        self.info_label.config(text=text)
        self.root.after(duration, lambda: self.info_label.config(text=""))

    def _get_selected_position(self):
        """Return the currently selected open position, or None."""
        positions = get_positions()
        if not positions:
            self._show_msg("No open positions")
            return None
        if self.selected_pos_idx < 0 or self.selected_pos_idx >= len(positions):
            self.selected_pos_idx = 0
        return positions[self.selected_pos_idx]

    def _get_symbol(self):
        """Return symbol to trade — from selected position or focused chart."""
        pos = None
        positions = get_positions()
        if positions and 0 <= self.selected_pos_idx < len(positions):
            return positions[self.selected_pos_idx].symbol
        return get_focused_symbol()

    def _update_direction_display(self):
        color = "#4caf50" if self.direction == "BUY" else "#f44336"
        self.dir_label.config(text=self.direction, fg=color)

    def _update_mode_display(self):
        self.mode_ind.config(text=self.mode)

    # ------ Button Commands ------

    def cmd_settings(self):
        """Open settings dialog."""
        win = tk.Toplevel(self.root)
        win.title("Magic Keys Settings")
        win.geometry("320x400")
        win.configure(bg="#1a1a1a")
        win.wm_attributes("-topmost", True)
        win.resizable(False, False)

        fields = {}

        def add_field(label, key, row):
            tk.Label(win, text=label, font=("Segoe UI", 9),
                     bg="#1a1a1a", fg="#cccccc").grid(row=row, column=0, sticky="w", padx=10, pady=4)
            var = tk.StringVar(value=str(self.cfg[key]))
            entry = tk.Entry(win, textvariable=var, font=("Segoe UI", 9),
                             bg="#2a2a2a", fg="#ffffff", insertbackground="#ffffff",
                             relief=tk.FLAT, width=12)
            entry.grid(row=row, column=1, padx=10, pady=4)
            fields[key] = var

        tk.Label(win, text="Settings", font=("Segoe UI", 12, "bold"),
                 bg="#1a1a1a", fg="#ffc107").grid(row=0, column=0, columnspan=2, pady=10)

        add_field("Risk %", "risk_percent", 1)
        add_field("Risk $ (fixed, 0=off)", "risk_fixed", 2)
        add_field("SL Pips (default)", "sl_pips", 3)
        add_field("Default R:R", "default_rr", 4)
        add_field("Partial TP %", "partial_tp_percent", 5)
        add_field("Partial SL Lock Pips", "partial_sl_lock_pips", 6)
        add_field("SL in Profit Pips", "sl_in_profit_pips", 7)
        add_field("Opacity (0.5-1.0)", "opacity", 8)
        add_field("Close Custom %", "close_custom_percent", 9)

        def save():
            for key, var in fields.items():
                try:
                    self.cfg[key] = float(var.get())
                except ValueError:
                    pass
            save_config(self.cfg)
            try:
                self.root.wm_attributes("-alpha", self.cfg["opacity"])
            except Exception:
                pass
            self._show_msg("Settings saved")
            win.destroy()

        tk.Button(win, text="Save", font=("Segoe UI", 10, "bold"),
                  bg="#ffc107", fg="#1a1a1a", relief=tk.FLAT, padx=20, pady=6,
                  command=save).grid(row=10, column=0, columnspan=2, pady=16)

    def cmd_fn(self, layer):
        """Toggle FN layer."""
        if self.fn_layer == layer or layer == 0:
            self.fn_layer = 0
            self.fn_btn.config(bg="#e8e8e8", text="FN")
            self._show_msg("FN layer: OFF")
        else:
            self.fn_layer = layer
            self.fn_btn.config(bg="#ffc107", text=f"FN{layer}")
            self._show_msg(f"FN layer: {layer}")

    def cmd_tf_down(self):
        self.current_tf_idx = send_tf_change(-1, self.current_tf_idx)
        self._show_msg(f"Timeframe: {TF_ORDER[self.current_tf_idx]}")

    def cmd_tf_up(self):
        self.current_tf_idx = send_tf_change(1, self.current_tf_idx)
        self._show_msg(f"Timeframe: {TF_ORDER[self.current_tf_idx]}")

    def cmd_input_risk(self):
        """Popup to set risk amount."""
        win = tk.Toplevel(self.root)
        win.title("Input Risk")
        win.geometry("260x180")
        win.configure(bg="#1a1a1a")
        win.wm_attributes("-topmost", True)
        win.resizable(False, False)

        tk.Label(win, text="Set Risk", font=("Segoe UI", 11, "bold"),
                 bg="#1a1a1a", fg="#f44336").pack(pady=(10, 5))

        frame = tk.Frame(win, bg="#1a1a1a")
        frame.pack(pady=5)

        tk.Label(frame, text="% of balance:", font=("Segoe UI", 9),
                 bg="#1a1a1a", fg="#cccccc").grid(row=0, column=0, padx=5, pady=3)
        pct_var = tk.StringVar(value=str(self.cfg["risk_percent"]))
        tk.Entry(frame, textvariable=pct_var, width=8, font=("Segoe UI", 9),
                 bg="#2a2a2a", fg="#ffffff", insertbackground="#ffffff",
                 relief=tk.FLAT).grid(row=0, column=1, padx=5, pady=3)

        tk.Label(frame, text="Fixed $ (0=off):", font=("Segoe UI", 9),
                 bg="#1a1a1a", fg="#cccccc").grid(row=1, column=0, padx=5, pady=3)
        fixed_var = tk.StringVar(value=str(self.cfg["risk_fixed"]))
        tk.Entry(frame, textvariable=fixed_var, width=8, font=("Segoe UI", 9),
                 bg="#2a2a2a", fg="#ffffff", insertbackground="#ffffff",
                 relief=tk.FLAT).grid(row=1, column=1, padx=5, pady=3)

        def apply():
            try:
                self.cfg["risk_percent"] = float(pct_var.get())
                self.cfg["risk_fixed"] = float(fixed_var.get())
                save_config(self.cfg)
                self._show_msg(f"Risk: {self.cfg['risk_percent']}% / ${self.cfg['risk_fixed']}")
            except ValueError:
                self._show_msg("Invalid input")
            win.destroy()

        tk.Button(win, text="Apply", font=("Segoe UI", 10, "bold"),
                  bg="#f44336", fg="#ffffff", relief=tk.FLAT, padx=20, pady=4,
                  command=apply).pack(pady=10)

    def cmd_input_pips(self):
        """Popup to set SL distance in pips."""
        win = tk.Toplevel(self.root)
        win.title("Input Pips")
        win.geometry("220x140")
        win.configure(bg="#1a1a1a")
        win.wm_attributes("-topmost", True)
        win.resizable(False, False)

        tk.Label(win, text="SL Distance (pips)", font=("Segoe UI", 11, "bold"),
                 bg="#1a1a1a", fg="#ffc107").pack(pady=(10, 5))

        var = tk.StringVar(value=str(self.cfg["sl_pips"]))
        tk.Entry(win, textvariable=var, width=10, font=("Segoe UI", 10),
                 bg="#2a2a2a", fg="#ffffff", insertbackground="#ffffff",
                 relief=tk.FLAT, justify=tk.CENTER).pack(pady=5)

        def apply():
            try:
                self.cfg["sl_pips"] = float(var.get())
                save_config(self.cfg)
                self._show_msg(f"SL: {self.cfg['sl_pips']} pips")
            except ValueError:
                self._show_msg("Invalid input")
            win.destroy()

        tk.Button(win, text="Apply", font=("Segoe UI", 10, "bold"),
                  bg="#ffc107", fg="#1a1a1a", relief=tk.FLAT, padx=20, pady=4,
                  command=apply).pack(pady=8)

    def cmd_partial_sl(self):
        """Move SL to lock in partial profit."""
        pos = self._get_selected_position()
        if pos is None:
            return

        info = get_symbol_info(pos.symbol)
        one_pip = pip_value(info)
        lock_pips = self.cfg["partial_sl_lock_pips"]

        if pos.type == 0:  # BUY
            new_sl = pos.price_open + lock_pips * one_pip
        else:  # SELL
            new_sl = pos.price_open - lock_pips * one_pip

        result = modify_sl_tp(pos, new_sl=new_sl)
        self._show_msg(result)

    def cmd_sl_in_profit(self):
        """Move SL to lock in X pips of profit."""
        pos = self._get_selected_position()
        if pos is None:
            return

        info = get_symbol_info(pos.symbol)
        one_pip = pip_value(info)
        lock_pips = self.cfg["sl_in_profit_pips"]

        if pos.type == 0:  # BUY
            new_sl = pos.price_open + lock_pips * one_pip
        else:  # SELL
            new_sl = pos.price_open - lock_pips * one_pip

        result = modify_sl_tp(pos, new_sl=new_sl)
        self._show_msg(result)

    def cmd_auto_be(self):
        """Move SL to breakeven (entry price)."""
        pos = self._get_selected_position()
        if pos is None:
            return
        result = modify_sl_tp(pos, new_sl=pos.price_open)
        self._show_msg(result)

    def cmd_sl_at_entry(self):
        """Set SL exactly at entry price."""
        pos = self._get_selected_position()
        if pos is None:
            return
        result = modify_sl_tp(pos, new_sl=pos.price_open)
        self._show_msg(result)

    def cmd_open_calc(self):
        """Show lot size calculator."""
        symbol = self._get_symbol()
        acc = get_account()
        if acc is None:
            self._show_msg("Cannot read account")
            return

        balance = acc["balance"]
        risk_pct = self.cfg["risk_percent"]
        risk_fixed = self.cfg["risk_fixed"]
        sl_pips = self.cfg["sl_pips"]
        lots = calculate_lots(balance, risk_pct, risk_fixed, sl_pips, symbol)
        risk_amt = risk_fixed if risk_fixed > 0 else balance * (risk_pct / 100.0)

        info = get_symbol_info(symbol)
        tick = get_tick(symbol)
        spread = info.spread if info else 0

        win = tk.Toplevel(self.root)
        win.title("Lot Calculator")
        win.geometry("280x260")
        win.configure(bg="#1a1a1a")
        win.wm_attributes("-topmost", True)
        win.resizable(False, False)

        tk.Label(win, text="Lot Size Calculator", font=("Segoe UI", 12, "bold"),
                 bg="#1a1a1a", fg="#4caf50").pack(pady=(10, 8))

        lines = [
            f"Symbol:   {symbol}",
            f"Balance:  ${balance:.2f}",
            f"Risk:     ${risk_amt:.2f} ({risk_pct}%)",
            f"SL:       {sl_pips} pips",
            f"Spread:   {spread} points",
            f"",
            f"LOT SIZE: {lots:.2f}",
        ]

        for line in lines:
            fg = "#4caf50" if "LOT SIZE" in line else "#cccccc"
            font = ("Segoe UI", 11, "bold") if "LOT SIZE" in line else ("Segoe UI", 9)
            tk.Label(win, text=line, font=font, bg="#1a1a1a", fg=fg,
                     anchor="w").pack(padx=16, pady=1, fill=tk.X)

        tk.Button(win, text="Close", font=("Segoe UI", 9),
                  bg="#333333", fg="#cccccc", relief=tk.FLAT, padx=16, pady=3,
                  command=win.destroy).pack(pady=10)

    def cmd_open_trade(self):
        """Show SL/TP lines on chart. Press ENTER to confirm the trade."""
        # If lines already active, cancel them
        if self.lines_active:
            self._cancel_lines()
            return

        # Send show_lines command to EA
        cmd = {
            "action": "show_lines",
            "direction": self.direction,
            "risk_percent": self.cfg["risk_percent"],
            "risk_fixed": self.cfg["risk_fixed"],
            "sl_pips": self.cfg["sl_pips"],
            "rr": self.cfg["default_rr"],
        }
        if write_ea_command(cmd):
            self.lines_active = True
            self._show_msg("Lines on chart — drag SL/TP, press ENTER to execute")
            self._start_ea_polling()
        else:
            self._show_msg("EA bridge not available — is MagicKeysBridge on chart?")

    def _cancel_lines(self):
        """Cancel the line preview and clean up."""
        write_ea_command({"action": "clear_lines"})
        self.lines_active = False
        self._stop_ea_polling()
        self._show_msg("Cancelled")

    def _start_ea_polling(self):
        """Start polling EA response file to update info bar."""
        self._stop_ea_polling()

        def poll():
            if not self.lines_active:
                return
            resp = read_ea_response()
            if resp and resp.get("active"):
                lots = resp.get("lots", 0)
                sl_pips = resp.get("sl_pips", 0)
                tp_pips = resp.get("tp_pips", 0)
                rr = resp.get("rr_ratio", 0)
                risk = resp.get("risk_amount", 0)
                self.info_label.config(
                    text=f"Lots: {lots:.2f} | SL: {sl_pips:.1f} pips | TP: {tp_pips:.1f} pips | R:R 1:{rr:.1f} | Risk: ${risk:.0f}"
                )
            self._poll_id = self.root.after(500, poll)

        self._poll_id = self.root.after(500, poll)

    def _stop_ea_polling(self):
        """Stop polling EA response."""
        if self._poll_id is not None:
            self.root.after_cancel(self._poll_id)
            self._poll_id = None

    def cmd_double_order(self):
        """Repeat the last order."""
        if self.last_order is None:
            self._show_msg("No previous order to double")
            return
        o = self.last_order
        result = place_market_order(o["symbol"], o["direction"], o["lots"],
                                    o["sl_pips"], o["tp_pips"])
        self._show_msg(f"DOUBLE: {result}")

    def cmd_zoom_out(self):
        send_zoom(-1)
        self._show_msg("Zoom out")

    def cmd_zoom_in(self):
        send_zoom(1)
        self._show_msg("Zoom in")

    def cmd_partial_tp(self):
        """Close partial TP (configurable %)."""
        pos = self._get_selected_position()
        if pos is None:
            return
        fraction = self.cfg["partial_tp_percent"] / 100.0
        result = close_position(pos, fraction)
        self._show_msg(result)

    def cmd_target_default(self):
        """Set TP at default R:R from entry."""
        pos = self._get_selected_position()
        if pos is None:
            return

        info = get_symbol_info(pos.symbol)
        one_pip = pip_value(info)
        rr = self.cfg["default_rr"]

        # Calculate SL distance
        sl_dist = abs(pos.price_open - pos.sl) if pos.sl > 0 else self.cfg["sl_pips"] * one_pip
        tp_dist = sl_dist * rr

        if pos.type == 0:  # BUY
            new_tp = pos.price_open + tp_dist
        else:  # SELL
            new_tp = pos.price_open - tp_dist

        result = modify_sl_tp(pos, new_tp=new_tp)
        self._show_msg(result)

    def cmd_target_custom(self):
        """Set TP at custom R:R."""
        pos = self._get_selected_position()
        if pos is None:
            return

        rr_str = simpledialog.askstring(
            "Target R:R", "Enter R:R ratio (e.g. 3 for 1:3):",
            parent=self.root
        )
        if rr_str is None:
            return
        try:
            rr = float(rr_str)
        except ValueError:
            self._show_msg("Invalid R:R")
            return

        info = get_symbol_info(pos.symbol)
        one_pip = pip_value(info)
        sl_dist = abs(pos.price_open - pos.sl) if pos.sl > 0 else self.cfg["sl_pips"] * one_pip
        tp_dist = sl_dist * rr

        if pos.type == 0:
            new_tp = pos.price_open + tp_dist
        else:
            new_tp = pos.price_open - tp_dist

        result = modify_sl_tp(pos, new_tp=new_tp)
        self._show_msg(result)

    def cmd_select(self):
        """Cycle through open positions."""
        positions = get_positions()
        if not positions:
            self._show_msg("No open positions")
            return
        self.selected_pos_idx = (self.selected_pos_idx + 1) % len(positions)
        pos = positions[self.selected_pos_idx]
        dir_str = "BUY" if pos.type == 0 else "SELL"
        self._show_msg(f"Selected: #{pos.ticket} {dir_str} {pos.volume} {pos.symbol} P/L: {pos.profit:.2f}")

    def cmd_close_full(self):
        """Close 100% of selected position."""
        pos = self._get_selected_position()
        if pos is None:
            return
        result = close_position(pos, 1.0)
        self._show_msg(result)

    def cmd_close_half(self):
        """Close 50% of selected position."""
        pos = self._get_selected_position()
        if pos is None:
            return
        result = close_position(pos, 0.5)
        self._show_msg(result)

    def cmd_close_custom(self):
        """Close custom % of selected position."""
        pos = self._get_selected_position()
        if pos is None:
            return

        pct_str = simpledialog.askstring(
            "Close Custom", f"Close what % of position #{pos.ticket}?\n(e.g. 25, 50, 75)",
            parent=self.root,
            initialvalue=str(int(self.cfg["close_custom_percent"]))
        )
        if pct_str is None:
            return
        try:
            pct = float(pct_str)
        except ValueError:
            self._show_msg("Invalid percentage")
            return

        result = close_position(pos, pct / 100.0)
        self._show_msg(result)

    def cmd_switch(self):
        """Toggle BUY/SELL direction."""
        self.direction = "SELL" if self.direction == "BUY" else "BUY"
        self._update_direction_display()
        self._show_msg(f"Direction: {self.direction}")

    def cmd_toggle_mode(self):
        """Toggle MARKET/PENDING mode."""
        self.mode = "PENDING" if self.mode == "MARKET" else "MARKET"
        self._update_mode_display()
        self._show_msg(f"Mode: {self.mode}")

    def cmd_show_stats(self):
        """Show account stats popup."""
        acc = get_account()
        positions = get_positions()

        win = tk.Toplevel(self.root)
        win.title("Account Stats")
        win.geometry("300x340")
        win.configure(bg="#1a1a1a")
        win.wm_attributes("-topmost", True)
        win.resizable(False, False)

        tk.Label(win, text="Account Statistics", font=("Segoe UI", 12, "bold"),
                 bg="#1a1a1a", fg="#4caf50").pack(pady=(10, 8))

        if acc:
            lines = [
                f"Account:  {acc['name']}",
                f"Server:   {acc['server']}",
                f"Balance:  ${acc['balance']:.2f}",
                f"Equity:   ${acc['equity']:.2f}",
                f"P/L:      ${acc['profit']:.2f}",
                f"Margin:   ${acc['margin']:.2f}",
                f"Free:     ${acc['margin_free']:.2f}",
                f"Leverage: 1:{acc['leverage']}",
                f"",
                f"Open Positions: {len(positions)}",
            ]
        else:
            lines = ["MT5 not connected"]

        for line in lines:
            fg = "#f44336" if "P/L" in line and acc and acc["profit"] < 0 else \
                 "#4caf50" if "P/L" in line and acc and acc["profit"] > 0 else "#cccccc"
            tk.Label(win, text=line, font=("Segoe UI", 9), bg="#1a1a1a", fg=fg,
                     anchor="w").pack(padx=16, pady=1, fill=tk.X)

        if positions:
            tk.Label(win, text="", bg="#1a1a1a").pack()
            for pos in positions[:5]:
                dir_str = "BUY" if pos.type == 0 else "SELL"
                clr = "#4caf50" if pos.profit >= 0 else "#f44336"
                text = f"  #{pos.ticket} {dir_str} {pos.volume} {pos.symbol}  ${pos.profit:.2f}"
                tk.Label(win, text=text, font=("Segoe UI", 8), bg="#1a1a1a", fg=clr,
                         anchor="w").pack(padx=8, fill=tk.X)

        tk.Button(win, text="Close", font=("Segoe UI", 9),
                  bg="#333333", fg="#cccccc", relief=tk.FLAT, padx=16, pady=3,
                  command=win.destroy).pack(pady=10)

    def cmd_enter(self):
        """Confirm and execute the trade using current SL/TP lines from chart."""
        if not self.lines_active:
            self._show_msg("Press OPEN TRADE first to show lines")
            return

        # Read final values from EA
        resp = read_ea_response()
        if resp is None or not resp.get("active"):
            self._show_msg("No line data from EA — is MagicKeysBridge on chart?")
            return

        symbol = resp.get("symbol", self._get_symbol())
        direction = resp.get("direction", self.direction)
        lots = resp.get("lots", 0.01)
        sl_price = resp.get("sl_price", 0)
        tp_price = resp.get("tp_price", 0)
        entry_price = resp.get("entry_price", 0)

        if lots <= 0 or sl_price <= 0:
            self._show_msg("Invalid trade parameters from EA")
            return

        # Execute the trade
        if self.mode == "MARKET":
            result = self._place_market_with_prices(symbol, direction, lots, sl_price, tp_price)
        else:
            result = self._place_pending_with_prices(symbol, direction, lots, sl_price, tp_price, entry_price)

        # Save for DOUBLE ORDER
        sl_pips = resp.get("sl_pips", 0)
        tp_pips = resp.get("tp_pips", 0)
        self.last_order = {
            "symbol": symbol, "direction": direction, "lots": lots,
            "sl_pips": sl_pips, "tp_pips": tp_pips,
        }

        # Clear lines
        write_ea_command({"action": "clear_lines"})
        self.lines_active = False
        self._stop_ea_polling()
        self._show_msg(result)

    def _place_market_with_prices(self, symbol, direction, lots, sl_price, tp_price):
        """Place market order using exact SL/TP prices from chart lines."""
        if not ensure_mt5():
            return "MT5 not connected"

        info = get_symbol_info(symbol)
        tick = get_tick(symbol)
        if info is None or tick is None:
            return f"Cannot get info for {symbol}"

        digits = info.digits
        price = tick.ask if direction == "BUY" else tick.bid
        price = round(price, digits)
        sl = round(sl_price, digits)
        tp = round(tp_price, digits)
        order_type = mt5.ORDER_TYPE_BUY if direction == "BUY" else mt5.ORDER_TYPE_SELL

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": lots,
            "type": order_type,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": 20,
            "magic": 123456,
            "comment": "MagicKeys",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result is None:
            return f"Order failed: {mt5.last_error()}"
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return f"Order failed: {result.comment} (code {result.retcode})"
        return f"OK: {direction} {lots} {symbol} @ {price} SL={sl} TP={tp}"

    def _place_pending_with_prices(self, symbol, direction, lots, sl_price, tp_price, entry_price):
        """Place pending order using exact prices from chart lines."""
        if not ensure_mt5():
            return "MT5 not connected"

        info = get_symbol_info(symbol)
        tick = get_tick(symbol)
        if info is None or tick is None:
            return f"Cannot get info for {symbol}"

        digits = info.digits
        entry = round(entry_price, digits)
        sl = round(sl_price, digits)
        tp = round(tp_price, digits)

        if direction == "BUY":
            order_type = mt5.ORDER_TYPE_BUY_LIMIT if entry < tick.ask else mt5.ORDER_TYPE_BUY_STOP
        else:
            order_type = mt5.ORDER_TYPE_SELL_LIMIT if entry > tick.bid else mt5.ORDER_TYPE_SELL_STOP

        request = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": symbol,
            "volume": lots,
            "type": order_type,
            "price": entry,
            "sl": sl,
            "tp": tp,
            "deviation": 20,
            "magic": 123456,
            "comment": "MagicKeys",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result is None:
            return f"Pending failed: {mt5.last_error()}"
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return f"Pending failed: {result.comment} (code {result.retcode})"
        return f"OK: Pending {direction} {lots} {symbol} @ {entry}"

    def run(self):
        self.root.mainloop()


# ============================================================================
#  ENTRY POINT
# ============================================================================

def main():
    print("=" * 50)
    print("  Magic Keys On-Screen")
    print("=" * 50)
    print()

    app = MagicKeysApp()
    print("[OK] Magic Keys overlay started")
    print("     Drag the title bar to move")
    print("     Click X to close")
    print()
    app.run()

    # Cleanup
    try:
        mt5.shutdown()
    except Exception:
        pass
    print("Magic Keys closed.")


if __name__ == "__main__":
    main()
