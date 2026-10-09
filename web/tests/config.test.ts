import { describe, expect, it } from "vitest";
import { dailySpendCap } from "@/lib/config";

describe("dailySpendCap", () => {
  it("defaults to 0 (closed) when unset or invalid", () => {
    delete process.env.DAILY_SPEND_CAP;
    expect(dailySpendCap()).toBe(0);
    process.env.DAILY_SPEND_CAP = "abc";
    expect(dailySpendCap()).toBe(0);
  });
  it("reads a positive number", () => {
    process.env.DAILY_SPEND_CAP = "500";
    expect(dailySpendCap()).toBe(500);
  });
});
