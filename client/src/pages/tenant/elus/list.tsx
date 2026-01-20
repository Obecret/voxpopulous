import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Mail, MessageCircle, UserCircle } from "lucide-react";
import type { Tenant, ElectedOfficial, TenantInterventionDomain } from "@shared/schema";

type ElectedOfficialWithDomains = ElectedOfficial & { domains?: TenantInterventionDomain[] };

function getPhotoUrl(photoObjectPath: string | null | undefined, photoUrl: string | null | undefined): string | undefined {
  if (photoObjectPath) {
    const parts = photoObjectPath.split('/');
    const uploadsIndex = parts.findIndex(p => p === 'uploads');
    if (uploadsIndex !== -1) {
      return '/objects/' + parts.slice(uploadsIndex).join('/');
    }
  }
  return photoUrl || undefined;
}

function getFunctionLevel(fn: string | null | undefined): "primary" | "secondary" | "tertiary" {
  if (!fn) return "tertiary";
  const lower = fn.toLowerCase();
  if (lower.includes("maire") && !lower.includes("adjoint")) return "primary";
  if (lower.includes("president") && !lower.includes("vice")) return "primary";
  if (lower.includes("adjoint") || lower.includes("vice")) return "secondary";
  return "tertiary";
}

function getFunctionColors(level: "primary" | "secondary" | "tertiary") {
  switch (level) {
    case "primary":
      return {
        ring: "ring-2 ring-amber-500/50",
        bg: "bg-amber-50 dark:bg-amber-950/20",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
        text: "text-amber-700 dark:text-amber-400",
      };
    case "secondary":
      return {
        ring: "ring-2 ring-blue-500/50",
        bg: "bg-blue-50 dark:bg-blue-950/20",
        badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
        text: "text-blue-700 dark:text-blue-400",
      };
    case "tertiary":
      return {
        ring: "",
        bg: "",
        badge: "",
        text: "text-muted-foreground",
      };
  }
}

export default function ElusList() {
  const params = useParams<{ slug: string }>();

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: elus = [], isLoading } = useQuery<ElectedOfficialWithDomains[]>({
    queryKey: ["/api/tenants", params.slug, "elus"],
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex flex-wrap items-center justify-center">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-wrap items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" data-testid="text-page-not-found">Page introuvable</h1>
          <p className="text-muted-foreground mb-4">Cette page n'existe pas.</p>
          <Link href="/" data-testid="link-home">
            <Button data-testid="button-back-home">Retour a l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isAssociation = tenant.tenantType === "ASSOCIATION";
  const activeElus = elus.filter(e => e.isActive).sort((a, b) => a.displayOrder - b.displayOrder);

  const renderEluCard = (elu: ElectedOfficialWithDomains, size: "large" | "medium" | "small" = "medium") => {
    const level = getFunctionLevel(elu.function);
    const colors = getFunctionColors(level);
    
    const avatarSize = size === "large" ? "h-20 w-20" : size === "medium" ? "h-14 w-14" : "h-10 w-10";
    const nameSize = size === "large" ? "text-xl" : size === "medium" ? "text-base" : "text-sm";
    const padding = size === "large" ? "p-6" : size === "medium" ? "p-5" : "p-4";

    return (
      <Link href={`/structures/${params.slug}/elus/${elu.id}`} key={elu.id} data-testid={`link-elu-${elu.id}`}>
        <Card 
          className={`hover-elevate cursor-pointer transition-all group ${colors.ring} ${colors.bg}`} 
          data-testid={`card-elu-${elu.id}`}
        >
          <CardContent className={padding}>
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className={avatarSize}>
                <AvatarImage src={getPhotoUrl(elu.photoObjectPath, elu.photoUrl)} alt={`${elu.firstName} ${elu.lastName}`} />
                <AvatarFallback className={size === "large" ? "text-lg" : size === "small" ? "text-xs" : ""}>{getInitials(elu.firstName, elu.lastName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className={`font-semibold ${nameSize}`} data-testid={`text-elu-name-${elu.id}`}>
                      {elu.firstName} {elu.lastName}
                    </h3>
                    <p className={`font-medium text-sm ${colors.text}`} data-testid={`text-elu-function-${elu.id}`}>
                      {elu.function}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                
                {size !== "small" && elu.bio && (
                  <p className="text-muted-foreground text-sm mt-2 line-clamp-2" data-testid={`text-elu-bio-${elu.id}`}>{elu.bio}</p>
                )}
                
                {size !== "small" && elu.domains && elu.domains.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {elu.domains.slice(0, 3).map((domain) => (
                      <Badge 
                        key={domain.id} 
                        variant="secondary" 
                        className={`text-xs ${colors.badge}`}
                        data-testid={`badge-domain-${domain.id}`}
                      >
                        {domain.name}
                      </Badge>
                    ))}
                    {elu.domains.length > 3 && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-domains-more-${elu.id}`}>
                        +{elu.domains.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {size !== "small" && (
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                    {elu.email && (
                      <span className="inline-flex items-center gap-1" data-testid={`text-elu-email-indicator-${elu.id}`}>
                        <Mail className="h-3 w-3" />
                        Contact
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1" data-testid={`text-elu-chat-indicator-${elu.id}`}>
                      <MessageCircle className="h-3 w-3" />
                      Contacter
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  const primaryElus = activeElus.filter(e => getFunctionLevel(e.function) === "primary");
  const secondaryElus = activeElus.filter(e => getFunctionLevel(e.function) === "secondary");
  const tertiaryElus = activeElus.filter(e => getFunctionLevel(e.function) === "tertiary");

  return (
    <TenantLayout tenant={tenant}>
      <section className="py-12 md:py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8">
            <Link href={`/structures/${params.slug}`} data-testid="link-back">
              <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </Link>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2" data-testid="text-elus-title">
              {isAssociation ? "Les membres du bureau" : "Les elus"}
            </h1>
            <p className="text-muted-foreground text-lg" data-testid="text-elus-subtitle">
              {isAssociation 
                ? "Decouvrez les membres du bureau et contactez-les directement." 
                : "Decouvrez les elus qui representent votre commune et contactez-les."}
            </p>
          </div>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-start gap-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeElus.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UserCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-elus">
                  {isAssociation ? "Aucun membre a afficher pour le moment." : "Aucun elu a afficher pour le moment."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-12">
              {primaryElus.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold mb-4 flex flex-wrap items-center gap-2" data-testid="text-section-primary">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {isAssociation ? "Direction" : tenant.tenantType === "EPCI" ? "Presidence" : "Le Maire"}
                  </h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {primaryElus.map((elu) => renderEluCard(elu, "large"))}
                  </div>
                </div>
              )}

              {secondaryElus.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold mb-4 flex flex-wrap items-center gap-2" data-testid="text-section-secondary">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {isAssociation ? "Vice-presidents et Secretaires" : tenant.tenantType === "EPCI" ? "Vice-presidents" : "Les Adjoints"}
                  </h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {secondaryElus.map((elu) => renderEluCard(elu, "medium"))}
                  </div>
                </div>
              )}

              {tertiaryElus.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-semibold mb-4 text-muted-foreground" data-testid="text-section-tertiary">
                    {isAssociation ? "Autres membres" : "Les Conseillers"}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tertiaryElus.map((elu) => renderEluCard(elu, "small"))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </TenantLayout>
  );
}
