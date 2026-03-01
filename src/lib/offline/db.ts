// ECO Offline-Lite IndexedDB Manager
// No Jackson.

const DB_NAME = 'eco-offline';
const DB_VERSION = 1;

export interface OutboxItem {
    id: string; // Deterministic ID or UUID
    type: 'set_status' | 'create_receipt' | 'upload_media';
    payload: any;
    created_at: string;
    retries: number;
}

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Store for route data (daily queue, windows, points)
            if (!db.objectStoreNames.contains('cache')) {
                db.createObjectStore('cache');
            }

            // Store for pending actions
            if (!db.objectStoreNames.contains('outbox')) {
                db.createObjectStore('outbox', { keyPath: 'id' });
            }
        };
    });
};

export const ecoCache = {
    async set(key: string, value: any) {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction('cache', 'readwrite');
            const store = tx.objectStore('cache');
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async get<T>(key: string): Promise<T | null> {
        const db = await initDB();
        return new Promise<T | null>((resolve, reject) => {
            const tx = db.transaction('cache', 'readonly');
            const store = tx.objectStore('cache');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    async clear() {
        const db = await initDB();
        const tx = db.transaction('cache', 'readwrite');
        tx.objectStore('cache').clear();
    }
};

export const ecoOutbox = {
    async enqueue(item: OutboxItem) {
        const db = await initDB();
        const tx = db.transaction('outbox', 'readwrite');
        tx.objectStore('outbox').put(item);
    },

    async getAll(): Promise<OutboxItem[]> {
        const db = await initDB();
        return new Promise<OutboxItem[]>((resolve, reject) => {
            const tx = db.transaction('outbox', 'readonly');
            const req = tx.objectStore('outbox').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    async remove(id: string) {
        const db = await initDB();
        const tx = db.transaction('outbox', 'readwrite');
        tx.objectStore('outbox').delete(id);
    },

    async update(item: OutboxItem) {
        const db = await initDB();
        const tx = db.transaction('outbox', 'readwrite');
        tx.objectStore('outbox').put(item);
    }
};
