import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRight, ArrowLeft, Plus, Minus, Users, Building, Landmark, Check } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { SubscriptionPlan, Addon, PlanAddonAccess } from "@shared/schema";
import { getPlanTheme, planThemes, type OrganizationType } from "@/lib/plan-themes";

interface PlanWithAddonAccess extends SubscriptionPlan {
  addonAccess: (PlanAddonAccess & { addon: Addon })[];
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

interface PlanWithFeatures extends SubscriptionPlan {
  catalogFeatures?: CatalogFeatureAssignment[];
}

export default function SignupOptions() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const planId = searchParams.get("plan");
  const tenantType = searchParams.get("type") as "MAIRIE" | "EPCI" | "ASSOCIATION" | null;

  const [quantities, setQuantities] = useState<Record<string, number>>({
    communes: 0,
    associations: 0,
    admins: 0,
  });

  const { data: allPlans, isLoading: plansLoading } = useQuery<PlanWithFeatures[]>({
    queryKey: ["/api/public/plans-catalog"],
  });

  const { data: addons, isLoading: addonsLoading } = useQuery<Addon[]>({
    queryKey: ["/api/public/addons"],
  });

  const { data: allPlansWithAddons } = useQuery<PlanWithAddonAccess[]>({
    queryKey: ["/api/public/plans-with-addons"],
  });

  const plan = allPlans?.find(p => p.id === planId);
  const planWithAddons = allPlansWithAddons?.find(p => p.id === planId);
  const isLoading = plansLoading || addonsLoading;

  const getAddonUnitPrice = (addonCode: string): number => {
    if (!addons) return 0;
    const addon = addons.find(a => a.code.toUpperCase() === addonCode.toUpperCase());
    if (!addon) return 0;
    
    const accessEntry = planWithAddons?.addonAccess?.find(
      a => a.addon?.code?.toUpperCase() === addonCode.toUpperCase()
    );
    return accessEntry?.monthlyPrice ?? addon.defaultMonthlyPrice;
  };

  const isAddonEnabled = (addonCode: string): boolean => {
    if (!planWithAddons?.addonAccess) return false;
    return planWithAddons.addonAccess.some(a => 
      a.addon?.code?.toUpperCase() === addonCode.toUpperCase() && a.isEnabled
    );
  };

  const incrementQuantity = (key: string) => {
    setQuantities(prev => ({ ...prev, [key]: prev[key] + 1 }));
  };

  const decrementQuantity = (key: string) => {
    const min = 0;
    setQuantities(prev => ({ ...prev, [key]: Math.max(min, prev[key] - 1) }));
  };

  const calculateTotalPrice = (): number => {
    if (!plan) return 0;
    let total = plan.monthlyPrice;

    if (tenantType === "EPCI" && quantities.communes > 0) {
      total += getAddonUnitPrice("MAIRIES") * quantities.communes;
    }

    if (quantities.associations > 0) {
      total += getAddonUnitPrice("ASSOCIATIONS") * quantities.associations;
    }

    if (quantities.admins > 0) {
      total += getAddonUnitPrice("ADMIN") * quantities.admins;
    }

    return total;
  };

  const handleContinue = () => {
    const params = new URLSearchParams();
    params.set("plan", planId || "");
    params.set("type", tenantType || "");
    params.set("communes", quantities.communes.toString());
    params.set("associations", quantities.associations.toString());
    params.set("admins", quantities.admins.toString());
    navigate(`/subscribe/account?${params.toString()}`);
  };

  const handleSkip = () => {
    const params = new URLSearchParams();
    params.set("plan", planId || "");
    params.set("type", tenantType || "");
    navigate(`/subscribe/account?${params.toString()}`);
  };

  if (!planId || !tenantType) {
    return (
      <MainLayout>
        <section className="py-20">
          <div className="mx-auto max-w-lg px-4 text-center">
            <h1 className="font-display text-2xl font-bold mb-4">Parametres manquants</h1>
            <p className="text-muted-foreground mb-8">
              Veuillez d'abord selectionner un forfait.
            </p>
            <Link href="/pricing">
              <Button>Voir les forfaits</Button>
            </Link>
          </div>
        </section>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <section className="py-20">
          <div className="mx-auto max-w-lg px-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Chargement...</p>
          </div>
        </section>
      </MainLayout>
    );
  }

  const showCommunesOption = tenantType === "EPCI" && isAddonEnabled("MAIRIES");
  const showAssociationsOption = isAddonEnabled("ASSOCIATIONS");
  const showAdminsOption = isAddonEnabled("ADMIN");
  const hasAnyOptions = showCommunesOption || showAssociationsOption || showAdminsOption;

  const theme = tenantType ? planThemes[tenantType as OrganizationType] : planThemes.MAIRIE;
  const ThemeIcon = theme.icon;

  return (
    <MainLayout>
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-2xl px-4">
          <div 
            className="rounded-lg px-6 py-6 text-center text-white mb-8"
            style={{ background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})` }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <ThemeIcon className="h-6 w-6" />
              <span className="text-sm font-medium uppercase tracking-wide opacity-90">{theme.label}</span>
            </div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-options-title">
              Options supplementaires
            </h1>
            <p className="mt-2 opacity-90">
              Configurez les options de votre forfait {plan?.name}
            </p>
          </div>

          <div className="flex items-center justify-between mb-6">
            <Link href="/pricing">
              <Button variant="ghost" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Retour aux forfaits
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Badge style={{ backgroundColor: theme.colors.badgeBg, color: theme.colors.badgeText }}>{plan?.name}</Badge>
            </div>
          </div>

          {plan && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Fonctionnalites incluses</CardTitle>
                <CardDescription>
                  Ces fonctionnalites sont incluses dans votre forfait {plan.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plan.catalogFeatures && plan.catalogFeatures.length > 0 ? (
                    [...plan.catalogFeatures]
                      .sort((a, b) => (a.feature?.displayOrder || 0) - (b.feature?.displayOrder || 0))
                      .map((cf) => (
                        <li key={cf.id} className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0" style={{ color: theme.colors.primary }} />
                          <span>{cf.feature?.name || 'Fonctionnalite'}</span>
                        </li>
                      ))
                  ) : (
                    <>
                      {plan.hasIdeas && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0" style={{ color: theme.colors.primary }} />
                          <span>Boite a idees</span>
                        </li>
                      )}
                      {plan.hasIncidents && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0" style={{ color: theme.colors.primary }} />
                          <span>Signalements</span>
                        </li>
                      )}
                      {plan.hasMeetings && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0" style={{ color: theme.colors.primary }} />
                          <span>Evenements et reunions</span>
                        </li>
                      )}
                    </>
                  )}
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" style={{ color: theme.colors.primary }} />
                    <span>1 administrateur inclus</span>
                  </li>
                  {plan.associationsIncluded > 0 && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0" style={{ color: theme.colors.primary }} />
                      <span>{plan.associationsIncluded} association(s) incluse(s)</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {!hasAnyOptions ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-6">
                  Aucune option supplementaire n'est disponible pour ce forfait.
                </p>
                <Button 
                  onClick={handleSkip} 
                  className="gap-2 text-white border-0"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  Continuer l'inscription
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Personnalisez votre abonnement</CardTitle>
                  <CardDescription>
                    Ajoutez des options selon vos besoins. Vous pourrez les modifier plus tard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {showCommunesOption && (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Landmark className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">Communes supplementaires</div>
                          <div className="text-sm text-muted-foreground">
                            {getAddonUnitPrice("MAIRIES")} EUR/unite/mois
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => decrementQuantity("communes")}
                          disabled={quantities.communes === 0}
                          data-testid="button-communes-minus"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-medium text-lg">
                          {quantities.communes}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => incrementQuantity("communes")}
                          data-testid="button-communes-plus"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {showAssociationsOption && (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">Associations</div>
                          <div className="text-sm text-muted-foreground">
                            {plan?.associationsIncluded || 0} incluse(s), {getAddonUnitPrice("ASSOCIATIONS")} EUR/unite supp./mois
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => decrementQuantity("associations")}
                          disabled={quantities.associations === 0}
                          data-testid="button-associations-minus"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-medium text-lg">
                          {quantities.associations}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => incrementQuantity("associations")}
                          data-testid="button-associations-plus"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {showAdminsOption && (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">Administrateurs supplementaires</div>
                          <div className="text-sm text-muted-foreground">
                            1 admin inclus, {getAddonUnitPrice("ADMIN")} EUR/admin supp./mois
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => decrementQuantity("admins")}
                          disabled={quantities.admins <= 0}
                          data-testid="button-admins-minus"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-medium text-lg">
                          +{quantities.admins}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => incrementQuantity("admins")}
                          data-testid="button-admins-plus"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Recapitulatif</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Forfait {plan?.name}</span>
                      <span>{plan?.monthlyPrice} EUR/mois</span>
                    </div>
                    {quantities.communes > 0 && showCommunesOption && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          + {quantities.communes} commune(s) supp.
                        </span>
                        <span>
                          {getAddonUnitPrice("MAIRIES") * quantities.communes} EUR/mois
                        </span>
                      </div>
                    )}
                    {quantities.associations > 0 && showAssociationsOption && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          + {quantities.associations} association(s) supp.
                        </span>
                        <span>
                          {getAddonUnitPrice("ASSOCIATIONS") * quantities.associations} EUR/mois
                        </span>
                      </div>
                    )}
                    {quantities.admins > 0 && showAdminsOption && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          + {quantities.admins} admin(s) supp.
                        </span>
                        <span>
                          {getAddonUnitPrice("ADMIN") * quantities.admins} EUR/mois
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-lg">0 EUR</span>
                          <span className="text-muted-foreground ml-2">pendant 30 jours</span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Puis {calculateTotalPrice()} EUR/mois a partir du 31eme jour
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3">
                  <Button 
                    onClick={handleContinue} 
                    className="w-full gap-2 text-white border-0" 
                    style={{ backgroundColor: theme.colors.primary }}
                    data-testid="button-continue"
                  >
                    Continuer l'inscription
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" onClick={handleSkip} className="w-full" data-testid="button-skip">
                    Passer cette etape
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
