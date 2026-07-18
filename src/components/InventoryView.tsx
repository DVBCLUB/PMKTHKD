import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { 
  Search, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Edit2, 
  TrendingDown, 
  Layers, 
  ShoppingBag, 
  Check, 
  X, 
  Upload, 
  Image as ImageIcon
} from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addLogMessage: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  isRealTimeSyncActive: boolean;
  setIsRealTimeSyncActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const PRODUCT_IMAGE_PRESETS = [
  { label: 'Sữa Vinamilk', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=200&auto=format&fit=crop&q=60' },
  { label: 'Mì ăn liền', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&auto=format&fit=crop&q=60' },
  { label: 'Bia Tiger', url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=200&auto=format&fit=crop&q=60' },
  { label: 'Coca-Cola', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&auto=format&fit=crop&q=60' },
  { label: 'Dầu ăn Simply', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&auto=format&fit=crop&q=60' },
  { label: 'Nước mắm', url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=200&auto=format&fit=crop&q=60' },
  { label: 'Bánh Chocopie', url: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=200&auto=format&fit=crop&q=60' },
  { label: 'Nước rửa chén', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=200&auto=format&fit=crop&q=60' },
  { label: 'Kem đánh răng', url: 'https://images.unsplash.com/photo-1559599141-3815480a826b?w=200&auto=format&fit=crop&q=60' },
  { label: 'Bánh Snack Poca', url: 'https://images.unsplash.com/photo-1599490659223-e1b98ac94efb?w=200&auto=format&fit=crop&q=60' }
];

export default function InventoryView({
  products,
  setProducts,
  addLogMessage,
  isRealTimeSyncActive,
  setIsRealTimeSyncActive
}: InventoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit Product Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);
  const [editImage, setEditImage] = useState<string>('');
  const [syncWithPlatforms, setSyncWithPlatforms] = useState(true);

  // Create Product Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Gia vị & Dầu ăn');
  const [newPrice, setNewPrice] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newMinStock, setNewMinStock] = useState('5');
  const [newUnit, setNewUnit] = useState('Hộp');
  const [newBarcode, setNewBarcode] = useState('');
  const [newImage, setNewImage] = useState('');

  // Low stock products calculation
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= p.minStock && p.stock >= 0);
  }, [products]);

  // Oversold / negative stock products
  const negativeStockProducts = useMemo(() => {
    return products.filter(p => p.stock < 0);
  }, [products]);

  // Search/Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const s = searchTerm.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(s) ||
                          p.sku.toLowerCase().includes(s) ||
                          p.barcode.includes(s);
      const matchCategory = selectedCategory === 'Tất cả' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Synchronize on platforms manual trigger
  const handleManualSync = () => {
    setIsSyncing(true);
    addLogMessage('[API Sàn] Bắt đầu đồng bộ kho hàng loạt lên Shopee và TikTok Shop...', 'info');

    setTimeout(() => {
      setProducts(prevProducts => {
        return prevProducts.map(p => ({
          ...p,
          shopeeStock: p.stock,
          tiktokStock: p.stock
        }));
      });
      setIsSyncing(false);
      addLogMessage('[API Sàn] Đồng bộ thành công hoàn tất! Kho thực tế đã khớp 100% với Shopee & TikTok Shop.', 'success');
    }, 1200);
  };

  // Open product details editor
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditStock(product.stock);
    setEditMinStock(product.minStock);
    setEditPrice(product.price);
    setEditCost(product.cost);
    setEditImage(product.image || '');
    setSyncWithPlatforms(true);
    setIsEditModalOpen(true);
  };

  // Save product details editor adjustments
  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setProducts(prevProducts => {
      return prevProducts.map(p => {
        if (p.id === editingProduct.id) {
          const updatedStock = editStock;
          const updatedShopee = syncWithPlatforms ? editStock : p.shopeeStock;
          const updatedTiktok = syncWithPlatforms ? editStock : p.tiktokStock;

          addLogMessage(`[Kho hàng] Đã cập nhật SP "${p.name}": Kho thực tế = ${updatedStock}, Giá bán lẻ = ${editPrice.toLocaleString()}đ`, 'success');
          if (syncWithPlatforms) {
            addLogMessage(`[API Sàn] Đã cập nhật & đồng bộ kho mới sang Shopee/TikTok (${updatedStock} chiếc)`, 'info');
          }

          return {
            ...p,
            stock: updatedStock,
            minStock: editMinStock,
            price: editPrice,
            cost: editCost,
            image: editImage,
            shopeeStock: updatedShopee,
            tiktokStock: updatedTiktok
          };
        }
        return p;
      });
    });

    setIsEditModalOpen(false);
    setEditingProduct(null);
  };

  // Handle addition of a brand-new product
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newName.trim() || !newPrice || !newCost) {
      addLogMessage('[Lỗi] Vui lòng nhập đầy đủ SKU, Tên, Giá bán và Giá vốn!', 'error');
      return;
    }

    const priceNum = parseFloat(newPrice);
    const costNum = parseFloat(newCost);
    const stockNum = parseInt(newStock) || 0;
    const minStockNum = parseInt(newMinStock) || 5;

    // Check SKU duplication
    if (products.some(p => p.sku.toLowerCase() === newSku.toLowerCase().trim())) {
      addLogMessage(`[Lỗi] Mã SKU "${newSku}" đã tồn tại trong danh mục!`, 'error');
      return;
    }

    const barcodeVal = newBarcode.trim() || Math.floor(1000000000000 + Math.random() * 900000000000).toString();

    const createdProd: Product = {
      id: 'prod-' + Date.now(),
      sku: newSku.trim().toUpperCase(),
      name: newName.trim(),
      category: newCategory,
      price: priceNum,
      cost: costNum,
      stock: stockNum,
      shopeeStock: isRealTimeSyncActive ? stockNum : 0,
      tiktokStock: isRealTimeSyncActive ? stockNum : 0,
      minStock: minStockNum,
      unit: newUnit,
      barcode: barcodeVal,
      image: newImage || undefined
    };

    setProducts(prev => [createdProd, ...prev]);
    addLogMessage(`[Sản phẩm mới] Tạo mới thành công SP "${createdProd.name}" (SKU: ${createdProd.sku})!`, 'success');

    // Reset create fields
    setNewSku('');
    setNewName('');
    setNewCategory('Gia vị & Dầu ăn');
    setNewPrice('');
    setNewCost('');
    setNewStock('');
    setNewMinStock('5');
    setNewUnit('Hộp');
    setNewBarcode('');
    setNewImage('');
    setIsCreateModalOpen(false);
  };

  // List of category presets
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['Tất cả', ...Array.from(cats)];
  }, [products]);

  // Handle local image file upload base64 transformation
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (isEditing) {
          setEditImage(base64);
        } else {
          setNewImage(base64);
        }
        addLogMessage('[Hình ảnh] Đã nhập ảnh sản phẩm thành công!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div id="inventory-view-container" className="space-y-5 animate-fade-in text-xs">
      
      {/* Synchronization Header banner */}
      <div className="bg-brand text-white p-5 rounded-2xl shadow-md border-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-white/10 rounded-lg border border-white/20">
              <ShoppingBag className="h-5 w-5 text-white" />
            </span>
            <h3 className="text-base font-bold text-white">Quản lý Kho Hàng & Tự động Đồng bộ Sàn</h3>
          </div>
          <p className="text-xs text-white/95 max-w-2xl">
            Quản lý thông tin danh mục, hình ảnh bách hóa, bảng giá và tự động cập nhật tồn kho tức thì sang sàn Shopee & TikTok shop khi kích hoạt đồng bộ real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/10">
            <span className="text-xs font-bold text-white">Đồng bộ Real-time:</span>
            <button
              onClick={() => {
                const newState = !isRealTimeSyncActive;
                setIsRealTimeSyncActive(newState);
                addLogMessage(
                  newState
                    ? '[Đồng bộ] Đã BẬT kết nối đồng bộ thời gian thực Shopee & TikTok Shop.'
                    : '[Đồng bộ] Đã TẮT kết nối tự động đồng bộ. Cửa hàng cần đồng bộ thủ công.',
                  newState ? 'success' : 'warning'
                );
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isRealTimeSyncActive ? 'bg-white/35' : 'bg-white/10'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  isRealTimeSyncActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-white text-brand border border-white/10 rounded-xl font-bold text-xs hover:bg-white/90 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Đồng bộ thủ công
          </button>
        </div>
      </div>

      {/* Negative Stock Alerts */}
      {negativeStockProducts.length > 0 && (
        <div className="bg-danger/10 border border-danger/25 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-danger/10 rounded-lg text-danger border border-danger/20">
              <AlertTriangle className="h-5 w-5 fill-danger/10 text-danger" />
            </span>
            <div>
              <h4 className="text-xs font-black text-danger">
                Phát hiện {negativeStockProducts.length} mặt hàng đang bị âm kho!
              </h4>
              <p className="text-[11px] text-danger mt-0.5 font-semibold">
                Cửa hàng đã xuất hóa đơn lẻ cho những món này trước khi nhập kho hệ thống. Bấm "+10" hoặc "+50" để bù nhanh, hoặc tạo phiếu Nhập kho NCC để bù kho và ghi nợ.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {negativeStockProducts.slice(0, 3).map((p) => (
              <span
                key={p.id}
                onClick={() => openEditModal(p)}
                className="cursor-pointer text-[10px] bg-surface-card border border-danger/30 hover:border-danger font-bold px-2 py-1 rounded text-danger hover:bg-danger/5 transition-colors shadow-2xs"
              >
                {p.name.substring(0, 15)}... ({p.stock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="bg-accent/10 border border-accent/25 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-accent/10 rounded-lg text-accent border border-accent/20">
              <AlertTriangle className="h-5 w-5 fill-accent/10 text-accent animate-pulse" />
            </span>
            <div>
              <h4 className="text-xs font-black text-accent">
                Phát hiện {lowStockProducts.length} mặt hàng chạm ngưỡng tồn tối thiểu!
              </h4>
              <p className="text-[11px] text-accent mt-0.5 font-semibold">
                Vui lòng gom đơn nhập bổ sung tại tab Nhập/Xuất kho để tránh bị đứt hàng trên sàn và POS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Table Card */}
      <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
        
        {/* Controls block */}
        <div className="p-4 border-b border-border-hairline bg-bg-main/20 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                placeholder="Tìm sản phẩm bằng tên, SKU, mã vạch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 bg-bg-main border border-border-hairline rounded-lg text-xs focus:ring-1 focus:ring-brand text-ink"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-2 bg-bg-main border border-border-hairline rounded-lg text-xs text-ink font-bold shrink-0 cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-black rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Thêm sản phẩm mới
            </button>
            <span className="flex items-center gap-1 font-mono font-bold text-ink-muted shrink-0 text-[11px]">
              <Layers className="h-3.5 w-3.5 text-brand" />
              Tổng mặt hàng: <strong className="text-brand font-black">{products.length}</strong>
            </span>
          </div>
        </div>

        {/* Product List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-main/40 border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Ảnh / Sản phẩm</th>
                <th className="py-3 px-4">Danh mục</th>
                <th className="py-3 px-4 text-center">Tồn kho thực tế</th>
                <th className="py-3 px-4 text-center">Shopee</th>
                <th className="py-3 px-4 text-center">TikTok Shop</th>
                <th className="py-3 px-4 text-right">Giá Vốn (Nhập)</th>
                <th className="py-3 px-4 text-right">Giá Bán Lẻ</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline/60">
              {filteredProducts.map((p) => {
                const isLow = p.stock <= p.minStock;
                const isOutOfStock = p.stock === 0;

                return (
                  <tr key={p.id} className="hover:bg-bg-main/30 transition-colors">
                    {/* Image thumbnail and name details */}
                    <td className="py-3 px-4 max-w-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg border border-border-hairline overflow-hidden shrink-0 bg-bg-main flex items-center justify-center">
                          {p.image ? (
                            <img 
                              src={p.image} 
                              alt={p.name} 
                              className="h-full w-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-ink-muted/55" />
                          )}
                        </div>
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-bold text-ink text-xs line-clamp-1">{p.name}</span>
                          <div className="flex items-center gap-2 font-mono text-[10px] text-ink-muted">
                            <span>SKU: {p.sku}</span>
                            <span>|</span>
                            <span>Mã vạch: {p.barcode}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-ink-muted whitespace-nowrap font-medium">
                      {p.category}
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      <span className={`px-2 py-0.5 rounded-md font-black text-xs border ${
                        p.stock < 0 ? 'bg-danger/10 text-danger border-danger/30' :
                        isOutOfStock ? 'bg-danger/5 text-danger/80 border-danger/20' :
                        isLow ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-brand/10 text-brand border-brand/20'
                      }`}>
                        {p.stock} {p.unit}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      <span className="inline-flex items-center gap-0.5 font-bold text-accent text-[10.5px]">
                        🧡 {p.shopeeStock}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      <span className="inline-flex items-center gap-0.5 font-bold text-ink-muted text-[10.5px]">
                        🎵 {p.tiktokStock}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-ink-muted">
                      {p.cost.toLocaleString()}đ
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-brand">
                      {p.price.toLocaleString()}đ
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {p.stock < 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20 text-[9px] font-extrabold">
                          Âm kho
                        </span>
                      ) : isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger/80 border border-danger/10 text-[9px] font-bold">
                          Hết hàng
                        </span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-bold">
                          Sắp hết ({p.minStock})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 text-[9px] font-bold">
                          An toàn
                        </span>
                      )}
                    </td>

                    {/* Fast stock corrections */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setProducts(prev => prev.map(prod => {
                              if (prod.id === p.id) {
                                const newStock = prod.stock + 10;
                                addLogMessage(`[Bù kho nhanh] Đã cộng thêm +10 sản phẩm "${p.name}" (Kho: ${newStock})`, 'success');
                                return {
                                  ...prod,
                                  stock: newStock,
                                  shopeeStock: isRealTimeSyncActive ? newStock : prod.shopeeStock,
                                  tiktokStock: isRealTimeSyncActive ? newStock : prod.tiktokStock
                                };
                              }
                              return prod;
                            }));
                          }}
                          className="px-1.5 py-0.5 bg-brand/5 hover:bg-brand/10 border border-brand/15 text-brand rounded text-[9.5px] font-bold font-mono cursor-pointer"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => {
                            setProducts(prev => prev.map(prod => {
                              if (prod.id === p.id) {
                                const newStock = prod.stock + 50;
                                addLogMessage(`[Bù kho nhanh] Đã cộng thêm +50 sản phẩm "${p.name}" (Kho: ${newStock})`, 'success');
                                return {
                                  ...prod,
                                  stock: newStock,
                                  shopeeStock: isRealTimeSyncActive ? newStock : prod.shopeeStock,
                                  tiktokStock: isRealTimeSyncActive ? newStock : prod.tiktokStock
                                };
                              }
                              return prod;
                            }));
                          }}
                          className="px-1.5 py-0.5 bg-brand/10 hover:bg-brand/15 border border-brand/20 text-brand rounded text-[9.5px] font-bold font-mono cursor-pointer"
                        >
                          +50
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1 px-2.5 text-ink hover:bg-bg-main rounded-md border border-border-hairline bg-surface-card hover:border-brand/35 transition-all inline-flex items-center gap-1 cursor-pointer font-bold text-[10px]"
                        >
                          <Edit2 className="h-3 w-3 text-ink-muted" />
                          Sửa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-12 text-center text-ink-muted text-xs">
            Không tìm thấy sản phẩm nào khớp điều kiện tìm kiếm.
          </div>
        )}
      </div>

      {/* 1. ADD NEW PRODUCT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <div className="flex flex-col">
                <h3 className="font-bold text-sm">Thêm Sản Phẩm Mới Vào Hệ Thống</h3>
                <span className="text-[11px] text-white/80 font-semibold">Tạo mã vạch tự động, khai báo giá bán lẻ, giá vốn và hình ảnh hiển thị</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-border-hairline text-xs">
                
                {/* SKU Code & Tên */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Mã SKU định danh *</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: MILK-TH-180"
                      value={newSku}
                      onChange={(e) => setNewSku(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-black placeholder:font-normal uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Tên sản phẩm bách hóa *</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Sữa tươi tiệt trùng TH True Milk 180ml"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold placeholder:font-normal"
                      required
                    />
                  </div>
                </div>

                {/* Danh mục & Đơn vị tính */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Danh mục phân loại</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold cursor-pointer"
                    >
                      <option value="Sữa & Chế phẩm sữa">Sữa & Chế phẩm sữa</option>
                      <option value="Mì ăn liền & Đồ khô">Mì ăn liền & Đồ khô</option>
                      <option value="Nước giải khát & Bia">Nước giải khát & Bia</option>
                      <option value="Gia vị & Dầu ăn">Gia vị & Dầu ăn</option>
                      <option value="Bánh kẹo & Đồ ăn vặt">Bánh kẹo & Đồ ăn vặt</option>
                      <option value="Hóa mỹ phẩm & Đồ cá nhân">Hóa mỹ phẩm & Đồ cá nhân</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Đơn vị tính (Dùng ghi hóa đơn)</label>
                    <input
                      type="text"
                      placeholder="Hộp, Chai, Thùng, Gói, Cái..."
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-bold"
                    />
                  </div>
                </div>

                {/* Giá vốn & Giá bán */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Giá vốn định mức (đ) *</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ví dụ: 6200"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Giá bán lẻ POS (đ) *</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ví dụ: 8000"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>
                </div>

                {/* Số lượng khởi tạo & Ngưỡng tối thiểu */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Tồn kho ban đầu thực tế</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ví dụ: 100"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg font-mono text-right focus:ring-1 focus:ring-brand font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Cảnh báo tồn tối thiểu</label>
                    <input
                      type="number"
                      min="1"
                      value={newMinStock}
                      onChange={(e) => setNewMinStock(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg font-mono text-right focus:ring-1 focus:ring-brand font-bold"
                    />
                  </div>
                </div>

                {/* Mã Vạch */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Mã vạch Barcode (Để trống sẽ sinh ngẫu nhiên)</label>
                  <input
                    type="text"
                    placeholder="Nhập mã số trên nhãn sản phẩm..."
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg focus:ring-1 focus:ring-brand font-mono font-bold"
                  />
                </div>

                {/* PRODUCT IMAGE FLOW (IMAGE ADDITION FEATURE) */}
                <div className="space-y-2 pt-2 border-t border-border-hairline">
                  <label className="block text-xs font-bold text-ink-muted">Hình ảnh đại diện sản phẩm</label>
                  
                  {/* Preset Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-ink-muted font-bold block">1. Chọn nhanh ảnh mẫu bách hóa tiêu biểu:</span>
                    <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto bg-bg-main/30 p-2 rounded-xl border border-border-hairline">
                      {PRODUCT_IMAGE_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNewImage(preset.url);
                            addLogMessage(`[Preset] Đã chọn mẫu ảnh bách hóa "${preset.label}"!`, 'success');
                          }}
                          className={`px-2 py-1 bg-white border border-border-hairline rounded hover:border-brand/40 text-[9.5px] font-bold transition-all ${
                            newImage === preset.url ? 'border-brand text-brand ring-1 ring-brand bg-brand/5' : 'text-ink-muted'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual / Upload */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-2">
                      <div className="relative">
                        <label className="block text-[10px] text-ink-muted mb-1">2. Hoặc tải file từ máy tính/điện thoại:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleLocalImageUpload(e, false)}
                          className="block w-full text-[10px] text-ink-muted file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-ink-muted mb-1">3. Hoặc dán trực tiếp Link ảnh (URL):</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={newImage.startsWith('data:image/') ? '(Đã tải tệp tin cục bộ)' : newImage}
                          onChange={(e) => {
                            if (!e.target.value.startsWith('(Đã tải')) {
                              setNewImage(e.target.value);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-bg-main border border-border-hairline rounded text-[10px] font-mono focus:ring-1 focus:ring-brand focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="border border-border-hairline bg-bg-main/40 rounded-xl p-2.5 flex items-center justify-center min-h-[90px]">
                      {newImage ? (
                        <div className="relative w-full h-20">
                          <img
                            src={newImage}
                            alt="Product Preview"
                            className="w-full h-full object-contain rounded"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setNewImage('')}
                            className="absolute -top-1 -right-1 bg-red-600 text-white w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold text-[9px] hover:bg-red-500 cursor-pointer shadow-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-ink-muted text-[10px] space-y-1">
                          <Upload className="h-5 w-5 mx-auto text-ink-muted/50" />
                          <p>Chưa có hình ảnh sản phẩm</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-4 bg-bg-main/30 border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink-muted hover:bg-bg-main font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand text-white rounded-lg font-black text-xs hover:bg-brand-hover shadow-md cursor-pointer"
                >
                  ✓ Khai báo sản phẩm mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADJUSTMENT / EDIT PRODUCT DETAILS MODAL */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <div className="flex flex-col">
                <h3 className="font-bold text-sm">Điều chỉnh Kho, Giá & Ảnh Sản Phẩm</h3>
                <span className="text-[11px] text-white/80 font-bold">{editingProduct.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingProduct(null);
                }}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStock}>
              <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-border-hairline text-xs">
                
                <div className="flex justify-between items-center text-[10px] bg-bg-main p-2.5 rounded-lg border border-border-hairline font-mono font-bold text-ink-muted">
                  <span>SKU: {editingProduct.sku}</span>
                  <span>Mã vạch: {editingProduct.barcode}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Tồn kho thực tế ({editingProduct.unit})</label>
                    <input
                      type="number"
                      min="0"
                      value={editStock}
                      onChange={(e) => setEditStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Cảnh báo tối thiểu</label>
                    <input
                      type="number"
                      min="0"
                      value={editMinStock}
                      onChange={(e) => setEditMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Giá nhập (Giá vốn - đ)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editCost}
                      onChange={(e) => setEditCost(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink-muted mb-1">Giá bán lẻ (POS - đ)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm font-mono text-right focus:ring-1 focus:ring-brand font-black"
                      required
                    />
                  </div>
                </div>

                {/* EDIT PRODUCT IMAGE */}
                <div className="space-y-2 pt-2 border-t border-border-hairline">
                  <label className="block text-xs font-bold text-ink-muted">Chỉnh sửa hình ảnh sản phẩm</label>
                  
                  {/* Preset Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-ink-muted font-bold block">1. Chọn nhanh ảnh mẫu bách hóa:</span>
                    <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto bg-bg-main/30 p-2 rounded-xl border border-border-hairline">
                      {PRODUCT_IMAGE_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditImage(preset.url);
                            addLogMessage(`[Preset] Đã chọn ảnh bách hóa "${preset.label}"!`, 'success');
                          }}
                          className={`px-2 py-0.5 bg-white border border-border-hairline rounded hover:border-brand/40 text-[9px] font-bold transition-all ${
                            editImage === preset.url ? 'border-brand text-brand ring-1 ring-brand bg-brand/5' : 'text-ink-muted'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload/URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] text-ink-muted mb-1">2. Hoặc tải file mới từ máy tính/điện thoại:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleLocalImageUpload(e, true)}
                          className="block w-full text-[10px] text-ink-muted file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-ink-muted mb-1">3. Hoặc dán trực tiếp Link ảnh mới (URL):</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={editImage.startsWith('data:image/') ? '(Đang dùng tệp tin cục bộ)' : editImage}
                          onChange={(e) => {
                            if (!e.target.value.startsWith('(Đang dùng')) {
                              setEditImage(e.target.value);
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-bg-main border border-border-hairline rounded text-[10px] font-mono focus:ring-1 focus:ring-brand focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="border border-border-hairline bg-bg-main/40 rounded-xl p-2 flex items-center justify-center min-h-[90px]">
                      {editImage ? (
                        <div className="relative w-full h-16">
                          <img
                            src={editImage}
                            alt="Product Preview"
                            className="w-full h-full object-contain rounded"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setEditImage('')}
                            className="absolute -top-1 -right-1 bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] hover:bg-red-500 cursor-pointer shadow-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-ink-muted text-[10px] space-y-1">
                          <Upload className="h-5 w-5 mx-auto text-ink-muted/50" />
                          <p>Chưa có hình ảnh sản phẩm</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-brand/10 p-3 rounded-lg border border-brand/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-brand block">Đồng bộ tức thì lên Sàn</span>
                    <span className="text-[10px] text-ink-muted">Cập nhật đồng thời số tồn kho {editStock} lên Shopee & TikTok</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={syncWithPlatforms}
                    onChange={(e) => setSyncWithPlatforms(e.target.checked)}
                    className="h-4 w-4 text-brand focus:ring-brand border-border-hairline rounded bg-white cursor-pointer"
                  />
                </div>

              </div>

              <div className="p-4 bg-bg-main/30 border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink-muted hover:bg-bg-main font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand text-white rounded-lg font-black text-xs hover:bg-brand-hover shadow-md cursor-pointer"
                >
                  ✓ Lưu các thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
