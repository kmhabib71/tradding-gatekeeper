//+------------------------------------------------------------------+
//|                                              LiquidityHunter.mq5 |
//|                        SMC Indicator — Liquidity & Structure Tool  |
//|                                                                    |
//| Features (all toggleable via on-chart panel):                      |
//|   1. Session High/Low + Kill Zone Shading                          |
//|   2. Equal Highs/Lows (EQH/EQL) Detection                         |
//|   3. Previous Day/Week High/Low                                    |
//|   4. Fair Value Gaps (FVG)                                         |
//+------------------------------------------------------------------+
#property copyright "LiquidityHunter"
#property version   "1.00"
#property strict
#property indicator_chart_window
#property indicator_buffers 0
#property indicator_plots   0

// ============================================================================
//  INPUT PARAMETERS
// ============================================================================

//--- General
input int    InpGMTOffset         = 2;              // Server GMT Offset

//--- Session / Kill Zone
input int    InpAsianStartHour    = 0;              // Asian Session Start (server hour)
input int    InpAsianEndHour      = 8;              // Asian Session End (server hour)
input int    InpLondonKZStart     = 9;              // London Kill Zone Start (server hour)
input int    InpLondonKZEnd       = 12;             // London Kill Zone End (server hour)
input int    InpNYKZStart         = 14;             // NY Kill Zone Start (server hour)
input int    InpNYKZEnd           = 17;             // NY Kill Zone End (server hour)
input int    InpMaxSessions       = 5;              // Max Sessions to Draw
input color  InpAsianHighColor    = clrDodgerBlue;  // Asian High Color
input color  InpAsianLowColor     = clrDodgerBlue;  // Asian Low Color
input color  InpLondonKZColor     = clrOrange;      // London KZ Color
input color  InpNYKZColor         = clrDeepSkyBlue; // NY KZ Color

//--- Equal Highs / Lows
input double InpEQTolerance       = 3.0;            // EQH/EQL Tolerance (pips)
input int    InpEQSwingLookback   = 3;              // Swing Lookback Bars
input int    InpEQMaxPairs        = 5;              // Max EQH/EQL Pairs
input color  InpEQHColor          = clrRed;         // Equal Highs Color
input color  InpEQLColor          = clrLime;        // Equal Lows Color

//--- Previous Day / Week Levels
input color  InpPDHColor          = clrGold;        // Previous Day High Color
input color  InpPDLColor          = clrGold;        // Previous Day Low Color
input color  InpPWHColor          = clrMagenta;     // Previous Week High Color
input color  InpPWLColor          = clrMagenta;     // Previous Week Low Color
input ENUM_LINE_STYLE InpLevelStyle = STYLE_DASH;   // Level Line Style

//--- Fair Value Gaps
input ENUM_TIMEFRAMES InpFVGTimeframe = PERIOD_M15; // FVG Detection Timeframe
input int    InpFVGMinGapPoints   = 30;             // FVG Min Gap Size (points)
input int    InpFVGMaxCount       = 15;             // Max FVGs to Draw
input int    InpFVGLookbackBars   = 50;             // FVG Lookback Bars
input color  InpFVGBullColor      = C'0,80,0';      // Bullish FVG Color
input color  InpFVGBearColor      = C'80,0,0';      // Bearish FVG Color
input bool   InpFVGAutoFade       = true;           // Auto-Fade Filled FVGs

// ============================================================================
//  DEFINES — Object name prefixes
// ============================================================================

// Panel
#define PNL_BG       "LH_PNL_BG"
#define PNL_TITLE    "LH_PNL_TITLE"
#define BTN_SESS     "LH_BTN_SESS"
#define BTN_EQ       "LH_BTN_EQ"
#define BTN_LVL      "LH_BTN_LVL"
#define BTN_FVG      "LH_BTN_FVG"

// Feature prefixes
#define PRE_SESS     "LH_SESS_"
#define PRE_KZ       "LH_KZ_"
#define PRE_EQ       "LH_EQ"
#define PRE_LVL      "LH_LVL_"
#define PRE_FVG      "LH_FVG_"

// ============================================================================
//  GLOBAL STATE
// ============================================================================

bool g_showSessions = true;
bool g_showEQ       = true;
bool g_showLevels   = true;
bool g_showFVG      = true;

datetime g_lastBarTime = 0;
datetime g_lastDayTime = 0;

// FVG tracking
struct FVGData
{
   string   name;
   double   top;
   double   bottom;
   bool     isBull;
   bool     filled;
};
FVGData g_fvgs[];
int     g_fvgCount = 0;

// ============================================================================
//  LIFECYCLE
// ============================================================================

int OnInit()
{
   CreatePanel();
   EventSetMillisecondTimer(500);

   // Defer heavy calculations to first OnCalculate (needs price arrays)
   Print("[LiquidityHunter] Indicator initialized");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectsDeleteAll(0, "LH_");
   ChartRedraw();
   Print("[LiquidityHunter] Indicator removed");
}

// ============================================================================
//  OnCalculate — Main detection engine
// ============================================================================

int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   if(rates_total < 50)
      return rates_total;

   // New bar check
   datetime currentBarTime = time[rates_total - 1];
   bool isNewBar = (currentBarTime != g_lastBarTime);
   if(!isNewBar && prev_calculated > 0)
      return rates_total;
   g_lastBarTime = currentBarTime;

   // Check if day changed
   datetime currentDay = iTime(_Symbol, PERIOD_D1, 0);
   bool dayChanged = (currentDay != g_lastDayTime);
   if(dayChanged)
      g_lastDayTime = currentDay;

   // Feature 1: Sessions + Kill Zones
   if(g_showSessions && (dayChanged || prev_calculated == 0))
      CalculateSessions();

   // Feature 2: EQH/EQL
   if(g_showEQ)
      RecalcEqualLevels(high, low, time, rates_total);

   // Feature 3: PDH/PDL/PWH/PWL
   if(g_showLevels && (dayChanged || prev_calculated == 0))
   {
      CalculatePDHL();
      CalculatePWHL();
   }

   // Feature 4: FVG
   if(g_showFVG)
      RecalcFVGs();

   ChartRedraw();
   return rates_total;
}

// ============================================================================
//  OnTimer — Live updates
// ============================================================================

void OnTimer()
{
   // Expand live KZ rectangle if in kill zone
   if(g_showSessions)
      ExpandLiveKZ();

   // Check FVG fill status
   if(g_showFVG && InpFVGAutoFade)
      CheckAllFVGFilled();
}

// ============================================================================
//  OnChartEvent — Panel button clicks
// ============================================================================

void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id != CHARTEVENT_OBJECT_CLICK)
      return;

   // Reset button press state (prevent stuck-pressed appearance)
   if(StringFind(sparam, "LH_BTN_") == 0)
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);

   if(sparam == BTN_SESS)
   {
      g_showSessions = !g_showSessions;
      UpdateButtonState(BTN_SESS, "Sessions", g_showSessions);
      SetObjectsVisibility(PRE_SESS, g_showSessions);
      SetObjectsVisibility(PRE_KZ, g_showSessions);
      if(g_showSessions) CalculateSessions();
      ChartRedraw();
   }
   else if(sparam == BTN_EQ)
   {
      g_showEQ = !g_showEQ;
      UpdateButtonState(BTN_EQ, "EQH / EQL", g_showEQ);
      SetObjectsVisibility(PRE_EQ, g_showEQ);
      ChartRedraw();
   }
   else if(sparam == BTN_LVL)
   {
      g_showLevels = !g_showLevels;
      UpdateButtonState(BTN_LVL, "PDH/PDL PW", g_showLevels);
      SetObjectsVisibility(PRE_LVL, g_showLevels);
      if(g_showLevels) { CalculatePDHL(); CalculatePWHL(); }
      ChartRedraw();
   }
   else if(sparam == BTN_FVG)
   {
      g_showFVG = !g_showFVG;
      UpdateButtonState(BTN_FVG, "Fair Value Gaps", g_showFVG);
      SetObjectsVisibility(PRE_FVG, g_showFVG);
      if(g_showFVG) RecalcFVGs();
      ChartRedraw();
   }
}

// ============================================================================
//  PANEL — Toggle buttons
// ============================================================================

void CreatePanel()
{
   int panelW = 150;
   int panelH = 130;
   int panelX = 10;
   int panelY = 10;

   // Background
   ObjectCreate(0, PNL_BG, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, PNL_BG, OBJPROP_CORNER, CORNER_LEFT_LOWER);
   ObjectSetInteger(0, PNL_BG, OBJPROP_XDISTANCE, panelX);
   ObjectSetInteger(0, PNL_BG, OBJPROP_YDISTANCE, panelY + panelH);
   ObjectSetInteger(0, PNL_BG, OBJPROP_XSIZE, panelW);
   ObjectSetInteger(0, PNL_BG, OBJPROP_YSIZE, panelH);
   ObjectSetInteger(0, PNL_BG, OBJPROP_BGCOLOR, C'25,25,30');
   ObjectSetInteger(0, PNL_BG, OBJPROP_BORDER_COLOR, C'60,60,65');
   ObjectSetInteger(0, PNL_BG, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, PNL_BG, OBJPROP_BACK, false);
   ObjectSetInteger(0, PNL_BG, OBJPROP_SELECTABLE, false);

   // Title
   ObjectCreate(0, PNL_TITLE, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, PNL_TITLE, OBJPROP_CORNER, CORNER_LEFT_LOWER);
   ObjectSetInteger(0, PNL_TITLE, OBJPROP_XDISTANCE, panelX + 8);
   ObjectSetInteger(0, PNL_TITLE, OBJPROP_YDISTANCE, panelY + panelH - 4);
   ObjectSetInteger(0, PNL_TITLE, OBJPROP_ANCHOR, ANCHOR_LEFT_LOWER);
   ObjectSetString(0, PNL_TITLE, OBJPROP_TEXT, "LIQUIDITY HUNTER");
   ObjectSetString(0, PNL_TITLE, OBJPROP_FONT, "Consolas");
   ObjectSetInteger(0, PNL_TITLE, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, PNL_TITLE, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, PNL_TITLE, OBJPROP_SELECTABLE, false);

   // Buttons (stacked from top of panel)
   int btnW = panelW - 16;
   int btnH = 22;
   int btnX = panelX + 8;
   int baseY = panelY + panelH - 22; // below title

   CreateToggleButton(BTN_SESS, "Sessions",        btnX, baseY - 0 * (btnH + 2), btnW, btnH, g_showSessions);
   CreateToggleButton(BTN_EQ,   "EQH / EQL",       btnX, baseY - 1 * (btnH + 2), btnW, btnH, g_showEQ);
   CreateToggleButton(BTN_LVL,  "PDH/PDL PW",      btnX, baseY - 2 * (btnH + 2), btnW, btnH, g_showLevels);
   CreateToggleButton(BTN_FVG,  "Fair Value Gaps",  btnX, baseY - 3 * (btnH + 2), btnW, btnH, g_showFVG);
}

void CreateToggleButton(string name, string label, int x, int y, int w, int h, bool state)
{
   ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_LOWER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_STATE, false);
   UpdateButtonState(name, label, state);
}

void UpdateButtonState(string name, string label, bool state)
{
   if(state)
   {
      ObjectSetString(0, name, OBJPROP_TEXT, label + "  ON");
      ObjectSetInteger(0, name, OBJPROP_BGCOLOR, C'20,70,20');
      ObjectSetInteger(0, name, OBJPROP_COLOR, clrLime);
   }
   else
   {
      ObjectSetString(0, name, OBJPROP_TEXT, label + "  OFF");
      ObjectSetInteger(0, name, OBJPROP_BGCOLOR, C'70,20,20');
      ObjectSetInteger(0, name, OBJPROP_COLOR, clrGray);
   }
}

// ============================================================================
//  UTILITY — Show/Hide objects by prefix
// ============================================================================

void SetObjectsVisibility(string prefix, bool visible)
{
   int total = ObjectsTotal(0);
   for(int i = total - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i);
      if(StringFind(name, prefix) == 0)
      {
         if(visible)
            ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
         else
            ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      }
   }
}

void DeleteObjectsByPrefix(string prefix)
{
   int total = ObjectsTotal(0);
   for(int i = total - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i);
      if(StringFind(name, prefix) == 0)
         ObjectDelete(0, name);
   }
}

double PipsToPrice(double pips)
{
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double pipSize = (digits == 3 || digits == 5) ? 10.0 : 1.0;
   return pips * pipSize * point;
}

// ============================================================================
//  FEATURE 3: Previous Day / Week High Low
// ============================================================================

void CalculatePDHL()
{
   DeleteObjectsByPrefix(PRE_LVL + "PD");

   MqlRates d1[];
   if(CopyRates(_Symbol, PERIOD_D1, 1, 1, d1) < 1)
      return;

   DrawLevelLine(PRE_LVL + "PDH", d1[0].high, InpPDHColor, "PDH");
   DrawLevelLine(PRE_LVL + "PDL", d1[0].low,  InpPDLColor, "PDL");
}

void CalculatePWHL()
{
   DeleteObjectsByPrefix(PRE_LVL + "PW");

   MqlRates w1[];
   if(CopyRates(_Symbol, PERIOD_W1, 1, 1, w1) < 1)
      return;

   DrawLevelLine(PRE_LVL + "PWH", w1[0].high, InpPWHColor, "PWH");
   DrawLevelLine(PRE_LVL + "PWL", w1[0].low,  InpPWLColor, "PWL");
}

void DrawLevelLine(string name, double price, color clr, string label)
{
   // Horizontal line
   ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, InpLevelStyle);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetString(0, name, OBJPROP_TOOLTIP, label + ": " + DoubleToString(price, _Digits));

   // Text label
   string lblName = name + "_L";
   datetime labelTime = iTime(_Symbol, PERIOD_CURRENT, 0);
   ObjectCreate(0, lblName, OBJ_TEXT, 0, labelTime, price);
   ObjectSetString(0, lblName, OBJPROP_TEXT, "  " + label);
   ObjectSetString(0, lblName, OBJPROP_FONT, "Consolas");
   ObjectSetInteger(0, lblName, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, lblName, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, lblName, OBJPROP_ANCHOR, ANCHOR_LEFT);
   ObjectSetInteger(0, lblName, OBJPROP_SELECTABLE, false);
}

// ============================================================================
//  FEATURE 1: Session High/Low + Kill Zone Shading
// ============================================================================

void CalculateSessions()
{
   DeleteObjectsByPrefix(PRE_SESS);
   DeleteObjectsByPrefix(PRE_KZ);

   for(int d = 0; d < InpMaxSessions; d++)
   {
      datetime dayStart = iTime(_Symbol, PERIOD_D1, d);
      if(dayStart == 0)
         continue;

      // Asian Session High/Low
      datetime asianStart = dayStart + InpAsianStartHour * 3600;
      datetime asianEnd   = dayStart + InpAsianEndHour * 3600;

      int startBar = iBarShift(_Symbol, PERIOD_CURRENT, asianStart);
      int endBar   = iBarShift(_Symbol, PERIOD_CURRENT, asianEnd);
      if(startBar < 0 || endBar < 0)
         continue;

      double sessHigh = -DBL_MAX;
      double sessLow  = DBL_MAX;

      for(int b = endBar; b <= startBar; b++)
      {
         double h = iHigh(_Symbol, PERIOD_CURRENT, b);
         double l = iLow(_Symbol, PERIOD_CURRENT, b);
         if(h > sessHigh) sessHigh = h;
         if(l < sessLow)  sessLow = l;
      }

      if(sessHigh <= 0 || sessLow >= DBL_MAX)
         continue;

      // Draw Asian High line
      string ahName = PRE_SESS + "AH_" + IntegerToString(d);
      ObjectCreate(0, ahName, OBJ_TREND, 0, asianEnd, sessHigh, TimeCurrent(), sessHigh);
      ObjectSetInteger(0, ahName, OBJPROP_COLOR, InpAsianHighColor);
      ObjectSetInteger(0, ahName, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, ahName, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, ahName, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, ahName, OBJPROP_BACK, true);
      ObjectSetInteger(0, ahName, OBJPROP_SELECTABLE, false);

      // Asian High label
      string ahlName = PRE_SESS + "AHL_" + IntegerToString(d);
      ObjectCreate(0, ahlName, OBJ_TEXT, 0, asianEnd, sessHigh);
      ObjectSetString(0, ahlName, OBJPROP_TEXT, " ASH");
      ObjectSetString(0, ahlName, OBJPROP_FONT, "Consolas");
      ObjectSetInteger(0, ahlName, OBJPROP_FONTSIZE, 7);
      ObjectSetInteger(0, ahlName, OBJPROP_COLOR, InpAsianHighColor);
      ObjectSetInteger(0, ahlName, OBJPROP_SELECTABLE, false);

      // Draw Asian Low line
      string alName = PRE_SESS + "AL_" + IntegerToString(d);
      ObjectCreate(0, alName, OBJ_TREND, 0, asianEnd, sessLow, TimeCurrent(), sessLow);
      ObjectSetInteger(0, alName, OBJPROP_COLOR, InpAsianLowColor);
      ObjectSetInteger(0, alName, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, alName, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, alName, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, alName, OBJPROP_BACK, true);
      ObjectSetInteger(0, alName, OBJPROP_SELECTABLE, false);

      // Asian Low label
      string allName = PRE_SESS + "ALL_" + IntegerToString(d);
      ObjectCreate(0, allName, OBJ_TEXT, 0, asianEnd, sessLow);
      ObjectSetString(0, allName, OBJPROP_TEXT, " ASL");
      ObjectSetString(0, allName, OBJPROP_FONT, "Consolas");
      ObjectSetInteger(0, allName, OBJPROP_FONTSIZE, 7);
      ObjectSetInteger(0, allName, OBJPROP_COLOR, InpAsianLowColor);
      ObjectSetInteger(0, allName, OBJPROP_SELECTABLE, false);

      // London Kill Zone rectangle
      datetime ldnStart = dayStart + InpLondonKZStart * 3600;
      datetime ldnEnd   = dayStart + InpLondonKZEnd * 3600;
      string ldnName = PRE_KZ + "LDN_" + IntegerToString(d);
      DrawKZRect(ldnName, ldnStart, ldnEnd, InpLondonKZColor);

      // NY Kill Zone rectangle
      datetime nyStart = dayStart + InpNYKZStart * 3600;
      datetime nyEnd   = dayStart + InpNYKZEnd * 3600;
      string nyName = PRE_KZ + "NY_" + IntegerToString(d);
      DrawKZRect(nyName, nyStart, nyEnd, InpNYKZColor);
   }
}

void DrawKZRect(string name, datetime t1, datetime t2, color clr)
{
   // Use a very large price range so the rectangle spans the full chart height
   ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, 0.00001, t2, 999999.0);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FILL, true);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 0);
}

void ExpandLiveKZ()
{
   // For today (day 0), expand KZ rectangle right edge if currently in a kill zone
   datetime now = TimeCurrent();
   datetime dayStart = iTime(_Symbol, PERIOD_D1, 0);
   if(dayStart == 0)
      return;

   // Check London KZ
   datetime ldnStart = dayStart + InpLondonKZStart * 3600;
   datetime ldnEnd   = dayStart + InpLondonKZEnd * 3600;
   if(now >= ldnStart && now <= ldnEnd)
   {
      string ldnName = PRE_KZ + "LDN_0";
      if(ObjectFind(0, ldnName) >= 0)
         ObjectSetInteger(0, ldnName, OBJPROP_TIME, 1, now);
   }

   // Check NY KZ
   datetime nyStart = dayStart + InpNYKZStart * 3600;
   datetime nyEnd   = dayStart + InpNYKZEnd * 3600;
   if(now >= nyStart && now <= nyEnd)
   {
      string nyName = PRE_KZ + "NY_0";
      if(ObjectFind(0, nyName) >= 0)
         ObjectSetInteger(0, nyName, OBJPROP_TIME, 1, now);
   }
}

// ============================================================================
//  FEATURE 2: Equal Highs / Lows
// ============================================================================

struct SwingPoint
{
   int      barIndex;
   double   price;
   datetime barTime;
};

void RecalcEqualLevels(const double &high[], const double &low[],
                       const datetime &time[], int rates_total)
{
   DeleteObjectsByPrefix(PRE_EQ);

   int lookback = InpEQSwingLookback;
   int scanStart = MathMax(lookback, rates_total - 100);
   int scanEnd   = rates_total - 1 - lookback;

   if(scanEnd <= scanStart)
      return;

   // Find swing highs
   SwingPoint swingHighs[];
   int shCount = 0;

   for(int i = scanStart; i <= scanEnd; i++)
   {
      bool isSwing = true;
      for(int j = 1; j <= lookback; j++)
      {
         if(high[i] <= high[i - j] || high[i] <= high[i + j])
         { isSwing = false; break; }
      }
      if(isSwing)
      {
         ArrayResize(swingHighs, shCount + 1);
         swingHighs[shCount].barIndex = i;
         swingHighs[shCount].price = high[i];
         swingHighs[shCount].barTime = time[i];
         shCount++;
      }
   }

   // Find swing lows
   SwingPoint swingLows[];
   int slCount = 0;

   for(int i = scanStart; i <= scanEnd; i++)
   {
      bool isSwing = true;
      for(int j = 1; j <= lookback; j++)
      {
         if(low[i] >= low[i - j] || low[i] >= low[i + j])
         { isSwing = false; break; }
      }
      if(isSwing)
      {
         ArrayResize(swingLows, slCount + 1);
         swingLows[slCount].barIndex = i;
         swingLows[slCount].price = low[i];
         swingLows[slCount].barTime = time[i];
         slCount++;
      }
   }

   double tolerance = PipsToPrice(InpEQTolerance);

   // Detect equal highs
   int eqhDrawn = 0;
   for(int i = shCount - 1; i >= 1 && eqhDrawn < InpEQMaxPairs; i--)
   {
      for(int j = i - 1; j >= 0; j--)
      {
         if(MathAbs(swingHighs[i].price - swingHighs[j].price) <= tolerance)
         {
            double avgPrice = (swingHighs[i].price + swingHighs[j].price) / 2.0;
            string lineName = PRE_EQ + "H_" + IntegerToString(eqhDrawn);
            string lblName  = PRE_EQ + "HL_" + IntegerToString(eqhDrawn);

            ObjectCreate(0, lineName, OBJ_TREND, 0,
                         swingHighs[j].barTime, avgPrice,
                         swingHighs[i].barTime, avgPrice);
            ObjectSetInteger(0, lineName, OBJPROP_COLOR, InpEQHColor);
            ObjectSetInteger(0, lineName, OBJPROP_STYLE, STYLE_DOT);
            ObjectSetInteger(0, lineName, OBJPROP_WIDTH, 1);
            ObjectSetInteger(0, lineName, OBJPROP_RAY_RIGHT, true);
            ObjectSetInteger(0, lineName, OBJPROP_BACK, false);
            ObjectSetInteger(0, lineName, OBJPROP_SELECTABLE, false);

            ObjectCreate(0, lblName, OBJ_TEXT, 0, swingHighs[i].barTime, avgPrice);
            ObjectSetString(0, lblName, OBJPROP_TEXT, " EQH");
            ObjectSetString(0, lblName, OBJPROP_FONT, "Consolas");
            ObjectSetInteger(0, lblName, OBJPROP_FONTSIZE, 8);
            ObjectSetInteger(0, lblName, OBJPROP_COLOR, InpEQHColor);
            ObjectSetInteger(0, lblName, OBJPROP_SELECTABLE, false);

            eqhDrawn++;
            break; // only match nearest pair
         }
      }
   }

   // Detect equal lows
   int eqlDrawn = 0;
   for(int i = slCount - 1; i >= 1 && eqlDrawn < InpEQMaxPairs; i--)
   {
      for(int j = i - 1; j >= 0; j--)
      {
         if(MathAbs(swingLows[i].price - swingLows[j].price) <= tolerance)
         {
            double avgPrice = (swingLows[i].price + swingLows[j].price) / 2.0;
            string lineName = PRE_EQ + "L_" + IntegerToString(eqlDrawn);
            string lblName  = PRE_EQ + "LL_" + IntegerToString(eqlDrawn);

            ObjectCreate(0, lineName, OBJ_TREND, 0,
                         swingLows[j].barTime, avgPrice,
                         swingLows[i].barTime, avgPrice);
            ObjectSetInteger(0, lineName, OBJPROP_COLOR, InpEQLColor);
            ObjectSetInteger(0, lineName, OBJPROP_STYLE, STYLE_DOT);
            ObjectSetInteger(0, lineName, OBJPROP_WIDTH, 1);
            ObjectSetInteger(0, lineName, OBJPROP_RAY_RIGHT, true);
            ObjectSetInteger(0, lineName, OBJPROP_BACK, false);
            ObjectSetInteger(0, lineName, OBJPROP_SELECTABLE, false);

            ObjectCreate(0, lblName, OBJ_TEXT, 0, swingLows[i].barTime, avgPrice);
            ObjectSetString(0, lblName, OBJPROP_TEXT, " EQL");
            ObjectSetString(0, lblName, OBJPROP_FONT, "Consolas");
            ObjectSetInteger(0, lblName, OBJPROP_FONTSIZE, 8);
            ObjectSetInteger(0, lblName, OBJPROP_COLOR, InpEQLColor);
            ObjectSetInteger(0, lblName, OBJPROP_SELECTABLE, false);

            eqlDrawn++;
            break;
         }
      }
   }
}

// ============================================================================
//  FEATURE 4: Fair Value Gaps
// ============================================================================

void RecalcFVGs()
{
   DeleteObjectsByPrefix(PRE_FVG);
   g_fvgCount = 0;
   ArrayResize(g_fvgs, 0);

   int count = InpFVGLookbackBars + 3;
   double fvgHigh[], fvgLow[], fvgOpen[], fvgClose[];
   datetime fvgTime[];

   if(CopyHigh(_Symbol, InpFVGTimeframe, 0, count, fvgHigh) < count)
      return;
   if(CopyLow(_Symbol, InpFVGTimeframe, 0, count, fvgLow) < count)
      return;
   if(CopyOpen(_Symbol, InpFVGTimeframe, 0, count, fvgOpen) < count)
      return;
   if(CopyClose(_Symbol, InpFVGTimeframe, 0, count, fvgClose) < count)
      return;
   if(CopyTime(_Symbol, InpFVGTimeframe, 0, count, fvgTime) < count)
      return;

   int drawn = 0;
   int tfSec = PeriodSeconds(InpFVGTimeframe);

   for(int i = 1; i < count - 1 && drawn < InpFVGMaxCount; i++)
   {
      int prev = i - 1;
      int mid  = i;
      int next = i + 1;

      // Bullish FVG: candle 3 low > candle 1 high (gap up)
      if(fvgLow[next] > fvgHigh[prev])
      {
         double gapSize = (fvgLow[next] - fvgHigh[prev]) / _Point;
         if(gapSize >= InpFVGMinGapPoints && fvgClose[mid] > fvgOpen[mid])
         {
            string name = PRE_FVG + "B_" + IntegerToString(drawn);
            datetime t1 = fvgTime[prev];
            datetime t2 = fvgTime[next] + tfSec * 8;

            ObjectCreate(0, name, OBJ_RECTANGLE, 0,
                         t1, fvgLow[next], t2, fvgHigh[prev]);
            ObjectSetInteger(0, name, OBJPROP_COLOR, InpFVGBullColor);
            ObjectSetInteger(0, name, OBJPROP_FILL, true);
            ObjectSetInteger(0, name, OBJPROP_BACK, true);
            ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, name, OBJPROP_WIDTH, 0);

            // Track for fill check
            ArrayResize(g_fvgs, g_fvgCount + 1);
            g_fvgs[g_fvgCount].name = name;
            g_fvgs[g_fvgCount].top = fvgLow[next];
            g_fvgs[g_fvgCount].bottom = fvgHigh[prev];
            g_fvgs[g_fvgCount].isBull = true;
            g_fvgs[g_fvgCount].filled = false;
            g_fvgCount++;
            drawn++;
         }
      }

      // Bearish FVG: candle 1 low > candle 3 high (gap down)
      if(fvgLow[prev] > fvgHigh[next])
      {
         double gapSize = (fvgLow[prev] - fvgHigh[next]) / _Point;
         if(gapSize >= InpFVGMinGapPoints && fvgClose[mid] < fvgOpen[mid])
         {
            string name = PRE_FVG + "S_" + IntegerToString(drawn);
            datetime t1 = fvgTime[prev];
            datetime t2 = fvgTime[next] + tfSec * 8;

            ObjectCreate(0, name, OBJ_RECTANGLE, 0,
                         t1, fvgLow[prev], t2, fvgHigh[next]);
            ObjectSetInteger(0, name, OBJPROP_COLOR, InpFVGBearColor);
            ObjectSetInteger(0, name, OBJPROP_FILL, true);
            ObjectSetInteger(0, name, OBJPROP_BACK, true);
            ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, name, OBJPROP_WIDTH, 0);

            ArrayResize(g_fvgs, g_fvgCount + 1);
            g_fvgs[g_fvgCount].name = name;
            g_fvgs[g_fvgCount].top = fvgLow[prev];
            g_fvgs[g_fvgCount].bottom = fvgHigh[next];
            g_fvgs[g_fvgCount].isBull = false;
            g_fvgs[g_fvgCount].filled = false;
            g_fvgCount++;
            drawn++;
         }
      }
   }
}

void CheckAllFVGFilled()
{
   if(g_fvgCount == 0)
      return;

   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick))
      return;

   double bid = tick.bid;

   for(int i = 0; i < g_fvgCount; i++)
   {
      if(g_fvgs[i].filled)
         continue;

      bool filled = false;
      if(g_fvgs[i].isBull && bid <= g_fvgs[i].bottom)
         filled = true;
      if(!g_fvgs[i].isBull && bid >= g_fvgs[i].top)
         filled = true;

      if(filled)
      {
         g_fvgs[i].filled = true;
         // Fade the rectangle
         color fadedColor = g_fvgs[i].isBull ? C'15,30,15' : C'30,15,15';
         ObjectSetInteger(0, g_fvgs[i].name, OBJPROP_COLOR, fadedColor);
      }
   }
}

//+------------------------------------------------------------------+
