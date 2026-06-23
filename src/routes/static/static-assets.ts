import express from "express";
import type { Response } from "express";
import { join } from "path";
import getStaticOptions from "../../config/static/static-options.js";
import { setCacheHeaders } from "./middleware/cache-control.js";
import { setSecurityHeaders } from "./middleware/security-headers.js";

const router = express.Router();
const ROBOTS_CONTENT = "User-agent: *\nDisallow: /admin/\nDisallow: /api/";

router.get("/robots.txt", (_req, res: Response) => {
  res.type("text/plain");
  res.send(ROBOTS_CONTENT);
});

router.use(setCacheHeaders);
router.use(setSecurityHeaders);

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
