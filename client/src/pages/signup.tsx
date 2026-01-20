import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Building2, ArrowRight, ArrowLeft, Check, Landmark, Users, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SubscriptionPlan } from "@shared/schema";

type TenantType = "MAIRIE" | "EPCI" | "ASSOCIATION";

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

const tenantTypeInfo: Record<TenantType, { label: string; description: string; icon: typeof Building2 }> = {
  MAIRIE: {
    label: "Commune / Mairie",
    description: "Pour les municipalites et mairies",
    icon: Landmark,
  },
  EPCI: {
    label: "EPCI",
    description: "Etablissement Public de Cooperation Intercommunale",
    icon: Building,
  },
  ASSOCIATION: {
    label: "Association",
    description: "Pour les associations loi 1901",
    icon: Users,
  },
};

export default function Signup() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const urlPlanId = searchParams.get("plan");
  const urlType = searchParams.get("type") as TenantType | null;
  
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTenantType, setSelectedTenantType] = useState<TenantType | null>(urlType);

  const { data: plans, isLoading: plansLoading } = useQuery<PlanWithFeatures[]>({
    queryKey: [`/api/public/plans-catalog?tenantType=${selectedTenantType}`],
    enabled: !!selectedTenantType,
  });

  useEffect(() => {
    if (urlPlanId && urlType) {
      navigate(`/subscribe/options?plan=${urlPlanId}&type=${urlType}`);
    } else if (urlType && !urlPlanId) {
      setSelectedTenantType(urlType);
      setStep(2);
    }
  }, [urlPlanId, urlType, navigate]);

  const handleTenantTypeSelect = (type: TenantType) => {
    setSelectedTenantType(type);
    setStep(2);
  };

  const handlePlanSelect = (planId: string) => {
    navigate(`/subscribe/options?plan=${planId}&type=${selectedTenantType}`);
  };

  const goToStep = (targetStep: 1 | 2) => {
    if (targetStep < step) {
      setStep(targetStep);
    }
  };

  return (
    <MainLayout>
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary mb-4">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-signup-title">
              Creer votre espace
            </h1>
            <p className="mt-2 text-muted-foreground">
              Essai gratuit de 30 jours, sans engagement
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-8">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
              data-testid="step-1-indicator"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20">1</span>
              Type
            </button>
            <div className="flex items-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>
            <button
              type="button"
              onClick={() => selectedTenantType && goToStep(2)}
              disabled={!selectedTenantType}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              } ${!selectedTenantType ? "opacity-50 cursor-not-allowed" : ""}`}
              data-testid="step-2-indicator"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20">2</span>
              Forfait
            </button>
          </div>

          {step === 1 && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-semibold text-center mb-6">Quel type de structure etes-vous ?</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {(Object.keys(tenantTypeInfo) as TenantType[]).map((type) => {
                  const info = tenantTypeInfo[type];
                  const Icon = info.icon;
                  return (
                    <Card
                      key={type}
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => handleTenantTypeSelect(type)}
                      data-testid={`card-type-${type.toLowerCase()}`}
                    >
                      <CardContent className="pt-6 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                          <Icon className="h-7 w-7" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{info.label}</h3>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="gap-2"
                  data-testid="button-back-step1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
                <Badge variant="secondary" className="text-sm">
                  {selectedTenantType && tenantTypeInfo[selectedTenantType]?.label}
                </Badge>
              </div>

              <h2 className="text-xl font-semibold text-center mb-6">Choisissez votre forfait</h2>

              {plansLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : plans && plans.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {plans.map((plan) => {
                    const catalogFeatures = plan.catalogFeatures || [];
                    const sortedFeatures = [...catalogFeatures].sort((a, b) => 
                      (a.feature?.displayOrder || 0) - (b.feature?.displayOrder || 0)
                    );
                    
                    return (
                      <Card
                        key={plan.id}
                        className={`cursor-pointer hover-elevate transition-all relative ${plan.isBestValue ? "ring-1 ring-primary/50" : ""}`}
                        onClick={() => handlePlanSelect(plan.id)}
                        data-testid={`card-plan-${plan.code}`}
                      >
                        {plan.isBestValue && (
                          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                            Recommande
                          </Badge>
                        )}
                        <CardContent className="pt-6 text-center">
                          <h3 className="font-semibold text-lg mb-2">{plan.name}</h3>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                          )}
                          <div className="mb-4">
                            <div className="text-3xl font-bold">0 EUR</div>
                            <div className="text-sm text-muted-foreground">pendant 30 jours</div>
                            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                              Puis {plan.monthlyPrice} EUR/mois
                            </div>
                          </div>
                          <ul className="text-sm text-left space-y-2">
                            {sortedFeatures.length > 0 ? (
                              sortedFeatures.map((cf) => (
                                <li key={cf.id} className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>{cf.feature?.name || 'Fonctionnalite'}</span>
                                </li>
                              ))
                            ) : (
                              <>
                                {plan.hasIdeas && (
                                  <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary shrink-0" />
                                    <span>Boite a idees</span>
                                  </li>
                                )}
                                {plan.hasIncidents && (
                                  <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary shrink-0" />
                                    <span>Signalements</span>
                                  </li>
                                )}
                                {plan.hasMeetings && (
                                  <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary shrink-0" />
                                    <span>Reunions publiques</span>
                                  </li>
                                )}
                              </>
                            )}
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary shrink-0" />
                              <span>1 administrateur inclus</span>
                            </li>
                            {plan.associationsIncluded > 0 && (
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-primary shrink-0" />
                                <span>{plan.associationsIncluded} association(s)</span>
                              </li>
                            )}
                          </ul>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            className="w-full" 
                            variant={plan.isBestValue ? "default" : "outline"}
                          >
                            Selectionner
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Aucun forfait disponible pour ce type de structure.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
