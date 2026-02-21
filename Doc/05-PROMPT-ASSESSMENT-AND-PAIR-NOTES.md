# Part 5: Your Gatekeeper Prompt — What Works, What to Improve, and Pair-Specific Notes

> Your prompt is solid. Let's assess what it does well, what to add, and practical tips for the pairs you trade.

---

## Prompt Assessment: Does It Actually Work?

### What Your Prompt Does RIGHT:

**1. The 5-step sequence is correct.**
H4 bias → H1 sweep + BoS → M15 confluence → M5 timing mirrors real institutional flow. This is the core of SMC and it's properly structured.

**2. The grading system is protective.**
Requiring A/A+ for ENTER and forcing B grades to WAIT prevents impulsive entries. Most retail losses come from B and C grade trades.

**3. Trader assessment is brilliant.**
Checking trades today, losses today, drawdown, and emotional risk BEFORE allowing a trade — this is what separates your app from every other SMC tool. The psychology guard is more valuable than the chart analysis.

**4. Lot size calculation is built in.**
Removing the "how much should I risk?" decision from the moment eliminates one of the biggest emotional traps.

**5. The JSON format forces structure.**
The AI can't give vague answers. It must commit to specific levels, grades, and verdicts. This creates accountability.

### What Your Prompt Needs to Improve:

**1. Add Kill Zone Time Check**
Your prompt mentions kill zones but doesn't enforce them. Add this to the account context:

```
- Current GMT time: ${currentTimeGMT}
- In Kill Zone: ${isKillZone} (London 07:00-10:00, NY 12:00-15:00, London Close 15:00-17:00)
```

Add this rule:
```
- If NOT in a Kill Zone, reduce confidence by 20 points and add "Outside Kill Zone" to concerns
- If more than 30 minutes from a Kill Zone boundary, consider WAIT verdict
```

**2. Add News Filter**
High-impact news events destroy SMC setups. Add:

```
- Upcoming high-impact news: ${upcomingNews} (within next 2 hours)
- If red-flag news within 30 minutes: set overallVerdict to "BLOCKED"
- If red-flag news within 2 hours: add to concerns, reduce confidence by 10
```

You'd need to integrate an economic calendar API (ForexFactory, Investing.com, or MQL5 calendar).

**3. Add Session Context**
Tell the AI which session is active:

```
- Current session: ${session} (Asian/London/NY/Off-hours)
- Session high: ${sessionHigh}
- Session low: ${sessionLow}
- Previous day high: ${pdh}
- Previous day low: ${pdl}
```

The AI can then check if price swept the session high/low or PDH/PDL — these are the highest-probability sweep levels.

**4. Add Spread Check**
During low-liquidity times, spreads widen and can eat your profit:

```
- Current spread: ${currentSpread} pips
- If spread > 3 pips on EURUSD or > 4 pips on AUDUSD: add "Wide spread" warning
```

**5. Strengthen the "Don't Fabricate" Rule**
AI vision models sometimes "see" patterns that aren't there on small chart areas. Your prompt says "Do NOT fabricate" but add:

```
- If any element is unclear or ambiguous in the screenshot, rate it as NOT CONFIRMED
- Better to miss a trade than to enter on a hallucinated pattern
- If you're not at least 70% sure you can see a pattern, mark it as false
```

**6. Add Multi-Timeframe Alignment Score**
Sometimes H4 says bullish but H1 shows bearish momentum. Add:

```
- If H4 and H1 disagree on direction: maximum grade is B, verdict WAIT
- All timeframes must agree for A+ grade
```

---

## What the AI CAN and CANNOT Do

### CAN Do Well:
- Identify trend direction (HH/HL or LH/LL) on H4 — this is pattern recognition, AI excels here
- Spot obvious swing highs/lows — clear visual patterns
- Detect large candles (displacement) — size comparison is easy for vision
- Identify general zones (premium/discount) — math-based, reliable
- Calculate lot sizes and R:R — pure math, will be accurate every time
- Enforce trading rules — rule-based logic, 100% reliable

### CANNOT Do Well:
- Read exact price values from a small chart — the screenshot resolution may not show precise numbers
- Identify the 20 EMA line if the chart is cluttered — needs a clean template
- Distinguish between a true FVG and a near-FVG — subtle differences may be missed
- Read indicator values (RSI numbers, MACD levels) — too small on screen, this is why you don't add them
- Detect candle patterns on M5 in a 4-panel screenshot — the M5 panel may be too small

### How to Maximize AI Accuracy:
1. Use a CLEAN MT5 template: candles + 20 EMA only, dark background, high contrast
2. Make sure each of the 4 panels has enough candles visible (at least 30-50 candles per panel)
3. Include price scale on the right axis (so the AI can read approximate levels)
4. Use large enough screenshot resolution (at least 1920x1080)
5. Consider taking SEPARATE screenshots of each timeframe if the 4-panel view is too small

---

## Pair-Specific Notes: EURUSD vs AUDUSD

### EURUSD — The "Cleanest" Pair

**Characteristics:**
- Daily volume: ~$850 billion (most liquid pair in the world)
- Spreads: 0.5-1.5 pips typically (tight)
- Behavior: Smoother moves, smaller wicks, more textbook SMC patterns
- Driven by: Fed/ECB policy divergence, US economic data, European political events

**Best Kill Zone for EURUSD:**
London-NY overlap (12:00-15:00 GMT) — this is when both major liquidity centers are active. EURUSD moves most during this window.

**EURUSD-Specific Tips:**
- Sweeps are CLEANER on EURUSD. Wicks are proportional, reversals are smoother. If you see a messy, chaotic sweep on EURUSD, it's probably not a real sweep — it's news-driven volatility.
- Monday moves often set the weekly direction. If London sweeps a level on Monday, the rest of the week often trends in the post-sweep direction.
- 1.XX00 levels (1.0800, 1.0900, 1.1000) are MAJOR liquidity pools. Price almost always reacts at these levels.
- EURUSD respects the Asian range sweep setup very well. London almost always sweeps one side of the Asian range.

**Typical EURUSD Daily Pattern:**
```
Asian (00:00-07:00 GMT): Tight range, 20-30 pip box
London Open (07:00): Sweeps one side of Asian range
London Session (07:30-12:00): Establishes the daily trend
NY Open (12:00): Either continues London or reverses
NY Session (12:30-15:00): Main move of the day
London Close (15:00-17:00): Pullback or consolidation
```

### AUDUSD — The "Volatile" Pair

**Characteristics:**
- Daily volume: ~$200 billion (4x less liquid than EURUSD)
- Spreads: 1.0-3.0 pips typically (wider)
- Behavior: Sharper moves, longer wicks, more violent sweeps, more false breakouts
- Driven by: RBA policy, Chinese economic data (China is Australia's biggest trade partner), commodity prices (iron ore, coal), risk sentiment (AUDUSD rises when markets are "risk-on" and falls when "risk-off")

**Best Kill Zone for AUDUSD:**
Asian session (00:00-03:00 GMT) for RBA/Chinese data reactions, then London-NY overlap (12:00-15:00 GMT) for the main move.

**AUDUSD-Specific Tips:**
- Sweeps on AUDUSD are MORE VIOLENT. Wicks can be 2-3x larger than EURUSD. This means your SL needs to be slightly wider (beyond the sweep wick + extra buffer).
- Chinese data at 01:30-02:00 GMT can create massive spikes. If you're trading AUDUSD, check the Chinese economic calendar too.
- AUDUSD is highly correlated with risk sentiment. If the S&P 500 is crashing, AUDUSD will drop regardless of what the chart says. Check US equity markets before taking AUDUSD trades.
- 0.XX00 and 0.XX50 levels are key (0.6500, 0.6550, 0.6600). AUDUSD trades in tighter ranges than EURUSD, so these 50-pip levels matter more.
- AUDUSD is more prone to FALSE sweeps because of lower liquidity. Require stronger BoS confirmation before entering (wait for 2+ candles closing beyond the BoS level, not just 1).

**AUDUSD Additional Risk Rule:**
```
For AUDUSD specifically:
- Add 5 extra pips to your SL (to account for wider wicks)
- Reduce lot size accordingly (wider SL = smaller position)
- During Asian session: only trade if RBA/Chinese news is clear
- Avoid AUDUSD during US equity market crashes (pure risk-off flows, no SMC patterns)
```

---

## The Things Nobody Tells You (Real-World Edge)

### 1. Monday and Friday Are Different

**Monday**: Institutions are repositioning after the weekend. The first London sweep on Monday often sets the tone for the ENTIRE WEEK. This is the most important sweep of the week.

**Friday**: Institutions square positions before the weekend. Afternoon moves often reverse. Don't open new trades after 15:00 GMT on Friday — you'll get stopped out by weekend position squaring.

**Best days**: Tuesday, Wednesday, Thursday. Trends are cleaner, sweeps are more reliable, volume is consistent.

### 2. The First 30 Minutes Are Traps

When London opens at 07:00 GMT and NY opens at 12:00 GMT, the first 30 minutes are WILD. Algos are testing levels, sweeping both sides, creating chaos.

**Rule**: Don't enter in the first 30 minutes of a session. Wait for the sweep to happen, then wait for BoS, then enter. The 30-minute patience filter eliminates most fakeouts.

### 3. News Events Reset Everything

During NFP, FOMC, CPI, and ECB rate decisions:
- SMC patterns don't apply
- Wicks can be 100+ pips
- Stop losses get blown through (slippage)
- The AI's analysis becomes irrelevant

**Rule**: Close all trades 30 minutes before a red-flag event, or don't trade that session at all. The best trade during news is NO trade.

### 4. Correlation Awareness

If you trade multiple pairs simultaneously:

```
EURUSD and GBPUSD: ~80-90% correlated
→ If you're SELL EURUSD and SELL GBPUSD = you have 2x the risk
→ Only trade one of them, or use half position size on each

EURUSD and USDCHF: ~90% inversely correlated  
→ BUY EURUSD ≈ SELL USDCHF (same trade in different clothes)
→ Never hold both

AUDUSD and NZDUSD: ~85% correlated
→ Same as EURUSD/GBPUSD — pick one
```

**Rule**: Maximum 2 correlated trades open at any time. If you're already in EURUSD, don't also enter GBPUSD.

### 5. The "Tuesday Reversal"

ICT talks about this and it's statistically real: the week often sets up on Monday-Tuesday with a sweep of the weekly range, then trends Wednesday-Thursday-Friday.

```
Monday: Range forming or continuation of previous week
Tuesday: SWEEP of Monday's range → weekly direction established
Wednesday: Main trending day of the week
Thursday: Continuation or target reached
Friday: Reversal / position squaring
```

**Your action**: Be extra alert for sweep setups on Tuesday morning (London session). Tuesday London sweeps that align with H4 bias are some of the highest-probability trades of the week.

---

## Pre-Session Checklist (Do This Every Day Before Trading)

```
╔══════════════════════════════════════════════════════════╗
║                  PRE-SESSION CHECKLIST                    ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  MARKET CONTEXT:                                         ║
║  □ What is H4 bias? (HH/HL = Buy, LH/LL = Sell)        ║
║  □ Where is the nearest liquidity target?                ║
║  □ Is price in premium or discount zone?                 ║
║  □ Mark PDH, PDL, Asian range H/L                       ║
║  □ Are there equal highs/lows nearby?                   ║
║                                                          ║
║  NEWS CHECK:                                             ║
║  □ Any red-flag news today? What time?                  ║
║  □ Central bank speakers scheduled?                     ║
║  □ Is it NFP/FOMC/CPI week?                            ║
║                                                          ║
║  KILL ZONE:                                              ║
║  □ Am I trading during London, NY, or London Close?     ║
║  □ If not, am I within 30 minutes of a session open?    ║
║                                                          ║
║  PERSONAL STATE:                                         ║
║  □ Am I calm and clear-headed?                          ║
║  □ Am I NOT trying to make back losses?                 ║
║  □ Am I NOT overconfident from recent wins?             ║
║  □ How many trades have I taken today? (max 3)          ║
║  □ How many losses today? (max 2)                       ║
║  □ Current drawdown from peak? (check the threshold)    ║
║                                                          ║
║  IF ALL CLEAR → Open charts, run Gatekeeper             ║
║  IF ANY RED FLAG → Don't trade today                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

## Final Summary: The Edge That Actually Works

The market will never change these fundamentals:
1. Large orders need counterparty liquidity to fill
2. Liquidity clusters where the crowd places their stops
3. Price moves to those clusters, fills the orders, then reverses
4. This cycle repeats during every session, every day, on every pair

Your edge is not a secret indicator or a magic pattern. Your edge is:

**Patience** — waiting for the full sequence to complete before entering
**Discipline** — following the rules even when your emotions scream otherwise
**Risk management** — risking 1% per trade, every trade, no exceptions
**Consistency** — doing the same thing every day for months until the math works

Your Gatekeeper app automates the ANALYSIS and RULES. But YOU are the one who has to OBEY the verdict. That's the part no app can do for you.

The traders who win consistently aren't the ones who find the best setups. They're the ones who SKIP the most bad setups.

**Be the trader who skips.**

---

## Quick Reference Card

```
ENTER: A/A+ grade, all 5 steps confirmed, in kill zone, no news, 
       emotionally stable, < 3 trades today, < 2 losses today
       
WAIT:  B grade, setup developing, or price not at zone yet

SKIP:  C grade, missing steps, poor confluence, outside kill zone

BLOCKED: Max trades/losses reached, high-impact news imminent, 
         drawdown threshold exceeded
```
