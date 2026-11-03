/**
 * One JSON line per API request in the Vercel logs: route, method, status and duration only. Never
 * request bodies, questions, phone numbers, cookies or IPs.
 */
export function withLog<A extends unknown[]>(route: string, handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const start = performance.now();
    const method = args[0] instanceof Request ? args[0].method : "?";
    try {
      const res = await handler(...args);
      console.log(JSON.stringify({ route, method, status: res.status, ms: Math.round(performance.now() - start) }));
      return res;
    } catch (e) {
      console.error(
        JSON.stringify({ route, method, status: 500, ms: Math.round(performance.now() - start), error: e instanceof Error ? e.name : "unknown" }),
      );
      return Response.json({ error: "server", message: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
