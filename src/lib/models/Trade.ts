import mongoose, { Schema, Document } from "mongoose";

export interface ITrade extends Document {
  pair: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  lotSize: number;
  riskAmount: number;
  rrRatio: string;
  aiConfidence: number;
  setupGrade: string;
  screenshot: string;
  aiAnalysis: Record<string, unknown>;
  preTradeNotes: string;
  postTradeNotes: string;
  outcome: "open" | "win" | "loss" | "breakeven" | "skipped";
  pnlAmount: number;
  checklistCompleted: boolean;
  createdAt: Date;
  closedAt: Date | null;
}

const TradeSchema = new Schema<ITrade>(
  {
    pair: { type: String, required: true },
    direction: { type: String, enum: ["BUY", "SELL"], required: true },
    entryPrice: { type: Number, default: 0 },
    slPrice: { type: Number, default: 0 },
    tpPrice: { type: Number, default: 0 },
    lotSize: { type: Number, default: 0 },
    riskAmount: { type: Number, default: 0 },
    rrRatio: { type: String, default: "" },
    aiConfidence: { type: Number, default: 0 },
    setupGrade: { type: String, default: "" },
    screenshot: { type: String, default: "" },
    aiAnalysis: { type: Schema.Types.Mixed, default: {} },
    preTradeNotes: { type: String, default: "" },
    postTradeNotes: { type: String, default: "" },
    outcome: {
      type: String,
      enum: ["open", "win", "loss", "breakeven", "skipped"],
      default: "open",
    },
    pnlAmount: { type: Number, default: 0 },
    checklistCompleted: { type: Boolean, default: false },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Delete cached model to pick up schema changes during dev hot-reload
if (mongoose.models.Trade) {
  delete mongoose.models.Trade;
}
export const Trade = mongoose.model<ITrade>("Trade", TradeSchema);
