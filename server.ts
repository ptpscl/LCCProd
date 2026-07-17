import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Import decoupled dataset-specific routes
import customerBronze from "./backend/api/bronze/customer.js";
import customerSilver from "./backend/api/silver/customer.js";
import customerGold from "./backend/api/gold/customer.js";

import loyaltyBronze from "./backend/api/bronze/loyalty.js";
import mmsBronze from "./backend/api/bronze/mms.js";
import skuBronze from "./backend/api/bronze/sku.js";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Middleware for parsing JSON requests
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ==========================================
  // BACKEND API ROUTES
  // ==========================================
  
  // Mount Customer Dataset Routes
  // This ensures Leonard's routes are fully isolated to /api/.../customer
  app.use("/api/bronze/customer", customerBronze);
  app.use("/api/silver/customer", customerSilver);
  app.use("/api/gold/customer", customerGold);

  // Mount other datasets Bronze APIs
  app.use("/api/bronze/loyalty", loyaltyBronze);
  app.use("/api/bronze/mms", mmsBronze);
  app.use("/api/bronze/sku", skuBronze);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Medallion architecture backend is running" });
  });

  // ==========================================
  // VITE MIDDLEWARE (FRONTEND)
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    // In development, Vite intercepts frontend requests
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the static files from the dist folder
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
