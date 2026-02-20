import mongoose, { Schema, Document } from "mongoose";

export interface IDailyLog extends Document {
  date: string;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  totalPnl: number;
  rulesFollowedPct: number;
  aiBlockedCount: number;
  notes: string;
}

const DailyLogSchema = new Schema<IDailyLog>(
  {
    date: { type: String, required: true, unique: true },
    tradesCount: { type: Number, default: 0 },
    winsCount: { type: Number, default: 0 },
    lossesCount: { type: Number, default: 0 },
    totalPnl: { type: Number, default: 0 },
    rulesFollowedPct: { type: Number, default: 100 },
    aiBlockedCount: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const DailyLog =
  mongoose.models.DailyLog || mongoose.model<IDailyLog>("DailyLog", DailyLogSchema);
