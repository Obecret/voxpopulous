import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Plus, Pencil, Trash2, Users, ExternalLink, Loader2, Check, X,
  Music, Palette, Dumbbell, Heart, BookOpen, TreePine, Camera, Utensils, 
  Gamepad2, Bike, Globe, Star, Award, Zap, Coffee, Sparkles, Handshake
} from "lucide-react";
import type { Tenant, User, Association } from "@shared/schema";

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

const ACTIVITY_TYPES = [
  { name: "Users", label: "General", icon: Users, image: "/activity-images/community_charity_volunteers.png" },
  { name: "Football", label: "Football", icon: Dumbbell, image: "/activity-images/football_soccer_action_shot.png" },
  { name: "Basketball", label: "Basketball", icon: Dumbbell, image: "/activity-images/basketball_players_in_action.png" },
  { name: "Tennis", label: "Tennis", icon: Dumbbell, image: "/activity-images/tennis_player_serving.png" },
  { name: "Swimming", label: "Natation", icon: Dumbbell, image: "/activity-images/swimming_pool_athletes.png" },
  { name: "Athletics", label: "Athletisme", icon: Dumbbell, image: "/activity-images/athletics_track_runners.png" },
  { name: "Cycling", label: "Cyclisme", icon: Bike, image: "/activity-images/road_cycling_race.png" },
  { name: "Dance", label: "Danse", icon: Sparkles, image: "/activity-images/dance_performance_artistic.png" },
  { name: "MartialArts", label: "Arts Martiaux", icon: Zap, image: "/activity-images/martial_arts_training.png" },
  { name: "Music", label: "Musique", icon: Music, image: "/activity-images/orchestra_music_performance.png" },
  { name: "Palette", label: "Arts Plastiques", icon: Palette, image: "/activity-images/artist_painting_studio.png" },
  { name: "Theater", label: "Theatre", icon: Star, image: "/activity-images/theater_stage_performance.png" },
  { name: "Camera", label: "Photographie", icon: Camera, image: "/activity-images/photography_creative_session.png" },
  { name: "BookOpen", label: "Lecture", icon: BookOpen, image: "/activity-images/book_club_reading_group.png" },
  { name: "TreePine", label: "Nature/Environnement", icon: TreePine, image: "/activity-images/nature_conservation_volunteers.png" },
  { name: "Gamepad2", label: "Jeux/Echecs", icon: Gamepad2, image: "/activity-images/chess_club_gaming_activity.png" },
  { name: "Handshake", label: "Solidarite", icon: Handshake, image: "/activity-images/community_charity_volunteers.png" },
  { name: "Heart", label: "Sante/Bien-etre", icon: Heart, image: "/activity-images/community_charity_volunteers.png" },
];

const LEGACY_ICON_MAPPINGS: Record<string, string> = {
  Dumbbell: "/activity-images/martial_arts_training.png",
  Bike: "/activity-images/road_cycling_race.png",
  Globe: "/activity-images/community_charity_volunteers.png",
  Star: "/activity-images/theater_stage_performance.png",
  Award: "/activity-images/athletics_track_runners.png",
  Zap: "/activity-images/martial_arts_training.png",
  Coffee: "/activity-images/community_charity_volunteers.png",
  Sparkles: "/activity-images/dance_performance_artistic.png",
  Utensils: "/activity-images/community_charity_volunteers.png",
};

const LOGO_ICONS = ACTIVITY_TYPES;

function PasswordRules({ password }: { password: string }) {
  const rules = [
    { label: "Au moins 8 caracteres", valid: password.length >= 8 },
    { label: "Une majuscule", valid: /[A-Z]/.test(password) },
    { label: "Une minuscule", valid: /[a-z]/.test(password) },
    { label: "Un chiffre", valid: /[0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="space-y-1 mt-2">
      {rules.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          {rule.valid ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <X className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className={rule.valid ? "text-green-600" : "text-red-500"}>
            {rule.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAssociations() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editAssociation, setEditAssociation] = useState<Association | null>(null);
  const [deleteAssociation, setDeleteAssociation] = useState<Association | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    contactEmail: "",
    logoIcon: "",
    isActive: true,
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminPasswordConfirm: "",
  });

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  const { data: associationsData, isLoading } = useQuery<{ associations: Association[], quota: { used: number, allowed: number, remaining: number } }>({
    queryKey: ["/api/tenants", params.slug, "admin", "associations"],
    enabled: !!user,
  });
  const associations = associationsData?.associations;
  const quota = associationsData?.quota;

  const isPasswordValid = () => {
    const p = formData.adminPassword;
    return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
  };

  const canSubmit = () => {
    if (!formData.name || !formData.slug) return false;
    // Admin credentials are required for new associations
    if (!editAssociation) {
      if (!formData.adminName || !formData.adminEmail || !formData.adminPassword) return false;
      if (!isPasswordValid()) return false;
      if (formData.adminPassword !== formData.adminPasswordConfirm) return false;
    } else if (formData.adminEmail && formData.adminPassword) {
      // For edits, only validate if admin fields are filled
      if (!isPasswordValid()) return false;
      if (formData.adminPassword !== formData.adminPasswordConfirm) return false;
    }
    return true;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { adminPasswordConfirm, ...submitData } = data;
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/associations`, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "associations"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Association creee", description: "L'association a ete creee avec succes." });
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { adminPasswordConfirm, ...submitData } = data;
      return apiRequest("PUT", `/api/tenants/${params.slug}/admin/associations/${id}`, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "associations"] });
      setEditAssociation(null);
      resetForm();
      toast({ title: "Association mise a jour", description: "L'association a ete modifiee avec succes." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tenants/${params.slug}/admin/associations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "associations"] });
      setDeleteAssociation(null);
      toast({ title: "Association supprimee", description: "L'association a ete supprimee avec succes." });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Une erreur est survenue.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "", contactEmail: "", logoIcon: "", isActive: true, adminName: "", adminEmail: "", adminPassword: "", adminPasswordConfirm: "" });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  };

  if (userError) {
    navigate(`/structures/${params.slug}/admin/login`);
    return null;
  }

  const filteredAssociations = associations?.filter((a) => 
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const openEdit = (association: Association) => {
    setFormData({
      name: association.name,
      slug: association.slug,
      description: association.description || "",
      contactEmail: association.contactEmail || "",
      logoIcon: (association as any).logoIcon || "",
      isActive: association.isActive,
      adminName: "",
      adminEmail: "",
      adminPassword: "",
      adminPasswordConfirm: "",
    });
    setEditAssociation(association);
  };

  const getActivityInfo = (activityName: string) => {
    const found = ACTIVITY_TYPES.find(i => i.name === activityName);
    if (found) return found;
    if (LEGACY_ICON_MAPPINGS[activityName]) {
      return { name: activityName, label: activityName, icon: Users, image: LEGACY_ICON_MAPPINGS[activityName] };
    }
    return ACTIVITY_TYPES[0];
  };

  return (
    <AdminLayout tenant={tenant || null} user={user || null} accountBlocked={user?.accountBlocked} blockReason={user?.blockReason}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-admin-associations-title">
              Gestion des associations
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerez les associations de votre commune.
            </p>
          </div>
          <Button 
            onClick={() => { resetForm(); setIsCreateOpen(true); }} 
            disabled={quota !== undefined && quota.remaining <= 0}
            data-testid="button-create-association"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle association
          </Button>
        </div>

        {quota && quota.allowed > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-md flex items-center justify-between gap-2 flex-wrap" data-testid="quota-banner">
            <span className="text-sm text-muted-foreground">
              {quota.used} / {quota.allowed} association(s) utilisee(s)
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
            ) : filteredAssociations.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground mt-4">Aucune association</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead className="hidden md:table-cell">Slug</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssociations.map((association) => {
                      const activityInfo = getActivityInfo((association as any).logoIcon || "");
                      return (
                        <TableRow key={association.id} data-testid={`row-association-${association.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <img 
                                src={activityInfo.image} 
                                alt={activityInfo.label} 
                                className="h-10 w-10 rounded object-cover"
                              />
                              <div>
                                <div>{association.name}</div>
                                <div className="text-xs text-muted-foreground">{activityInfo.label}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{association.slug}</TableCell>
                          <TableCell>
                            <Badge variant={association.isActive ? "default" : "secondary"}>
                              {association.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => window.open(`/structures/${params.slug}/${association.slug}`, "_blank")}
                                data-testid={`button-view-${association.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(association)}
                                data-testid={`button-edit-${association.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteAssociation(association)}
                                data-testid={`button-delete-${association.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Nouvelle association</DialogTitle>
              <DialogDescription>Creez une nouvelle association pour votre organisation.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom de l'association <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })}
                    placeholder="Ex: Association Sportive"
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL de l'association <span className="text-destructive">*</span></Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/structures/</span>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="association-sportive"
                      data-testid="input-slug"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nom de l'administrateur <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    placeholder="Jean Dupont"
                    data-testid="input-admin-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email de l'administrateur <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="admin@association.fr"
                    data-testid="input-admin-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe <span className="text-destructive">*</span></Label>
                  <PasswordInput
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    placeholder="Minimum 8 caracteres"
                    data-testid="input-admin-password"
                  />
                  <PasswordRules password={formData.adminPassword} />
                </div>
                <div className="space-y-2">
                  <Label>Confirmer le mot de passe <span className="text-destructive">*</span></Label>
                  <PasswordInput
                    value={formData.adminPasswordConfirm}
                    onChange={(e) => setFormData({ ...formData, adminPasswordConfirm: e.target.value })}
                    placeholder="Confirmer le mot de passe"
                    data-testid="input-admin-password-confirm"
                  />
                  {formData.adminPasswordConfirm && formData.adminPassword !== formData.adminPasswordConfirm && (
                    <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                      <X className="h-3.5 w-3.5" />
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                  {formData.adminPasswordConfirm && formData.adminPassword === formData.adminPasswordConfirm && formData.adminPassword && (
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Les mots de passe correspondent
                    </p>
                  )}
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Informations optionnelles</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Description de l'association..."
                        rows={3}
                        data-testid="input-description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type d'activite</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {ACTIVITY_TYPES.map(({ name, label, image }) => (
                          <Button
                            key={name}
                            type="button"
                            variant={formData.logoIcon === name ? "default" : "outline"}
                            onClick={() => setFormData({ ...formData, logoIcon: name })}
                            className="h-auto p-2 flex flex-col items-center gap-1"
                            data-testid={`icon-${name}`}
                          >
                            <img src={image} alt={label} className="w-12 h-12 rounded object-cover" />
                            <span className="text-xs truncate w-full text-center">{label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email de contact</Label>
                      <Input
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        placeholder="contact@association.fr"
                        data-testid="input-contact-email"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || !canSubmit()} data-testid="button-submit-create">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Creer l'association
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editAssociation} onOpenChange={() => setEditAssociation(null)}>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Modifier l'association</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-edit-name" />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} data-testid="input-edit-slug" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                    rows={3}
                    data-testid="input-edit-description" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type d'activite</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ACTIVITY_TYPES.map(({ name, label, image }) => (
                      <Button
                        key={name}
                        type="button"
                        variant={formData.logoIcon === name ? "default" : "outline"}
                        onClick={() => setFormData({ ...formData, logoIcon: name })}
                        className="h-auto p-2 flex flex-col items-center gap-1"
                        data-testid={`edit-icon-${name}`}
                      >
                        <img src={image} alt={label} className="w-12 h-12 rounded object-cover" />
                        <span className="text-xs truncate w-full text-center">{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email de contact</Label>
                  <Input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} data-testid="input-edit-contact-email" />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-edit-active" />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditAssociation(null)}>Annuler</Button>
              <Button onClick={() => editAssociation && updateMutation.mutate({ id: editAssociation.id, data: formData })} disabled={updateMutation.isPending} data-testid="button-submit-edit">
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteAssociation} onOpenChange={() => setDeleteAssociation(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer l'association</DialogTitle>
              <DialogDescription>
                Etes-vous sur de vouloir supprimer "{deleteAssociation?.name}" ? Cette action est irreversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteAssociation(null)}>Annuler</Button>
              <Button variant="destructive" onClick={() => deleteAssociation && deleteMutation.mutate(deleteAssociation.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
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
