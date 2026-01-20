import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Tag, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save,
  X,
  GripVertical
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ServiceCode } from "@shared/schema";

interface ServiceCodeFormData {
  code: string;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

const defaultFormData: ServiceCodeFormData = {
  code: "",
  name: "",
  description: "",
  isDefault: false,
  isActive: true,
  displayOrder: 0,
};

export default function ServiceCodesPage() {
  const { toast } = useToast();
  const [editingCode, setEditingCode] = useState<ServiceCode | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ServiceCodeFormData>(defaultFormData);

  const { data: serviceCodes, isLoading } = useQuery<ServiceCode[]>({
    queryKey: ["/api/superadmin/settings/service-codes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServiceCodeFormData) => {
      const res = await apiRequest("POST", "/api/superadmin/settings/service-codes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/service-codes"] });
      toast({ title: "Code service cree avec succes" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le code service", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceCodeFormData> }) => {
      const res = await apiRequest("PUT", `/api/superadmin/settings/service-codes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/service-codes"] });
      toast({ title: "Code service mis a jour" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le code service", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/settings/service-codes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/service-codes"] });
      toast({ title: "Code service supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le code service", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingCode(null);
    const maxOrder = serviceCodes?.reduce((max, c) => Math.max(max, c.displayOrder || 0), 0) || 0;
    setFormData({ ...defaultFormData, displayOrder: maxOrder + 1 });
    setIsDialogOpen(true);
  };

  const openEditDialog = (code: ServiceCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description || "",
      isDefault: code.isDefault || false,
      isActive: code.isActive !== false,
      displayOrder: code.displayOrder || 0,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCode(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (!formData.code || !formData.name) {
      toast({ title: "Erreur", description: "Le code et le nom sont requis", variant: "destructive" });
      return;
    }
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-service-codes-title">
              <Tag className="h-6 w-6" />
              Codes Services Chorus Pro
            </h1>
            <p className="text-muted-foreground">
              Gerez les codes services par defaut proposes aux communes lors de leur inscription
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-service-code">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un code
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Codes services par defaut</CardTitle>
            <CardDescription>
              Ces codes sont copies automatiquement pour chaque nouvelle commune utilisant Chorus Pro
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !serviceCodes || serviceCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun code service configure
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceCodes.map((code) => (
                    <TableRow key={code.id} className={!code.isActive ? 'opacity-50' : ''}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {code.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">{code.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {code.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {code.isDefault && (
                            <Badge variant="secondary">Par defaut</Badge>
                          )}
                          {code.isActive ? (
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
                            onClick={() => openEditDialog(code)}
                            data-testid={`button-edit-code-${code.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(code.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-code-${code.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Codes usuels</CardTitle>
            <CardDescription>
              Exemples de codes services couramment utilises par les collectivites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">FIN</code>
                <p className="text-sm text-muted-foreground mt-1">Service Financier</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">DSI</code>
                <p className="text-sm text-muted-foreground mt-1">Direction des Systemes d'Information</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">CAB</code>
                <p className="text-sm text-muted-foreground mt-1">Cabinet du Maire</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">SRV001</code>
                <p className="text-sm text-muted-foreground mt-1">Service General</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">URB</code>
                <p className="text-sm text-muted-foreground mt-1">Service Urbanisme</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">TECH</code>
                <p className="text-sm text-muted-foreground mt-1">Services Techniques</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">RH</code>
                <p className="text-sm text-muted-foreground mt-1">Ressources Humaines</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <code className="font-mono font-bold">COM</code>
                <p className="text-sm text-muted-foreground mt-1">Communication</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCode ? "Modifier le code service" : "Nouveau code service"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="FIN"
                  className="font-mono"
                  data-testid="input-code"
                />
                <p className="text-xs text-muted-foreground">
                  Code court utilise dans Chorus Pro (max 10 caracteres)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Service Financier"
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du service..."
                  rows={2}
                  data-testid="input-description"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                    data-testid="switch-is-default"
                  />
                  <Label htmlFor="isDefault">Par defaut</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-is-active"
                  />
                  <Label htmlFor="isActive">Actif</Label>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={closeDialog}>
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-code"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingCode ? "Mettre a jour" : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
