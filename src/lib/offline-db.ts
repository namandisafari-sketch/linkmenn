import { openDB, DBSchema, IDBPDatabase } from "idb";

interface MarvidDBSchema extends DBSchema {
  "pending-sync": {
    key: string;
    value: {
      id: string;
      table: string;
      action: "insert" | "update" | "delete";
      data: any;
      timestamp: number;
    };
    indexes: { "by-table": string };
  };
  "cache-store": {
    key: string;
    value: {
      key: string;
      data: any;
      table: string;
      timestamp: number;
      expiry: number;
    };
    indexes: { "by-table": string };
  };
  "session-state": {
    key: string;
    value: {
      key: string;
      data: any;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<MarvidDBSchema>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MarvidDBSchema>("marvid-offline", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending-sync")) {
          const syncStore = db.createObjectStore("pending-sync", { keyPath: "id" });
          syncStore.createIndex("by-table", "table");
        }
        if (!db.objectStoreNames.contains("cache-store")) {
          const cacheStore = db.createObjectStore("cache-store", { keyPath: "key" });
          cacheStore.createIndex("by-table", "table");
        }
        if (!db.objectStoreNames.contains("session-state")) {
          db.createObjectStore("session-state", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
};

// ─── Cache Layer ───
export const cacheSet = async (key: string, data: any, table: string, ttlMs = 5 * 60 * 1000) => {
  const db = await getDB();
  await db.put("cache-store", { key, data, table, timestamp: Date.now(), expiry: Date.now() + ttlMs });
};

export const cacheGet = async (key: string): Promise<any | null> => {
  const db = await getDB();
  const entry = await db.get("cache-store", key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    await db.delete("cache-store", key);
    return null;
  }
  return entry.data;
};

export const cacheClear = async (table?: string) => {
  const db = await getDB();
  if (table) {
    const keys = await db.getAllKeysFromIndex("cache-store", "by-table", table);
    const tx = db.transaction("cache-store", "readwrite");
    await Promise.all(keys.map((k) => tx.store.delete(k)));
    await tx.done;
  } else {
    await db.clear("cache-store");
  }
};

// ─── Offline Queue ───
export const queueOfflineAction = async (table: string, action: "insert" | "update" | "delete", data: any) => {
  const db = await getDB();
  const id = `${table}-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.put("pending-sync", { id, table, action, data, timestamp: Date.now() });
};

export const getPendingActions = async () => {
  const db = await getDB();
  return db.getAll("pending-sync");
};

export const clearPendingAction = async (id: string) => {
  const db = await getDB();
  await db.delete("pending-sync", id);
};

export const getPendingCount = async () => {
  const db = await getDB();
  return db.count("pending-sync");
};

// ─── Session State (survives refresh/tab close) ───
export const saveSessionState = async (key: string, data: any) => {
  const db = await getDB();
  await db.put("session-state", { key, data, timestamp: Date.now() });
};

export const getSessionState = async <T = any>(key: string): Promise<T | null> => {
  const db = await getDB();
  const entry = await db.get("session-state", key);
  return entry?.data ?? null;
};

export const clearSessionState = async (key: string) => {
  const db = await getDB();
  await db.delete("session-state", key);
};
