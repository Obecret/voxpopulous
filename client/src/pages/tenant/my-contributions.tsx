import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Lightbulb, AlertTriangle, ArrowRight, FileText, Clock, Info, RotateCcw } from "lucide-react";
import { useAnonymousId } from "@/hooks/use-anonymous-id";
import type { Tenant, Idea, Incident } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ideaStatusLabels: Record<string, string> = {
  NEW: "Nouvelle",
  UNDER_REVIEW: "En examen",
  APPROVED: "Approuvee",
  IMPLEMENTED: "Realisee",
  REJECTED: "Rejetee",
};

const incidentStatusLabels: Record<string, string> = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  RESOLVED: "Resolu",
  CLOSED: "Cloture",
};

const ideaStatusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  IMPLEMENTED: "bg-primary/10 text-primary",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const incidentStatusColors: Record<string, string> = {
  NEW: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CLOSED: "bg-muted text-muted-foreground",
};

interface MyContributionsData {
  ideas: Idea[];
  incidents: Incident[];
}

export default function MyContributions() {
  const params = useParams<{ slug: string }>();
  const { anonymousId, isReady, resetAnonymousId } = useAnonymousId();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data, isLoading, isError } = useQuery<MyContributionsData>({
    queryKey: ["/api/tenants", params.slug, "my-contributions", anonymousId],
    queryFn: async () => {
      if (!anonymousId) throw new Error("No anonymous ID");
      const response = await fetch(`/api/tenants/${params.slug}/my-contributions?anonymousId=${encodeURIComponent(anonymousId)}`);
      if (!response.ok) throw new Error("Failed to fetch contributions");
      return response.json();
    },
    enabled: isReady && !!anonymousId,
  });

  const ideas = data?.ideas || [];
  const incidents = data?.incidents || [];
  const totalContributions = ideas.length + incidents.length;
  const showLoading = !isReady || isLoading;

  return (
    <TenantLayout tenant={tenant || null}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2" data-testid="text-page-title">
            Mes contributions
          </h1>
          <p className="text-muted-foreground">
            Retrouvez toutes vos idees et signalements soumis sur cette plateforme.
          </p>
        </div>

        {showLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Une erreur est survenue lors du chargement de vos contributions.
              </p>
            </CardContent>
          </Card>
        ) : totalContributions === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Aucune contribution</h2>
              <p className="text-muted-foreground mb-6">
                Vous n'avez pas encore soumis d'idee ou de signalement depuis ce navigateur.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href={`/structures/${params.slug}/ideas/new`}>
                  <Button data-testid="button-new-idea">
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Proposer une idee
                  </Button>
                </Link>
                <Link href={`/structures/${params.slug}/incidents/new`}>
                  <Button variant="outline" data-testid="button-new-incident">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Signaler un probleme
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {ideas.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-xl font-semibold">
                    Mes idees ({ideas.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {ideas.map((idea) => (
                    <Card key={idea.id} data-testid={`card-idea-${idea.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <h3 className="font-medium truncate">{idea.title}</h3>
                              <Badge 
                                variant="secondary" 
                                className={ideaStatusColors[idea.status] || ""}
                              >
                                {ideaStatusLabels[idea.status] || idea.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {idea.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {format(new Date(idea.createdAt), "d MMMM yyyy", { locale: fr })}
                              </span>
                              {idea.category && (
                                <>
                                  <span className="text-muted-foreground/50">|</span>
                                  <Badge variant="outline" className="text-xs">
                                    {idea.category}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                          <Link href={`/structures/${params.slug}/ideas/track/${idea.publicToken}`}>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              data-testid={`button-track-idea-${idea.id}`}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {incidents.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-xl font-semibold">
                    Mes signalements ({incidents.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <Card key={incident.id} data-testid={`card-incident-${incident.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <h3 className="font-medium truncate">{incident.title}</h3>
                              <Badge 
                                variant="secondary" 
                                className={incidentStatusColors[incident.status] || ""}
                              >
                                {incidentStatusLabels[incident.status] || incident.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {incident.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {format(new Date(incident.createdAt), "d MMMM yyyy", { locale: fr })}
                              </span>
                              {incident.locationText && (
                                <>
                                  <span className="text-muted-foreground/50">|</span>
                                  <span className="truncate max-w-40">{incident.locationText}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Link href={`/structures/${params.slug}/incidents/track/${incident.publicToken}`}>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              data-testid={`button-track-incident-${incident.id}`}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <Card className="mt-8 bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Vos contributions sont associees a un identifiant anonyme stocke dans votre navigateur. 
                  Cet identifiant n'est pas lie a votre identite personnelle. 
                  Vous pouvez reinitialiser cet identifiant a tout moment, ce qui dissociera vos futures contributions des precedentes.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-muted-foreground"
                  onClick={() => {
                    resetAnonymousId();
                    window.location.reload();
                  }}
                  data-testid="button-reset-anonymous-id"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reinitialiser mon identifiant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}
