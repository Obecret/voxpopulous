import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lightbulb, Clock, Tag, ThumbsUp, CheckCircle2, XCircle, Eye, Wrench } from "lucide-react";
import type { Tenant, Idea } from "@shared/schema";
import { STATUS_LABELS } from "@shared/schema";

export default function TrackIdea() {
  const params = useParams<{ slug: string; token: string }>();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: idea, isLoading, error } = useQuery<Idea>({
    queryKey: ["/api/tenants", params.slug, "ideas", "track", params.token],
  });

  const statusTimeline = [
    { status: "NEW", label: "Nouvelle", icon: Lightbulb, description: "Votre idee a ete soumise et attend d'etre examinee." },
    { status: "UNDER_REVIEW", label: "En cours d'examen", icon: Eye, description: "Votre idee est en cours d'etude par les services." },
    { status: "IN_PROGRESS", label: "En cours de realisation", icon: Wrench, description: "Votre idee a ete retenue et sa mise en oeuvre est en cours." },
    { status: "DONE", label: "Realisee", icon: CheckCircle2, description: "Votre idee a ete realisee. Merci pour votre contribution !" },
  ];

  const getStatusIndex = (status: string) => {
    if (status === "REJECTED") return -1;
    return statusTimeline.findIndex((s) => s.status === status);
  };

  if (isLoading) {
    return (
      <TenantLayout tenant={tenant || null}>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-8 w-3/4 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </TenantLayout>
    );
  }

  if (error || !idea) {
    return (
      <TenantLayout tenant={tenant || null}>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Idee introuvable</h1>
          <p className="text-muted-foreground mb-6">
            Ce lien de suivi n'est pas valide ou l'idee a ete supprimee.
          </p>
          <Link href={`/structures/${params.slug}/ideas`}>
            <Button>Retour aux idees</Button>
          </Link>
        </div>
      </TenantLayout>
    );
  }

  const currentStatusIndex = getStatusIndex(idea.status);
  const isRejected = idea.status === "REJECTED";

  return (
    <TenantLayout tenant={tenant || null}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/structures/${params.slug}/ideas`}>
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Retour aux idees
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 mb-2">
              <StatusBadge type="idea" status={idea.status} />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ThumbsUp className="h-4 w-4" />
                <span>{idea.votesCount} votes</span>
              </div>
            </div>
            <CardTitle className="text-2xl" data-testid="text-idea-title">{idea.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span>{idea.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Soumise le {new Date(idea.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
            </div>
            <p className="text-foreground whitespace-pre-wrap" data-testid="text-idea-description">
              {idea.description}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suivi de l'idee</CardTitle>
          </CardHeader>
          <CardContent>
            {isRejected ? (
              <div className="flex items-start gap-4 p-4 bg-destructive/10 rounded-lg">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-destructive">Idee non retenue</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Apres examen, cette idee n'a pas ete retenue. Nous vous remercions neanmoins pour votre participation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {statusTimeline.map((step, index) => {
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;
                  
                  return (
                    <div key={step.status} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            isCompleted
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <step.icon className="h-5 w-5" />
                        </div>
                        {index < statusTimeline.length - 1 && (
                          <div
                            className={`w-0.5 flex-1 my-2 ${
                              index < currentStatusIndex ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        )}
                      </div>
                      <div className={`pb-6 ${isCurrent ? "" : "opacity-60"}`}>
                        <h4 className={`font-semibold ${isCurrent ? "text-primary" : ""}`}>
                          {step.label}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}
