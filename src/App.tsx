import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Order, Transaction, Partner, StockInRecord, StockOutRecord } from './types';
import { INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_TRANSACTIONS } from './data';
import POSView from './components/POSView';
import InventoryView from './components/InventoryView';
import WarehouseView from './components/WarehouseView';
import LedgerView from './components/LedgerView';
import ShippingView from './components/ShippingView';
import ReportView from './components/ReportView';
import ExtensionView from './components/ExtensionView';

const INITIAL_PARTNERS: Partner[] = [
  { id: 'part-001', name: 'NPP Sữa Vinamilk Trường Giang', type: 'supplier', phone: '0903334455', address: '110 Nguyễn Kiệm, Gò Vấp, TP. HCM', debt: 8500000, debtLimit: 20000000, dueDate: '2026-07-20', deliverySchedule: 'Thứ 2, Thứ 5' },
  { id: 'part-002', name: 'NPP Bia Tiger & Heineken Sài Gòn', type: 'supplier', phone: '0914221199', address: '48 Song Hành, Quận 12, TP. HCM', debt: 15000000, debtLimit: 30000000, dueDate: '2026-07-05', deliverySchedule: 'Thứ 3, Thứ 7' },
  { id: 'part-003', name: 'Tổng kho gia vị Đại Hưng', type: 'supplier', phone: '0988554422', address: '34 Hoàng Diệu, TP. Thủ Đức', debt: 0, debtLimit: 10000000, dueDate: '2026-08-01', deliverySchedule: 'Hàng ngày' },
  { id: 'part-004', name: 'Đại lý tạp hóa Hoàng Nam', type: 'customer', phone: '0977223344', address: '29 Tố Hữu, Quận Nam Từ Liêm, Hà Nội', debt: 3400000, debtLimit: 5000000, dueDate: '2026-07-15' },
  { id: 'part-005', name: 'Chị Mai - Đại lý Gò Vấp', type: 'customer', phone: '0905556677', address: '120 Phan Văn Trị, Gò Vấp, TP. HCM', debt: 1200000, debtLimit: 2000000, dueDate: '2026-07-01' },
  { id: 'part-006', name: 'Anh Tuấn - Khách sỉ Cafe Q3', type: 'customer', phone: '0912123456', address: '88 Cao Thắng, Quận 3, TP. HCM', debt: 600000, debtLimit: 1000000, dueDate: '2026-07-10' }
];


// Icons
import {
  Store,
  Layers,
  BookOpen,
  Truck,
  BarChart3,
  Bell,
  Terminal,
  RefreshCw,
  Clock,
  CheckCircle,
  TrendingDown,
  Volume2,
  X,
  Sparkles,
  Puzzle,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Camera,
  Image,
  Calendar,
  DollarSign,
  AlertCircle,
  Plus,
  Coins,
  Upload,
  Package
} from 'lucide-react';

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('taphoa_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('taphoa_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('taphoa_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [partners, setPartners] = useState<Partner[]>(() => {
    const saved = localStorage.getItem('taphoa_partners');
    return saved ? JSON.parse(saved) : INITIAL_PARTNERS;
  });

  const [stockInRecords, setStockInRecords] = useState<StockInRecord[]>(() => {
    const saved = localStorage.getItem('taphoa_stock_in_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [stockOutRecords, setStockOutRecords] = useState<StockOutRecord[]>(() => {
    const saved = localStorage.getItem('taphoa_stock_out_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [isQuickTxModalOpen, setIsQuickTxModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'warehouse' | 'ledger' | 'shipping' | 'reports' | 'extension'>('pos');
  const [isRealTimeSyncActive, setIsRealTimeSyncActive] = useState(true);
  
  // Real-time operations logging tray
  const [logMessages, setLogMessages] = useState<{ id: string; text: string; time: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);
  const [isLogTrayExpanded, setIsLogTrayExpanded] = useState(false);


  // Push notifications
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; platform: 'shopee' | 'tiktok' | 'system'; time: string; read: boolean }[]>([
    {
      id: 'notif-1',
      title: 'Đơn hàng mới Shopee',
      message: 'Đơn hàng mới #SHP294829381A từ Nguyễn Văn Hùng đã được tải tự động.',
      platform: 'shopee',
      time: '10:15',
      read: false
    },
    {
      id: 'notif-2',
      title: 'Cảnh báo: Sắp hết hàng',
      message: 'Sản phẩm "Nước mắm Nam Ngư" chỉ còn 3 chai trong kho.',
      platform: 'system',
      time: '12:00',
      read: false
    }
  ]);
  const [isNotificationTrayOpen, setIsNotificationTrayOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<{ id: string; title: string; message: string; platform: 'shopee' | 'tiktok' | 'system' } | null>(null);

  // Auto-save state changes to localStorage
  useEffect(() => {
    localStorage.setItem('taphoa_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('taphoa_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('taphoa_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('taphoa_partners', JSON.stringify(partners));
  }, [partners]);

  useEffect(() => {
    localStorage.setItem('taphoa_stock_in_records', JSON.stringify(stockInRecords));
  }, [stockInRecords]);

  useEffect(() => {
    localStorage.setItem('taphoa_stock_out_records', JSON.stringify(stockOutRecords));
  }, [stockOutRecords]);


  // Quick cashflow transaction state
  const [quickTxType, setQuickTxType] = useState<'thu' | 'chi'>('chi');
  const [quickTxAmount, setQuickTxAmount] = useState('');
  const [quickTxCategory, setQuickTxCategory] = useState('Chi mua đồ vặt/gia dụng');
  const [quickTxPaymentMethod, setQuickTxPaymentMethod] = useState('Tiền mặt');
  const [quickTxDescription, setQuickTxDescription] = useState('');
  const [quickTxPartnerId, setQuickTxPartnerId] = useState('');
  const [quickTxReceiptImage, setQuickTxReceiptImage] = useState('');
  const [quickTxIsEstimated, setQuickTxIsEstimated] = useState(false);

  // Auto set category when type changes
  useEffect(() => {
    if (quickTxType === 'thu') {
      setQuickTxCategory('Doanh thu bán lẻ');
    } else {
      setQuickTxCategory('Chi mua đồ vặt/gia dụng');
    }
    setQuickTxPartnerId('');
    setQuickTxReceiptImage('');
  }, [quickTxType]);

  // Log messages handler
  const addLogMessage = useCallback((text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const nowStr = new Date().toTimeString().split(' ')[0];
    const newLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      text,
      time: nowStr,
      type
    };
    setLogMessages(prev => [newLog, ...prev].slice(0, 50)); // limit to 50 logs
    console.log(`[SYS-LOG] ${nowStr} [${type.toUpperCase()}] ${text}`);
  }, []);

  // Trigger push notification toaster (Thông báo đẩy)
  const triggerPushNotification = useCallback((title: string, message: string, platform: 'shopee' | 'tiktok' | 'system') => {
    const nowStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
    const newNotif = {
      id: 'notif-' + Math.random().toString(36).substr(2, 9),
      title,
      message,
      platform,
      time: nowStr,
      read: false
    };

    setNotifications(prev => [newNotif, ...prev]);
    setActiveToast({ id: newNotif.id, title, message, platform });

    // Web audio synthesis mock/click feedback
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5 note
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio context block by browser security is expected
    }

    // Auto dismiss toast after 4 seconds
    setTimeout(() => {
      setActiveToast(prev => prev?.id === newNotif.id ? null : prev);
    }, 4500);
  }, []);

  // Quick transaction creator
  const handleCreateQuickTx = () => {
    const amt = parseFloat(quickTxAmount);
    if (!amt || amt <= 0) {
      addLogMessage('[Lỗi] Số tiền ghi nhanh không hợp lệ!', 'error');
      return;
    }

    const partner = partners.find(p => p.id === quickTxPartnerId);
    let desc = quickTxDescription.trim();
    if (!desc) {
      desc = partner 
        ? `${quickTxType === 'thu' ? 'Thu nợ từ' : 'Trả nợ cho'} ${partner.name} - ${quickTxCategory}`
        : quickTxCategory;
    }

    const nowStr = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const newTx: Transaction = {
      id: 'tx-quick-' + Date.now(),
      type: quickTxType,
      category: quickTxCategory,
      amount: amt,
      date: nowStr,
      description: desc,
      paymentMethod: quickTxPaymentMethod,
      receiptImage: quickTxReceiptImage || undefined,
      isEstimated: quickTxIsEstimated
    };

    setTransactions(prev => [newTx, ...prev]);

    // Adjust debt if partner is involved
    if (quickTxPartnerId) {
      setPartners(prev => prev.map(p => {
        if (p.id === quickTxPartnerId) {
          // Adjust partner debt. Since they repaid or we repaid, debt reduces by amount
          const adjustedDebt = Math.max(0, p.debt - amt);
          addLogMessage(`[Ghi nhanh] Đã cập nhật công nợ của ${p.name}: ${p.debt.toLocaleString()}đ ➔ ${adjustedDebt.toLocaleString()}đ`, 'success');
          return { ...p, debt: adjustedDebt };
        }
        return p;
      }));
    }

    addLogMessage(`[Ghi nhanh] Đã tạo phiếu ${quickTxType === 'thu' ? 'THU' : 'CHI'} khẩn cấp: ${amt.toLocaleString()}đ - ${desc}`, 'success');
    triggerPushNotification(
      `Ghi sổ thành công!`,
      `Đã thêm phiếu ${quickTxType === 'thu' ? 'Thu' : 'Chi'} ${amt.toLocaleString()}đ vào sổ quỹ tự động.`,
      'system'
    );

    // Reset Form
    setQuickTxAmount('');
    setQuickTxDescription('');
    setQuickTxPartnerId('');
    setQuickTxReceiptImage('');
    setQuickTxIsEstimated(false);
    setIsQuickTxModalOpen(false);
  };

  // Seed initial log messages
  useEffect(() => {
    addLogMessage('Hệ thống POS Tạp hóa khởi động thành công.', 'success');
    addLogMessage('Đã kết nối cơ sở dữ liệu kho nội bộ.', 'success');
    addLogMessage('Kết nối Shopee API: Trạng thái LIVE [Hàng đợi hoạt động]', 'info');
    addLogMessage('Kết nối TikTok Shop API: Trạng thái LIVE [Hàng đợi hoạt động]', 'info');
    addLogMessage('Chrome Extension Listener: Đang lắng nghe cổng 3000...', 'success');
  }, [addLogMessage]);

  // Polling scraped orders from Chrome Extension queue in Express Server
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollScrapedOrders = async () => {
      try {
        const response = await fetch('/api/scraped-orders');
        if (!response.ok) return;
        const data = await response.json();
        
        if (data && data.success && data.orders && data.orders.length > 0) {
          for (const extOrder of data.orders) {
            // Check if already processed to prevent loop
            const isAlreadyProcessed = orders.some(o => o.orderSn === extOrder.orderSn);
            if (isAlreadyProcessed) {
              // Tell server to remove it from queue as we already processed it
              await fetch('/api/scraped-orders/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderSn: extOrder.orderSn })
              });
              continue;
            }

            addLogMessage(`[Chrome Extension] Nhận đơn mới ${extOrder.orderSn} (${extOrder.platform.toUpperCase()}) được cào tự động!`, 'warning');

            let updatedProductsList = [...products];
            let matchLogDetails: string[] = [];

            for (const item of extOrder.items) {
              // Find matching product in stock (by SKU first, then by name substring)
              const pIdx = updatedProductsList.findIndex(p => 
                p.sku.toLowerCase() === item.sku.toLowerCase() || 
                p.name.toLowerCase().includes(item.name.toLowerCase())
              );

              if (pIdx !== -1) {
                const targetProduct = updatedProductsList[pIdx];
                const deductQty = item.quantity;
                const newStock = Math.max(0, targetProduct.stock - deductQty);
                
                // Adjust platform stocks
                const updatedShopee = extOrder.platform === 'shopee' ? Math.max(0, targetProduct.shopeeStock - deductQty) : targetProduct.shopeeStock;
                const updatedTiktok = extOrder.platform === 'tiktok' ? Math.max(0, targetProduct.tiktokStock - deductQty) : targetProduct.tiktokStock;

                updatedProductsList[pIdx] = {
                  ...targetProduct,
                  stock: newStock,
                  shopeeStock: updatedShopee,
                  tiktokStock: updatedTiktok
                };

                matchLogDetails.push(`${targetProduct.name} (Tồn ${targetProduct.stock} ➔ ${newStock} ${targetProduct.unit})`);
              } else {
                matchLogDetails.push(`Sản phẩm lạ [SKU: ${item.sku || 'N/A'}] (Không khớp kho)`);
              }
            }

            // Update state
            setProducts(updatedProductsList);

            matchLogDetails.forEach(detail => {
              addLogMessage(`  ↳ Khấu trừ kho: ${detail}`, 'success');
            });

            // Append to orders
            const newOrder: Order = {
              id: extOrder.id || `ord-scraped-${extOrder.platform}-${Date.now()}`,
              platform: extOrder.platform,
              orderSn: extOrder.orderSn,
              customerName: extOrder.customerName || 'Khách hàng TMĐT',
              phone: extOrder.phone || 'Ẩn bảo mật',
              address: extOrder.address || 'Giao nhận tự động theo sàn TMĐT',
              items: extOrder.items.map(it => ({
                sku: it.sku || 'UNKNOWN',
                name: it.name,
                quantity: it.quantity,
                price: it.price
              })),
              totalAmount: extOrder.totalAmount,
              status: 'pending',
              createdAt: extOrder.createdAt || new Date().toISOString(),
              carrier: extOrder.carrier || (extOrder.platform === 'shopee' ? 'GHTK' : 'GHN'),
              trackingNumber: extOrder.trackingNumber || '',
              shippingSteps: [
                { status: 'Tạo đơn hàng', time: new Date().toISOString().substring(0, 16).replace('T', ' '), desc: 'Đồng bộ từ trình duyệt qua Chrome Extension.' },
                { status: 'Chuẩn bị hàng', time: '', desc: 'Chờ shipper bưu cục vận chuyển liên kết sàn tới lấy hàng.' }
              ],
              currentStepIndex: 0
            };

            setOrders(prev => [newOrder, ...prev]);

            // Append ledger record
            const newTx: Transaction = {
              id: `tx-scraped-${Date.now()}`,
              type: 'thu',
              category: 'Doanh thu bán hàng',
              amount: extOrder.totalAmount,
              date: new Date().toISOString().substring(0, 19).replace('T', ' '),
              description: `Đồng bộ đơn hàng tự động ${extOrder.platform.toUpperCase()} [${extOrder.orderSn}]`,
              paymentMethod: extOrder.platform === 'shopee' ? 'ShopeePay' : 'Chuyển khoản QR'
            };
            setTransactions(prev => [newTx, ...prev]);

            // Toast alert & sound
            triggerPushNotification(
              `Đơn hàng ${extOrder.platform === 'shopee' ? 'Shopee' : 'TikTok Shop'} mới!`,
              `Khách hàng ${newOrder.customerName} đặt #${extOrder.orderSn} trị giá ${extOrder.totalAmount.toLocaleString()}đ đã đồng bộ & trừ kho!`,
              extOrder.platform
            );

            // Clean up queue for this orderSn
            await fetch('/api/scraped-orders/clear', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderSn: extOrder.orderSn })
            });
          }
        }
      } catch (err) {
        // silent catch for local network failures
      }
    };

    if (isRealTimeSyncActive) {
      intervalId = setInterval(pollScrapedOrders, 3000);
      pollScrapedOrders();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRealTimeSyncActive, products, orders, triggerPushNotification, addLogMessage]);

  // Unread notifications counter
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    addLogMessage('[Thông báo] Đã đánh dấu đọc toàn bộ thông báo đẩy.', 'info');
  };

  // Low stock counter for status bar
  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock <= p.minStock).length;
  }, [products]);

  return (
    <div className="min-h-screen bg-bg-main text-ink font-sans flex flex-col relative pb-12 antialiased">
      
      {/* GLOBAL FLOATING TOAST (Thông báo đẩy góc màn hình) */}
      {activeToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-surface-card text-ink rounded-[12px] shadow-2xl border border-border-hairline p-4 animate-in slide-in-from-top-10 duration-200 flex gap-3">
          <div className="shrink-0 pt-0.5">
            {activeToast.platform === 'shopee' ? (
              <span className="text-xl" role="img" aria-label="Shopee">🍊</span>
            ) : activeToast.platform === 'tiktok' ? (
              <span className="text-xl" role="img" aria-label="TikTok">🖤</span>
            ) : (
              <Sparkles className="h-5 w-5 text-brand" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-ink flex items-center justify-between">
              {activeToast.title}
              <span className="text-[9px] bg-brand-light text-brand px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                Mới
              </span>
            </h4>
            <p className="text-[11px] text-ink-muted mt-1 leading-snug">{activeToast.message}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-ink-muted hover:text-ink shrink-0 self-start p-1 hover:bg-brand-light rounded-[6px]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* HEADER SECTION (Thanh tiêu đề ứng dụng) */}
      <header className="bg-brand border-b border-brand-light/10 px-5 py-3 sticky top-0 z-40 shrink-0 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
        
        {/* Left branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center font-black shadow-md shrink-0 animate-pulse">
            <Store className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white flex items-center gap-2 tracking-tight uppercase">
              SỔ BÁN HÀNG TẠP HÓA
              <span className="text-[9px] bg-accent/20 text-accent border border-accent/30 font-bold px-2 py-0.5 rounded-[6px] uppercase tracking-wider">
                PRO
              </span>
            </h1>
            <p className="text-[10.5px] text-brand-light/80 font-medium flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Bán lẻ POS & Sổ cái kế toán tự động đồng bộ Shopee & TikTok
            </p>
          </div>
        </div>

        {/* Right operations overview */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
          
          {/* Channel Health Icons */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-brand-light/10 border border-brand-light/20 rounded-[8px] text-[10px] font-bold text-brand-light">
            <span className="flex items-center gap-1.5 border-r border-brand-light/20 pr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Shopee API
            </span>
            <span className="flex items-center gap-1.5 border-r border-brand-light/20 pr-2 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> TikTok API
            </span>
            <span className="flex items-center gap-1.5 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent"></span> Quỹ Két POS
            </span>
          </div>

          {/* Low Stock Warning Counter pill */}
          {lowStockCount > 0 && (
            <div
              onClick={() => setActiveTab('inventory')}
              className="cursor-pointer px-3 py-1.5 bg-danger-light text-danger border border-danger/20 rounded-[8px] text-[10px] font-bold flex items-center gap-1.5 hover:bg-danger/20 transition-colors"
              title={`${lowStockCount} sản phẩm sắp hết hàng!`}
            >
              <TrendingDown className="h-3.5 w-3.5 animate-bounce" />
              Tồn tối thiểu: <strong>{lowStockCount}</strong>
            </div>
          )}

          {/* Push Notification tray toggle button */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationTrayOpen(!isNotificationTrayOpen)}
              className="p-2 bg-brand-light/10 text-brand-light hover:text-white hover:bg-brand-light/20 border border-brand-light/20 rounded-[8px] transition-all relative shrink-0 cursor-pointer"
              title="Thông báo đẩy trạng thái đơn"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-danger text-white font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification sliding drawer */}
            {isNotificationTrayOpen && (
              <div className="absolute right-0 mt-2.5 w-80 bg-surface-card rounded-[12px] shadow-xl border border-border-hairline z-50 overflow-hidden py-1 text-ink">
                <div className="p-3 bg-brand-light/20 border-b border-border-hairline flex justify-between items-center text-xs text-brand font-bold">
                  <span>Thông báo đẩy hệ thống</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-accent hover:text-accent/85 text-[10px] font-bold cursor-pointer"
                    >
                      Đọc tất cả
                    </button>
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto divide-y divide-border-hairline text-xs">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-ink-muted">Không có thông báo mới</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3 transition-colors ${
                          notif.read ? 'bg-surface-card opacity-60' : 'bg-brand-light/30 border-l-2 border-brand font-semibold text-ink'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-ink text-xs">{notif.title}</span>
                          <span className="text-[9px] text-ink-muted font-mono shrink-0">{notif.time}</span>
                        </div>
                        <p className="text-[10.5px] text-ink-muted mt-0.5 leading-snug">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Current Local Time Clock Widget */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-brand-light/10 border border-brand-light/20 rounded-[8px] text-[10.5px] text-brand-light font-mono font-bold shrink-0">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span>06/07/2026 19:40 UTC+7</span>
          </div>

        </div>
      </header>

      {/* CORE NAVIGATION TABS (Bộ lọc chuyển phân hệ) */}
      <nav className="bg-surface-card border-b border-border-hairline py-2 px-5 shrink-0 flex gap-1.5 overflow-x-auto scrollbar-none sticky top-[65px] md:top-[65px] z-30 shadow-xs">
        {[
          { id: 'pos', name: 'Màn hình Bán POS', icon: Store },
          { id: 'inventory', name: 'Danh mục bách hóa', icon: Layers },
          { id: 'warehouse', name: 'Nhập / Xuất Kho', icon: Package },
          { id: 'ledger', name: 'Sổ sách Thu Chi', icon: BookOpen },
          { id: 'shipping', name: 'Sổ Bán Hàng & Giao Vận', icon: Truck },
          { id: 'reports', name: 'Báo cáo Tài chính', icon: BarChart3 },
          { id: 'extension', name: 'Chrome Extension', icon: Puzzle }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                addLogMessage(`[Điều hướng] Chuyển hướng sang phân hệ: ${tab.name}`, 'info');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[12px] font-bold text-xs whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-brand text-white border border-brand/20 shadow-xs'
                  : 'text-ink-muted hover:text-brand hover:bg-brand-light border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.name}
            </button>
          );
        })}
      </nav>

      {/* MAIN VIEWPORT (Vùng nội dung xử lý của phân hệ) */}
      <main className="flex-1 p-5 max-w-7xl w-full mx-auto pb-24">
        
        {/* Render appropriate view based on active state */}
        <div className="transition-all duration-200">
          {activeTab === 'pos' && (
            <POSView
              products={products}
              setProducts={setProducts}
              transactions={transactions}
              setTransactions={setTransactions}
              partners={partners}
              setPartners={setPartners}
              addLogMessage={addLogMessage}
              isRealTimeSyncActive={isRealTimeSyncActive}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={products}
              setProducts={setProducts}
              addLogMessage={addLogMessage}
              isRealTimeSyncActive={isRealTimeSyncActive}
              setIsRealTimeSyncActive={setIsRealTimeSyncActive}
            />
          )}

          {activeTab === 'warehouse' && (
            <WarehouseView
              products={products}
              setProducts={setProducts}
              addLogMessage={addLogMessage}
              isRealTimeSyncActive={isRealTimeSyncActive}
              partners={partners}
              setPartners={setPartners}
              stockInRecords={stockInRecords}
              setStockInRecords={setStockInRecords}
              stockOutRecords={stockOutRecords}
              setStockOutRecords={setStockOutRecords}
              transactions={transactions}
              setTransactions={setTransactions}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerView
              transactions={transactions}
              setTransactions={setTransactions}
              partners={partners}
              setPartners={setPartners}
              addLogMessage={addLogMessage}
              products={products}
              stockInRecords={stockInRecords}
              stockOutRecords={stockOutRecords}
              orders={orders}
            />
          )}


          {activeTab === 'shipping' && (
            <ShippingView
              orders={orders}
              setOrders={setOrders}
              products={products}
              setProducts={setProducts}
              transactions={transactions}
              setTransactions={setTransactions}
              addLogMessage={addLogMessage}
              triggerPushNotification={triggerPushNotification}
            />
          )}

          {activeTab === 'reports' && (
            <ReportView
              transactions={transactions}
              products={products}
              addLogMessage={addLogMessage}
            />
          )}

          {activeTab === 'extension' && (
            <ExtensionView
              products={products}
              addLogMessage={addLogMessage}
            />
          )}
        </div>

      </main>

      {/* FOOTER: REAL-TIME OPERATION API HANDSHAKE LOGS TERMINAL (Nhật ký bắt tay API) */}
      <footer className="fixed bottom-0 inset-x-0 bg-brand text-white border-t border-brand-light/10 z-45">
        
        {/* Toggle header drawer bar */}
        <div
          onClick={() => setIsLogTrayExpanded(!isLogTrayExpanded)}
          className="bg-brand hover:bg-brand/90 px-4 py-2 flex justify-between items-center cursor-pointer text-[10.5px] select-none transition-colors border-b border-brand-light/10"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-accent animate-spin-slow" />
            <span className="font-bold tracking-wider font-mono">NHẬT KÝ ĐỒNG BỘ API & HOẠT ĐỘNG HỆ THỐNG</span>
            <span className="text-[9px] bg-brand-light text-brand px-1.5 py-0.2 rounded font-mono font-bold uppercase">
              {logMessages[0]?.time || 'Sẵn sàng'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-brand-light/60 italic font-mono">Bán lẻ POS đồng bộ Shopee & TikTok tự động</span>
            <span className="text-white font-bold">{isLogTrayExpanded ? '▼ Thu nhỏ' : '▲ Mở rộng log'}</span>
          </div>
        </div>

        {/* Console line streams */}
        {isLogTrayExpanded && (
          <div className="p-4 h-40 overflow-y-auto bg-[#133227] font-mono text-[10px] space-y-1.5 border-t border-brand-light/10 scrollbar-thin scrollbar-thumb-brand-light/20">
            {logMessages.length === 0 ? (
              <span className="text-brand-light/50">Chưa có bản ghi hoạt động nào.</span>
            ) : (
              logMessages.map((log) => (
                <div key={log.id} className="flex gap-2.5 items-start">
                  <span className="text-brand-light/40 shrink-0 select-none">[{log.time}]</span>
                  <span className={`shrink-0 select-none font-bold font-mono ${
                    log.type === 'success' ? 'text-emerald-400' :
                    log.type === 'warning' ? 'text-amber-400' :
                    log.type === 'error' ? 'text-red-400' : 'text-sky-400'
                  }`}>
                    [{log.type.toUpperCase()}]
                  </span>
                  <span className={`font-mono-data ${
                    log.type === 'success' ? 'text-emerald-200' :
                    log.type === 'warning' ? 'text-amber-200' :
                    log.type === 'error' ? 'text-red-300' : 'text-slate-200'
                  }`}>
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

      </footer>

      {/* FLOATING FAB: GHI NHANH THU/CHI TOÀN CỤC Ở MỌI TAB */}
      <button
        onClick={() => setIsQuickTxModalOpen(!isQuickTxModalOpen)}
        className="fixed bottom-16 right-6 z-50 bg-accent hover:bg-accent/90 text-white font-bold p-3.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-2 cursor-pointer group border border-white/10"
        title="Ghi nhanh một giao dịch thu/chi khẩn cấp (Không sợ quên ghi sổ!)"
      >
        <Coins className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300 text-white" />
        <span className="max-w-x overflow-hidden transition-all duration-300 ease-out whitespace-nowrap text-xs font-black tracking-wide uppercase block">
          Ghi nhanh Thu/Chi (±)
        </span>
      </button>

      {/* QUICK CASHFLOW ENTRY MODAL (Popup ghi sổ siêu tốc thiết kế kiểu Sổ Tay Sổ Cái) */}
      {isQuickTxModalOpen && (
        <div className="fixed bottom-32 right-6 z-50 w-[380px] sm:w-[440px] bg-[#FBF8F0] shadow-2xl rounded-r-[12px] rounded-l-none border-y border-r border-[#D8DED6] border-l-[3px] border-l-brand text-[#26302B] p-5 flex flex-col max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom-10 duration-200">
          
          {/* 3 binder rings/holes mimicking notebook spiral binder */}
          <div className="absolute left-1.5 inset-y-0 flex flex-col justify-around py-8 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-brand/15 border border-brand/20 shadow-inner"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-brand/15 border border-brand/20 shadow-inner"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-brand/15 border border-brand/20 shadow-inner"></div>
          </div>

          <div className="pl-4">
            {/* Header */}
            <div className="pb-3 border-b border-[#D8DED6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-brand-light text-brand rounded-[6px]">
                  <Coins className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-[#26302B] uppercase tracking-wider">Sổ Ghi Nhanh Két Quỹ</h3>
                  <p className="text-[10px] text-[#5F6B62] mt-0.5">Tiền lặt nhắt ghi ngay để không lệch sổ</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickTxModalOpen(false)}
                className="p-1 hover:bg-brand-light text-[#5F6B62] hover:text-[#26302B] rounded-[6px] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 pt-3 text-xs">
              
              {/* Type selector (Thu/Chi) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setQuickTxType('thu')}
                  className={`py-2 rounded-[8px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    quickTxType === 'thu'
                      ? 'bg-brand text-white border-brand shadow-xs font-black'
                      : 'bg-white border-[#D8DED6] text-[#5F6B62] hover:bg-brand-light hover:text-brand'
                  }`}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  THU TIỀN VÀO (+)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTxType('chi')}
                  className={`py-2 rounded-[8px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    quickTxType === 'chi'
                      ? 'bg-danger text-white border-danger shadow-xs font-black'
                      : 'bg-white border-[#D8DED6] text-[#5F6B62] hover:bg-danger-light-brand hover:text-danger'
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  CHI TIỀN RA (-)
                </button>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-[#5F6B62]">Số tiền giao dịch (VND)</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Nhập số tiền..."
                    value={quickTxAmount}
                    onChange={(e) => setQuickTxAmount(e.target.value)}
                    className="w-full bg-white border border-[#D8DED6] text-[#26302B] px-3 py-2 rounded-[8px] text-base font-mono-data font-black focus:outline-hidden focus:border-brand"
                    autoFocus
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-[10px] text-[#5F6B62] font-mono-data">VND</span>
                </div>

                {/* Quick addition clicker pad */}
                <div className="grid grid-cols-6 gap-1 pt-1">
                  {[10000, 20000, 50000, 100000, 200000, 500000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(quickTxAmount) || 0;
                        setQuickTxAmount(String(cur + val));
                      }}
                      className="py-1 bg-white hover:bg-brand-light border border-[#D8DED6] rounded-[6px] text-[9.5px] font-bold font-mono text-[#5F6B62] hover:text-brand transition-all cursor-pointer"
                    >
                      +{(val/1000)}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Category / Lý do Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-bold text-[#5F6B62]">Lý do / Danh mục thu chi</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {quickTxType === 'chi' ? (
                    <>
                      {[
                        'Chi mua đồ vặt/gia dụng',
                        'Trả nợ nhà cung cấp',
                        'Trả tiền ship/vận chuyển',
                        'Rút tiền tiêu cá nhân',
                        'Chi tiền điện/nước/mạng',
                        'Khác'
                      ].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setQuickTxCategory(cat)}
                          className={`px-2 py-1.5 rounded-[6px] border text-[10px] font-bold text-left transition-all truncate cursor-pointer ${
                            quickTxCategory === cat
                              ? 'bg-danger-light-brand border-danger text-danger'
                              : 'bg-white border-[#D8DED6] text-[#5F6B62] hover:bg-brand-light'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {[
                        'Doanh thu bán lẻ',
                        'Khách trả nợ',
                        'Thu hồi tiền tạm ứng',
                        'Vốn chủ quán nạp két',
                        'Khác'
                      ].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setQuickTxCategory(cat)}
                          className={`px-2 py-1.5 rounded-[6px] border text-[10px] font-bold text-left transition-all truncate cursor-pointer ${
                            quickTxCategory === cat
                              ? 'bg-brand-light border-brand text-brand'
                              : 'bg-white border-[#D8DED6] text-[#5F6B62] hover:bg-brand-light'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Conditional Partner selector */}
              {(quickTxCategory === 'Trả nợ nhà cung cấp' || quickTxCategory === 'Khách trả nợ') && (
                <div className="p-3 bg-white border border-[#D8DED6] rounded-[8px] space-y-2 animate-in slide-in-from-top-2 duration-150">
                  <label className="block text-[10.5px] font-bold text-[#5F6B62] flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-brand" />
                    Chọn đối tác để tự động gạch nợ (-)
                  </label>
                  <select
                    value={quickTxPartnerId}
                    onChange={(e) => setQuickTxPartnerId(e.target.value)}
                    className="w-full bg-[#EDF1EC]/30 border border-[#D8DED6] text-[#26302B] px-2.5 py-1.5 rounded-[6px] text-xs focus:outline-hidden"
                  >
                    <option value="">-- Chọn khách hàng / Nhà cung cấp --</option>
                    {partners
                      .filter(p => quickTxCategory === 'Trả nợ nhà cung cấp' ? p.type === 'supplier' : p.type === 'customer')
                      .map(p => (
                        <option key={p.id} value={p.id} className="text-[#26302B]">
                          {p.name} (Nợ: {p.debt.toLocaleString()}đ)
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              {/* Payment Method & Estimated option */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-[#5F6B62]">Nguồn quỹ</label>
                  <select
                    value={quickTxPaymentMethod}
                    onChange={(e) => setQuickTxPaymentMethod(e.target.value)}
                    className="w-full bg-white border border-[#D8DED6] text-[#26302B] px-2.5 py-1.5 rounded-[6px] text-xs cursor-pointer focus:outline-hidden"
                  >
                    <option value="Tiền mặt">Tiền mặt (Két thu ngân)</option>
                    <option value="Chuyển khoản QR">Chuyển khoản QR</option>
                    <option value="MoMo">Ví MoMo & Khác</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-[#5F6B62]">Trạng thái số</label>
                  <div className="flex items-center h-[30px]">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[#5F6B62]">
                      <input
                        type="checkbox"
                        checked={quickTxIsEstimated}
                        onChange={(e) => setQuickTxIsEstimated(e.target.checked)}
                        className="rounded border-[#D8DED6] text-brand focus:ring-0"
                      />
                      Số tạm tính (sửa sau)
                    </label>
                  </div>
                </div>
              </div>

              {/* Description & Receipt capture */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-[#5F6B62]">Chi tiết / Nội dung ghi nhớ</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: mua sắm bột giặt, trả ship,..."
                    value={quickTxDescription}
                    onChange={(e) => setQuickTxDescription(e.target.value)}
                    className="w-full bg-white border border-[#D8DED6] text-[#26302B] px-3 py-1.5 rounded-[6px] text-xs focus:outline-hidden"
                  />
                </div>

                {/* Photo receipt capture */}
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-[#5F6B62]">Biên lai hóa đơn đính kèm</label>
                  <div className="flex items-center gap-2">
                    {quickTxReceiptImage ? (
                      <div className="relative shrink-0 w-12 h-12 bg-white border border-[#D8DED6] rounded-[6px] overflow-hidden flex items-center justify-center">
                        <img src={quickTxReceiptImage} alt="receipt" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setQuickTxReceiptImage('')}
                          className="absolute -top-1 -right-1 bg-danger hover:bg-danger/80 text-white rounded-full p-0.5 shadow-xs"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="shrink-0 w-12 h-12 bg-white border border-[#D8DED6] rounded-[6px] flex items-center justify-center text-[#5F6B62]">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}

                    <div className="flex-1 flex gap-1.5">
                      <label className="flex-1 bg-white hover:bg-brand-light border border-[#D8DED6] rounded-[6px] p-2 text-center text-[10px] text-[#5F6B62] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs">
                        <Upload className="h-3.5 w-3.5 text-[#5F6B62]" />
                        Chọn file...
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setQuickTxReceiptImage(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const canvas = document.createElement('canvas');
                          canvas.width = 150;
                          canvas.height = 150;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.fillStyle = quickTxType === 'thu' ? '#1F4D3D' : '#B5432E';
                            ctx.fillRect(0, 0, 150, 150);
                            ctx.fillStyle = '#ffffff';
                            ctx.font = 'bold 12px monospace';
                            ctx.fillText('BIEN LAI', 15, 30);
                            ctx.font = 'bold 14px monospace';
                            ctx.fillText('QUY TAP HOA', 15, 55);
                            ctx.font = '10px monospace';
                            ctx.fillText(`+${(parseFloat(quickTxAmount)||0).toLocaleString()}đ`, 15, 80);
                            ctx.fillText('ĐÃ THANH TOÁN', 15, 105);
                            ctx.strokeStyle = '#ffffff';
                            ctx.beginPath();
                            ctx.moveTo(10, 120);
                            ctx.lineTo(140, 120);
                            ctx.stroke();
                            setQuickTxReceiptImage(canvas.toDataURL());
                            addLogMessage('[Ghi nhanh] Đã cào ảnh biên lai mô phỏng thành công!', 'info');
                          }
                        }}
                        className="bg-white hover:bg-brand-light border border-[#D8DED6] rounded-[6px] p-2 text-[10px] text-[#5F6B62] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5 text-[#5F6B62]" />
                        Chụp mẫu
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="pt-4 mt-3 border-t border-[#D8DED6] flex items-center justify-between">
              <span className="text-[9.5px] text-[#5F6B62] font-medium font-mono-data">Ghi tự động, không lo quên</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickTxModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-[#D8DED6] text-[#5F6B62] hover:bg-brand-light rounded-[6px] text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleCreateQuickTx}
                  className="px-4 py-1.5 rounded-[6px] text-xs font-black tracking-wide text-white transition-all cursor-pointer shadow-sm bg-accent hover:bg-accent/90"
                >
                  ✓ Chốt Ghi Sổ
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
