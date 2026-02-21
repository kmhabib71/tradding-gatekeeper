# Part 2: The Complete SMC Setup Sequence — Visual Guide

> Every trade you take must follow this exact sequence. No exceptions. If any step is missing, the verdict is WAIT or SKIP.

---

## The Sequence (Memorize This)

```
H4 BIAS → H1 SWEEP + BoS → M15 ZONE → M5 TRIGGER
   ↓            ↓                ↓           ↓
 "Where?"    "Has it swept?"  "Where to    "When to
              "Has it            enter?"      pull
               confirmed?"                  trigger?"
```

Each step MUST confirm before moving to the next. This is not optional.

---

## STEP 1: H4 Bias — "Which Side Am I On?"

### What You're Looking For:
The H4 chart tells you the DIRECTION. You only trade WITH the H4 trend, never against it.

### Bullish Bias (Look for BUYS only):
```
                                    HH (Higher High)
                                   /\
                                  /  \
                                 /    \
                        HH      /      \
                       /\      /        
                      /  \    /         
                     /    \  / ← HL (Higher Low)
             HH    /      \/   
            /\    /            
           /  \  / ← HL       
          /    \/              
  HH     /                    
 /\     /                     
/  \   / ← HL                
    \ /                       
     HL                       

Pattern: HH → HL → HH → HL → HH → HL
Each High is HIGHER than the previous High
Each Low is HIGHER than the previous Low
= BULLISH. Only look for BUY setups.
```

### Bearish Bias (Look for SELLS only):
```
 LH                       
  \                       
   \   /\ ← LH            
    \ /  \                 
     \/   \                
     LL    \   /\ ← LH    
            \ /  \         
             \/   \        
             LL    \   /\ ← LH
                    \ /  \
                     \/   \
                     LL    \
                            \  /\ ← LH
                             \/  \
                             LL   \
                                   \
                                    LL (Lower Low)

Pattern: LH → LL → LH → LL → LH → LL
Each High is LOWER than the previous High
Each Low is LOWER than the previous Low
= BEARISH. Only look for SELL setups.
```

### Ranging (No Bias — Wait or Be Careful):
```
     ___________Resistance/Range High___________
    |                                           |
    |     /\          /\         /\             |
    |    /  \        /  \       /  \            |
    |   /    \      /    \     /    \           |
    |  /      \    /      \   /      \          |
    | /        \  /        \ /        \         |
    |/          \/          \/         \        |
    |___________Support/Range Low_______\______|
    
Price bouncing between the same high and low.
No clear HH/HL or LH/LL pattern.
= RANGING. Trade edges of the range or wait for breakout.
```

### Channel/Wedge Detection:
```
ASCENDING CHANNEL (Bullish bias, sell at top edge):
                                          /
                            /\           / ← Upper edge
                           /  \         /
                     /\   /    \       /
                    /  \ /      \     /
              /\   /    /        \   /
             /  \ /    /          \ /
        /\  /    /    /            / ← Lower edge
       /  \/    /    /            /
      /        /    /            
     /        /    
    /        / 

DESCENDING WEDGE (Converging — reversal likely):
    \
     \         /\
      \       /  \
       \     /    \
        \   /      \
         \ /   /\   \
          /   /  \   \
         /   /    \   \
        /   /      \   \
       /   /        \   
      /___/          \___  ← Lines converge = energy building
                           
When price BREAKS OUT of a wedge = high momentum move.
When price reaches the EDGE of a channel = potential reversal zone.
```

### Premium vs Discount Zones:
```
                  PREMIUM ZONE (expensive — look for SELLS)
                  ==========================================
    Swing High → |‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾|
                  |          Upper 50%                      |
                  |                                        |
     50% line →  |========================================|  ← Equilibrium
                  |                                        |
                  |          Lower 50%                     |
    Swing Low →  |________________________________________|
                  ==========================================
                  DISCOUNT ZONE (cheap — look for BUYS)

Rule: Only buy in discount zone, only sell in premium zone.
This keeps your R:R favorable because you're entering near the extreme.
```

### How to Identify H4 Bias — Quick Checklist:
1. Look at the last 3-4 swing points on H4
2. Are highs getting higher AND lows getting higher? → BULLISH
3. Are highs getting lower AND lows getting lower? → BEARISH
4. Neither? → RANGING
5. Is price in the upper half of the range? → PREMIUM (favor sells)
6. Is price in the lower half of the range? → DISCOUNT (favor buys)
7. Is there a visible channel or wedge? → Note the edges (they're liquidity targets)

---

## STEP 2: H1 Liquidity Sweep + Break of Structure

This is the MOST IMPORTANT step. Without a sweep + BoS, there is no trade. Period.

### What Is a Liquidity Sweep?

Price takes out a previous swing high or swing low, triggering the stop-losses clustered beyond it, then reverses.

### Bearish Sweep (Setup for SELL):
```
                    THE SWEEP
                       |
    Previous HH → ─────|─────── Liquidity line (stops above here)
                       /\
                      / |\
                     /  | \  ← Price wicks ABOVE the previous HH
                    /   |  \    (this is the sweep — stops triggered)
                   /    |   \
    H1 candles → /     |    \
                /      |     \
               /       |      \________
              /                         \
             /                           \
            /                             \
                                           \
                                            \  ← Price drops hard
                                             \   (displacement)
                                              \
                                     BoS → ───\────── Previous swing low breaks
                                                \
                                                 \___  ← Continuation down
```

### Bullish Sweep (Setup for BUY):
```
            ___/
           /
          /  ← Price rallies hard (displacement)
         /
        / ← BoS → ─────────── Previous swing high breaks
       /
      /          ______________
     /          /              \
    /          /                \
              /                  \
             /                    \
            /    |                 \
           /     |  ← Price wicks BELOW previous LL
          /      |     (this is the sweep — stops triggered)
         /       |
        /\      /
          \    /
           \  /
    Previous LL → ─────────── Liquidity line (stops below here)
                       |
                    THE SWEEP
```

### The Sweep That DOESN'T Reverse (Breakout — Stay Out):
```
    Previous HH → ─────────────
                       /\
                      /  \
                     /    \
                    /      \_________
                   /                  \__________
                  /                               \________
                 /
    
    Price closes ABOVE the level and STAYS above.
    Next candles also close above.
    This is NOT a sweep — it's a breakout.
    DO NOT SELL THIS.
```

### How to Distinguish Sweep vs Breakout:

| Feature | Sweep (Trade it) | Breakout (Don't fight it) |
|---------|-------------------|---------------------------|
| Candle close | BACK inside the level | BEYOND the level |
| Wick | Long wick beyond, body inside | Small wick, body beyond |
| Next candle | Moves opposite direction | Continues same direction |
| Speed | Fast spike then fast reversal | Steady momentum beyond |
| Time | 1-3 candles max | Multiple candles holding beyond |

### Break of Structure (BoS) — The Confirmation

After the sweep, you MUST see a Break of Structure. Without BoS, the sweep could be a fake signal.

```
BEARISH BoS (after sweeping a high):

    Sweep wick →  /\
                 /  \
                /    \
               /      \
              /        \
             /          \_____
                               \
    Previous swing low → ───────\────── THIS LEVEL MUST BREAK
                                 \
                                  \
                                   \___ ← Once it breaks = BoS confirmed
                                         Direction: SELL

BULLISH BoS (after sweeping a low):

                                   _/‾ ← Once it breaks = BoS confirmed
                                  /
                                 /
    Previous swing high → ──────/────── THIS LEVEL MUST BREAK
                               /
             _________________/
            /
           \          /
            \        /
             \      /
              \    /
               \  /
    Sweep wick → \/
                         Direction: BUY
```

### BoS Timing Rule:
- BoS should happen within 3-8 H1 candles after the sweep
- If no BoS after 8 candles = the sweep failed, no trade
- If BoS takes too long = the energy is gone, reduced probability

### The Deviation Pattern (Range Sweep):

When price is RANGING, a deviation below the range (for buys) or above the range (for sells) followed by a reclaim back inside = highest probability SMC signal.

```
     ___________Range High___________
    |                                |
    |    /\         /\               |
    |   /  \       /  \              |
    |  /    \     /    \             |
    | /      \   /      \            |
    |/        \ /        \           |
    |__________\/_________\__________|← Range Low
                            \    /
                             \  /  ← DEVIATION (price dips below range)
                              \/     (stops below range get hit)
                              
    Then price RECLAIMS back inside the range.
    BoS = price breaks above the most recent swing high inside the range.
    Direction: BUY
    
    This is one of the highest-probability setups in SMC.
```

---

## STEP 3: M15 Confluence Zone — "Where Exactly Do I Enter?"

After BoS confirms on H1, drop to M15 to find the ENTRY ZONE. You're looking for a price area where multiple factors overlap.

### Fair Value Gap (FVG):
```
    An FVG is a 3-candle pattern with an imbalance:

    BULLISH FVG:                    BEARISH FVG:
    
    Candle 3:  ____                 Candle 3:
              |    |                          ____
              |    |                         |    |
              |    |                         |    |
              |____|                         |____|
                        ← GAP →                        ← GAP →
    Candle 2:    |                  Candle 2:    |
                 |  (big move)                   |  (big move)
                 |                               |
                                                 
              ‾‾‾‾                            ____
    Candle 1: |    |                Candle 1: |    |
              |    |                         |    |
              |____|                         |____|
              ‾‾‾‾                            ‾‾‾‾

    The GAP is between:
    - Candle 1's HIGH (bullish) / LOW (bearish)
    - Candle 3's LOW (bullish) / HIGH (bearish)
    
    This gap = "unfilled orders" = price tends to return here.
    When price returns to fill the FVG = your entry zone.
```

### Order Block (OB):
```
    The LAST OPPOSING candle before the impulsive move:

    BEARISH OB (for SELL entry):
    
         ____  ← This is the Order Block
        |RED |    (last RED candle before the big
        |    |     GREEN impulsive move up)
        |____|
           |
           |  (big impulsive move that caused BoS)
           |
           ‾‾‾‾‾
          |GREEN|
          |     |
          |     |
          |     |
          |_____|

    When price RETURNS to the OB zone = SELL entry
    (Smart money sells where they originally bought)

    BULLISH OB (for BUY entry):
    
          _____
         |GREEN|
         |     |
         |     |
         |     |
          ‾‾‾‾‾
           |
           |  (big impulsive move down that caused BoS)
           |
         ____  ← This is the Order Block
        |RED |    (last GREEN candle before the big
        |    |     RED impulsive move down)
        |____|

    When price RETURNS to the OB zone = BUY entry
```

### External OB vs Internal OB vs Breaker Block:
```
    EXTERNAL OB (at the extreme):
    
    Swing High → /\
                /  \
    ════════   /    \  ← EXTERNAL OB is at the very top
    OB ZONE   /      \    (widest stop-loss, lower precision)
    ════════ /        \
            /          \
           /            \
          /              \

    INTERNAL OB (within the move):
    
    Swing High → /\
                /  \
               /    \
              /      \
             /  ════  \  ← INTERNAL OB is mid-move
            /  OB ZONE \    (tighter stop-loss, higher precision)
           /   ════════  \
          /                \
         /                  \

    BREAKER BLOCK (failed OB that flipped):
    
    Original OB was here:
         ____
        | OB |  ← This was supposed to be resistance
        |____|
           |
           | ← Price BROKE THROUGH the OB (it failed)
           |
           ‾‾‾‾
           
    NOW this failed OB becomes a BREAKER:
    When price comes BACK to this level from the other side,
    it acts as SUPPORT instead of resistance.
    
    OB that was resistance → gets broken → becomes support (BREAKER)
    OB that was support → gets broken → becomes resistance (BREAKER)
    
    Breaker + FVG at the same level = one of the strongest entries.
```

### 20 EMA as Dynamic Support/Resistance:
```
    In an UPTREND, 20 EMA acts as dynamic support:
    
         /\      /\      /\
        /  \    /  \    /  \
       /    \  /    \  /    \
      /      \/      \/      \
    ═══════════════════════════ ← 20 EMA (price bounces off it)
    
    Entry: When price pulls back to 20 EMA AND it aligns with OB/FVG zone
    
    In a DOWNTREND, 20 EMA acts as dynamic resistance:
    
    ═══════════════════════════ ← 20 EMA (price rejects off it)
      \      /\      /\      /
       \    /  \    /  \    /
        \  /    \  /    \  /
         \/      \/      \/
```

### Confluence = Multiple Factors at the Same Price Zone:
```
    THE IDEAL ENTRY ZONE (maximum confluence):

    Price level 1.0860: ─── 20 EMA touching here
    Price level 1.0855: ─── Internal OB top
    Price level 1.0850: ─── FVG top
    Price level 1.0845: ─── FVG bottom / Internal OB bottom
    Price level 1.0840: ─── Previous S/R level
    
                        ╔══════════════════╗
    1.0860 ─────────────║  CONFLUENCE ZONE ║── 20 EMA
    1.0855 ─────────────║  (Enter here)    ║── Internal OB
    1.0850 ─────────────║                  ║── FVG
    1.0845 ─────────────║                  ║── S/R
    1.0840 ─────────────╚══════════════════╝
    
    This zone has 4 factors aligned:
    FVG + Internal OB + 20 EMA + S/R = A+ GRADE SETUP
```

### Confluence Grading:
| Factors Aligned | Grade | Action |
|-----------------|-------|--------|
| 4+ (FVG + OB + EMA + S/R) | A+ | ENTER when M5 confirms |
| 3 (any three) | A | ENTER when M5 confirms |
| 2 (any two) | B | WAIT — setup developing |
| 1 or none | C | SKIP — no valid setup |

---

## STEP 4: M5 Entry Timing — "When Do I Pull the Trigger?"

You've identified the zone on M15. Now you wait on M5 for price to reach the zone AND give a confirmation candle.

### M5 Timing Scenarios:

**READY (Enter Now):**
```
    Price is IN the confluence zone AND showing rejection:
    
    Confluence zone → ════════════════════
                      |    ____          |
                      |   |    |         |
                      |   | ↑  | ← Rejection/engulfing candle
                      |   |    |    forming inside the zone
                      |   |____|         |
                      ════════════════════
    
    Confirmation candles:
    - Bullish engulfing (big green swallows previous red)
    - Pin bar / hammer (long wick rejecting the zone)
    - Displacement candle (big candle away from the zone)
```

**WAIT (Not Yet):**
```
    Price is ABOVE the confluence zone, still falling toward it:
    
                         \
                          \
                           \  ← Price approaching but not at zone yet
                            \
    Confluence zone → ════════════════════
                      |                  |
                      |                  |
                      ════════════════════
    
    Wait for price to reach the zone. Don't anticipate.
```

**MISSED (Too Late):**
```
    Price already HIT the zone and LEFT without you:
    
                           /
                          / ← Price already bounced and left
                         /
    Confluence zone → ════════════════════
                      |        /         |
                      |       / ← Touched the zone
                      |      /           |
                      ════════════════════
    
    DO NOT CHASE. Wait for next setup.
    Chasing missed entries = #1 reason traders lose money.
```

**NO_SETUP:**
```
    No valid confluence zone identified on M15.
    Nothing to time on M5.
    Verdict: SKIP.
```

---

## STEP 5: Stop Loss & Take Profit — The Math

### Stop Loss Placement:
```
    FOR A BUY SETUP:
    
                      Entry → ═══════════════
                              |  Zone       |
                              ═══════════════
                              
    Sweep low (wick) → ────── ← ── SL goes BELOW this wick
                        \  /       (the lowest point of the sweep)
                         \/
                         
    If using Internal OB entry:
    SL goes below the Internal OB instead (tighter SL = bigger lot size)
    
    FOR A SELL SETUP:
    
                         /\
                        /  \
    Sweep high (wick)→ ────── ← ── SL goes ABOVE this wick
    
                              ═══════════════
                              |  Zone       |
                      Entry → ═══════════════
```

### Take Profit — Target External Liquidity:
```
    External liquidity = the next UNTOUCHED swing high (for buys)
    or swing low (for sells) where resting orders sit.
    
    FOR A BUY:
    
    TP Target → ─────────── Next untouched swing high
                             (stops above here = your profit)
                   |
                   | ← This distance = your Take Profit
                   |
    Entry →   ═══════════
              |  Zone   |
              ═══════════
                   |
                   | ← This distance = your Stop Loss
                   |
    SL →      ────────── Below the sweep wick
    
    
    TP distance MUST be at least 2x the SL distance (1:2 R:R minimum)
    Ideally 3x or more (1:3 R:R)
```

### Lot Size Calculation:
```
    Formula:
    
    Lot Size = Risk Amount / (SL in pips × Pip Value per lot)
    
    Example:
    - Account: $10,000
    - Risk: 1% = $100
    - SL: 25 pips
    - Pip value (EURUSD standard lot): $10/pip
    
    Lot Size = $100 / (25 × $10) = $100 / $250 = 0.40 lots
    
    NEVER calculate lot size based on "feel."
    ALWAYS use this formula.
    Your Gatekeeper app does this automatically.
```

---

## The Complete Sequence — One Visual Summary

```
╔═══════════════════════════════════════════════════════════════════╗
║                    THE GATEKEEPER SEQUENCE                       ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  H4: What's the trend?                                           ║
║  ├─ HH/HL = BULLISH → Only look for BUYS                        ║
║  ├─ LH/LL = BEARISH → Only look for SELLS                       ║
║  └─ Ranging = Trade edges only                                   ║
║       ↓                                                          ║
║  H1: Has there been a liquidity sweep?                           ║
║  ├─ Wick beyond previous swing high/low? YES →                   ║
║  │   └─ Did price close BACK inside? YES → SWEEP CONFIRMED      ║
║  ├─ Break of Structure after sweep?                              ║
║  │   └─ Previous swing point broken opposite direction? YES →    ║
║  │       → BoS CONFIRMED                                        ║
║  └─ No sweep or no BoS? → SKIP/WAIT                             ║
║       ↓                                                          ║
║  M15: Where is the entry zone?                                   ║
║  ├─ FVG present? ✓/✗                                            ║
║  ├─ Order Block? ✓/✗ (External/Internal/Breaker)                ║
║  ├─ 20 EMA touching zone? ✓/✗                                   ║
║  ├─ S/R level at zone? ✓/✗                                      ║
║  └─ 3+ factors = A grade | 2 = B grade | <2 = C grade           ║
║       ↓                                                          ║
║  M5: Is price at the zone with confirmation?                     ║
║  ├─ READY = Price at zone + rejection candle → ENTER             ║
║  ├─ WAIT = Price approaching zone → PATIENCE                    ║
║  ├─ MISSED = Price already left zone → NO CHASE                 ║
║  └─ NO_SETUP = No valid zone → SKIP                             ║
║       ↓                                                          ║
║  EXECUTE:                                                        ║
║  ├─ SL: Beyond the sweep wick (or below Internal OB)            ║
║  ├─ TP: Next external liquidity (untouched swing H/L)           ║
║  ├─ R:R minimum 1:2, ideally 1:3+                               ║
║  └─ Lot size: Risk$ / (SL pips × pip value)                     ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

> **Next: Part 3 — The Discipline Framework (What Actually Makes You Profitable)**
