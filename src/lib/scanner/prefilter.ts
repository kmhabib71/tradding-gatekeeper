export interface OHLCCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PrefilterInput {
  pair: string;
  h4: OHLCCandle[];
  h1: OHLCCandle[];
  m15: OHLCCandle[];
  m5: OHLCCandle[];
}

export interface PrefilterResult {
  passed: boolean;
  reasons: string[];
  details: {
    h4TrendDirection: "BULLISH" | "BEARISH" | "RANGING";
    h4TrendClarity: boolean;
    premiumDiscountZone: "PREMIUM" | "DISCOUNT" | "EQUILIBRIUM";
    inKillZone: boolean;
    killZoneName: string;
    h1SweepDetected: boolean;
    h1MaxWickRatio: number;
    h1Displacement: boolean;
    h1BodyRatio: number;
  };
}

interface SwingPoint {
  index: number;
  price: number;
  type: "high" | "low";
}

// Find swing highs and lows using a 2-bar lookback/lookahead
function findSwingPoints(candles: OHLCCandle[]): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    // Swing high: higher than 2 candles on each side
    if (
      c.high > candles[i - 1].high &&
      c.high > candles[i - 2].high &&
      c.high > candles[i + 1].high &&
      c.high > candles[i + 2].high
    ) {
      points.push({ index: i, price: c.high, type: "high" });
    }
    // Swing low: lower than 2 candles on each side
    if (
      c.low < candles[i - 1].low &&
      c.low < candles[i - 2].low &&
      c.low < candles[i + 1].low &&
      c.low < candles[i + 2].low
    ) {
      points.push({ index: i, price: c.low, type: "low" });
    }
  }
  return points;
}

export function checkH4Trend(candles: OHLCCandle[]): {
  direction: "BULLISH" | "BEARISH" | "RANGING";
  clarity: boolean;
} {
  if (candles.length < 10) {
    return { direction: "RANGING", clarity: false };
  }

  const swings = findSwingPoints(candles);
  const highs = swings.filter((s) => s.type === "high").slice(-4);
  const lows = swings.filter((s) => s.type === "low").slice(-4);

  if (highs.length < 2 || lows.length < 2) {
    return { direction: "RANGING", clarity: false };
  }

  // Check for HH/HL (bullish)
  let hhCount = 0;
  let hlCount = 0;
  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) hhCount++;
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price > lows[i - 1].price) hlCount++;
  }

  // Check for LH/LL (bearish)
  let lhCount = 0;
  let llCount = 0;
  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price < highs[i - 1].price) lhCount++;
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price < lows[i - 1].price) llCount++;
  }

  const bullishScore = hhCount + hlCount;
  const bearishScore = lhCount + llCount;

  if (bullishScore >= 3) {
    return { direction: "BULLISH", clarity: bullishScore >= 4 };
  }
  if (bearishScore >= 3) {
    return { direction: "BEARISH", clarity: bearishScore >= 4 };
  }

  // Weaker but still directional
  if (bullishScore > bearishScore && bullishScore >= 2) {
    return { direction: "BULLISH", clarity: false };
  }
  if (bearishScore > bullishScore && bearishScore >= 2) {
    return { direction: "BEARISH", clarity: false };
  }

  return { direction: "RANGING", clarity: false };
}

export function checkPremiumDiscount(
  h4Candles: OHLCCandle[],
  trendDirection: "BULLISH" | "BEARISH" | "RANGING"
): {
  zone: "PREMIUM" | "DISCOUNT" | "EQUILIBRIUM";
  aligned: boolean;
} {
  if (h4Candles.length < 5) {
    return { zone: "EQUILIBRIUM", aligned: false };
  }

  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  for (const c of h4Candles) {
    if (c.high > rangeHigh) rangeHigh = c.high;
    if (c.low < rangeLow) rangeLow = c.low;
  }

  const range = rangeHigh - rangeLow;
  if (range <= 0) {
    return { zone: "EQUILIBRIUM", aligned: false };
  }

  const currentPrice = h4Candles[h4Candles.length - 1].close;
  const position = (currentPrice - rangeLow) / range;

  let zone: "PREMIUM" | "DISCOUNT" | "EQUILIBRIUM";
  if (position > 0.667) {
    zone = "PREMIUM";
  } else if (position < 0.333) {
    zone = "DISCOUNT";
  } else {
    zone = "EQUILIBRIUM";
  }

  // Aligned = looking for reversals: bullish trend + price in discount (buy dip),
  // or bearish trend + price in premium (sell rally)
  const aligned =
    (trendDirection === "BULLISH" && zone === "DISCOUNT") ||
    (trendDirection === "BEARISH" && zone === "PREMIUM");

  return { zone, aligned };
}

export function checkKillZone(): {
  inKillZone: boolean;
  killZoneName: string;
} {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const time = utcHour * 60 + utcMinute;

  // London Open: 07:00-10:00 UTC
  if (time >= 420 && time < 600) {
    return { inKillZone: true, killZoneName: "LONDON" };
  }
  // New York Open: 12:00-15:00 UTC
  if (time >= 720 && time < 900) {
    return { inKillZone: true, killZoneName: "NEW_YORK" };
  }
  // London Close: 15:00-17:00 UTC
  if (time >= 900 && time < 1020) {
    return { inKillZone: true, killZoneName: "LONDON_CLOSE" };
  }

  return { inKillZone: false, killZoneName: "NONE" };
}

export function checkH1Sweep(
  candles: OHLCCandle[],
  trendDirection: "BULLISH" | "BEARISH" | "RANGING"
): {
  detected: boolean;
  maxWickRatio: number;
} {
  if (candles.length < 5 || trendDirection === "RANGING") {
    return { detected: false, maxWickRatio: 0 };
  }

  // Check last 8 H1 candles for directional sweep wicks
  // Bullish trend (looking to buy dip): need LOWER wick = sweep of lows then rejection up
  // Bearish trend (looking to sell rally): need UPPER wick = sweep of highs then rejection down
  const recent = candles.slice(-8);
  let maxWickRatio = 0;

  for (const c of recent) {
    const totalRange = c.high - c.low;
    if (totalRange <= 0) continue;

    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Only count the directionally relevant wick
    const relevantWick =
      trendDirection === "BULLISH" ? lowerWick : upperWick;
    const ratio = relevantWick / totalRange;

    if (ratio > maxWickRatio) {
      maxWickRatio = ratio;
    }
  }

  return {
    detected: maxWickRatio >= 0.5,
    maxWickRatio: Math.round(maxWickRatio * 100) / 100,
  };
}

export function checkH1Displacement(
  candles: OHLCCandle[],
  trendDirection: "BULLISH" | "BEARISH" | "RANGING"
): {
  detected: boolean;
  bodyRatio: number;
} {
  if (candles.length < 3 || trendDirection === "RANGING") {
    return { detected: false, bodyRatio: 0 };
  }

  // Check last 3 H1 candles for a displacement (strong momentum) candle
  // Body > 70% of range, in the trend direction = confirms sweep rejection
  const recent = candles.slice(-3);
  let maxBodyRatio = 0;

  for (const c of recent) {
    const totalRange = c.high - c.low;
    if (totalRange <= 0) continue;

    const body = Math.abs(c.close - c.open);
    const bodyRatio = body / totalRange;

    const isBullishCandle = c.close > c.open;
    const directionMatch =
      (trendDirection === "BULLISH" && isBullishCandle) ||
      (trendDirection === "BEARISH" && !isBullishCandle);

    if (directionMatch && bodyRatio > maxBodyRatio) {
      maxBodyRatio = bodyRatio;
    }
  }

  return {
    detected: maxBodyRatio >= 0.7,
    bodyRatio: Math.round(maxBodyRatio * 100) / 100,
  };
}

export function runPrefilter(input: PrefilterInput): PrefilterResult {
  const reasons: string[] = [];

  // Check 1: Kill zone (MANDATORY)
  const killZone = checkKillZone();
  if (killZone.inKillZone) {
    reasons.push(`In ${killZone.killZoneName} kill zone`);
  }

  // Check 2: H4 trend (MANDATORY — must be clear, not weak)
  const h4Trend = checkH4Trend(input.h4);
  if (h4Trend.direction !== "RANGING") {
    reasons.push(
      `H4 trend: ${h4Trend.direction}${h4Trend.clarity ? " (clear)" : ""}`
    );
  }

  // Check 3: Premium/discount zone alignment (MANDATORY)
  const pdZone = checkPremiumDiscount(input.h4, h4Trend.direction);
  if (pdZone.aligned) {
    reasons.push(`Price in ${pdZone.zone} zone (aligned with trend)`);
  }

  // Check 4: H1 directional sweep (MANDATORY — timing trigger)
  const h1Sweep = checkH1Sweep(input.h1, h4Trend.direction);
  if (h1Sweep.detected) {
    reasons.push(`H1 sweep detected (wick ratio: ${h1Sweep.maxWickRatio})`);
  }

  // Check 5: H1 displacement (MANDATORY — confirms rejection)
  const h1Disp = checkH1Displacement(input.h1, h4Trend.direction);
  if (h1Disp.detected) {
    reasons.push(`H1 displacement (body ratio: ${h1Disp.bodyRatio})`);
  }

  // ALL 5 must pass:
  // 1. Kill zone  2. H4 trend  3. Zone aligned  4. H1 sweep  5. H1 displacement
  const passed =
    killZone.inKillZone &&
    h4Trend.direction !== "RANGING" &&
    pdZone.aligned &&
    h1Sweep.detected &&
    h1Disp.detected;

  return {
    passed,
    reasons,
    details: {
      h4TrendDirection: h4Trend.direction,
      h4TrendClarity: h4Trend.clarity,
      premiumDiscountZone: pdZone.zone,
      inKillZone: killZone.inKillZone,
      killZoneName: killZone.killZoneName,
      h1SweepDetected: h1Sweep.detected,
      h1MaxWickRatio: h1Sweep.maxWickRatio,
      h1Displacement: h1Disp.detected,
      h1BodyRatio: h1Disp.bodyRatio,
    },
  };
}
