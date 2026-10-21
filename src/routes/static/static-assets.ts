import express from "express";
import type { Response } from "express";
import { join } from "path";
import getStaticOptions from "../../config/static/static-options.js";
import { setCacheHeaders } from "./middleware/cache-control.js";
import { setSecurityHeaders } from "./middleware/security-headers.js";

const router = express.Router();

router.get("/robots.txt", (_req, res: Response) => {
  res.type("text/plain");
  res.sendFile(join(process.cwd(), "public", "robots.txt"));
});

router.use(setCacheHeaders);
router.use(setSecurityHeaders);
// HTML is rendered by main routes (including nonce and authentication handling).
router.use((req, _res, next) => {
  let path: string;
  try { path = decodeURIComponent(req.path).toLowerCase().replace(/\/+$/, ""); }
  catch { next("router"); return; }
  if (path.endsWith(".html") || path.endsWith(".htm")) { next("router"); return; }
  next();
});

router.use(
  "/",
  express.static(join(process.cwd(), "public"), {
    ...getStaticOptions(),
    index: false,
    dotfiles: "ignore",
    etag: true,
    lastModified: true,
  }),
);

router.use(
  "/assets",
  express.static(join(process.cwd(), "assets"), {
    dotfiles: "ignore",
    etag: true,
    lastModified: true,
  }),
);

export default router;
