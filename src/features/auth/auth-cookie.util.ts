import type { Request, Response } from "express";

export const REFRESH_COOKIE_NAME = "tcs_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export function readRefreshCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return undefined;
}

export function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.STAGE !== "local" && process.env.NODE_ENV !== "test",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: 30 * 24 * 60 * 60 * 1_000,
  });
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.STAGE !== "local" && process.env.NODE_ENV !== "test",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}
