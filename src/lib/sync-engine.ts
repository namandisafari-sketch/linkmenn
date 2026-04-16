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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl: any = supabase.from(table);
      if (op === "insert") {
        result = await tbl.insert(data);
      } else if (op === "update") {
        const { id, ...rest } = data;
        result = await tbl.update(rest).eq("id", id);
      } else if (op === "delete") {
        result = await tbl.delete().eq("id", data.id);
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
