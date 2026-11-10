import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  if (req.path === "/admin.html") {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https://discord.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://discord.com",
    );
  }
  if (req.path.startsWith("/api/shop/admin")) res.setHeader("Cache-Control", "no-store, private");
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const shopWebDir = path.resolve(serverDir, "../public/shop");
app.use("/shop-assets", express.static(path.resolve(serverDir, "../public", "shop-assets")));
app.use(express.static(shopWebDir));

app.use("/api", router);

// FR Family Shop web arayüzü aynı Render bot servisi üzerinden yayınlanır.
// Böylece ayrı bir web servisi veya VITE_API_BASE_URL zorunlu değildir.
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/shop-assets")) {
    return next();
  }
  res.sendFile(path.join(shopWebDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

export default app;
