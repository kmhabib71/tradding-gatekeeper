# MT5 Chart Template Setup for GATEKEEPER AI

The AI reads your screenshot to analyze all 4 timeframes. A clean, consistent layout
helps the AI read price action, indicators, and levels accurately.

## Step 1: Set Up the 4-Chart Layout

1. Open MetaTrader 5
2. Go to **Window** menu -> **Tile Vertically** (or press Ctrl+Shift+T for tile)
3. Better: Go to **Window** -> **Tile Horizontally** then arrange as 2x2 grid
4. You should have exactly 4 charts open:
   - Top-Left: **H4** (4-hour)
   - Top-Right: **H1** (1-hour)
   - Bottom-Left: **M15** (15-minute)
   - Bottom-Right: **M5** (5-minute)
5. All 4 charts should show the SAME pair (e.g., EURUSD)

## Step 2: Chart Style Settings (Apply to ALL 4 charts)

Right-click any chart -> Properties (F8):

### Colors Tab
- Use a **dark background** (Black or very dark gray)
- Bull candle: Green body, green border
- Bear candle: Red body, red border
- Grid: Dark gray or off (cleaner for AI)
- This high-contrast scheme helps the AI distinguish candles clearly

### Common Tab
- Check: Show OHLC
- Check: Show period separators
- Check: Show trade levels
- Uncheck: Show grid (cleaner for AI reading)

### Recommended Color Scheme
- Background: Black (#000000)
- Foreground (text): White (#FFFFFF)
- Bull candle: #00FF00 (bright green)
- Bear candle: #FF0000 (bright red)
- Line chart: #FFFFFF
- Volumes: #32CD32

## Step 3: Add Required Indicators

Add these to ALL 4 charts:

### 20 EMA (Critical - your strategy uses this)
1. Insert -> Indicators -> Trend -> Moving Average
2. Period: 20
3. Method: Exponential
4. Color: Yellow (#FFD700) or Cyan (#00FFFF) - bright color so AI can see it
5. Width: 2 (thicker line)

### Optional but Helpful
- **Support/Resistance levels**: Draw horizontal lines at key levels
  - Use bright colors (white, yellow, magenta)
  - The AI can read these if they're visible
- **Previous Day High/Low**: Draw or use an indicator
- **Asian Session Range**: If you mark this, use a rectangle tool

## Step 4: Chart Zoom & Candle Count

For the AI to read effectively:
- Each chart should show approximately **50-100 candles**
- Don't zoom in too much (AI needs context) or too far out (candles become unreadable)
- H4: ~80 candles gives about 2 weeks of context
- H1: ~80 candles gives about 3-4 days
- M15: ~80 candles gives about 1 day
- M5: ~80 candles gives about 6-7 hours

## Step 5: Save as Template

1. Set up ONE chart perfectly with all the settings above
2. Right-click the chart -> **Templates** -> **Save Template**
3. Name it: `gatekeeper`
4. For the other 3 charts: Right-click -> Templates -> Load Template -> `gatekeeper`
5. Then change each chart to the correct timeframe

## Step 6: Save the Profile

1. After all 4 charts are set up in the 2x2 grid
2. Go to **File** -> **Profiles** -> **Save As**
3. Name it: `GATEKEEPER`
4. Now you can quickly load this layout anytime: File -> Profiles -> GATEKEEPER

## What the AI Looks For

The AI analyzes your screenshot for:
- **H4 (top-left)**: Overall trend direction, higher timeframe bias
- **H1 (top-right)**: Trend exhaustion patterns against H4 bias
- **M15 (bottom-left)**: FVG zones, 20 EMA touches, S/R confluence
- **M5 (bottom-right)**: Entry timing, candle patterns at the entry zone

## Tips for Best AI Reading

1. **Maximize MT5 to full screen** before pressing F9 (screenshot captures full screen)
2. **Remove unnecessary panels**: Hide Market Watch, Navigator, Toolbox if possible
   to give charts more screen space
3. **Keep chart clean**: Don't add too many indicators - the AI reads price action
   and 20 EMA, extra clutter confuses it
4. **Use the same layout every time**: Consistency helps the AI know where to look
5. **Make sure the timeframe label is visible** on each chart (MT5 shows this by default
   in the top-left corner of each chart window)
