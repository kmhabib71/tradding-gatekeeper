import mongoose, { Schema, Document } from "mongoose";

export interface IScanResult extends Document {
  pair: string;
  scanCycleId: string;
  timestamp: Date;
  prefilterPassed: boolean;
  prefilterReasons: string[];
  prefilterDetails: {
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
  aiAnalysis: Record<string, unknown> | null;
  setupGrade: string;
  overallVerdict: string;
  confidence: number;
}

const ScanResultSchema = new Schema<IScanResult>(
  {
    pair: { type: String, required: true },
    scanCycleId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    prefilterPassed: { type: Boolean, default: false },
    prefilterReasons: { type: [String], default: [] },
    prefilterDetails: { type: Schema.Types.Mixed, default: {} },
    aiAnalysis: { type: Schema.Types.Mixed, default: null },
    setupGrade: { type: String, default: "" },
    overallVerdict: { type: String, default: "" },
    confidence: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ScanResultSchema.index({ timestamp: -1 });
ScanResultSchema.index({ scanCycleId: 1 });
ScanResultSchema.index({ pair: 1, timestamp: -1 });

export const ScanResult =
  mongoose.models.ScanResult || mongoose.model<IScanResult>("ScanResult", ScanResultSchema);
