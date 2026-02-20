import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateLotSize(
  accountBalance: number,
  riskPercentage: number,
  slPips: number,
  pair: string
): number {
  const riskAmount = accountBalance * (riskPercentage / 100);
  // Standard lot = 100,000 units, 1 pip = $10 for standard lot on most USD pairs
  let pipValue = 10; // per standard lot
  if (pair.includes("JPY")) {
    pipValue = 10; // approximate for JPY pairs
  }
  const lotSize = riskAmount / (slPips * pipValue);
  return Math.round(lotSize * 100) / 100; // round to 2 decimal places
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}
