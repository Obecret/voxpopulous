import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Search, Filter, MapPin, Image } from "lucide-react";
import type { Tenant, Association, AssociationIncident } from "@shared/schema";
import { INCIDENT_CATEGORIES } from "@shared/schema";

export default function AssociationIncidentsList() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const { data: incidents, isLoading } = useQuery<AssociationIncident[]>({
    queryKey: ["/api/associations", association?.id, "incidents"],
    enabled: !!association?.id,
  });

  const filteredIncidents = incidents?.filter((incident) => {
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || incident.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  }) || [];

  return (
    <AssociationLayout association={association || null} tenant={tenant || null}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-incidents-title">
              Signalements
            </h1>
            <p className="text-muted-foreground mt-1">
              Signalez un probleme ou consultez les signalements en cours.
            </p>
          </div>
          <Link href={`/structures/${params.slug}/${params.assocSlug}/incidents/new`}>
            <Button className="gap-2" data-testid="button-new-incident">
              <Plus className="h-4 w-4" />
              Faire un signalement
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un signalement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-status">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="NEW">Nouveau</SelectItem>
              <SelectItem value="IN_PROGRESS">En cours</SelectItem>
              <SelectItem value="RESOLVED">Resolu</SelectItem>
              <SelectItem value="CLOSED">Ferme</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-category">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes categories</SelectItem>
              {INCIDENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredIncidents.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Aucun signalement trouve</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                  ? "Essayez de modifier vos filtres."
                  : "Aucun probleme signale pour le moment."}
              </p>
              <Link href={`/structures/${params.slug}/${params.assocSlug}/incidents/new`}>
                <Button data-testid="button-empty-new-incident">
                  Faire un signalement
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredIncidents.map((incident) => (
              <Card key={incident.id} className="flex flex-col hover-elevate" data-testid={`card-incident-${incident.id}`}>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <StatusBadge type="incident" status={incident.status} />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {incident.category}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2 line-clamp-2">{incident.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                    {incident.description}
                  </p>
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
                    {incident.locationText && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{incident.locationText}</span>
                      </div>
                    )}
                    {incident.photoUrl && (
                      <div className="flex items-center gap-1.5">
                        <Image className="h-4 w-4" />
                        <span>Photo</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AssociationLayout>
  );
}
