import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// Import your decoupled modular backend routes
import bronzeRoutes from "./backend/api/bronze.js";
import silverRoutes from "./backend/api/silver.js";
import goldRoutes from "./backend/api/gold.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // ==========================================
  // BACKEND API ROUTES
  // ==========================================
  
  // By splitting these into separate files (bronze.ts, silver.ts, gold.ts),
  // your teammates can work on their respective layers in parallel 
  // without encountering merge conflicts in the main server file.
  app.use("/api/bronze", bronzeRoutes);
  app.use("/api/silver", silverRoutes);
  app.use("/api/gold", goldRoutes);

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
