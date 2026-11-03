import { describe, expect, it, vi } from "vitest";
import { withLog } from "@/lib/log";

describe("withLog", () => {
  it("logs route, method, status and duration only", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const h = withLog("quiz", async (req: Request) => Response.json({ secret: await req.text() }, { status: 201 }));
    const res = await h(new Request("https://x/api/quiz", { method: "POST", body: "my private question" }));
    expect(res.status).toBe(201);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(Object.keys(line).sort()).toEqual(["method", "ms", "route", "status"]);
    expect(line).toMatchObject({ route: "quiz", method: "POST", status: 201 });
    expect(spy.mock.calls[0][0]).not.toContain("private");
    spy.mockRestore();
  });

  it("turns a thrown error into a 500 without leaking its message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = withLog("ask", async () => {
      throw new Error("db password is hunter2");
    });
    const res = await h();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    expect(spy.mock.calls[0][0]).not.toContain("hunter2");
    spy.mockRestore();
  });
});
