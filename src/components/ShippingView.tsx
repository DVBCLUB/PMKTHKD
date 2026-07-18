import React, { useState, useMemo } from 'react';
import { Order, CarrierConfig, Product, Transaction } from '../types';
import { CARRIERS } from '../data';
import { 
  Printer, 
  MapPin, 
  Truck, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  Navigation, 
  Send, 
  Radio, 
  Search, 
  XCircle, 
  DollarSign, 
  RotateCcw, 
  Eye, 
  Trash2,
  Calendar,
  Filter,
  ArrowRight,
  User,
  Phone,
  Building,
  Download
} from 'lucide-react';

interface ShippingViewProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  addLogMessage: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  triggerPushNotification: (title: string, message: string, platform: 'shopee' | 'tiktok' | 'system') => void;
}

export default function ShippingView({
  orders,
  setOrders,
  products,
  setProducts,
  transactions,
  setTransactions,
  addLogMessage,
  triggerPushNotification
}: ShippingViewProps) {
  // Tabs for Shipping module
  const [activeSubTab, setActiveSubTab] = useState<'sales-ledger' | 'carriers'>('sales-ledger');
  
  // Selection / Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'shopee' | 'tiktok' | 'offline'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'shipping' | 'delivered' | 'cancelled'>('all');
  
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<Order | null>(
    orders.find(o => o.status === 'shipping') || orders[0] || null
  );
  
  const [isBatchPrintingOpen, setIsBatchPrintingOpen] = useState(false);
  const [carrierList, setCarrierList] = useState<CarrierConfig[]>(CARRIERS);
  
  // Detail modal state for KiotViet detailed examination
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // --- KPI Metrics according to Sapo and KiotViet ---
  const orderStats = useMemo(() => {
    let revenue = 0;
    let completed = 0;
    let shipping = 0;
    let cancelled = 0;

    orders.forEach(o => {
      if (o.status !== 'cancelled') {
        revenue += o.totalAmount;
      }
      if (o.status === 'delivered') completed++;
      else if (o.status === 'shipping') shipping++;
      else if (o.status === 'cancelled') cancelled++;
    });

    const cancellationRate = orders.length > 0 ? (cancelled / orders.length) * 100 : 0;

    return {
      totalRevenue: revenue,
      completedCount: completed,
      shippingCount: shipping,
      cancelledCount: cancelled,
      cancellationRate: cancellationRate
    };
  }, [orders]);

  // Filtered orders for Sổ Bán Hàng
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = 
        o.orderSn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.phone && o.phone.includes(searchTerm));
      const matchPlatform = platformFilter === 'all' || o.platform === platformFilter;
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;

      return matchSearch && matchPlatform && matchStatus;
    });
  }, [orders, searchTerm, platformFilter, statusFilter]);

  // Filter pending orders ready for packaging
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'pending');
  }, [orders]);

  // Handle individual checkbox change
  const handleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Handle select all pending orders
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(pendingOrders.map(o => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  // Xuất file CSV Sổ Bán Hàng (Dữ liệu đơn hàng bán ra)
  const exportSalesToCSV = () => {
    if (filteredOrders.length === 0) {
      addLogMessage('[Bán hàng] Không có dữ liệu đơn hàng trong kỳ lọc để xuất báo cáo!', 'warning');
      return;
    }
    
    const headers = 'Mã Đơn Hàng,Kênh bán,Tên khách hàng,Số điện thoại,Tổng tiền hàng,Trạng thái đơn,Ngày tạo\n';
    const rows = filteredOrders.map((o) => {
      const platformStr = o.platform === 'shopee' ? 'Shopee' : o.platform === 'tiktok' ? 'TikTok' : 'Bán tại quầy';
      const statusStr = o.status === 'pending' ? 'Chờ xử lý' : o.status === 'shipping' ? 'Đang giao' : o.status === 'delivered' ? 'Đã hoàn thành' : 'Đã hủy';
      return `"${o.orderSn}","${platformStr}","${o.customerName}","${o.phone || ''}",${o.totalAmount},"${statusStr}","${o.createdAt}"`;
    }).join('\n');
    
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_ban_hang_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addLogMessage('[Bán hàng] Đã kết xuất & xuất file Excel/CSV Sổ bán hàng chi tiết thành công!', 'success');
  };

  // Handle Batch print trigger
  const handleBatchPrint = () => {
    if (selectedOrderIds.length === 0) {
      addLogMessage('[Vận chuyển] Chưa chọn đơn hàng nào để in hàng loạt!', 'warning');
      return;
    }
    setIsBatchPrintingOpen(true);
    addLogMessage(`[In ấn] Đang chuẩn bị mẫu in nhiệt hàng loạt cho ${selectedOrderIds.length} đơn hàng...`, 'info');
  };

  // Complete Batch Printing
  const handleConfirmBatchPrint = () => {
    setOrders(prevOrders => {
      return prevOrders.map(o => {
        if (selectedOrderIds.includes(o.id)) {
          const trackingNo = o.trackingNumber || `${o.carrier}${Math.floor(10000000 + Math.random() * 90000000)}`;
          
          setTimeout(() => {
            triggerPushNotification(
              `Đơn hàng #${o.orderSn} đang đi giao`,
              `Đơn vị ${o.carrier} đã nhận hàng đóng gói và bắt đầu vận chuyển bưu kiện tới ${o.customerName}.`,
              o.platform as 'shopee' | 'tiktok'
            );
          }, 2000);

          return {
            ...o,
            status: 'shipping',
            trackingNumber: trackingNo,
            currentStepIndex: 2, // "Giao cho đơn vị vận chuyển"
            shippingSteps: o.shippingSteps.map((step, idx) => {
              if (idx === 2) {
                return { ...step, time: new Date().toISOString().substring(0, 16).replace('T', ' '), completed: true };
              }
              return step;
            })
          };
        }
        return o;
      });
    });

    addLogMessage(`[Đóng gói] Đã in hàng loạt thành công ${selectedOrderIds.length} phiếu giao hàng! Trạng thái chuyển sang "Đang giao".`, 'success');
    setIsBatchPrintingOpen(false);
    setSelectedOrderIds([]);
  };

  // Webhook status push updates simulation
  const handleSimulateWebhookUpdate = (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    if (targetOrder.status === 'delivered') {
      addLogMessage('[Mô phỏng] Đơn hàng này đã giao thành công rồi, không thể cập nhật thêm!', 'info');
      return;
    }
    if (targetOrder.status === 'cancelled') {
      addLogMessage('[Mô phỏng] Đơn hàng đã bị hủy bỏ, không thể chuyển trạng thái vận chuyển!', 'warning');
      return;
    }

    setOrders(prevOrders => {
      return prevOrders.map(o => {
        if (o.id === orderId) {
          if (o.status === 'pending') {
            triggerPushNotification(
              `API: Shipper đã nhận đơn ${o.orderSn}`,
              `Bưu tá ${o.carrier} đang tiến hành lấy hàng tại quầy tạp hóa.`,
              o.platform as 'shopee' | 'tiktok'
            );
            addLogMessage(`[Mô phỏng API] Shipper ${o.carrier} đã tới lấy hàng thành công cho đơn ${o.orderSn}`, 'success');
            return {
              ...o,
              status: 'shipping',
              currentStepIndex: 2
            };
          } else if (o.status === 'shipping') {
            triggerPushNotification(
              `Đơn hàng #${o.orderSn} Đã giao thành công`,
              `Khách hàng ${o.customerName} đã thanh toán & ký nhận bưu kiện từ ${o.carrier}.`,
              o.platform as 'shopee' | 'tiktok'
            );
            addLogMessage(`[Mô phỏng API] Đơn hàng ${o.orderSn} đã được shipper cập nhật trạng thái "Giao thành công" lên hệ thống.`, 'success');
            
            return {
              ...o,
              status: 'delivered',
              currentStepIndex: o.shippingSteps.length - 1
            };
          }
        }
        return o;
      });
    });

    setTimeout(() => {
      const refreshed = orders.find(o => o.id === orderId);
      if (refreshed) setActiveTrackingOrder(refreshed);
    }, 100);
  };

  // Toggle API direct connection for carrier
  const toggleCarrierApi = (carrierId: string) => {
    setCarrierList(prev =>
      prev.map(c => {
        if (c.id === carrierId) {
          const newState = !c.apiConnected;
          addLogMessage(
            newState
              ? `[Vận chuyển] Đã kích hoạt API kết nối trực tiếp với bưu cục ${c.name}. Bắt đầu đồng bộ nhãn vận đơn thời gian thực!`
              : `[Vận chuyển] Đã ngắt kết nối API trực tiếp với ${c.name}.`,
            newState ? 'success' : 'warning'
          );
          return { ...c, apiConnected: newState };
        }
        return c;
      })
    );
  };

  // --- KiotViet & Sapo Enhancement: Hủy đơn & Trả hàng hoàn kho ---
  const handleCancelAndRefundOrder = (order: Order) => {
    if (order.status === 'cancelled') {
      addLogMessage('[Hệ thống] Đơn hàng này vốn dĩ đã bị hủy rồi!', 'info');
      return;
    }

    const confirmCancel = window.confirm(
      `Bạn có chắc chắn muốn HỦY ĐƠN HÀNG #${order.orderSn}?\n` +
      `Lưu ý: Hệ thống Sapo/KiotViet sẽ tự động CỘNG HOÀN SỐ LƯỢNG SẢN PHẨM vào kho hàng thực tế & kho Shopee/TikTok, đồng thời tạo chứng từ hạch toán giảm trừ doanh thu.`
    );

    if (!confirmCancel) return;

    // 1. Update Order Status
    setOrders(prevOrders => {
      return prevOrders.map(o => {
        if (o.id === order.id) {
          return {
            ...o,
            status: 'cancelled',
            shippingSteps: [
              ...o.shippingSteps,
              { status: 'Hủy đơn hoàn kho', time: new Date().toISOString().substring(0, 16).replace('T', ' '), desc: 'Chủ cửa hàng đã thao tác Hủy đơn & Hoàn trả tồn kho tự động.' }
            ],
            currentStepIndex: o.shippingSteps.length
          };
        }
        return o;
      });
    });

    // 2. Add quantities back into product stocks (Physical and Platform stocks)
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const orderItem = order.items.find(item => item.sku === prod.sku);
        if (orderItem) {
          const refundQty = orderItem.quantity;
          const newActualStock = prod.stock + refundQty;
          
          // Determine if we need to return platform specific stock
          const isShopee = order.platform === 'shopee';
          const isTiktok = order.platform === 'tiktok';

          return {
            ...prod,
            stock: newActualStock,
            shopeeStock: isShopee ? prod.shopeeStock + refundQty : prod.shopeeStock,
            tiktokStock: isTiktok ? prod.tiktokStock + refundQty : prod.tiktokStock
          };
        }
        return prod;
      });
    });

    // 3. Append cancellation cashflow / reduction voucher into the Ledger (Transactions)
    const refundTx: Transaction = {
      id: `tx-refund-${Date.now()}`,
      type: 'chi', // Treated as payout/reduction
      category: 'Chi phí khác',
      amount: order.totalAmount,
      date: new Date().toISOString().substring(0, 19).replace('T', ' '),
      description: `[Đơn hủy/Trả hàng] Hoàn trả tiền đơn hàng ${order.platform.toUpperCase()} #${order.orderSn} cho ${order.customerName}`,
      paymentMethod: order.platform === 'shopee' ? 'ShopeePay' : order.platform === 'tiktok' ? 'Chuyển khoản QR' : 'Tiền mặt'
    };

    setTransactions(prev => [refundTx, ...prev]);

    // Logs & alert
    addLogMessage(`[Sổ Bán Hàng] HỦY THÀNH CÔNG ĐƠN #${order.orderSn}. Đã tự động cộng hoàn sản phẩm vào kho & lập phiếu chi giảm trừ doanh thu (${order.totalAmount.toLocaleString()}đ).`, 'error');
    
    triggerPushNotification(
      `Đã hủy đơn & hoàn kho #${order.orderSn}`,
      `Đơn của khách ${order.customerName} đã được thu hồi và hoàn trả hàng tồn kho thành công.`,
      'system'
    );

    // Close details
    setSelectedOrderDetail(null);
  };

  return (
    <div id="shipping-view-parent" className="space-y-6">
      
      {/* Visual Navigation Sub-Tabs mimicking Sapo */}
      <div className="flex justify-between items-center bg-slate-900 p-3 rounded-2xl border border-slate-800/80 shadow-md">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('sales-ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'sales-ledger'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Filter className="h-4 w-4" />
            Sổ Bán Hàng & Danh Sách Đơn Hàng
          </button>
          <button
            onClick={() => setActiveSubTab('carriers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'carriers'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Radio className="h-4 w-4" />
            Cấu hình Giao vận & Đối tác VC
          </button>
        </div>
        <span className="text-[10px] bg-slate-950 text-indigo-400 border border-slate-850 px-2.5 py-1 rounded-md font-bold font-mono">
          SAPO & KIOTVIET CONNECT
        </span>
      </div>

      {activeSubTab === 'sales-ledger' ? (
        <div className="space-y-6">
          
          {/* Sapo-style Order Analytics Banner */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Doanh thu đơn</span>
              <span className="text-lg font-black text-indigo-400 font-mono mt-1.5">
                {orderStats.totalRevenue.toLocaleString()}đ
              </span>
              <span className="text-[9px] text-slate-500 mt-1">Không tính đơn đã hủy</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đơn thành công</span>
              <span className="text-lg font-black text-emerald-400 font-mono mt-1.5">
                {orderStats.completedCount} đơn
              </span>
              <span className="text-[9px] text-emerald-600/60 mt-1">✓ Đã giao tận tay</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đang vận chuyển</span>
              <span className="text-lg font-black text-amber-400 font-mono mt-1.5">
                {orderStats.shippingCount} đơn
              </span>
              <span className="text-[9px] text-amber-600/60 mt-1">🚚 Shipper đang giao</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Số đơn đã hủy</span>
              <span className="text-lg font-black text-red-400 font-mono mt-1.5">
                {orderStats.cancelledCount} đơn
              </span>
              <span className="text-[9px] text-red-600/60 mt-1">✕ Trả hàng / Huỷ bỏ</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tỷ lệ hủy đơn</span>
              <span className="text-lg font-black text-slate-200 font-mono mt-1.5">
                {orderStats.cancellationRate.toFixed(1)}%
              </span>
              <span className="text-[9px] text-slate-500 mt-1">Chỉ số rủi ro vận đơn</span>
            </div>

          </div>

          {/* Sổ Bán Hàng Advanced Controls & Order List Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT: Main order book sheet with filters (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Complex filters */}
              <div className="bg-slate-900 p-4 border border-slate-800/80 rounded-2xl shadow-lg space-y-3">
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Tìm theo mã đơn, khách hàng, số điện thoại..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs w-full focus:ring-1 focus:ring-indigo-500 focus:outline-hidden text-slate-100 placeholder-slate-500"
                    />
                  </div>
                  
                  {/* Platform Selector */}
                  <select
                    value={platformFilter}
                    onChange={(e: any) => setPlatformFilter(e.target.value)}
                    className="px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:outline-hidden text-slate-300 font-medium cursor-pointer"
                  >
                    <option value="all">Kênh bán: Tất cả</option>
                    <option value="offline">Tại quầy (POS)</option>
                    <option value="shopee">Sàn Shopee</option>
                    <option value="tiktok">TikTok Shop</option>
                  </select>

                  {/* Status Selector */}
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:outline-hidden text-slate-300 font-medium cursor-pointer"
                  >
                    <option value="all">Trạng thái: Tất cả</option>
                    <option value="pending">Chờ đóng gói (Mới)</option>
                    <option value="shipping">Đang đi giao</option>
                    <option value="delivered">Đã giao thành công</option>
                    <option value="cancelled">Đã hủy / Trả hàng</option>
                  </select>

                  <button
                    onClick={exportSalesToCSV}
                    className="px-3 py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg font-bold text-xs hover:bg-slate-700 shadow-md flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Xuất file báo cáo Sổ bán hàng / danh sách đơn hàng sang CSV"
                  >
                    <Download className="h-4 w-4" />
                    Xuất Excel Đơn
                  </button>
                </div>

                {/* Batch packing section if there are checkboxes checked */}
                {selectedOrderIds.length > 0 && (
                  <div className="bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/40 flex items-center justify-between animate-fade-in">
                    <span className="text-[11px] text-indigo-300 font-bold">
                      📦 Đang chọn <strong className="font-mono text-slate-100 text-xs">{selectedOrderIds.length}</strong> đơn hàng mới chờ đóng gói
                    </span>
                    <button
                      onClick={handleBatchPrint}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      In vận đơn loạt
                    </button>
                  </div>
                )}
              </div>

              {/* Order sheet ledger list table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/40 border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3 text-center w-8">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.length === pendingOrders.length && pendingOrders.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3">Mã đơn / Kênh</th>
                        <th className="py-3 px-3">Khách hàng / SĐT</th>
                        <th className="py-3 px-3">Sản phẩm đặt</th>
                        <th className="py-3 px-3 text-right">Tổng tiền</th>
                        <th className="py-3 px-3 text-center">Trạng thái</th>
                        <th className="py-3 px-3 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {filteredOrders.map((o) => {
                        const isSelected = selectedOrderIds.includes(o.id);
                        
                        return (
                          <tr 
                            key={o.id} 
                            className={`hover:bg-slate-850/30 transition-colors ${
                              isSelected ? 'bg-indigo-950/15' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center">
                              {o.status === 'pending' ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectOrder(o.id)}
                                  className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                />
                              ) : (
                                <span className="text-slate-700 font-bold select-none">-</span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex flex-col space-y-0.5">
                                <span className="font-bold text-indigo-300 font-mono">{o.orderSn}</span>
                                <span className={`inline-flex w-fit text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  o.platform === 'shopee' ? 'bg-orange-950/30 text-orange-400 border border-orange-900/20' :
                                  o.platform === 'tiktok' ? 'bg-slate-950 text-slate-300 border border-slate-800' :
                                  'bg-emerald-950/30 text-emerald-400 border border-emerald-900/20'
                                }`}>
                                  {o.platform === 'shopee' ? 'Shopee' : o.platform === 'tiktok' ? 'TikTok' : 'Tại quầy POS'}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-200">{o.customerName}</span>
                                <span className="text-slate-500 font-mono text-[10px]">{o.phone || 'Không có'}</span>
                              </div>
                            </td>

                            <td className="py-3 px-3 max-w-[180px] truncate">
                              {o.items.map((it, idx) => (
                                <div key={idx} className="text-slate-400 truncate text-[10.5px]">
                                  • {it.name} <span className="text-indigo-400">x{it.quantity}</span>
                                </div>
                              ))}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-100 text-[12px]">
                              {o.totalAmount.toLocaleString()}đ
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border ${
                                o.status === 'delivered' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' :
                                o.status === 'shipping' ? 'bg-amber-950/40 text-amber-400 border-amber-900/30' :
                                o.status === 'cancelled' ? 'bg-red-950/40 text-red-400 border-red-900/30' :
                                'bg-slate-950 border border-slate-800 text-slate-400'
                              }`}>
                                {o.status === 'pending' ? 'Chờ chuẩn bị' : o.status === 'shipping' ? 'Đang giao' : o.status === 'delivered' ? 'Giao thành công' : 'Đã hủy'}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setSelectedOrderDetail(o)}
                                  className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
                                  title="Chi tiết đơn hàng Sapo"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                
                                {o.status !== 'cancelled' && (
                                  <button
                                    onClick={() => handleCancelAndRefundOrder(o)}
                                    className="p-1 text-red-500 hover:text-red-400 hover:bg-slate-850 rounded transition-colors"
                                    title="Hủy đơn hoàn kho"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredOrders.length === 0 && (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="h-10 w-10 text-slate-600 stroke-1" />
                    <p className="text-xs">Không tìm thấy đơn hàng nào khớp với điều kiện lọc.</p>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT: Live Delivery Route Tracking (4 cols) */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg flex flex-col overflow-hidden max-h-[580px]">
              
              <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex flex-col space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-indigo-400" />
                  <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Hành trình giao hàng</h3>
                </div>
                
                {/* Select active tracking order */}
                <select
                  value={activeTrackingOrder?.id || ''}
                  onChange={(e) => {
                    const found = orders.find(o => o.id === e.target.value);
                    if (found) setActiveTrackingOrder(found);
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="" disabled className="bg-slate-950">-- Chọn đơn kiểm tra --</option>
                  {orders.filter(o => o.status !== 'cancelled').map((o) => (
                    <option key={o.id} value={o.id} className="bg-slate-950 font-mono">
                      [{o.platform.toUpperCase()}] {o.customerName} - {o.orderSn}
                    </option>
                  ))}
                </select>
              </div>

              {activeTrackingOrder ? (
                <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 space-y-4">
                  <div className="space-y-3.5">
                    
                    {/* Carrier Info card */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-[11px] space-y-1">
                      <div className="flex justify-between font-bold text-slate-300">
                        <span>Đơn vị: {activeTrackingOrder.carrier}</span>
                        <span className="text-indigo-400 font-mono">{activeTrackingOrder.trackingNumber || 'CHƯA IN VẬN ĐƠN'}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug">
                        Giao tới: <strong className="text-slate-400">{activeTrackingOrder.address}</strong>
                      </p>
                    </div>

                    {/* Timeline flow */}
                    <div className="relative pl-4 border-l border-indigo-900/40 ml-1.5 space-y-4 text-[11px]">
                      {activeTrackingOrder.shippingSteps.map((step, idx) => {
                        const isCompleted = idx <= activeTrackingOrder.currentStepIndex;
                        const isCurrent = idx === activeTrackingOrder.currentStepIndex;

                        return (
                          <div key={idx} className="relative">
                            <span className={`absolute -left-[20.5px] top-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black border transition-all ${
                              isCurrent ? 'bg-indigo-600 border-indigo-500 animate-pulse ring-4 ring-indigo-950/60' :
                              isCompleted ? 'bg-indigo-950 text-indigo-400 border-indigo-900/50' :
                              'bg-slate-950 text-slate-600 border-slate-850'
                            }`}>
                              ✓
                            </span>
                            <div className="pl-1">
                              <div className="flex justify-between items-baseline">
                                <h4 className={`font-bold ${isCurrent ? 'text-indigo-400' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                                  {step.status}
                                </h4>
                                {step.time && <span className="text-[8px] font-mono text-slate-500">{step.time}</span>}
                              </div>
                              <p className={`text-[10px] mt-0.5 leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>

                  {/* Simulator action hooks */}
                  {activeTrackingOrder.status !== 'cancelled' && activeTrackingOrder.status !== 'delivered' && (
                    <div className="pt-3 border-t border-slate-850">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Mô phỏng shipper (Webhook API)</span>
                      <button
                        onClick={() => handleSimulateWebhookUpdate(activeTrackingOrder.id)}
                        className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Cập nhật lộ trình vận chuyển
                      </button>
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-10 text-center text-slate-600 flex flex-col items-center justify-center space-y-1.5 flex-1">
                  <Truck className="h-8 w-8 stroke-1 text-slate-700" />
                  <p className="text-xs">Không có vận đơn hoạt động để xem lộ trình.</p>
                </div>
              )}

            </div>

          </div>

        </div>
      ) : (
        /* Carrier Settings Sub-Tab */
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-200">Liên kết Đơn vị Giao Vận (3PL Carriers API)</h3>
            <p className="text-xs text-slate-400">
              Hãy cấu hình bật/tắt API bưu cục. Khi API bật, nhãn nhiệt in ra sẽ chứa mã vạch đồng bộ thời gian thực theo chuẩn Sapo/KiotViet.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            {carrierList.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  c.apiConnected
                    ? 'bg-indigo-950/20 border-indigo-900/30 text-indigo-300'
                    : 'bg-slate-950 border-slate-850 opacity-60 text-slate-500'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl" role="img" aria-label={c.name}>{c.logo}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                      c.apiConnected
                        ? 'bg-indigo-600/25 text-indigo-400 border border-indigo-500/20'
                        : 'bg-slate-900 text-slate-500'
                    }`}>
                      {c.apiConnected ? 'Đồng bộ' : 'Ngắt kết nối'}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-100 mt-3">{c.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Cước nền: {c.baseFee.toLocaleString()}đ</p>
                  <p className="text-[10px] text-slate-500">Dự kiến: {c.estimatedDays}</p>
                </div>

                <button
                  onClick={() => toggleCarrierApi(c.id)}
                  className={`mt-4 w-full py-1.5 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                    c.apiConnected
                      ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/10'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {c.apiConnected ? 'Ngắt API' : 'Kết nối API'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- DETAIL MODAL MIMICKING SAPO DETAILED EXAMINATION --- */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in duration-150">
            
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="font-bold text-xs text-slate-200">
                  CHI TIẾT VÀ IN HÓA ĐƠN: #{selectedOrderDetail.orderSn}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="text-slate-400 hover:text-slate-200 font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content info */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
              
              {/* Customer Metadata Block */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs text-slate-300">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-500 block text-[10px] uppercase">THÔNG TIN KHÁCH HÀNG</span>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="font-bold text-slate-200">{selectedOrderDetail.customerName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Phone className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{selectedOrderDetail.phone}</span>
                  </div>
                </div>
                <div className="space-y-1.5 border-l border-slate-850 pl-3">
                  <span className="font-bold text-slate-500 block text-[10px] uppercase">ĐỊA CHỈ NHẬN HÀNG</span>
                  <p className="leading-relaxed text-[11px] text-slate-400">
                    {selectedOrderDetail.address}
                  </p>
                </div>
              </div>

              {/* Items Block */}
              <div className="space-y-2">
                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">Danh sách mặt hàng</span>
                <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-850 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Sản phẩm</th>
                        <th className="py-2.5 px-3 text-center">SL</th>
                        <th className="py-2.5 px-3 text-right">Đơn giá</th>
                        <th className="py-2.5 px-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {selectedOrderDetail.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-200">{it.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">SKU: {it.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono text-indigo-400">
                            x{it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {it.price.toLocaleString()}đ
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                            {(it.price * it.quantity).toLocaleString()}đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Aggregation Summary */}
              <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <div className="text-xs">
                  <span className="text-slate-500 font-bold block uppercase text-[9px]">Tổng cộng đối soát</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Hình thức: <strong className="text-slate-300">{selectedOrderDetail.platform === 'shopee' ? 'Ví ShopeePay' : selectedOrderDetail.platform === 'tiktok' ? 'QR Code' : 'Tiền mặt'}</strong></span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {selectedOrderDetail.totalAmount.toLocaleString()}đ
                  </span>
                </div>
              </div>

            </div>

            {/* Footer containing specific actions */}
            <div className="p-4 bg-slate-950 border-t border-slate-850 flex gap-3">
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="flex-1 py-2 text-center border border-slate-850 bg-slate-900 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Đóng lại
              </button>
              
              {selectedOrderDetail.status !== 'cancelled' && (
                <button
                  onClick={() => handleCancelAndRefundOrder(selectedOrderDetail)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  Hủy đơn & Hoàn kho
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL: BATCH THERMAL SHEET (In nhãn máy nhiệt) */}
      {isBatchPrintingOpen && (
        <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[85vh]">
            
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-200">
                  In nhãn giao nhận nhiệt loạt (A6 Paper Format)
                </h3>
              </div>
              <span className="text-xs bg-indigo-950/50 text-indigo-400 border border-indigo-900/30 px-2.5 py-0.5 rounded-full font-bold font-mono">
                {selectedOrderIds.length} NHÃN IN
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-950/50 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
              {selectedOrderIds.map((orderId) => {
                const order = orders.find(o => o.id === orderId);
                if (!order) return null;

                return (
                  <div
                    key={order.id}
                    className="bg-white border-2 border-gray-300 p-4 rounded-lg shadow-md max-w-md mx-auto flex flex-col space-y-3.5 text-[10px] text-gray-700 font-sans relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2 bg-emerald-100/50 border border-emerald-200/50 px-2 py-1 rounded text-[9px] font-black uppercase text-emerald-800/70 tracking-widest">
                      {order.carrier}
                    </div>

                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="font-black text-xs text-gray-900 uppercase">
                        {order.platform === 'shopee' ? '🍊 SHOPEE EXPRESS' : '🖤 TIKTOK SHOP DELIV'}
                      </span>
                      <span className="font-mono font-bold text-gray-500">Mã đơn: {order.orderSn}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-2">
                      <div className="space-y-1">
                        <span className="font-bold text-gray-400 block text-[8px] uppercase">Người gửi:</span>
                        <span className="font-bold block text-gray-800">TẠP HÓA GIA ĐÌNH - POS</span>
                        <p className="text-[9px] text-gray-500 leading-tight">45 Đường số 9, Quận Gò Vấp, TP. HCM</p>
                      </div>
                      <div className="space-y-1 border-l border-gray-100 pl-3">
                        <span className="font-bold text-gray-400 block text-[8px] uppercase">Người nhận:</span>
                        <span className="font-bold block text-gray-800">{order.customerName}</span>
                        <span className="font-mono text-gray-500 block">{order.phone}</span>
                        <p className="text-[9px] text-gray-500 leading-tight">{order.address}</p>
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-gray-400 block text-[8px] uppercase mb-1">Mục nhặt hàng đóng gói:</span>
                      <div className="bg-gray-50 p-2 rounded-md space-y-1">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between font-medium">
                            <span className="text-gray-800">• {it.name}</span>
                            <span className="font-mono text-emerald-800 font-bold">x{it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-gray-200 flex flex-col items-center space-y-1.5">
                      <div className="h-10 w-full bg-gray-900 flex justify-between px-3 items-stretch opacity-90">
                        {Array.from({ length: 42 }).map((_, b) => (
                          <div
                            key={b}
                            className="bg-white"
                            style={{
                              width: b % 3 === 0 ? '1px' : b % 4 === 0 ? '3px' : '2px',
                            }}
                          ></div>
                        ))}
                      </div>
                      <span className="font-mono text-[10px] font-bold text-gray-900 tracking-wider">
                        *{order.carrier}-{order.trackingNumber || 'PENDING'}*
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-850 flex gap-3">
              <button
                onClick={() => setIsBatchPrintingOpen(false)}
                className="flex-1 py-2 text-center border border-slate-800 bg-slate-900 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmBatchPrint}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Xác nhận In & Bàn giao Shipper
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
