import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, UserCircle, Loader2, GripVertical, Tags, Mail, Shield, Key } from "lucide-react";
import { PhotoUpload } from "@/components/photo-upload";
import type { Tenant, User, ElectedOfficial, TenantInterventionDomain, ElectedOfficialDomain, AdminMenuCode, EluFunction, BureauMemberFunction } from "@shared/schema";
import { ADMIN_MENU_CODES } from "@shared/schema";

const MENU_LABELS: Record<AdminMenuCode, string> = {
  DASHBOARD: "Tableau de bord",
  IDEAS: "Boite a idees",
  INCIDENTS: "Signalements",
  MEETINGS: "Reunions",
  ASSOCIATIONS: "Associations",
  ELUS: "Elus",
  DOMAINS: "Domaines",
  PHOTOS: "Galerie photos",
  ADMINS: "Administrateurs",
  SHARE: "Partage",
  SETTINGS: "Parametres",
  BILLING: "Facturation",
};

function getPhotoUrl(photoObjectPath: string | null | undefined, photoUrl: string | null | undefined): string | undefined {
  if (photoObjectPath) {
    const parts = photoObjectPath.split('/');
    const uploadsIndex = parts.findIndex(p => p === 'uploads');
    if (uploadsIndex !== -1) {
      return '/objects/' + parts.slice(uploadsIndex).join('/');
    }
  }
  return photoUrl || undefined;
}

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

export default function AdminElus() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editElu, setEditElu] = useState<ElectedOfficial | null>(null);
  const [deleteElu, setDeleteElu] = useState<ElectedOfficial | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    function: "",
    email: "",
    photoUrl: "",
    photoObjectPath: null as string | null,
    bio: "",
    displayOrder: 0,
    isActive: true,
  });
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [menuPermissions, setMenuPermissions] = useState<AdminMenuCode[]>([]);
  const [permissionsDialogElu, setPermissionsDialogElu] = useState<ElectedOfficial | null>(null);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  const { data: availableDomains = [] } = useQuery<TenantInterventionDomain[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "domains"],
    enabled: !!user,
  });

  const { data: elus = [], isLoading } = useQuery<ElectedOfficial[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "elus"],
    enabled: !!user,
  });

  const isAssociation = tenant?.tenantType === "ASSOCIATION";
  const memberLabel = isAssociation ? "membre" : "elu";
  const MemberLabel = isAssociation ? "Membre" : "Elu";
  const memberLabelPlural = isAssociation ? "membres" : "elus";
  const MemberLabelPlural = isAssociation ? "Membres" : "Elus";

  const { data: eluFunctions = [] } = useQuery<EluFunction[]>({
    queryKey: ["/api/public/elu-functions"],
    enabled: !isAssociation && !!tenant,
  });

  const { data: bureauFunctions = [] } = useQuery<BureauMemberFunction[]>({
    queryKey: ["/api/public/bureau-functions"],
    enabled: isAssociation && !!tenant,
  });

  const functionOptions = isAssociation 
    ? bureauFunctions.map(f => ({ value: f.label, label: f.label }))
    : eluFunctions.map(f => ({ value: f.label, label: f.label }));

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { domainIds: string[] }) => {
      const { domainIds, ...eluData } = data;
      const result = await apiRequest("POST", `/api/tenants/${params.slug}/admin/elus`, eluData);
      const newElu = await result.json();
      if (domainIds.length > 0) {
        await apiRequest("POST", `/api/tenants/${params.slug}/admin/elus/${newElu.id}/domains`, { domainIds });
      }
      return newElu;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "elus"] });
      setIsCreateOpen(false);
      resetForm();
      if (data.invitationSent) {
        toast({ title: `${MemberLabel} ajoute`, description: `${isAssociation ? "Le membre" : "L'elu"} a ete ajoute et une invitation lui a ete envoyee par email.` });
      } else if (data.invitationError) {
        toast({ title: `${MemberLabel} ajoute`, description: `${data.invitationError}. Vous pouvez renvoyer l'invitation depuis les parametres d'acces.` });
      } else {
        toast({ title: `${MemberLabel} ajoute`, description: `${isAssociation ? "Le membre" : "L'elu"} a ete ajoute avec succes.` });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, domainIds }: { id: string; data: Partial<typeof formData>; domainIds: string[] }) => {
      await apiRequest("PUT", `/api/tenants/${params.slug}/admin/elus/${id}`, data);
      await apiRequest("POST", `/api/tenants/${params.slug}/admin/elus/${id}/domains`, { domainIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "elus"] });
      setEditElu(null);
      resetForm();
      toast({ title: `${MemberLabel} mis a jour`, description: `${isAssociation ? "Le membre" : "L'elu"} a ete modifie avec succes.` });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tenants/${params.slug}/admin/elus/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "elus"] });
      setDeleteElu(null);
      toast({ title: `${MemberLabel} supprime`, description: `${isAssociation ? "Le membre" : "L'elu"} a ete supprime avec succes.` });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const saveDomainsMutation = useMutation({
    mutationFn: async ({ eluId, domainIds }: { eluId: string; domainIds: string[] }) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/elus/${eluId}/domains`, { domainIds });
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async ({ eluId, hasFullAccess, menuPermissions }: { eluId: string; hasFullAccess: boolean; menuPermissions: AdminMenuCode[] }) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/elus/${eluId}/permissions`, { hasFullAccess, menuPermissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "elus"] });
      setPermissionsDialogElu(null);
      toast({ title: "Acces enregistre", description: "Les permissions ont ete mises a jour." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (eluId: string) => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/elus/${eluId}/invite`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "elus"] });
      if (data.inviteLink) {
        toast({ title: "Invitation creee", description: `${data.message}. Lien: ${data.inviteLink}` });
      } else {
        toast({ title: "Invitation envoyee", description: `${isAssociation ? "Le membre" : "L'elu"} a recu un email avec les instructions.` });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ firstName: "", lastName: "", function: "", email: "", photoUrl: "", photoObjectPath: null, bio: "", displayOrder: 0, isActive: true });
    setSelectedDomainIds([]);
  };

  if (userError) {
    navigate(`/structures/${params.slug}/admin/login`);
    return null;
  }

  const filteredElus = elus.filter((e) => 
    !searchQuery || 
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.function.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.displayOrder - b.displayOrder);

  const openEdit = async (elu: ElectedOfficial) => {
    setFormData({
      firstName: elu.firstName,
      lastName: elu.lastName,
      function: elu.function,
      email: elu.email || "",
      photoUrl: elu.photoUrl || "",
      photoObjectPath: elu.photoObjectPath || null,
      bio: elu.bio || "",
      displayOrder: elu.displayOrder,
      isActive: elu.isActive,
    });
    setEditElu(elu);
    try {
      const response = await fetch(`/api/tenants/${params.slug}/admin/elus/${elu.id}/domains`, { credentials: "include" });
      if (response.ok) {
        const domains: TenantInterventionDomain[] = await response.json();
        setSelectedDomainIds(domains.map(d => d.id));
      }
    } catch (e) {
      setSelectedDomainIds([]);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const openPermissionsDialog = async (elu: ElectedOfficial) => {
    setPermissionsDialogElu(elu);
    try {
      const response = await fetch(`/api/tenants/${params.slug}/admin/elus/${elu.id}/permissions`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setHasFullAccess(data.hasFullAccess || false);
        setMenuPermissions(data.menuPermissions || []);
      } else {
        setHasFullAccess(false);
        setMenuPermissions([]);
      }
    } catch (e) {
      setHasFullAccess(false);
      setMenuPermissions([]);
    }
  };

  return (
    <AdminLayout tenant={tenant || null} user={user || null} accountBlocked={user?.accountBlocked} blockReason={user?.blockReason}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-admin-elus-title">
              {isAssociation ? "Les membres du Bureau" : "Les elus"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAssociation ? "Gerez les membres du bureau de votre association." : "Gerez les elus de votre commune."}
            </p>
          </div>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} data-testid="button-create-elu">
            <Plus className="h-4 w-4 mr-2" />
            {isAssociation ? "Ajouter un membre" : "Ajouter un elu"}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou fonction..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-elus"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredElus.length === 0 ? (
              <div className="text-center py-12">
                <UserCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground mt-4">{isAssociation ? "Aucun membre enregistre" : "Aucun elu enregistre"}</p>
                <Button variant="outline" className="mt-4" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isAssociation ? "Ajouter le premier membre" : "Ajouter le premier elu"}
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{isAssociation ? "Membre" : "Elu"}</TableHead>
                      <TableHead>Fonction</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredElus.map((elu) => (
                      <TableRow key={elu.id} data-testid={`row-elu-${elu.id}`}>
                        <TableCell>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={getPhotoUrl(elu.photoObjectPath, elu.photoUrl)} alt={`${elu.firstName} ${elu.lastName}`} />
                              <AvatarFallback>{getInitials(elu.firstName, elu.lastName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{elu.firstName} {elu.lastName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{elu.function}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{elu.email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={elu.isActive ? "default" : "secondary"}>
                            {elu.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {elu.email && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openPermissionsDialog(elu)}
                                data-testid={`button-permissions-elu-${elu.id}`}
                                title="Gerer l'acces"
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(elu)}
                              data-testid={`button-edit-elu-${elu.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteElu(elu)}
                              data-testid={`button-delete-elu-${elu.id}`}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isAssociation ? "Ajouter un membre du bureau" : "Ajouter un elu"}</DialogTitle>
              <DialogDescription>{isAssociation ? "Ajoutez un nouveau membre a votre association." : "Ajoutez un nouvel elu a votre commune."}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prenom</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Prenom"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Nom"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fonction</Label>
                <Select
                  value={formData.function}
                  onValueChange={(value) => setFormData({ ...formData, function: value })}
                >
                  <SelectTrigger data-testid="select-function">
                    <SelectValue placeholder="Selectionnez une fonction" />
                  </SelectTrigger>
                  <SelectContent>
                    {functionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email (optionnel)</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={isAssociation ? "email@association.fr" : "email@mairie.fr"}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Photo (optionnel)</Label>
                <PhotoUpload
                  currentPhotoUrl={formData.photoUrl}
                  currentPhotoObjectPath={formData.photoObjectPath}
                  initials={formData.firstName && formData.lastName ? getInitials(formData.firstName, formData.lastName) : "?"}
                  onPhotoChange={(path) => setFormData({ ...formData, photoObjectPath: path })}
                />
              </div>
              <div className="space-y-2">
                <Label>Biographie (optionnel)</Label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder={isAssociation ? "Quelques mots sur le membre..." : "Quelques mots sur l'elu..."}
                  rows={3}
                  data-testid="input-bio"
                />
              </div>
              <div className="space-y-2">
                <Label>Ordre d'affichage</Label>
                <Input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  data-testid="input-display-order"
                />
              </div>
              {availableDomains.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Domaines d'intervention
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                    {availableDomains.map((domain) => (
                      <div key={domain.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`domain-create-${domain.id}`}
                          checked={selectedDomainIds.includes(domain.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDomainIds([...selectedDomainIds, domain.id]);
                            } else {
                              setSelectedDomainIds(selectedDomainIds.filter(id => id !== domain.id));
                            }
                          }}
                          data-testid={`checkbox-domain-${domain.id}`}
                        />
                        <label htmlFor={`domain-create-${domain.id}`} className="text-sm cursor-pointer">
                          {domain.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => createMutation.mutate({ ...formData, domainIds: selectedDomainIds })} 
                disabled={createMutation.isPending || !formData.firstName || !formData.lastName || !formData.function} 
                data-testid="button-submit-create-elu"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editElu} onOpenChange={() => setEditElu(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isAssociation ? "Modifier le membre" : "Modifier l'elu"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prenom</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    data-testid="input-edit-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    data-testid="input-edit-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fonction</Label>
                <Select
                  value={formData.function}
                  onValueChange={(value) => setFormData({ ...formData, function: value })}
                >
                  <SelectTrigger data-testid="select-edit-function">
                    <SelectValue placeholder="Selectionnez une fonction" />
                  </SelectTrigger>
                  <SelectContent>
                    {functionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Photo</Label>
                <PhotoUpload
                  currentPhotoUrl={formData.photoUrl}
                  currentPhotoObjectPath={formData.photoObjectPath}
                  initials={formData.firstName && formData.lastName ? getInitials(formData.firstName, formData.lastName) : "?"}
                  onPhotoChange={(path) => setFormData({ ...formData, photoObjectPath: path })}
                />
              </div>
              <div className="space-y-2">
                <Label>Biographie</Label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  data-testid="input-edit-bio"
                />
              </div>
              <div className="space-y-2">
                <Label>Ordre d'affichage</Label>
                <Input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-display-order"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Actif</Label>
                <Switch 
                  checked={formData.isActive} 
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} 
                  data-testid="switch-edit-active"
                />
              </div>
              {availableDomains.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Domaines d'intervention
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                    {availableDomains.map((domain) => (
                      <div key={domain.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`domain-edit-${domain.id}`}
                          checked={selectedDomainIds.includes(domain.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDomainIds([...selectedDomainIds, domain.id]);
                            } else {
                              setSelectedDomainIds(selectedDomainIds.filter(id => id !== domain.id));
                            }
                          }}
                          data-testid={`checkbox-edit-domain-${domain.id}`}
                        />
                        <label htmlFor={`domain-edit-${domain.id}`} className="text-sm cursor-pointer">
                          {domain.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditElu(null)}>Annuler</Button>
              <Button 
                onClick={() => editElu && updateMutation.mutate({ id: editElu.id, data: formData, domainIds: selectedDomainIds })} 
                disabled={updateMutation.isPending} 
                data-testid="button-submit-edit-elu"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteElu} onOpenChange={() => setDeleteElu(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isAssociation ? "Supprimer le membre" : "Supprimer l'elu"}</DialogTitle>
              <DialogDescription>
                Etes-vous sur de vouloir supprimer {deleteElu?.firstName} {deleteElu?.lastName} ? Cette action est irreversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteElu(null)}>Annuler</Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteElu && deleteMutation.mutate(deleteElu.id)} 
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-elu"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!permissionsDialogElu} onOpenChange={() => setPermissionsDialogElu(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Acces a l'administration
              </DialogTitle>
              <DialogDescription>
                Configurez l'acces de {permissionsDialogElu?.firstName} {permissionsDialogElu?.lastName} a l'espace d'administration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-md bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Acces complet</Label>
                  <p className="text-sm text-muted-foreground">
                    Permet d'acceder a tous les menus de l'administration.
                  </p>
                </div>
                <Switch
                  checked={hasFullAccess}
                  onCheckedChange={setHasFullAccess}
                  data-testid="switch-full-access"
                />
              </div>

              {!hasFullAccess && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">Menus autorises</Label>
                  <p className="text-sm text-muted-foreground">
                    {isAssociation ? "Selectionnez les menus auxquels ce membre peut acceder." : "Selectionnez les menus auxquels cet elu peut acceder."}
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-3 border rounded-md">
                    {ADMIN_MENU_CODES.map((code) => (
                      <div key={code} className="flex items-center gap-2">
                        <Checkbox
                          id={`perm-${code}`}
                          checked={menuPermissions.includes(code)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setMenuPermissions([...menuPermissions, code]);
                            } else {
                              setMenuPermissions(menuPermissions.filter(c => c !== code));
                            }
                          }}
                          data-testid={`checkbox-perm-${code}`}
                        />
                        <label htmlFor={`perm-${code}`} className="text-sm cursor-pointer">
                          {code === "ELUS" ? (isAssociation ? "Membres Bureau" : MENU_LABELS[code]) : MENU_LABELS[code]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Invitation
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {permissionsDialogElu?.passwordHash 
                        ? (isAssociation ? "Ce membre a deja configure son mot de passe." : "Cet elu a deja configure son mot de passe.")
                        : (isAssociation ? "Envoyez une invitation pour que le membre cree son mot de passe." : "Envoyez une invitation pour que l'elu cree son mot de passe.")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => permissionsDialogElu && inviteMutation.mutate(permissionsDialogElu.id)}
                    disabled={inviteMutation.isPending || !permissionsDialogElu?.email}
                    data-testid="button-send-invitation"
                  >
                    {inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Key className="h-4 w-4 mr-2" />
                    {permissionsDialogElu?.passwordHash ? "Renvoyer" : "Inviter"}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermissionsDialogElu(null)}>Annuler</Button>
              <Button 
                onClick={() => permissionsDialogElu && savePermissionsMutation.mutate({ 
                  eluId: permissionsDialogElu.id, 
                  hasFullAccess, 
                  menuPermissions 
                })} 
                disabled={savePermissionsMutation.isPending}
                data-testid="button-save-permissions"
              >
                {savePermissionsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
