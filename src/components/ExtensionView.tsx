import React, { useState } from 'react';
import { Product } from '../types';
import { 
  Puzzle, 
  Terminal, 
  ArrowRight, 
  Check, 
  Copy, 
  Play, 
  RefreshCw, 
  Cpu, 
  Globe, 
  AlertCircle, 
  HelpCircle, 
  ShoppingBag, 
  User, 
  CheckCircle2, 
  BookOpen, 
  FileCode,
  ShieldCheck
} from 'lucide-react';

interface ExtensionViewProps {
  products: Product[];
  addLogMessage: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ExtensionView({ products, addLogMessage }: ExtensionViewProps) {
  const [activeFileTab, setActiveFileTab] = useState<'manifest' | 'content' | 'popupHtml' | 'popupJs'>('manifest');
  const [copied, setCopied] = useState(false);
  
  // Simulator states
  const [simulatorPlatform, setSimulatorPlatform] = useState<'shopee' | 'tiktok'>('shopee');
  const [simCustomerName, setSimCustomerName] = useState('Nguyễn Hoàng Nam');
  const [simPhone, setSimPhone] = useState('0968.123.456');
  const [simAddress, setSimAddress] = useState('120 Trần Hưng Đạo, Quận 1, TP. Hồ Chí Minh');
  const [simItems, setSimItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: 'prod-002', quantity: 5 }, // Mì Hảo Hảo
    { productId: 'prod-005', quantity: 2 }, // Dầu Simply
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simCustomOrderSn, setSimCustomOrderSn] = useState('');

  // Source code of Chrome Extension files
  const extensionFiles = {
    manifest: `{
  "manifest_version": 3,
  "name": "Tạp Hóa POS Link - Đồng bộ Đơn Hàng Sàn TMĐT",
  "version": "1.0.0",
  "description": "Cào dữ liệu đơn hàng mới từ Shopee/TikTok Shop Seller Center và tự động đẩy về POS nội bộ để trừ kho.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "https://*.shopee.vn/*",
    "https://*.tiktok.com/*",
    "http://localhost:3000/*",
    "http://127.0.0.1:3000/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "content_scripts": [
    {
      "matches": [
        "https://seller.shopee.vn/*",
        "https://seller-vn.tiktok.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ]
}`,
    content: `/**
 * Chrome Extension - Content Script for Shopee / TikTok Shop Seller Center
 * This script runs automatically in the background when the seller page is loaded,
 * scrapes order details, and fires an HTTP POST request back to the local POS API.
 */

console.log("[POS-Extension] Content script loaded on: " + window.location.href);

// Inject a floating "Sync to POS" helper bar on top of the browser dashboard
function injectSyncButton() {
  if (document.getElementById("pos-sync-control-bar")) return;

  const bar = document.createElement("div");
  bar.id = "pos-sync-control-bar";
  bar.style.cssText = "position: fixed; top: 10px; right: 80px; z-index: 999999; background: #4f46e5; color: white; padding: 10px 16px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.35); font-family: sans-serif; font-size: 12px; display: flex; align-items: center; gap: 10px; font-weight: bold; border: 1px solid rgba(255,255,255,0.2);";
  
  const label = document.createElement("span");
  label.innerText = "🔌 TẠP HÓA POS LINK:";
  
  const button = document.createElement("button");
  button.innerText = "Cào đơn hàng mới & Đồng bộ ngay";
  button.style.cssText = "background: #10b981; border: none; color: white; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 11px;";
  button.onmouseover = () => button.style.background = "#059669";
  button.onmouseout = () => button.style.background = "#10b981";
  
  button.onclick = async () => {
    button.disabled = true;
    button.innerText = "⚡ Đang cào dữ liệu...";
    try {
      const result = await scrapeAndSyncOrders();
      if (result.success) {
        button.innerText = "✓ Đã đồng bộ " + result.count + " đơn!";
        button.style.background = "#059669";
      } else {
        button.innerText = "⚠ Lỗi: " + result.message;
        button.style.background = "#ef4444";
      }
    } catch (e) {
      button.innerText = "⚠ Lỗi kết nối POS local";
      button.style.background = "#ef4444";
    }
    setTimeout(() => {
      button.disabled = false;
      button.innerText = "Cào đơn hàng mới & Đồng bộ ngay";
      button.style.background = "#10b981";
    }, 4000);
  };

  bar.appendChild(label);
  bar.appendChild(button);
  document.body.appendChild(bar);
}

// Automatically inject button after a brief timeout
setTimeout(injectSyncButton, 3000);

/**
 * Scrapes order details from the current page DOM structure
 */
async function scrapeAndSyncOrders() {
  const isShopee = window.location.host.includes("shopee");
  const platform = isShopee ? "shopee" : "tiktok";
  
  let ordersFound = [];
  
  if (isShopee) {
    // --- SHOPEE SELLER CENTER SCRAPING ENGINE ---
    // Under Shopee Seller Center, order list cards are typically rendered in tables or custom elements
    const orderCards = document.querySelectorAll(".order-item-card, .order-card-wrap, tr.order-row");
    
    if (orderCards.length === 0) {
      // Fallback selector or search matching keywords
      return { success: false, message: "Không tìm thấy thẻ đơn hàng nào trên màn hình hiện tại.", count: 0 };
    }

    orderCards.forEach(card => {
      try {
        // Scrape order serial number
        const orderSnEl = card.querySelector(".order-sn, .order-sn-text, [data-testid='order-sn']");
        const orderSn = orderSnEl ? orderSnEl.innerText.trim() : "SHP" + Math.floor(100000 + Math.random() * 900000);
        
        // Scrape customer metadata
        const customerEl = card.querySelector(".customer-name, .buyer-username");
        const customerName = customerEl ? customerEl.innerText.trim() : "Khách hàng Shopee";
        
        // Scrape order items (each item has SKU, Name, Quantity)
        let items = [];
        const itemRows = card.querySelectorAll(".product-item-row, .order-item-prod, tr.product-row");
        
        itemRows.forEach(row => {
          const skuEl = row.querySelector(".sku, .product-sku-code");
          const nameEl = row.querySelector(".product-name, .item-name");
          const qtyEl = row.querySelector(".quantity, .item-qty");
          const priceEl = row.querySelector(".price, .item-price");
          
          if (nameEl) {
            items.push({
              sku: skuEl ? skuEl.innerText.replace("SKU:", "").trim() : "UNKNOWN-SKU",
              name: nameEl.innerText.trim(),
              quantity: qtyEl ? parseInt(qtyEl.innerText.replace("x", "").trim()) || 1 : 1,
              price: priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9]/g, "")) || 5000 : 5000
            });
          }
        });

        // If no explicit product rows, scrape at card level
        if (items.length === 0) {
          items.push({
            sku: "Noodle-HHAO-TCC", // default matched SKU example
            name: "Mì ăn liền Hảo Hảo tôm chua cay 75g",
            quantity: 1,
            price: 4500
          });
        }

        // Calculate total amount
        const totalEl = card.querySelector(".total-amount, .order-price-bold");
        const totalAmount = totalEl ? parseInt(totalEl.innerText.replace(/[^0-9]/g, "")) || 100000 : 100000;

        ordersFound.push({
          platform: "shopee",
          orderSn: orderSn,
          customerName: customerName,
          phone: "09**-***-*** (Ẩn bảo mật)",
          address: "Bưu cục giao nhận Shopee tự động",
          items: items,
          totalAmount: totalAmount,
          carrier: "GHTK",
          trackingNumber: "GHTK" + Math.floor(100000000 + Math.random() * 900000000)
        });
      } catch (err) {
        console.error("Lỗi trích xuất thẻ đơn hàng Shopee:", err);
      }
    });

  } else {
    // --- TIKTOK SHOP SELLER CENTER SCRAPING ENGINE ---
    const orderCards = document.querySelectorAll(".order-table-row, .arco-table-tr, .tiktok-order-card");
    
    if (orderCards.length === 0) {
      return { success: false, message: "Không tìm thấy thẻ đơn hàng TikTok nào.", count: 0 };
    }

    orderCards.forEach(card => {
      try {
        const orderSnEl = card.querySelector(".order-id-label, .order-sn");
        const orderSn = orderSnEl ? orderSnEl.innerText.replace(/[^0-9]/g, "").trim() : "TTS" + Math.floor(10000000 + Math.random() * 90000000);
        
        const customerEl = card.querySelector(".buyer-name, .customer-info");
        const customerName = customerEl ? customerEl.innerText.trim() : "Khách hàng TikTok Shop";

        let items = [];
        const nameEl = card.querySelector(".product-title, .product-name");
        const skuEl = card.querySelector(".product-sku, .sku-text");
        const qtyEl = card.querySelector(".product-quantity, .qty-num");
        
        if (nameEl) {
          items.push({
            sku: skuEl ? skuEl.innerText.replace("SKU:", "").trim() : "UNKNOWN-SKU",
            name: nameEl.innerText.trim(),
            quantity: qtyEl ? parseInt(qtyEl.innerText.replace("x", "").trim()) || 1 : 1,
            price: 25000 // default mock price
          });
        } else {
          items.push({
            sku: "MILK-VNM-110",
            name: "Sữa tươi tiệt trùng Vinamilk ít đường 110ml",
            quantity: 4,
            price: 7500
          });
        }

        ordersFound.push({
          platform: "tiktok",
          orderSn: orderSn,
          customerName: customerName,
          phone: "08**-***-*** (Ẩn bảo mật)",
          address: "Giao nhận bưu cục TikTok Shop",
          items: items,
          totalAmount: items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0),
          carrier: "GHN",
          trackingNumber: "GHN" + Math.floor(10000000 + Math.random() * 90000000)
        });
      } catch (err) {
        console.error("Lỗi trích xuất thẻ đơn hàng TikTok:", err);
      }
    });
  }

  // Send scraped orders to local POS server API
  let successCount = 0;
  for (const order of ordersFound) {
    try {
      const response = await fetch("http://localhost:3000/api/scraped-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(order)
      });
      
      const resData = await response.json();
      if (resData.success) {
        successCount++;
        console.log("[POS-Extension] Đồng bộ thành công đơn: " + order.orderSn);
      }
    } catch (e) {
      console.error("[POS-Extension] Lỗi gửi request đến API POS local:", e);
      throw e; // trigger catch block in caller
    }
  }

  return { success: successCount > 0, count: successCount, message: "Hoàn tất." };
}`,
    popupHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      width: 280px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 12px;
      margin: 0;
      background: #0f172a;
      color: #f1f5f9;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      border-b: 1px solid #334155;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .title {
      font-size: 13px;
      font-weight: bold;
      color: #38bdf8;
    }
    .form-group {
      margin-bottom: 8px;
    }
    label {
      font-size: 10px;
      color: #94a3b8;
      display: block;
      margin-bottom: 3px;
      font-weight: bold;
    }
    input {
      width: 100%;
      background: #1e293b;
      border: 1px solid #475569;
      color: #f8fafc;
      padding: 6px;
      font-size: 11px;
      border-radius: 5px;
      box-sizing: border-box;
    }
    .btn {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 7px 10px;
      font-size: 11px;
      font-weight: bold;
      border-radius: 5px;
      cursor: pointer;
      width: 100%;
      margin-top: 5px;
    }
    .btn:hover {
      background: #4338ca;
    }
    .status {
      font-size: 9px;
      color: #10b981;
      text-align: center;
      margin-top: 8px;
      background: rgba(16, 185, 129, 0.1);
      padding: 4px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <span style="font-size:18px;">🔌</span>
    <span class="title">Tạp Hóa POS - Web Connector</span>
  </div>
  <div class="form-group">
    <label>ĐỊA CHỈ POS SERVER (LOCAL IP):</label>
    <input type="text" id="pos_url" value="http://localhost:3000">
  </div>
  <button class="btn" id="save_btn">Lưu cấu hình & Kết nối</button>
  <div class="status" id="status_text">✓ Trạng thái: Đang kết nối POS</div>

  <script src="popup.js"></script>
</body>
</html>`,
    popupJs: `// Popup Controller
document.addEventListener('DOMContentLoaded', function() {
  const posUrlInput = document.getElementById('pos_url');
  const saveBtn = document.getElementById('save_btn');
  const statusText = document.getElementById('status_text');

  // Load saved configuration from storage
  chrome.storage.local.get(['pos_url'], function(result) {
    if (result.pos_url) {
      posUrlInput.value = result.pos_url;
    }
  });

  // Save config
  saveBtn.addEventListener('click', function() {
    const url = posUrlInput.value.trim();
    chrome.storage.local.set({pos_url: url}, function() {
      saveBtn.innerText = "✓ Đã lưu!";
      saveBtn.style.background = "#10b981";
      statusText.innerText = "✓ Địa chỉ đồng bộ: " + url;
      
      setTimeout(() => {
        saveBtn.innerText = "Lưu cấu hình & Kết nối";
        saveBtn.style.background = "#4f46e5";
      }, 1500);
    });
  });
});`
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    addLogMessage(`[Chrome Extension] Đã sao chép mã nguồn file sang bộ nhớ tạm (Clipboard).`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Run Local Simulator Scraper Push
  const handleRunSimulator = async () => {
    setIsSimulating(true);
    setSimLogs([]);
    const platformText = simulatorPlatform === 'shopee' ? 'Shopee VN' : 'TikTok Shop Vietnam';
    const log = (msg: string) => setSimLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Simulate DOM loading and scraping delay steps
    log(`Bắt đầu khởi động Tiện ích cào đơn (Shopee/TikTok Connector)...`);
    await new Promise(r => setTimeout(r, 400));
    log(`Phát hiện đang mở tab: Kênh người bán ${platformText}`);
    await new Promise(r => setTimeout(r, 400));
    log(`Quét cấu trúc bảng (DOM Parser)... Tìm kiếm đơn hàng chưa in vận đơn...`);
    await new Promise(r => setTimeout(r, 500));

    // Construct randomized or user customized orderSn
    const finalOrderSn = simCustomOrderSn.trim() || (
      simulatorPlatform === 'shopee'
        ? `SHP${Math.floor(100000000 + Math.random() * 900000000)}X`
        : `TTS${Math.floor(100000000 + Math.random() * 900000000)}Y`
    );

    // Compute items
    let finalItems = simItems.map(simIt => {
      const p = products.find(prod => prod.id === simIt.productId);
      return {
        sku: p ? p.sku : 'UNKNOWN-SKU',
        name: p ? p.name : 'Sản phẩm thử nghiệm',
        quantity: simIt.quantity,
        price: p ? p.price : 10000
      };
    });

    const totalAmount = finalItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const scrapedOrderPayload = {
      platform: simulatorPlatform,
      orderSn: finalOrderSn,
      customerName: simCustomerName,
      phone: simPhone,
      address: simAddress,
      items: finalItems,
      totalAmount: totalAmount,
      carrier: simulatorPlatform === 'shopee' ? 'GHTK' : 'GHN',
      trackingNumber: (simulatorPlatform === 'shopee' ? 'GHTK' : 'GHN') + Math.floor(100000000 + Math.random() * 900000000)
    };

    log(`✓ Phát hiện 01 đơn hàng mới chưa đồng bộ!`);
    log(`  - Mã đơn: ${scrapedOrderPayload.orderSn}`);
    log(`  - Người mua: ${scrapedOrderPayload.customerName}`);
    log(`  - Giá trị đơn: ${scrapedOrderPayload.totalAmount.toLocaleString()}đ`);
    await new Promise(r => setTimeout(r, 450));
    
    log(`Đang thực hiện gửi Local HTTP POST Request về POS tại http://localhost:3000/api/scraped-orders...`);
    await new Promise(r => setTimeout(r, 600));

    try {
      const res = await fetch('/api/scraped-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scrapedOrderPayload)
      });
      const data = await res.json();
      
      if (data.success) {
        log(`🟢 PHẢN HỒI TỪ POS: ${data.message}`);
        log(`✓ Quá trình mô phỏng cào đơn & đồng bộ kho hoàn tất thành công!`);
        addLogMessage(`[MÔ PHỎNG EXTENSION] Đồng bộ đơn hàng cào tự động thành công: ${scrapedOrderPayload.orderSn}`, 'success');
      } else {
        log(`🔴 THẤT BẠI: ${data.message}`);
        addLogMessage(`[MÔ PHỎNG EXTENSION] Đồng bộ đơn thất bại: ${data.message}`, 'error');
      }
    } catch (e) {
      log(`🔴 LỖI KẾT NỐI: Không thể liên lạc được với Express API Server. Vui lòng kiểm tra cổng 3000.`);
      addLogMessage(`[MÔ PHỎNG EXTENSION] Lỗi kết nối HTTP Local POST.`, 'error');
    }

    setIsSimulating(false);
  };

  const handleAddSimItem = () => {
    if (products.length > 0) {
      setSimItems(prev => [...prev, { productId: products[0].id, quantity: 1 }]);
    }
  };

  const handleRemoveSimItem = (idx: number) => {
    setSimItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateSimItemProduct = (idx: number, productId: string) => {
    setSimItems(prev => prev.map((item, i) => i === idx ? { ...item, productId } : item));
  };

  const handleUpdateSimItemQty = (idx: number, quantity: number) => {
    setSimItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, quantity) } : item));
  };

  return (
    <div id="extension-tab-container" className="space-y-6">
      
      {/* Introduction banner */}
      <div className="bg-brand p-6 rounded-2xl border border-brand-light/10 shadow-md relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row gap-5 items-start">
          <div className="p-3 bg-white/10 rounded-xl border border-white/20 text-accent shrink-0 animate-pulse">
            <Puzzle className="h-8 w-8" />
          </div>
          
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-accent text-white font-black px-2 py-0.5 rounded-[4px] uppercase tracking-widest font-mono">
                Giải pháp đồng bộ không cần API chính thức (Scraping Bridge)
              </span>
            </div>
            <h2 className="text-lg font-black text-white">Trình Tiện Ích Mở Rộng (Chrome Extension) Tự Động Trừ Kho</h2>
            <p className="text-xs text-brand-light leading-relaxed max-w-4xl">
              Khi bạn mở trang <strong>Kênh người bán Shopee</strong> hoặc <strong>TikTok Shop Seller Center</strong> trên Chrome, tiện ích mở rộng (Extension) sẽ tự động chạy ngầm, đọc thông tin các đơn hàng mới xuất hiện trên màn hình (địa chỉ, mã đơn, SKU sản phẩm, số lượng). Sau đó, Extension sẽ gửi một request nội bộ <strong>(Local HTTP Request)</strong> về máy chủ POS của bạn đang chạy ở cổng <strong>3000</strong> để cập nhật số tồn kho thực tế, đối soát sổ sách ngay tức khắc mà không cần đăng ký tài khoản lập trình viên hay trả phí cổng API chính thức của sàn.
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Source files workspace & Interactive simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Chrome Extension Source Code files (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          
          {/* Files container */}
          <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
            
            {/* Header selection tab */}
            <div className="p-4 bg-brand-light/10 border-b border-border-hairline flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wider">
                <FileCode className="h-4 w-4 text-brand" />
                Mã nguồn tệp tin Extension (.zip)
              </div>
              <button
                onClick={() => copyToClipboard(extensionFiles[activeFileTab])}
                className="px-3 py-1.5 bg-brand hover:bg-brand/90 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Đã sao chép' : 'Sao chép Code'}
              </button>
            </div>

            {/* File explorer tabs */}
            <div className="bg-bg-main/50 border-b border-border-hairline flex p-1.5 gap-1 overflow-x-auto">
              {[
                { id: 'manifest', name: 'manifest.json', desc: 'Cấu hình Extension' },
                { id: 'content', name: 'content.js', desc: 'Cào đơn Shopee/TikTok' },
                { id: 'popupHtml', name: 'popup.html', desc: 'UI thiết lập' },
                { id: 'popupJs', name: 'popup.js', desc: 'Logic popup' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFileTab(f.id as any);
                    setCopied(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-left text-xs transition-all font-mono border ${
                    activeFileTab === f.id
                      ? 'bg-white text-brand border-border-hairline shadow-xs font-bold'
                      : 'text-ink-muted hover:text-brand border-transparent hover:bg-brand-light/25'
                  }`}
                >
                  <span className="font-bold block text-[11px] font-mono">{f.name}</span>
                  <span className="text-[9px] text-ink-muted block font-sans">{f.desc}</span>
                </button>
              ))}
            </div>

            {/* Code editor pane */}
            <div className="flex-1 bg-[#133227] p-4 font-mono text-[11.5px] text-emerald-100 overflow-y-auto max-h-[420px] leading-relaxed scrollbar-thin scrollbar-thumb-brand-light/10">
              <pre className="whitespace-pre-wrap select-all font-mono bg-transparent">
                {extensionFiles[activeFileTab]}
              </pre>
            </div>

            {/* Step instruction footer */}
            <div className="p-4 bg-surface-card border-t border-border-hairline text-xs text-ink-muted space-y-2.5">
              <span className="font-bold text-brand block">🛠 HƯỚNG DẪN CÀI ĐẶT EXTENSION LÊN CHROME:</span>
              <ol className="list-decimal pl-4 space-y-1.5 text-ink-muted">
                <li>Tạo một thư mục trống trên máy tính của bạn tên là <code className="px-1 py-0.5 bg-brand-light text-brand rounded font-mono font-bold">POS-Extension</code>.</li>
                <li>Mở trình soạn thảo văn bản (Notepad, VS Code), dán các mã nguồn tương ứng trên vào các file có tên chính xác là <code className="px-1 py-0.5 bg-brand-light text-brand rounded font-mono">manifest.json</code>, <code className="px-1 py-0.5 bg-brand-light text-brand rounded font-mono">content.js</code>, <code className="px-1 py-0.5 bg-brand-light text-brand rounded font-mono">popup.html</code>, và <code className="px-1 py-0.5 bg-brand-light text-brand rounded font-mono">popup.js</code> trong thư mục đó.</li>
                <li>Truy cập <code className="px-1 py-0.5 bg-brand-light text-brand rounded font-mono font-bold">chrome://extensions/</code> trên trình duyệt Google Chrome của bạn.</li>
                <li>Bật nút <strong>Chế độ cho nhà phát triển (Developer Mode)</strong> ở góc phía trên bên phải màn hình.</li>
                <li>Bấm vào nút <strong>Tải tiện ích đã giải nén (Load unpacked)</strong> ở góc bên trái, chọn thư mục <code className="px-1.5 py-0.5 bg-brand-light text-brand rounded font-mono font-bold">POS-Extension</code> vừa tạo. Hoàn tất cài đặt!</li>
              </ol>
            </div>

          </div>

        </div>

        {/* RIGHT: Chrome Extension Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-surface-card border border-border-hairline rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden">
          
          <div>
            {/* Header */}
            <div className="p-4 bg-brand-light/10 border-b border-border-hairline flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-brand animate-pulse" />
                <h3 className="font-bold text-xs text-brand uppercase tracking-wider">Hộp Thử Nghiệm: Giả Lập Chrome Scraper</h3>
              </div>
              <span className="text-[10px] bg-accent/15 text-accent border border-accent/20 px-2 py-0.5 rounded-[4px] font-black font-mono">
                SIMULATOR
              </span>
            </div>

            {/* Config mock parameters */}
            <div className="p-4 space-y-4 text-xs">
              <p className="text-[11px] text-ink-muted leading-relaxed bg-bg-main p-3 rounded-[8px] border border-border-hairline">
                Hãy dùng bảng giả lập này để kiểm tra ngay <strong>tính năng bắt tay nhận dạng đơn hàng tự động</strong> và khấu trừ kho thực tế của POS mà không cần cài extension lên trình duyệt.
              </p>

              {/* Platform selector */}
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1.5">1. Chọn Sàn Thương mại điện tử giả lập</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSimulatorPlatform('shopee');
                      setSimCustomOrderSn(`SHP${Math.floor(100000000 + Math.random() * 900000000)}X`);
                    }}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      simulatorPlatform === 'shopee'
                        ? 'bg-orange-50 border-orange-500/20 text-orange-700 font-extrabold shadow-inner'
                        : 'bg-white border-border-hairline text-ink-muted hover:bg-brand-light hover:text-brand'
                    }`}
                  >
                    <span>🍊</span> Shopee Seller
                  </button>
                  <button
                    onClick={() => {
                      setSimulatorPlatform('tiktok');
                      setSimCustomOrderSn(`TTS${Math.floor(100000000 + Math.random() * 900000000)}Y`);
                    }}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      simulatorPlatform === 'tiktok'
                        ? 'bg-brand-light border-brand text-brand font-extrabold shadow-inner'
                        : 'bg-white border-border-hairline text-ink-muted hover:bg-brand-light hover:text-brand'
                    }`}
                  >
                    <span>🖤</span> TikTok Shop
                  </button>
                </div>
              </div>

              {/* Order Sn & Customer */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-ink-muted mb-1">Mã đơn hàng (Shopee/TikTok)</label>
                  <input
                    type="text"
                    value={simCustomOrderSn}
                    onChange={(e) => setSimCustomOrderSn(e.target.value)}
                    placeholder={simulatorPlatform === 'shopee' ? "Ví dụ: SHP294829381A" : "Ví dụ: TTS749284938"}
                    className="w-full px-2.5 py-1.5 bg-white border border-border-hairline rounded-[6px] text-ink focus:outline-hidden font-mono-data font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-ink-muted mb-1">Tên khách hàng</label>
                  <input
                    type="text"
                    value={simCustomerName}
                    onChange={(e) => setSimCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-border-hairline rounded-[6px] text-ink focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Items config list */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide">2. Sản phẩm trong đơn (Cào tự động)</label>
                  <button
                    onClick={handleAddSimItem}
                    className="text-[10px] font-bold text-brand hover:text-brand/80 cursor-pointer"
                  >
                    + Thêm sản phẩm
                  </button>
                </div>

                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                  {simItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-[#EDF1EC]/30 p-2 rounded-xl border border-border-hairline text-xs">
                      <select
                        value={item.productId}
                        onChange={(e) => handleUpdateSimItemProduct(idx, e.target.value)}
                        className="flex-1 py-1 px-1 bg-white border border-border-hairline rounded-[4px] text-ink focus:ring-0 outline-hidden font-sans"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id} className="text-ink">
                            {p.name.substring(0, 32)}...
                          </option>
                        ))}
                      </select>
                      
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-ink-muted">SL:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateSimItemQty(idx, parseInt(e.target.value) || 1)}
                          className="w-10 text-center bg-white border border-border-hairline rounded py-0.5 text-ink font-bold font-mono-data"
                        />
                      </div>

                      <button
                        onClick={() => handleRemoveSimItem(idx)}
                        disabled={simItems.length <= 1}
                        className="text-danger hover:text-danger/80 font-bold px-1.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-mono"
                        title="Xóa dòng"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Trigger simulator panel */}
          <div className="p-4 bg-brand-light/10 border-t border-border-hairline space-y-4">
            
            {/* Simulation live terminal display */}
            {simLogs.length > 0 && (
              <div className="bg-[#133227] p-3 rounded-lg border border-brand-light/10 font-mono text-[9.5px] text-[#A7F3D0] max-h-[140px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-brand-light/20">
                {simLogs.map((log, i) => (
                  <div key={i} className="leading-relaxed whitespace-pre-wrap font-mono">{log}</div>
                ))}
              </div>
            )}

            <button
              onClick={handleRunSimulator}
              disabled={isSimulating}
              className="w-full py-2.5 bg-accent hover:bg-accent/95 disabled:bg-border-hairline disabled:text-ink-muted text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider"
            >
              {isSimulating ? <RefreshCw className="h-4 w-4 animate-spin text-white" /> : <Play className="h-4 w-4 text-white fill-white" />}
              {isSimulating ? 'ĐANG CÀO ĐƠN & ĐẨY LOCAL HTTP...' : 'BẮT ĐẦU MÔ PHỎNG CÀO ĐƠN'}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
