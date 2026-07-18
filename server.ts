import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface ScrapedOrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

interface ScrapedOrder {
  id: string;
  platform: 'shopee' | 'tiktok';
  orderSn: string;
  customerName: string;
  phone: string;
  address: string;
  items: ScrapedOrderItem[];
  totalAmount: number;
  carrier: string;
  trackingNumber: string;
  createdAt: string;
}

// Memory store for scraped orders received from the Chrome Extension
const scrapedOrdersQueue: ScrapedOrder[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON payloads
  app.use(express.json());

  // Enable CORS manually for development and extensions
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Get all synced/scraped orders currently in queue
  app.get("/api/scraped-orders", (req, res) => {
    res.json({
      success: true,
      orders: scrapedOrdersQueue
    });
  });

  // Chrome Extension sends a POST to this endpoint
  app.post("/api/scraped-orders", (req, res) => {
    const orderData: ScrapedOrder = req.body;

    if (!orderData || !orderData.orderSn || !orderData.items || orderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu đơn hàng không hợp lệ (Thiếu mã đơn hàng hoặc sản phẩm)."
      });
    }

    // Assign a unique local ID if not provided
    if (!orderData.id) {
      orderData.id = `scraped-${orderData.platform}-${Date.now()}`;
    }
    if (!orderData.createdAt) {
      orderData.createdAt = new Date().toISOString();
    }

    // Check if we already have this orderSn in our queue to prevent duplicates
    const isDuplicate = scrapedOrdersQueue.some(o => o.orderSn === orderData.orderSn);
    if (!isDuplicate) {
      scrapedOrdersQueue.push(orderData);
      // Limit queue to last 50 orders
      if (scrapedOrdersQueue.length > 50) {
        scrapedOrdersQueue.shift();
      }
      console.log(`[EX-SERVER] Nhận đơn hàng mới từ Extension: ${orderData.orderSn} (${orderData.platform.toUpperCase()})`);
    } else {
      console.log(`[EX-SERVER] Đơn trùng lặp bị bỏ qua: ${orderData.orderSn}`);
    }

    res.json({
      success: true,
      message: "Đã nhận đơn hàng thành công và xếp vào hàng đợi đồng bộ kho.",
      orderSn: orderData.orderSn
    });
  });

  // Clear orders from queue (triggered by POS app after processing)
  app.post("/api/scraped-orders/clear", (req, res) => {
    const { orderSn } = req.body;
    if (orderSn) {
      const idx = scrapedOrdersQueue.findIndex(o => o.orderSn === orderSn);
      if (idx !== -1) {
        scrapedOrdersQueue.splice(idx, 1);
      }
    } else {
      scrapedOrdersQueue.length = 0;
    }
    res.json({ success: true, message: "Đã dọn dẹp hàng đợi đồng bộ." });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[POS-SERVER] Running on http://localhost:${PORT}`);
  });
}

startServer();
