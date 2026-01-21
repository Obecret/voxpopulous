import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AssociationAdminLayout } from "@/components/layout/association-admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Edit, Trash2, Loader2, Mail, User, Tags } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoUpload } from "@/components/photo-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Association, AssociationUser, BureauMember, GlobalAssociationDomain, BureauMemberFunction } from "@shared/schema";

type BureauMemberWithDomains = BureauMember & { domains?: GlobalAssociationDomain[] };

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

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

const bureauMemberFormSchema = z.object({
  firstName: z.string().min(2, "Le prenom doit contenir au moins 2 caracteres"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  function: z.string().min(2, "La fonction est requise"),
  email: z.string().email("Email invalide"),
});

type BureauMemberFormData = z.infer<typeof bureauMemberFormSchema>;

export default function AssociationAdminBureau() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<BureauMember | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [photoObjectPath, setPhotoObjectPath] = useState<string | null>(null);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);

  const { data, isLoading: userLoading, error } = useQuery<{ user: SafeAssociationUser; association: Association }>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug, "me"],
    retry: false,
  });

  const { data: members, isLoading: membersLoading } = useQuery<BureauMemberWithDomains[]>({
    queryKey: ["/api/associations", data?.association?.id, "admin", "bureau"],
    enabled: !!data?.association?.id,
  });

  const { data: availableDomains = [] } = useQuery<GlobalAssociationDomain[]>({
    queryKey: ["/api/associations", data?.association?.id, "admin", "domains"],
    enabled: !!data?.association?.id,
  });

  const { data: bureauFunctions = [] } = useQuery<BureauMemberFunction[]>({
    queryKey: ["/api/public/bureau-functions"],
  });

  const form = useForm<BureauMemberFormData>({
    resolver: zodResolver(bureauMemberFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      function: "",
      email: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: BureauMemberFormData) => {
      const response = await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/bureau`, { ...values, photoObjectPath });
      const newMember = await response.json() as BureauMember;
      if (selectedDomainIds.length > 0) {
        await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/bureau/${newMember.id}/domains`, { domainIds: selectedDomainIds });
      }
      return newMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "bureau"] });
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "stats"] });
      setIsCreating(false);
      setPhotoObjectPath(null);
      setSelectedDomainIds([]);
      form.reset();
      toast({
        title: "Membre ajoute",
        description: "Le membre du bureau a ete ajoute avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: BureauMemberFormData & { id: string }) => {
      await apiRequest("PATCH", `/api/associations/${data?.association?.id}/admin/bureau/${values.id}`, {
        firstName: values.firstName,
        lastName: values.lastName,
        function: values.function,
        email: values.email,
        photoObjectPath,
      });
      await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/bureau/${values.id}/domains`, { domainIds: selectedDomainIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "bureau"] });
      setIsEditing(false);
      setSelectedMember(null);
      setPhotoObjectPath(null);
      setSelectedDomainIds([]);
      form.reset();
      toast({
        title: "Membre modifie",
        description: "Le membre du bureau a ete modifie avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("DELETE", `/api/associations/${data?.association?.id}/admin/bureau/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "bureau"] });
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "stats"] });
      setSelectedMember(null);
      toast({
        title: "Membre supprime",
        description: "Le membre du bureau a ete supprime avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  if (error) {
    navigate(`/structures/${params.slug}/${params.assocSlug}/login`);
    return null;
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <Skeleton className="h-16 w-full mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { user, association } = data || {};

  const filteredMembers = members?.filter((member) => {
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    const matchesSearch = !searchQuery || 
      fullName.includes(searchQuery.toLowerCase()) ||
      member.function.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const handleCreate = (values: BureauMemberFormData) => {
    createMutation.mutate(values);
  };

  const handleUpdate = (values: BureauMemberFormData) => {
    if (selectedMember) {
      updateMutation.mutate({ ...values, id: selectedMember.id });
    }
  };

  const handleDelete = (memberId: string) => {
    if (confirm("Etes-vous sur de vouloir supprimer ce membre du bureau ?")) {
      deleteMutation.mutate(memberId);
    }
  };

  const openEditDialog = async (member: BureauMember) => {
    setSelectedMember(member);
    setIsEditing(true);
    setPhotoObjectPath(member.photoObjectPath || null);
    form.reset({
      firstName: member.firstName,
      lastName: member.lastName,
      function: member.function,
      email: member.email,
    });
    try {
      const response = await fetch(`/api/associations/${data?.association?.id}/admin/bureau/${member.id}/domains`, { credentials: "include" });
      if (response.ok) {
        const domains: GlobalAssociationDomain[] = await response.json();
        setSelectedDomainIds(domains.map(d => d.id));
      } else {
        setSelectedDomainIds([]);
      }
    } catch {
      setSelectedDomainIds([]);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <AssociationAdminLayout association={association || null} user={user || null} tenantSlug={params.slug}>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-assoc-bureau-title">
              Gestion du bureau
            </h1>
            <p className="text-muted-foreground mt-1">Gerez les membres du bureau de votre association.</p>
          </div>
          <Button onClick={() => { setIsCreating(true); form.reset(); setPhotoObjectPath(null); setSelectedDomainIds([]); }} data-testid="button-create-member">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau membre
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un membre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 max-w-md"
                data-testid="input-search-bureau"
              />
            </div>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12">
                <User className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground mt-4">Aucun membre du bureau trouve</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Fonction</TableHead>
                      <TableHead className="hidden lg:table-cell">Domaines</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden sm:table-cell">Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={getPhotoUrl(member.photoObjectPath, null)} alt={`${member.firstName} ${member.lastName}`} />
                              <AvatarFallback className="text-xs">{getInitials(member.firstName, member.lastName)}</AvatarFallback>
                            </Avatar>
                            <span>{member.firstName} {member.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.function}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {member.domains && member.domains.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {member.domains.slice(0, 3).map((domain) => (
                                <Badge 
                                  key={domain.id} 
                                  variant="outline" 
                                  className="text-xs"
                                  style={{ 
                                    borderColor: domain.color || undefined,
                                    color: domain.color || undefined 
                                  }}
                                >
                                  {domain.name}
                                </Badge>
                              ))}
                              {member.domains.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{member.domains.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {member.email}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={member.isActive ? "default" : "secondary"}>
                            {member.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(member)}
                              data-testid={`button-edit-member-${member.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(member.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-member-${member.id}`}
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

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau membre du bureau</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prenom</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-member-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-member-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="function"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fonction</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-member-function">
                            <SelectValue placeholder="Selectionnez une fonction" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bureauFunctions.filter(f => f.isActive).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((fn) => (
                            <SelectItem key={fn.id} value={fn.label}>
                              {fn.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-member-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel className="mb-2 block">Photo</FormLabel>
                  <PhotoUpload
                    currentPhotoObjectPath={photoObjectPath}
                    initials={form.watch("firstName")?.charAt(0)?.toUpperCase() + form.watch("lastName")?.charAt(0)?.toUpperCase() || "?"}
                    onPhotoChange={setPhotoObjectPath}
                  />
                </div>
                {availableDomains.length > 0 && (
                  <div>
                    <FormLabel className="mb-2 flex items-center gap-2">
                      <Tags className="h-4 w-4" />
                      Domaines d'intervention
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                      {availableDomains.map((domain) => (
                        <div key={domain.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`create-domain-${domain.id}`}
                            checked={selectedDomainIds.includes(domain.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDomainIds([...selectedDomainIds, domain.id]);
                              } else {
                                setSelectedDomainIds(selectedDomainIds.filter(id => id !== domain.id));
                              }
                            }}
                            data-testid={`checkbox-create-domain-${domain.id}`}
                          />
                          <label htmlFor={`create-domain-${domain.id}`} className="text-sm cursor-pointer">
                            {domain.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-member">
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Ajouter
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditing} onOpenChange={(open) => { if (!open) { setIsEditing(false); setSelectedMember(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Modifier le membre</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prenom</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-member-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-member-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="function"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fonction</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-member-function">
                            <SelectValue placeholder="Selectionnez une fonction" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bureauFunctions.filter(f => f.isActive).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((fn) => (
                            <SelectItem key={fn.id} value={fn.label}>
                              {fn.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-edit-member-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel className="mb-2 block">Photo</FormLabel>
                  <PhotoUpload
                    currentPhotoObjectPath={photoObjectPath}
                    initials={form.watch("firstName")?.charAt(0)?.toUpperCase() + form.watch("lastName")?.charAt(0)?.toUpperCase() || "?"}
                    onPhotoChange={setPhotoObjectPath}
                  />
                </div>
                {availableDomains.length > 0 && (
                  <div>
                    <FormLabel className="mb-2 flex items-center gap-2">
                      <Tags className="h-4 w-4" />
                      Domaines d'intervention
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                      {availableDomains.map((domain) => (
                        <div key={domain.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-domain-${domain.id}`}
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
                          <label htmlFor={`edit-domain-${domain.id}`} className="text-sm cursor-pointer">
                            {domain.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setSelectedMember(null); }}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-member">
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AssociationAdminLayout>
  );
}
