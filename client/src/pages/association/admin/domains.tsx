import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AssociationAdminLayout } from "@/components/layout/association-admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, Tags, Loader2, Wand2 } from "lucide-react";
import type { Association, AssociationUser, AssociationInterventionDomain } from "@shared/schema";

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

const COLORS = [
  { name: "Bleu", value: "#3b82f6" },
  { name: "Vert", value: "#22c55e" },
  { name: "Jaune", value: "#eab308" },
  { name: "Orange", value: "#f97316" },
  { name: "Rouge", value: "#ef4444" },
  { name: "Violet", value: "#a855f7" },
  { name: "Rose", value: "#ec4899" },
  { name: "Cyan", value: "#06b6d4" },
];

export default function AssociationAdminDomains() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<AssociationInterventionDomain | null>(null);
  const [deleteDomain, setDeleteDomain] = useState<AssociationInterventionDomain | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    displayOrder: 0,
  });

  const { data, error: userError } = useQuery<{ user: SafeAssociationUser; association: Association }>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug, "me"],
    retry: false,
  });

  const user = data?.user;
  const association = data?.association;

  const { data: domains = [], isLoading } = useQuery<AssociationInterventionDomain[]>({
    queryKey: ["/api/associations", association?.id, "admin", "domains"],
    enabled: !!user && !!association?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/associations/${association?.id}/admin/domains`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", association?.id, "admin", "domains"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Domaine ajoute", description: "Le domaine d'intervention a ete ajoute avec succes." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PUT", `/api/associations/${association?.id}/admin/domains/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", association?.id, "admin", "domains"] });
      setEditDomain(null);
      resetForm();
      toast({ title: "Domaine mis a jour", description: "Le domaine d'intervention a ete modifie avec succes." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/associations/${association?.id}/admin/domains/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", association?.id, "admin", "domains"] });
      setDeleteDomain(null);
      toast({ title: "Domaine supprime", description: "Le domaine d'intervention a ete supprime avec succes." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const initializeDefaultsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/associations/${association?.id}/admin/domains/initialize-defaults`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", association?.id, "admin", "domains"] });
      if (data.created > 0) {
        toast({ 
          title: "Categories initialisees", 
          description: `${data.created} domaine(s) ajoute(s)${data.skipped > 0 ? `, ${data.skipped} deja existant(s)` : ""}.` 
        });
      } else {
        toast({ 
          title: "Deja initialise", 
          description: "Toutes les categories par defaut existent deja." 
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", color: "#3b82f6", displayOrder: 0 });
  };

  if (userError) {
    navigate(`/structures/${params.slug}/${params.assocSlug}/login`);
    return null;
  }

  const filteredDomains = domains.filter((d) => 
    !searchQuery || 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => a.displayOrder - b.displayOrder);

  const openEdit = (domain: AssociationInterventionDomain) => {
    setFormData({
      name: domain.name,
      description: domain.description || "",
      color: domain.color || "#3b82f6",
      displayOrder: domain.displayOrder,
    });
    setEditDomain(domain);
  };

  return (
    <AssociationAdminLayout association={association || null} user={user || null} tenantSlug={params.slug}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-assoc-admin-domains-title">
              Domaines d'intervention
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerez les domaines d'intervention des membres du bureau.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => initializeDefaultsMutation.mutate()}
              disabled={initializeDefaultsMutation.isPending}
              data-testid="button-init-assoc-domains"
            >
              {initializeDefaultsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Initialiser les categories
            </Button>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} data-testid="button-create-assoc-domain">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un domaine
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-assoc-domains"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredDomains.length === 0 ? (
              <div className="text-center py-12">
                <Tags className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground mt-4">
                  {searchQuery ? "Aucun domaine trouve" : "Aucun domaine d'intervention defini"}
                </p>
                {!searchQuery && (
                  <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un domaine
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Ordre</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead className="w-[80px]">Couleur</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDomains.map((domain) => (
                      <TableRow key={domain.id} data-testid={`row-assoc-domain-${domain.id}`}>
                        <TableCell className="text-muted-foreground">
                          {domain.displayOrder}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: domain.color || "#3b82f6" }}
                            />
                            {domain.name}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {domain.description ? (
                            <span className="line-clamp-1">{domain.description}</span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: domain.color || "#3b82f6", color: domain.color || "#3b82f6" }}
                          >
                            {COLORS.find(c => c.value === domain.color)?.name || "Personnalisee"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(domain)}
                              data-testid={`button-edit-assoc-domain-${domain.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteDomain(domain)}
                              data-testid={`button-delete-assoc-domain-${domain.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un domaine d'intervention</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Communication, Evenements..."
                  data-testid="input-assoc-domain-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optionnel)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description du domaine..."
                  data-testid="input-assoc-domain-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, color: c.value }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === c.value ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                      data-testid={`button-assoc-color-${c.value}`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Ordre d'affichage</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min="0"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                  data-testid="input-assoc-domain-order"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => createMutation.mutate(formData)} 
                disabled={!formData.name || createMutation.isPending}
                data-testid="button-save-assoc-domain"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editDomain} onOpenChange={(open) => !open && setEditDomain(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le domaine</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  data-testid="input-edit-assoc-domain-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optionnel)</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  data-testid="input-edit-assoc-domain-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, color: c.value }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === c.value ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-displayOrder">Ordre d'affichage</Label>
                <Input
                  id="edit-displayOrder"
                  type="number"
                  min="0"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                  data-testid="input-edit-assoc-domain-order"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDomain(null)}>Annuler</Button>
              <Button 
                onClick={() => editDomain && updateMutation.mutate({ id: editDomain.id, data: formData })} 
                disabled={!formData.name || updateMutation.isPending}
                data-testid="button-update-assoc-domain"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteDomain} onOpenChange={(open) => !open && setDeleteDomain(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer le domaine</DialogTitle>
              <DialogDescription>
                Etes-vous sur de vouloir supprimer le domaine "{deleteDomain?.name}" ? Cette action est irreversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDomain(null)}>Annuler</Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteDomain && deleteMutation.mutate(deleteDomain.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-assoc-domain"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AssociationAdminLayout>
  );
}
