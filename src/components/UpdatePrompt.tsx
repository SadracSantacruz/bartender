import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui";

/**
 * The service worker caches the whole app for offline use, which means an
 * open tab can keep running an old build indefinitely. This surfaces a
 * dismissible prompt when a new version is waiting, plus a one-time
 * confirmation that offline mode is armed.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-brass-600/60 bg-ink-900/95 p-4 shadow-xl shadow-black/60 backdrop-blur">
      {needRefresh ? (
        <>
          <p className="text-sm text-ink-200">
            A new version of Bar Drill is ready.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
              Reload
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              Later
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-200">Ready to work offline.</p>
          <Button size="sm" variant="ghost" onClick={() => setOfflineReady(false)}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
