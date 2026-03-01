import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import premiumRoutes from "./routes/premiumRoutes.js";
import adminLiteRoutes from "./routes/adminLiteRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";

export const app = express();

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/videos", videoRoutes);
app.use("/premium", premiumRoutes);
app.use("/admin-lite", adminLiteRoutes);
app.use("/ai", aiRoutes);
app.use("/comments", commentRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});
