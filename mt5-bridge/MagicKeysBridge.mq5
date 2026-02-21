//+------------------------------------------------------------------+
//|                                             MagicKeysBridge.mq5  |
//|                        Magic Keys On-Screen — Chart Line Bridge   |
//|                                                                    |
//| This EA communicates with the Python Magic Keys overlay via        |
//| shared JSON files in the MQL5/Files/ sandbox folder.               |
//|                                                                    |
//| It draws SL/TP/Entry lines on the chart, detects drag events,     |
//| recalculates lot size to maintain risk %, and writes back to       |
//| Python for order execution.                                        |
//+------------------------------------------------------------------+
#property copyright "Magic Keys"
#property version   "1.00"
#property strict

// === CONFIG ===
input double InpRiskPercent   = 1.0;    // Default risk % (overridden by Python)
input double InpRiskFixed     = 0.0;    // Fixed $ risk (0 = use %)
input double InpDefaultRR     = 2.0;    // Default R:R ratio
input int    InpPollMs        = 200;    // File poll interval (ms)

// === LINE NAMES ===
#define LINE_ENTRY   "MK_Entry"
#define LINE_SL      "MK_SL"
#define LINE_TP      "MK_TP"
#define LABEL_ENTRY  "MK_LabelEntry"
#define LABEL_SL     "MK_LabelSL"
#define LABEL_TP     "MK_LabelTP"
#define LABEL_INFO   "MK_LabelInfo"

// === FILE NAMES ===
#define FILE_CMD     "python_to_ea.json"
#define FILE_RESP    "ea_to_python.json"

// === STATE ===
bool   g_linesActive = false;
string g_direction   = "BUY";
double g_riskPercent = 1.0;
double g_riskFixed   = 0.0;
double g_rrRatio     = 2.0;
double g_entryPrice  = 0;
double g_slPrice     = 0;
double g_tpPrice     = 0;
double g_lots        = 0;
double g_riskAmount  = 0;
double g_slPips      = 0;
double g_tpPips      = 0;
string g_lastCmdHash = "";

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   g_riskPercent = InpRiskPercent;
   g_riskFixed   = InpRiskFixed;
   g_rrRatio     = InpDefaultRR;

   EventSetMillisecondTimer(InpPollMs);
   Print("[MagicKeys] Bridge EA started. Polling every ", InpPollMs, "ms");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   ClearLines();
   Comment("");
   Print("[MagicKeys] Bridge EA stopped");
}

//+------------------------------------------------------------------+
//| Timer — poll for Python commands                                  |
//+------------------------------------------------------------------+
void OnTimer()
{
   ReadCommand();
}

//+------------------------------------------------------------------+
//| Chart events — detect line drag                                   |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(!g_linesActive)
      return;

   // Object dragged
   if(id == CHARTEVENT_OBJECT_DRAG)
   {
      if(sparam == LINE_SL || sparam == LINE_TP)
      {
         OnLineDragged(sparam);
      }
   }

   // Object click (select)
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == LINE_SL || sparam == LINE_TP)
      {
         ObjectSetInteger(0, sparam, OBJPROP_SELECTED, true);
         ChartRedraw();
      }
   }
}

//+------------------------------------------------------------------+
//| Handle line drag                                                  |
//+------------------------------------------------------------------+
void OnLineDragged(string objName)
{
   double newPrice = ObjectGetDouble(0, objName, OBJPROP_PRICE);

   if(objName == LINE_SL)
   {
      g_slPrice = newPrice;
      // Recalculate lot size maintaining risk %
      RecalcFromSL();
   }
   else if(objName == LINE_TP)
   {
      g_tpPrice = newPrice;
      // Just update pips/RR display
      RecalcTPPips();
   }

   UpdateLabels();
   UpdateComment();
   WriteResponse();
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| Recalculate lots when SL is dragged (maintain risk %)             |
//+------------------------------------------------------------------+
void RecalcFromSL()
{
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   int digits   = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);

   // Calculate SL distance in pips
   double slDistPoints = MathAbs(g_entryPrice - g_slPrice) / point;
   double pipSize = (digits == 3 || digits == 5) ? 10.0 : 1.0;
   g_slPips = slDistPoints / pipSize;

   if(g_slPips <= 0)
   {
      g_lots = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
      return;
   }

   // Get account balance
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);

   // Risk amount
   g_riskAmount = (g_riskFixed > 0) ? g_riskFixed : balance * (g_riskPercent / 100.0);

   // Pip value for 1 lot
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double onePip    = pipSize * point;
   double pipValuePerLot = (tickSize > 0) ? tickValue * (onePip / tickSize) : 10.0;

   if(pipValuePerLot <= 0)
   {
      g_lots = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
      return;
   }

   // Calculate lots
   g_lots = g_riskAmount / (g_slPips * pipValuePerLot);

   // Round to volume step
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   if(step > 0)
      g_lots = MathFloor(g_lots / step) * step;

   g_lots = MathMax(minVol, MathMin(maxVol, g_lots));
   g_lots = NormalizeDouble(g_lots, 2);

   // Update TP based on R:R
   double tpDist = MathAbs(g_entryPrice - g_slPrice) * g_rrRatio;

   if(g_direction == "BUY")
      g_tpPrice = g_entryPrice + tpDist;
   else
      g_tpPrice = g_entryPrice - tpDist;

   g_tpPrice = NormalizeDouble(g_tpPrice, digits);

   // Move TP line
   ObjectSetDouble(0, LINE_TP, OBJPROP_PRICE, g_tpPrice);

   RecalcTPPips();
}

//+------------------------------------------------------------------+
//| Recalculate TP pips and R:R                                       |
//+------------------------------------------------------------------+
void RecalcTPPips()
{
   double point   = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   int digits     = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double pipSize = (digits == 3 || digits == 5) ? 10.0 : 1.0;

   double tpDistPoints = MathAbs(g_tpPrice - g_entryPrice) / point;
   g_tpPips = tpDistPoints / pipSize;

   if(g_slPips > 0)
      g_rrRatio = g_tpPips / g_slPips;
}

//+------------------------------------------------------------------+
//| Read command file from Python                                     |
//+------------------------------------------------------------------+
void ReadCommand()
{
   if(!FileIsExist(FILE_CMD))
      return;

   int fh = FileOpen(FILE_CMD, FILE_READ | FILE_TXT | FILE_ANSI);
   if(fh == INVALID_HANDLE)
      return;

   string content = "";
   while(!FileIsEnding(fh))
      content += FileReadString(fh);
   FileClose(fh);

   // Skip if same command (already processed)
   if(content == g_lastCmdHash)
      return;
   g_lastCmdHash = content;

   // Simple JSON parsing (no external libs needed)
   string action = JsonGetString(content, "action");

   if(action == "show_lines")
   {
      g_direction   = JsonGetString(content, "direction");
      g_riskPercent = JsonGetDouble(content, "risk_percent");
      g_riskFixed   = JsonGetDouble(content, "risk_fixed");
      g_rrRatio     = JsonGetDouble(content, "rr");
      double slPips = JsonGetDouble(content, "sl_pips");

      if(g_direction == "")   g_direction = "BUY";
      if(g_riskPercent <= 0)  g_riskPercent = InpRiskPercent;
      if(g_rrRatio <= 0)      g_rrRatio = InpDefaultRR;
      if(slPips <= 0)         slPips = 30;

      DrawLines(slPips);
      Print("[MagicKeys] Lines drawn: ", g_direction, " SL=", slPips, " pips, RR=1:", g_rrRatio);
   }
   else if(action == "clear_lines")
   {
      ClearLines();
      Print("[MagicKeys] Lines cleared");
   }
   else if(action == "update_rr")
   {
      g_rrRatio = JsonGetDouble(content, "rr");
      if(g_linesActive)
      {
         RecalcFromSL();
         UpdateLabels();
         UpdateComment();
         WriteResponse();
         ChartRedraw();
      }
   }

   // Delete the command file after processing
   FileDelete(FILE_CMD);
}

//+------------------------------------------------------------------+
//| Draw SL/TP/Entry lines on chart                                   |
//+------------------------------------------------------------------+
void DrawLines(double slPips)
{
   // Clear any existing lines first
   ClearLines();

   int digits     = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double point   = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double pipSize = (digits == 3 || digits == 5) ? 10.0 : 1.0;
   double onePip  = pipSize * point;

   // Entry price = current ask (BUY) or bid (SELL)
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick))
      return;

   if(g_direction == "BUY")
   {
      g_entryPrice = tick.ask;
      g_slPrice    = g_entryPrice - slPips * onePip;
      g_tpPrice    = g_entryPrice + slPips * g_rrRatio * onePip;
   }
   else
   {
      g_entryPrice = tick.bid;
      g_slPrice    = g_entryPrice + slPips * onePip;
      g_tpPrice    = g_entryPrice - slPips * g_rrRatio * onePip;
   }

   g_entryPrice = NormalizeDouble(g_entryPrice, digits);
   g_slPrice    = NormalizeDouble(g_slPrice, digits);
   g_tpPrice    = NormalizeDouble(g_tpPrice, digits);
   g_slPips     = slPips;
   g_tpPips     = slPips * g_rrRatio;

   // Calculate initial lots
   RecalcFromSL();

   // --- ENTRY LINE (blue dashed, not draggable) ---
   ObjectCreate(0, LINE_ENTRY, OBJ_HLINE, 0, 0, g_entryPrice);
   ObjectSetInteger(0, LINE_ENTRY, OBJPROP_COLOR, clrDodgerBlue);
   ObjectSetInteger(0, LINE_ENTRY, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, LINE_ENTRY, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, LINE_ENTRY, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, LINE_ENTRY, OBJPROP_BACK, false);

   // --- SL LINE (red, draggable) ---
   ObjectCreate(0, LINE_SL, OBJ_HLINE, 0, 0, g_slPrice);
   ObjectSetInteger(0, LINE_SL, OBJPROP_COLOR, clrRed);
   ObjectSetInteger(0, LINE_SL, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, LINE_SL, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, LINE_SL, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, LINE_SL, OBJPROP_SELECTED, true);
   ObjectSetInteger(0, LINE_SL, OBJPROP_BACK, false);
   ObjectSetString(0, LINE_SL, OBJPROP_TOOLTIP, "Drag to adjust Stop Loss");

   // --- TP LINE (green, draggable) ---
   ObjectCreate(0, LINE_TP, OBJ_HLINE, 0, 0, g_tpPrice);
   ObjectSetInteger(0, LINE_TP, OBJPROP_COLOR, clrLime);
   ObjectSetInteger(0, LINE_TP, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, LINE_TP, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, LINE_TP, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, LINE_TP, OBJPROP_BACK, false);
   ObjectSetString(0, LINE_TP, OBJPROP_TOOLTIP, "Drag to adjust Take Profit");

   // Labels
   CreateLabel(LABEL_ENTRY, 0);
   CreateLabel(LABEL_SL, 1);
   CreateLabel(LABEL_TP, 2);
   CreateLabel(LABEL_INFO, 3);

   g_linesActive = true;

   UpdateLabels();
   UpdateComment();
   WriteResponse();
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| Create a text label on chart                                      |
//+------------------------------------------------------------------+
void CreateLabel(string name, int row)
{
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 15);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 30 + row * 22);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
}

//+------------------------------------------------------------------+
//| Update all label text                                             |
//+------------------------------------------------------------------+
void UpdateLabels()
{
   string dirArrow = (g_direction == "BUY") ? "▲ BUY" : "▼ SELL";

   // Entry label
   ObjectSetString(0, LABEL_ENTRY, OBJPROP_TEXT,
      dirArrow + "  Entry: " + DoubleToString(g_entryPrice, _Digits));
   ObjectSetInteger(0, LABEL_ENTRY, OBJPROP_COLOR,
      (g_direction == "BUY") ? clrDodgerBlue : clrOrangeRed);

   // SL label
   ObjectSetString(0, LABEL_SL, OBJPROP_TEXT,
      "SL: " + DoubleToString(g_slPrice, _Digits) +
      "  (" + DoubleToString(g_slPips, 1) + " pips)");
   ObjectSetInteger(0, LABEL_SL, OBJPROP_COLOR, clrRed);

   // TP label
   ObjectSetString(0, LABEL_TP, OBJPROP_TEXT,
      "TP: " + DoubleToString(g_tpPrice, _Digits) +
      "  (" + DoubleToString(g_tpPips, 1) + " pips)  R:R 1:" + DoubleToString(g_rrRatio, 1));
   ObjectSetInteger(0, LABEL_TP, OBJPROP_COLOR, clrLime);

   // Info label
   ObjectSetString(0, LABEL_INFO, OBJPROP_TEXT,
      "Lots: " + DoubleToString(g_lots, 2) +
      "  Risk: $" + DoubleToString(g_riskAmount, 2));
   ObjectSetInteger(0, LABEL_INFO, OBJPROP_COLOR, clrWhite);
}

//+------------------------------------------------------------------+
//| Update chart comment (top-left)                                   |
//+------------------------------------------------------------------+
void UpdateComment()
{
   string dir = (g_direction == "BUY") ? "BUY ▲" : "SELL ▼";
   Comment(
      "═══ MAGIC KEYS ═══\n",
      dir, "  ", _Symbol, "\n",
      "Entry:  ", DoubleToString(g_entryPrice, _Digits), "\n",
      "SL:     ", DoubleToString(g_slPrice, _Digits), "  (", DoubleToString(g_slPips, 1), " pips)\n",
      "TP:     ", DoubleToString(g_tpPrice, _Digits), "  (", DoubleToString(g_tpPips, 1), " pips)\n",
      "R:R:    1:", DoubleToString(g_rrRatio, 1), "\n",
      "Lots:   ", DoubleToString(g_lots, 2), "\n",
      "Risk:   $", DoubleToString(g_riskAmount, 2), "\n",
      "═══════════════════\n",
      "Drag SL/TP lines, then press ENTER on keypad"
   );
}

//+------------------------------------------------------------------+
//| Clear all Magic Keys objects from chart                           |
//+------------------------------------------------------------------+
void ClearLines()
{
   ObjectDelete(0, LINE_ENTRY);
   ObjectDelete(0, LINE_SL);
   ObjectDelete(0, LINE_TP);
   ObjectDelete(0, LABEL_ENTRY);
   ObjectDelete(0, LABEL_SL);
   ObjectDelete(0, LABEL_TP);
   ObjectDelete(0, LABEL_INFO);
   Comment("");
   g_linesActive = false;
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| Write response file for Python                                    |
//+------------------------------------------------------------------+
void WriteResponse()
{
   int fh = FileOpen(FILE_RESP, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh == INVALID_HANDLE)
   {
      Print("[MagicKeys] Failed to write response file");
      return;
   }

   string json = "{";
   json += "\"symbol\":\"" + _Symbol + "\",";
   json += "\"direction\":\"" + g_direction + "\",";
   json += "\"entry_price\":" + DoubleToString(g_entryPrice, _Digits) + ",";
   json += "\"sl_price\":" + DoubleToString(g_slPrice, _Digits) + ",";
   json += "\"tp_price\":" + DoubleToString(g_tpPrice, _Digits) + ",";
   json += "\"sl_pips\":" + DoubleToString(g_slPips, 1) + ",";
   json += "\"tp_pips\":" + DoubleToString(g_tpPips, 1) + ",";
   json += "\"rr_ratio\":" + DoubleToString(g_rrRatio, 1) + ",";
   json += "\"lots\":" + DoubleToString(g_lots, 2) + ",";
   json += "\"risk_amount\":" + DoubleToString(g_riskAmount, 2) + ",";
   json += "\"active\":" + (g_linesActive ? "true" : "false");
   json += "}";

   FileWriteString(fh, json);
   FileClose(fh);
}

//+------------------------------------------------------------------+
//| Simple JSON string parser — extract string value by key           |
//+------------------------------------------------------------------+
string JsonGetString(string json, string key)
{
   string search = "\"" + key + "\":\"";
   int pos = StringFind(json, search);
   if(pos < 0) return "";

   pos += StringLen(search);
   int endPos = StringFind(json, "\"", pos);
   if(endPos < 0) return "";

   return StringSubstr(json, pos, endPos - pos);
}

//+------------------------------------------------------------------+
//| Simple JSON parser — extract double value by key                  |
//+------------------------------------------------------------------+
double JsonGetDouble(string json, string key)
{
   // Try "key":value (number without quotes)
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if(pos < 0) return 0;

   pos += StringLen(search);

   // Skip whitespace and possible quote
   while(pos < StringLen(json) && (StringGetCharacter(json, pos) == ' ' || StringGetCharacter(json, pos) == '"'))
      pos++;

   // Read until non-numeric
   string numStr = "";
   while(pos < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, pos);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-')
         numStr += ShortToString(ch);
      else
         break;
      pos++;
   }

   if(numStr == "") return 0;
   return StringToDouble(numStr);
}

//+------------------------------------------------------------------+
//| Tick handler — keep entry line at current price                   |
//+------------------------------------------------------------------+
void OnTick()
{
   // Optionally update entry line to track live price
   // (disabled: entry stays at price when OPEN TRADE was pressed)
}
//+------------------------------------------------------------------+
