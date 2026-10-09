export function dailySpendCap(): number {
  const n = Number(process.env.DAILY_SPEND_CAP);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
