import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const paymentMode = process.env.PAYMENT_MODE || "demo";
const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:8080";

app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 60 }));

const catalog = new Map([
  ["vip", { name: "VIP", price: 79, currency: "UAH" }],
  ["premium", { name: "PREMIUM", price: 149, currency: "UAH" }],
  ["deluxe", { name: "DELUXE", price: 249, currency: "UAH" }],
  ["sakura", { name: "SAKURA", price: 399, currency: "UAH" }],
  ["starter-case", { name: "Стартовый набор", price: 39, currency: "UAH" }],
  ["builder-case", { name: "Набор строителя", price: 59, currency: "UAH" }],
  ["pvp-case", { name: "Набор бойца", price: 89, currency: "UAH" }],
  ["coins-small", { name: "1 000 монет", price: 29, currency: "UAH" }],
  ["coins-medium", { name: "5 000 монет", price: 99, currency: "UAH" }],
  ["coins-large", { name: "15 000 монет", price: 199, currency: "UAH" }],
  ["tokens-50", { name: "50 Sakura-токенов", price: 10, currency: "UAH" }],
  ["tokens-300", { name: "300 Sakura-токенов", price: 50, currency: "UAH" }],
  ["tokens-750", { name: "750 Sakura-токенов", price: 100, currency: "UAH" }]
]);

const orders = new Map();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: paymentMode, paymentsReady: false });
});

// This endpoint intentionally creates a DEMO order only.
// It does not charge money and does not grant in-game items.
app.post("/api/checkout", (req, res) => {
  const { playerName, items } = req.body ?? {};
  if (typeof playerName !== "string" || !/^[A-Za-z0-9_]{3,16}$/.test(playerName)) {
    return res.status(400).json({ error: "Invalid Minecraft Java username." });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return res.status(400).json({ error: "Invalid order items." });
  }

  let total = 0;
  const normalized = [];
  for (const item of items) {
    const product = catalog.get(item?.id);
    const quantity = Number(item?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: "Invalid product or quantity." });
    }
    total += product.price * quantity;
    normalized.push({ id: item.id, name: product.name, quantity, unitPrice: product.price });
  }
  if (total > 100000) return res.status(400).json({ error: "Order total exceeds limit." });

  const orderId = crypto.randomUUID();
  const order = {
    orderId, playerName, items: normalized, total, currency: "UAH",
    status: "demo_pending", createdAt: new Date().toISOString()
  };
  orders.set(orderId, order);
  return res.status(201).json({
    orderId,
    status: order.status,
    total,
    currency: order.currency,
    message: "DEMO ONLY: no payment was taken. Provider integration is not configured."
  });
});

// Before production: verify the exact signature format documented by your chosen provider.
// Never mark an order paid based only on browser input or a redirect URL.
app.post("/api/webhook", (_req, res) => {
  if (paymentMode !== "live") {
    return res.status(503).json({ error: "Payment webhook is disabled in demo mode." });
  }
  return res.status(501).json({ error: "Provider-specific signature validation is not implemented." });
});

app.get("/api/orders/:id", (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  // Production should authenticate the order owner or use a random private status token.
  return res.json({ orderId: order.orderId, status: order.status, total: order.total, currency: order.currency });
});

app.listen(PORT, () => {
  console.log(`Sakura World demo backend listening on port ${PORT}; mode=${paymentMode}`);
});
