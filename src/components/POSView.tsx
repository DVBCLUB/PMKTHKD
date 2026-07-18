import React, { useState, useMemo } from 'react';
import { Product, CartItem, Transaction, Partner } from '../types';
import { ShoppingCart, Search, Trash2, Plus, Minus, User, CreditCard, RotateCcw, Check, Printer, AlertTriangle, Users, Clock } from 'lucide-react';

interface POSViewProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  partners: Partner[];
  setPartners: React.Dispatch<React.SetStateAction<Partner[]>>;
  addLogMessage: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  isRealTimeSyncActive: boolean;
}

export default function POSView({
  products,
  setProducts,
  transactions,
  setTransactions,
  partners,
  setPartners,
  addLogMessage,
  isRealTimeSyncActive
}: POSViewProps) {

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản QR' | 'MoMo' | 'ZaloPay' | 'VNPay' | 'Ghi nợ (Mua chịu)'>('Tiền mặt');
  const [customerPaid, setCustomerPaid] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Partner | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Parked sales (Giỏ hàng treo tạm)
  const [parkedSales, setParkedSales] = useState<{ id: string; cart: CartItem[]; time: string; customer: Partner | null }[]>(() => {
    const saved = localStorage.getItem('taphoa_parked_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const saveParkedSales = (newList: typeof parkedSales) => {
    setParkedSales(newList);
    localStorage.setItem('taphoa_parked_sales', JSON.stringify(newList));
  };

  const handleParkSale = () => {
    if (cart.length === 0) {
      addLogMessage('[POS] Giỏ hàng trống! Không thể tạm giữ đơn.', 'warning');
      return;
    }
    const newParked = {
      id: 'park-' + Date.now(),
      cart: [...cart],
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      customer: selectedCustomer
    };
    const newList = [newParked, ...parkedSales];
    saveParkedSales(newList);
    addLogMessage(`[Tạm giữ] Đã treo giỏ hàng của ${selectedCustomer?.name || 'Khách vãng lai'} (${cart.length} món) để tính tiền cho khách khác!`, 'success');
    setCart([]);
    setSelectedCustomer(null);
  };

  const handleRestoreParkedSale = (id: string) => {
    const target = parkedSales.find(p => p.id === id);
    if (!target) return;
    setCart(target.cart);
    setSelectedCustomer(target.customer);
    const newList = parkedSales.filter(p => p.id !== id);
    saveParkedSales(newList);
    addLogMessage(`[Tạm giữ] Đã khôi phục giỏ hàng treo của ${target.customer?.name || 'Khách vãng lai'} lúc ${target.time}.`, 'info');
  };

  const handleRemoveParkedSale = (id: string) => {
    const newList = parkedSales.filter(p => p.id !== id);
    saveParkedSales(newList);
    addLogMessage('[Tạm giữ] Đã hủy đơn hàng đang treo.', 'info');
  };

  // Danh sách các sản phẩm bán chạy nhất ghim lên trên để gõ nhanh
  const quickSaleProducts = useMemo(() => {
    // Ưu tiên các sản phẩm mì gói, nước ngọt, bia, sữa
    const hotProducts = products.filter(p => 
      p.sku.includes('MILK') || 
      p.sku.includes('Noodle') || 
      p.sku.includes('COCA') || 
      p.sku.includes('BEER') ||
      p.name.includes('mì') || 
      p.name.includes('Hộp') ||
      p.name.includes('Sữa') || 
      p.name.includes('Coca') ||
      p.name.includes('Bia')
    );
    // Nếu không đủ, lấy 6 sản phẩm đầu tiên
    if (hotProducts.length < 4) {
      return products.slice(0, 6);
    }
    return hotProducts.slice(0, 6);
  }, [products]);

  // Chế độ bán âm kho cho tạp hóa nhỏ lẻ bán lắt nhắt
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(() => {
    return localStorage.getItem('taphoa_allow_negative_stock') === 'true';
  });

  const toggleAllowNegativeStock = () => {
    const next = !allowNegativeStock;
    setAllowNegativeStock(next);
    localStorage.setItem('taphoa_allow_negative_stock', String(next));
    addLogMessage(next 
      ? '[Cấu hình] Đã kích hoạt Chế độ Bán Âm Kho! POS sẽ cho phép thêm và bán ngay cả khi tồn kho bằng 0.' 
      : '[Cấu hình] Đã tắt Bán Âm Kho. Các mặt hàng hết tồn kho ảo sẽ bị chặn bán.', 'info');
  };

  const [lastCompletedSale, setLastCompletedSale] = useState<{
    cart: CartItem[];
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    change: number;
    paymentMethod: string;
    invoiceNo: string;
    time: string;
  } | null>(null);

  // List of categories derived from products
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['Tất cả', ...Array.from(cats)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.barcode.includes(searchTerm);
      const matchCategory = selectedCategory === 'Tất cả' || product.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Quick scanner action simulator
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    const matchedProduct = products.find(p => p.barcode === searchTerm || p.sku.toLowerCase() === searchTerm.toLowerCase());
    if (matchedProduct) {
      addToCart(matchedProduct);
      setSearchTerm('');
      addLogMessage(`[POS] Quét mã vạch thành công: ${matchedProduct.name}`, 'success');
    } else {
      addLogMessage(`[POS] Không tìm thấy sản phẩm với mã: "${searchTerm}"`, 'warning');
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      if (!allowNegativeStock) {
        addLogMessage(`[POS] Cảnh báo: "${product.name}" đã hết hàng! Vui lòng bật "Chế độ Bán Âm Kho" nếu muốn bán tạm trước khi kiểm kho.`, 'error');
        return;
      } else {
        addLogMessage(`[Bán âm kho] Đã thêm mặt hàng hết tồn kho ảo "${product.name}" vào giỏ hàng.`, 'warning');
      }
    }
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const updatedCart = [...prevCart];
        const newQty = updatedCart[existingIndex].quantity + 1;
        if (newQty > product.stock && !allowNegativeStock) {
          addLogMessage(`[POS] Không thể thêm: Vượt quá số lượng kho thực tế (${product.stock} ${product.unit})`, 'warning');
          return prevCart;
        }
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: newQty
        };
        return updatedCart;
      } else {
        return [...prevCart, { product, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock && !allowNegativeStock) {
            addLogMessage(`[POS] Vượt quá tồn kho thực tế của ${item.product.name}`, 'warning');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setCustomerPaid('');
  };

  // Cart math
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (cartSubtotal * discountPercent) / 100;
  }, [cartSubtotal, discountPercent]);

  const cartTotal = useMemo(() => {
    return cartSubtotal - discountAmount;
  }, [cartSubtotal, discountAmount]);

  const customerChange = useMemo(() => {
    const paid = parseFloat(customerPaid) || 0;
    return paid > cartTotal ? paid - cartTotal : 0;
  }, [customerPaid, cartTotal]);

  const handleOpenPayment = () => {
    if (cart.length === 0) {
      addLogMessage('[POS] Giỏ hàng trống! Vui lòng chọn sản phẩm.', 'warning');
      return;
    }
    if (selectedPaymentMethod === 'Ghi nợ (Mua chịu)' && !selectedCustomer) {
      addLogMessage('[POS] Bạn chọn hình thức "Ghi nợ" nhưng chưa gán khách hàng! Vui lòng chọn khách hàng quen.', 'warning');
      return;
    }
    // Pre-fill paid money for other wallets to speed up click
    if (selectedPaymentMethod !== 'Tiền mặt' && selectedPaymentMethod !== 'Ghi nợ (Mua chịu)') {
      setCustomerPaid(cartTotal.toString());
    } else {
      setCustomerPaid('');
    }
    setIsPaymentModalOpen(true);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    if (selectedPaymentMethod === 'Ghi nợ (Mua chịu)' && !selectedCustomer) {
      addLogMessage('[POS] Không thể hoàn tất: Vui lòng chọn khách hàng để ghi nhận công nợ mua chịu.', 'error');
      return;
    }

    const invoiceNo = 'HD' + Math.floor(100000 + Math.random() * 900000);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Deduct Warehouse Stock
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        const cartItem = cart.find(item => item.product.id === p.id);
        if (cartItem) {
          const updatedStock = allowNegativeStock ? (p.stock - cartItem.quantity) : Math.max(0, p.stock - cartItem.quantity);
          
          if (updatedStock < 0) {
            setTimeout(() => {
              addLogMessage(`[Cảnh báo đỏ] Sản phẩm "${p.name}" hiện bị ÂM KHO: Tồn ${updatedStock} ${p.unit}. Bạn cần kiểm kho gấp để cân bằng thực tế!`, 'error');
            }, 1200);
          }

          // If real-time sync is active, also sync Shopee & TikTok shop instantly
          const shopeeS = isRealTimeSyncActive ? updatedStock : p.shopeeStock;
          const tiktokS = isRealTimeSyncActive ? updatedStock : p.tiktokStock;
          
          if (isRealTimeSyncActive) {
            setTimeout(() => {
              addLogMessage(`[Real-time API] Đã tự động đồng bộ tồn kho sản phẩm "${p.name}" lên Shopee & TikTok shop (${updatedStock} sản phẩm)`, 'info');
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
      });
    });

    // 2. Adjust customer debt in partners state
    if (selectedPaymentMethod === 'Ghi nợ (Mua chịu)' && selectedCustomer) {
      setPartners(prev => {
        return prev.map(p => {
          if (p.id === selectedCustomer.id) {
            const updatedDebt = p.debt + cartTotal;
            const limit = p.debtLimit || 5000000;
            if (updatedDebt > limit) {
              addLogMessage(`[Cảnh báo Công nợ] Khách hàng ${p.name} ghi nợ +${cartTotal.toLocaleString()}đ và ĐÃ VƯỢT HẠN MỨC CHO PHÉP! (Tổng nợ: ${updatedDebt.toLocaleString()}đ / Hạn mức: ${limit.toLocaleString()}đ)`, 'warning');
            } else {
              addLogMessage(`[Ghi nợ] Khách hàng ${p.name} ghi nợ +${cartTotal.toLocaleString()}đ vào sổ nợ (Tổng nợ hiện tại: ${updatedDebt.toLocaleString()}đ)`, 'success');
            }
            return {
              ...p,
              debt: updatedDebt
            };
          }
          return p;
        });
      });
    }

    // 3. Add ledger transaction
    const newTx: Transaction = {
      id: 'tx-' + Math.random().toString(36).substr(2, 9),
      type: 'thu',
      category: 'Doanh thu bán hàng',
      amount: cartTotal,
      date: nowStr,
      description: selectedPaymentMethod === 'Ghi nợ (Mua chịu)' && selectedCustomer
        ? `Bán hàng ghi nợ - Khách hàng: ${selectedCustomer.name} - Hóa đơn ${invoiceNo}`
        : `Bán hàng trực tiếp - Hóa đơn ${invoiceNo}`,
      paymentMethod: selectedPaymentMethod === 'Ghi nợ (Mua chịu)' ? 'Ghi nợ khách hàng' : selectedPaymentMethod
    };
    setTransactions(prev => [newTx, ...prev]);

    // Save checkout context for the receipt
    const paidVal = selectedPaymentMethod === 'Ghi nợ (Mua chịu)' ? 0 : (parseFloat(customerPaid) || cartTotal);
    const changeVal = paidVal > cartTotal ? paidVal - cartTotal : 0;

    setLastCompletedSale({
      cart: [...cart],
      subtotal: cartSubtotal,
      discount: discountAmount,
      total: cartTotal,
      paid: paidVal,
      change: changeVal,
      paymentMethod: selectedPaymentMethod,
      invoiceNo,
      time: nowStr
    });

    addLogMessage(`[POS] Thanh toán thành công hóa đơn ${invoiceNo} (${cartTotal.toLocaleString()}đ) bằng ${selectedPaymentMethod}`, 'success');

    // Reset and switch modals
    setIsPaymentModalOpen(false);
    setIsReceiptModalOpen(true);
    setCart([]);
  };


  return (
    <div id="pos-view-container" className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full min-h-[calc(100vh-140px)]">
      
      {/* LEFT: Product Grid & Search */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        
        {/* Top Controls: Barcode and Search */}
        <div className="bg-surface-card p-4 rounded-2xl shadow-xs border border-border-hairline flex flex-col md:flex-row gap-3">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-ink-muted" />
            </div>
            <input
              id="barcode-input-pos"
              type="text"
              placeholder="Quét mã vạch hoặc nhập SKU sản phẩm nhấn Enter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 bg-bg-main border border-border-hairline rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand focus:border-brand text-sm font-mono placeholder:font-sans text-ink placeholder:text-ink-muted"
            />
          </form>
          
          <div className="flex gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={toggleAllowNegativeStock}
              className={`px-3.5 py-2.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                allowNegativeStock
                  ? 'bg-danger/10 border-danger/25 text-danger'
                  : 'bg-bg-main border-border-hairline text-ink-muted hover:text-ink'
              }`}
              title="Cho phép thanh toán ngay cả khi hệ thống ghi nhận tồn kho bằng 0. Cực kỳ hữu ích cho tạp hóa bán lắt nhắt không kịp đếm kho!"
            >
              <AlertTriangle className={`h-4 w-4 ${allowNegativeStock ? 'animate-pulse text-danger' : 'text-ink-muted'}`} />
              Bán âm kho: {allowNegativeStock ? 'Bật' : 'Tắt'}
            </button>

            <button
              type="button"
              onClick={() => {
                // Simulate quick scanning of first available SKU
                const firstWithBarcode = products[0];
                if (firstWithBarcode) {
                  setSearchTerm(firstWithBarcode.barcode);
                  addLogMessage(`[Mô phỏng] Đã đặt mã vạch: ${firstWithBarcode.barcode} (${firstWithBarcode.name}) vào máy quét`, 'info');
                }
              }}
              className="px-3.5 py-2.5 bg-bg-main border border-border-hairline rounded-lg hover:bg-bg-main/80 text-xs font-bold text-ink transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse"></span>
              Gắn mã quét thử
            </button>
          </div>
        </div>

        {/* Lưới ghim bán nhanh 1 chạm */}
        <div className="bg-brand/5 p-3 rounded-2xl border border-brand/20">
          <div className="flex items-center justify-between text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5 text-brand">
              <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse"></span>
              Lưới Bán Nhanh Gợi Ý (1-Tap Thêm)
            </span>
            <span className="text-[10px] text-ink-muted normal-case font-normal">Các mặt hàng bán nhiều lắt nhắt</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {quickSaleProducts.map(p => (
              <button
                key={'quick-' + p.id}
                onClick={() => {
                  addToCart(p);
                  addLogMessage(`[Ghi nhanh] Đã thêm: ${p.name}`, 'success');
                }}
                className="py-1.5 px-2 bg-surface-card hover:bg-brand/10 hover:border-brand/35 border border-border-hairline rounded-lg text-left transition-all cursor-pointer flex flex-col justify-between group h-[62px] shadow-xs"
              >
                <span className="text-[10px] font-bold text-ink truncate w-full group-hover:text-brand" title={p.name}>
                  {p.name.split(' ').slice(0, 3).join(' ')}
                </span>
                <div className="flex items-center justify-between mt-1 w-full">
                  <span className="text-[10px] font-mono text-brand font-black">{p.price.toLocaleString()}đ</span>
                  <span className="text-[9px] bg-bg-main text-ink-muted px-1 rounded font-bold group-hover:bg-brand group-hover:text-white">+{p.stock}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Horizontal Scroll */}
        <div className="flex overflow-x-auto pb-1 gap-1.5 scrollbar-thin scrollbar-thumb-border-hairline">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-brand text-white shadow-xs border border-brand'
                  : 'bg-surface-card text-ink hover:bg-bg-main border border-border-hairline'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 bg-bg-main/30 rounded-2xl border border-border-hairline p-4 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-border-hairline">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-ink-muted space-y-2">
              <Search className="h-10 w-10 stroke-1" />
              <p className="text-sm">Không tìm thấy sản phẩm nào phù hợp</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {filteredProducts.map((product) => {
                const isLowStock = product.stock <= product.minStock;
                const isOutOfStock = product.stock === 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock && !allowNegativeStock}
                    className={`group bg-surface-card p-3 rounded-xl border border-border-hairline text-left transition-all duration-200 hover:shadow-md hover:border-brand/40 relative flex flex-col justify-between h-36 cursor-pointer ${
                      isOutOfStock && !allowNegativeStock ? 'opacity-40 cursor-not-allowed bg-bg-main' : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[10px] font-mono text-ink-muted block truncate max-w-[70px]">
                          {product.sku}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isOutOfStock ? 'bg-danger/10 text-danger border border-danger/20' :
                          isLowStock ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-brand/10 text-brand border border-brand/20'
                        }`}>
                          Tồn: {product.stock}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-bold text-ink line-clamp-2 mt-1.5 group-hover:text-brand leading-snug">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-2 border-t border-border-hairline/60 flex items-end justify-between">
                      <div>
                        <span className="text-[10px] text-ink-muted block">{product.unit}</span>
                        <span className="text-sm font-black text-ink font-mono">
                          {product.price.toLocaleString()}đ
                        </span>
                      </div>
                      <span className="bg-bg-main text-brand p-1 rounded-md group-hover:bg-brand group-hover:text-white transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    {isLowStock && !isOutOfStock && (
                      <div className="absolute top-1 right-1" title="Sắp hết hàng!">
                        <AlertTriangle className="h-4 w-4 text-accent fill-accent/10" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Active Checkout Cart */}
      <div className="lg:col-span-4 flex flex-col bg-surface-card border border-border-hairline rounded-2xl shadow-md overflow-hidden max-h-[730px]">
        
        {/* Header */}
        <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-brand" />
            <h3 className="font-bold text-ink text-sm">Đơn hàng hiện tại</h3>
          </div>
          <span className="bg-brand/10 text-brand border border-brand/20 text-xs px-2.5 py-1 rounded-full font-bold font-mono">
            {cart.reduce((sum, i) => sum + i.quantity, 0)} món
          </span>
        </div>

        {/* Giỏ hàng đang treo tạm (Parked Sales) */}
        {parkedSales.length > 0 && (
          <div className="bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center justify-between text-xs">
            <span className="text-accent font-bold flex items-center gap-1.5 animate-pulse">
              <Clock className="h-3.5 w-3.5" />
              Có {parkedSales.length} đơn đang treo
            </span>
            <div className="flex items-center gap-1.5">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleRestoreParkedSale(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-surface-card text-ink-muted text-[10px] font-bold px-2 py-1 rounded border border-border-hairline cursor-pointer focus:outline-hidden"
              >
                <option value="">-- Trả đơn treo --</option>
                {parkedSales.map(ps => (
                  <option key={ps.id} value={ps.id}>
                    {ps.time} - {ps.customer?.name || 'Khách vãng lai'} ({ps.cart.length} món)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-border-hairline">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-muted space-y-2 py-20 bg-bg-main/20">
              <div className="w-12 h-12 rounded-full bg-bg-main flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-brand" />
              </div>
              <p className="text-sm font-bold text-ink">Chưa có sản phẩm được chọn</p>
              <p className="text-xs text-ink-muted">Quét mã vạch hoặc nhấp để thêm sản phẩm</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-start gap-2.5 p-2 rounded-lg border border-border-hairline bg-bg-main/30 hover:bg-bg-main/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-ink truncate" title={item.product.name}>
                    {item.product.name}
                  </h5>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-brand font-mono font-bold">
                      {item.product.price.toLocaleString()}đ
                    </span>
                    <span className="text-[10px] text-ink-muted font-mono font-medium">
                      X {(item.product.price * item.quantity).toLocaleString()}đ
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-surface-card border border-border-hairline rounded-lg p-0.5 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="p-1 hover:bg-bg-main rounded text-ink-muted transition-colors cursor-pointer"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-1.5 text-xs font-bold font-mono text-ink min-w-6 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="p-1 hover:bg-bg-main rounded text-ink-muted transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="p-1.5 text-ink-muted hover:text-danger rounded hover:bg-danger/10 transition-colors shrink-0 align-middle self-center cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Customer Selection block (Liên thông Công nợ đối tác) */}
        <div className="px-4 py-3 border-t border-border-hairline bg-bg-main/10 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            <span className="flex items-center gap-1.5 text-brand">
              <Users className="h-4 w-4" />
              Khách hàng ghi nhận (Sapo)
            </span>
            {selectedCustomer && (
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  if (selectedPaymentMethod === 'Ghi nợ (Mua chịu)') {
                    setSelectedPaymentMethod('Tiền mặt');
                  }
                  addLogMessage('[POS] Đã bỏ liên kết khách hàng.', 'info');
                }}
                className="text-[10px] text-danger hover:text-danger-hover transition-colors font-bold cursor-pointer"
              >
                Hủy liên kết
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const cust = partners.find(p => p.id === e.target.value);
                setSelectedCustomer(cust || null);
                if (cust) {
                  addLogMessage(`[POS] Đã liên kết hóa đơn với khách hàng thành viên: ${cust.name}`, 'success');
                } else {
                  if (selectedPaymentMethod === 'Ghi nợ (Mua chịu)') {
                    setSelectedPaymentMethod('Tiền mặt');
                  }
                }
              }}
              className="flex-1 px-2.5 py-2 bg-surface-card border border-border-hairline rounded-lg text-xs font-bold focus:ring-1 focus:ring-brand text-ink cursor-pointer focus:outline-hidden"
            >
              <option value="">-- Khách vãng lai (Không ghi nợ) --</option>
              {partners.filter(p => p.type === 'customer').map(c => (
                <option key={c.id} value={c.id} className="bg-surface-card text-xs">
                  {c.name} ({c.phone} - Nợ: {c.debt.toLocaleString()}đ)
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer && (
            <div className="mt-1.5 p-2 bg-bg-main border border-border-hairline rounded-lg text-[11px] space-y-1">
              <div className="flex justify-between text-ink-muted">
                <span>Dư nợ hiện tại:</span>
                <span className="font-mono font-bold text-accent">{selectedCustomer.debt.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Hạn mức nợ:</span>
                <span className="font-mono text-ink">{(selectedCustomer.debtLimit || 5000000).toLocaleString()}đ</span>
              </div>
              {selectedCustomer.debt + cartTotal > (selectedCustomer.debtLimit || 5000000) && selectedPaymentMethod === 'Ghi nợ (Mua chịu)' ? (
                <div className="pt-1 mt-1 border-t border-danger/10 text-danger font-bold flex items-center gap-1 animate-pulse bg-danger/5 p-1 rounded">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" />
                  Vượt hạn mức nợ (+{(selectedCustomer.debt + cartTotal - (selectedCustomer.debtLimit || 5000000)).toLocaleString()}đ)
                </div>
              ) : selectedPaymentMethod === 'Ghi nợ (Mua chịu)' ? (
                <div className="flex justify-between text-ink-muted border-t border-border-hairline pt-1 mt-1">
                  <span>Nợ mới dự kiến:</span>
                  <span className="font-mono font-bold text-brand">{(selectedCustomer.debt + cartTotal).toLocaleString()}đ</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Pricing Summary Panel */}
        <div className="border-t border-border-hairline bg-bg-main/20 p-4 space-y-3.5">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-ink-muted font-semibold">
              <span>Tổng tiền hàng:</span>
              <span className="font-mono font-bold text-ink">{cartSubtotal.toLocaleString()}đ</span>
            </div>

            {/* Discount Section */}
            <div className="flex justify-between items-center text-xs text-ink-muted font-semibold">
              <span className="flex items-center gap-1">Chiết khấu (%):</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-14 px-1.5 py-0.5 text-center bg-surface-card border border-border-hairline text-ink rounded font-mono font-bold text-xs focus:ring-1 focus:ring-brand focus:outline-hidden"
                />
                <span className="font-mono text-brand font-bold">({discountAmount.toLocaleString()}đ)</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-end pt-2 border-t border-border-hairline">
              <span className="text-sm font-bold text-ink">Khách cần trả:</span>
              <span className="text-xl font-bold text-brand font-mono">
                {cartTotal.toLocaleString()}đ
              </span>
            </div>
          </div>

          {/* Payment Method Quick Switch */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Hình thức thanh toán</span>
            <div className="grid grid-cols-3 gap-1">
              {(['Tiền mặt', 'Chuyển khoản QR', 'MoMo', 'ZaloPay', 'VNPay', 'Ghi nợ (Mua chịu)'] as const).map((method) => {
                const isDebt = method === 'Ghi nợ (Mua chịu)';
                return (
                  <button
                    key={method}
                    onClick={() => {
                      if (isDebt && !selectedCustomer) {
                        addLogMessage('[POS] Vui lòng liên kết Khách hàng thành viên trước khi chọn hình thức Ghi nợ!', 'warning');
                        return;
                      }
                      setSelectedPaymentMethod(method);
                    }}
                    className={`py-1.5 px-1 rounded-md text-[10px] font-bold text-center border transition-all cursor-pointer ${
                      selectedPaymentMethod === method
                        ? 'bg-brand text-white border-brand shadow-xs'
                        : isDebt && !selectedCustomer
                          ? 'bg-bg-main border-border-hairline text-ink-muted/40 cursor-not-allowed opacity-40'
                          : 'bg-surface-card border-border-hairline text-ink-muted hover:bg-bg-main hover:text-ink'
                    }`}
                    title={isDebt && !selectedCustomer ? 'Yêu cầu chọn khách hàng trước' : ''}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>


          {/* Checkout Controls */}
          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={clearCart}
              title="Làm mới giỏ hàng"
              className="col-span-1 p-3 border border-border-hairline rounded-lg text-ink-muted bg-surface-card hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-all flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              onClick={handleParkSale}
              disabled={cart.length === 0}
              title="Treo đơn hàng (Tạm giữ)"
              className="col-span-1 p-3 border border-accent/30 rounded-lg text-accent bg-accent/10 hover:bg-accent hover:text-white transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Clock className="h-5 w-5" />
            </button>
            <button
              onClick={handleOpenPayment}
              disabled={cart.length === 0}
              className="col-span-3 py-3 px-4 bg-brand text-white rounded-lg font-bold text-sm hover:bg-brand-hover shadow-md hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:bg-bg-main disabled:text-ink-muted disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              Thanh Toán ({cartTotal.toLocaleString()}đ)
            </button>
          </div>
        </div>

      </div>

      {/* MODAL 1: Payment Detail & QR Code (Modal thanh toán) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h3 className="font-bold text-base">Hồ sơ thanh toán đơn hàng</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center bg-bg-main p-3 rounded-lg border border-border-hairline">
                <span className="text-sm font-semibold text-ink-muted">Tổng tiền thanh toán:</span>
                <span className="text-xl font-black text-brand font-mono">
                  {cartTotal.toLocaleString()}đ
                </span>
              </div>

              {/* Cash Payment Details */}
              {selectedPaymentMethod === 'Tiền mặt' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Số tiền khách đưa (VND)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ví dụ: 100000"
                        value={customerPaid}
                        onChange={(e) => setCustomerPaid(e.target.value)}
                        className="w-full px-3 py-2.5 bg-bg-main border border-border-hairline text-ink rounded-lg text-right font-mono text-lg font-black focus:ring-1 focus:ring-brand focus:outline-hidden"
                      />
                      <span className="absolute left-3 top-2.5 text-ink-muted font-bold font-mono">VND</span>
                    </div>
                  </div>

                  {/* Cash Quick Suggestions */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[cartTotal, 10000, 20000, 50000, 100000, 200000, 500000].map((val) => {
                      // Only show suggestion if value is >= cartTotal, except for the exact amount which is always useful
                      if (val < cartTotal && val !== cartTotal) return null;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCustomerPaid(val.toString())}
                          className="py-1 px-1.5 bg-bg-main hover:bg-bg-main/85 border border-border-hairline rounded text-[10px] font-mono font-bold text-ink cursor-pointer shadow-2xs"
                        >
                          {val === cartTotal ? 'Đủ tiền' : val.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>

                  {/* One-Touch payment (Bán lẻ 1 chạm không thối) */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerPaid(cartTotal.toString());
                      // Small delay for fluid UI state transition
                      setTimeout(() => {
                        handleCheckout();
                      }, 80);
                    }}
                    className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase shadow-md border border-brand/20"
                  >
                    ✓ ĐỦ TIỀN - CHỐT HÓA ĐƠN NGAY (1-CHẠM)
                  </button>

                  {/* Change */}
                  <div className="flex justify-between items-center pt-2 border-t border-border-hairline">
                    <span className="text-sm font-bold text-ink-muted">Tiền trả lại khách:</span>
                    <span className="text-lg font-black text-brand font-mono">
                      {customerChange.toLocaleString()}đ
                    </span>
                  </div>
                </div>
              ) : selectedPaymentMethod === 'Ghi nợ (Mua chịu)' ? (
                /* Ghi nợ customer verification screen */
                <div className="space-y-4 p-4.5 bg-bg-main border border-border-hairline rounded-xl">
                  <div className="flex items-center gap-2 text-brand font-bold text-xs uppercase tracking-wider">
                    <Users className="h-4 w-4" />
                    Xác nhận ghi sổ nợ khách hàng
                  </div>
                  
                  {selectedCustomer ? (
                    <div className="space-y-2.5 text-xs text-ink">
                      <div className="flex justify-between items-center">
                        <span className="text-ink-muted font-medium">Tên khách hàng:</span>
                        <span className="font-bold text-ink text-right">{selectedCustomer.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-muted font-medium">Số điện thoại:</span>
                        <span className="font-mono text-ink font-bold">{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border-hairline pt-2 mt-1">
                        <span className="text-ink-muted font-medium">Số dư nợ cũ:</span>
                        <span className="font-mono font-bold text-accent">{selectedCustomer.debt.toLocaleString()}đ</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-muted font-medium">Hạn mức tối đa:</span>
                        <span className="font-mono text-ink font-medium">{(selectedCustomer.debtLimit || 5000000).toLocaleString()}đ</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border-hairline pt-2 mt-1">
                        <span className="text-ink-muted font-medium">Phát sinh nợ mới:</span>
                        <span className="font-mono font-bold text-danger">+{cartTotal.toLocaleString()}đ</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm font-bold border-t border-border-hairline pt-2 mt-2">
                        <span className="text-brand">Tổng nợ mới dự kiến:</span>
                        <span className={`font-mono ${(selectedCustomer.debt + cartTotal) > (selectedCustomer.debtLimit || 5000000) ? 'text-danger font-black' : 'text-brand font-black'}`}>
                          {(selectedCustomer.debt + cartTotal).toLocaleString()}đ
                        </span>
                      </div>

                      {(selectedCustomer.debt + cartTotal) > (selectedCustomer.debtLimit || 5000000) && (
                        <div className="mt-3 p-3 bg-danger/10 border border-danger/25 rounded-lg text-danger font-medium leading-relaxed space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                            Cảnh báo: Vượt hạn mức nợ!
                          </div>
                          <p className="text-[10px] text-ink-muted">
                            Hóa đơn này làm tổng nợ của khách hàng vượt quá hạn mức cho phép {((selectedCustomer.debt + cartTotal) - (selectedCustomer.debtLimit || 5000000)).toLocaleString()}đ. Bạn vẫn có thể tiếp tục bán nợ nếu được phê duyệt hoặc yêu cầu thanh toán bớt.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-6 text-danger text-xs font-bold bg-danger/10 border border-danger/25 rounded-lg">
                      ⚠ LỖI: Bạn chưa chọn khách hàng thành viên để ghi nợ! Vui lòng quay lại chọn khách hàng.
                    </div>
                  )}
                </div>
              ) : (
                /* E-Wallet or QR Payment (Simulate Dynamic QR Code) */
                <div className="flex flex-col items-center justify-center p-3 border border-border-hairline rounded-xl space-y-3 bg-bg-main/30">
                  <div className="text-center">
                    <span className="text-xs font-bold text-ink uppercase">Quét mã bằng ứng dụng {selectedPaymentMethod}</span>
                    <p className="text-[10px] text-ink-muted mt-0.5">Tự động điền tiền và nội dung hóa đơn</p>
                  </div>
                  
                  {/* Visual Mock QR using pure inline elements */}
                  <div className="w-40 h-40 bg-white p-2.5 rounded-lg border border-border-hairline shadow-xs relative flex flex-col justify-between items-center">
                    {/* Visual simulated pixel block representing QR code */}
                    <div className="w-full h-full flex flex-wrap content-between gap-1 opacity-90">
                      {Array.from({ length: 64 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3.5 h-3.5 rounded-2xs ${
                            (i % 3 === 0 && i % 2 === 0) || (i < 12 && i % 3 !== 0) || (i > 48 && i % 2 !== 0)
                              ? 'bg-slate-950'
                              : 'bg-transparent'
                          } ${
                            // Add some QR anchor blocks
                            (i === 0 || i === 1 || i === 8 || i === 9) ||
                            (i === 6 || i === 7 || i === 14 || i === 15) ||
                            (i === 48 || i === 49 || i === 56 || i === 57)
                              ? 'bg-slate-950 border border-slate-700'
                              : ''
                          }`}
                        ></div>
                      ))}
                    </div>
                    {/* Logo inside QR center */}
                    <div className="absolute inset-0 m-auto w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200 font-bold text-[9px] shadow-xs text-brand">
                      {selectedPaymentMethod === 'MoMo' ? 'MoMo' : selectedPaymentMethod === 'ZaloPay' ? 'Zalo' : 'QR'}
                    </div>
                  </div>

                  <div className="w-full text-center py-1.5 bg-brand/10 border border-brand/20 rounded-lg">
                    <span className="text-xs text-brand font-bold font-mono">
                      Nội dung QR: TAPHOA POS {Math.floor(1000 + Math.random() * 9000)}
                    </span>
                  </div>
                  
                  <div className="text-[11px] text-ink-muted">
                    Hệ thống sẽ tự động chuyển trạng thái khi nhận được giao dịch.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-bg-main/30 border-t border-border-hairline flex gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-sm text-ink-muted hover:bg-bg-main transition-colors cursor-pointer font-bold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCheckout}
                className="flex-1 py-2 bg-brand text-white rounded-lg font-bold text-sm hover:bg-brand-hover shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Đồng ý thanh toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Receipt / In Hóa đơn (In hóa đơn cho khách) */}
      {isReceiptModalOpen && lastCompletedSale && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-hairline animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            {/* Action Bar */}
            <div className="p-3 bg-bg-main border-b border-border-hairline flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-ink-muted">Xem trước hóa đơn bán lẻ</span>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-ink-muted hover:text-ink font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Thermal Print Content */}
            <div className="p-6 overflow-y-auto bg-bg-main/30 flex-1 font-sans">
              <div className="border border-dashed border-border-hairline p-4 bg-white shadow-md text-center text-xs text-gray-700 rounded-lg">
                
                {/* Header */}
                <h3 className="font-bold text-sm uppercase text-gray-900 tracking-wide">TẠP HÓA GIA ĐÌNH</h3>
                <p className="text-[10px] text-gray-500">Đ/C: 45 Đường số 9, Quận Gò Vấp, TP. HCM</p>
                <p className="text-[10px] text-gray-500">ĐT: 0987.654.321</p>
                
                <div className="border-t border-dashed border-gray-300 my-3"></div>
                
                <h4 className="font-bold text-[11px] text-gray-900 uppercase">HÓA ĐƠN BÁN LẺ (POS)</h4>
                <p className="text-[9px] text-gray-400 mt-0.5">Số HD: {lastCompletedSale.invoiceNo}</p>
                <p className="text-[9px] text-gray-400">Thời gian: {lastCompletedSale.time}</p>
                
                <div className="border-t border-dashed border-gray-300 my-3"></div>

                {/* Table Header */}
                <div className="grid grid-cols-12 font-bold text-gray-900 text-[10px] text-left pb-1">
                  <span className="col-span-6">Tên SP</span>
                  <span className="col-span-2 text-center">SL</span>
                  <span className="col-span-4 text-right">T.Tiền</span>
                </div>
                
                <div className="border-t border-gray-200 my-1"></div>

                {/* Items */}
                <div className="space-y-1.5 text-left text-[9px] text-gray-600">
                  {lastCompletedSale.cart.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 items-start gap-1">
                      <div className="col-span-6 flex flex-col">
                        <span className="font-bold text-gray-800 line-clamp-2">{item.product.name}</span>
                        <span className="text-[8px] text-gray-400 font-mono">{item.product.sku}</span>
                      </div>
                      <span className="col-span-2 text-center font-mono">{item.quantity}</span>
                      <span className="col-span-4 text-right font-mono font-bold">
                        {(item.product.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 my-3"></div>

                {/* Calculations */}
                <div className="space-y-1 text-[9.5px] text-gray-600">
                  <div className="flex justify-between">
                    <span>Cộng tiền hàng:</span>
                    <span className="font-mono font-bold">{lastCompletedSale.subtotal.toLocaleString()}đ</span>
                  </div>
                  {lastCompletedSale.discount > 0 && (
                    <div className="flex justify-between text-amber-850">
                      <span>Chiết khấu giảm giá:</span>
                      <span className="font-mono font-bold">-{lastCompletedSale.discount.toLocaleString()}đ</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-900 text-xs font-bold pt-1 border-t border-gray-100">
                    <span>TỔNG THANH TOÁN:</span>
                    <span className="font-mono text-emerald-800">{lastCompletedSale.total.toLocaleString()}đ</span>
                  </div>
                  <div className="border-t border-gray-100 pt-1 my-1"></div>
                  <div className="flex justify-between">
                    <span>Phương thức:</span>
                    <span>{lastCompletedSale.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Khách đưa:</span>
                    <span className="font-mono">{lastCompletedSale.paid.toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between text-amber-850">
                    <span>Tiền trả lại:</span>
                    <span className="font-mono font-bold">{lastCompletedSale.change.toLocaleString()}đ</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-3.5"></div>

                <div className="text-center text-[9px] text-gray-400 italic">
                  Cảm ơn Quý khách! Hẹn gặp lại!<br/>
                  Powered by POS Tạp Hóa Sổ Kế Toán
                </div>

              </div>
            </div>

            {/* Print Action Bottom */}
            <div className="p-3 bg-bg-main border-t border-border-hairline flex gap-2 shrink-0">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="flex-1 py-2 text-center bg-surface-card border border-border-hairline rounded-lg text-xs font-bold text-ink-muted hover:bg-bg-main transition-colors cursor-pointer"
              >
                Đóng lại
              </button>
              <button
                onClick={() => {
                  addLogMessage('[In ấn] Đã kết nối máy in hóa đơn nhiệt và in hóa đơn thành công!', 'success');
                  setIsReceiptModalOpen(false);
                }}
                className="flex-1 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover shadow-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                In hóa đơn (K80)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
