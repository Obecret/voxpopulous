import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Building2, 
  ArrowLeft, 
  ExternalLink, 
  Mail, 
  User, 
  Key, 
  Package,
  Users,
  Building,
  Send,
  Copy,
  Check,
  LogIn,
  Pencil,
  Landmark,
  PauseCircle,
  PlayCircle,
  Archive,
  Gift,
  AlertTriangle,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, SubscriptionPlan, User as UserType } from "@shared/schema";

interface TenantAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

interface Quota {
  used: number;
  allowed: number;
  remaining: number;
}

interface CatalogFeatureAssignment {
  id: string;
  planId: string;
  featureId: string;
  feature?: {
    id: string;
    name: string;
    code: string;
    displayOrder: number;
  };
}

interface PlanWithCatalogFeatures extends SubscriptionPlan {
  catalogFeatures?: CatalogFeatureAssignment[];
}

interface TenantDetails {
  tenant: Tenant;
  admins: TenantAdmin[];
  plan: PlanWithCatalogFeatures | null;
  quotas: {
    associations: Quota;
    admins: Quota;
    communes: Quota;
  };
}

const BILLING_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  TRIAL: { label: "Essai", variant: "secondary" },
  ACTIVE: { label: "Actif", variant: "default" },
  SUSPENDED: { label: "Suspendu", variant: "destructive" },
  CANCELLED: { label: "Annule", variant: "outline" },
};

const LIFECYCLE_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Actif", variant: "default" },
  SUSPENDED: { label: "Suspendu", variant: "destructive" },
  ARCHIVED: { label: "Archive", variant: "outline" },
};

export default function SuperadminTenantDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<TenantAdmin | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [quantitiesDialogOpen, setQuantitiesDialogOpen] = useState(false);
  const [editQuantities, setEditQuantities] = useState({
    purchasedCommunes: 0,
    purchasedAssociations: 0,
    purchasedAdmins: 0,
  });
  const [lifecycleDialogOpen, setLifecycleDialogOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"suspend" | "unsuspend" | "archive" | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);

  const { data, isLoading } = useQuery<TenantDetails>({
    queryKey: ["/api/superadmin/tenants", id, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/superadmin/tenants/${id}/details`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch tenant details");
      return res.json();
    },
    enabled: !!id,
  });

  // Fetch addons with tiers for pricing calculation
  interface AddonTier {
    minQuantity: number;
    maxQuantity: number | null;
    monthlyPrice: number;
  }
  interface AddonWithTiers {
    id: string;
    code: string;
    tiers: AddonTier[];
  }
  const { data: addons } = useQuery<AddonWithTiers[]>({
    queryKey: ["/api/public/addons"],
  });

  // Helper to find tier price based on quantity
  const getTierPrice = (addonCode: string, quantity: number): number => {
    if (!addons || quantity <= 0) return 0;
    const addon = addons.find(a => a.code.toUpperCase() === addonCode.toUpperCase());
    if (!addon) return 0;
    // Defensive check: if tiers is undefined or empty, return 0
    if (!addon.tiers || !Array.isArray(addon.tiers) || addon.tiers.length === 0) return 0;
    const tier = addon.tiers.find(t => 
      quantity >= t.minQuantity && 
      (t.maxQuantity === null || quantity <= t.maxQuantity)
    );
    return tier?.monthlyPrice || 0;
  };

  // Calculate additional cost based on purchased quantities
  // Note: "purchased" quantities are EXTRA quantities beyond what the plan includes
  // The tier prices are TOTAL monthly costs for the tier (not per-unit)
  const calculateAdditionalCost = () => {
    let cost = 0;
    // Communes addon for EPCI (purchasedCommunes is extra beyond plan)
    if (data?.tenant?.tenantType === "EPCI" && editQuantities.purchasedCommunes > 0) {
      cost += getTierPrice("MAIRIES", editQuantities.purchasedCommunes);
    }
    // Associations addon (purchasedAssociations is extra beyond plan)
    if (editQuantities.purchasedAssociations > 0) {
      cost += getTierPrice("ASSOCIATIONS", editQuantities.purchasedAssociations);
    }
    // Admins addon (purchasedAdmins is extra beyond plan)
    if (editQuantities.purchasedAdmins > 0) {
      cost += getTierPrice("ADMIN", editQuantities.purchasedAdmins);
    }
    return cost;
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${id}/admins/${adminId}/reset-password`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de la reinitialisation");
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants", id, "details"] });
      if (result.emailSent) {
        toast({
          title: "Mot de passe reinitialise",
          description: "Un email avec les nouveaux identifiants a ete envoye.",
        });
        setResetDialogOpen(false);
      } else if (result.newPassword) {
        setNewPassword(result.newPassword);
        toast({
          title: "Mot de passe reinitialise",
          description: "L'email n'a pas pu etre envoye. Copiez le mot de passe ci-dessous.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de reinitialiser le mot de passe.",
        variant: "destructive",
      });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${id}/impersonate/${adminId}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de l'impersonation");
      }
      return res.json();
    },
    onSuccess: (result) => {
      if (result.redirectUrl) {
        toast({
          title: "Connexion reussie",
          description: `Redirection vers l'espace admin...`,
        });
        // Redirect to the admin dashboard - session is already set
        window.location.href = result.redirectUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de se connecter.",
        variant: "destructive",
      });
    },
  });

  const updateQuantitiesMutation = useMutation({
    mutationFn: async (quantities: typeof editQuantities) => {
      const res = await apiRequest("PUT", `/api/superadmin/tenants/${id}/quantities`, quantities);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de la mise a jour");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants", id, "details"] });
      setQuantitiesDialogOpen(false);
      toast({
        title: "Quantites mises a jour",
        description: "Les quotas ont ete modifies avec succes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour les quantites.",
        variant: "destructive",
      });
    },
  });

  // Lifecycle mutations
  const suspendMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${id}/suspend`, { reason });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de la suspension");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants", id, "details"] });
      setLifecycleDialogOpen(false);
      setLifecycleReason("");
      toast({ title: "Client suspendu", description: "Le client a ete suspendu avec succes." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${id}/unsuspend`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de la reactivation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants", id, "details"] });
      setLifecycleDialogOpen(false);
      toast({ title: "Client reactive", description: "Le client a ete reactive avec succes." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${id}/archive`, { reason });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de l'archivage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants", id, "details"] });
      setLifecycleDialogOpen(false);
      setLifecycleReason("");
      toast({ title: "Client archive", description: "Le client a ete archive avec succes." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const setFreeMutation = useMutation({
    mutationFn: async (isFree: boolean) => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${id}/set-free`, { isFree });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de la mise a jour");
      }
      return res.json();
    },
    onSuccess: (_, isFree) => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants", id, "details"] });
      toast({ 
        title: isFree ? "Client gratuit" : "Client payant", 
        description: isFree ? "Le client est maintenant gratuit." : "Le client est maintenant payant." 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ reason, atPeriodEnd }: { reason: string; atPeriodEnd: boolean }) => {
      const res = await apiRequest("POST", `/api/superadmin/tenants/${id}/cancel-subscription`, { 
        reason, 
        cancelAtPeriodEnd: atPeriodEnd 
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(error.message || "Erreur lors de l'annulation");
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants", id, "details"] });
      setCancelDialogOpen(false);
      setCancelReason("");
      toast({ 
        title: "Abonnement annule", 
        description: result.message || "L'abonnement a ete annule avec succes." 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleLifecycleAction = () => {
    if (lifecycleAction === "suspend" && lifecycleReason) {
      suspendMutation.mutate(lifecycleReason);
    } else if (lifecycleAction === "unsuspend") {
      unsuspendMutation.mutate();
    } else if (lifecycleAction === "archive" && lifecycleReason) {
      archiveMutation.mutate(lifecycleReason);
    }
  };

  const openQuantitiesDialog = () => {
    if (data?.tenant) {
      setEditQuantities({
        purchasedCommunes: data.tenant.purchasedCommunes || 0,
        purchasedAssociations: data.tenant.purchasedAssociations || 0,
        purchasedAdmins: data.tenant.purchasedAdmins || 0,
      });
      setQuantitiesDialogOpen(true);
    }
  };

  const handleResetPassword = (admin: TenantAdmin) => {
    setSelectedAdmin(admin);
    setNewPassword(null);
    setResetDialogOpen(true);
  };

  const handleImpersonate = (adminId: string) => {
    impersonateMutation.mutate(adminId);
  };

  const confirmResetPassword = () => {
    if (selectedAdmin) {
      resetPasswordMutation.mutate(selectedAdmin.id);
    }
  };

  const copyPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <SuperadminLayout>
        <div className="p-8 text-center text-muted-foreground">
          Chargement...
        </div>
      </SuperadminLayout>
    );
  }

  if (!data) {
    return (
      <SuperadminLayout>
        <div className="p-8 text-center text-muted-foreground">
          Client non trouve
        </div>
      </SuperadminLayout>
    );
  }

  const { tenant, admins, plan, quotas } = data;
  const statusConfig = BILLING_STATUS_CONFIG[tenant.billingStatus] || BILLING_STATUS_CONFIG.TRIAL;
  const lifecycleConfig = LIFECYCLE_STATUS_CONFIG[tenant.lifecycleStatus || "ACTIVE"] || LIFECYCLE_STATUS_CONFIG.ACTIVE;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/superadmin/tenants">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold" data-testid="text-tenant-name">
                {tenant.name}
              </h1>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              {tenant.lifecycleStatus && tenant.lifecycleStatus !== "ACTIVE" && (
                <Badge variant={lifecycleConfig.variant} data-testid="badge-lifecycle-status">
                  {lifecycleConfig.label}
                </Badge>
              )}
              {tenant.isFree && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-free">
                  <Gift className="h-3 w-3 mr-1" />
                  Gratuit
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">/{tenant.slug}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`/structures/${tenant.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2" data-testid="button-view-site">
                <ExternalLink className="h-4 w-4" />
                Site public
              </Button>
            </a>
            {admins.length > 0 ? (
              <Button 
                variant="default" 
                className="gap-2" 
                onClick={() => handleImpersonate(admins[0].id)}
                disabled={impersonateMutation.isPending}
                data-testid="button-view-admin"
              >
                <LogIn className="h-4 w-4" />
                {impersonateMutation.isPending ? "Connexion..." : "Espace admin"}
              </Button>
            ) : (
              <Button variant="outline" className="gap-2" disabled data-testid="button-view-admin">
                <User className="h-4 w-4" />
                Espace admin
              </Button>
            )}
          </div>
        </div>

        {/* Lifecycle Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Gestion du compte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">
                  <p>Statut du compte: <strong>{lifecycleConfig.label}</strong></p>
                  {tenant.suspendedAt && (
                    <p className="text-destructive">
                      Suspendu le {format(new Date(tenant.suspendedAt), "d MMMM yyyy", { locale: fr })}
                      {tenant.suspendedReason && ` - Raison: ${tenant.suspendedReason}`}
                    </p>
                  )}
                  {tenant.archivedAt && (
                    <p className="text-muted-foreground">
                      Archive le {format(new Date(tenant.archivedAt), "d MMMM yyyy", { locale: fr })}
                      {tenant.archivedReason && ` - Raison: ${tenant.archivedReason}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {tenant.lifecycleStatus === "ACTIVE" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLifecycleAction("suspend");
                        setLifecycleDialogOpen(true);
                      }}
                      data-testid="button-suspend"
                    >
                      <PauseCircle className="h-4 w-4 mr-2" />
                      Suspendre
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLifecycleAction("archive");
                        setLifecycleDialogOpen(true);
                      }}
                      data-testid="button-archive"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archiver
                    </Button>
                  </>
                )}
                {tenant.lifecycleStatus === "SUSPENDED" && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setLifecycleAction("unsuspend");
                        setLifecycleDialogOpen(true);
                      }}
                      data-testid="button-unsuspend"
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Reactiver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLifecycleAction("archive");
                        setLifecycleDialogOpen(true);
                      }}
                      data-testid="button-archive"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archiver
                    </Button>
                  </>
                )}
                <Button
                  variant={tenant.isFree ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setFreeMutation.mutate(!tenant.isFree)}
                  disabled={setFreeMutation.isPending}
                  data-testid="button-toggle-free"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  {tenant.isFree ? "Retirer gratuite" : "Rendre gratuit"}
                </Button>
                {tenant.billingStatus !== "CANCELLED" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCancelDialogOpen(true)}
                    data-testid="button-cancel-subscription"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler l'abonnement
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Forfait
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">{plan.name}</span>
                    <Badge variant="secondary">
                      {tenant.billingInterval === "YEARLY" ? "Annuel" : "Mensuel"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {plan.catalogFeatures && plan.catalogFeatures.length > 0 ? (
                      plan.catalogFeatures
                        .sort((a, b) => (a.feature?.displayOrder || 0) - (b.feature?.displayOrder || 0))
                        .map((assignment) => (
                          <p key={assignment.id}>{assignment.feature?.name || 'Fonctionnalite'}: Oui</p>
                        ))
                    ) : (
                      <>
                        <p>Idees citoyennes: {plan.hasIdeas ? "Oui" : "Non"}</p>
                        <p>Signalements: {plan.hasIncidents ? "Oui" : "Non"}</p>
                        <p>Reunions: {plan.hasMeetings ? "Oui" : "Non"}</p>
                      </>
                    )}
                    <p>
                      Admins max: {(plan.maxAdmins || 0) + (tenant.purchasedAdmins || 0)}
                      {tenant.purchasedAdmins ? ` (${plan.maxAdmins} inclus + ${tenant.purchasedAdmins} en option)` : ""}
                    </p>
                    <p>
                      Associations incluses: {(plan.associationsIncluded || 0) + (tenant.purchasedAssociations || 0)}
                      {tenant.purchasedAssociations ? ` (${plan.associationsIncluded} incluses + ${tenant.purchasedAssociations} en option)` : ""}
                    </p>
                    {tenant.tenantType === "EPCI" && (
                      <p>
                        Mairies incluses: {(plan.communesIncluded || 0) + (tenant.purchasedCommunes || 0)}
                        {tenant.purchasedCommunes ? ` (${plan.communesIncluded} incluses + ${tenant.purchasedCommunes} en option)` : ""}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Aucun forfait assigne</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Consommation
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openQuantitiesDialog}
                data-testid="button-edit-quantities"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Administrateurs</span>
                  <span className="text-sm text-muted-foreground">
                    {quotas.admins.used} / {quotas.admins.allowed}
                    {tenant.purchasedAdmins ? ` (+${tenant.purchasedAdmins} achetes)` : ""}
                  </span>
                </div>
                <Progress 
                  value={quotas.admins.allowed > 0 ? (quotas.admins.used / quotas.admins.allowed) * 100 : 0} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Associations</span>
                  <span className="text-sm text-muted-foreground">
                    {quotas.associations.used} / {quotas.associations.allowed}
                    {tenant.purchasedAssociations ? ` (+${tenant.purchasedAssociations} achetees)` : ""}
                  </span>
                </div>
                <Progress 
                  value={quotas.associations.allowed > 0 ? (quotas.associations.used / quotas.associations.allowed) * 100 : 0} 
                  className="h-2"
                />
              </div>
              {tenant.tenantType === "EPCI" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Communes</span>
                    <span className="text-sm text-muted-foreground">
                      {quotas.communes.used} / {quotas.communes.allowed}
                      {tenant.purchasedCommunes ? ` (+${tenant.purchasedCommunes} achetees)` : ""}
                    </span>
                  </div>
                  <Progress 
                    value={quotas.communes.allowed > 0 ? (quotas.communes.used / quotas.communes.allowed) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Administrateurs
            </CardTitle>
            <CardDescription>
              Comptes ayant acces a l'espace d'administration de cette structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun administrateur
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Inscription</TableHead>
                    <TableHead className="w-[250px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {admin.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{admin.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(admin.createdAt), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleImpersonate(admin.id)}
                            disabled={impersonateMutation.isPending}
                            data-testid={`button-impersonate-${admin.id}`}
                          >
                            <LogIn className="h-4 w-4" />
                            Connecter
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleResetPassword(admin)}
                            data-testid={`button-reset-password-${admin.id}`}
                          >
                            <Key className="h-4 w-4" />
                            MDP
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations de contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Nom:</strong> {tenant.contactName || "-"}</p>
            <p><strong>Email:</strong> {tenant.contactEmail || "-"}</p>
            <p><strong>Adresse:</strong> {tenant.contactAddress || "-"}</p>
            <p><strong>SIRET:</strong> {tenant.siret || "-"}</p>
            <p><strong>Inscription:</strong> {format(new Date(tenant.createdAt), "d MMMM yyyy", { locale: fr })}</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {newPassword ? (
                "Le mot de passe a ete reinitialise. L'email n'a pas pu etre envoye, veuillez copier le mot de passe ci-dessous :"
              ) : (
                `Voulez-vous reinitialiser le mot de passe de ${selectedAdmin?.name} (${selectedAdmin?.email}) ? Un email sera envoye avec les nouveaux identifiants.`
              )}
            </DialogDescription>
          </DialogHeader>
          
          {newPassword && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <code className="flex-1 font-mono">{newPassword}</code>
              <Button variant="outline" size="icon" onClick={copyPassword}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}

          <DialogFooter>
            {newPassword ? (
              <Button onClick={() => setResetDialogOpen(false)}>
                Fermer
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={confirmResetPassword}
                  disabled={resetPasswordMutation.isPending}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {resetPasswordMutation.isPending ? "Envoi..." : "Reinitialiser et envoyer"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quantitiesDialogOpen} onOpenChange={setQuantitiesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les quantites</DialogTitle>
            <DialogDescription>
              Ajustez les quantites achetees pour ce client. Ces quantites s'ajoutent aux quotas inclus dans le forfait.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {tenant?.tenantType === "EPCI" && (
              <div className="space-y-2">
                <Label htmlFor="purchasedCommunes">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    Communes supplementaires
                  </div>
                </Label>
                <Input
                  id="purchasedCommunes"
                  type="number"
                  min={0}
                  value={editQuantities.purchasedCommunes}
                  onChange={(e) => setEditQuantities(prev => ({
                    ...prev,
                    purchasedCommunes: parseInt(e.target.value) || 0
                  }))}
                  data-testid="input-purchased-communes"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre de communes supplementaires au-dela du forfait
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="purchasedAssociations">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Associations supplementaires
                </div>
              </Label>
              <Input
                id="purchasedAssociations"
                type="number"
                min={0}
                value={editQuantities.purchasedAssociations}
                onChange={(e) => setEditQuantities(prev => ({
                  ...prev,
                  purchasedAssociations: parseInt(e.target.value) || 0
                }))}
                data-testid="input-purchased-associations"
              />
              <p className="text-xs text-muted-foreground">
                Nombre d'associations supplementaires au-dela du forfait
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="purchasedAdmins">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Administrateurs supplementaires
                </div>
              </Label>
              <Input
                id="purchasedAdmins"
                type="number"
                min={0}
                value={editQuantities.purchasedAdmins}
                onChange={(e) => setEditQuantities(prev => ({
                  ...prev,
                  purchasedAdmins: parseInt(e.target.value) || 0
                }))}
                data-testid="input-purchased-admins"
              />
              <p className="text-xs text-muted-foreground">
                Nombre d'administrateurs supplementaires au-dela du forfait
              </p>
            </div>

            {/* Dynamic price estimation */}
            {calculateAdditionalCost() > 0 && (
              <div className="mt-4 p-3 rounded-md bg-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cout mensuel supplementaire estime:</span>
                  <span className="text-lg font-bold text-primary">
                    +{calculateAdditionalCost().toFixed(2).replace(".", ",")} EUR/mois
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Basé sur les paliers tarifaires actuels
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuantitiesDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => updateQuantitiesMutation.mutate(editQuantities)}
              disabled={updateQuantitiesMutation.isPending}
              data-testid="button-save-quantities"
            >
              {updateQuantitiesMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lifecycle Action Dialog */}
      <Dialog open={lifecycleDialogOpen} onOpenChange={setLifecycleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lifecycleAction === "suspend" && "Suspendre le client"}
              {lifecycleAction === "unsuspend" && "Reactiver le client"}
              {lifecycleAction === "archive" && "Archiver le client"}
            </DialogTitle>
            <DialogDescription>
              {lifecycleAction === "suspend" && "Le client ne pourra plus creer ou modifier de contenu mais pourra toujours consulter ses donnees."}
              {lifecycleAction === "unsuspend" && "Le client retrouvera un acces complet a la plateforme."}
              {lifecycleAction === "archive" && "Le client sera completement desactive. Cette action est irreversible et le compte pourra etre supprime definitivement."}
            </DialogDescription>
          </DialogHeader>

          {(lifecycleAction === "suspend" || lifecycleAction === "archive") && (
            <div className="space-y-2">
              <Label htmlFor="lifecycleReason">
                Raison {lifecycleAction === "suspend" ? "de la suspension" : "de l'archivage"}
              </Label>
              <Input
                id="lifecycleReason"
                value={lifecycleReason}
                onChange={(e) => setLifecycleReason(e.target.value)}
                placeholder="Entrez la raison..."
                data-testid="input-lifecycle-reason"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setLifecycleDialogOpen(false);
              setLifecycleReason("");
            }}>
              Annuler
            </Button>
            <Button 
              variant={lifecycleAction === "archive" ? "destructive" : "default"}
              onClick={handleLifecycleAction}
              disabled={
                ((lifecycleAction === "suspend" || lifecycleAction === "archive") && !lifecycleReason) ||
                suspendMutation.isPending || unsuspendMutation.isPending || archiveMutation.isPending
              }
              data-testid="button-confirm-lifecycle"
            >
              {suspendMutation.isPending || unsuspendMutation.isPending || archiveMutation.isPending 
                ? "En cours..." 
                : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler l'abonnement</DialogTitle>
            <DialogDescription>
              Cette action annulera l'abonnement du client. 
              {tenant.stripeSubscriptionId 
                ? " Pour les abonnements Stripe, vous pouvez choisir d'annuler immediatement ou a la fin de la periode de facturation."
                : " L'abonnement par mandat administratif sera annule immediatement."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Raison de l'annulation</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Entrez la raison de l'annulation..."
                rows={3}
                data-testid="input-cancel-reason"
              />
            </div>

            {tenant.stripeSubscriptionId && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cancelAtPeriodEnd"
                  checked={cancelAtPeriodEnd}
                  onCheckedChange={(checked) => setCancelAtPeriodEnd(checked === true)}
                  data-testid="checkbox-cancel-at-period-end"
                />
                <Label htmlFor="cancelAtPeriodEnd" className="text-sm cursor-pointer">
                  Annuler a la fin de la periode de facturation (recommande)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCancelDialogOpen(false);
                setCancelReason("");
              }}
            >
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={() => cancelSubscriptionMutation.mutate({ 
                reason: cancelReason, 
                atPeriodEnd: tenant.stripeSubscriptionId ? cancelAtPeriodEnd : false 
              })}
              disabled={!cancelReason || cancelSubscriptionMutation.isPending}
              data-testid="button-confirm-cancel-subscription"
            >
              {cancelSubscriptionMutation.isPending ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
