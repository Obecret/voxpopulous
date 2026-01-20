import { TenantHeader } from "./tenant-header";
import type { Tenant } from "@shared/schema";

interface TenantLayoutProps {
  children: React.ReactNode;
  tenant: Tenant | null;
  isAdmin?: boolean;
}

export function TenantLayout({ children, tenant, isAdmin = false }: TenantLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <TenantHeader tenant={tenant} isAdmin={isAdmin} />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>
          Propulse par{" "}
          <a href="/" className="text-primary hover:underline">
            Voxpopulous.fr
          </a>
        </p>
      </footer>
    </div>
  );
}
