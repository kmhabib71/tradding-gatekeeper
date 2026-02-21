# Magic Keys On-Screen — Button Guide

## How It Works

**SWITCH** sets your direction (BUY or SELL) — shown in the status bar.
**OPEN TRADE** draws SL (red) / TP (green) / Entry (blue) lines on the chart.
**Drag the SL line** — lot size auto-recalculates to maintain your risk %.
**ENTER** confirms and places the trade with the exact SL/TP/lots shown.

Requires **MagicKeysBridge.mq5** EA running on the chart (auto-copied on first launch).

---

## Flow to Place a Trade

1. **INPUT RISK** → set your risk % or fixed $
2. **INPUT PIPS** → set default SL distance in pips
3. **SWITCH** → toggle BUY or SELL (shown top-right)
4. **MARKET/PENDING** → choose order type (shown top-right)
5. **OPEN TRADE** → draws SL/TP/Entry lines on chart + shows info labels
6. **Drag the red SL line** on the chart → lots recalculate, TP moves to maintain R:R
7. **Drag the green TP line** to adjust take profit / R:R
8. **ENTER** → executes the trade with the final line positions
9. Press **OPEN TRADE** again to cancel (removes lines)

## First-Time Setup

1. Launch `python magic_keys.py` — it auto-copies `MagicKeysBridge.mq5` to MT5's Experts folder
2. In MT5: Navigator → Expert Advisors → right-click → Refresh
3. Drag **MagicKeysBridge** onto the chart you trade on
4. Enable **Algo Trading** in MT5 toolbar (green button)

---

## Every Button — What It Does

### Row 1: Top Bar

| Button | Action |
|--------|--------|
| **Settings (≡)** | Opens settings panel — risk %, default R:R, opacity, partial %, SL lock pips |
| **FN 1** | Activates function layer 1 (modifier key — currently no alternate functions mapped) |
| **FN 2** | Activates function layer 2 (modifier key — currently no alternate functions mapped) |
| **TF DW** | Sends timeframe DOWN hotkey to MT5 chart (e.g. H4 → H1 → M15) |
| **TF UP** | Sends timeframe UP hotkey to MT5 chart (e.g. M15 → H1 → H4) |

### Row 2: Risk & SL Setup

| Button | Action |
|--------|--------|
| **PARTIAL SL** | Moves SL to lock in partial profit (entry + X pips, configurable in settings) |
| **FN** | Toggle FN layer on/off (status shown on button) |
| **INPUT RISK** | Popup: set risk as % of balance OR fixed $ amount |
| **INPUT PIPS** | Popup: set SL distance in pips (used for lot calculation) |
| **SL in profit** | Moves SL to lock in X pips of profit above/below entry (configurable in settings) |

### Row 3: Trade Execution

| Button | Action |
|--------|--------|
| **AUTO BE** | Moves SL to breakeven (entry price) for selected position |
| **OPEN CALC** | Shows lot size calculator popup — displays calculated lots based on current risk/SL/symbol |
| **OPEN TRADE** | **SHOWS SL/TP LINES ON CHART** — red SL line, green TP line, blue entry line. Drag SL to adjust lot size. Press ENTER to execute. Press OPEN TRADE again to cancel. |
| **DOUBLE ORDER** | Repeats the exact same order as the last OPEN TRADE (same symbol, direction, lots, SL, TP) |
| **ZOOM OUT** | Sends zoom out command to MT5 chart |

### Row 4: Targets & TP

| Button | Action |
|--------|--------|
| **PARTIAL TP** | Closes a portion of selected position (default 50%, configurable in settings) |
| **SL @entry** | Sets SL exactly at entry price (same as AUTO BE) |
| **TARGET @default** | Sets TP on selected position at default R:R ratio (e.g. 1:2, configurable) |
| **TARGET @1:x** | Popup: enter custom R:R ratio, sets TP accordingly on selected position |
| **ZOOM IN** | Sends zoom in command to MT5 chart |

### Row 5: Close Operations

| Button | Action |
|--------|--------|
| **SELECT** | Cycles through open positions — each press selects the next one (shown in info bar) |
| **CLOSE FULL** | Closes 100% of the selected position |
| **CLOSE HALF** | Closes 50% of the selected position |
| **CLOSE CUSTOM** | Popup: enter % to close (e.g. 25, 75) of selected position |

### Row 6: Bottom Bar

| Button | Action |
|--------|--------|
| **SWITCH** | Toggles direction between BUY and SELL (shown in status bar, green/red) |
| **MARKET/PENDING** | Toggles order mode — MARKET (instant) or PENDING (asks for entry price) |
| **SHOW STATS** | Popup: account balance, equity, P/L, margin, open positions list |
| **ENTER** | **CONFIRMS THE TRADE** — reads final SL/TP/lots from chart lines and places the order. Only works after OPEN TRADE draws lines. |

---

## Status Bar (top of keypad)

| Indicator | Meaning |
|-----------|---------|
| Left text | MT5 connection status + account name + balance |
| Right yellow | Current mode: MARKET or PENDING |
| Right green/red | Current direction: BUY or SELL |

---

## Settings (persisted to magic_keys_config.json)

| Setting | Default | Purpose |
|---------|---------|---------|
| Risk % | 1.0 | % of balance to risk per trade |
| Risk $ fixed | 0 | If > 0, uses fixed $ instead of % |
| SL Pips | 30 | Default stop loss distance |
| Default R:R | 2.0 | Used by TARGET @default |
| Partial TP % | 50 | How much PARTIAL TP closes |
| Partial SL Lock Pips | 10 | How many pips above entry PARTIAL SL locks |
| SL in Profit Pips | 5 | How many pips of profit SL in profit locks |
| Close Custom % | 50 | Default value shown in CLOSE CUSTOM popup |
| Opacity | 0.92 | Window transparency |
