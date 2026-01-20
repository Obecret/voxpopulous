import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Shield, Mail, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Superadmin } from "@shared/schema";

export default function SuperadminAdmins() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Superadmin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<Superadmin | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const { data: admins, isLoading } = useQuery<Superadmin[]>({
    queryKey: ["/api/superadmin/admins"],
  });

  const { data: authData } = useQuery<{ superadmin: Superadmin }>({
    queryKey: ["/api/superadmin/me"],
  });

  const currentAdminId = authData?.superadmin?.id;

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/superadmin/admins", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/admins"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Administrateur cree" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de creer l'administrateur", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const payload: any = {};
      if (data.name) payload.name = data.name;
      if (data.email) payload.email = data.email;
      if (data.password) payload.password = data.password;
      const res = await apiRequest("PATCH", `/api/superadmin/admins/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/admins"] });
      setIsDialogOpen(false);
      setEditingAdmin(null);
      resetForm();
      toast({ title: "Administrateur mis a jour" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de mettre a jour l'administrateur", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/admins/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/admins"] });
      setIsDeleteDialogOpen(false);
      setDeletingAdmin(null);
      toast({ title: "Administrateur supprime" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de supprimer l'administrateur", 
        variant: "destructive" 
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/superadmin/admins/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/admins"] });
      toast({ title: "Statut mis a jour" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de modifier le statut", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingAdmin(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (admin: Superadmin) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: "",
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (admin: Superadmin) => {
    setDeletingAdmin(admin);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingAdmin) {
      updateMutation.mutate({ id: editingAdmin.id, data: formData });
    } else {
      if (!formData.name || !formData.email || !formData.password) {
        toast({ 
          title: "Erreur", 
          description: "Nom, email et mot de passe requis", 
          variant: "destructive" 
        });
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (deletingAdmin) {
      deleteMutation.mutate(deletingAdmin.id);
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-admins-title">
              Administrateurs
            </h1>
            <p className="text-muted-foreground">
              Gestion des comptes administrateurs de la plateforme
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-admin">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel administrateur
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : !admins?.length ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Aucun administrateur configure.</p>
              <Button onClick={openCreateDialog} className="mt-4">
                Creer un administrateur
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Liste des administrateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date de creation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{admin.name}</span>
                          {admin.id === currentAdminId && (
                            <Badge variant="outline" className="text-xs">Vous</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{admin.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={admin.isActive !== false}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: admin.id, isActive: checked })
                            }
                            disabled={admin.id === currentAdminId || toggleActiveMutation.isPending}
                            data-testid={`switch-active-admin-${admin.id}`}
                          />
                          {admin.isActive !== false ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <X className="h-3 w-3 mr-1" />
                              Inactif
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString("fr-FR") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(admin)}
                            data-testid={`button-edit-admin-${admin.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(admin)}
                            disabled={admin.id === currentAdminId}
                            data-testid={`button-delete-admin-${admin.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAdmin ? "Modifier l'administrateur" : "Nouvel administrateur"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nom complet"
                  data-testid="input-admin-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@example.com"
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingAdmin ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}
                </Label>
                <PasswordInput
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingAdmin ? "Laisser vide pour ne pas changer" : "Mot de passe securise"}
                  data-testid="input-admin-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-admin"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Enregistrement..."
                  : editingAdmin
                  ? "Mettre a jour"
                  : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer l'administrateur ?</AlertDialogTitle>
              <AlertDialogDescription>
                Etes-vous sur de vouloir supprimer l'administrateur{" "}
                <span className="font-medium">{deletingAdmin?.email}</span> ?
                Cette action est irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SuperadminLayout>
  );
}
