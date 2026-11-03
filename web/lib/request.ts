import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { sha256, type Result } from "./arena";

const COOKIE = "ub_uid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The anonymous session id (random, in a cookie) and a salted hash of the client IP used only as a
 * rate-limit key. Neither identifies a person; the raw IP is never stored.
 */
export async function requestContext() {
  const jar = await cookies();
  let uid = jar.get(COOKIE)?.value;
  if (!uid || !UUID.test(uid)) {
    uid = randomUUID();
    jar.set(COOKIE, uid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 3600,
    });
  }
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const client = sha256(`${process.env.RATE_LIMIT_SALT ?? "urdubench"}|${ip}`).slice(0, 32);
  return { uid, client };
}

/** Rejects cross-site POSTs: browsers always send Origin on POST, so a mismatch means another site. */
export async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === h.get("host");
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function respond(r: Result) {
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

export const notConfigured = () =>
  respond({ status: 503, body: { error: "not-configured", message: "This feature is not switched on yet." } });

export const forbidden = () => respond({ status: 403, body: { error: "forbidden" } });
