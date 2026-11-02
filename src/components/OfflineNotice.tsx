"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  addEventListener("online", cb);
  addEventListener("offline", cb);
  return () => {
    removeEventListener("online", cb);
    removeEventListener("offline", cb);
  };
};

/** A quiet pill while the device is offline; pages you've opened before still load. */
export function OfflineNotice() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div
      role="status"
      className="offline-pill pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-50 flex justify-center px-4 lg:bottom-6"
    >
      <p className="sheet-in flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-lg">
        <WifiOff className="h-4 w-4" aria-hidden /> You&apos;re offline. Pages you&apos;ve opened still work.
      </p>
    </div>
  );
}
