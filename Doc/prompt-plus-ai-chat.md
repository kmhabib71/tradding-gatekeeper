prompts.ts "export function buildAnalysisPrompt(context: {
pair: string;
accountBalance: number;
riskPercentage: number;
tradesToday: number;
lossesToday: number;
maxTradesPerDay: number;
maxDailyLosses: number;
recentOutcomes: string[];
currentDrawdownPct: number;
}): string {
return `You are an expert forex trader specializing in Smart Money Concepts (SMC) / ICT methodology, acting as a TRADING GATEKEEPER. You are analyzing a MetaTrader screenshot that shows 4 timeframes in a single split-screen view (4H top-left, 1H top-right, 15M bottom-left, 5M bottom-right) for ${context.pair}.

THE TRADER'S STRATEGY — SMC EXHAUSTION-REVERSAL MODEL:
This is the ONLY valid setup. Every step must be confirmed:

STEP 1 — H4 STRUCTURE & BIAS:

- Identify the higher timeframe (H4) trend direction: BULLISH (HH/HL = Higher Highs, Higher Lows) or BEARISH (LH/LL = Lower Highs, Lower Lows) or RANGING (between swing high and swing low)
- Mark the key swing high (HH or LH) and swing low (HL or LL) on H4
- Identify if price is near a H4 premium zone (for sells) or discount zone (for buys)
- Look for CHANNEL or WEDGE structures: ascending/descending channels (parallel trendlines connecting HH-HH and HL-HL, or LH-LH and LL-LL), rising wedges (converging upward trendlines), or falling wedges (converging downward trendlines). These edges define where liquidity pools form — smart money sweeps beyond channel/wedge boundaries before reversing.
- If a channel/wedge is visible, note whether price is at the upper edge (potential sell zone), lower edge (potential buy zone), or has broken out of the structure

STEP 2 — H1 LIQUIDITY SWEEP + EXHAUSTION:

- Look for price EXHAUSTING against the H4 trend on H1 (smaller TF pushing against bigger TF direction)
- Specifically look for a LIQUIDITY SWEEP: price takes out a previous swing high (for bearish setups) or swing low (for bullish setups), wicking beyond the level then reversing. This includes sweeps beyond channel/wedge boundaries — price breaking above an ascending channel top or below a descending channel bottom, then immediately reversing back inside (a "deviation" or "false breakout")
- After the sweep, look for a BREAK OF STRUCTURE (BoS): price breaks a recent swing point in the opposite direction, confirming the reversal
- The sweep + BoS sequence = confirmed exhaustion
- DEVIATION pattern: if price was ranging within a channel, a deviation below the range low (for buys) or above the range high (for sells) followed by a reclaim back inside the range is a high-probability SMC signal

STEP 3 — M15 ENTRY ZONE (CONFLUENCE):
After BoS is confirmed, identify the entry zone on M15 where multiple of these overlap:

- FVG (Fair Value Gap): an imbalance / 3-candle pattern with a gap between candle 1's wick and candle 3's wick
- Order Block (OB): the last opposing candle before the impulsive move that caused the BoS. There are TWO types:
  - External OB: at the swing extreme (the very high or low of the move)
  - Internal OB: formed within the impulsive move itself, not at the extreme — often a more precise entry point with tighter SL
- Breaker Block: a failed order block — an OB that was broken through by price, which now acts as support (for buys) or resistance (for sells) on the opposite side. When price retests a breaker from the other side, it's a high-conviction entry zone.
- 20 EMA: price touching or near the 20 EMA on M15
- Support/Resistance: a historical S/R level or previous structure point at the same zone

The more factors that align at the SAME price zone = higher grade setup. Internal OB + FVG at the same level is particularly strong.

STEP 4 — M5 ENTRY TIMING:

- Wait for price to RETRACE back into the M15 confluence zone
- On M5, look for: rejection candle, engulfing pattern, or displacement (strong candle) off the zone
- Entry is on the M5 confirmation candle within the zone
- If price has already left the zone = MISSED
- If price hasn't reached the zone yet = WAIT

KILL ZONES (valid trading times only):

- London Open: 07:00-10:00 GMT (02:00-05:00 EST)
- New York Open: 12:00-15:00 GMT (07:00-10:00 EST)
- London Close: 15:00-17:00 GMT (10:00-12:00 EST)
- Outside these windows = lower confidence, consider WAIT

RISK MANAGEMENT:

- Minimum Risk:Reward ratio is 1:2 (ideally 1:3+)
- Stop Loss: beyond the liquidity sweep high/low (the wick that swept liquidity), or below the internal OB if using a tighter entry
- Take Profit: target the next EXTERNAL LIQUIDITY — this means the next untouched swing high (for buys) or swing low (for sells) where resting stop-losses/orders sit. External liquidity = obvious highs/lows that haven't been swept yet. At minimum 2x the SL distance.

CURRENT ACCOUNT CONTEXT:

- Account Balance: $${context.accountBalance}
- Risk Per Trade: ${context.riskPercentage}% ($${(context.accountBalance \* context.riskPercentage / 100).toFixed(2)})
- Trades taken today: ${context.tradesToday} / ${context.maxTradesPerDay} max
- Losses today: ${context.lossesToday} / ${context.maxDailyLosses} max
- Recent trade outcomes: ${context.recentOutcomes.length > 0 ? context.recentOutcomes.join(", ") : "No recent trades"}
- Current drawdown from peak: ${context.currentDrawdownPct.toFixed(1)}%

YOUR TASKS:

1. Analyze all 4 timeframes visible in the screenshot using SMC methodology
2. Check each step of the strategy sequence: H4 bias → H1 sweep + BoS → M15 confluence zone → M5 timing
3. Evaluate whether the trader SHOULD be trading right now (based on their history, losses today, emotional risk from trading patterns)
4. If setup is valid, provide exact entry plan with calculated lot size

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
"h4Bias": "BULLISH" or "BEARISH" or "RANGING",
"h4Analysis": "Description of H4 structure: HH/HL or LH/LL sequence, trend direction, channels/wedges if present, premium/discount zone",
"h1Exhaustion": true or false,
"h1Analysis": "Description of H1 exhaustion pattern",
"h1LiqSweep": {
"detected": true or false,
"level": "price level that was swept",
"description": "Which swing high/low or channel/wedge boundary was swept, how price reacted (include deviation/false breakout if applicable)"
},
"h1BoS": {
"detected": true or false,
"level": "price level where structure broke",
"description": "Which swing point broke, confirming the reversal direction"
},
"m15Confluence": {
"fvg": true or false,
"orderBlock": true or false,
"orderBlockType": "external" or "internal" or "breaker" or "none",
"ema20": true or false,
"sr": true or false,
"zone": "price range of the confluence zone (e.g. 1.0850-1.0865)",
"description": "Description of what factors align and where. Specify if OB is external, internal, or a breaker block."
},
"m5Timing": "READY" or "WAIT" or "MISSED" or "NO_SETUP",
"m5Analysis": "M5 timing assessment — is price at the zone? rejection candle forming?",
"setupGrade": "A+" or "A" or "B" or "C",
"confidence": 0-100,
"smcSequence": {
"h4Trend": true or false,
"liqSweep": true or false,
"bos": true or false,
"entryZone": true or false,
"timing": true or false,
"summary": "Brief summary of which steps are confirmed and which are missing"
},
"traderAssessment": {
"shouldTrade": true or false,
"emotionalRisk": "LOW" or "MEDIUM" or "HIGH",
"concerns": ["list of concerns about the trader's current state"],
"recommendation": "Detailed recommendation about whether to trade and why"
},
"entryPlan": {
"direction": "BUY" or "SELL",
"entryZone": "price range",
"stopLoss": "price — beyond the liquidity sweep wick or below/above the internal OB",
"takeProfit": "price — next external liquidity (untouched swing high/low) or 2x+ SL distance",
"slPips": number,
"rrRatio": "1:X.X",
"lotSize": calculated lot size for the risk parameters,
"riskAmount": "$XX"
},
"keyLevels": [
{"type": "Swing High/Swing Low/FVG/Order Block/Internal OB/Breaker/EMA/Liquidity/External Liquidity/BoS/Channel Top/Channel Bottom/Wedge", "level": "price", "note": "description"}
],
"notes": ["List of key observations from the chart analysis using SMC terminology"],
"overallVerdict": "ENTER" or "WAIT" or "SKIP" or "BLOCKED"
}

GRADING CRITERIA:

- A+ = ALL 5 steps confirmed (H4 trend + liq sweep + BoS + confluence zone with 3+ factors + M5 timing ready). Confidence 85-100.
- A = 4 of 5 steps confirmed, or all 5 but confluence zone has only 2 factors. Confidence 70-84.
- B = 3 of 5 steps confirmed. Missing liq sweep OR BoS but other factors strong. Confidence 50-69. Verdict: WAIT.
- C = 2 or fewer steps confirmed. No valid setup. Confidence below 50. Verdict: SKIP.

IMPORTANT RULES:

- If losses today >= ${context.maxDailyLosses}, set overallVerdict to "BLOCKED" and shouldTrade to false
- If trades today >= ${context.maxTradesPerDay}, set overallVerdict to "BLOCKED" and shouldTrade to false
- If the setup doesn't match the SMC sequence, setupGrade must be "C" and overallVerdict "SKIP"
- If drawdown > 4%, increase emotional risk assessment
- A grade setups can get ENTER verdict. B grade = WAIT (setup developing but not ready). C grade = always SKIP.
- Be STRICT. This trader's weakness is taking trades that don't match their setup. Protect them from themselves.
- Do NOT fabricate levels or patterns. If you cannot clearly see a pattern in the screenshot, say so.
- Calculate lot size based on: riskAmount / (slPips \* pipValue). For most USD pairs, pip value per standard lot is $10.`;
  }
  "

chat with ai:

will this overwhelm ai or ai will work fine or I can add other also like rsi, MACD, bollinder band also? answer in short
The current prompt is fine — won't overwhelm the AI. GPT-4.1/5.2 with vision handles long structured prompts well, especially when the instructions are clear steps (not vague).

But I'd say stop here on SMC concepts. You've covered the full sequence: sweep → BoS → OB/FVG/Breaker → entry. That's the core model.

Don't add RSI, MACD, Bollinger Bands. Here's why:

They're lagging indicators — SMC is about price action and liquidity, not indicators. Adding them contradicts the methodology.
The AI is reading a screenshot — it can barely read indicator values from tiny chart overlays. It'll guess wrong and give false confidence.
The 20 EMA is already there — that's the only indicator you need as dynamic S/R.
More criteria = more reasons to skip — the AI will find conflicts and SKIP even valid setups.
The one thing worth adding later (if you want) is volume profile / session highs/lows — but only if your MT5 template visibly shows them. For now, your prompt covers a complete SMC system. Test it with real charts first and refine based on results.

Do you believe in liquidity swip theory, since most of the time I see the trend goes to 3 HH and LL structure, the last higher high or HH is what called liquidity swip in smc or ict method, what you say? answer in shrot
Yes, it's real but often mislabeled.

What you're describing is exactly right — markets tend to make 3-push patterns (1-2-3 structure). The 3rd push (the last HH or LL) is where:

Retail traders see a "confirmed trend" and pile in with stops just beyond the previous swing
Institutions see a liquidity pool of those resting stop-losses and push price to trigger them
Price sweeps past the level, fills institutional orders, then reverses
So the "liquidity sweep" isn't some mysterious concept — it's simply the 3rd push exhaustion move that hunts stops beyond obvious levels before reversing. It happens because someone needs to fill large orders, and clustered stop-losses are the easiest counterparty.

Where people get it wrong: they see every wick as a "sweep." A real sweep has intent — it's followed by displacement (strong momentum candle in the opposite direction) and BoS. Without that, it's just price discovery, not a sweep.

Your prompt already handles this correctly — it requires sweep + BoS + confluence, not just a wick above a level. That's the right filter.

is there can be someone can push the market to sweep the stoploss line since market is huge, how any one or two org can bend a market in its wish, what if it doesn't go in their org way, tell me the secret, not just hoax or some story, tell me real story institutional trader and others, what happen retail vs big party or there any middle party also taking in consider eurusd and audusd
Real talk — no stories, no conspiracy.

Who actually moves EURUSD and AUDUSD
EURUSD daily volume: ~$850 billion. No single entity "controls" it. But here's what actually happens:

The real players (by size):
Tier Who Daily volume What they do
1 Central Banks (Fed, ECB, RBA) Unlimited Set interest rates, intervene in extremes. They don't trade for profit — they manage currency stability
2 Major banks (JPMorgan, Citi, Deutsche, UBS, Barclays) ~50-60% of all FX volume Market makers — they provide liquidity. They see ORDER FLOW (everyone else's buy/sell orders)
3 Hedge funds / CTAs ~15% Trend followers, macro bets. They move in size but aren't "hunting" you
4 Corporates (Apple, Toyota, etc.) ~10% Convert currencies for business. They don't care about charts
5 Retail (you, me) ~5-7% Too small to matter individually
The "stop hunt" truth:
Nobody is hunting YOUR stop specifically. Here's what actually happens:

Market makers (Tier 2 banks) can see aggregate order flow. Not your individual $100 trade, but they see "there's $2B worth of stops clustered at 1.0850."

They don't "push" price to those stops. What they do is: when a large client order comes in (say a hedge fund wants to SELL $500M EURUSD), the bank knows this sell will push price down. If there are buy-stops sitting at 1.0850, price naturally hits them as part of filling the order. The bank just sequences the execution to maximize their own fill quality.

The "sweep" is a side effect of large order execution, not a deliberate hunt. The bank needs counterparty liquidity. Your stop-loss becoming a market order = free liquidity for them to fill their client.

What really happens at your stop-loss level:

Scenario: EURUSD at 1.0870, tons of retail is long with SL at 1.0850

1. Big client gives JPMorgan a $500M SELL order
2. JPMorgan can't dump $500M at once (price would collapse)
3. They know 1.0850 has $2B in buy-stops (free counterparty liquidity)
4. They start selling gradually, price drops to 1.0850
5. Stops trigger → millions of buy orders flood in
6. JPMorgan fills their client's SELL against those buy orders
7. Once the selling is done, there's no more sell pressure
8. Price bounces back up → the "sweep" you see on the chart
   It's not manipulation. It's order execution mechanics.

Why does it look like "they" are hunting stops?
Because everyone puts stops in the same place — just beyond obvious swing highs/lows. That's why SMC works: it teaches you to anticipate WHERE liquidity clusters, and enter AFTER the sweep, not before.

AUDUSD vs EURUSD difference:
EURUSD: So liquid that no single player can dominate. Sweeps are smoother, wicks are smaller. Harder to manipulate.
AUDUSD: ~$200B daily (4x less liquid). The RBA (Reserve Bank of Australia) + Chinese economic data + commodity flows have outsized impact. Sweeps can be sharper and more violent because less liquidity = price moves faster.
Is there a "middle party"?
Yes — prop firms / algo funds. They sit between institutions and retail. They:

Run algorithms that detect stop clusters (same as your SMC concepts)
Trade the bounce after the sweep
They're essentially doing what your Gatekeeper app does, but automated
The actual secret:
There is no secret. The market is an auction. Price goes where the orders are. Stops cluster at obvious levels. Large orders need counterparty liquidity. The sweep happens because that's the most efficient way to fill large orders.

Your SMC strategy works not because of some conspiracy — it works because you're entering after the inefficient stop-hunting execution is done, riding the natural reversion. That's a real edge.

The one thing to actually worry about: news events. During NFP, rate decisions, CPI — the rules change. Central banks and algo funds react to data, not chart patterns. That's why your prompt has kill zones and your app should eventually factor in economic calendar events.

wait, so when liquidity sweep by 500M vs 2B it should still ride as bull but why it goes opposite bear with bigger bearish red drop candlestic? answer in short, how to detect that price is about to reverse or it will continue despite liquidity sweep ?
The $500M sell is just the trigger. The $2B in stops are BUY orders (stop-losses closing shorts or stop-loss sells becoming market buys). Here's the key:

Why price drops after the sweep

Before sweep: Price at 1.0870, stops at 1.0850

1. $500M SELL pushes price DOWN to 1.0850
2. Stops trigger = $2B in BUY orders fire
3. But the $500M seller ABSORBS those buys as their counterparty
4. Other big sellers pile in too (they were waiting for this level)
5. Total sell pressure > the $2B in stop-buys
6. Price drops hard = the big red candle you see
   The stops aren't "buyers supporting the market." They're exit orders being eaten by larger sellers.

How to detect real reversal vs continuation after a sweep
It reverses (your setup):

Sweep wick is sharp and fast (one candle, long wick, closes back inside)
Displacement follows — strong momentum candle in opposite direction
BoS confirms within 2-5 candles
Volume/momentum dies in the sweep direction
It continues (trap — stay out):

Sweep closes beyond the level (not just a wick, a full body close)
No immediate rejection — price consolidates beyond the level
No BoS within 5+ candles
Multiple candles holding beyond the swept level = it's not a sweep, it's a breakout
The simple rule:
Wick beyond + close back inside = sweep (trade the reversal)
Body close beyond + holds = breakout (don't fight it)

Your prompt already handles this — the AI checks for sweep + BoS confirmation. If BoS doesn't happen, the sequence fails and it grades C/SKIP. That's the filter preventing you from entering fake sweeps.

which time frame give the better look of sweep and reversal like you said bos confirms within 5 candles ? How trame work with institual transaction, does institutional buy sell occour in seconds or minutes/hours? and why its said old method are not work well like support resistant or channel or wadges, now ict or smc might work but after few years it will be told that the mothod doesn't work anymore, who decide that or change that?
Timeframes for sweep + reversal
H1 is your sweet spot. Here's why:

Timeframe Sweep visibility BoS speed Best for
H4 Too slow — sweep takes days to form BoS takes 1-2 weeks Bias only, not entry
H1 Clear sweeps, 1-3 candle wicks BoS within 3-8 hours (3-8 candles) Your strategy — sweep + BoS confirmation
M15 Fast but noisy — many fake sweeps BoS within 1-2 hours Entry refinement after H1 confirms
M5 Too noisy — every wick looks like a sweep Constant BoS in both directions Timing only, never for sweep detection
Your prompt is correctly structured: H1 for sweep + BoS, M15 for entry zone, M5 for timing.

How fast do institutions trade?
It depends on the order type:

Algo execution: Milliseconds. But these are small slices of a larger order, not the full position
Full position build: Hours to days. A $500M order gets chopped into thousands of smaller orders spread across a session. This is why sweeps happen over 1-8 H1 candles, not in one tick
Central bank intervention: Minutes. They announce and dump. This is the one scenario where a single entity moves price fast and hard
The key insight: The sweep candle you see on H1 isn't one transaction. It's the final acceleration where the algo pushes through the liquidity level, fills against the stops, and pulls back. That whole process takes 30-90 minutes typically on EURUSD — which is why it shows as 1-2 H1 candles.

Why do methods "stop working"?
They don't stop working. Here's what actually happens:

S/R, channels, wedges — "old" methods:
They still work. Every institution's risk desk still uses support/resistance. The difference:

In the 90s, retail didn't know about them, so they worked cleanly
Now everyone sees the same S/R level → everyone puts stops in the same place → those stops become liquidity → price sweeps through them
S/R didn't "stop working" — it became the liquidity target instead of the bounce point
SMC/ICT — the "new" method:
ICT literally just reframed S/R and supply/demand with new names:

Order Block = the last candle before a strong move (that's just supply/demand zone)
FVG = price imbalance (that's just a gap)
Liquidity sweep = stop hunt (traders knew this in the 80s)
SMC works right now because it teaches you to wait for the sweep FIRST, then enter. Old methods said "buy at support." SMC says "wait for support to break, THEN buy the reclaim."

Will SMC stop working?
The core principle will always work because it's based on market mechanics (large orders need counterparty liquidity). But the specific patterns will adapt:

When too many people wait for the "sweep + BoS + FVG retest," market makers will adjust by sweeping the retest level too (double sweep)
You'll see more time-based manipulation — sweeps at exact kill zone opens to trap SMC traders who enter on the first BoS
The edge will shift to who waits longer and requires more confirmation
Who "decides" a method stops working?
Nobody decides. It's natural selection:

Method works → early adopters profit
Method becomes popular (YouTube, courses) → everyone uses it
Everyone's orders cluster at the same levels → those orders become predictable liquidity
Market makers adapt their execution to exploit that clustering
Method's win rate drops → people say "it stopped working"
New framework emerges that accounts for step 4
The only thing that never changes: large orders need liquidity, and liquidity clusters where crowds place orders. Whatever method teaches you to trade against the crowd after they get trapped will always have an edge. Today that's SMC. Tomorrow it'll have a different name but the same core logic.

Your practical takeaway:
Don't worry about methods "expiring." Your Gatekeeper app's real edge isn't SMC specifically — it's discipline + confirmation requirements. By requiring 5 steps to align before entering, you're automatically filtering out the setups where too many people are positioned the same way. That's the real edge.
