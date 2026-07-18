import React, { useState, useMemo } from 'react';
import { Product, Partner, StockInRecord, StockOutRecord, Transaction } from '../types';
import { 
  Search, 
  AlertTriangle, 
  Plus, 
  Minus, 
  TrendingDown, 
  TrendingUp,
  Layers, 
  Eye, 
  Calendar, 
  Clipboard, 
  Upload, 
  Camera, 
  Clock, 
  Check, 
  X, 
  FileText, 
  Truck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Image as ImageIcon,
  DollarSign
} from 'lucide-react';

interface WarehouseViewProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addLogMessage: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  isRealTimeSyncActive: boolean;
  partners: Partner[];
  setPartners: React.Dispatch<React.SetStateAction<Partner[]>>;
  stockInRecords: StockInRecord[];
  setStockInRecords: React.Dispatch<React.SetStateAction<StockInRecord[]>>;
  stockOutRecords: StockOutRecord[];
  setStockOutRecords: React.Dispatch<React.SetStateAction<StockOutRecord[]>>;
  transactions?: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

export default function WarehouseView({
  products,
  setProducts,
  addLogMessage,
  isRealTimeSyncActive,
  partners,
  setPartners,
  stockInRecords,
  setStockInRecords,
  stockOutRecords = [],
  setStockOutRecords = () => {},
  transactions = [],
  setTransactions
}: WarehouseViewProps) {
  // Tabs & filters
  const [historyTab, setHistoryTab] = useState<'in' | 'out'>('in');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState('all');

  // Modal controls
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Form states: Stock-In
  const [stockInSupplierId, setStockInSupplierId] = useState('');
  const [stockInProductId, setStockInProductId] = useState('');
  const [stockInQty, setStockInQty] = useState('');
  const [stockInCost, setStockInCost] = useState('');
  const [stockInPaymentMethod, setStockInPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản QR' | 'Ghi nợ (Mua chịu)'>('Tiền mặt');
  const [stockInReceiptImage, setStockInReceiptImage] = useState('');
  const [stockInIsEstimated, setStockInIsEstimated] = useState(false);
  const [stockInNotes, setStockInNotes] = useState('');

  // Form states: Stock-Out
  const [stockOutSearchTerm, setStockOutSearchTerm] = useState('');
  const [stockOutProductId, setStockOutProductId] = useState('');
  const [stockOutQty, setStockOutQty] = useState('');
  const [stockOutReason, setStockOutReason] = useState<'Bán lẻ vãng lai' | 'Hao hụt / Hỏng hóc' | 'Tiêu dùng nội bộ' | 'Trả hàng nhà cung cấp' | 'Khác'>('Bán lẻ vãng lai');
  const [stockOutPrice, setStockOutPrice] = useState('');
  const [recordRevenue, setRecordRevenue] = useState(true);
  const [stockOutPaymentMethod, setStockOutPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản QR'>('Tiền mặt');
  const [stockOutNotes, setStockOutNotes] = useState('');

  // Supplier delivery schedules
  const deliverySuppliers = useMemo(() => {
    return partners.filter(p => p.type === 'supplier' && p.deliverySchedule);
  }, [partners]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalInVal = stockInRecords.reduce((sum, r) => sum + r.quantity * r.costPrice, 0);
    const totalInQty = stockInRecords.reduce((sum, r) => sum + r.quantity, 0);
    const totalOutVal = stockOutRecords.reduce((sum, r) => sum + r.quantity * r.sellingPrice, 0);
    const totalOutQty = stockOutRecords.reduce((sum, r) => sum + r.quantity, 0);

    return {
      totalInVal,
      totalInQty,
      totalOutVal,
      totalOutQty
    };
  }, [stockInRecords, stockOutRecords]);

  // Save Stock-In Record
  const handleSaveStockIn = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(stockInQty);
    const costPrice = parseFloat(stockInCost);
    if (!stockInProductId || !qty || qty <= 0) {
      addLogMessage('[Lỗi] Vui lòng nhập đầy đủ sản phẩm và số lượng hợp lệ!', 'error');
      return;
    }

    const selectedProduct = products.find(p => p.id === stockInProductId);
    const selectedSupplier = partners.find(p => p.id === stockInSupplierId);

    if (!selectedProduct) return;

    const finalCost = costPrice > 0 ? costPrice : selectedProduct.cost;
    
    // 1. Update product quantity and cost
    setProducts(prev => prev.map(p => {
      if (p.id === selectedProduct.id) {
        const updatedStock = p.stock + qty;
        const shopeeS = isRealTimeSyncActive ? updatedStock : p.shopeeStock;
        const tiktokS = isRealTimeSyncActive ? updatedStock : p.tiktokStock;
        
        if (isRealTimeSyncActive) {
          setTimeout(() => {
            addLogMessage(`[Real-time API] Đã đồng bộ kho mới SP "${p.name}" lên Shopee & TikTok shop (+${qty} chiếc)`, 'info');
          }, 800);
        }

        return {
          ...p,
          stock: updatedStock,
          cost: finalCost,
          shopeeStock: shopeeS,
          tiktokStock: tiktokS
        };
      }
      return p;
    }));

    // 2. Adjust Supplier Debt if we owe them
    const costTotal = finalCost * qty;
    if (stockInPaymentMethod === 'Ghi nợ (Mua chịu)' && selectedSupplier) {
      setPartners(prev => prev.map(p => {
        if (p.id === selectedSupplier.id) {
          return {
            ...p,
            debt: p.debt + costTotal
          };
        }
        return p;
      }));
      addLogMessage(`[Mua chịu] Đã tăng công nợ NCC ${selectedSupplier.name}: +${costTotal.toLocaleString()}đ`, 'success');
    }

    // 3. Create StockInRecord
    const nowStr = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const newRecord: StockInRecord = {
      id: 'st-in-' + Date.now(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      supplierId: selectedSupplier?.id || undefined,
      supplierName: selectedSupplier?.name || 'NCC vãng lai',
      quantity: qty,
      costPrice: finalCost,
      date: nowStr,
      receiptImage: stockInReceiptImage || undefined,
      isEstimated: stockInIsEstimated,
      notes: stockInNotes.trim() || undefined
    };
    setStockInRecords(prev => [newRecord, ...prev]);

    addLogMessage(`[Nhập hàng] Nhập kho thành công +${qty} ${selectedProduct.unit} "${selectedProduct.name}" từ ${selectedSupplier?.name || 'NCC vãng lai'}`, 'success');

    // Reset Form & Close
    setStockInProductId('');
    setStockInSupplierId('');
    setStockInQty('');
    setStockInCost('');
    setStockInPaymentMethod('Tiền mặt');
    setStockInReceiptImage('');
    setStockInIsEstimated(false);
    setStockInNotes('');
    setIsStockInModalOpen(false);
  };

  // Save Stock-Out Record
  const handleSaveStockOut = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(stockOutQty);
    if (!stockOutProductId || !qty || qty <= 0) {
      addLogMessage('[Lỗi] Vui lòng nhập đầy đủ sản phẩm và số lượng hợp lệ!', 'error');
      return;
    }

    const selectedProduct = products.find(p => p.id === stockOutProductId);
    if (!selectedProduct) return;

    const unitPrice = stockOutPrice ? parseFloat(stockOutPrice) : selectedProduct.price;

    // 1. Update product stock level
    setProducts(prev => prev.map(p => {
      if (p.id === selectedProduct.id) {
        const updatedStock = p.stock - qty;
        const shopeeS = isRealTimeSyncActive ? updatedStock : p.shopeeStock;
        const tiktokS = isRealTimeSyncActive ? updatedStock : p.tiktokStock;
        
        if (isRealTimeSyncActive) {
          setTimeout(() => {
            addLogMessage(`[Real-time API] Đã đồng bộ kho mới SP "${p.name}" lên Shopee & TikTok shop (-${qty} chiếc)`, 'info');
          }, 800);
        }

        return {
          ...p,
          stock: updatedStock,
          shopeeStock: shopeeS,
          tiktokStock: tiktokS
        };
      }
      return p;
    }));

    // 2. Automatically record cash flow if checked
    const revenueTotal = unitPrice * qty;
    if (stockOutReason === 'Bán lẻ vãng lai' && recordRevenue && setTransactions) {
      const nowStr = new Date().toISOString().substring(0, 19).replace('T', ' ');
      const newTx: Transaction = {
        id: 'tx-quick-retail-' + Date.now(),
        type: 'thu',
        category: 'Doanh thu bán lẻ',
        amount: revenueTotal,
        date: nowStr,
        description: `Ghi nhanh bán lẻ: ${qty} ${selectedProduct.unit} "${selectedProduct.name}" (Đơn giá: ${unitPrice.toLocaleString()}đ)`,
        paymentMethod: stockOutPaymentMethod
      };
      setTransactions(prev => [newTx, ...prev]);
      addLogMessage(`[Doanh thu] Đã tự động tạo phiếu thu +${revenueTotal.toLocaleString()}đ vào sổ quỹ`, 'success');
    }

    // 3. Create StockOutRecord
    const nowStr = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const newRecord: StockOutRecord = {
      id: 'st-out-' + Date.now(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: qty,
      sellingPrice: unitPrice,
      reason: stockOutReason,
      date: nowStr,
      notes: stockOutNotes.trim() || undefined,
      isSyncedWithPlatforms: isRealTimeSyncActive
    };
    setStockOutRecords(prev => [newRecord, ...prev]);

    addLogMessage(`[Xuất kho] Xuất kho thành công -${qty} ${selectedProduct.unit} "${selectedProduct.name}". Lý do: ${stockOutReason}`, 'success');

    // Reset Form & Close
    setStockOutProductId('');
    setStockOutQty('');
    setStockOutReason('Bán lẻ vãng lai');
    setStockOutPrice('');
    setRecordRevenue(true);
    setStockOutNotes('');
    setStockOutSearchTerm('');
    setIsStockOutModalOpen(false);
  };

  // Cancel / Undo Stock-Out Record
  const handleCancelStockOut = (record: StockOutRecord) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy phiếu xuất kho sản phẩm "${record.productName}" (Số lượng: -${record.quantity}) không? Tồn kho thực tế và sổ quỹ sẽ được hoàn tác.`)) {
      return;
    }

    // 1. Refund stock back
    setProducts(prev => prev.map(p => {
      if (p.id === record.productId) {
        const updatedStock = p.stock + record.quantity;
        const shopeeS = isRealTimeSyncActive ? updatedStock : p.shopeeStock;
        const tiktokS = isRealTimeSyncActive ? updatedStock : p.tiktokStock;
        
        return {
          ...p,
          stock: updatedStock,
          shopeeStock: shopeeS,
          tiktokStock: tiktokS
        };
      }
      return p;
    }));

    // 2. Remove automatic cash transaction
    if (record.reason === 'Bán lẻ vãng lai' && setTransactions) {
      setTransactions(prev => prev.filter(tx => {
        const match = tx.description.includes(`Ghi nhanh bán lẻ: ${record.quantity}`) && tx.description.includes(record.productName);
        if (match) {
          addLogMessage(`[Sổ quỹ] Đã thu hồi khoản doanh thu bán lẻ tương ứng: -${tx.amount.toLocaleString()}đ`, 'info');
        }
        return !match;
      }));
    }

    // 3. Remove record
    setStockOutRecords(prev => prev.filter(r => r.id !== record.id));
    addLogMessage(`[Xuất kho] Đã hủy phiếu xuất kho "${record.productName}" thành công!`, 'success');
  };

  // Cancel / Undo Stock-In Record
  const handleCancelStockIn = (record: StockInRecord) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy phiếu nhập kho sản phẩm "${record.productName}" (Số lượng: +${record.quantity}) không? Kho hàng và công nợ NCC sẽ được điều chỉnh hoàn trả.`)) {
      return;
    }

    // 1. Deduct stock back
    setProducts(prev => prev.map(p => {
      if (p.id === record.productId) {
        const updatedStock = Math.max(0, p.stock - record.quantity);
        const shopeeS = isRealTimeSyncActive ? updatedStock : p.shopeeStock;
        const tiktokS = isRealTimeSyncActive ? updatedStock : p.tiktokStock;
        
        return {
          ...p,
          stock: updatedStock,
          shopeeStock: shopeeS,
          tiktokStock: tiktokS
        };
      }
      return p;
    }));

    // 2. Deduct supplier debt if any
    if (record.supplierId) {
      const totalCost = record.quantity * record.costPrice;
      setPartners(prev => prev.map(p => {
        if (p.id === record.supplierId) {
          return {
            ...p,
            debt: Math.max(0, p.debt - totalCost)
          };
        }
        return p;
      }));
      addLogMessage(`[Công nợ] Đã giảm trừ dư nợ với nhà cung cấp ${record.supplierName}: -${totalCost.toLocaleString()}đ`, 'info');
    }

    // 3. Remove record
    setStockInRecords(prev => prev.filter(r => r.id !== record.id));
    addLogMessage(`[Nhập kho] Đã hủy phiếu nhập kho "${record.productName}" thành công!`, 'success');
  };

  // Offline Image upload (Base64 converter)
  const handleReceiptImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStockInReceiptImage(reader.result as string);
        addLogMessage('[Nhập kho] Đã tải ảnh biên lai hóa đơn hóa đơn NCC!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtered Stock-In list
  const filteredStockIn = useMemo(() => {
    return stockInRecords.filter(r => {
      const matchSearch = r.productName.toLowerCase().includes(logSearchTerm.toLowerCase()) || 
                          r.supplierName.toLowerCase().includes(logSearchTerm.toLowerCase());
      const matchSupplier = selectedSupplierFilter === 'all' || r.supplierId === selectedSupplierFilter;
      return matchSearch && matchSupplier;
    });
  }, [stockInRecords, logSearchTerm, selectedSupplierFilter]);

  // Filtered Stock-Out list
  const filteredStockOut = useMemo(() => {
    return stockOutRecords.filter(r => {
      const matchSearch = r.productName.toLowerCase().includes(logSearchTerm.toLowerCase()) || 
                          (r.notes && r.notes.toLowerCase().includes(logSearchTerm.toLowerCase()));
      const matchReason = selectedReasonFilter === 'all' || r.reason === selectedReasonFilter;
      return matchSearch && matchReason;
    });
  }, [stockOutRecords, logSearchTerm, selectedReasonFilter]);

  return (
    <div id="warehouse-view-container" className="space-y-5 animate-fade-in">
      
      {/* 1. Header & Quick Actions */}
      <div className="bg-surface-card border border-border-hairline rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand/10 rounded-lg border border-brand/20 text-brand">
              <Truck className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-ink">Bảng Điều Động & Giao Dịch Kho</h3>
          </div>
          <p className="text-xs text-ink-muted max-w-2xl">
            Theo dõi nhật ký điều động, nhập hàng trực tiếp từ nhà cung cấp, hoặc xuất kho thanh lý hỏng hóc, tiêu dùng nội bộ và đối soát biên lai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsStockInModalOpen(true)}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-black rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nhập kho NCC
          </button>
          <button
            type="button"
            onClick={() => setIsStockOutModalOpen(true)}
            className="px-4 py-2 bg-danger hover:bg-danger/95 text-white font-black rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Minus className="h-4 w-4" />
            Xuất kho nhanh
          </button>
        </div>
      </div>

      {/* 2. Statistical Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total imports value */}
        <div className="bg-surface-card border border-border-hairline p-4 rounded-2xl space-y-2 shadow-2xs">
          <div className="flex justify-between items-center text-xs">
            <span className="text-ink-muted font-bold">Tổng Giá Trị Nhập</span>
            <span className="p-1 bg-brand/10 text-brand rounded-lg">
              <ArrowDownLeft className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-black font-mono text-brand">
              {stats.totalInVal.toLocaleString()}đ
            </h4>
            <p className="text-[10px] text-ink-muted">
              Qua <strong>{stockInRecords.length}</strong> đợt nhập hàng hóa
            </p>
          </div>
        </div>

        {/* Total imports quantity */}
        <div className="bg-surface-card border border-border-hairline p-4 rounded-2xl space-y-2 shadow-2xs">
          <div className="flex justify-between items-center text-xs">
            <span className="text-ink-muted font-bold">Tổng Số Lượng Nhập</span>
            <span className="p-1 bg-brand/5 text-ink-muted rounded-lg">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-black font-mono text-ink">
              {stats.totalInQty.toLocaleString()}
            </h4>
            <p className="text-[10px] text-ink-muted">Sản phẩm bách hóa tổng hợp</p>
          </div>
        </div>

        {/* Total quick exports revenue */}
        <div className="bg-surface-card border border-border-hairline p-4 rounded-2xl space-y-2 shadow-2xs">
          <div className="flex justify-between items-center text-xs">
            <span className="text-ink-muted font-bold">Giá Trị Xuất Kho</span>
            <span className="p-1 bg-danger/10 text-danger rounded-lg">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-black font-mono text-danger">
              {stats.totalOutVal.toLocaleString()}đ
            </h4>
            <p className="text-[10px] text-ink-muted">
              Qua <strong>{stockOutRecords.length}</strong> lần xuất kho nhanh
            </p>
          </div>
        </div>

        {/* Total exports quantity */}
        <div className="bg-surface-card border border-border-hairline p-4 rounded-2xl space-y-2 shadow-2xs">
          <div className="flex justify-between items-center text-xs">
            <span className="text-ink-muted font-bold">Tổng Số Lượng Xuất</span>
            <span className="p-1 bg-danger/5 text-danger rounded-lg">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xl font-black font-mono text-danger-dark">
              {stats.totalOutQty.toLocaleString()}
            </h4>
            <p className="text-[10px] text-ink-muted">Mặt hàng ra khỏi kho</p>
          </div>
        </div>

      </div>

      {/* 3. Supplier delivery schedule (Lịch nhắc xe hàng) */}
      {deliverySuppliers.length > 0 && (
        <div className="bg-surface-card border border-border-hairline rounded-2xl p-4.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-ink flex items-center gap-1.5">
              <Calendar className="h-4.5 w-4.5 text-brand" />
              Lịch nhắc giao xe hàng từ Nhà cung cấp (Hàng tuần)
            </h4>
            <span className="text-[10px] text-ink-muted">Chủ tiệm gom tiền mặt chuẩn bị bốc xếp</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {deliverySuppliers.map(s => (
              <div key={'warehouse-delivery-' + s.id} className="p-3 bg-bg-main border border-border-hairline rounded-xl space-y-2 relative overflow-hidden group hover:border-brand/40 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-xs font-bold text-ink group-hover:text-brand transition-colors">{s.name}</h5>
                    <p className="text-[10px] text-ink-muted mt-0.5 font-bold flex items-center gap-1">
                      <Clock className="h-3 w-3 text-brand" />
                      Lịch xe: <strong className="text-brand font-black">{s.deliverySchedule}</strong>
                    </p>
                  </div>
                  <span className="text-[9px] bg-white border border-border-hairline text-ink-muted px-1.5 py-0.5 rounded font-black uppercase">
                    SUPPLIER
                  </span>
                </div>
                
                <div className="pt-2 border-t border-border-hairline/60 flex justify-between items-center text-[10.5px]">
                  <span className="text-ink-muted">Công nợ mình nợ NCC:</span>
                  <span className={`font-mono font-bold ${s.debt > 0 ? 'text-accent' : 'text-ink-muted'}`}>
                    {s.debt.toLocaleString()}đ
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Historical Logs Panel with advanced filters */}
      <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
        
        {/* Controls Bar */}
        <div className="p-4 border-b border-border-hairline bg-bg-main/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Clipboard className="h-5 w-5 text-brand" />
            
            {/* Tab switch */}
            <div className="flex bg-bg-main p-0.5 rounded-lg border border-border-hairline">
              <button
                type="button"
                onClick={() => setHistoryTab('in')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  historyTab === 'in' ? 'bg-brand text-white shadow-2xs' : 'text-ink-muted hover:text-brand'
                }`}
              >
                Nhập kho ({stockInRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('out')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  historyTab === 'out' ? 'bg-danger text-white shadow-2xs' : 'text-ink-muted hover:text-brand'
                }`}
              >
                Xuất kho ({stockOutRecords.length})
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:flex-1 max-w-xl">
            {/* Search filter */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                placeholder="Tìm log theo tên sản phẩm, ghi chú..."
                value={logSearchTerm}
                onChange={(e) => setLogSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:ring-1 focus:ring-brand font-medium"
              />
            </div>

            {/* Filter by Supplier (for Stock-In) */}
            {historyTab === 'in' && (
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-bg-main border border-border-hairline rounded-lg text-xs text-ink font-bold shrink-0 cursor-pointer"
              >
                <option value="all">Tất cả NCC</option>
                {partners.filter(p => p.type === 'supplier').map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {/* Filter by Reason (for Stock-Out) */}
            {historyTab === 'out' && (
              <select
                value={selectedReasonFilter}
                onChange={(e) => setSelectedReasonFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-bg-main border border-border-hairline rounded-lg text-xs text-ink font-bold shrink-0 cursor-pointer"
              >
                <option value="all">Tất cả lý do</option>
                <option value="Bán lẻ vãng lai">Bán lẻ vãng lai</option>
                <option value="Hao hụt / Hỏng hóc">Hao hụt / Hỏng hóc</option>
                <option value="Tiêu dùng nội bộ">Tiêu dùng nội bộ</option>
                <option value="Trả hàng nhà cung cấp">Trả hàng nhà cung cấp</option>
                <option value="Khác">Khác</option>
              </select>
            )}
          </div>
        </div>

        {/* Logs Table Area */}
        {historyTab === 'in' ? (
          filteredStockIn.length === 0 ? (
            <div className="p-12 text-center text-ink-muted text-xs">
              Chưa có đợt nhập kho nào phù hợp bộ lọc tìm kiếm.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-bg-main/30 border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Thời gian</th>
                    <th className="py-2.5 px-4">Tên sản phẩm</th>
                    <th className="py-2.5 px-4">Nhà cung cấp</th>
                    <th className="py-2.5 px-4 text-center">Số lượng</th>
                    <th className="py-2.5 px-4 text-right">Đơn giá vốn</th>
                    <th className="py-2.5 px-4 text-right">Tổng thành tiền</th>
                    <th className="py-2.5 px-4">Biên lai</th>
                    <th className="py-2.5 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline/60">
                  {filteredStockIn.map((r) => (
                    <tr key={r.id} className="hover:bg-bg-main/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-[10.5px] text-ink-muted whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-bold text-ink">{r.productName}</span>
                          {r.isEstimated && (
                            <span className="text-[8px] bg-amber-500/10 text-amber-600 font-extrabold px-1.5 py-0.2 rounded-full border border-amber-500/20 w-max">
                              SỐ LƯỢNG ƯỚC TÍNH
                            </span>
                          )}
                          {r.notes && (
                            <span className="text-[10px] text-ink-muted italic">
                              Ghi chú: {r.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink-muted">
                        {r.supplierName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-brand/10 text-brand rounded font-black font-mono">
                          +{r.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-ink-muted">
                        {r.costPrice.toLocaleString()}đ
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-brand">
                        {(r.costPrice * r.quantity).toLocaleString()}đ
                      </td>
                      <td className="py-3 px-4">
                        {r.receiptImage ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImage(r.receiptImage || null)}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-brand-light/10 text-brand border border-brand/20 hover:bg-brand/10 rounded text-[10px] font-bold cursor-pointer transition-all"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Xem biên lai
                          </button>
                        ) : (
                          <span className="text-[10px] text-ink-muted italic">Không có</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleCancelStockIn(r)}
                          className="p-1 px-2 text-[10px] text-danger hover:bg-danger/10 border border-danger/25 rounded-md font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Hủy phiếu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredStockOut.length === 0 ? (
            <div className="p-12 text-center text-ink-muted text-xs">
              Chưa có đợt xuất kho nào phù hợp bộ lọc tìm kiếm.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-bg-main/30 border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Thời gian</th>
                    <th className="py-2.5 px-4">Tên sản phẩm</th>
                    <th className="py-2.5 px-4">Lý do xuất</th>
                    <th className="py-2.5 px-4 text-center">Số lượng</th>
                    <th className="py-2.5 px-4 text-right">Đơn giá bán</th>
                    <th className="py-2.5 px-4 text-right">Tổng thành tiền</th>
                    <th className="py-2.5 px-4">Đồng bộ sàn</th>
                    <th className="py-2.5 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline/60">
                  {filteredStockOut.map((r) => (
                    <tr key={r.id} className="hover:bg-bg-main/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-[10.5px] text-ink-muted whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-bold text-ink">{r.productName}</span>
                          {r.notes && (
                            <span className="text-[10px] text-ink-muted italic">
                              Ghi chú: {r.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                          r.reason === 'Bán lẻ vãng lai' ? 'bg-brand/10 text-brand border border-brand/20' :
                          r.reason === 'Hao hụt / Hỏng hóc' ? 'bg-danger/10 text-danger border border-danger/20' :
                          'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {r.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-danger/10 text-danger rounded font-black font-mono">
                          -{r.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-ink-muted">
                        {r.sellingPrice.toLocaleString()}đ
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-ink">
                        {(r.sellingPrice * r.quantity).toLocaleString()}đ
                      </td>
                      <td className="py-3 px-4">
                        {r.isSyncedWithPlatforms ? (
                          <span className="text-brand font-bold text-[10px] inline-flex items-center gap-1 bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                            <Check className="h-3 w-3" /> Đã đồng bộ
                          </span>
                        ) : (
                          <span className="text-ink-muted italic text-[10px]">Lưu kho nội bộ</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleCancelStockOut(r)}
                          className="p-1 px-2 text-[10px] text-danger hover:bg-danger/10 border border-danger/25 rounded-md font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Hủy phiếu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

      </div>

      {/* 5. Lightbox receipt picture Modal overlay */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl max-w-lg w-full overflow-hidden border border-border-hairline shadow-2xl flex flex-col p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-ink-muted">Biên lai / Hóa đơn nhập hàng chi tiết</span>
              <button 
                onClick={() => setLightboxImage(null)}
                className="text-ink-muted hover:text-ink font-bold cursor-pointer"
              >
                Đóng ✕
              </button>
            </div>
            <div className="bg-bg-main p-2 rounded-xl border border-border-hairline flex justify-center items-center max-h-[70vh] overflow-hidden">
              <img
                src={lightboxImage}
                alt="Zoomed receipt document"
                className="max-h-[60vh] object-contain rounded-md"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. STOCK-IN DIRECT MODAL */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <div className="flex flex-col">
                <h3 className="font-bold text-sm">Nhập hàng NCC trực tiếp kèm biên lai</h3>
                <span className="text-[11px] text-white/80 font-semibold">Cộng kho thực tế, tính nợ, tải ảnh chụp lưu trữ đối soát</span>
              </div>
              <button
                onClick={() => setIsStockInModalOpen(false)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStockIn}>
              <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-border-hairline text-xs">
                
                {/* NCC */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Nhà Cung Cấp (NCC) *</label>
                  <select
                    value={stockInSupplierId}
                    onChange={(e) => setStockInSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold cursor-pointer"
                    required
                  >
                    <option value="">-- Chọn Nhà cung cấp --</option>
                    {partners.filter(p => p.type === 'supplier').map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Nợ NCC: {s.debt.toLocaleString()}đ)</option>
                    ))}
                    <option value="none">NCC vãng lai ngoài danh sách</option>
                  </select>
                </div>

                {/* Sản phẩm */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Sản phẩm cần Nhập kho *</label>
                  <select
                    value={stockInProductId}
                    onChange={(e) => {
                      setStockInProductId(e.target.value);
                      const prod = products.find(p => p.id === e.target.value);
                      if (prod) {
                        setStockInCost(prod.cost.toString());
                      }
                    }}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold cursor-pointer"
                    required
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Tồn hiện tại: {p.stock} - SKU: {p.sku})</option>
                    ))}
                  </select>
                </div>

                {/* Số lượng & Giá vốn */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Số lượng Nhập *</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ví dụ: 20"
                      value={stockInQty}
                      onChange={(e) => setStockInQty(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Giá vốn nhập mới (đ)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="Trống = Giữ nguyên giá vốn cũ"
                      value={stockInCost}
                      onChange={(e) => setStockInCost(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                    />
                  </div>
                </div>

                {/* Phương thức thanh toán & Ước lượng */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Hình thức thanh toán</label>
                    <select
                      value={stockInPaymentMethod}
                      onChange={(e: any) => setStockInPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold cursor-pointer"
                    >
                      <option value="Tiền mặt">Trả ngay Tiền mặt</option>
                      <option value="Chuyển khoản QR">Chuyển khoản QR ngay</option>
                      <option value="Ghi nợ (Mua chịu)">Ghi nợ NCC (Mua chịu)</option>
                    </select>
                  </div>

                  <div className="bg-bg-main p-2 rounded-lg border border-border-hairline flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-ink block">Số lượng ước lượng</span>
                      <span className="text-[9px] text-ink-muted">Chưa đếm kĩ</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={stockInIsEstimated}
                      onChange={(e) => setStockInIsEstimated(e.target.checked)}
                      className="h-4 w-4 text-brand focus:ring-brand border-border-hairline rounded bg-white cursor-pointer"
                    />
                  </div>
                </div>

                {/* Ghi chú */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Ghi chú nhập hàng</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Hàng tặng kèm, hộp hơi bẹp..."
                    value={stockInNotes}
                    onChange={(e) => setStockInNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold"
                  />
                </div>

                {/* Tải ảnh biên lai */}
                <div className="space-y-1.5 pt-1.5 border-t border-border-hairline">
                  <label className="block text-xs font-bold text-ink-muted">Hình ảnh Biên lai / Hóa đơn của NCC</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const sName = stockInSupplierId ? (partners.find(p => p.id === stockInSupplierId)?.name || 'NCC vãng lai') : 'Chưa chọn NCC';
                          const pName = stockInProductId ? (products.find(p => p.id === stockInProductId)?.name || 'Chưa chọn') : 'Chưa chọn SP';
                          const mQty = stockInQty || '0';
                          const mCost = (parseInt(stockInCost) || 0).toLocaleString();
                          const mTotal = ((parseInt(stockInQty) || 0) * (parseInt(stockInCost) || 0)).toLocaleString();
                          const mockSvgReceipt = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="550" viewBox="0 0 400 550" style="background:%23fbf8f0; font-family:monospace; padding:20px; box-sizing:border-box;"><text x="20" y="40" font-size="16" font-weight="bold">%23 H%C3%93A %C4%90%C6%A0N NH%E1%BA%ACP KHO</text><text x="20" y="70" font-size="11" fill="%23666">M%C3%A3: ST-IN-MOCK-${Date.now().toString().slice(-4)}</text><text x="20" y="90" font-size="11" fill="%23666">Ng%C3%A0y: ${new Date().toISOString().substring(0,10)}</text><line x1="20" y1="110" x2="380" y2="110" stroke="%23333" stroke-width="1" stroke-dasharray="4"/><text x="20" y="135" font-size="12" font-weight="bold">NH%C3%80 CUNG C%E1%BA%A4P:</text><text x="20" y="155" font-size="11" fill="%23111">${sName}</text><line x1="20" y1="180" x2="380" y2="180" stroke="%23333" stroke-width="1" stroke-dasharray="4"/><text x="20" y="210" font-size="12" font-weight="bold">S%E1%BA%A2N PH%E1%BA%A8M:</text><text x="20" y="230" font-size="11" fill="%23111">${pName}</text><text x="20" y="250" font-size="11" fill="%23444">SL: ${mQty} | Gi%C3%A1: ${mCost}d</text><line x1="20" y1="280" x2="380" y2="280" stroke="%23333" stroke-width="1"/><text x="20" y="310" font-size="14" font-weight="bold">T%E1%BB%94NG C%E1%BB%98NG: ${mTotal}d</text><line x1="20" y1="340" x2="380" y2="340" stroke="%23333" stroke-width="1" stroke-dasharray="4"/><text x="20" y="370" font-size="10" fill="%23888">Ảnh hóa đơn đối soát tự động - Trại Mát Taphoa</text></svg>`;
                          setStockInReceiptImage(mockSvgReceipt);
                          addLogMessage('[Nhập kho] Đã mô phỏng ảnh hóa đơn số hóa SVG NCC', 'success');
                        }}
                        className="py-2 px-3 bg-brand/10 hover:bg-brand/20 border border-brand/20 rounded-lg text-[10px] font-bold text-brand transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="h-4 w-4" />
                        Chụp mẫu biên lai (Mô phỏng)
                      </button>
                      <div className="relative">
                        <label className="block text-[10px] text-ink-muted mb-1">Hoặc tải ảnh từ thiết bị</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptImageUpload}
                          className="block w-full text-[10px] text-ink-muted file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="border border-border-hairline bg-bg-main/40 rounded-xl p-2 flex items-center justify-center min-h-[90px]">
                      {stockInReceiptImage ? (
                        <div className="relative w-full h-20">
                          <img
                            src={stockInReceiptImage}
                            alt="Receipt Preview"
                            className="w-full h-full object-contain rounded"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setStockInReceiptImage('')}
                            className="absolute -top-1 -right-1 bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] hover:bg-red-500 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-ink-muted text-[10px] space-y-1">
                          <Upload className="h-5 w-5 mx-auto text-ink-muted/50" />
                          <p>Chưa có hình hóa đơn biên lai</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-4 bg-bg-main/30 border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsStockInModalOpen(false)}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink-muted hover:bg-bg-main font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand text-white rounded-lg font-black text-xs hover:bg-brand-hover shadow-md cursor-pointer"
                >
                  ✓ Xác nhận Nhập kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. STOCK-OUT DIRECT MODAL */}
      {isStockOutModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className="p-4 bg-danger text-white flex justify-between items-center">
              <div className="flex flex-col">
                <h3 className="font-bold text-sm">Phiếu Xuất Kho Nhanh</h3>
                <span className="text-[11px] text-white/80 font-semibold">Khấu trừ kho, tự động đối soát thanh lý hỏng hóc hoặc bán lẻ</span>
              </div>
              <button
                type="button"
                onClick={() => setIsStockOutModalOpen(false)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStockOut}>
              <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-border-hairline text-xs">
                
                {/* Chọn SP xuất */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Tìm & Chọn sản phẩm xuất *</label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
                      <input
                        type="text"
                        placeholder="Gõ tìm nhanh tên, mã vạch..."
                        value={stockOutSearchTerm}
                        onChange={(e) => setStockOutSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:ring-1 focus:ring-brand font-medium"
                      />
                    </div>
                    <select
                      value={stockOutProductId}
                      onChange={(e) => {
                        setStockOutProductId(e.target.value);
                        const prod = products.find(p => p.id === e.target.value);
                        if (prod) {
                          setStockOutPrice(prod.price.toString());
                        }
                      }}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold cursor-pointer"
                      required
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {products
                        .filter(p => {
                          if (!stockOutSearchTerm) return true;
                          const term = stockOutSearchTerm.toLowerCase();
                          return p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term));
                        })
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Tồn hiện tại: {p.stock} {p.unit} - Giá bán lẻ: {p.price.toLocaleString()}đ)
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                {/* Số lượng & Giá bán lẻ */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Số lượng xuất *</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ví dụ: 1"
                      value={stockOutQty}
                      onChange={(e) => setStockOutQty(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Giá bán xuất hàng (đ/món)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="Giá trị xuất bán"
                      value={stockOutPrice}
                      onChange={(e) => setStockOutPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                    />
                  </div>
                </div>

                {/* Lý do xuất */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Lý do xuất kho</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['Bán lẻ vãng lai', 'Hao hụt / Hỏng hóc', 'Tiêu dùng nội bộ', 'Trả hàng nhà cung cấp', 'Khác'] as const).map(reason => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setStockOutReason(reason)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          stockOutReason === reason
                            ? 'bg-danger/10 border-danger text-danger'
                            : 'bg-surface-card border-border-hairline text-ink-muted hover:bg-bg-main'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ghi doanh thu nếu bán lẻ */}
                {stockOutReason === 'Bán lẻ vãng lai' && (
                  <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-brand block">Tự ghi doanh thu bán lẻ</span>
                        <span className="text-[10px] text-ink-muted">Tự động cộng tiền vào Sổ Quỹ cửa hàng</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={recordRevenue}
                        onChange={(e) => setRecordRevenue(e.target.checked)}
                        className="h-4 w-4 text-brand focus:ring-brand border-border-hairline rounded bg-white cursor-pointer"
                      />
                    </div>

                    {recordRevenue && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand/10">
                        <div>
                          <label className="block text-[10px] font-bold text-ink-muted mb-1">Phương thức nhận</label>
                          <select
                            value={stockOutPaymentMethod}
                            onChange={(e: any) => setStockOutPaymentMethod(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-border-hairline text-ink rounded-lg text-xs focus:ring-1 focus:ring-brand font-bold cursor-pointer"
                          >
                            <option value="Tiền mặt">Tiền mặt</option>
                            <option value="Chuyển khoản QR">Chuyển khoản QR</option>
                          </select>
                        </div>
                        <div className="text-right flex flex-col justify-end font-mono">
                          <span className="text-[10px] text-ink-muted font-bold block">Thành tiền:</span>
                          <span className="text-xs text-brand font-black">
                            {((parseInt(stockOutQty) || 0) * (parseFloat(stockOutPrice) || 0)).toLocaleString()}đ
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ghi chú */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Ghi chú xuất kho</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Khách lấy lẻ, đền bù vỏ bẹp..."
                    value={stockOutNotes}
                    onChange={(e) => setStockOutNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold"
                  />
                </div>

              </div>

              <div className="p-4 bg-bg-main/30 border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsStockOutModalOpen(false)}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink-muted hover:bg-bg-main font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-danger text-white rounded-lg font-black text-xs hover:bg-danger/90 shadow-md cursor-pointer"
                >
                  ✓ Xác nhận Xuất kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
