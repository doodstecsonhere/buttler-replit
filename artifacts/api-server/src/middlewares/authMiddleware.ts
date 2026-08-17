import * as oidc from "openid-client";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  updateSession,
  type SessionData,
  isDatabaseError,
} from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || now <= session.expires_at) return session;

  if (!session.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(
      config,
      session.refresh_token,
    );
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
    return session;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  // Starting or completing a login must not be blocked by a stale session
  // cookie or a temporarily unavailable session store. These routes establish
  // or validate authentication themselves.
  if (
    ["/api/login", "/api/callback", "/api/mobile-auth/token-exchange"].includes(
      req.path,
    )
  ) {
    next();
    return;
  }

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  let session: SessionData | null;
  try {
    session = await getSession(sid);
  } catch (error) {
    const detail = error instanceof Error ? error.stack : String(error);
    console.error(`[auth] Session lookup failed:\n${detail}`);

    // Do not let a stale/broken session cookie prevent the user from
    // starting a new login. The session store failure is explicit so clients
    // can distinguish it from an unauthenticated request.
    res.clearCookie("sid", { path: "/" });
    res.status(isDatabaseError(error) ? 503 : 401).json({
      error: isDatabaseError(error)
        ? "Authentication session store unavailable"
        : "Invalid authentication session",
      message: isDatabaseError(error)
        ? "We could not verify your session. Please try again shortly."
        : "Your session is invalid or expired. Please log in again.",
    });
    return;
  }

  if (!session?.user?.id) {
    try {
      await clearSession(res, sid);
    } catch (error) {
      const detail = error instanceof Error ? error.stack : String(error);
      console.error(`[auth] Invalid session cleanup failed:\n${detail}`);
      res.clearCookie("sid", { path: "/" });
    }
    next();
    return;
  }

  let refreshed: SessionData | null;
  try {
    refreshed = await refreshIfExpired(sid, session);
  } catch (error) {
    const detail = error instanceof Error ? error.stack : String(error);
    console.error(`[auth] Session refresh failed:\n${detail}`);
    refreshed = null;
  }

  if (!refreshed) {
    try {
      await clearSession(res, sid);
    } catch (error) {
      const detail = error instanceof Error ? error.stack : String(error);
      console.error(`[auth] Expired session cleanup failed:\n${detail}`);
      res.clearCookie("sid", { path: "/" });
    }
    next();
    return;
  }

  req.user = refreshed.user;
  next();
}
