import { supabase } from "@/integrations/supabase/client";
import { getPendingActions, clearPendingAction, getPendingCount } from "./offline-db";

type SyncListener = (pending: number) => void;
const listeners = new Set<SyncListener>();

export const onSyncChange = (fn: SyncListener) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

const notify = async () => {
  const count = await getPendingCount();
  listeners.forEach((fn) => fn(count));
};

export const syncPendingActions = async (): Promise<{ synced: number; failed: number }> => {
  const actions = await getPendingActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const { table, action: op, data } = action;
      let result;

      const tbl = supabase.from(table as any);
      if (op === "insert") {
        result = await tbl.insert(data as any);
      } else if (op === "update") {
        const { id, ...rest } = data;
        result = await tbl.update(rest as any).eq("id" as any, id);
      } else if (op === "delete") {
        result = await tbl.delete().eq("id" as any, data.id);
      }

      if (result?.error) throw result.error;
      await clearPendingAction(action.id);
      synced++;
    } catch (e) {
      console.warn("[Sync] Failed action:", action.id, e);
      failed++;
    }
  }

  await notify();
  return { synced, failed };
};

// Auto-sync when coming online
let initialized = false;
export const initSyncEngine = () => {
  if (initialized) return;
  initialized = true;

  window.addEventListener("online", () => {
    console.log("[Sync] Back online, syncing...");
    syncPendingActions();
  });

  // Periodic sync every 30s if online
  setInterval(() => {
    if (navigator.onLine) {
      syncPendingActions();
    }
  }, 30_000);

  // Initial sync
  if (navigator.onLine) {
    syncPendingActions();
  }

  notify();
};
