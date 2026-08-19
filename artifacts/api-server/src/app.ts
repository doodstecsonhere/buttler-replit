import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
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

export default app;
