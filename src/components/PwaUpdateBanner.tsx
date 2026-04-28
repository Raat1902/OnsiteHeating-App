import React from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui/Button";

export function PwaUpdateBanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  });

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
      <div className="text-sm font-extrabold text-gray-900">
        {needRefresh ? "Update available" : "Offline ready"}
      </div>
      <div className="mt-1 text-xs font-semibold text-gray-600">
        {needRefresh
          ? "A newer version is ready. Refresh to update."
          : "This app is cached and can run offline."}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          Dismiss
        </Button>
        {needRefresh ? (
          <Button onClick={() => updateServiceWorker(true)}>Refresh</Button>
        ) : null}
      </div>
    </div>
  );
}
