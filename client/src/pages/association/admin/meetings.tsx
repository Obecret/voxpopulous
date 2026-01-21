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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, Eye, Calendar, MapPin, Users, Plus, Trash2, Loader2, Archive, ArchiveRestore } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Association, AssociationUser, AssociationMeeting, AssociationMeetingRegistration, GlobalAssociationDomain } from "@shared/schema";

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

const meetingFormSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caracteres"),
  description: z.string().optional(),
  dateTime: z.string().min(1, "La date est requise"),
  location: z.string().min(2, "Le lieu est requis"),
  capacity: z.number().min(1).optional().nullable(),
  domainId: z.string().optional(),
});

type MeetingFormData = z.infer<typeof meetingFormSchema>;

interface MeetingWithRegistrations extends AssociationMeeting {
  registrationsCount?: number;
}

interface MeetingDetail extends AssociationMeeting {
  registrations: AssociationMeetingRegistration[];
}

export default function AssociationAdminMeetings() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithRegistrations | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);

  const { data, isLoading: userLoading, error } = useQuery<{ user: SafeAssociationUser; association: Association }>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug, "me"],
    retry: false,
  });

  const { data: meetings, isLoading: meetingsLoading } = useQuery<MeetingWithRegistrations[]>({
    queryKey: ["/api/associations", data?.association?.id, "admin", "meetings", { showArchived }],
    queryFn: async () => {
      const response = await fetch(`/api/associations/${data?.association?.id}/admin/meetings?includeArchived=${showArchived}`);
      if (!response.ok) throw new Error("Failed to fetch meetings");
      return response.json();
    },
    enabled: !!data?.association?.id,
  });

  const { data: meetingDetail } = useQuery<MeetingDetail>({
    queryKey: ["/api/associations", data?.association?.id, "admin", "meetings", selectedMeeting?.id],
    enabled: !!data?.association?.id && !!selectedMeeting?.id && !isEditing,
  });

  const { data: domains = [] } = useQuery<GlobalAssociationDomain[]>({
    queryKey: ["/api/public/association-domains"],
  });

  const form = useForm<MeetingFormData>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dateTime: "",
      location: "",
      capacity: null,
      domainId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: MeetingFormData) => {
      return apiRequest("POST", `/api/associations/${data?.association?.id}/admin/meetings`, {
        ...values,
        dateTime: new Date(values.dateTime).toISOString(),
        capacity: values.capacity || null,
        domainId: values.domainId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/associations" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "stats"] });
      setIsCreating(false);
      form.reset();
      toast({
        title: "Evenement cree",
        description: "L'evenement a ete cree avec succes.",
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
    mutationFn: async (values: MeetingFormData & { id: string }) => {
      return apiRequest("PATCH", `/api/associations/${data?.association?.id}/admin/meetings/${values.id}`, {
        title: values.title,
        description: values.description,
        dateTime: new Date(values.dateTime).toISOString(),
        location: values.location,
        capacity: values.capacity || null,
        domainId: values.domainId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/associations" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      setIsEditing(false);
      setSelectedMeeting(null);
      form.reset();
      toast({
        title: "Evenement modifie",
        description: "L'evenement a ete modifie avec succes.",
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ meetingId, status }: { meetingId: string; status: string }) => {
      return apiRequest("PATCH", `/api/associations/${data?.association?.id}/admin/meetings/${meetingId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/associations" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "stats"] });
      setSelectedMeeting(null);
      toast({
        title: "Statut mis a jour",
        description: "Le statut de l'evenement a ete modifie avec succes.",
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

  const archiveMutation = useMutation({
    mutationFn: async ({ meetingId, isArchived }: { meetingId: string; isArchived: boolean }) => {
      return apiRequest("POST", `/api/associations/${data?.association?.id}/admin/meetings/${meetingId}/archive`, { isArchived });
    },
    onSuccess: (_, { isArchived }) => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/associations" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "stats"] });
      setSelectedMeeting(null);
      toast({
        title: isArchived ? "Evenement archive" : "Evenement restaure",
        description: isArchived 
          ? "L'evenement a ete archive avec succes." 
          : "L'evenement a ete restaure avec succes.",
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
    mutationFn: async (meetingId: string) => {
      return apiRequest("DELETE", `/api/associations/${data?.association?.id}/admin/meetings/${meetingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/associations" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/associations", data?.association?.id, "admin", "stats"] });
      setSelectedMeeting(null);
      toast({
        title: "Evenement supprime",
        description: "L'evenement a ete supprime avec succes.",
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

  const filteredMeetings = meetings?.filter((meeting) => {
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
    const matchesSearch = !searchQuery || 
      meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meeting.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesStatus && matchesSearch;
  }) || [];

  const handleCreate = (values: MeetingFormData) => {
    createMutation.mutate(values);
  };

  const handleUpdate = (values: MeetingFormData) => {
    if (selectedMeeting) {
      updateMutation.mutate({ ...values, id: selectedMeeting.id });
    }
  };

  const handleStatusChange = () => {
    if (selectedMeeting && newStatus) {
      updateStatusMutation.mutate({ meetingId: selectedMeeting.id, status: newStatus });
    }
  };

  const handleDelete = () => {
    if (selectedMeeting && confirm("Etes-vous sur de vouloir supprimer cet evenement ?")) {
      deleteMutation.mutate(selectedMeeting.id);
    }
  };

  const openEditDialog = (meeting: MeetingWithRegistrations) => {
    setSelectedMeeting(meeting);
    setIsEditing(true);
    const dateLocal = new Date(meeting.dateTime).toISOString().slice(0, 16);
    form.reset({
      title: meeting.title,
      description: meeting.description || "",
      dateTime: dateLocal,
      location: meeting.location,
      capacity: meeting.capacity,
    });
  };

  return (
    <AssociationAdminLayout association={association || null} user={user || null} tenantSlug={params.slug}>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-assoc-meetings-title">
              Gestion des evenements
            </h1>
            <p className="text-muted-foreground mt-1">Gerez les evenements de votre association.</p>
          </div>
          <Button onClick={() => { setIsCreating(true); form.reset(); }} data-testid="button-create-meeting">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel evenement
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-meetings"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-status-meetings">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="SCHEDULED">Planifie</SelectItem>
                  <SelectItem value="COMPLETED">Termine</SelectItem>
                  <SelectItem value="CANCELLED">Annule</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                  data-testid="switch-show-archived"
                />
                <Label htmlFor="show-archived" className="text-sm whitespace-nowrap">
                  Afficher archives
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {meetingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Aucun evenement trouve</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Lieu</TableHead>
                      <TableHead className="hidden lg:table-cell">Inscrits</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMeetings.map((meeting) => (
                      <TableRow key={meeting.id} data-testid={`row-meeting-${meeting.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {meeting.title}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(meeting.dateTime).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge type="meeting" status={meeting.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[120px]">
                            <MapPin className="h-3.5 w-3.5" />
                            {meeting.location}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {meeting.registrationsCount || 0}
                            {meeting.capacity && ` / ${meeting.capacity}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedMeeting(meeting);
                                setNewStatus(meeting.status);
                              }}
                              data-testid={`button-view-meeting-${meeting.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => archiveMutation.mutate({ meetingId: meeting.id, isArchived: !(meeting as any).isArchived })}
                              disabled={archiveMutation.isPending}
                              title={(meeting as any).isArchived ? "Restaurer" : "Archiver"}
                              data-testid={`button-archive-${meeting.id}`}
                            >
                              {(meeting as any).isArchived ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
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
              <DialogTitle>Nouvel evenement</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-meeting-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-meeting-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date et heure</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-meeting-datetime" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lieu</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-meeting-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacite (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-meeting-capacity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="domainId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domaine (optionnel)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-meeting-domain">
                            <SelectValue placeholder="Choisir un domaine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {domains.map((domain) => (
                            <SelectItem key={domain.id} value={domain.id}>{domain.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-meeting">
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Creer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditing} onOpenChange={(open) => { if (!open) { setIsEditing(false); setSelectedMeeting(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Modifier l'evenement</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-meeting-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-edit-meeting-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date et heure</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-edit-meeting-datetime" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lieu</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-meeting-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacite (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-edit-meeting-capacity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="domainId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domaine (optionnel)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-meeting-domain">
                            <SelectValue placeholder="Choisir un domaine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {domains.map((domain) => (
                            <SelectItem key={domain.id} value={domain.id}>{domain.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setSelectedMeeting(null); }}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-meeting">
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedMeeting && !isEditing} onOpenChange={() => setSelectedMeeting(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedMeeting?.title}</DialogTitle>
            </DialogHeader>
            {selectedMeeting && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <StatusBadge type="meeting" status={selectedMeeting.status} />
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {selectedMeeting.registrationsCount || 0} inscrit(s)
                    {selectedMeeting.capacity && ` / ${selectedMeeting.capacity}`}
                  </span>
                </div>
                {selectedMeeting.description && (
                  <p className="text-sm whitespace-pre-wrap">{selectedMeeting.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(selectedMeeting.dateTime).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {selectedMeeting.location}
                </div>

                {meetingDetail?.registrations && meetingDetail.registrations.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Inscrits ({meetingDetail.registrations.length})</h4>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {meetingDetail.registrations.map((reg) => (
                        <div key={reg.id} className="text-sm p-2 bg-muted rounded" data-testid={`registration-item-${reg.id}`}>
                          <p className="font-medium">{reg.fullName}</p>
                          <p className="text-muted-foreground">{reg.email}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">Modifier le statut</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger data-testid="select-new-status-meeting">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Planifie</SelectItem>
                      <SelectItem value="COMPLETED">Termine</SelectItem>
                      <SelectItem value="CANCELLED">Annule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-meeting"
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              <Button variant="outline" onClick={() => openEditDialog(selectedMeeting!)}>
                Modifier
              </Button>
              <Button 
                onClick={handleStatusChange}
                disabled={updateStatusMutation.isPending || newStatus === selectedMeeting?.status}
                data-testid="button-save-meeting-status"
              >
                {updateStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer statut
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AssociationAdminLayout>
  );
}
