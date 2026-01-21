import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Layers, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save,
  GripVertical,
  Building2,
  Users2,
  Palette
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GlobalMunicipalityDomain, GlobalAssociationDomain } from "@shared/schema";

interface DomainFormData {
  name: string;
  description: string;
  color: string;
  displayOrder: number;
  isActive: boolean;
}

const defaultFormData: DomainFormData = {
  name: "",
  description: "",
  color: "#3B82F6",
  displayOrder: 0,
  isActive: true,
};

const colorOptions = [
  "#3B82F6", "#8B5CF6", "#22C55E", "#EF4444", "#F59E0B", 
  "#EC4899", "#06B6D4", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#0EA5E9", "#A855F7", "#10B981", "#64748B"
];

export default function DomainsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"municipalities" | "associations">("municipalities");
  const [editingDomain, setEditingDomain] = useState<GlobalMunicipalityDomain | GlobalAssociationDomain | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<DomainFormData>(defaultFormData);

  const { data: municipalityDomains, isLoading: municipalityLoading } = useQuery<GlobalMunicipalityDomain[]>({
    queryKey: ["/api/superadmin/settings/municipality-domains"],
  });

  const { data: associationDomains, isLoading: associationLoading } = useQuery<GlobalAssociationDomain[]>({
    queryKey: ["/api/superadmin/settings/association-domains"],
  });

  const createMunicipalityMutation = useMutation({
    mutationFn: async (data: DomainFormData) => {
      const res = await apiRequest("POST", "/api/superadmin/settings/municipality-domains", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/municipality-domains"] });
      toast({ title: "Domaine cree avec succes" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le domaine", variant: "destructive" });
    },
  });

  const updateMunicipalityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DomainFormData> }) => {
      const res = await apiRequest("PUT", `/api/superadmin/settings/municipality-domains/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/municipality-domains"] });
      toast({ title: "Domaine mis a jour" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le domaine", variant: "destructive" });
    },
  });

  const deleteMunicipalityMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/settings/municipality-domains/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/municipality-domains"] });
      toast({ title: "Domaine supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le domaine", variant: "destructive" });
    },
  });

  const createAssociationMutation = useMutation({
    mutationFn: async (data: DomainFormData) => {
      const res = await apiRequest("POST", "/api/superadmin/settings/association-domains", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/association-domains"] });
      toast({ title: "Domaine cree avec succes" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le domaine", variant: "destructive" });
    },
  });

  const updateAssociationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DomainFormData> }) => {
      const res = await apiRequest("PUT", `/api/superadmin/settings/association-domains/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/association-domains"] });
      toast({ title: "Domaine mis a jour" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le domaine", variant: "destructive" });
    },
  });

  const deleteAssociationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/settings/association-domains/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/association-domains"] });
      toast({ title: "Domaine supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le domaine", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingDomain(null);
    const domains = activeTab === "municipalities" ? municipalityDomains : associationDomains;
    const maxOrder = domains?.reduce((max, d) => Math.max(max, d.displayOrder || 0), 0) || 0;
    setFormData({ ...defaultFormData, displayOrder: maxOrder + 1 });
    setIsDialogOpen(true);
  };

  const openEditDialog = (domain: GlobalMunicipalityDomain | GlobalAssociationDomain) => {
    setEditingDomain(domain);
    setFormData({
      name: domain.name,
      description: domain.description || "",
      color: domain.color || "#3B82F6",
      displayOrder: domain.displayOrder || 0,
      isActive: domain.isActive !== false,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingDomain(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast({ title: "Erreur", description: "Le nom est requis", variant: "destructive" });
      return;
    }
    if (activeTab === "municipalities") {
      if (editingDomain) {
        updateMunicipalityMutation.mutate({ id: editingDomain.id, data: formData });
      } else {
        createMunicipalityMutation.mutate(formData);
      }
    } else {
      if (editingDomain) {
        updateAssociationMutation.mutate({ id: editingDomain.id, data: formData });
      } else {
        createAssociationMutation.mutate(formData);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (activeTab === "municipalities") {
      deleteMunicipalityMutation.mutate(id);
    } else {
      deleteAssociationMutation.mutate(id);
    }
  };

  const renderDomainsTable = (domains: (GlobalMunicipalityDomain | GlobalAssociationDomain)[] | undefined, isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    
    if (!domains || domains.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Aucun domaine configure
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Couleur</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {domains.map((domain) => (
            <TableRow key={domain.id} className={!domain.isActive ? 'opacity-50' : ''}>
              <TableCell>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </TableCell>
              <TableCell>
                <div 
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: domain.color || "#3B82F6" }}
                />
              </TableCell>
              <TableCell className="font-medium">{domain.name}</TableCell>
              <TableCell className="text-muted-foreground max-w-xs truncate">
                {domain.description || "-"}
              </TableCell>
              <TableCell>
                {domain.isActive ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Actif
                  </Badge>
                ) : (
                  <Badge variant="outline">Inactif</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(domain)}
                    data-testid={`button-edit-domain-${domain.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(domain.id)}
                    data-testid={`button-delete-domain-${domain.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const isMutating = createMunicipalityMutation.isPending || updateMunicipalityMutation.isPending || 
                     createAssociationMutation.isPending || updateAssociationMutation.isPending;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-domains-title">
              <Layers className="h-6 w-6" />
              Domaines d'intervention
            </h1>
            <p className="text-muted-foreground">
              Gerez les domaines proposes aux mairies, EPCI et associations
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-domain">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un domaine
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "municipalities" | "associations")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="municipalities" className="flex items-center gap-2" data-testid="tab-municipalities">
              <Building2 className="h-4 w-4" />
              Mairies / EPCI
            </TabsTrigger>
            <TabsTrigger value="associations" className="flex items-center gap-2" data-testid="tab-associations">
              <Users2 className="h-4 w-4" />
              Associations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="municipalities" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Domaines pour les mairies et EPCI</CardTitle>
                <CardDescription>
                  Ces domaines sont proposes pour les elus, idees, signalements et evenements des collectivites
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderDomainsTable(municipalityDomains, municipalityLoading)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="associations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Domaines pour les associations</CardTitle>
                <CardDescription>
                  Ces domaines sont proposes pour les membres, idees, signalements et evenements des associations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderDomainsTable(associationDomains, associationLoading)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingDomain ? "Modifier le domaine" : "Ajouter un domaine"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Voirie, Culture, Sport..."
                  data-testid="input-domain-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du domaine..."
                  rows={2}
                  data-testid="input-domain-description"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Couleur
                </Label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      data-testid={`color-option-${color.replace('#', '')}`}
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
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  data-testid="input-domain-order"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Actif</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-domain-active"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-domain">
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isMutating}
                data-testid="button-save-domain"
              >
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {editingDomain ? "Mettre a jour" : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
