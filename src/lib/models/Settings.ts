import mongoose, { Schema, Document } from "mongoose";

export interface ISettings extends Document {
  accountBalance: number;
  riskPercentage: number;
  maxTradesPerDay: number;
  maxDailyLosses: number;
  pairs: string[];
  aiProvider: "openai" | "claude";
  openaiApiKey: string;
  claudeApiKey: string;
  accountType: string;
  accountSize: number;
}

const SettingsSchema = new Schema<ISettings>(
  {
    accountBalance: { type: Number, default: 10000 },
    riskPercentage: { type: Number, default: 1 },
    maxTradesPerDay: { type: Number, default: 3 },
    maxDailyLosses: { type: Number, default: 2 },
    pairs: { type: [String], default: ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"] },
    aiProvider: { type: String, enum: ["openai", "claude"], default: "openai" },
    openaiApiKey: { type: String, default: "" },
    claudeApiKey: { type: String, default: "" },
    accountType: { type: String, default: "ftmo" },
    accountSize: { type: Number, default: 10000 },
  },
  { timestamps: true }
);

export const Settings =
  mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);
