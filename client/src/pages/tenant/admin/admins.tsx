import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, UserCog, Loader2 } from "lucide-react";
import type { Tenant, User } from "@shared/schema";

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AdminsResponse {
  admins: AdminUser[];
  quota: {
    used: number;
    allowed: number;
    remaining: number;
  };
}

export default function AdminAdmins() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminUser | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  const { data: adminsData, isLoading } = useQuery<AdminsResponse>({
    queryKey: ["/api/tenants", params.slug, "admin", "admins"],
    enabled: !!user,
  });
  const admins = adminsData?.admins;
  const quota = adminsData?.quota;

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/admins`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "admins"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Administrateur cree", description: "Le compte administrateur a ete cree avec succes." });
    },
    onError: (error: any) => {
      const message = error.data?.message || error.message || "Une erreur est survenue.";
      toast({ 
        title: message.includes("Quota") || message.includes("limite") ? "Limite atteinte" : "Erreur", 
        description: message, 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tenants/${params.slug}/admin/admins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "admins"] });
      setDeleteAdmin(null);
      toast({ title: "Administrateur supprime", description: "Le compte administrateur a ete supprime avec succes." });
    },
    onError: (error: any) => {
      const message = error.data?.message || error.message || "Une erreur est survenue.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "admin" });
  };

  if (userError) {
    navigate(`/structures/${params.slug}/admin/login`);
    return null;
  }

  const filteredAdmins = admins?.filter((a) => 
    !searchQuery || 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isPasswordStrong = (password: string) => {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password);
  };

  const canSubmit = formData.name && formData.email && formData.password && isPasswordStrong(formData.password);

  return (
    <AdminLayout tenant={tenant || null} user={user || null} accountBlocked={user?.accountBlocked} blockReason={user?.blockReason}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-admin-admins-title">
              Gestion des administrateurs
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerez les comptes administrateurs de votre commune.
            </p>
          </div>
          <Button 
            onClick={() => { resetForm(); setIsCreateOpen(true); }} 
            disabled={quota !== undefined && quota.remaining <= 0}
            data-testid="button-create-admin"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvel administrateur
          </Button>
        </div>

        {quota && quota.allowed > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-md flex items-center justify-between gap-2 flex-wrap" data-testid="quota-banner">
            <span className="text-sm text-muted-foreground">
              {quota.used} / {quota.allowed} administrateur(s) utilise(s)
            </span>
            {quota.remaining === 0 && (
              <Badge variant="destructive">Limite atteinte</Badge>
            )}
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="text-center py-12">
                <UserCog className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground mt-4">Aucun administrateur</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden md:table-cell">Date de creation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdmins.map((admin) => (
                      <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                        <TableCell className="font-medium">{admin.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{admin.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(admin.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteAdmin(admin)}
                              disabled={admin.id === user?.id}
                              data-testid={`button-delete-${admin.id}`}
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvel administrateur</DialogTitle>
              <DialogDescription>Creez un nouveau compte administrateur pour votre commune.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nom complet"
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@mairie.fr"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <PasswordInput
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mot de passe securise"
                  data-testid="input-password"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 caracteres, avec majuscule, minuscule et chiffre.
                </p>
                {formData.password && !isPasswordStrong(formData.password) && (
                  <p className="text-xs text-destructive">
                    Le mot de passe ne respecte pas les criteres de securite.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="super_admin">Super Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => createMutation.mutate(formData)} 
                disabled={createMutation.isPending || !canSubmit} 
                data-testid="button-submit-create"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Creer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteAdmin} onOpenChange={() => setDeleteAdmin(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer l'administrateur</DialogTitle>
              <DialogDescription>
                Etes-vous sur de vouloir supprimer le compte de "{deleteAdmin?.name}" ? Cette action est irreversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteAdmin(null)}>Annuler</Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteAdmin && deleteMutation.mutate(deleteAdmin.id)} 
                disabled={deleteMutation.isPending} 
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
