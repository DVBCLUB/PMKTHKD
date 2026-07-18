const DB_NAME = 'pmkthkd-offline';
const DB_VERSION = 1;
const STORE_KV = 'kv';

interface KvRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không thể mở IndexedDB.'));
  });
  return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_KV, mode);
    const request = operation(transaction.objectStore(STORE_KV));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB gặp lỗi.'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction gặp lỗi.'));
  });
}

export async function getOfflineValue<T>(key: string): Promise<T | null> {
  const record = await withStore<KvRecord<T> | undefined>('readonly', (store) => store.get(key));
  return record?.value ?? null;
}

export async function setOfflineValue<T>(key: string, value: T): Promise<void> {
  await withStore<IDBValidKey>('readwrite', (store) => store.put({ key, value, updatedAt: new Date().toISOString() } satisfies KvRecord<T>));
}

export async function deleteOfflineValue(key: string): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.delete(key) as IDBRequest<undefined>);
}

export function cacheKey(shopId: string): string {
  return `app-state-cache:${shopId}`;
}

export function outboxKey(shopId: string): string {
  return `app-state-outbox:${shopId}`;
}
