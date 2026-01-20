import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Building2, ExternalLink, Mail, Clock, CheckCircle, XCircle, AlertCircle, Eye, Trash2, Gift, PauseCircle, Archive, Users, Link2, ChevronRight, KeyRound, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, SubscriptionPlan, Association } from "@shared/schema";

const BILLING_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  TRIAL: { label: "Essai", variant: "secondary" },
  ACTIVE: { label: "Actif", variant: "default" },
  SUSPENDED: { label: "Suspendu", variant: "destructive" },
  CANCELLED: { label: "Annule", variant: "outline" },
};

const LIFECYCLE_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof PauseCircle }> = {
  ACTIVE: { label: "Actif", variant: "default", icon: CheckCircle },
  SUSPENDED: { label: "Suspendu", variant: "destructive", icon: PauseCircle },
  ARCHIVED: { label: "Archive", variant: "outline", icon: Archive },
};

const TENANT_TYPE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; bgClass: string }> = {
  MAIRIE: { label: "Mairie", variant: "outline", bgClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  EPCI: { label: "EPCI", variant: "outline", bgClass: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
  ASSOCIATION: { label: "Association", variant: "outline", bgClass: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800" },
};

interface HierarchyItem {
  type: 'tenant' | 'association';
  id: string;
  name: string;
  slug: string;
  tenantType?: string;
  contactEmail?: string;
  contactName?: string;
  billingStatus?: string;
  lifecycleStatus?: string;
  trialEndsAt?: Date | null;
  createdAt: Date;
  isFree?: boolean;
  subscriptionPlan?: string;
  subscriptionPlanId?: string | null;
  parentId?: string | null;
  parentTenantId?: string | null;
  depth: number;
  isActive?: boolean;
}

export default function SuperadminTenants() {
  const { toast } = useToast();
  const [deleteTenantId, setDeleteTenantId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ tenants: Tenant[]; associations: Association[] }>({
    queryKey: ["/api/superadmin/tenants"],
  });

  const tenants = data?.tenants || [];
  const associations = data?.associations || [];

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/superadmin/plans"],
  });

  const getPlanName = (tenant: Tenant): string => {
    if (tenant.subscriptionPlanId && plans) {
      const plan = plans.find(p => p.id === tenant.subscriptionPlanId);
      if (plan) return plan.name;
    }
    if (tenant.subscriptionPlan === "FREE_TRIAL") return "Essai gratuit";
    if (tenant.subscriptionPlan === "STANDARD") return "Standard";
    if (tenant.subscriptionPlan === "PREMIUM") return "Premium";
    return tenant.subscriptionPlan || "Non defini";
  };

  const deleteTenantMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/superadmin/tenants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/stats"] });
      setDeleteTenantId(null);
      toast({
        title: "Client supprime",
        description: "Le client et toutes ses donnees ont ete supprimes.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer le client.",
      });
    },
  });

  const sendResetLinkMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${tenantId}/send-reset-link`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lien envoye",
        description: `Un lien de reinitialisation a ete envoye a ${data.adminEmail}.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le lien de reinitialisation.",
      });
    },
  });

  const getTrialDaysRemaining = (trialEndsAt: Date | null | undefined) => {
    if (!trialEndsAt) return null;
    const now = new Date();
    const end = new Date(trialEndsAt);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Build hierarchical list
  const buildHierarchy = (): HierarchyItem[] => {
    const items: HierarchyItem[] = [];
    
    // Get root EPCI tenants (no parent)
    const rootEpcis = tenants.filter(t => t.tenantType === 'EPCI' && !t.parentEpciId && !t.parentTenantId);
    
    // Get root mairies (no parent EPCI)
    const rootMairies = tenants.filter(t => t.tenantType === 'MAIRIE' && !t.parentEpciId && !t.parentTenantId);
    
    // Get root associations that are tenants (no parent)
    const rootAssociationTenants = tenants.filter(t => t.tenantType === 'ASSOCIATION' && !t.parentEpciId && !t.parentTenantId);
    
    // Helper to add associations for a tenant
    const addAssociationsForTenant = (tenantId: string, depth: number) => {
      const tenantAssocs = associations.filter(a => a.tenantId === tenantId);
      for (const assoc of tenantAssocs) {
        const parentTenant = tenants.find(t => t.id === assoc.tenantId);
        items.push({
          type: 'association',
          id: assoc.id,
          name: assoc.name,
          slug: assoc.slug,
          tenantType: 'ASSOCIATION',
          contactEmail: assoc.contactEmail || undefined,
          createdAt: new Date(assoc.createdAt),
          depth,
          isActive: assoc.isActive,
          parentTenantId: assoc.tenantId,
        });
      }
    };
    
    // Helper to add child mairies of an EPCI
    const addChildMairies = (epciId: string, depth: number) => {
      const childMairies = tenants.filter(t => t.parentEpciId === epciId);
      for (const mairie of childMairies) {
        items.push({
          type: 'tenant',
          id: mairie.id,
          name: mairie.name,
          slug: mairie.slug,
          tenantType: mairie.tenantType,
          contactEmail: mairie.contactEmail || undefined,
          contactName: mairie.contactName || undefined,
          billingStatus: mairie.billingStatus,
          lifecycleStatus: mairie.lifecycleStatus || undefined,
          trialEndsAt: mairie.trialEndsAt,
          createdAt: new Date(mairie.createdAt),
          isFree: mairie.isFree || false,
          subscriptionPlan: mairie.subscriptionPlan || undefined,
          subscriptionPlanId: mairie.subscriptionPlanId,
          parentId: mairie.parentEpciId,
          depth,
        });
        // Add associations of this child mairie
        addAssociationsForTenant(mairie.id, depth + 1);
      }
    };
    
    // Add EPCI with their children
    for (const epci of rootEpcis) {
      items.push({
        type: 'tenant',
        id: epci.id,
        name: epci.name,
        slug: epci.slug,
        tenantType: epci.tenantType,
        contactEmail: epci.contactEmail || undefined,
        contactName: epci.contactName || undefined,
        billingStatus: epci.billingStatus,
        lifecycleStatus: epci.lifecycleStatus || undefined,
        trialEndsAt: epci.trialEndsAt,
        createdAt: new Date(epci.createdAt),
        isFree: epci.isFree || false,
        subscriptionPlan: epci.subscriptionPlan || undefined,
        subscriptionPlanId: epci.subscriptionPlanId,
        depth: 0,
      });
      // Add child mairies
      addChildMairies(epci.id, 1);
      // Add direct associations of EPCI
      addAssociationsForTenant(epci.id, 1);
    }
    
    // Add standalone mairies with their associations
    for (const mairie of rootMairies) {
      items.push({
        type: 'tenant',
        id: mairie.id,
        name: mairie.name,
        slug: mairie.slug,
        tenantType: mairie.tenantType,
        contactEmail: mairie.contactEmail || undefined,
        contactName: mairie.contactName || undefined,
        billingStatus: mairie.billingStatus,
        lifecycleStatus: mairie.lifecycleStatus || undefined,
        trialEndsAt: mairie.trialEndsAt,
        createdAt: new Date(mairie.createdAt),
        isFree: mairie.isFree || false,
        subscriptionPlan: mairie.subscriptionPlan || undefined,
        subscriptionPlanId: mairie.subscriptionPlanId,
        depth: 0,
      });
      // Add associations of this mairie
      addAssociationsForTenant(mairie.id, 1);
    }
    
    // Add standalone association tenants
    for (const assocTenant of rootAssociationTenants) {
      items.push({
        type: 'tenant',
        id: assocTenant.id,
        name: assocTenant.name,
        slug: assocTenant.slug,
        tenantType: assocTenant.tenantType,
        contactEmail: assocTenant.contactEmail || undefined,
        contactName: assocTenant.contactName || undefined,
        billingStatus: assocTenant.billingStatus,
        lifecycleStatus: assocTenant.lifecycleStatus || undefined,
        trialEndsAt: assocTenant.trialEndsAt,
        createdAt: new Date(assocTenant.createdAt),
        isFree: assocTenant.isFree || false,
        subscriptionPlan: assocTenant.subscriptionPlan || undefined,
        subscriptionPlanId: assocTenant.subscriptionPlanId,
        depth: 0,
      });
    }
    
    return items;
  };

  const hierarchyItems = buildHierarchy();
  const totalClients = tenants.length + associations.length;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-tenants-title">
              Clients
            </h1>
            <p className="text-muted-foreground">
              Liste des communes et associations inscrites sur la plateforme
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-1">
            {totalClients} clients
          </Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Chargement des clients...
              </div>
            ) : hierarchyItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Aucun client enregistre pour le moment.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Structure</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Forfait</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Essai</TableHead>
                    <TableHead>Inscription</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hierarchyItems.map((item) => {
                    const typeConfig = TENANT_TYPE_CONFIG[item.tenantType || 'ASSOCIATION'] || TENANT_TYPE_CONFIG.ASSOCIATION;
                    const statusConfig = item.billingStatus ? BILLING_STATUS_CONFIG[item.billingStatus] : null;
                    const trialDays = getTrialDaysRemaining(item.trialEndsAt);
                    
                    // Find the parent tenant for associations and child mairies
                    const parentTenant = item.parentTenantId ? tenants.find(t => t.id === item.parentTenantId) : null;
                    const parentEpci = item.parentId ? tenants.find(t => t.id === item.parentId) : null;
                    
                    // Check if this is a child tenant (mairie under EPCI)
                    const isChildTenant = item.type === 'tenant' && item.parentId;
                    
                    // Get plan name for tenants - show "Via parent" for child tenants
                    const planName = isChildTenant 
                      ? null // Will display "Via parent"
                      : item.type === 'tenant' && item.subscriptionPlanId
                        ? (plans?.find(p => p.id === item.subscriptionPlanId)?.name || item.subscriptionPlan || '-')
                        : item.type === 'tenant' ? (item.subscriptionPlan || '-') : '-';
                    
                    // Get parent status for child items
                    const parentStatus = parentEpci?.billingStatus || parentTenant?.billingStatus;
                    const parentTrialEndsAt = parentEpci?.trialEndsAt || parentTenant?.trialEndsAt;
                    const effectiveStatus = (isChildTenant || item.type === 'association') && parentStatus 
                      ? parentStatus 
                      : item.billingStatus;
                    const effectiveTrialEndsAt = (isChildTenant || item.type === 'association') && parentTrialEndsAt
                      ? parentTrialEndsAt
                      : item.trialEndsAt;
                    const effectiveStatusConfig = effectiveStatus ? BILLING_STATUS_CONFIG[effectiveStatus] : null;
                    const effectiveTrialDays = getTrialDaysRemaining(effectiveTrialEndsAt);

                    return (
                      <TableRow 
                        key={`${item.type}-${item.id}`} 
                        data-testid={`row-${item.type}-${item.id}`}
                        className={item.depth > 0 ? 'bg-muted/30' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${item.depth * 24}px` }}>
                            {item.depth > 0 && (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                            {item.type === 'association' ? (
                              <Users className="h-4 w-4 text-green-600" />
                            ) : (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-muted-foreground">/{item.slug}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeConfig.bgClass}>
                            {item.type === 'association' ? 'Association' : typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.contactEmail ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm">{item.contactName || "-"}</div>
                                <div className="text-sm text-muted-foreground">{item.contactEmail}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.type === 'tenant' && !isChildTenant ? (
                            <span className="font-medium">{planName}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Via parent</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {effectiveStatusConfig ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge variant={effectiveStatusConfig.variant}>
                                {effectiveStatusConfig.label}
                              </Badge>
                              {item.type === 'tenant' && item.lifecycleStatus && item.lifecycleStatus !== "ACTIVE" && (
                                <Badge variant={LIFECYCLE_STATUS_CONFIG[item.lifecycleStatus]?.variant || "outline"}>
                                  {LIFECYCLE_STATUS_CONFIG[item.lifecycleStatus]?.label || item.lifecycleStatus}
                                </Badge>
                              )}
                              {item.type === 'tenant' && !isChildTenant && item.isFree && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <Gift className="h-3 w-3 mr-1" />
                                  Gratuit
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {effectiveStatus === "TRIAL" && effectiveTrialDays !== null ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-4 w-4 text-yellow-500" />
                              <span>{effectiveTrialDays}j restants</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(item.createdAt), "d MMM yyyy", { locale: fr })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {item.type === 'tenant' && (
                              <>
                                <Link href={`/superadmin/tenants/${item.id}`}>
                                  <Button variant="ghost" size="icon" data-testid={`button-detail-tenant-${item.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <a href={`/structures/${item.slug}`} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" data-testid={`button-view-tenant-${item.id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => sendResetLinkMutation.mutate(item.id)}
                                  disabled={sendResetLinkMutation.isPending}
                                  title="Envoyer un lien de reinitialisation de mot de passe"
                                  data-testid={`button-reset-password-${item.id}`}
                                >
                                  {sendResetLinkMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <KeyRound className="h-4 w-4" />
                                  )}
                                </Button>
                                {item.lifecycleStatus === "ARCHIVED" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteTenantId(item.id)}
                                    data-testid={`button-delete-tenant-${item.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </>
                            )}
                            {item.type === 'association' && parentTenant && (
                              <a href={`/structures/${parentTenant.slug}/${item.slug}`} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" data-testid={`button-view-association-${item.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTenantId} onOpenChange={(open) => !open && setDeleteTenantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Toutes les donnees associees a ce client seront definitivement supprimees : idees, incidents, reunions, associations, utilisateurs, abonnements, ainsi que tous les tenants enfants (mairies rattachees, associations).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-tenant">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTenantId && deleteTenantMutation.mutate(deleteTenantId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-tenant"
            >
              {deleteTenantMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperadminLayout>
  );
}
