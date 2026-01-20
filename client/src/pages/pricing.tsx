import { Link } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Plus, Star } from "lucide-react";
import type { SubscriptionPlan, Feature, PlanFeatureAssignment, Addon, PlanAddonAccess } from "@shared/schema";
import { getPlanTheme, type OrganizationType } from "@/lib/plan-themes";

type CatalogAssignment = PlanFeatureAssignment & { feature: Feature };
type PlanAddonAccessWithAddon = PlanAddonAccess & { addon: Addon };
type PlanWithCatalog = SubscriptionPlan & { catalogFeatures: CatalogAssignment[] };
type PlanWithAddons = SubscriptionPlan & { addonAccess: PlanAddonAccessWithAddon[] };

export default function Pricing() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const { data: catalogPlans, isLoading: catalogLoading } = useQuery<PlanWithCatalog[]>({
    queryKey: ["/api/public/plans-catalog"],
  });

  const { data: plansWithAddons, isLoading: addonsLoading } = useQuery<PlanWithAddons[]>({
    queryKey: ["/api/public/plans-with-addons"],
  });

  const isLoading = catalogLoading || addonsLoading;

  const getEnabledAddons = (planId: string): PlanAddonAccessWithAddon[] => {
    const plan = plansWithAddons?.find(p => p.id === planId);
    return plan?.addonAccess?.filter(a => a.isEnabled) || [];
  };

  const getAddonLabel = (code: string): string => {
    switch (code.toUpperCase()) {
      case "ADMIN": return "Administrateurs";
      case "ASSOCIATIONS": return "Associations";
      case "MAIRIES": return "Mairies/Communes";
      default: return code;
    }
  };

  const faqs = [
    {
      question: "Puis-je annuler a tout moment ?",
      answer: "Oui, vous pouvez annuler votre abonnement a tout moment. Il restera actif jusqu'a la fin de la periode de facturation."
    },
    {
      question: "L'essai gratuit est-il sans engagement ?",
      answer: "Absolument. L'essai de 30 jours est entierement gratuit et sans carte bancaire requise."
    },
    {
      question: "Puis-je changer de plan plus tard ?",
      answer: "Oui, vous pouvez passer d'un plan a l'autre a tout moment. La difference sera calculee au prorata."
    },
    {
      question: "Mes donnees sont-elles securisees ?",
      answer: "Toutes les donnees sont securisees et chiffrees. Nous sommes conformes au RGPD."
    }
  ];

  const activePlans = catalogPlans?.filter(p => p.isActive) || [];

  return (
    <MainLayout>
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <h1 className="font-display text-4xl font-bold sm:text-5xl" data-testid="text-pricing-title">
              Des tarifs simples et transparents
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Choisissez le plan adapte a la taille de votre structure. 
              Tous les plans incluent un essai gratuit de 30 jours.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activePlans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucun forfait disponible pour le moment.</p>
              <Link href="/contact">
                <Button className="mt-4">Nous contacter</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
              {activePlans.map((plan) => {
                const catalogFeatures = plan.catalogFeatures || [];
                const sortedFeatures = [...catalogFeatures].sort((a, b) => 
                  (a.feature?.displayOrder || 0) - (b.feature?.displayOrder || 0)
                );
                
                const targetType = (plan.targetTenantTypes?.[0] as OrganizationType) || "MAIRIE";
                const theme = getPlanTheme(targetType);
                const ThemeIcon = theme.icon;
                
                return (
                  <Card 
                    key={plan.id} 
                    className={`relative flex flex-col w-full max-w-[300px] overflow-hidden ${plan.isBestValue ? 'shadow-lg ring-2 ring-offset-2' : ''}`}
                    style={{ 
                      borderColor: theme.colors.border,
                      ...(plan.isBestValue ? { "--tw-ring-color": theme.colors.primary } as React.CSSProperties : {})
                    }}
                    data-testid={`card-plan-${plan.code.toLowerCase()}`}
                  >
                    <div 
                      className="px-4 py-4 text-center text-white"
                      style={{ background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <ThemeIcon className="h-5 w-5" />
                        <span className="text-xs font-medium uppercase tracking-wide opacity-90">{theme.label}</span>
                        {plan.isBestValue && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 ml-1" />
                        )}
                      </div>
                    </div>
                    <CardHeader className="text-center pb-2 px-4 pt-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 px-4 pb-4">
                      <div className="text-center mb-6">
                        <div className="mb-2">
                          <span className="font-display text-4xl font-bold">0</span>
                          <span className="text-xl font-bold">EUR</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          pendant 30 jours
                        </p>
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground">
                            Puis a partir du 31eme jour :
                          </p>
                          <p className="font-semibold mt-1">
                            {plan.monthlyPrice}EUR/mois
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ou {plan.yearlyPrice}EUR/an
                          </p>
                        </div>
                      </div>
                      
                      <ul className="space-y-2 text-sm">
                        {sortedFeatures.length > 0 ? (
                          sortedFeatures.map(cf => (
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
                                <span>Reunions publiques</span>
                              </li>
                            )}
                          </>
                        )}
                        {(() => {
                          const enabledAddons = getEnabledAddons(plan.id);
                          if (enabledAddons.length > 0) {
                            return (
                              <li className="flex items-start gap-2 text-muted-foreground mt-2 pt-2 border-t">
                                <Plus className="h-4 w-4 shrink-0 mt-0.5" />
                                <span className="text-xs">
                                  Options disponibles : {enabledAddons.map(a => getAddonLabel(a.addon.code)).join(", ")}
                                </span>
                              </li>
                            );
                          }
                          return null;
                        })()}
                      </ul>
                    </CardContent>
                    <CardFooter className="px-4 pb-6">
                      <Link 
                        href={`/subscribe/options?plan=${plan.id}&type=${plan.targetTenantTypes?.[0] || 'MAIRIE'}`} 
                        className="w-full"
                      >
                        <Button 
                          className="w-full text-white border-0"
                          style={{ backgroundColor: theme.colors.primary }}
                          data-testid={`button-plan-${plan.code.toLowerCase()}`}
                        >
                          Essayer gratuitement
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 md:py-24 bg-muted/30">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-3xl font-bold text-center mb-12" data-testid="text-faq-title">
            Questions frequentes
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-background rounded-lg p-6 border" data-testid={`faq-${index}`}>
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4" data-testid="text-cta-title">
            Des questions sur nos offres ?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Notre equipe est la pour vous accompagner dans le choix de la solution adaptee.
          </p>
          <Link href="/contact">
            <Button size="lg" data-testid="button-contact-pricing">
              Nous contacter
            </Button>
          </Link>
        </div>
      </section>
    </MainLayout>
  );
}
