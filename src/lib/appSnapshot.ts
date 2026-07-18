import type { Order, Partner, Product, StockInRecord, StockOutRecord, Transaction } from '../types';

export interface AppSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  products: Product[];
  orders: Order[];
  transactions: Transaction[];
  partners: Partner[];
  stockInRecords: StockInRecord[];
  stockOutRecords: StockOutRecord[];
  parkedSales: unknown[];
  preferences: {
    allowNegativeStock: boolean;
  };
}

const STORAGE_KEYS = {
  products: 'taphoa_products',
  orders: 'taphoa_orders',
  transactions: 'taphoa_transactions',
  partners: 'taphoa_partners',
  stockInRecords: 'taphoa_stock_in_records',
  stockOutRecords: 'taphoa_stock_out_records',
  parkedSales: 'taphoa_parked_sales',
  allowNegativeStock: 'taphoa_allow_negative_stock',
} as const;

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export function readLocalSnapshot(): AppSnapshot {
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    products: readArray<Product>(STORAGE_KEYS.products),
    orders: readArray<Order>(STORAGE_KEYS.orders),
    transactions: readArray<Transaction>(STORAGE_KEYS.transactions),
    partners: readArray<Partner>(STORAGE_KEYS.partners),
    stockInRecords: readArray<StockInRecord>(STORAGE_KEYS.stockInRecords),
    stockOutRecords: readArray<StockOutRecord>(STORAGE_KEYS.stockOutRecords),
    parkedSales: readArray<unknown>(STORAGE_KEYS.parkedSales),
    preferences: {
      allowNegativeStock: localStorage.getItem(STORAGE_KEYS.allowNegativeStock) === 'true',
    },
  };
}

export function emptySnapshot(): AppSnapshot {
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    products: [],
    orders: [],
    transactions: [],
    partners: [],
    stockInRecords: [],
    stockOutRecords: [],
    parkedSales: [],
    preferences: { allowNegativeStock: false },
  };
}

export function hasLocalBusinessData(snapshot = readLocalSnapshot()): boolean {
  return snapshot.products.length > 0
    || snapshot.orders.length > 0
    || snapshot.transactions.length > 0
    || snapshot.partners.length > 0
    || snapshot.stockInRecords.length > 0
    || snapshot.stockOutRecords.length > 0;
}

export function writeLocalSnapshot(snapshot: AppSnapshot): void {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(snapshot.products || []));
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(snapshot.orders || []));
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(snapshot.transactions || []));
  localStorage.setItem(STORAGE_KEYS.partners, JSON.stringify(snapshot.partners || []));
  localStorage.setItem(STORAGE_KEYS.stockInRecords, JSON.stringify(snapshot.stockInRecords || []));
  localStorage.setItem(STORAGE_KEYS.stockOutRecords, JSON.stringify(snapshot.stockOutRecords || []));
  localStorage.setItem(STORAGE_KEYS.parkedSales, JSON.stringify(snapshot.parkedSales || []));
  localStorage.setItem(STORAGE_KEYS.allowNegativeStock, String(Boolean(snapshot.preferences?.allowNegativeStock)));
}

export function snapshotFingerprint(snapshot: AppSnapshot): string {
  const stable = JSON.stringify({
    products: snapshot.products,
    orders: snapshot.orders,
    transactions: snapshot.transactions,
    partners: snapshot.partners,
    stockInRecords: snapshot.stockInRecords,
    stockOutRecords: snapshot.stockOutRecords,
    parkedSales: snapshot.parkedSales,
    preferences: snapshot.preferences,
  });

  let hash = 2166136261;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${stable.length}:${(hash >>> 0).toString(16)}`;
}

export function normalizeSnapshot(value: unknown): AppSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptySnapshot();
  const record = value as Partial<AppSnapshot>;
  return {
    schemaVersion: 1,
    capturedAt: typeof record.capturedAt === 'string' ? record.capturedAt : new Date().toISOString(),
    products: Array.isArray(record.products) ? record.products : [],
    orders: Array.isArray(record.orders) ? record.orders : [],
    transactions: Array.isArray(record.transactions) ? record.transactions : [],
    partners: Array.isArray(record.partners) ? record.partners : [],
    stockInRecords: Array.isArray(record.stockInRecords) ? record.stockInRecords : [],
    stockOutRecords: Array.isArray(record.stockOutRecords) ? record.stockOutRecords : [],
    parkedSales: Array.isArray(record.parkedSales) ? record.parkedSales : [],
    preferences: {
      allowNegativeStock: Boolean(record.preferences?.allowNegativeStock),
    },
  };
}
