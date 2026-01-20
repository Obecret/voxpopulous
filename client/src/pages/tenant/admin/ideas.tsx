import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminSession } from "@/hooks/use-admin-session";
import { Search, Filter, Eye, ThumbsUp, ThumbsDown, Loader2, Lock } from "lucide-react";
import type { Idea } from "@shared/schema";
import { IDEA_CATEGORIES } from "@shared/schema";

export default function AdminIdeas() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { session, tenant, user, electedOfficial, accountBlocked, blockReason, hasMenuAccess } = useAdminSession(params.slug);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: ideas, isLoading } = useQuery<Idea[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "ideas"],
    enabled: !!session,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ideaId, status }: { ideaId: string; status: string }) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/ideas/${ideaId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "stats"] });
      setSelectedIdea(null);
      toast({
        title: "Statut mis a jour",
        description: "Le statut de l'idee a ete modifie avec succes.",
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

  const filteredIdeas = ideas?.filter((idea) => {
    const matchesStatus = statusFilter === "all" || idea.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || idea.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  }) || [];

  const handleStatusChange = () => {
    if (selectedIdea && newStatus) {
      updateStatusMutation.mutate({ ideaId: selectedIdea.id, status: newStatus });
    }
  };

  if (!hasMenuAccess("IDEAS")) {
    return (
      <AdminLayout tenant={tenant || null} user={user} electedOfficial={electedOfficial} accountBlocked={accountBlocked} blockReason={blockReason}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
          <Lock className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Acces non autorise</h1>
          <p className="text-muted-foreground text-center max-w-md">
            Vous n'avez pas les permissions necessaires pour acceder a cette section.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout tenant={tenant || null} user={user} electedOfficial={electedOfficial} accountBlocked={accountBlocked} blockReason={blockReason}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold" data-testid="text-admin-ideas-title">
            Gestion des idees
          </h1>
          <p className="text-muted-foreground mt-1">
            Examinez et gerez les propositions des citoyens.
          </p>
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
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-status">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="NEW">Nouvelle</SelectItem>
                  <SelectItem value="UNDER_REVIEW">En examen</SelectItem>
                  <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                  <SelectItem value="DONE">Realisee</SelectItem>
                  <SelectItem value="REJECTED">Rejetee</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-category">
                  <SelectValue placeholder="Categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {IDEA_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Aucune idee trouvee</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead className="hidden md:table-cell">Categorie</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Votes</TableHead>
                      <TableHead className="hidden lg:table-cell">Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIdeas.map((idea) => (
                      <TableRow key={idea.id} data-testid={`row-idea-${idea.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {idea.title}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {idea.category}
                        </TableCell>
                        <TableCell>
                          <StatusBadge type="idea" status={idea.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {(() => {
                            const upVotes = (idea as any).upVotesCount || 0;
                            const downVotes = (idea as any).downVotesCount || 0;
                            const total = upVotes + downVotes;
                            const upPct = total > 0 ? Math.round((upVotes / total) * 100) : 0;
                            const downPct = total > 0 ? 100 - upPct : 0;
                            return total > 0 ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                                  <ThumbsUp className="h-3 w-3" />
                                  {upPct}%
                                </span>
                                <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                  <ThumbsDown className="h-3 w-3" />
                                  {downPct}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {new Date(idea.createdAt).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedIdea(idea);
                              setNewStatus(idea.status);
                            }}
                            data-testid={`button-edit-${idea.id}`}
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

        <Dialog open={!!selectedIdea} onOpenChange={() => setSelectedIdea(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedIdea?.title}</DialogTitle>
            </DialogHeader>
            {selectedIdea && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <StatusBadge type="idea" status={selectedIdea.status} />
                  <span className="text-muted-foreground">{selectedIdea.category}</span>
                </div>
                {(() => {
                  const upVotes = (selectedIdea as any).upVotesCount || 0;
                  const downVotes = (selectedIdea as any).downVotesCount || 0;
                  const total = upVotes + downVotes;
                  const upPct = total > 0 ? Math.round((upVotes / total) * 100) : 0;
                  const downPct = total > 0 ? 100 - upPct : 0;
                  return total > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {upPct}% Pour ({upVotes})
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                          <ThumbsDown className="h-3 w-3" />
                          {downPct}% Contre ({downVotes})
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                        {upPct > 0 && (
                          <div className="bg-blue-500 h-full" style={{ width: `${upPct}%` }} />
                        )}
                        {downPct > 0 && (
                          <div className="bg-red-500 h-full" style={{ width: `${downPct}%` }} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">Aucun vote pour le moment</p>
                  );
                })()}
                <p className="text-sm whitespace-pre-wrap">{selectedIdea.description}</p>
                {selectedIdea.createdByEmail && (
                  <p className="text-sm text-muted-foreground">
                    Contact: {selectedIdea.createdByEmail}
                  </p>
                )}
                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">Modifier le statut</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger data-testid="select-new-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">Nouvelle</SelectItem>
                      <SelectItem value="UNDER_REVIEW">En cours d'examen</SelectItem>
                      <SelectItem value="IN_PROGRESS">En cours de realisation</SelectItem>
                      <SelectItem value="DONE">Realisee</SelectItem>
                      <SelectItem value="REJECTED">Rejetee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedIdea(null)}>
                Annuler
              </Button>
              <Button 
                onClick={handleStatusChange}
                disabled={updateStatusMutation.isPending || newStatus === selectedIdea?.status}
                data-testid="button-save-status"
              >
                {updateStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
