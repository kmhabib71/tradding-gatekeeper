# GATEKEEPER - Project Status

## What It Is
AI-powered trading gatekeeper that stands between your emotions and the market. No AI approval = no trade.

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- MongoDB Atlas (Mongoose)
- OpenAI GPT-4.1 Vision (primary) / Claude Sonnet 4.5 (toggle in settings)
- Python MT5 Bridge (screenshot + live data capture)

## Project Structure
```
gatekeeper/
├── src/app/
│   ├── page.tsx              # Dashboard (stats, open trades, weekly/monthly P&L)
│   ├── login/page.tsx        # Password login
│   ├── analyze/page.tsx      # Main flow: upload → AI → verdict → checklist → journal
│   ├── journal/page.tsx      # Browse trades, close open trades, view skipped trades
│   ├── settings/page.tsx     # Account, risk %, API keys, AI provider switch
│   └── api/
│       ├── analyze/route.ts  # Sends screenshot + context to AI
│       ├── mt5/route.ts      # Receives data from Python bridge
│       ├── trades/route.ts   # CRUD trades
│       ├── stats/route.ts    # Performance stats
│       └── settings/route.ts # User settings
├── src/lib/
│   ├── ai/
│   │   ├── prompts.ts        # THE AI STRATEGY PROMPT (see below)
│   │   ├── openai.ts         # OpenAI Vision API call
│   │   └── claude.ts         # Claude Vision API call
│   ├── models/               # MongoDB schemas (Trade, Settings, DailyLog)
│   ├── mongodb.ts            # DB connection
│   └── auth.ts               # JWT auth
└── mt5-bridge/
    ├── bridge.py             # Python script: F9=capture, F10=refresh
    └── start-bridge.bat      # One-click launcher
```

## Core Flow
1. Upload ONE MetaTrader screenshot (all 4 TFs: H4, H1, M15, M5)
2. AI analyzes chart + evaluates trader's state from history
3. Verdict: setup grade, entry plan, emotional assessment
4. If valid → pre-trade checklist → journal → save as open trade
5. If skip/blocked → option to journal the skip decision

---

## AI PROMPT LOGIC (the strategy brain)

### What Gets Sent to the AI
The API (`/api/analyze`) builds a system prompt with two parts:

**1. The Screenshot** — Single image, all 4 timeframes visible

**2. Dynamic Context** — Injected from database at request time:
- Current account balance + risk percentage
- Trades taken today vs max allowed
- Losses today vs max allowed
- Last 10 trade outcomes (win/loss/breakeven pattern)
- Current drawdown % from peak

### The Strategy Rules Encoded in the Prompt

```
THE TRADER'S STRATEGY (the ONLY valid setup):
- Enter ONLY when smaller timeframe (1H/15M) trend EXHAUSTS against bigger
  timeframe (4H) trend direction
- On the reversal candle's RETURN, enter at confluence of:
  FVG (Fair Value Gap) + 20 EMA touch + Support/Resistance level
- Minimum Risk:Reward ratio is 1:2
- Only trade during London open or NY open kill zones
```

### What the AI Checks Per Timeframe

| Timeframe | AI Task |
|-----------|---------|
| **H4** | Determine dominant trend (BULLISH/BEARISH/RANGING) |
| **H1** | Check for exhaustion pattern AGAINST the H4 trend |
| **M15** | Look for FVG + 20 EMA touch + S/R confluence zone |
| **M5** | Assess entry timing (READY/WAIT/MISSED/NO_SETUP) |

### Trader Assessment Logic (AI evaluates YOU, not just the chart)

The AI receives your trading history and applies these rules:
- **Losses today >= max daily losses** → BLOCKED (can't trade)
- **Trades today >= max trades/day** → BLOCKED
- **Setup doesn't match strategy** → Grade C, verdict SKIP
- **Drawdown > 4%** → Elevated emotional risk warning
- AI also flags: revenge trading patterns, overtrading tendencies, temptation zones

### AI Response Structure

```json
{
  "h4Bias": "BEARISH",
  "h4Analysis": "...",
  "h1Exhaustion": false,
  "h1Analysis": "...",
  "m15Confluence": { "fvg": false, "ema20": false, "sr": false, "description": "..." },
  "m5Timing": "NO_SETUP",
  "m5Analysis": "...",
  "setupGrade": "C",              // A+ = all criteria met, B = partial, C = skip
  "confidence": 74,                // 0-100
  "traderAssessment": {
    "shouldTrade": false,
    "emotionalRisk": "LOW",        // LOW/MEDIUM/HIGH
    "concerns": ["..."],
    "recommendation": "..."        // Detailed human-readable advice
  },
  "entryPlan": {
    "direction": "SELL",
    "entryZone": "1.0835-1.0840",
    "stopLoss": "1.0868",
    "takeProfit": "1.0780",
    "slPips": 33,
    "rrRatio": "1:2.1",
    "lotSize": 0.30,               // Auto-calculated from balance + risk %
    "riskAmount": "$100"
  },
  "keyLevels": [...],
  "notes": [...],
  "overallVerdict": "SKIP"         // ENTER / WAIT / SKIP / BLOCKED
}
```

### Key Prompt Instruction
> "Be STRICT. This trader's weakness is taking trades that don't match their setup. Protect them from themselves."

---

## How to Refine the Strategy

To change what the AI looks for, edit **`src/lib/ai/prompts.ts`**:

- **Add new entry criteria**: Add rules under "THE TRADER'S STRATEGY" section
- **Change timeframe logic**: Modify what each TF should check for
- **Add indicators**: Tell AI to look for additional confluence (e.g., RSI divergence, volume)
- **Adjust risk rules**: Change the BLOCKED/SKIP conditions
- **Change grading**: Modify what qualifies as A+/B/C
- **Add news awareness**: Include instructions about economic calendar

The prompt is the single source of truth for your strategy. Everything else is UI.

## Accounts
- FTMO Demo: $10,000 balance, 1% risk = $100/trade
- Pairs: EURUSD, GBPUSD, USDJPY, AUDUSD
- Default password: gatekeeper123
