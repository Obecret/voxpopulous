import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallContextType {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  triggerInstall: () => Promise<void>;
  showIOSInstructions: boolean;
  setShowIOSInstructions: (show: boolean) => void;
}

const PWAInstallContext = createContext<PWAInstallContextType | null>(null);

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const standalone = window.matchMedia("(display-mode: standalone)").matches || 
                       (navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) {
      setCanInstall(false);
      return;
    }

    if (isIOSDevice) {
      setCanInstall(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      setCanInstall(false);
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    
    setCanInstall(false);
    setDeferredPrompt(null);
  }, [deferredPrompt, isIOS]);

  return (
    <PWAInstallContext.Provider value={{
      canInstall,
      isIOS,
      isStandalone,
      triggerInstall,
      showIOSInstructions,
      setShowIOSInstructions,
    }}>
      {children}
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstall() {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error("usePWAInstall must be used within a PWAInstallProvider");
  }
  return context;
}
