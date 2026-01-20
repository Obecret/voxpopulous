import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { Addon } from "@shared/schema";

export default function SuperadminAddons() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    isActive: true,
    defaultMonthlyPrice: 0,
    defaultYearlyPrice: 0,
    stripePriceIdMonthlyTest: "",
    stripePriceIdYearlyTest: "",
    stripePriceIdMonthlyLive: "",
    stripePriceIdYearlyLive: "",
  });

  const { data: addons, isLoading } = useQuery<Addon[]>({
    queryKey: ["/api/superadmin/addons"],
  });

  const createAddonMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/superadmin/addons", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/addons"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Option creee" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer l'option", variant: "destructive" });
    },
  });

  const updateAddonMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PUT", `/api/superadmin/addons/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/addons"] });
      setIsDialogOpen(false);
      setEditingAddon(null);
      resetForm();
      toast({ title: "Option mise a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour l'option", variant: "destructive" });
    },
  });

  const deleteAddonMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/addons/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/addons"] });
      toast({ title: "Option supprimee" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer l'option", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      isActive: true,
      defaultMonthlyPrice: 0,
      defaultYearlyPrice: 0,
      stripePriceIdMonthlyTest: "",
      stripePriceIdYearlyTest: "",
      stripePriceIdMonthlyLive: "",
      stripePriceIdYearlyLive: "",
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingAddon(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (addon: Addon) => {
    setEditingAddon(addon);
    setFormData({
      name: addon.name,
      code: addon.code,
      description: addon.description || "",
      isActive: addon.isActive,
      defaultMonthlyPrice: addon.defaultMonthlyPrice,
      defaultYearlyPrice: addon.defaultYearlyPrice,
      stripePriceIdMonthlyTest: addon.stripePriceIdMonthlyTest || "",
      stripePriceIdYearlyTest: addon.stripePriceIdYearlyTest || "",
      stripePriceIdMonthlyLive: addon.stripePriceIdMonthlyLive || "",
      stripePriceIdYearlyLive: addon.stripePriceIdYearlyLive || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code) {
      toast({ title: "Erreur", description: "Nom et code sont requis", variant: "destructive" });
      return;
    }
    if (editingAddon) {
      updateAddonMutation.mutate({ id: editingAddon.id, data: formData });
    } else {
      createAddonMutation.mutate(formData);
    }
  };

  const formatPrice = (euros: number) => {
    return euros.toFixed(2).replace(".", ",") + " EUR";
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Options</h1>
            <p className="text-muted-foreground">
              Gerez les options supplementaires avec tarification par unite
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-addon">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle option
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Chargement...</p>
            </CardContent>
          </Card>
        ) : addons?.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Aucune option configuree</p>
                <Button className="mt-4" onClick={openCreateDialog} data-testid="button-create-addon-empty">
                  <Plus className="mr-2 h-4 w-4" />
                  Creer une option
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {addons?.map((addon) => (
              <Card key={addon.id} data-testid={`card-addon-${addon.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {addon.name}
                        <Badge variant={addon.isActive ? "default" : "secondary"}>
                          {addon.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{addon.code}</code>
                        {addon.description && <span>- {addon.description}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatPrice(addon.defaultMonthlyPrice)}/mois</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(addon.defaultYearlyPrice)}/an</p>
                        {(addon.stripePriceIdMonthlyTest || addon.stripePriceIdMonthlyLive) && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                              Stripe
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(addon)}
                          data-testid={`button-edit-addon-${addon.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAddonMutation.mutate(addon.id)}
                          data-testid={`button-delete-addon-${addon.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAddon ? "Modifier l'option" : "Nouvelle option"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="addon-name">Nom</Label>
                <Input
                  id="addon-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Associations"
                  data-testid="input-addon-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon-code">Code</Label>
                <Input
                  id="addon-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: ASSOCIATIONS"
                  data-testid="input-addon-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon-description">Description</Label>
                <Textarea
                  id="addon-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de l'option..."
                  data-testid="input-addon-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addon-monthly">Prix mensuel par unite (EUR)</Label>
                  <Input
                    id="addon-monthly"
                    type="number"
                    step="0.01"
                    value={formData.defaultMonthlyPrice}
                    onChange={(e) => setFormData({ ...formData, defaultMonthlyPrice: parseFloat(e.target.value) || 0 })}
                    data-testid="input-addon-monthly"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addon-yearly">Prix annuel par unite (EUR)</Label>
                  <Input
                    id="addon-yearly"
                    type="number"
                    step="0.01"
                    value={formData.defaultYearlyPrice}
                    onChange={(e) => setFormData({ ...formData, defaultYearlyPrice: parseFloat(e.target.value) || 0 })}
                    data-testid="input-addon-yearly"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-orange-600">Mode Test</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="addon-stripe-monthly-test">Code Stripe mensuel (Test)</Label>
                    <Input
                      id="addon-stripe-monthly-test"
                      value={formData.stripePriceIdMonthlyTest}
                      onChange={(e) => setFormData({ ...formData, stripePriceIdMonthlyTest: e.target.value })}
                      placeholder="price_..."
                      data-testid="input-addon-stripe-monthly-test"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addon-stripe-yearly-test">Code Stripe annuel (Test)</Label>
                    <Input
                      id="addon-stripe-yearly-test"
                      value={formData.stripePriceIdYearlyTest}
                      onChange={(e) => setFormData({ ...formData, stripePriceIdYearlyTest: e.target.value })}
                      placeholder="price_..."
                      data-testid="input-addon-stripe-yearly-test"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-green-600">Mode Production</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="addon-stripe-monthly-live">Code Stripe mensuel (Live)</Label>
                    <Input
                      id="addon-stripe-monthly-live"
                      value={formData.stripePriceIdMonthlyLive}
                      onChange={(e) => setFormData({ ...formData, stripePriceIdMonthlyLive: e.target.value })}
                      placeholder="price_..."
                      data-testid="input-addon-stripe-monthly-live"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addon-stripe-yearly-live">Code Stripe annuel (Live)</Label>
                    <Input
                      id="addon-stripe-yearly-live"
                      value={formData.stripePriceIdYearlyLive}
                      onChange={(e) => setFormData({ ...formData, stripePriceIdYearlyLive: e.target.value })}
                      placeholder="price_..."
                      data-testid="input-addon-stripe-yearly-live"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="addon-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-addon-active"
                />
                <Label htmlFor="addon-active">Option active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createAddonMutation.isPending || updateAddonMutation.isPending}
                data-testid="button-submit-addon"
              >
                {editingAddon ? "Mettre a jour" : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
