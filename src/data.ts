import { Product, Order, Transaction, CarrierConfig } from './types';

// Mock list of grocery products
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    sku: 'MILK-VNM-110',
    name: 'Sữa tươi tiệt trùng Vinamilk ít đường 110ml',
    category: 'Sữa & Chế phẩm sữa',
    price: 7500,
    cost: 5800,
    stock: 120,
    shopeeStock: 120,
    tiktokStock: 120,
    minStock: 20,
    unit: 'Hộp',
    barcode: '8934673121014',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-002',
    sku: 'Noodle-HHAO-TCC',
    name: 'Mì ăn liền Hảo Hảo tôm chua cay 75g',
    category: 'Mì ăn liền & Đồ khô',
    price: 4500,
    cost: 3300,
    stock: 350,
    shopeeStock: 350,
    tiktokStock: 350,
    minStock: 50,
    unit: 'Gói',
    barcode: '8934563138029',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-003',
    sku: 'BEER-TIGER-330',
    name: 'Bia Tiger lon 330ml (Thùng 24 lon)',
    category: 'Nước giải khát & Bia',
    price: 365000,
    cost: 320000,
    stock: 15,
    shopeeStock: 15,
    tiktokStock: 15,
    minStock: 5,
    unit: 'Thùng',
    barcode: '8934822010046',
    image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-004',
    sku: 'COCA-320',
    name: 'Nước ngọt Coca Cola lon 320ml',
    category: 'Nước giải khát & Bia',
    price: 11000,
    cost: 8200,
    stock: 8, // Low stock warning!
    shopeeStock: 8,
    tiktokStock: 8,
    minStock: 24,
    unit: 'Lon',
    barcode: '8935049500412',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-005',
    sku: 'OIL-SIMPLY-1L',
    name: 'Dầu ăn đậu nành Simply nguyên chất 1L',
    category: 'Gia vị & Dầu ăn',
    price: 58000,
    cost: 48500,
    stock: 45,
    shopeeStock: 45,
    tiktokStock: 45,
    minStock: 10,
    unit: 'Chai',
    barcode: '8936011701104',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-006',
    sku: 'SAUCE-NAMNGU-750',
    name: 'Nước mắm Nam Ngư Đệ Nhị 750ml',
    category: 'Gia vị & Dầu ăn',
    price: 29000,
    cost: 23000,
    stock: 3, // Low stock warning!
    shopeeStock: 3,
    tiktokStock: 3,
    minStock: 15,
    unit: 'Chai',
    barcode: '8935160800040',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-007',
    sku: 'CAKE-CHOCO-12',
    name: 'Bánh ChocoPie Orion hộp 12 gói 396g',
    category: 'Bánh kẹo & Đồ ăn vặt',
    price: 54000,
    cost: 44000,
    stock: 28,
    shopeeStock: 28,
    tiktokStock: 28,
    minStock: 8,
    unit: 'Hộp',
    barcode: '8936036010045',
    image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-008',
    sku: 'DISH-SUN-1.5L',
    name: 'Nước rửa chén Sunlight chanh túi 1.5L',
    category: 'Hóa mỹ phẩm & Đồ cá nhân',
    price: 42000,
    cost: 33500,
    stock: 19,
    shopeeStock: 19,
    tiktokStock: 19,
    minStock: 6,
    unit: 'Túi',
    barcode: '8934839123043',
    image: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-009',
    sku: 'PASTE-PS-180',
    name: 'Kem đánh răng P/S Bảo Vệ 123 Ngừa Sâu Răng 180g',
    category: 'Hóa mỹ phẩm & Đồ cá nhân',
    price: 32000,
    cost: 25000,
    stock: 2, // Low stock warning!
    shopeeStock: 2,
    tiktokStock: 2,
    minStock: 10,
    unit: 'Hộp',
    barcode: '8934839110029',
    image: 'https://images.unsplash.com/photo-1559599141-3815480a826b?w=200&auto=format&fit=crop&q=60'
  },
  {
    id: 'prod-010',
    sku: 'OISHI-POCA-50',
    name: 'Snack khoai tây Poca sườn nướng BBQ 54g',
    category: 'Bánh kẹo & Đồ ăn vặt',
    price: 12000,
    cost: 8500,
    stock: 80,
    shopeeStock: 80,
    tiktokStock: 80,
    minStock: 20,
    unit: 'Gói',
    barcode: '8935049511128',
    image: 'https://images.unsplash.com/photo-1599490659223-e1b98ac94efb?w=200&auto=format&fit=crop&q=60'
  }
];

// Initial mock orders from Shopee & TikTok Shop
export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-shopee-001',
    platform: 'shopee',
    orderSn: 'SHP294829381A',
    customerName: 'Nguyễn Văn Hùng',
    phone: '0912345678',
    address: '15 Tố Hữu, Phường Trung Văn, Quận Nam Từ Liêm, Hà Nội',
    items: [
      { sku: 'MILK-VNM-110', name: 'Sữa tươi tiệt trùng Vinamilk ít đường 110ml', quantity: 10, price: 7500 },
      { sku: 'Noodle-HHAO-TCC', name: 'Mì ăn liền Hảo Hảo tôm chua cay 75g', quantity: 30, price: 4500 }
    ],
    totalAmount: 210000,
    status: 'pending',
    createdAt: '2026-07-06T10:15:00-07:00',
    carrier: 'GHTK',
    trackingNumber: 'GHTK982394829',
    shippingSteps: [
      { status: 'Tạo đơn hàng', time: '2026-07-06 10:15', desc: 'Đơn hàng trực tuyến Shopee đã được đồng bộ về hệ thống cửa hàng.', },
      { status: 'Chuẩn bị hàng', time: '2026-07-06 11:30', desc: 'Nhân viên đang nhặt hàng tại kho tạp hóa.', },
      { status: 'Chờ đơn vị vận chuyển', time: '', desc: 'Chờ shipper Giao Hàng Tiết Kiệm tới lấy hàng.', }
    ],
    currentStepIndex: 1
  },
  {
    id: 'ord-tiktok-001',
    platform: 'tiktok',
    orderSn: 'TTS7492849382B',
    customerName: 'Trần Thị Thùy Linh',
    phone: '0987654321',
    address: 'Căn hộ B12, Chung cư Sunrise, Quận 7, TP. Hồ Chí Minh',
    items: [
      { sku: 'CAKE-CHOCO-12', name: 'Bánh ChocoPie Orion hộp 12 gói 396g', quantity: 2, price: 54000 },
      { sku: 'OISHI-POCA-50', name: 'Snack khoai tây Poca sườn nướng BBQ 54g', quantity: 5, price: 12000 }
    ],
    totalAmount: 168000,
    status: 'pending',
    createdAt: '2026-07-06T14:30:00-07:00',
    carrier: 'GHN',
    trackingNumber: 'GHN28491849',
    shippingSteps: [
      { status: 'Tạo đơn hàng', time: '2026-07-06 14:30', desc: 'Đơn hàng trực tuyến TikTok Shop đã được đồng bộ về hệ thống cửa hàng.', },
      { status: 'Chuẩn bị hàng', time: '', desc: 'Nhân viên chưa nhặt hàng.', }
    ],
    currentStepIndex: 0
  },
  {
    id: 'ord-shopee-002',
    platform: 'shopee',
    orderSn: 'SHP849301938C',
    customerName: 'Lê Hoàng Hải',
    phone: '0903344556',
    address: 'Hẻm 120 Điện Biên Phủ, Phường Đao Kao, Quận 1, TP. Hồ Chí Minh',
    items: [
      { sku: 'BEER-TIGER-330', name: 'Bia Tiger lon 330ml (Thùng 24 lon)', quantity: 1, price: 365000 },
      { sku: 'OISHI-POCA-50', name: 'Snack khoai tây Poca sườn nướng BBQ 54g', quantity: 3, price: 12000 }
    ],
    totalAmount: 401000,
    status: 'shipping',
    createdAt: '2026-07-05T09:00:00-07:00',
    carrier: 'Viettel Post',
    trackingNumber: 'VTP29482938A',
    shippingSteps: [
      { status: 'Tạo đơn hàng', time: '2026-07-05 09:00', desc: 'Đồng bộ đơn hàng Shopee.' },
      { status: 'Chuẩn bị hàng', time: '2026-07-05 10:30', desc: 'Đóng gói xong, dán mã vận đơn.' },
      { status: 'Giao cho đơn vị vận chuyển', time: '2026-07-05 14:00', desc: 'Shipper Viettel Post đã nhận hàng tại cửa hàng.' },
      { status: 'Đang luân chuyển', time: '2026-07-06 08:30', desc: 'Đơn hàng đang trung chuyển tại bưu cục Quận 1.' },
      { status: 'Đang giao hàng', time: '2026-07-06 15:40', desc: 'Shipper đang trên đường giao tới người nhận.' }
    ],
    currentStepIndex: 4
  },
  {
    id: 'ord-tiktok-002',
    platform: 'tiktok',
    orderSn: 'TTS294820129Y',
    customerName: 'Phạm Minh Ánh',
    phone: '0977221199',
    address: 'Khu dân cư Hòa Minh, Liên Chiểu, Đà Nẵng',
    items: [
      { sku: 'DISH-SUN-1.5L', name: 'Nước rửa chén Sunlight chanh túi 1.5L', quantity: 2, price: 42000 },
      { sku: 'OIL-SIMPLY-1L', name: 'Dầu ăn đậu nành Simply nguyên chất 1L', quantity: 1, price: 58000 }
    ],
    totalAmount: 142000,
    status: 'delivered',
    createdAt: '2026-07-04T11:20:00-07:00',
    carrier: 'GHTK',
    trackingNumber: 'GHTK392819283',
    shippingSteps: [
      { status: 'Tạo đơn hàng', time: '2026-07-04 11:20', desc: 'Khách thanh toán trực tuyến qua TikTok Shop' },
      { status: 'Bàn giao vận chuyển', time: '2026-07-04 15:00', desc: 'Giao hàng cho bưu cục GHTK.' },
      { status: 'Đang giao hàng', time: '2026-07-05 09:30', desc: 'Shipper GHTK khu vực Liên Chiểu đang đi giao.' },
      { status: 'Đã giao thành công', time: '2026-07-05 14:15', desc: 'Người mua đã ký nhận đơn hàng thành công.' }
    ],
    currentStepIndex: 3
  }
];

// Seed ledger transactions representing realistic data spanning the last several weeks
// The current local time is July 6, 2026.
export const INITIAL_TRANSACTIONS: Transaction[] = [
  // July 6 (Today)
  { id: 'tx-001', type: 'thu', category: 'Doanh thu bán hàng', amount: 845000, date: '2026-07-06 09:12:00', description: 'Bán hàng trực tiếp tại quầy - Hóa đơn #1002', paymentMethod: 'Tiền mặt' },
  { id: 'tx-002', type: 'thu', category: 'Doanh thu bán hàng', amount: 320000, date: '2026-07-06 10:45:00', description: 'Khách quét mã chuyển khoản QR - Hóa đơn #1003', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-003', type: 'thu', category: 'Doanh thu bán hàng', amount: 210000, date: '2026-07-06 11:32:00', description: 'Shopee thanh toán đối soát đơn SHP294829381A', paymentMethod: 'ShopeePay' },
  { id: 'tx-004', type: 'chi', category: 'Chi phí khác', amount: 150000, date: '2026-07-06 14:10:00', description: 'Chi trả tiền thuê ship ruột giao lẻ đồ nặng', paymentMethod: 'Tiền mặt' },
  { id: 'tx-005', type: 'thu', category: 'Doanh thu bán hàng', amount: 480000, date: '2026-07-06 16:20:00', description: 'Bán hàng trực tiếp tại quầy - Hóa đơn #1004', paymentMethod: 'MoMo' },
  { id: 'tx-006', type: 'chi', category: 'Tiền điện nước', amount: 1850000, date: '2026-07-06 18:00:00', description: 'Thanh toán tiền điện cửa hàng tháng 6/2026', paymentMethod: 'Chuyển khoản QR' },

  // July 5
  { id: 'tx-007', type: 'thu', category: 'Doanh thu bán hàng', amount: 1520000, date: '2026-07-05 11:00:00', description: 'Doanh thu bán hàng POS lẻ ngày chủ nhật', paymentMethod: 'Tiền mặt' },
  { id: 'tx-008', type: 'thu', category: 'Doanh thu bán hàng', amount: 890000, date: '2026-07-05 15:30:00', description: 'Doanh thu bán hàng qua QR & Ví điện tử', paymentMethod: 'ZaloPay' },
  { id: 'tx-009', type: 'chi', category: 'Nhập kho hàng hóa', amount: 4500000, date: '2026-07-05 17:00:00', description: 'Nhập hàng sữa Vinamilk & nước ngọt từ NPP Đại Hưng', paymentMethod: 'Chuyển khoản QR' },

  // July 4
  { id: 'tx-010', type: 'thu', category: 'Doanh thu bán hàng', amount: 1150000, date: '2026-07-04 10:20:00', description: 'Bán hàng POS lẻ ngày thứ bảy', paymentMethod: 'Tiền mặt' },
  { id: 'tx-011', type: 'thu', category: 'Doanh thu bán hàng', amount: 560000, date: '2026-07-04 14:40:00', description: 'TikTok Shop đối soát thanh toán đơn TTS294820129Y', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-012', type: 'chi', category: 'Lương nhân viên', amount: 3500000, date: '2026-07-04 19:00:00', description: 'Tạm ứng lương tuần cho nhân viên bán ca tối', paymentMethod: 'Tiền mặt' },

  // July 3
  { id: 'tx-013', type: 'thu', category: 'Doanh thu bán hàng', amount: 980000, date: '2026-07-03 12:00:00', description: 'Bán lẻ POS tạp hóa trực tiếp', paymentMethod: 'Tiền mặt' },
  { id: 'tx-014', type: 'thu', category: 'Doanh thu bán hàng', amount: 420000, date: '2026-07-03 16:30:00', description: 'Chuyển khoản QR đơn hàng bia giao tận nhà', paymentMethod: 'Chuyển khoản QR' },

  // July 2
  { id: 'tx-015', type: 'thu', category: 'Doanh thu bán hàng', amount: 1450000, date: '2026-07-02 10:00:00', description: 'Bán hàng lẻ POS', paymentMethod: 'Tiền mặt' },
  { id: 'tx-016', type: 'chi', category: 'Tiền mặt bằng', amount: 6000000, date: '2026-07-02 11:00:00', description: 'Chi trả tiền thuê mặt bằng cửa hàng tháng 7/2026', paymentMethod: 'Chuyển khoản QR' },

  // July 1
  { id: 'tx-017', type: 'thu', category: 'Doanh thu bán hàng', amount: 1350000, date: '2026-07-01 10:30:00', description: 'Doanh thu bán lẻ ngày đầu tháng', paymentMethod: 'Tiền mặt' },
  { id: 'tx-018', type: 'thu', category: 'Doanh thu bán hàng', amount: 620000, date: '2026-07-01 15:00:00', description: 'Bán lẻ & Chuyển khoản QR', paymentMethod: 'Chuyển khoản QR' },

  // Preceding weeks in June 2026 for rich financial reports
  // Week 26 (June 22 - June 28)
  { id: 'tx-019', type: 'thu', category: 'Doanh thu bán hàng', amount: 9800000, date: '2026-06-25 20:00:00', description: 'Tổng doanh thu bán lẻ tuần 4 tháng 6', paymentMethod: 'Tiền mặt' },
  { id: 'tx-020', type: 'thu', category: 'Doanh thu bán hàng', amount: 5600000, date: '2026-06-25 21:00:00', description: 'Tổng doanh thu online sàn TMĐT đối soát tuần 4 tháng 6', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-021', type: 'chi', category: 'Nhập kho hàng hóa', amount: 8200000, date: '2026-06-23 14:00:00', description: 'Nhập lô hàng tạp hóa định kỳ', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-022', type: 'chi', category: 'Lương nhân viên', amount: 4000000, date: '2026-06-28 18:00:00', description: 'Lương tuần nhân viên', paymentMethod: 'Tiền mặt' },

  // Week 25 (June 15 - June 21)
  { id: 'tx-023', type: 'thu', category: 'Doanh thu bán hàng', amount: 10500000, date: '2026-06-18 20:00:00', description: 'Tổng doanh thu bán lẻ tuần 3 tháng 6', paymentMethod: 'Tiền mặt' },
  { id: 'tx-024', type: 'thu', category: 'Doanh thu bán hàng', amount: 4800000, date: '2026-06-18 21:00:00', description: 'Tổng doanh thu online sàn TMĐT tuần 3', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-025', type: 'chi', category: 'Nhập kho hàng hóa', amount: 7500000, date: '2026-06-16 11:00:00', description: 'Nhập sỉ hóa mỹ phẩm & đồ cá nhân', paymentMethod: 'Chuyển khoản QR' },

  // Week 24 (June 8 - June 14)
  { id: 'tx-026', type: 'thu', category: 'Doanh thu bán hàng', amount: 8900000, date: '2026-06-11 20:00:00', description: 'Doanh thu bán lẻ tuần 2 tháng 6', paymentMethod: 'Tiền mặt' },
  { id: 'tx-027', type: 'thu', category: 'Doanh thu bán hàng', amount: 3900000, date: '2026-06-11 21:00:00', description: 'Doanh thu online đối soát tuần 2 tháng 6', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-028', type: 'chi', category: 'Nhập kho hàng hóa', amount: 6200000, date: '2026-06-09 10:00:00', description: 'Nhập bánh kẹo ăn vặt chuẩn bị hè', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-029', type: 'chi', category: 'Tiền điện nước', amount: 1950000, date: '2026-06-10 09:00:00', description: 'Chi phí điện nước sinh hoạt bưu cục/cửa hàng tháng 5/2026', paymentMethod: 'Chuyển khoản QR' },

  // Week 23 (June 1 - June 7)
  { id: 'tx-030', type: 'thu', category: 'Doanh thu bán hàng', amount: 11200000, date: '2026-06-04 20:00:00', description: 'Tổng doanh thu bán lẻ tuần 1 tháng 6', paymentMethod: 'Tiền mặt' },
  { id: 'tx-031', type: 'thu', category: 'Doanh thu bán hàng', amount: 5100000, date: '2026-06-04 21:00:00', description: 'Doanh thu online tuần 1', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-032', type: 'chi', category: 'Nhập kho hàng hóa', amount: 7900000, date: '2026-06-02 15:00:00', description: 'Thanh toán đợt sỉ sữa & đồ khô đầu tháng', paymentMethod: 'Chuyển khoản QR' },
  { id: 'tx-033', type: 'chi', category: 'Tiền mặt bằng', amount: 6000000, date: '2026-06-02 09:00:00', description: 'Tiền thuê cửa hàng tháng 6/2026', paymentMethod: 'Chuyển khoản QR' }
];

export const CARRIERS: CarrierConfig[] = [
  { id: 'GHTK', name: 'Giao Hàng Tiết Kiệm', logo: '⚡', baseFee: 22000, estimatedDays: '1-3 ngày', apiConnected: true },
  { id: 'GHN', name: 'Giao Hàng Nhanh', logo: '🚀', baseFee: 25000, estimatedDays: '1-2 ngày', apiConnected: true },
  { id: 'Viettel Post', name: 'Viettel Post', logo: '📮', baseFee: 24000, estimatedDays: '2-4 ngày', apiConnected: true },
  { id: 'VNPost', name: 'VNPost', logo: '✉️', baseFee: 18000, estimatedDays: '3-5 ngày', apiConnected: false }
];
