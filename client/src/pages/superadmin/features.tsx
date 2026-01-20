import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Feature } from "@shared/schema";

export default function SuperadminFeatures() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    displayOrder: 0,
  });

  const { data: features, isLoading } = useQuery<Feature[]>({
    queryKey: ["/api/superadmin/features"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/superadmin/features", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/features"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Fonctionnalite creee" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer la fonctionnalite", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PUT", `/api/superadmin/features/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/features"] });
      setIsDialogOpen(false);
      setEditingFeature(null);
      resetForm();
      toast({ title: "Fonctionnalite mise a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour la fonctionnalite", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/features/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/features"] });
      toast({ title: "Fonctionnalite supprimee" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la fonctionnalite", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      displayOrder: 0,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingFeature(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (feature: Feature) => {
    setEditingFeature(feature);
    setFormData({
      name: feature.name,
      code: feature.code,
      description: feature.description || "",
      displayOrder: feature.displayOrder,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code) {
      toast({ title: "Erreur", description: "Nom et code sont requis", variant: "destructive" });
      return;
    }
    if (editingFeature) {
      updateMutation.mutate({ id: editingFeature.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const sortedFeatures = features?.slice().sort((a, b) => a.displayOrder - b.displayOrder) || [];

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-features-title">Fonctionnalites</h1>
            <p className="text-muted-foreground">
              Catalogue global des fonctionnalites disponibles pour les forfaits
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-feature">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle fonctionnalite
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : !sortedFeatures.length ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune fonctionnalite. Creez-en une pour commencer.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedFeatures.map((feature) => (
              <Card key={feature.id} data-testid={`card-feature-${feature.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <GripVertical className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{feature.name}</CardTitle>
                        <CardDescription className="text-xs font-mono">{feature.code}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => openEditDialog(feature)}
                        data-testid={`button-edit-feature-${feature.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => deleteMutation.mutate(feature.id)}
                        data-testid={`button-delete-feature-${feature.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {feature.description && (
                    <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                  )}
                  <Badge variant="outline" className="text-xs">Ordre: {feature.displayOrder}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFeature ? "Modifier la fonctionnalite" : "Nouvelle fonctionnalite"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feature-name">Nom</Label>
              <Input
                id="feature-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Proposition d'idees"
                data-testid="input-feature-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feature-code">Code (unique)</Label>
              <Input
                id="feature-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                placeholder="Ex: IDEA_PROPOSAL"
                data-testid="input-feature-code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feature-description">Description</Label>
              <Textarea
                id="feature-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de la fonctionnalite..."
                data-testid="input-feature-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feature-displayOrder">Ordre d'affichage</Label>
              <Input
                id="feature-displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-feature-display-order"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-feature"
            >
              {createMutation.isPending || updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
