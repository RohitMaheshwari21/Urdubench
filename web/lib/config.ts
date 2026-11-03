/** Hard limit on live LLM calls per UTC day. Unset or invalid means 0: live LLM features stay off. */
export function dailySpendCap(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.DAILY_SPEND_CAP);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
