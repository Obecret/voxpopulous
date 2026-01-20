import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AssociationAdminLayout } from "@/components/layout/association-admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, Eye, MapPin, Loader2 } from "lucide-react";
import type { Association, AssociationUser, AssociationIncident } from "@shared/schema";
import { INCIDENT_CATEGORIES } from "@shared/schema";
import { LocationDisplay } from "@/components/location-picker";

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

export default function AssociationAdminIncidents() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<AssociationIncident | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const { data, isLoading: userLoading, error } = useQuery<{ user: SafeAssociationUser; association: Association }>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug, "me"],
    retry: false,
  });

  const { data: incidents, isLoading: incidentsLoading } = useQuery<AssociationIncident[]>({
    queryKey: ["/api/associations", data?.association?.id, "admin", "incidents"],
    enabled: !!data?.association?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ incidentId, status }: { incidentId: string; status: string }) => {
      return apiRequest("PATCH", `/api/associations/${data?.association?.id}/admin/incidents/${incidentId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "stats"] });
      setSelectedIncident(null);
      toast({
        title: "Statut mis a jour",
        description: "Le statut du signalement a ete modifie avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  if (error) {
    navigate(`/structures/${params.slug}/${params.assocSlug}/login`);
    return null;
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <Skeleton className="h-16 w-full mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { user, association } = data || {};

  const filteredIncidents = incidents?.filter((incident) => {
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || incident.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  }) || [];

  const handleStatusChange = () => {
    if (selectedIncident && newStatus) {
      updateStatusMutation.mutate({ incidentId: selectedIncident.id, status: newStatus });
    }
  };

  return (
    <AssociationAdminLayout association={association || null} user={user || null} tenantSlug={params.slug}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold" data-testid="text-assoc-incidents-title">
            Gestion des signalements
          </h1>
          <p className="text-muted-foreground mt-1">Gerez les signalements de votre association.</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-incidents"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-status-incidents">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="NEW">Nouveau</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Pris en compte</SelectItem>
                  <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                  <SelectItem value="RESOLVED">Resolu</SelectItem>
                  <SelectItem value="REJECTED">Rejete</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-category-incidents">
                  <SelectValue placeholder="Categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {INCIDENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {incidentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Aucun signalement trouve</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead className="hidden md:table-cell">Categorie</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Lieu</TableHead>
                      <TableHead className="hidden lg:table-cell">Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents.map((incident) => (
                      <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {incident.title}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {incident.category}
                        </TableCell>
                        <TableCell>
                          <StatusBadge type="incident" status={incident.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[120px]">{incident.locationText}</span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {new Date(incident.createdAt).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedIncident(incident);
                              setNewStatus(incident.status);
                            }}
                            data-testid={`button-view-incident-${incident.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedIncident?.title}</DialogTitle>
            </DialogHeader>
            {selectedIncident && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <StatusBadge type="incident" status={selectedIncident.status} />
                  <span className="text-muted-foreground">{selectedIncident.category}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{selectedIncident.description}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {selectedIncident.locationText}
                </div>
                {(selectedIncident.latitude || selectedIncident.longitude) && (
                  <div className="rounded-md overflow-hidden">
                    <LocationDisplay
                      latitude={selectedIncident.latitude}
                      longitude={selectedIncident.longitude}
                      height="180px"
                    />
                  </div>
                )}
                {selectedIncident.photoUrl && (
                  <img 
                    src={selectedIncident.photoUrl} 
                    alt="Photo du signalement" 
                    className="w-full rounded-md max-h-64 object-cover"
                  />
                )}
                {selectedIncident.createdByEmail && (
                  <p className="text-sm text-muted-foreground">
                    Contact: {selectedIncident.createdByEmail}
                  </p>
                )}
                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">Modifier le statut</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger data-testid="select-new-status-incident">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">Nouveau</SelectItem>
                      <SelectItem value="ACKNOWLEDGED">Pris en compte</SelectItem>
                      <SelectItem value="IN_PROGRESS">En cours de traitement</SelectItem>
                      <SelectItem value="RESOLVED">Resolu</SelectItem>
                      <SelectItem value="REJECTED">Rejete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedIncident(null)}>
                Annuler
              </Button>
              <Button 
                onClick={handleStatusChange}
                disabled={updateStatusMutation.isPending || newStatus === selectedIncident?.status}
                data-testid="button-save-incident-status"
              >
                {updateStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AssociationAdminLayout>
  );
}
