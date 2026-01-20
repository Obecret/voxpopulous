import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export function PWAInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const isMobile = useIsMobile();
  const { 
    canInstall, 
    isIOS, 
    isStandalone, 
    triggerInstall, 
    showIOSInstructions, 
    setShowIOSInstructions 
  } = usePWAInstall();

  useEffect(() => {
    if (isStandalone || !canInstall) return;

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    if (isMobile) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, isStandalone, isMobile]);

  const handleInstall = async () => {
    await triggerInstall();
    if (!isIOS) {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
  };

  const handleCloseIOSInstructions = () => {
    setShowIOSInstructions(false);
  };

  const handleIOSComplete = () => {
    setShowIOSInstructions(false);
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
  };

  return (
    <>
      {showBanner && canInstall && (
        <div 
          className="fixed-bottom-nav bg-background border-t p-4 shadow-lg z-50"
          data-testid="pwa-install-banner"
        >
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Installer Voxpopulous</p>
                <p className="text-xs text-muted-foreground">
                  Acces rapide depuis votre ecran d'accueil
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleInstall}
                className="gap-2"
                data-testid="button-install-pwa"
              >
                <Download className="h-4 w-4" />
                Installer
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDismiss}
                data-testid="button-dismiss-pwa"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {showIOSInstructions && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
          onClick={handleCloseIOSInstructions}
          data-testid="modal-ios-install"
        >
          <div 
            className="bg-background rounded-t-xl p-6 w-full max-w-md safe-area-inset-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-lg">Installer sur iOS</h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCloseIOSInstructions}
                data-testid="button-close-ios-modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0">1</span>
                <span>Appuyez sur le bouton <strong>Partager</strong> en bas de Safari</span>
              </li>
              <li className="flex gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0">2</span>
                <span>Faites defiler et appuyez sur <strong>Sur l'ecran d'accueil</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0">3</span>
                <span>Appuyez sur <strong>Ajouter</strong></span>
              </li>
            </ol>
            <Button 
              className="w-full mt-6" 
              onClick={handleIOSComplete}
              data-testid="button-ios-complete"
            >
              Compris
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
