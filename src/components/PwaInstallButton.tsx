import React, { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./ui/Button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallButton(props: { className?: string; variant?: "primary" | "secondary" | "danger" }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall as any);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as any);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const canPrompt = useMemo(() => !installed && !!promptEvent, [installed, promptEvent]);

  if (installed) return null;

  if (isIos()) {
    // iOS doesn't fire beforeinstallprompt; give a tiny hint in Settings instead.
    return (
      <div className={props.className}>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-700">
          Install on iPhone/iPad: tap <span className="font-extrabold">Share</span> →{" "}
          <span className="font-extrabold">Add to Home Screen</span>.
        </div>
      </div>
    );
  }

  if (!canPrompt) return null;

  return (
    <Button
      variant={props.variant ?? "secondary"}
      className={props.className}
      onClick={async () => {
        if (!promptEvent) return;
        await promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(null);
      }}
    >
      <span className="inline-flex items-center gap-2">
        <Download size={16} />
        Install app
      </span>
    </Button>
  );
}
