import { AssociationHeader } from "./association-header";
import type { Association, Tenant } from "@shared/schema";

interface AssociationLayoutProps {
  children: React.ReactNode;
  association: Association | null;
  tenant: Tenant | null;
}

export function AssociationLayout({ children, association, tenant }: AssociationLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <AssociationHeader association={association} tenant={tenant} />
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
