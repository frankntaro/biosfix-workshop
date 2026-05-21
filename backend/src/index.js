import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import customerRoutes from "./routes/customers.js";
import jobRoutes from "./routes/jobs.js";
import dashboardRoutes from "./routes/dashboard.js";
import paymentRoutes from "./routes/payments.js";
import userRoutes from "./routes/users.js";
import teamRoutes from "./routes/team.js";
import notificationRoutes from "./routes/notifications.js";
import reportRoutes from "./routes/reports.js";
import activityRoutes from "./routes/activity.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "biosfix-workshop-api" }));

app.get("/", (_req, res) => {
  res.json({
    service: "biosfix-workshop-api",
    message: "This is the API only. Open your frontend static site URL to use BIOSFIX.",
    health: "/health",
  });
});

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/jobs", jobRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/payments", paymentRoutes);
app.use("/users", userRoutes);
app.use("/team", teamRoutes);
app.use("/notifications", notificationRoutes);
app.use("/reports", reportRoutes);
app.use("/activity", activityRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

app.listen(PORT, () => {
  console.log(`BIOSFIX API http://localhost:${PORT}`);
});
