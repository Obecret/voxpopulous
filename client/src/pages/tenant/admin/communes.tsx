import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Plus, Trash2, ExternalLink, Loader2, Landmark, Building2, Eye, EyeOff
} from "lucide-react";
import type { Tenant, User } from "@shared/schema";

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

interface CommuneQuota {
  allowed: number;
  used: number;
  remaining: number;
  planIncluded: number;
  purchased: number;
}

interface CommunesResponse {
  communes: Tenant[];
  quota: CommuneQuota;
}

const createCommuneSchema = z.object({
  name: z.string().min(2, "Minimum 2 caracteres"),
  slug: z.string().min(2, "Minimum 2 caracteres").regex(/^[a-z0-9-]+$/, "Uniquement lettres minuscules, chiffres et tirets"),
  adminName: z.string().min(2, "Minimum 2 caracteres"),
  adminEmail: z.string().email("Email invalide"),
  password: z.string().min(8, "Minimum 8 caracteres"),
});

type CreateCommuneForm = z.infer<typeof createCommuneSchema>;

export default function AdminCommunes() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteCommune, setDeleteCommune] = useState<Tenant | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<CreateCommuneForm>({
    resolver: zodResolver(createCommuneSchema),
    defaultValues: {
      name: "",
      slug: "",
      adminName: "",
      adminEmail: "",
      password: "",
    },
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  const { data: communesData, isLoading } = useQuery<CommunesResponse>({
    queryKey: ["/api/tenants", params.slug, "admin", "communes"],
    enabled: !!user && tenant?.tenantType === "EPCI",
  });
  const communes = communesData?.communes || [];
  const quota = communesData?.quota;

  const createMutation = useMutation({
    mutationFn: async (data: CreateCommuneForm) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/communes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "communes"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Commune creee", description: "La commune a ete creee avec succes." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (communeId: string) => {
      return apiRequest("DELETE", `/api/tenants/${params.slug}/admin/communes/${communeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "communes"] });
      setDeleteCommune(null);
      toast({ title: "Commune supprimee", description: "La commune a ete supprimee." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  const handleNameChange = (value: string) => {
    const currentSlug = form.getValues("slug");
    const previousName = form.getValues("name");
    const expectedSlug = generateSlug(previousName);
    form.setValue("name", value);
    if (!currentSlug || currentSlug === expectedSlug) {
      form.setValue("slug", generateSlug(value));
    }
  };

  if (userError) {
    navigate(`/structures/${params.slug}/admin/login`);
    return null;
  }

  if (tenant && tenant.tenantType !== "EPCI") {
    navigate(`/structures/${params.slug}/admin`);
    return null;
  }

  const filteredCommunes = communes.filter((c) => 
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreateMore = quota ? quota.remaining > 0 : false;

  return (
    <AdminLayout 
      tenant={tenant || null} 
      user={user || null}
      accountBlocked={user?.accountBlocked}
      blockReason={user?.blockReason}
    >
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">Communes membres</h1>
            <p className="text-muted-foreground">Gerez les communes de votre EPCI</p>
          </div>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)} 
            disabled={!canCreateMore}
            data-testid="button-add-commune"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle commune
          </Button>
        </div>

        {quota && quota.allowed > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="font-medium">{quota.used}</span> / {quota.allowed} commune{quota.allowed !== 1 ? "s" : ""} utilisee{quota.used !== 1 ? "s" : ""}
                  </span>
                </div>
                {quota.remaining === 0 && (
                  <Badge variant="secondary">Limite atteinte</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une commune..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-commune"
            />
          </div>
          <Badge variant="secondary" className="shrink-0" data-testid="badge-commune-count">
            {communes.length} commune{communes.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredCommunes.length === 0 ? (
              <div className="p-12 text-center" data-testid="empty-state">
                <Landmark className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg mb-1">Aucune commune creee</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {searchQuery ? "Aucun resultat pour cette recherche." : "Creez des communes pour les voir apparaitre ici."}
                </p>
                {!searchQuery && canCreateMore && (
                  <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-commune-empty">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle commune
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commune</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommunes.map((commune) => (
                    <TableRow key={commune.id} data-testid={`row-commune-${commune.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {commune.logoUrl ? (
                            <img 
                              src={commune.logoUrl} 
                              alt={commune.name} 
                              className="h-9 w-9 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{commune.name}</p>
                            <p className="text-sm text-muted-foreground">{commune.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {commune.contactEmail || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={commune.billingStatus === "ACTIVE" ? "default" : "secondary"}
                        >
                          {commune.billingStatus === "ACTIVE" ? "Actif" : 
                           commune.billingStatus === "TRIAL" ? "Essai" : commune.billingStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/structures/${commune.slug}`, "_blank")}
                            data-testid={`button-view-commune-${commune.id}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteCommune(commune)}
                            data-testid={`button-delete-commune-${commune.id}`}
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
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle commune</DialogTitle>
            <DialogDescription>
              Creez une nouvelle commune membre de votre EPCI
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la commune *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Saint-Martin" 
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
                        data-testid="input-commune-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de la commune *</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground shrink-0">/structures/</span>
                        <Input 
                          placeholder="saint-martin" 
                          {...field}
                          data-testid="input-commune-slug"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'administrateur *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Jean Dupont" 
                        {...field}
                        data-testid="input-admin-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de l'administrateur *</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="admin@commune.fr" 
                        {...field}
                        data-testid="input-admin-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"}
                          placeholder="Minimum 8 caracteres" 
                          {...field}
                          data-testid="input-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Creer la commune
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCommune} onOpenChange={(open) => !open && setDeleteCommune(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la commune</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer "{deleteCommune?.name}" ?
              Cette action est irreversible et supprimera toutes les donnees de la commune.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteCommune(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteCommune && deleteMutation.mutate(deleteCommune.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
