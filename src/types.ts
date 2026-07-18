export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number; // Retail price (giá bán)
  cost: number;  // Cost price (giá vốn)
  stock: number; // Actual physical warehouse stock (kho thực tế)
  shopeeStock: number;
  tiktokStock: number;
  minStock: number; // Minimum stock warning threshold (tồn tối thiểu)
  unit: string;  // Unit: chai, gói, hộp, lon, cái, túi, kg, v.v.
  barcode: string;
  priceType?: 'fixed' | 'byWeight'; // fixed: giá cố định, byWeight: bán theo cân (kg/bó/lạng)
  image?: string; // Product image URL or Base64 string
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Transaction {
  id: string;
  type: 'thu' | 'chi';
  category: string; // e.g., 'Doanh thu bán hàng', 'Nhập kho hàng hóa', 'Tiền mặt', 'Tiền điện nước', 'Tiền mặt bằng', 'Lương nhân viên', 'Chi phí khác'
  amount: number;
  date: string; // YYYY-MM-DD HH:mm:ss or YYYY-MM-DD
  description: string;
  paymentMethod: string; // e.g., 'Tiền mặt', 'Chuyển khoản QR', 'MoMo', 'ZaloPay', 'ShopeePay', 'VNPay'
  receiptImage?: string; // base64 receipt photo for EOD reconciliation & proof
  isEstimated?: boolean; // true if amount is estimated temporarily
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ShippingStep {
  status: string;
  time: string;
  desc: string;
}

export interface Order {
  id: string;
  platform: 'shopee' | 'tiktok' | 'offline';
  orderSn: string;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'shipping' | 'delivered' | 'cancelled';
  createdAt: string;
  carrier: string; // e.g., 'GHTK', 'GHN', 'Viettel Post', 'VNPost'
  trackingNumber: string;
  shippingSteps: ShippingStep[];
  currentStepIndex: number;
}

export interface CarrierConfig {
  id: string;
  name: string;
  logo: string;
  baseFee: number;
  estimatedDays: string;
  apiConnected: boolean;
}

export interface Partner {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  phone: string;
  address: string;
  debt: number; // Positive means we owe them (for supplier) or they owe us (for customer)
  debtLimit?: number; // Maximum allowed debt limit (customer default e.g. 5,000,000)
  dueDate?: string; // Latest payment due date (YYYY-MM-DD)
  deliverySchedule?: string; // e.g., "Thứ 2, Thứ 5" or "Thứ 3, Thứ 7"
}

export interface StockInRecord {
  id: string;
  productId: string;
  productName: string;
  supplierId?: string;
  supplierName: string;
  quantity: number;
  costPrice: number;
  date: string;
  receiptImage?: string; // base64 bill photo
  isEstimated?: boolean;
  notes?: string;
}

export interface StockOutRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  sellingPrice: number; // Price per unit at time of stock out
  reason: 'Bán lẻ vãng lai' | 'Hao hụt / Hỏng hóc' | 'Tiêu dùng nội bộ' | 'Trả hàng nhà cung cấp' | 'Khác';
  date: string;
  notes?: string;
  isSyncedWithPlatforms?: boolean;
}


