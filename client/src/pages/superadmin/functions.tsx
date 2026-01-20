import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save,
  GripVertical,
  Building2,
  Users2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EluFunction, BureauMemberFunction } from "@shared/schema";

interface FunctionFormData {
  label: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

const defaultFormData: FunctionFormData = {
  label: "",
  isDefault: false,
  isActive: true,
  displayOrder: 0,
};

export default function FunctionsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"elus" | "bureau">("elus");
  const [editingFunction, setEditingFunction] = useState<EluFunction | BureauMemberFunction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FunctionFormData>(defaultFormData);

  const { data: eluFunctions, isLoading: eluLoading } = useQuery<EluFunction[]>({
    queryKey: ["/api/superadmin/settings/elu-functions"],
  });

  const { data: bureauFunctions, isLoading: bureauLoading } = useQuery<BureauMemberFunction[]>({
    queryKey: ["/api/superadmin/settings/bureau-functions"],
  });

  const createEluMutation = useMutation({
    mutationFn: async (data: FunctionFormData) => {
      const res = await apiRequest("POST", "/api/superadmin/settings/elu-functions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/elu-functions"] });
      toast({ title: "Fonction d'elu creee avec succes" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer la fonction", variant: "destructive" });
    },
  });

  const updateEluMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FunctionFormData> }) => {
      const res = await apiRequest("PUT", `/api/superadmin/settings/elu-functions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/elu-functions"] });
      toast({ title: "Fonction d'elu mise a jour" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour la fonction", variant: "destructive" });
    },
  });

  const deleteEluMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/settings/elu-functions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/elu-functions"] });
      toast({ title: "Fonction d'elu supprimee" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la fonction", variant: "destructive" });
    },
  });

  const createBureauMutation = useMutation({
    mutationFn: async (data: FunctionFormData) => {
      const res = await apiRequest("POST", "/api/superadmin/settings/bureau-functions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/bureau-functions"] });
      toast({ title: "Fonction de membre creee avec succes" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer la fonction", variant: "destructive" });
    },
  });

  const updateBureauMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FunctionFormData> }) => {
      const res = await apiRequest("PUT", `/api/superadmin/settings/bureau-functions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/bureau-functions"] });
      toast({ title: "Fonction de membre mise a jour" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour la fonction", variant: "destructive" });
    },
  });

  const deleteBureauMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/settings/bureau-functions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/bureau-functions"] });
      toast({ title: "Fonction de membre supprimee" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la fonction", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingFunction(null);
    const functions = activeTab === "elus" ? eluFunctions : bureauFunctions;
    const maxOrder = functions?.reduce((max, f) => Math.max(max, f.displayOrder || 0), 0) || 0;
    setFormData({ ...defaultFormData, displayOrder: maxOrder + 1 });
    setIsDialogOpen(true);
  };

  const openEditDialog = (fn: EluFunction | BureauMemberFunction) => {
    setEditingFunction(fn);
    setFormData({
      label: fn.label,
      isDefault: fn.isDefault || false,
      isActive: fn.isActive !== false,
      displayOrder: fn.displayOrder || 0,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFunction(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (!formData.label) {
      toast({ title: "Erreur", description: "Le libelle est requis", variant: "destructive" });
      return;
    }
    if (activeTab === "elus") {
      if (editingFunction) {
        updateEluMutation.mutate({ id: editingFunction.id, data: formData });
      } else {
        createEluMutation.mutate(formData);
      }
    } else {
      if (editingFunction) {
        updateBureauMutation.mutate({ id: editingFunction.id, data: formData });
      } else {
        createBureauMutation.mutate(formData);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (activeTab === "elus") {
      deleteEluMutation.mutate(id);
    } else {
      deleteBureauMutation.mutate(id);
    }
  };

  const renderFunctionsTable = (functions: (EluFunction | BureauMemberFunction)[] | undefined, isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    
    if (!functions || functions.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Aucune fonction configuree
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Libelle</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {functions.map((fn) => (
            <TableRow key={fn.id} className={!fn.isActive ? 'opacity-50' : ''}>
              <TableCell>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </TableCell>
              <TableCell className="font-medium">{fn.label}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {fn.isDefault && (
                    <Badge variant="secondary">Par defaut</Badge>
                  )}
                  {fn.isActive ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Actif
                    </Badge>
                  ) : (
                    <Badge variant="outline">Inactif</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(fn)}
                    data-testid={`button-edit-function-${fn.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(fn.id)}
                    data-testid={`button-delete-function-${fn.id}`}
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

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-functions-title">
              <Users className="h-6 w-6" />
              Fonctions des elus et membres
            </h1>
            <p className="text-muted-foreground">
              Gerez les fonctions proposees aux mairies et aux associations
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-function">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une fonction
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "elus" | "bureau")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="elus" className="flex items-center gap-2" data-testid="tab-elus">
              <Building2 className="h-4 w-4" />
              Elus (Mairies/EPCI)
            </TabsTrigger>
            <TabsTrigger value="bureau" className="flex items-center gap-2" data-testid="tab-bureau">
              <Users2 className="h-4 w-4" />
              Membres Bureau (Associations)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="elus" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Fonctions des elus municipaux</CardTitle>
                <CardDescription>
                  Ces fonctions sont proposees aux mairies et EPCI pour decrire le role de leurs elus
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderFunctionsTable(eluFunctions, eluLoading)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bureau" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Fonctions des membres du bureau</CardTitle>
                <CardDescription>
                  Ces fonctions sont proposees aux associations pour decrire le role des membres de leur bureau
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderFunctionsTable(bureauFunctions, bureauLoading)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingFunction ? "Modifier la fonction" : "Ajouter une fonction"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Libelle</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder={activeTab === "elus" ? "Ex: Maire, Adjoint..." : "Ex: President, Tresorier..."}
                  data-testid="input-function-label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Ordre d'affichage</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min="0"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  data-testid="input-function-order"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isDefault">Par defaut</Label>
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                  data-testid="switch-function-default"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Actif</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-function-active"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-function">
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createEluMutation.isPending || updateEluMutation.isPending || createBureauMutation.isPending || updateBureauMutation.isPending}
                data-testid="button-save-function"
              >
                {(createEluMutation.isPending || updateEluMutation.isPending || createBureauMutation.isPending || updateBureauMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Save className="h-4 w-4 mr-2" />
                {editingFunction ? "Mettre a jour" : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
