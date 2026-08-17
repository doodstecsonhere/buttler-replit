import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
import { isDatabaseError } from "./lib/auth";
import router from "./routes";

const app: Express = express();

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// Catch-all for any request that didn't match an /api/* route.
// In production the Replit platform proxy routes only /api/* here, so this
// handler only fires for genuinely unmatched API paths.  Redirect the browser
// to the frontend root so React can take over instead of returning a blank 404.
app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.redirect("/");
});

// Express 5 forwards rejected async handlers here. Keep API failures JSON and
// make sure authentication/database failures do not become opaque HTML 500s.
app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const detail = error instanceof Error ? error.stack : String(error);
    console.error(`[api] Unhandled request error:\n${detail}`);

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(isDatabaseError(error) ? 503 : 500).json({
      error: isDatabaseError(error)
        ? "Database service unavailable"
        : "Internal server error",
      message: isDatabaseError(error)
        ? "The server could not complete the request because the database is unavailable."
        : "The server could not complete the request. Please try again.",
    });
  },
);

export default app;
