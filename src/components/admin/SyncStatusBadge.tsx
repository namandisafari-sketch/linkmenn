import { useState, useEffect } from "react";
import { CloudOff, Cloud, RefreshCw } from "lucide-react";
import { getPendingCount } from "@/lib/offline-db";
import { onSyncChange, syncPendingActions } from "@/lib/sync-engine";

const SyncStatusBadge = () => {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getPendingCount().then(setPending);
    return onSyncChange(setPending);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await syncPendingActions();
    setSyncing(false);
  };

  if (pending === 0) return null;

  return (
    <button
      onClick={handleSync}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
      title={`${pending} changes pending sync`}
    >
      {syncing ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : navigator.onLine ? (
        <Cloud className="h-3.5 w-3.5" />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      {pending} pending
    </button>
  );
};

export default SyncStatusBadge;
