import React, { useState, useMemo } from 'react';
import { Transaction, Partner, Product, StockInRecord, StockOutRecord, Order } from '../types';
import { 
  Search, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Calendar, 
  CreditCard, 
  FileText, 
  ClipboardList,
  Filter,
  Users,
  Building,
  User,
  PlusCircle,
  TrendingUp,
  Award,
  Wallet,
  Coins,
  Download,
  AlertTriangle,
  MessageSquare,
  Copy,
  BarChart3
} from 'lucide-react';

interface LedgerViewProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  partners: Partner[];
  setPartners: React.Dispatch<React.SetStateAction<Partner[]>>;
  addLogMessage: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  products?: Product[];
  stockInRecords?: StockInRecord[];
  stockOutRecords?: StockOutRecord[];
  orders?: Order[];
}

export default function LedgerView({
  transactions,
  setTransactions,
  partners,
  setPartners,
  addLogMessage,
  products = [],
  stockInRecords = [],
  stockOutRecords = [],
  orders = []
}: LedgerViewProps) {
  // Modules: 'cash-ledger' (Sổ quỹ thu chi), 'partner-debts' (Công nợ đối tác), 'tt88-books' (Sổ kế toán Thông tư 88)
  const [activeTab, setActiveTab] = useState<'cash-ledger' | 'partner-debts' | 'tt88-books'>('cash-ledger');
  
  // Sổ Kế Toán Thông Tư 88
  const [selectedBook, setSelectedBook] = useState<'s1' | 's2' | 's3' | 's4' | 's5'>('s1');
  const [selectedS2ProductId, setSelectedS2ProductId] = useState<string>(() => {
    return products && products[0] ? products[0].id : '';
  });

  // Sổ S5 - Payroll states
  const [payrollEmployees, setPayrollEmployees] = useState<{
    id: string;
    name: string;
    role: string;
    baseSalary: number;
    allowances: number;
    insurance: number;
    netPay: number;
    paymentStatus: 'Đã chi' | 'Chưa chi';
    payDate?: string;
  }[]>(() => {
    const saved = localStorage.getItem('taphoa_payroll_s5');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'emp-01', name: 'Nguyễn Thị Hoa', role: 'Thu ngân ca sáng', baseSalary: 4500000, allowances: 500000, insurance: 472500, netPay: 4527500, paymentStatus: 'Đã chi', payDate: '2026-07-05' },
      { id: 'emp-02', name: 'Trần Văn Nam', role: 'Nhân viên giao hàng', baseSalary: 6000000, allowances: 1000000, insurance: 630000, netPay: 6370000, paymentStatus: 'Đã chi', payDate: '2026-07-05' },
      { id: 'emp-03', name: 'Lê Văn Đức', role: 'Thủ kho & Soạn hàng', baseSalary: 5500000, allowances: 300000, insurance: 577500, netPay: 5222500, paymentStatus: 'Chưa chi' }
    ];
  });

  // Payroll creation states
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [payrollName, setPayrollName] = useState('');
  const [payrollRole, setPayrollRole] = useState('');
  const [payrollBase, setPayrollBase] = useState<number>(0);
  const [payrollAllowance, setPayrollAllowance] = useState<number>(0);
  const [payrollInsurance, setPayrollInsurance] = useState<number>(0);
  
  // Sổ quỹ Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'thu' | 'chi'>('all');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | 'cash' | 'bank' | 'wallet'>('all');

  // Partner Debt states
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all');


  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [txType, setTxType] = useState<'thu' | 'chi'>('chi');
  const [txCategory, setTxCategory] = useState('Nhập kho hàng hóa');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDescription, setTxDescription] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState('Tiền mặt');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().substring(0, 10));

  // Debt action modal
  const [selectedPartnerForDebt, setSelectedPartnerForDebt] = useState<Partner | null>(null);
  const [debtActionType, setDebtActionType] = useState<'collect' | 'pay'>('collect'); // collect = thu nợ, pay = trả nợ
  const [debtAmount, setDebtAmount] = useState<number>(0);
  const [debtPayMethod, setDebtPayMethod] = useState('Chuyển khoản QR');
  const [debtDesc, setDebtDesc] = useState('');

  // Create new partner state
  const [isNewPartnerOpen, setIsNewPartnerOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerType, setNewPartnerType] = useState<'customer' | 'supplier'>('customer');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newPartnerAddress, setNewPartnerAddress] = useState('');
  const [newPartnerInitialDebt, setNewPartnerInitialDebt] = useState<number>(0);

  // --- States for End-of-Day Quick Reconciliation & Auto-Adjust Tool ---
  const [reconSource, setReconSource] = useState<'cash' | 'bank' | 'wallet'>('cash');
  const [reconActual, setReconActual] = useState<string>('');

  // Quick reminder copy template generator
  const handleCopyDebtReminder = (p: Partner) => {
    const isCust = p.type === 'customer';
    const msg = isCust
      ? `Chào anh/chị ${p.name}, em bên Tạp hóa Gia Đình xin gửi đối soát dư nợ mua chịu hiện tại của mình là ${p.debt.toLocaleString()}đ (Hạn thanh toán: ${p.dueDate || 'trong tuần này'}). Nhờ anh/chị thu xếp thanh toán chuyển khoản giúp cửa hàng nhé. Em xin cảm ơn!`
      : `Chào NPP ${p.name}, em bên Tạp hóa Gia Đình xin thông báo xác nhận khoản công nợ cần trả đối với NPP là ${p.debt.toLocaleString()}đ (Hạn thanh toán: ${p.dueDate || 'trong tuần này'}). Em đang chuẩn bị dòng tiền và sẽ chuyển thanh toán sớm nhất. Xin cảm ơn!`;

    navigator.clipboard.writeText(msg).then(() => {
      addLogMessage(`[Nhắc nợ] Đã sao chép tin nhắn mẫu nhắc nợ đối tác "${p.name}" vào Clipboard! Bạn có thể dán (Ctrl+V) sang Zalo/Viber/SMS để gửi nhanh.`, 'success');
    }).catch(() => {
      addLogMessage('[Nhắc nợ] Không thể sao chép tự động! Vui lòng cho phép quyền truy cập Clipboard.', 'error');
    });
  };

  // --- Date Range Matcher helper (relative to local current date 2026-07-06) ---
  const matchesDate = (txDateStr: string) => {
    if (dateRange === 'all') return true;
    
    // Extract date YYYY-MM-DD
    const datePart = txDateStr.substring(0, 10);
    
    if (dateRange === 'today') {
      return datePart === '2026-07-06';
    }
    if (dateRange === 'yesterday') {
      return datePart === '2026-07-05';
    }
    if (dateRange === 'week') {
      // June 29 to July 6 is the current week
      return datePart >= '2026-06-29' && datePart <= '2026-07-06';
    }
    if (dateRange === 'month') {
      return datePart.startsWith('2026-07');
    }
    return true;
  };

  // --- Account Matcher helper ---
  const matchesAccount = (method: string) => {
    if (accountFilter === 'all') return true;
    const norm = method.toLowerCase();
    
    if (accountFilter === 'cash') {
      return norm.includes('tiền mặt') || norm.includes('két');
    }
    if (accountFilter === 'bank') {
      return norm.includes('chuyển khoản') || norm.includes('ngân hàng') || norm.includes('qr');
    }
    if (accountFilter === 'wallet') {
      return norm.includes('momo') || norm.includes('zalopay') || norm.includes('shopeepay') || norm.includes('ví');
    }
    return true;
  };

  // --- Calculations for Sổ Quỹ (Cash & Bank Book) ---
  const { totalThu, totalChi, netProfit, openingBalance, closingBalance } = useMemo(() => {
    let thu = 0;
    let chi = 0;
    
    // We assume an arbitrary initial opening balance from past records of 50,000,000đ
    const baseOpening = 50000000;

    transactions.forEach(t => {
      // Calculate only for filtered accounts if applicable
      const acctMatch = matchesAccount(t.paymentMethod);
      const dateMatch = matchesDate(t.date);

      if (acctMatch && dateMatch) {
        if (t.type === 'thu') {
          thu += t.amount;
        } else {
          chi += t.amount;
        }
      }
    });

    return {
      totalThu: thu,
      totalChi: chi,
      netProfit: thu - chi,
      openingBalance: baseOpening,
      closingBalance: baseOpening + thu - chi
    };
  }, [transactions, dateRange, accountFilter]);

  // --- Dynamic Cash vs Bank vs Wallet sub-balances ---
  const { cashBalance, bankBalance, walletBalance } = useMemo(() => {
    let cash = 20000000;
    let bank = 25000000;
    let wallet = 5000000;
    
    transactions.forEach(t => {
      const norm = t.paymentMethod.toLowerCase();
      const amount = t.amount;
      if (t.type === 'thu') {
        if (norm.includes('tiền mặt') || norm.includes('két')) {
          cash += amount;
        } else if (norm.includes('chuyển khoản') || norm.includes('ngân hàng') || norm.includes('qr') || norm.includes('vnpay')) {
          bank += amount;
        } else {
          wallet += amount;
        }
      } else {
        if (norm.includes('tiền mặt') || norm.includes('két')) {
          cash -= amount;
        } else if (norm.includes('chuyển khoản') || norm.includes('ngân hàng') || norm.includes('qr') || norm.includes('vnpay')) {
          bank -= amount;
        } else {
          wallet -= amount;
        }
      }
    });
    
    return { cashBalance: cash, bankBalance: bank, walletBalance: wallet };
  }, [transactions]);

  // Current theoretical balance based on selection
  const theoreticalBalance = useMemo(() => {
    if (reconSource === 'cash') return cashBalance;
    if (reconSource === 'bank') return bankBalance;
    return walletBalance;
  }, [reconSource, cashBalance, bankBalance, walletBalance]);

  // Difference: Actual - Theoretical
  const reconDifference = useMemo(() => {
    const act = parseFloat(reconActual) || 0;
    if (reconActual === '') return 0;
    return act - theoreticalBalance;
  }, [reconActual, theoreticalBalance]);

  // Handle auto-adjusting the selected account
  const handleAutoAdjustBalance = () => {
    if (reconDifference === 0 || reconActual === '') return;

    const diffAbs = Math.abs(reconDifference);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const sourceName = reconSource === 'cash' ? 'Tiền mặt' : reconSource === 'bank' ? 'Chuyển khoản Ngân hàng' : 'Ví điện tử';

    const newTx: Transaction = {
      id: 'tx-' + Math.random().toString(36).substr(2, 9),
      type: reconDifference > 0 ? 'thu' : 'chi',
      category: 'Điều chỉnh lệch kiểm quỹ',
      amount: diffAbs,
      date: nowStr,
      description: `Cân bằng đối soát ${sourceName} (Thực tế đếm: ${(parseFloat(reconActual) || 0).toLocaleString()}đ - Chênh lệch: ${reconDifference > 0 ? 'Thừa' : 'Thâm hụt'} ${reconDifference.toLocaleString()}đ)`,
      paymentMethod: reconSource === 'cash' ? 'Tiền mặt' : reconSource === 'bank' ? 'Chuyển khoản QR' : 'MoMo'
    };

    setTransactions(prev => [newTx, ...prev]);
    addLogMessage(`[Đối soát] Đã tự động tạo phiếu ${reconDifference > 0 ? 'THU THỪA' : 'CHI BÙ HAO HỤT'} quỹ ${sourceName} (+${diffAbs.toLocaleString()}đ) để khớp số đếm thực tế!`, 'success');
    
    // Clear input
    setReconActual('');
  };

  // List of all unique categories in transactions
  const categories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    return ['Tất cả', ...Array.from(cats)];
  }, [transactions]);

  // --- CALCULATIONS AND ACTIONS FOR CIRCULAR 88/2021/TT-BTC BOOKS ---

  // Sổ S1 - Doanh thu chi tiết
  const s1RevenueItems = useMemo(() => {
    const items: Array<{
      date: string;
      voucherId: string;
      description: string;
      customerName: string;
      categoryType: 'distribution' | 'service' | 'production' | 'other';
      amount: number;
    }> = [];

    // 1. Pull from orders
    orders.forEach(o => {
      if (o.status !== 'cancelled') {
        items.push({
          date: o.createdAt,
          voucherId: o.orderSn || o.id,
          description: `Doanh thu bán lẻ [${o.platform.toUpperCase()}] - ${o.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}`,
          customerName: o.customerName || 'Khách vãng lai',
          categoryType: 'distribution',
          amount: o.totalAmount
        });
      }
    });

    // 2. Pull from transactions
    transactions.forEach(t => {
      if (t.type === 'thu') {
        const descLower = t.description.toLowerCase();
        if (descLower.includes('đơn hàng') || descLower.includes('order') || descLower.includes('thu nợ')) {
          return;
        }

        let cat: 'distribution' | 'service' | 'production' | 'other' = 'distribution';
        if (t.category.toLowerCase().includes('dịch vụ')) {
          cat = 'service';
        } else if (t.category.toLowerCase().includes('vận chuyển') || t.category.toLowerCase().includes('sản xuất')) {
          cat = 'production';
        } else if (t.category.toLowerCase().includes('khác')) {
          cat = 'other';
        }

        items.push({
          date: t.date,
          voucherId: `PT-${t.id.substring(3, 8).toUpperCase()}`,
          description: t.description,
          customerName: 'Khách vãng lai',
          categoryType: cat,
          amount: t.amount
        });
      }
    });

    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [orders, transactions]);

  // Sổ S2 - Sổ chi tiết hàng hóa
  const s2LedgerData = useMemo(() => {
    if (!selectedS2ProductId) return { movements: [], openingStock: 0, openingValue: 0, currentProduct: null };
    const prod = products.find(p => p.id === selectedS2ProductId);
    if (!prod) return { movements: [], openingStock: 0, openingValue: 0, currentProduct: null };

    const movements: Array<{
      date: string;
      voucherId: string;
      description: string;
      type: 'nhap' | 'xuat';
      qty: number;
      price: number;
      value: number;
      balanceQty?: number;
      balanceValue?: number;
    }> = [];

    // stockInRecords
    stockInRecords.forEach(r => {
      if (r.productId === selectedS2ProductId) {
        movements.push({
          date: r.date,
          voucherId: `PNK-${r.id.substring(3, 8).toUpperCase()}`,
          description: `Nhập kho từ ${r.supplierName || 'NPP'}`,
          type: 'nhap',
          qty: r.quantity,
          price: r.costPrice,
          value: r.quantity * r.costPrice
        });
      }
    });

    // stockOutRecords
    stockOutRecords.forEach(r => {
      if (r.productId === selectedS2ProductId) {
        movements.push({
          date: r.date,
          voucherId: `PXK-${r.id.substring(3, 8).toUpperCase()}`,
          description: `Xuất kho nhanh - Lý do: ${r.reason} ${r.notes ? `(${r.notes})` : ''}`,
          type: 'xuat',
          qty: r.quantity,
          price: r.sellingPrice,
          value: r.quantity * r.sellingPrice
        });
      }
    });

    // Orders
    orders.forEach(o => {
      if (o.status !== 'cancelled') {
        o.items.forEach(item => {
          const prodMatch = (prod.sku && item.sku === prod.sku) || item.name.toLowerCase().includes(prod.name.toLowerCase());
          if (prodMatch) {
            movements.push({
              date: o.createdAt,
              voucherId: o.orderSn || o.id,
              description: `Bán lẻ xuất kho [${o.platform.toUpperCase()}] cho ${o.customerName || 'Khách lẻ'}`,
              type: 'xuat',
              qty: item.quantity,
              price: prod.price,
              value: item.quantity * prod.price
            });
          }
        });
      }
    });

    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let netChange = 0;
    movements.forEach(m => {
      if (m.type === 'nhap') {
        netChange += m.qty;
      } else {
        netChange -= m.qty;
      }
    });

    const openingStock = Math.max(0, prod.stock - netChange);
    const openingValue = openingStock * prod.cost;

    let currentStock = openingStock;
    const movementsWithBalance = movements.map(m => {
      if (m.type === 'nhap') {
        currentStock += m.qty;
      } else {
        currentStock -= m.qty;
      }
      return {
        ...m,
        balanceQty: currentStock,
        balanceValue: currentStock * prod.cost
      };
    });

    return {
      movements: movementsWithBalance,
      openingStock,
      openingValue,
      currentProduct: prod
    };
  }, [selectedS2ProductId, products, stockInRecords, stockOutRecords, orders]);

  // Sổ S3 - Chi phí kinh doanh
  const s3ExpensesList = useMemo(() => {
    return transactions
      .filter(t => t.type === 'chi')
      .map(t => {
        const cat = t.category;
        const amount = t.amount;
        
        let labor = 0;
        let materials = 0;
        let depreciation = 0;
        let taxFee = 0;
        let services = 0;
        let others = 0;

        const catL = cat.toLowerCase();
        if (catL.includes('lương') || catL.includes('nhân sự') || catL.includes('nhân viên') || catL.includes('thưởng')) {
          labor = amount;
        } else if (catL.includes('nhập kho') || catL.includes('nhập hàng') || catL.includes('mua hàng') || catL.includes('vật liệu')) {
          materials = amount;
        } else if (catL.includes('khấu hao') || catL.includes('thiết bị cố định')) {
          depreciation = amount;
        } else if (catL.includes('thuế') || catL.includes('phí') || catL.includes('lệ phí')) {
          taxFee = amount;
        } else if (catL.includes('thuê mặt bằng') || catL.includes('điện nước') || catL.includes('internet') || catL.includes('dịch vụ')) {
          services = amount;
        } else {
          others = amount;
        }

        return {
          id: t.id,
          date: t.date,
          description: t.description,
          category: t.category,
          amount,
          labor,
          materials,
          depreciation,
          taxFee,
          services,
          others
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  const s3Totals = useMemo(() => {
    let labor = 0;
    let materials = 0;
    let depreciation = 0;
    let taxFee = 0;
    let services = 0;
    let others = 0;
    let total = 0;

    s3ExpensesList.forEach(e => {
      labor += e.labor;
      materials += e.materials;
      depreciation += e.depreciation;
      taxFee += e.taxFee;
      services += e.services;
      others += e.others;
      total += e.amount;
    });

    return { labor, materials, depreciation, taxFee, services, others, total };
  }, [s3ExpensesList]);

  // Sổ S4 - Nghĩa vụ thuế
  const s4TaxLiabilities = useMemo(() => {
    let revDist = 0;
    let revServ = 0;
    let revProd = 0;
    let revOther = 0;

    s1RevenueItems.forEach(item => {
      if (item.categoryType === 'distribution') revDist += item.amount;
      else if (item.categoryType === 'service') revServ += item.amount;
      else if (item.categoryType === 'production') revProd += item.amount;
      else revOther += item.amount;
    });

    const taxDistGtgt = revDist * 0.01;
    const taxDistTncn = revDist * 0.005;

    const taxServGtgt = revServ * 0.05;
    const taxServTncn = revServ * 0.02;

    const taxProdGtgt = revProd * 0.03;
    const taxProdTncn = revProd * 0.015;

    const taxOtherGtgt = revOther * 0.02;
    const taxOtherTncn = revOther * 0.01;

    const totalGtgt = taxDistGtgt + taxServGtgt + taxProdGtgt + taxOtherGtgt;
    const totalTncn = taxDistTncn + taxServTncn + taxProdTncn + taxOtherTncn;

    return {
      revDist, revServ, revProd, revOther,
      taxDistGtgt, taxDistTncn,
      taxServGtgt, taxServTncn,
      taxProdGtgt, taxProdTncn,
      taxOtherGtgt, taxOtherTncn,
      totalGtgt,
      totalTncn,
      totalTax: totalGtgt + totalTncn
    };
  }, [s1RevenueItems]);

  const s4TaxPayments = useMemo(() => {
    return transactions
      .filter(t => t.type === 'chi' && (t.category.toLowerCase().includes('thuế') || t.description.toLowerCase().includes('thuế') || t.description.toLowerCase().includes('nộp thuế')))
      .map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        paymentMethod: t.paymentMethod
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  const totalTaxPaid = useMemo(() => {
    return s4TaxPayments.reduce((acc, p) => acc + p.amount, 0);
  }, [s4TaxPayments]);

  // S5 Payroll Handlers
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollName.trim() || !payrollRole.trim()) {
      addLogMessage('[Lương] Vui lòng nhập đầy đủ tên và chức vụ nhân viên!', 'warning');
      return;
    }

    const net = payrollBase + payrollAllowance - payrollInsurance;
    const newEmp = {
      id: 'emp-' + Math.random().toString(36).substr(2, 9),
      name: payrollName,
      role: payrollRole,
      baseSalary: payrollBase,
      allowances: payrollAllowance,
      insurance: payrollInsurance,
      netPay: net,
      paymentStatus: 'Chưa chi' as const
    };

    setPayrollEmployees(prev => {
      const updated = [...prev, newEmp];
      localStorage.setItem('taphoa_payroll_s5', JSON.stringify(updated));
      return updated;
    });

    addLogMessage(`[Sổ lương S5] Đã thêm thành công nhân viên "${payrollName}" vào danh sách.`, 'success');
    setIsPayrollModalOpen(false);
    
    setPayrollName('');
    setPayrollRole('');
    setPayrollBase(0);
    setPayrollAllowance(0);
    setPayrollInsurance(0);
  };

  const handlePaySalary = (empId: string) => {
    const emp = payrollEmployees.find(e => e.id === empId);
    if (!emp) return;

    if (!window.confirm(`Bạn có chắc muốn thực hiện chi trả lương cho nhân viên "${emp.name}" số tiền ${emp.netPay.toLocaleString()}đ không? Phiếu chi tiền mặt sẽ được tự động ghi nhận vào Sổ quỹ.`)) {
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newTx: Transaction = {
      id: 'tx-pay-' + Math.random().toString(36).substr(2, 9),
      type: 'chi',
      category: 'Lương nhân viên',
      amount: emp.netPay,
      date: nowStr,
      description: `Chi trả lương cho nhân viên ${emp.name} (${emp.role})`,
      paymentMethod: 'Tiền mặt'
    };

    setTransactions(prev => [newTx, ...prev]);
    
    setPayrollEmployees(prev => {
      const updated = prev.map(e => {
        if (e.id === empId) {
          return { ...e, paymentStatus: 'Đã chi' as const, payDate: nowStr.substring(0, 10) };
        }
        return e;
      });
      localStorage.setItem('taphoa_payroll_s5', JSON.stringify(updated));
      return updated;
    });

    addLogMessage(`[Sổ lương S5] Đã chi trả thành công và tự động lập Phiếu Chi lương ${emp.netPay.toLocaleString()}đ cho ${emp.name}`, 'success');
  };

  const handleDeleteEmployee = (empId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nhân viên này khỏi danh mục S5 không?")) {
      return;
    }
    setPayrollEmployees(prev => {
      const updated = prev.filter(e => e.id !== empId);
      localStorage.setItem('taphoa_payroll_s5', JSON.stringify(updated));
      return updated;
    });
    addLogMessage(`[Sổ lương S5] Đã xóa nhân viên khỏi danh sách theo dõi lương.`, 'info');
  };

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'all' || t.type === typeFilter;
      const matchCategory = categoryFilter === 'Tất cả' || t.category === categoryFilter;
      const matchDt = matchesDate(t.date);
      const matchAcct = matchesAccount(t.paymentMethod);
      
      return matchSearch && matchType && matchCategory && matchDt && matchAcct;
    });
  }, [transactions, searchTerm, typeFilter, categoryFilter, dateRange, accountFilter]);

  // Filtered partners list
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
                          p.phone.includes(partnerSearch) ||
                          p.address.toLowerCase().includes(partnerSearch.toLowerCase());
      const matchType = partnerTypeFilter === 'all' || p.type === partnerTypeFilter;
      return matchSearch && matchType;
    });
  }, [partners, partnerSearch, partnerTypeFilter]);

  // Calculate total customer debts (Khách nợ) and total supplier debts (Phải trả NCC)
  const debtTotals = useMemo(() => {
    let customerDebts = 0;
    let supplierDebts = 0;
    partners.forEach(p => {
      if (p.type === 'customer') {
        customerDebts += p.debt;
      } else {
        supplierDebts += p.debt;
      }
    });
    return { customerDebts, supplierDebts };
  }, [partners]);

  // Thống kê cơ cấu chi tiêu trong kỳ lọc (Để tối ưu hoá dòng tiền)
  const cashbookStats = useMemo(() => {
    const categoriesMap: { [key: string]: number } = {};
    let totalExpense = 0;
    let totalIncome = 0;

    transactions.forEach(t => {
      if (matchesDate(t.date) && matchesAccount(t.paymentMethod)) {
        if (t.type === 'chi') {
          categoriesMap[t.category] = (categoriesMap[t.category] || 0) + t.amount;
          totalExpense += t.amount;
        } else {
          totalIncome += t.amount;
        }
      }
    });

    const expenseBreakdown = Object.entries(categoriesMap).map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percent: totalExpense > 0 ? (amt / totalExpense) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);

    return { expenseBreakdown, totalExpense, totalIncome };
  }, [transactions, dateRange, accountFilter]);

  // Phân tích xu hướng thu chi theo ngày khớp bộ lọc để vẽ biểu đồ trực quan
  const dailyCashflowTrend = useMemo(() => {
    const dailyMap: { [key: string]: { thu: number; chi: number } } = {};
    
    transactions.forEach(t => {
      if (matchesDate(t.date) && matchesAccount(t.paymentMethod)) {
        // Chỉ lấy ngày yyyy-mm-dd
        const dateKey = t.date.substring(0, 10);
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { thu: 0, chi: 0 };
        }
        if (t.type === 'thu') {
          dailyMap[dateKey].thu += t.amount;
        } else {
          dailyMap[dateKey].chi += t.amount;
        }
      }
    });

    // Sắp xếp các ngày tăng dần theo thời gian
    const sortedDays = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7); // Lấy tối đa 7 mốc ngày có dữ liệu gần nhất

    // Tìm giá trị max để tính tỉ lệ cột cao tương ứng
    let maxVal = 0;
    sortedDays.forEach(([_, val]) => {
      if (val.thu > maxVal) maxVal = val.thu;
      if (val.chi > maxVal) maxVal = val.chi;
    });

    return { sortedDays, maxVal };
  }, [transactions, dateRange, accountFilter]);

  // Handle adding new custom transaction voucher
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (txAmount <= 0) {
      addLogMessage('[Kế toán] Số tiền thu/chi phải lớn hơn 0đ!', 'warning');
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newTx: Transaction = {
      id: 'tx-' + Math.random().toString(36).substr(2, 9),
      type: txType,
      category: txCategory,
      amount: txAmount,
      date: `${txDate} ${nowStr.substring(11)}`, // Combine datepicker + current time
      description: txDescription || `${txType === 'thu' ? 'Thu' : 'Chi'} hạch toán tự do`,
      paymentMethod: txPaymentMethod
    };

    setTransactions(prev => [newTx, ...prev]);
    addLogMessage(`[Kế toán] Đã tạo phiếu ${txType === 'thu' ? 'THU' : 'CHI'} mới: ${txCategory} (+${txAmount.toLocaleString()}đ)`, 'success');
    
    // Reset Form
    setIsFormOpen(false);
    setTxAmount(0);
    setTxDescription('');
  };

  // Handle Partner Debt Clearance (Thu nợ khách hàng / Trả nợ NCC)
  const handleProcessDebtClearance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerForDebt) return;
    if (debtAmount <= 0) {
      addLogMessage('[Công nợ] Số tiền thanh toán nợ phải lớn hơn 0đ!', 'warning');
      return;
    }

    const isCustomer = selectedPartnerForDebt.type === 'customer';
    
    // Update partner debt state
    setPartners(prev => {
      return prev.map(p => {
        if (p.id === selectedPartnerForDebt.id) {
          // Subtract paid debt (limit to 0 or allow negative/advance if they pay more)
          const newDebt = Math.max(0, p.debt - debtAmount);
          return { ...p, debt: newDebt };
        }
        return p;
      });
    });

    // Auto generate cashbook voucher (Phiếu Thu / Phiếu Chi)
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newTx: Transaction = {
      id: 'tx-debt-' + Math.random().toString(36).substr(2, 9),
      type: isCustomer ? 'thu' : 'chi', // Collecting customer debt = Receive cash, Paying supplier = Pay cash
      category: isCustomer ? 'Thu nợ khách hàng' : 'Nhập kho hàng hóa',
      amount: debtAmount,
      date: nowStr,
      description: debtDesc || `${isCustomer ? 'Thu nợ khách hàng' : 'Trả nợ nhà cung cấp'}: ${selectedPartnerForDebt.name}`,
      paymentMethod: debtPayMethod
    };

    setTransactions(prev => [newTx, ...prev]);
    
    addLogMessage(
      `[Hệ thống Sổ Quỹ] Đã tạo tự động phiếu ${isCustomer ? 'THU' : 'CHI'} dốc nợ cho ${selectedPartnerForDebt.name} với số tiền ${debtAmount.toLocaleString()}đ.`,
      'success'
    );

    // Close modal
    setSelectedPartnerForDebt(null);
    setDebtAmount(0);
    setDebtDesc('');
  };

  // Create new partner
  const handleCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) {
      addLogMessage('[Đối tác] Vui lòng nhập tên đối tác!', 'warning');
      return;
    }

    const newPart: Partner = {
      id: 'part-' + Math.random().toString(36).substr(2, 9),
      name: newPartnerName,
      type: newPartnerType,
      phone: newPartnerPhone || 'Chưa cập nhật',
      address: newPartnerAddress || 'Chưa cập nhật',
      debt: newPartnerInitialDebt
    };

    setPartners(prev => [...prev, newPart]);
    addLogMessage(`[Đối tác] Đã thêm mới thành công đối tác ${newPartnerType === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'}: ${newPartnerName}`, 'success');

    // Reset Form
    setIsNewPartnerOpen(false);
    setNewPartnerName('');
    setNewPartnerPhone('');
    setNewPartnerAddress('');
    setNewPartnerInitialDebt(0);
  };

  // Xuất file CSV Sổ quỹ hạch toán (Dữ liệu thực tế cho kế toán)
  const exportCashbookToCSV = () => {
    if (filteredTransactions.length === 0) {
      addLogMessage('[Sổ quỹ] Không có dữ liệu giao dịch trong kỳ lọc để xuất báo cáo!', 'warning');
      return;
    }
    
    // Header dòng cột
    const headers = 'Mã Phiếu,Ngày lập,Phân loại,Hạng mục,Diễn giải chứng từ,Hình thức,Số tiền (VND)\n';
    const rows = filteredTransactions.map((t) => {
      const code = t.type === 'thu' ? `PT-${t.id.substring(3, 8).toUpperCase()}` : `PC-${t.id.substring(3, 8).toUpperCase()}`;
      const typeStr = t.type === 'thu' ? 'Thu (+)' : 'Chi (-)';
      return `"${code}","${t.date}","${typeStr}","${t.category}","${t.description.replace(/"/g, '""')}","${t.paymentMethod}",${t.amount}`;
    }).join('\n');
    
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_quy_chi_tiet_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addLogMessage('[Kế toán] Đã kết xuất & xuất file Excel/CSV Sổ quỹ chi tiết thành công!', 'success');
  };

  // Xuất file CSV Công nợ khách hàng & nhà cung cấp
  const exportDebtToCSV = () => {
    // Header dòng cột
    const headers = 'Mã đối tác,Tên doanh nghiệp / Đối tác,Phân loại đối tác,Số điện thoại,Địa chỉ,Dư nợ hiện hữu (VND)\n';
    const rows = filteredPartners.map((p) => {
      const typeStr = p.type === 'customer' ? 'Khách hàng (Nợ ta)' : 'Nhà cung cấp (Ta nợ)';
      return `"${p.id}","${p.name}","${typeStr}","${p.phone}","${p.address.replace(/"/g, '""')}",${p.debt}`;
    }).join('\n');
    
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bao_cao_cong_no_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addLogMessage('[Công nợ] Đã kết xuất & xuất file Excel/CSV báo cáo công nợ chi tiết thành công!', 'success');
  };

  // --- EXPORT CIRCULAR 88 BOOKS TO CSV ---
  const exportS1ToCSV = () => {
    const headers = 'Ngày tháng ghi sổ,Số hiệu chứng từ,Ngày chứng từ,Diễn giải,Doanh thu Phân phối & Cung cấp hàng hóa (đ),Doanh thu Dịch vụ (đ),Doanh thu Sản xuất & Vận tải (đ),Doanh thu hoạt động khác (đ),Tổng Doanh thu (đ)\n';
    const rows = s1RevenueItems.map(item => {
      const d = item.categoryType === 'distribution' ? item.amount : 0;
      const s = item.categoryType === 'service' ? item.amount : 0;
      const p = item.categoryType === 'production' ? item.amount : 0;
      const o = item.categoryType === 'other' ? item.amount : 0;
      return `"${item.date.substring(0,10)}","${item.voucherId}","${item.date.substring(0,10)}","${item.description.replace(/"/g, '""')}",${d},${s},${p},${o},${item.amount}`;
    }).join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_S1_doanh_thu_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLogMessage('[Thông tư 88] Đã xuất thành công Sổ S1 - Chi tiết Doanh thu bán hàng hóa, dịch vụ.', 'success');
  };

  const exportS2ToCSV = () => {
    const data = s2LedgerData;
    if (!data.currentProduct) {
      addLogMessage('[Thông tư 88] Vui lòng chọn sản phẩm để xuất Sổ S2!', 'warning');
      return;
    }
    const headers = `Sổ chi tiết vật liệu dụng cụ sản phẩm hàng hóa - Tên sản phẩm: ${data.currentProduct.name} (SKU: ${data.currentProduct.sku})\n` + 
                    `Số dư đầu kỳ: ${data.openingStock} | Giá trị đầu kỳ: ${data.openingValue.toLocaleString()}đ\n\n` +
                    'Ngày hạch toán,Số chứng từ,Diễn giải,Số lượng Nhập,Đơn giá Nhập (đ),Thành tiền Nhập (đ),Số lượng Xuất,Đơn giá Xuất (đ),Thành tiền Xuất (đ),Số lượng Tồn,Thành tiền Tồn (đ)\n';
    const rows = data.movements.map(m => {
      const nQty = m.type === 'nhap' ? m.qty : '';
      const nPrice = m.type === 'nhap' ? m.price : '';
      const nVal = m.type === 'nhap' ? m.value : '';
      const xQty = m.type === 'xuat' ? m.qty : '';
      const xPrice = m.type === 'xuat' ? m.price : '';
      const xVal = m.type === 'xuat' ? m.value : '';
      return `"${m.date.substring(0,10)}","${m.voucherId}","${m.description.replace(/"/g, '""')}",${nQty},${nPrice},${nVal},${xQty},${xPrice},${xVal},${m.balanceQty},${m.balanceValue}`;
    }).join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_S2_kho_san_pham_${data.currentProduct.sku}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLogMessage(`[Thông tư 88] Đã xuất thành công Sổ S2 - Chi tiết sản phẩm "${data.currentProduct.name}".`, 'success');
  };

  const exportS3ToCSV = () => {
    const headers = 'Ngày hạch toán,Nội dung/Diễn giải,Tổng chi phí (đ),Chi phí nhân công (đ),Chi phí nguyên vật liệu (đ),Chi phí khấu hao TSCĐ (đ),Chi phí thuế phí (đ),Chi phí dịch vụ mua ngoài (đ),Chi phí bằng tiền khác (đ)\n';
    const rows = s3ExpensesList.map(e => {
      return `"${e.date.substring(0,10)}","${e.description.replace(/"/g, '""')}",${e.amount},${e.labor},${e.materials},${e.depreciation},${e.taxFee},${e.services},${e.others}`;
    }).join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_S3_chi_phi_SXKD_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLogMessage('[Thông tư 88] Đã xuất thành công Sổ S3 - Chi phí sản xuất kinh doanh.', 'success');
  };

  const exportS4ToCSV = () => {
    const tax = s4TaxLiabilities;
    const headers = 'Sổ theo dõi thực hiện nghĩa vụ thuế với NSNN\n' + 
                    `Tổng nghĩa vụ thuế ước tính: ${tax.totalTax.toLocaleString()}đ (GTGT: ${tax.totalGtgt.toLocaleString()}đ | TNCN: ${tax.totalTncn.toLocaleString()}đ)\n` +
                    `Tổng tiền thuế đã nộp ngân sách: ${totalTaxPaid.toLocaleString()}đ\n\n` +
                    'Ngày hạch toán,Số chứng từ / Phiếu chi,Nội dung chi nộp thuế,Số tiền đã nộp (đ),Hình thức chi\n';
    const rows = s4TaxPayments.map(p => {
      return `"${p.date.substring(0,10)}","PT-${p.id.substring(3,8).toUpperCase()}","${p.description.replace(/"/g, '""')}",${p.amount},"${p.paymentMethod}"`;
    }).join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_S4_nghia_vu_thue_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLogMessage('[Thông tư 88] Đã xuất thành công Sổ S4 - Thực hiện nghĩa vụ thuế với NSNN.', 'success');
  };

  const exportS5ToCSV = () => {
    const headers = 'Mã nhân viên,Họ và tên nhân viên,Chức vụ / Vai trò,Lương cơ bản (đ),Các khoản phụ cấp (đ),Khoản trích đóng bảo hiểm (đ),Lương thực nhận (đ),Trạng thái chi trả,Ngày chi lương\n';
    const rows = payrollEmployees.map(e => {
      return `"${e.id}","${e.name}","${e.role}",${e.baseSalary},${e.allowances},${e.insurance},${e.netPay},"${e.paymentStatus}","${e.payDate || 'Chưa chi'}"`;
    }).join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_S5_luong_nhan_vien_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLogMessage('[Thông tư 88] Đã xuất thành công Sổ S5 - Bảng theo dõi lương & bảo hiểm.', 'success');
  };

  return (
    <div id="ledger-complex-view" className="space-y-6">
      
      {/* Visual Navigation Sub-Tabs mimicking Sapo POS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-card p-3.5 rounded-2xl border border-border-hairline gap-3 shadow-xs">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('cash-ledger')}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cash-ledger'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-muted hover:text-ink hover:bg-bg-main'
            }`}
          >
            <Wallet className="h-4 w-4" />
            Sổ Quỹ Thu Chi & Dòng Tiền
          </button>
          <button
            onClick={() => setActiveTab('partner-debts')}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'partner-debts'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-muted hover:text-ink hover:bg-bg-main'
            }`}
          >
            <Users className="h-4 w-4" />
            Quản Lý Công Nợ ({partners.length})
          </button>
          <button
            onClick={() => setActiveTab('tt88-books')}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'tt88-books'
                ? 'bg-brand text-white shadow-xs animate-pulse-subtle'
                : 'text-ink-muted hover:text-ink hover:bg-bg-main border border-dashed border-border-hairline'
            }`}
          >
            <FileText className="h-4 w-4" />
            Sổ Sách Kế Toán (TT 88/2021/TT-BTC)
          </button>
        </div>
        <span className="text-[10px] bg-bg-main text-brand border border-border-hairline px-3 py-1.5 rounded-lg font-black font-mono tracking-wider uppercase shrink-0">
          Kế toán Hộ Kinh Doanh Chuyên Nghiệp
        </span>
      </div>

      {activeTab === 'cash-ledger' && (
        // --- 1. SỔ QUỸ THU CHI (CASH & BANK LEDGER) ---
        <div className="space-y-6">
          
          {/* Visual KPI Cards for Cash flow */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Opening Balance */}
            <div className="bg-surface-card p-4.5 rounded-xl border border-border-hairline flex justify-between items-center shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">Tồn quỹ đầu kỳ</span>
                <span className="text-xl font-bold font-mono text-ink">
                  {openingBalance.toLocaleString()}đ
                </span>
                <span className="text-[9px] text-ink-muted block">Số dư hạch toán ước tính</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-bg-main flex items-center justify-center text-ink-muted border border-border-hairline">
                <Coins className="h-5 w-5" />
              </div>
            </div>

            {/* Total Collected */}
            <div className="bg-surface-card p-4.5 rounded-xl border border-border-hairline flex justify-between items-center shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">Thu trong kỳ (+)</span>
                <span className="text-xl font-bold font-mono text-brand">
                  {totalThu.toLocaleString()}đ
                </span>
                <span className="text-[9px] text-ink-muted block">Doanh số POS, Sàn, thu nợ</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>

            {/* Total Spent */}
            <div className="bg-surface-card p-4.5 rounded-xl border border-border-hairline flex justify-between items-center shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">Chi trong kỳ (-)</span>
                <span className="text-xl font-bold font-mono text-danger">
                  {totalChi.toLocaleString()}đ
                </span>
                <span className="text-[9px] text-ink-muted block">Nhập kho, thuê nhà, lương, hủy đơn</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center text-danger">
                <ArrowDownRight className="h-5 w-5" />
              </div>
            </div>

            {/* Net Cashflow */}
            <div className="bg-surface-card p-4.5 rounded-xl border border-border-hairline flex justify-between items-center shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">Thặng dư dòng tiền</span>
                <span className={`text-xl font-bold font-mono ${(totalThu - totalChi) >= 0 ? 'text-brand' : 'text-danger'}`}>
                  {((totalThu - totalChi) >= 0 ? '+' : '')}{(totalThu - totalChi).toLocaleString()}đ
                </span>
                <span className="text-[9px] text-ink-muted block">Thu trừ Chi ròng trong kỳ</span>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold font-mono text-xs ${
                (totalThu - totalChi) >= 0 ? 'bg-brand/10 text-brand' : 'bg-danger/10 text-danger'
              }`}>
                {(totalThu - totalChi) >= 0 ? 'Thặng dư' : 'Thâm hụt'}
              </div>
            </div>

          </div>
          {/* Biểu đồ Dòng tiền 7 ngày gần nhất & Dự phòng dòng tiền */}
          <div className="bg-surface-card border border-border-hairline rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-hairline pb-3">
              <div>
                <h4 className="font-bold text-xs text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-brand" />
                  Xu hướng dòng tiền & Dự phòng thặng dư (7 ngày gần nhất)
                </h4>
                <p className="text-[10px] text-ink-muted mt-0.5">Biểu đồ trực quan so sánh nguồn Thu vào (+) và Chi ra (-) theo ngày khớp bộ lọc</p>
              </div>
              <div className="flex gap-4 text-[10px]">
                <span className="flex items-center gap-1 text-brand font-bold">
                  <span className="w-2.5 h-2.5 bg-brand block rounded-xs"></span>
                  Tổng Thu
                </span>
                <span className="flex items-center gap-1 text-danger font-bold">
                  <span className="w-2.5 h-2.5 bg-danger block rounded-xs"></span>
                  Tổng Chi
                </span>
              </div>
            </div>

            {dailyCashflowTrend.sortedDays.length === 0 ? (
              <div className="py-8 text-center text-ink-muted text-xs italic">
                Không có dữ liệu giao dịch thu chi nào trong kỳ lọc để hiển thị biểu đồ xu hướng.
              </div>
            ) : (
              <div className="space-y-5">
                {/* Chart Columns container */}
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-4 pt-2">
                  {dailyCashflowTrend.sortedDays.map(([date, val], idx) => {
                    const thuHeight = dailyCashflowTrend.maxVal > 0 ? (val.thu / dailyCashflowTrend.maxVal) * 80 : 0;
                    const chiHeight = dailyCashflowTrend.maxVal > 0 ? (val.chi / dailyCashflowTrend.maxVal) * 80 : 0;
                    const net = val.thu - val.chi;

                    return (
                      <div key={idx} className="bg-bg-main p-3 rounded-xl border border-border-hairline flex flex-col justify-between items-center space-y-2">
                        {/* Bars visual representation */}
                        <div className="h-24 w-full flex items-end justify-center gap-2 border-b border-border-hairline pb-1.5">
                          {/* Thu Column */}
                          <div className="w-3 rounded-t bg-brand/80 hover:bg-brand transition-all cursor-pointer relative group" style={{ height: `${Math.max(4, thuHeight)}px` }}>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-card border border-border-hairline text-[9px] font-mono font-bold text-brand px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-20">
                              +{val.thu.toLocaleString()}đ
                            </div>
                          </div>
                          {/* Chi Column */}
                          <div className="w-3 rounded-t bg-danger/80 hover:bg-danger transition-all cursor-pointer relative group" style={{ height: `${Math.max(4, chiHeight)}px` }}>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-card border border-border-hairline text-[9px] font-mono font-bold text-danger px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-20">
                              -{val.chi.toLocaleString()}đ
                            </div>
                          </div>
                        </div>

                        {/* Date label */}
                        <div className="text-center space-y-0.5 w-full">
                          <span className="text-[9px] text-ink-muted font-bold font-mono block">
                            {date.substring(8, 10)}/{date.substring(5, 7)}
                          </span>
                          <span className={`text-[9px] font-black font-mono block truncate ${net >= 0 ? 'text-brand' : 'text-danger'}`}>
                            {net >= 0 ? '+' : ''}{Math.round(net / 1000)}k
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI-driven automated Cashflow Forecast and health indicator */}
                <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-brand uppercase tracking-wider text-[10px] block">Dự phòng & Đánh giá dòng tiền</span>
                    <p className="text-ink-muted text-[11px] leading-relaxed">
                      Dòng tiền thu thuần trung bình đạt <strong className="text-brand">+{Math.round((totalThu - totalChi) / Math.max(1, dailyCashflowTrend.sortedDays.length)).toLocaleString()}đ / ngày</strong>. 
                      {totalThu > totalChi 
                        ? ' Cửa hàng đang có dòng tiền thặng dư cực tốt, rủi ro thanh khoản thấp. Nên cân nhắc quay vòng vốn nhanh.' 
                        : ' Dòng tiền hiện tại đang thâm hụt nhẹ. Bạn nên giảm nhập kho hàng hóa không bán chạy và hối thúc thu nợ thành viên.'}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 bg-surface-card px-3.5 py-2 rounded-lg border border-border-hairline">
                    <span className="text-ink-muted font-medium">Chỉ số Thanh khoản:</span>
                    <span className={`font-black font-mono text-[13px] ${totalThu > totalChi ? 'text-brand' : 'text-accent'}`}>
                      {totalThu > 0 ? ((totalThu / Math.max(1, totalChi)) * 100).toFixed(0) : '0'}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hộp công cụ đối soát & Chốt quỹ nhanh cuối ngày */}
          <div className="bg-surface-card border border-border-hairline rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-border-hairline pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-brand" />
                  Đối soát số dư & Chốt quỹ cuối ngày nhanh (EOD)
                </h4>
                <p className="text-[10px] text-ink-muted mt-0.5">
                  So sánh số dư lý thuyết trên ứng dụng với két thực tế hoặc số dư tài khoản ngân hàng để tự động cân bằng chênh lệch.
                </p>
              </div>
              <span className="px-2.5 py-0.5 bg-brand/10 text-brand border border-brand/20 rounded-md text-[9px] font-bold uppercase tracking-wider">
                Khuyên dùng: Hàng đêm
              </span>
            </div>

            {/* Sub-balances layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-bg-main border border-border-hairline rounded-xl space-y-1">
                <span className="text-[10px] text-ink-muted font-semibold block">Tiền mặt (Két thu ngân)</span>
                <span className="text-sm font-bold font-mono text-ink">{cashBalance.toLocaleString()}đ</span>
                <div className="text-[9px] text-ink-muted flex justify-between">
                  <span>Vốn mở két: 20,000,000đ</span>
                  <span>Lũy kế: {((cashBalance - 20000000) >= 0 ? '+' : '') + (cashBalance - 20000000).toLocaleString()}đ</span>
                </div>
              </div>
              <div className="p-3 bg-bg-main border border-border-hairline rounded-xl space-y-1">
                <span className="text-[10px] text-brand font-semibold block">Tài khoản Ngân hàng (Vietcombank)</span>
                <span className="text-sm font-bold font-mono text-brand">{bankBalance.toLocaleString()}đ</span>
                <div className="text-[9px] text-ink-muted flex justify-between">
                  <span>Vốn mở ví: 25,000,000đ</span>
                  <span>Lũy kế: {((bankBalance - 25000000) >= 0 ? '+' : '') + (bankBalance - 25000000).toLocaleString()}đ</span>
                </div>
              </div>
              <div className="p-3 bg-bg-main border border-border-hairline rounded-xl space-y-1">
                <span className="text-[10px] text-accent font-semibold block">Ví điện tử & Ví khác</span>
                <span className="text-sm font-bold font-mono text-accent">{walletBalance.toLocaleString()}đ</span>
                <div className="text-[9px] text-ink-muted flex justify-between">
                  <span>Vốn mở ví: 5,000,000đ</span>
                  <span>Lũy kế: {((walletBalance - 5000000) >= 0 ? '+' : '') + (walletBalance - 5000000).toLocaleString()}đ</span>
                </div>
              </div>
            </div>

            {/* Reconciliation Calculator form */}
            <div className="p-4 bg-bg-main rounded-xl border border-border-hairline grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-[11px] font-bold text-ink-muted">1. Chọn nguồn quỹ cần đối soát</label>
                <select
                  value={reconSource}
                  onChange={(e) => {
                    const src = e.target.value as 'cash' | 'bank' | 'wallet';
                    setReconSource(src);
                    setReconActual('');
                  }}
                  className="w-full px-2.5 py-2 bg-surface-card border border-border-hairline rounded-lg text-xs text-ink focus:outline-hidden focus:ring-1 focus:ring-brand cursor-pointer font-medium"
                >
                  <option value="cash">Tiền mặt (Két thu ngân) - Lý thuyết: {cashBalance.toLocaleString()}đ</option>
                  <option value="bank">Tài khoản Ngân hàng (Vietcombank) - Lý thuyết: {bankBalance.toLocaleString()}đ</option>
                  <option value="wallet">Ví điện tử & Ví khác - Lý thuyết: {walletBalance.toLocaleString()}đ</option>
                </select>
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-[11px] font-bold text-ink-muted">2. Số tiền thực tế đếm được (VND)</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Ví dụ: 23450000"
                    value={reconActual}
                    onChange={(e) => setReconActual(e.target.value)}
                    className="w-full pl-3 pr-10 py-1.5 bg-surface-card border border-border-hairline text-ink rounded-lg text-xs font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-brand"
                  />
                  <span className="absolute right-3 top-1.5 text-[10px] text-ink-muted font-bold font-mono">VND</span>
                </div>
              </div>

              {/* Dynamic Discrepancy Display & Quick Actions */}
              <div className="md:col-span-3 flex flex-col gap-2">
                {reconActual !== '' ? (
                  <>
                     <div className="flex justify-between items-center text-xs">
                      <span className="text-ink-muted font-medium">Chênh lệch:</span>
                      <span className={`font-mono font-bold text-sm ${reconDifference === 0 ? 'text-brand' : reconDifference > 0 ? 'text-accent' : 'text-danger'}`}>
                        {reconDifference === 0 
                          ? 'Khớp 100%' 
                          : `${reconDifference > 0 ? 'Thừa +' : 'Hụt '}${reconDifference.toLocaleString()}đ`}
                      </span>
                    </div>
                    {reconDifference !== 0 ? (
                      <button
                        onClick={handleAutoAdjustBalance}
                        className={`w-full py-2 px-3 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs ${
                          reconDifference > 0 
                            ? 'bg-accent hover:bg-accent-hover text-white' 
                            : 'bg-danger hover:bg-danger-hover text-white'
                        }`}
                      >
                        {reconDifference > 0 
                          ? '✓ Cân bằng: Thu thừa quỹ' 
                          : '✗ Cân bằng: Bù hụt quỹ'}
                      </button>
                    ) : (
                      <div className="py-2 text-center text-brand text-[10px] font-bold bg-brand/10 border border-brand/20 rounded-lg">
                        🎉 Khớp tuyệt đối! Không cần bù.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[10px] text-ink-muted italic py-1 text-center border border-dashed border-border-hairline rounded-lg bg-surface-card/40">
                    Nhập số thực tế để kiểm lệch
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filters Bar: Account & Period */}
          <div className="bg-surface-card p-4 border border-border-hairline rounded-2xl shadow-xs space-y-3">
            
            {/* Quick selectors row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline pb-3">
              
              {/* Account selection */}
              <div className="flex gap-1.5 bg-bg-main p-1 rounded-xl border border-border-hairline shrink-0">
                {[
                  { id: 'all', name: 'Tất cả tài khoản' },
                  { id: 'cash', name: 'Quỹ Tiền mặt' },
                  { id: 'bank', name: 'Quỹ Ngân hàng (QR)' },
                  { id: 'wallet', name: 'Ví Điện tử' }
                ].map((acct) => (
                  <button
                    key={acct.id}
                    onClick={() => setAccountFilter(acct.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      accountFilter === acct.id
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {acct.name}
                  </button>
                ))}
              </div>

              {/* Date selection */}
              <div className="flex gap-1.5 bg-bg-main p-1 rounded-xl border border-border-hairline shrink-0">
                {[
                  { id: 'all', name: 'Tất cả thời gian' },
                  { id: 'today', name: 'Hôm nay' },
                  { id: 'yesterday', name: 'Hôm qua' },
                  { id: 'week', name: 'Tuần này' },
                  { id: 'month', name: 'Tháng này' }
                ].map((period) => (
                  <button
                    key={period.id}
                    onClick={() => setDateRange(period.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dateRange === period.id
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {period.name}
                  </button>
                ))}
              </div>

            </div>

            {/* Filter Input row */}
            <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between">
              
              <div className="flex gap-1 bg-bg-main p-1 rounded-lg border border-border-hairline shrink-0">
                {(['all', 'thu', 'chi'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                      typeFilter === t
                        ? 'bg-surface-card border border-border-hairline text-ink shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t === 'all' ? 'Tất cả phiếu' : t === 'thu' ? 'Chỉ Phiếu THU (+)' : 'Chỉ Phiếu CHI (-)'}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap md:flex-nowrap gap-2 items-center flex-1 justify-end w-full">
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
                  <input
                    type="text"
                    placeholder="Tìm theo nội dung, tài khoản..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-bg-main border border-border-hairline rounded-lg text-xs w-full focus:ring-1 focus:ring-brand focus:outline-hidden text-ink placeholder-ink-muted font-medium"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-2 bg-bg-main border border-border-hairline rounded-lg text-xs focus:outline-hidden text-ink font-medium cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-surface-card text-ink">{c}</option>
                  ))}
                </select>

                <button
                  onClick={exportCashbookToCSV}
                  className="px-3.5 py-2 bg-bg-main text-ink border border-border-hairline rounded-lg font-bold text-xs hover:bg-bg-main/80 shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  title="Xuất file báo cáo dạng CSV để hạch toán bằng Excel"
                >
                  <Download className="h-4 w-4" />
                  Xuất Sổ Quỹ
                </button>

                <button
                  onClick={() => setIsFormOpen(true)}
                  className="px-4 py-2 bg-brand text-white rounded-lg font-bold text-xs hover:bg-brand-hover shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Lập phiếu Thu/Chi
                </button>
              </div>

            </div>

          </div>

          {/* Layout Grid: Sổ quỹ chi tiết và Phân tích cơ cấu chi tiêu */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Cột trái: Sổ quỹ chi tiết (col-span-8) */}
            <div className="lg:col-span-8 bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-brand" />
                  <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Sổ quỹ chi tiết ({filteredTransactions.length} chứng từ)</h3>
                </div>
                <span className="text-[10px] text-ink-muted italic">Dòng tiền thực tế Sapo & KiotViet</span>
              </div>

              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border-hairline flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Mã Phiếu / Ngày lập</th>
                      <th className="py-3 px-4 text-center">Phân loại</th>
                      <th className="py-3 px-4">Hạng mục thu chi</th>
                      <th className="py-3 px-4">Diễn giải nội dung chứng từ</th>
                      <th className="py-3 px-4">Phương thức thanh toán</th>
                      <th className="py-3 px-4 text-right">Số tiền (VND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-bg-main/30 transition-colors text-ink">
                        {/* Date & ID */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-brand font-mono text-[10px]">
                              {t.type === 'thu' ? `PT-${t.id.substring(3, 8).toUpperCase()}` : `PC-${t.id.substring(3, 8).toUpperCase()}`}
                            </span>
                            <span className="text-ink-muted font-mono text-[9px] mt-0.5">{t.date}</span>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border ${
                            t.type === 'thu'
                              ? 'bg-brand/10 text-brand border-brand/20'
                              : 'bg-danger/10 text-danger border-danger/20'
                          }`}>
                            {t.type === 'thu' ? 'Thu (+)' : 'Chi (-)'}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 text-ink font-bold">
                          {t.category}
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4 text-ink-muted max-w-xs truncate" title={t.description}>
                          {t.description}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4 text-ink-muted font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 bg-bg-main px-2 py-1 rounded border border-border-hairline text-[10px]">
                            <CreditCard className="h-3 w-3 text-brand" />
                            {t.paymentMethod}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className={`py-3 px-4 text-right font-mono font-black text-[13px] ${
                          t.type === 'thu' ? 'text-brand' : 'text-danger'
                        }`}>
                          {t.type === 'thu' ? '+' : '-'}{t.amount.toLocaleString()}đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredTransactions.length === 0 && (
                <div className="p-12 text-center text-ink-muted flex flex-col items-center justify-center space-y-1.5 flex-1">
                  <ClipboardList className="h-8 w-8 text-ink-muted stroke-1" />
                  <p className="text-xs">Không tìm thấy bản ghi thu chi nào trong kỳ lọc.</p>
                </div>
              )}
            </div>

            {/* Cột phải: Phân tích cơ cấu chi tiêu dòng tiền (col-span-4) */}
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-surface-card border border-border-hairline rounded-2xl p-4.5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-border-hairline pb-3">
                  <TrendingUp className="h-4 w-4 text-brand" />
                  <h4 className="font-bold text-xs text-ink uppercase tracking-wider">Cơ cấu Chi tiêu Dòng tiền</h4>
                </div>
                
                {cashbookStats.totalExpense === 0 ? (
                  <div className="py-12 text-center text-ink-muted text-xs italic">
                    Không có chi tiêu phát sinh trong kỳ lọc này để phân tích.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-bg-main p-3 rounded-xl border border-border-hairline">
                      <div className="flex justify-between text-[11px] text-ink-muted items-center">
                        <span>Tổng tiền đã chi ra:</span>
                        <span className="font-mono font-bold text-danger">-{cashbookStats.totalExpense.toLocaleString()}đ</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3.5">
                      {cashbookStats.expenseBreakdown.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-ink font-medium truncate max-w-[130px]" title={item.category}>
                              {item.category}
                            </span>
                            <span className="font-mono text-ink-muted text-[11px] whitespace-nowrap">
                              {item.amount.toLocaleString()}đ ({item.percent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-bg-main h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                idx === 0 ? 'bg-brand' : idx === 1 ? 'bg-accent' : 'bg-danger'
                              }`} 
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-bg-main p-2.5 rounded-lg border border-border-hairline text-[10px] text-ink-muted italic leading-relaxed">
                      💡 Phân tích tự động: Hạng mục <strong className="text-brand">"{cashbookStats.expenseBreakdown[0]?.category}"</strong> chiếm tỷ trọng chi lớn nhất với {cashbookStats.expenseBreakdown[0]?.percent.toFixed(1)}%.
                    </div>
                  </div>
                )}
              </div>
              
              {/* Hướng dẫn tối ưu dòng tiền của Sapo */}
              <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4.5 space-y-2.5">
                <h5 className="font-bold text-xs text-brand uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-brand" />
                  Đề xuất tối ưu dòng tiền
                </h5>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Hệ thống nhận thấy bạn có thể cải thiện vòng quay tiền mặt bằng cách thúc đẩy thu hồi nợ từ các Đại lý mua chịu và thương lượng kéo dài thêm kỳ hạn thanh toán công nợ cho các NPP sữa, bia Heineken.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

      {activeTab === 'partner-debts' && (
        <div className="space-y-6">
          
          {/* Debt Summary KPI banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-surface-card p-5 rounded-xl border border-border-hairline flex justify-between items-center shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">Tổng Khách Nợ (Phải thu Đại lý)</span>
                <span className="text-2xl font-black font-mono text-brand">
                  {debtTotals.customerDebts.toLocaleString()}đ
                </span>
                <span className="text-[9px] text-ink-muted block">Dư nợ từ các đại lý, khách sỉ, khách mua chịu</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-xl">
                +₫
              </div>
            </div>

            <div className="bg-surface-card p-5 rounded-xl border border-border-hairline flex justify-between items-center shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider block">Tổng Nợ Nhà Cung Cấp (Phải trả)</span>
                <span className="text-2xl font-black font-mono text-danger">
                  {debtTotals.supplierDebts.toLocaleString()}đ
                </span>
                <span className="text-[9px] text-ink-muted block">Phải thanh toán đối soát cho các nhà phân phối</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger font-bold text-xl">
                -₫
              </div>
            </div>

            <div className="bg-brand/5 p-5 rounded-xl border border-brand/20 flex justify-between items-center shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-brand font-bold uppercase tracking-wider block">Hiệu Số Công Nợ</span>
                <span className={`text-2xl font-black font-mono ${
                  (debtTotals.customerDebts - debtTotals.supplierDebts) >= 0 ? 'text-brand' : 'text-danger'
                }`}>
                  {(debtTotals.customerDebts - debtTotals.supplierDebts).toLocaleString()}đ
                </span>
                <span className="text-[9px] text-ink-muted block">Hiệu số tài sản nợ thu về và phải chi</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-lg border border-brand">
                Δ
              </div>
            </div>

          </div>

          {/* Action & Filter bar */}
          <div className="bg-surface-card p-4 border border-border-hairline rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex gap-1 bg-bg-main p-1 rounded-xl border border-border-hairline shrink-0">
              {[
                { id: 'all', name: 'Tất cả đối tác' },
                { id: 'customer', name: 'Khách hàng (Phải thu)' },
                { id: 'supplier', name: 'Nhà cung cấp (Phải trả)' }
              ].map((pType) => (
                <button
                  key={pType.id}
                  onClick={() => setPartnerTypeFilter(pType.id as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    partnerTypeFilter === pType.id
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {pType.name}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center flex-1 justify-end w-full">
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, SĐT, địa chỉ đối tác..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-bg-main border border-border-hairline rounded-lg text-xs w-full focus:ring-1 focus:ring-brand focus:outline-hidden text-ink placeholder-ink-muted font-medium"
                />
              </div>

              <button
                onClick={exportDebtToCSV}
                className="px-3.5 py-2 bg-bg-main text-ink border border-border-hairline rounded-lg font-bold text-xs hover:bg-bg-main/80 shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                title="Xuất file báo cáo công nợ dạng CSV để đối soát bằng Excel"
              >
                <Download className="h-4 w-4" />
                Xuất Công Nợ
              </button>

              <button
                onClick={() => setIsNewPartnerOpen(true)}
                className="px-4 py-2 bg-brand text-white rounded-lg font-bold text-xs hover:bg-brand-hover shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                Thêm đối tác mới
              </button>
            </div>

          </div>

          {/* Partners Debt list table */}
          <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-brand" />
                <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Danh sách dư nợ chi tiết ({filteredPartners.length} đối tác)</h3>
              </div>
              <span className="text-[10px] text-ink-muted italic">Được kết nối đồng bộ dòng tiền tự động</span>
            </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border-hairline">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Tên Đối Tác</th>
                    <th className="py-3 px-4">Phân loại</th>
                    <th className="py-3 px-4 font-mono">SĐT Liên hệ</th>
                    <th className="py-3 px-4">Địa chỉ chi tiết</th>
                    <th className="py-3 px-4 text-right">Dư nợ hiện tại (VND)</th>
                    <th className="py-3 px-4 text-center">Hành động dốc nợ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline">
                  {filteredPartners.map((p) => (
                    <tr key={p.id} className="hover:bg-bg-main/30 transition-colors text-ink">
                      {/* Name with icon */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            p.type === 'customer' 
                              ? 'bg-brand/10 text-brand border border-brand/20' 
                              : 'bg-accent/10 text-accent border border-accent/20'
                          }`}>
                            {p.type === 'customer' ? 'KH' : 'NCC'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-ink">{p.name}</span>
                            {p.dueDate && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-ink-muted font-mono">Hạn: {p.dueDate}</span>
                                {new Date(p.dueDate) < new Date() && p.debt > 0 ? (
                                  <span className="inline-flex px-1 bg-danger/10 text-danger font-bold text-[8px] rounded border border-danger/25 uppercase tracking-wider scale-95 origin-left animate-pulse">
                                    Quá hạn
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          p.type === 'customer'
                            ? 'bg-brand/10 text-brand border-brand/20'
                            : 'bg-accent/10 text-accent border border-accent/20'
                        }`}>
                          {p.type === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-ink-muted">
                        {p.phone}
                      </td>

                      {/* Address */}
                      <td className="py-3 px-4 text-ink-muted max-w-xs truncate" title={p.address}>
                        {p.address}
                      </td>

                      {/* Debt balance */}
                      <td className={`py-3 px-4 text-right font-mono font-black text-[13px] ${
                        p.debt > 0 
                          ? p.type === 'customer' ? 'text-brand' : 'text-danger'
                          : 'text-ink-muted'
                      }`}>
                        {p.debt.toLocaleString()}đ
                      </td>

                      {/* Debt clearance actions */}
                      <td className="py-3 px-4 text-center">
                        {p.debt > 0 ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedPartnerForDebt(p);
                                setDebtActionType(p.type === 'customer' ? 'collect' : 'pay');
                                setDebtAmount(p.debt);
                                setDebtDesc(`Thu nợ/Thanh toán dứt điểm đối tác ${p.name}`);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                                p.type === 'customer'
                                  ? 'bg-brand hover:bg-brand-hover'
                                  : 'bg-danger hover:bg-danger-hover'
                              }`}
                            >
                              {p.type === 'customer' ? 'Thu tiền nợ' : 'Trả tiền nợ'}
                            </button>
                            <button
                              onClick={() => handleCopyDebtReminder(p)}
                              className="p-1.5 bg-bg-main hover:bg-bg-main/80 text-brand border border-border-hairline rounded-lg transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
                              title="Sao chép mẫu tin nhắc nợ nhanh gửi Zalo/SMS"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-brand font-bold bg-brand/10 border border-brand/20 px-2 py-1 rounded-lg select-none">✓ Không có nợ</span>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredPartners.length === 0 && (
              <div className="p-12 text-center text-ink-muted">
                Không tìm thấy đối tác nào phù hợp bộ lọc.
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'tt88-books' && (
        <div className="space-y-6">
          {/* Sub-tab selection bar */}
          <div className="bg-surface-card p-4 border border-border-hairline rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border-hairline pb-4 gap-4">
              <div>
                <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-brand" />
                  SỔ SÁCH KẾ TOÁN CHÍNH THỨC THEO THÔNG TƯ 88/2021/TT-BTC
                </h3>
                <p className="text-[10px] text-ink-muted mt-1 leading-relaxed">
                  Đồng bộ dữ liệu thời gian thực từ đơn hàng Shopee, TikTok Shop, POS Offline và hạch toán thuế suất hợp pháp của Bộ Tài chính Việt Nam.
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedBook === 's1') exportS1ToCSV();
                    else if (selectedBook === 's2') exportS2ToCSV();
                    else if (selectedBook === 's3') exportS3ToCSV();
                    else if (selectedBook === 's4') exportS4ToCSV();
                    else exportS5ToCSV();
                  }}
                  className="px-4 py-2 bg-brand text-white rounded-lg font-bold text-xs hover:bg-brand/90 shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Kết xuất Sổ {selectedBook.toUpperCase()} (.CSV)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { id: 's1', code: 'Sổ S1', title: 'Chi tiết Doanh thu', desc: 'Doanh thu hàng hóa, dịch vụ' },
                { id: 's2', code: 'Sổ S2', title: 'Chi tiết Kho hàng', desc: 'Nhập xuất tồn kho chi tiết' },
                { id: 's3', code: 'Sổ S3', title: 'Chi phí SXKD', desc: 'Lao động, vật liệu, dịch vụ' },
                { id: 's4', code: 'Sổ S4', title: 'Nghĩa vụ Thuế', desc: 'Trích đóng nộp ngân sách' },
                { id: 's5', code: 'Sổ S5', title: 'Thanh toán Lương', desc: 'Bảng lương & bảo hiểm nv' }
              ].map(book => (
                <button
                  key={book.id}
                  onClick={() => setSelectedBook(book.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                    selectedBook === book.id
                      ? 'bg-brand/10 border-brand text-brand shadow-xs font-bold'
                      : 'bg-bg-main/30 border-border-hairline text-ink-muted hover:border-ink-muted/50 hover:bg-bg-main'
                  }`}
                >
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider block">{book.code}</span>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold block text-ink">{book.title}</span>
                    <span className="text-[8px] text-ink-muted block truncate">{book.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* SỔ S1: DOANH THU */}
          {selectedBook === 's1' && (
            <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-brand text-white text-[9px] font-mono font-black rounded">Sổ S1</span>
                  <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Sổ chi tiết doanh thu bán hàng hóa, dịch vụ</h3>
                </div>
                <span className="text-[10px] text-brand bg-brand/5 px-2.5 py-1 rounded border border-brand/15 font-bold font-mono">
                  Tổng Doanh Thu Hạch Toán: {s1RevenueItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}đ
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Ngày ghi sổ</th>
                      <th className="py-3 px-4">Mã chứng từ</th>
                      <th className="py-3 px-4">Diễn giải nội dung</th>
                      <th className="py-3 px-4 text-right">Phân phối hàng hóa (1.5%)</th>
                      <th className="py-3 px-4 text-right">Dịch vụ (7%)</th>
                      <th className="py-3 px-4 text-right">Sản xuất, vận tải (4.5%)</th>
                      <th className="py-3 px-4 text-right">Hoạt động khác (3%)</th>
                      <th className="py-3 px-4 text-right font-bold">Tổng doanh thu (VND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline font-mono">
                    {s1RevenueItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-bg-main/30 transition-colors text-ink">
                        <td className="py-3 px-4 font-sans text-ink-muted">{item.date.substring(0, 16)}</td>
                        <td className="py-3 px-4 font-bold text-brand">{item.voucherId}</td>
                        <td className="py-3 px-4 font-sans text-ink max-w-xs truncate" title={item.description}>{item.description}</td>
                        <td className="py-3 px-4 text-right text-ink">
                          {item.categoryType === 'distribution' ? `${item.amount.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {item.categoryType === 'service' ? `${item.amount.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {item.categoryType === 'production' ? `${item.amount.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {item.categoryType === 'other' ? `${item.amount.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-brand bg-brand/5">
                          {item.amount.toLocaleString()}đ
                        </td>
                      </tr>
                    ))}
                    {s1RevenueItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-ink-muted font-sans">
                          Chưa ghi nhận doanh thu phát sinh trong kỳ.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SỔ S2: CHI TIẾT KHO HÀNG */}
          {selectedBook === 's2' && (
            <div className="space-y-4">
              {/* Product selector widget */}
              <div className="bg-surface-card p-4 border border-border-hairline rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-brand text-white text-[9px] font-mono font-black rounded">Sổ S2</span>
                    Chọn sản phẩm lập thẻ kho chi tiết
                  </h4>
                  <p className="text-[10px] text-ink-muted">
                    Tính toán số dư tồn kho, đơn giá và giá trị xuất nhập từng thời điểm.
                  </p>
                </div>
                
                <div className="min-w-64">
                  <select
                    value={selectedS2ProductId}
                    onChange={(e) => setSelectedS2ProductId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-hidden cursor-pointer"
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - Hiện tồn: {p.stock}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* S2 ledger results */}
              {selectedS2ProductId ? (
                <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-ink-muted font-mono">THẺ KHO CHI TIẾT SẢN PHẨM</span>
                      <span className="font-bold text-sm text-brand">{s2LedgerData.currentProduct?.name}</span>
                      <span className="text-[10px] text-ink-muted">SKU: {s2LedgerData.currentProduct?.sku} | Đơn vị tính: {s2LedgerData.currentProduct?.unit} | Đơn giá vốn: {s2LedgerData.currentProduct?.cost.toLocaleString()}đ</span>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-bg-main/50 border border-border-hairline p-2 rounded-xl text-center min-w-28">
                        <span className="text-[9px] text-ink-muted font-bold block">Tồn đầu kỳ</span>
                        <span className="text-xs font-bold font-mono text-ink">{s2LedgerData.openingStock} {s2LedgerData.currentProduct?.unit}</span>
                        <span className="text-[8px] text-ink-muted block font-mono">({s2LedgerData.openingValue.toLocaleString()}đ)</span>
                      </div>
                      <div className="bg-brand/10 border border-brand/20 p-2 rounded-xl text-center min-w-28 animate-pulse-subtle">
                        <span className="text-[9px] text-brand font-bold block">Tồn hiện tại</span>
                        <span className="text-xs font-bold font-mono text-brand">{s2LedgerData.currentProduct?.stock} {s2LedgerData.currentProduct?.unit}</span>
                        <span className="text-[8px] text-ink-muted block font-mono">({((s2LedgerData.currentProduct?.stock || 0) * (s2LedgerData.currentProduct?.cost || 0)).toLocaleString()}đ)</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4" rowSpan={2}>Ngày hạch toán</th>
                          <th className="py-3 px-4" rowSpan={2}>Mã chứng từ</th>
                          <th className="py-3 px-4" rowSpan={2}>Diễn giải chi tiết</th>
                          <th className="py-3 px-4 text-center border-b border-border-hairline" colSpan={3}>Nhập kho</th>
                          <th className="py-3 px-4 text-center border-b border-border-hairline" colSpan={3}>Xuất kho</th>
                          <th className="py-3 px-4 text-center border-b border-border-hairline" colSpan={2}>Số dư tồn kho</th>
                        </tr>
                        <tr className="bg-bg-main/50 border-b border-border-hairline text-ink-muted text-[9px] font-bold">
                          <th className="py-1 px-2 text-right">SL</th>
                          <th className="py-1 px-2 text-right">Đơn giá</th>
                          <th className="py-1 px-2 text-right">Thành tiền</th>
                          <th className="py-1 px-2 text-right">SL</th>
                          <th className="py-1 px-2 text-right">Đơn giá</th>
                          <th className="py-1 px-2 text-right">Thành tiền</th>
                          <th className="py-1 px-2 text-right">SL</th>
                          <th className="py-1 px-2 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-hairline font-mono">
                        {/* Dòng Tồn Đầu Kỳ */}
                        <tr className="bg-bg-main/10 font-bold">
                          <td className="py-2.5 px-4 font-sans text-ink-muted" colSpan={3}>TỒN ĐẦU KỲ HẠCH TOÁN (ƯỚC TÍNH)</td>
                          <td className="py-2.5 px-2 text-right">-</td>
                          <td className="py-2.5 px-2 text-right">-</td>
                          <td className="py-2.5 px-2 text-right">-</td>
                          <td className="py-2.5 px-2 text-right">-</td>
                          <td className="py-2.5 px-2 text-right">-</td>
                          <td className="py-2.5 px-2 text-right">-</td>
                          <td className="py-2.5 px-2 text-right text-brand">{s2LedgerData.openingStock}</td>
                          <td className="py-2.5 px-2 text-right text-brand">{s2LedgerData.openingValue.toLocaleString()}đ</td>
                        </tr>

                        {s2LedgerData.movements.map((m, idx) => (
                          <tr key={idx} className="hover:bg-bg-main/30 transition-colors text-ink">
                            <td className="py-3 px-4 font-sans text-ink-muted">{m.date.substring(0, 10)}</td>
                            <td className={`py-3 px-4 font-bold ${m.type === 'nhap' ? 'text-brand' : 'text-accent'}`}>{m.voucherId}</td>
                            <td className="py-3 px-4 font-sans text-ink max-w-xs truncate" title={m.description}>{m.description}</td>
                            
                            {/* Nhập */}
                            <td className="py-3 px-2 text-right font-bold text-brand">
                              {m.type === 'nhap' ? m.qty : '-'}
                            </td>
                            <td className="py-3 px-2 text-right text-ink-muted">
                              {m.type === 'nhap' ? `${m.price.toLocaleString()}đ` : '-'}
                            </td>
                            <td className="py-3 px-2 text-right text-brand">
                              {m.type === 'nhap' ? `${m.value.toLocaleString()}đ` : '-'}
                            </td>

                            {/* Xuất */}
                            <td className="py-3 px-2 text-right font-bold text-accent">
                              {m.type === 'xuat' ? m.qty : '-'}
                            </td>
                            <td className="py-3 px-2 text-right text-ink-muted">
                              {m.type === 'xuat' ? `${m.price.toLocaleString()}đ` : '-'}
                            </td>
                            <td className="py-3 px-2 text-right text-accent">
                              {m.type === 'xuat' ? `${m.value.toLocaleString()}đ` : '-'}
                            </td>

                            {/* Tồn */}
                            <td className="py-3 px-2 text-right text-ink font-bold bg-bg-main/10">
                              {m.balanceQty}
                            </td>
                            <td className="py-3 px-2 text-right text-ink font-bold bg-bg-main/20">
                              {m.balanceValue?.toLocaleString()}đ
                            </td>
                          </tr>
                        ))}

                        {s2LedgerData.movements.length === 0 && (
                          <tr>
                            <td colSpan={11} className="py-8 text-center text-ink-muted font-sans">
                              Không có giao dịch xuất nhập kho nào được ghi nhận cho sản phẩm này.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-card p-12 text-center text-ink-muted border border-border-hairline rounded-2xl">
                  Hãy chọn một sản phẩm từ danh sách phía trên để truy xuất Thẻ Kho (Sổ S2) chi tiết.
                </div>
              )}
            </div>
          )}

          {/* SỔ S3: CHI PHÍ SXKD */}
          {selectedBook === 's3' && (
            <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-brand text-white text-[9px] font-mono font-black rounded">Sổ S3</span>
                  <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Sổ chi phí sản xuất, kinh doanh chi tiết</h3>
                </div>
                <span className="text-[10px] text-danger bg-danger/5 px-2.5 py-1 rounded border border-danger/15 font-bold font-mono">
                  Tổng Chi Phí Hoạt Động: {s3Totals.total.toLocaleString()}đ
                </span>
              </div>

              {/* S3 Cost classification KPI panel */}
              <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-border-hairline bg-bg-main/15 border-b border-border-hairline">
                <div className="p-4.5 space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-wider block text-ink-muted">1. Nhân Công</span>
                  <span className="text-sm font-bold font-mono text-ink block">{s3Totals.labor.toLocaleString()}đ</span>
                </div>
                <div className="p-4.5 space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-wider block text-ink-muted">2. Vật liệu, Hàng hóa</span>
                  <span className="text-sm font-bold font-mono text-ink block">{s3Totals.materials.toLocaleString()}đ</span>
                </div>
                <div className="p-4.5 space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-wider block text-ink-muted">3. Khấu hao TSCĐ</span>
                  <span className="text-sm font-bold font-mono text-ink block">{s3Totals.depreciation.toLocaleString()}đ</span>
                </div>
                <div className="p-4.5 space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-wider block text-ink-muted">4. Thuế, Phí, Lệ phí</span>
                  <span className="text-sm font-bold font-mono text-ink block">{s3Totals.taxFee.toLocaleString()}đ</span>
                </div>
                <div className="p-4.5 space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-wider block text-ink-muted">5. Dịch vụ mua ngoài</span>
                  <span className="text-sm font-bold font-mono text-ink block">{s3Totals.services.toLocaleString()}đ</span>
                </div>
                <div className="p-4.5 space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-wider block text-ink-muted">6. Bằng tiền khác</span>
                  <span className="text-sm font-bold font-mono text-ink block">{s3Totals.others.toLocaleString()}đ</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Ngày hạch toán</th>
                      <th className="py-3 px-4">Mô tả / Diễn giải nội dung</th>
                      <th className="py-3 px-4 text-right">Nhân công</th>
                      <th className="py-3 px-4 text-right">NVL/Hàng hóa</th>
                      <th className="py-3 px-4 text-right">Khấu hao</th>
                      <th className="py-3 px-4 text-right">Thuế & Phí</th>
                      <th className="py-3 px-4 text-right">Dịch vụ mua ngoài</th>
                      <th className="py-3 px-4 text-right">Chi phí khác</th>
                      <th className="py-3 px-4 text-right font-bold">Tổng chi (đ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline font-mono">
                    {s3ExpensesList.map((e, idx) => (
                      <tr key={idx} className="hover:bg-bg-main/30 transition-colors text-ink">
                        <td className="py-3 px-4 font-sans text-ink-muted">{e.date.substring(0, 10)}</td>
                        <td className="py-3 px-4 font-sans text-ink max-w-xs truncate" title={e.description}>{e.description}</td>
                        <td className="py-3 px-4 text-right text-ink">
                          {e.labor > 0 ? `${e.labor.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {e.materials > 0 ? `${e.materials.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {e.depreciation > 0 ? `${e.depreciation.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {e.taxFee > 0 ? `${e.taxFee.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {e.services > 0 ? `${e.services.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-ink">
                          {e.others > 0 ? `${e.others.toLocaleString()}đ` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-danger bg-danger/5">
                          {e.amount.toLocaleString()}đ
                        </td>
                      </tr>
                    ))}
                    {s3ExpensesList.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-ink-muted font-sans">
                          Chưa phát sinh chứng từ chi tiêu trong kỳ lọc này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SỔ S4: NGHĨA VỤ THUẾ */}
          {selectedBook === 's4' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Tax Liability Calculator */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-brand text-white text-[9px] font-mono font-black rounded">Sổ S4</span>
                      <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Bảng kê phát sinh thuế trên Doanh thu (Khoán/Tỷ lệ)</h3>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Nhóm ngành kinh doanh</th>
                          <th className="py-3 px-4 text-right">Doanh thu phát sinh</th>
                          <th className="py-3 px-4 text-center">Thuế GTGT</th>
                          <th className="py-3 px-4 text-center">Thuế TNCN</th>
                          <th className="py-3 px-4 text-right">Tổng thuế phải nộp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-hairline font-mono text-ink">
                        {/* 1. Phân phối */}
                        <tr className="hover:bg-bg-main/30">
                          <td className="py-3 px-4 font-sans">
                            <span className="font-bold block text-ink">Phân phối, cung cấp hàng hóa</span>
                            <span className="text-[10px] text-ink-muted">Bán lẻ tạp hóa, bia rượu sữa bỉm v.v.</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{s4TaxLiabilities.revDist.toLocaleString()}đ</td>
                          <td className="py-3 px-4 text-center text-ink-muted">1.0% ({s4TaxLiabilities.taxDistGtgt.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-center text-ink-muted">0.5% ({s4TaxLiabilities.taxDistTncn.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-right font-black text-brand bg-brand/5">
                            {(s4TaxLiabilities.taxDistGtgt + s4TaxLiabilities.taxDistTncn).toLocaleString()}đ
                          </td>
                        </tr>

                        {/* 2. Dịch vụ */}
                        <tr className="hover:bg-bg-main/30">
                          <td className="py-3 px-4 font-sans">
                            <span className="font-bold block text-ink">Dịch vụ, thiết kế, quảng cáo</span>
                            <span className="text-[10px] text-ink-muted">Cho thuê, dịch vụ sửa chữa thiết bị</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{s4TaxLiabilities.revServ.toLocaleString()}đ</td>
                          <td className="py-3 px-4 text-center text-ink-muted">5.0% ({s4TaxLiabilities.taxServGtgt.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-center text-ink-muted">2.0% ({s4TaxLiabilities.taxServTncn.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-right font-black text-brand bg-brand/5">
                            {(s4TaxLiabilities.taxServGtgt + s4TaxLiabilities.taxServTncn).toLocaleString()}đ
                          </td>
                        </tr>

                        {/* 3. Sản xuất */}
                        <tr className="hover:bg-bg-main/30">
                          <td className="py-3 px-4 font-sans">
                            <span className="font-bold block text-ink">Sản xuất, vận tải, dịch vụ kèm hàng</span>
                            <span className="text-[10px] text-ink-muted">Tự pha chế cafe ăn uống, vận chuyển hàng</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{s4TaxLiabilities.revProd.toLocaleString()}đ</td>
                          <td className="py-3 px-4 text-center text-ink-muted">3.0% ({s4TaxLiabilities.taxProdGtgt.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-center text-ink-muted">1.5% ({s4TaxLiabilities.taxProdTncn.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-right font-black text-brand bg-brand/5">
                            {(s4TaxLiabilities.taxProdGtgt + s4TaxLiabilities.taxProdTncn).toLocaleString()}đ
                          </td>
                        </tr>

                        {/* 4. Khác */}
                        <tr className="hover:bg-bg-main/30">
                          <td className="py-3 px-4 font-sans">
                            <span className="font-bold block text-ink">Hoạt động kinh doanh khác</span>
                            <span className="text-[10px] text-ink-muted">Các hoạt động nằm ngoài phân loại</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{s4TaxLiabilities.revOther.toLocaleString()}đ</td>
                          <td className="py-3 px-4 text-center text-ink-muted">2.0% ({s4TaxLiabilities.taxOtherGtgt.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-center text-ink-muted">1.0% ({s4TaxLiabilities.taxOtherTncn.toLocaleString()}đ)</td>
                          <td className="py-3 px-4 text-right font-black text-brand bg-brand/5">
                            {(s4TaxLiabilities.taxOtherGtgt + s4TaxLiabilities.taxOtherTncn).toLocaleString()}đ
                          </td>
                        </tr>

                        {/* Tổng cộng nghĩa vụ */}
                        <tr className="bg-brand/10 font-bold font-sans text-brand">
                          <td className="py-3 px-4" colSpan={2}>TỔNG CỘNG NGHĨA VỤ THUẾ ƯỚC TÍNH (VND)</td>
                          <td className="py-3 px-4 text-center font-mono">GTGT: {s4TaxLiabilities.totalGtgt.toLocaleString()}đ</td>
                          <td className="py-3 px-4 text-center font-mono">TNCN: {s4TaxLiabilities.totalTncn.toLocaleString()}đ</td>
                          <td className="py-3 px-4 text-right font-black font-mono text-sm">
                            {s4TaxLiabilities.totalTax.toLocaleString()}đ
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* S4 TAX PAYMENTS HISTORY */}
                <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center">
                    <h4 className="font-bold text-xs text-ink uppercase tracking-wider">Lịch sử thực nộp thuế vào Ngân sách Nhà nước (NSNN)</h4>
                    <span className="text-[10px] text-ink-muted italic">Được truy xuất tự động từ phiếu chi quỹ</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-4">Ngày nộp</th>
                          <th className="py-2.5 px-4">Mã chứng từ</th>
                          <th className="py-2.5 px-4">Nội dung chi hạch toán</th>
                          <th className="py-2.5 px-4">Phương thức</th>
                          <th className="py-2.5 px-4 text-right">Số tiền đã nộp (đ)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-hairline font-mono text-ink">
                        {s4TaxPayments.map((p, idx) => (
                          <tr key={idx} className="hover:bg-bg-main/30">
                            <td className="py-2.5 px-4 font-sans text-ink-muted">{p.date.substring(0, 10)}</td>
                            <td className="py-2.5 px-4 font-bold text-danger">PC-{p.id.substring(3, 8).toUpperCase()}</td>
                            <td className="py-2.5 px-4 font-sans text-ink max-w-xs truncate" title={p.description}>{p.description}</td>
                            <td className="py-2.5 px-4 font-sans text-ink-muted">{p.paymentMethod}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-danger bg-danger/5">
                              {p.amount.toLocaleString()}đ
                            </td>
                          </tr>
                        ))}
                        {s4TaxPayments.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-ink-muted font-sans">
                              Chưa phát hiện giao dịch nộp thuế trong kỳ lọc (giao dịch chi ở mục "Thuế").
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Tax Summary Dashboard & Tax Form Info */}
              <div className="space-y-6">
                {/* Tax Ledger KPI Card */}
                <div className="bg-surface-card border border-border-hairline rounded-2xl p-5 space-y-4 shadow-xs">
                  <h4 className="font-bold text-xs text-ink uppercase tracking-wider border-b border-border-hairline pb-2.5">
                    Số dư nghĩa vụ thuế hiện tại
                  </h4>

                  <div className="space-y-3 font-mono">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-ink-muted font-sans font-medium">1. Phải nộp (Tổng lũy kế):</span>
                      <span className="font-bold text-ink">{s4TaxLiabilities.totalTax.toLocaleString()}đ</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-ink-muted font-sans font-medium">2. Đã nộp (Thực tế chi):</span>
                      <span className="font-bold text-danger">-{totalTaxPaid.toLocaleString()}đ</span>
                    </div>
                    <div className="border-t border-dashed border-border-hairline my-2 pt-2 flex justify-between items-center text-sm">
                      <span className="text-ink font-sans font-bold">3. Còn phải nộp (Còn nợ):</span>
                      <span className={`font-black ${
                        (s4TaxLiabilities.totalTax - totalTaxPaid) > 0 ? 'text-danger' : 'text-brand'
                      }`}>
                        {Math.max(0, s4TaxLiabilities.totalTax - totalTaxPaid).toLocaleString()}đ
                      </span>
                    </div>
                  </div>

                  <div className="bg-brand/5 border border-brand/20 p-3.5 rounded-xl text-[10px] text-ink-muted leading-relaxed">
                    💡 <strong>Hướng dẫn nghiệp vụ:</strong> Hãy thực hiện chi nộp thuế (Lập Phiếu Chi ở tab Sổ Quỹ, chọn hạng mục "Nộp thuế") để tự động ghi nhận tiền thuế đã nộp ở đây và cập nhật công nợ thuế NSNN.
                  </div>
                </div>

                {/* Circular 88 Tờ Khai 01/CNKD Guide */}
                <div className="bg-surface-card border border-border-hairline rounded-2xl p-5 space-y-3 shadow-xs">
                  <h4 className="font-bold text-xs text-brand uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-brand" />
                    Báo cáo Tờ khai 01/CNKD
                  </h4>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Số liệu hạch toán trên của Sổ S1, S2, S3, S4 đã được thiết kế đồng bộ hoàn hảo với <strong>Tờ khai thuế 01/CNKD dành cho hộ kinh doanh cá thể</strong> nộp hàng quý/năm.
                  </p>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Bạn có thể tự tin kết xuất file CSV chi tiết, in ký tên nộp Cơ quan thuế quản lý trực tiếp địa bàn để hoàn thiện thủ tục quyết toán cuối năm cực kỳ nhanh chóng.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SỔ S5: THANH TOÁN TIỀN LƯƠNG & BẢO HIỂM */}
          {selectedBook === 's5' && (
            <div className="bg-surface-card border border-border-hairline rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border-hairline bg-bg-main/25 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-brand text-white text-[9px] font-mono font-black rounded">Sổ S5</span>
                  <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Sổ theo dõi tình hình thanh toán tiền lương & bảo hiểm nhân viên</h3>
                </div>

                <button
                  onClick={() => setIsPayrollModalOpen(true)}
                  className="px-3.5 py-1.5 bg-brand text-white rounded-lg font-bold text-xs hover:bg-brand/90 shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  Thêm nhân viên mới
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-bg-main border-b border-border-hairline text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Tên nhân viên</th>
                      <th className="py-3 px-4">Chức vụ / Vai trò</th>
                      <th className="py-3 px-4 text-right">Lương cơ bản</th>
                      <th className="py-3 px-4 text-right">Phụ cấp/Thưởng</th>
                      <th className="py-3 px-4 text-right">Trích đóng BH (10.5%)</th>
                      <th className="py-3 px-4 text-right font-bold">Thực nhận (VND)</th>
                      <th className="py-3 px-4 text-center">Trạng thái phát lương</th>
                      <th className="py-3 px-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline font-mono text-ink">
                    {payrollEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-bg-main/30 transition-colors">
                        <td className="py-3 px-4 font-sans font-bold text-ink">{emp.name}</td>
                        <td className="py-3 px-4 font-sans text-ink-muted">{emp.role}</td>
                        <td className="py-3 px-4 text-right">{emp.baseSalary.toLocaleString()}đ</td>
                        <td className="py-3 px-4 text-right text-brand">+{emp.allowances.toLocaleString()}đ</td>
                        <td className="py-3 px-4 text-right text-danger">-{emp.insurance.toLocaleString()}đ</td>
                        <td className="py-3 px-4 text-right font-black text-brand bg-brand/5">
                          {emp.netPay.toLocaleString()}đ
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          {emp.paymentStatus === 'Đã chi' ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand/10 text-brand border border-brand/20 uppercase">
                              Đã chi trả ({emp.payDate})
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger/10 text-danger border border-danger/20 uppercase animate-pulse">
                              Chưa trả lương
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <div className="flex gap-2 justify-center items-center">
                            {emp.paymentStatus === 'Chưa chi' && (
                              <button
                                onClick={() => handlePaySalary(emp.id)}
                                className="px-2 py-1 bg-brand text-white border border-brand rounded text-[10px] font-bold hover:bg-brand/90 transition-all cursor-pointer shadow-xs"
                              >
                                Lập phiếu chi lương
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="p-1 text-ink-muted hover:text-danger rounded border border-border-hairline hover:bg-danger/5 transition-all cursor-pointer shadow-xs"
                              title="Xóa nhân viên khỏi bảng lương"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {payrollEmployees.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-ink-muted font-sans">
                          Chưa có nhân viên nào trong danh mục quản lý lương S5. Nhấn nút "Thêm nhân viên mới" để cấu hình.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* --- MODAL LẬP PHIẾU THU CHI TỰ DO (Kế toán Sapo) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                Lập Phiếu Thu / Chi Kế Toán
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTransaction}>
              <div className="p-5 space-y-4">
                
                {/* Type Selector tabs */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1.5">Phân loại chứng từ</label>
                  <div className="grid grid-cols-2 gap-2 bg-bg-main p-1 rounded-lg border border-border-hairline">
                    <button
                      type="button"
                      onClick={() => {
                        setTxType('thu');
                        setTxCategory('Doanh thu bán hàng');
                      }}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        txType === 'thu'
                          ? 'bg-brand text-white shadow-xs'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Phiếu THU (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTxType('chi');
                        setTxCategory('Nhập kho hàng hóa');
                      }}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        txType === 'chi'
                          ? 'bg-danger text-white shadow-xs'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Phiếu CHI (-)
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Hạng mục thu chi</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:ring-1 focus:ring-brand focus:outline-hidden cursor-pointer font-medium"
                    required
                  >
                    {txType === 'thu' ? (
                      <>
                        <option value="Doanh thu bán hàng" className="bg-surface-card text-ink">Doanh thu bán hàng (POS/Sàn)</option>
                        <option value="Thu nợ khách hàng" className="bg-surface-card text-ink">Thu hồi nợ đại lý/khách</option>
                        <option value="Doanh thu tài chính" className="bg-surface-card text-ink">Doanh thu tài chính</option>
                        <option value="Thu nhập khác" className="bg-surface-card text-ink">Thu nhập bất thường khác</option>
                      </>
                    ) : (
                      <>
                        <option value="Nhập kho hàng hóa" className="bg-surface-card text-ink">Nhập kho hàng hóa (Hóa đơn sỉ)</option>
                        <option value="Tiền thuê mặt bằng" className="bg-surface-card text-ink">Chi phí thuê mặt bằng cửa hàng</option>
                        <option value="Lương nhân viên" className="bg-surface-card text-ink">Trả lương nhân viên tạp hóa</option>
                        <option value="Tiền điện nước" className="bg-surface-card text-ink">Tiền điện, nước, internet</option>
                        <option value="Chi phí đóng gói" className="bg-surface-card text-ink">Bao bì, túi xốp, băng keo đóng gói</option>
                        <option value="Chi phí khác" className="bg-surface-card text-ink">Chi phí vận hành khác</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Số tiền (đ)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="1000"
                      value={txAmount || ''}
                      onChange={(e) => setTxAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm text-right font-mono font-bold focus:ring-1 focus:ring-brand focus:outline-hidden"
                      placeholder="Ví dụ: 500000"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">VND</span>
                  </div>
                </div>

                {/* Date Picker */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Ngày hạch toán</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:ring-1 focus:ring-brand focus:outline-hidden text-ink-muted font-medium"
                    required
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Phương thức thanh toán</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:ring-1 focus:ring-brand focus:outline-hidden cursor-pointer font-medium"
                    required
                  >
                    <option value="Tiền mặt" className="bg-surface-card text-ink">Tiền mặt (Quỹ két)</option>
                    <option value="Chuyển khoản QR" className="bg-surface-card text-ink">Chuyển khoản Ngân hàng (QR)</option>
                    <option value="MoMo" className="bg-surface-card text-ink">Ví MoMo</option>
                    <option value="ZaloPay" className="bg-surface-card text-ink">Ví ZaloPay</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Diễn giải chi tiết</label>
                  <textarea
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    placeholder="Nhập ghi chú chi tiết..."
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:ring-1 focus:ring-brand focus:outline-hidden h-20"
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-bg-main border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink hover:bg-bg-main transition-colors cursor-pointer font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer ${
                    txType === 'thu' ? 'bg-brand hover:bg-brand-hover' : 'bg-danger hover:bg-danger-hover'
                  }`}
                >
                  Ghi sổ kế toán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL THU NỢ / TRẢ NỢ ĐỐI TÁC (Công nợ hạch toán) --- */}
      {selectedPartnerForDebt && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className={`p-4 text-white flex justify-between items-center ${
              debtActionType === 'collect' ? 'bg-brand' : 'bg-danger'
            }`}>
              <h3 className="font-bold text-xs flex items-center gap-1.5 uppercase">
                <Coins className="h-4.5 w-4.5" />
                {debtActionType === 'collect' ? 'Lập phiếu THU NỢ KHÁCH HÀNG' : 'Lập phiếu CHI TRẢ NỢ NCC'}
              </h3>
              <button
                onClick={() => setSelectedPartnerForDebt(null)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessDebtClearance}>
              <div className="p-5 space-y-4">
                
                {/* Partner short metadata */}
                <div className="bg-bg-main p-3 rounded-lg border border-border-hairline text-xs text-ink-muted space-y-1">
                  <div>Đối tác: <strong className="text-ink">{selectedPartnerForDebt.name}</strong></div>
                  <div>Địa chỉ: <span className="text-ink-muted">{selectedPartnerForDebt.address}</span></div>
                  <div>SĐT: <span className="text-ink-muted font-mono">{selectedPartnerForDebt.phone}</span></div>
                  <div className="pt-1 text-ink-muted">
                    Dư nợ hiện hữu: <strong className={debtActionType === 'collect' ? 'text-brand' : 'text-danger'}>
                      {selectedPartnerForDebt.debt.toLocaleString()}đ
                    </strong>
                  </div>
                </div>

                {/* Amount to pay */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Số tiền thanh toán đối soát nợ (đ)</label>
                  <div className="relative">
                    <input
                      type="number"
                      max={selectedPartnerForDebt.debt}
                      min="1"
                      step="1000"
                      value={debtAmount || ''}
                      onChange={(e) => setDebtAmount(Math.min(selectedPartnerForDebt.debt, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm text-right font-mono font-bold focus:ring-1 focus:ring-brand"
                      placeholder="Nhập số tiền trả nợ..."
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">VND</span>
                  </div>
                  <p className="text-[10px] text-ink-muted mt-1">Mặc định thu/chi hết toàn bộ nợ. Có thể chỉnh sửa số tiền trả nợ phần.</p>
                </div>

                {/* Payment method */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Phương thức hạch toán tiền</label>
                  <select
                    value={debtPayMethod}
                    onChange={(e) => setDebtPayMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:outline-hidden cursor-pointer font-medium"
                    required
                  >
                    <option value="Chuyển khoản QR">Chuyển khoản Ngân hàng (QR)</option>
                    <option value="Tiền mặt">Tiền mặt (Quỹ két)</option>
                    <option value="MoMo">Ví MoMo</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Diễn giải chi tiết</label>
                  <textarea
                    value={debtDesc}
                    onChange={(e) => setDebtDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs focus:outline-hidden h-20"
                    placeholder="Ghi chú chi tiết phiếu đối soát nợ..."
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-bg-main border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPartnerForDebt(null)}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink hover:bg-bg-main transition-colors cursor-pointer font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer ${
                    debtActionType === 'collect' ? 'bg-brand hover:bg-brand-hover' : 'bg-danger hover:bg-danger-hover'
                  }`}
                >
                  Xác nhận hạch toán nợ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL THÊM ĐỐI TÁC MỚI (Công nợ Sapo) --- */}
      {isNewPartnerOpen && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h3 className="font-bold text-xs flex items-center gap-1.5 uppercase">
                <Users className="h-4.5 w-4.5" />
                Thêm đối tác mới (KiotViet)
              </h3>
              <button
                onClick={() => setIsNewPartnerOpen(false)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePartner}>
              <div className="p-5 space-y-4 text-xs">
                
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Tên đối tác / Doanh nghiệp *</label>
                  <input
                    type="text"
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                    placeholder="Ví dụ: NPP Thực phẩm An Khang, Anh Tuấn Khách sỉ..."
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs font-semibold focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Phân loại đối tác</label>
                  <div className="grid grid-cols-2 gap-2 bg-bg-main p-1 rounded-lg border border-border-hairline">
                    <button
                      type="button"
                      onClick={() => setNewPartnerType('customer')}
                      className={`py-1.5 font-bold rounded text-center transition-all cursor-pointer ${
                        newPartnerType === 'customer'
                          ? 'bg-brand text-white shadow-xs'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Khách hàng
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPartnerType('supplier')}
                      className={`py-1.5 font-bold rounded text-center transition-all cursor-pointer ${
                        newPartnerType === 'supplier'
                          ? 'bg-danger text-white shadow-xs'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Nhà cung cấp
                    </button>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={newPartnerPhone}
                    onChange={(e) => setNewPartnerPhone(e.target.value)}
                    placeholder="Ví dụ: 0912xxxxxx"
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Địa chỉ chi tiết</label>
                  <input
                    type="text"
                    value={newPartnerAddress}
                    onChange={(e) => setNewPartnerAddress(e.target.value)}
                    placeholder="Ví dụ: 45 Nguyễn Huệ, Quận 1, TP. HCM"
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs font-medium"
                  />
                </div>

                {/* Initial Debt */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">
                    {newPartnerType === 'customer' ? 'Dư nợ ban đầu (Khách nợ ta)' : 'Dư nợ ban đầu (Ta nợ nhà cung cấp)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={newPartnerInitialDebt || ''}
                      onChange={(e) => setNewPartnerInitialDebt(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm text-right font-mono font-bold"
                      placeholder="0"
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">VND</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-bg-main border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewPartnerOpen(false)}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink hover:bg-bg-main transition-colors cursor-pointer font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Thêm đối tác
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL THÊM NHÂN VIÊN MỚI (Bảng lương S5) --- */}
      {isPayrollModalOpen && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-border-hairline animate-in fade-in zoom-in duration-150">
            
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h3 className="font-bold text-xs flex items-center gap-1.5 uppercase">
                <PlusCircle className="h-4.5 w-4.5 text-white" />
                Cấu hình nhân viên & lương định kỳ (S5)
              </h3>
              <button
                onClick={() => setIsPayrollModalOpen(false)}
                className="text-white/80 hover:text-white font-mono text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee}>
              <div className="p-5 space-y-4 text-xs">
                
                {/* Employee Name */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Họ và tên nhân viên *</label>
                  <input
                    type="text"
                    value={payrollName}
                    onChange={(e) => setPayrollName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A, Trần Thị B..."
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs font-semibold focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Chức vụ / Vị trí *</label>
                  <input
                    type="text"
                    value={payrollRole}
                    onChange={(e) => setPayrollRole(e.target.value)}
                    placeholder="Ví dụ: Nhân viên bán hàng, Thủ kho, Giao hàng..."
                    className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-xs font-semibold focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                {/* Base Salary */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Mức lương cơ bản (VND) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="100000"
                      value={payrollBase || ''}
                      onChange={(e) => {
                        const base = Math.max(0, parseInt(e.target.value) || 0);
                        setPayrollBase(base);
                        setPayrollInsurance(Math.round(base * 0.105));
                      }}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm text-right font-mono font-bold"
                      placeholder="0"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">VND</span>
                  </div>
                </div>

                {/* Allowances */}
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Các khoản phụ cấp / Ăn trưa / Thưởng (VND)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="50000"
                      value={payrollAllowance || ''}
                      onChange={(e) => setPayrollAllowance(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-bg-main border border-border-hairline text-ink rounded-lg text-sm text-right font-mono font-bold"
                      placeholder="0"
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-ink-muted">VND</span>
                  </div>
                </div>

                {/* Insurance info */}
                <div className="bg-bg-main/50 p-3.5 rounded-xl border border-border-hairline space-y-1.5 animate-fade-in">
                  <div className="flex justify-between items-center text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                    <span>Trích bảo hiểm tự nguyện (10.5%)</span>
                    <span className="text-danger font-mono font-bold">-{payrollInsurance.toLocaleString()}đ</span>
                  </div>
                  <p className="text-[10px] text-ink-muted leading-relaxed">
                    Khấu trừ tự động bảo hiểm theo quy định pháp luật (8% hưu trí tử tuất, 1.5% BHYT, 1% BHTN) tính trên lương cơ sở đóng bảo hiểm.
                  </p>
                  <div className="border-t border-border-hairline pt-1.5 flex justify-between items-center text-xs font-bold text-ink">
                    <span>Lương thực tế nhận dự tính:</span>
                    <span className="text-brand font-mono">{(payrollBase + payrollAllowance - payrollInsurance).toLocaleString()}đ</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-bg-main border-t border-border-hairline flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayrollModalOpen(false)}
                  className="flex-1 py-2 text-center border border-border-hairline bg-surface-card rounded-lg text-xs text-ink hover:bg-bg-main transition-colors cursor-pointer font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Thêm nhân viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
