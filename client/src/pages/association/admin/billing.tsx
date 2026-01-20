import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AssociationAdminLayout } from "@/components/layout/association-admin-layout";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard } from "lucide-react";
import type { Association, AssociationUser } from "@shared/schema";

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

export default function AssociationAdminBilling() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<{ user: SafeAssociationUser; association: Association }>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug, "me"],
    retry: false,
  });

  if (error) {
    navigate(`/structures/${params.slug}/${params.assocSlug}/login`);
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <Skeleton className="h-16 w-full mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { user, association } = data || {};

  return (
    <AssociationAdminLayout association={association || null} user={user || null} tenantSlug={params.slug}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold" data-testid="text-assoc-billing-title">
            Facturation
          </h1>
          <p className="text-muted-foreground mt-1">Gerez la facturation de votre association.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground mt-4">La gestion de la facturation sera disponible prochainement.</p>
            </div>
          </CardHeader>
        </Card>
      </div>
    </AssociationAdminLayout>
  );
}
