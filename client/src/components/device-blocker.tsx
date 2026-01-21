import { useDeviceStatus } from "@/hooks/use-device-status";
import { AlertTriangle, Ban } from "lucide-react";

interface DeviceBlockerProps {
  children: React.ReactNode;
}

export function DeviceBlocker({ children }: DeviceBlockerProps) {
  const { isBlocked, blockReason, isLoading } = useDeviceStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="device-status-loading">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="device-blocked-screen">
        <div className="max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <Ban className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-4">Acces bloque</h1>
          <p className="text-muted-foreground mb-6">
            Cet appareil a ete bloque par l'administrateur et ne peut plus acceder a l'application.
          </p>
          {blockReason && (
            <div className="bg-muted p-4 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium">Raison :</p>
                  <p className="text-sm text-muted-foreground">{blockReason}</p>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administrateur.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
