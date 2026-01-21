import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminSession } from "@/hooks/use-admin-session";
import { Search, Plus, Eye, MapPin, Calendar, Users, Loader2, Clock, Lock, Archive, ArchiveRestore } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Meeting, MeetingRegistration, GlobalMunicipalityDomain } from "@shared/schema";

interface MeetingWithRegistrations extends Meeting {
  registrationsCount: number;
  registrations?: MeetingRegistration[];
}

const meetingFormSchema = z.object({
  title: z.string().min(3, "Minimum 3 caracteres"),
  description: z.string().optional(),
  dateTime: z.string().min(1, "Date requise"),
  location: z.string().min(3, "Minimum 3 caracteres"),
  capacity: z.string().optional(),
  domainId: z.string().optional(),
});

type MeetingForm = z.infer<typeof meetingFormSchema>;

export default function AdminMeetings() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { session, tenant, user, electedOfficial, accountBlocked, blockReason, hasMenuAccess } = useAdminSession(params.slug);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithRegistrations | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);

  const { data: meetings, isLoading } = useQuery<MeetingWithRegistrations[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "meetings", { showArchived }],
    queryFn: async () => {
      const response = await fetch(`/api/tenants/${params.slug}/admin/meetings?includeArchived=${showArchived}`);
      if (!response.ok) throw new Error("Failed to fetch meetings");
      return response.json();
    },
    enabled: !!session,
  });

  const { data: meetingDetail } = useQuery<MeetingWithRegistrations>({
    queryKey: ["/api/tenants", params.slug, "admin", "meetings", selectedMeeting?.id],
    enabled: !!selectedMeeting?.id,
  });

  const { data: domains = [] } = useQuery<GlobalMunicipalityDomain[]>({
    queryKey: ["/api/public/municipality-domains"],
  });

  const form = useForm<MeetingForm>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dateTime: "",
      location: "",
      capacity: "",
      domainId: "",
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: MeetingForm) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/meetings`, {
        title: data.title,
        description: data.description || null,
        dateTime: new Date(data.dateTime).toISOString(),
        location: data.location,
        capacity: data.capacity ? parseInt(data.capacity) : null,
        domainId: data.domainId || null,
        status: "SCHEDULED",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/tenants" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "stats"] });
      setShowNewDialog(false);
      form.reset();
      toast({
        title: "Reunion creee",
        description: "La reunion a ete planifiee avec succes.",
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
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/meetings/${meetingId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/tenants" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "stats"] });
      setSelectedMeeting(null);
      toast({
        title: "Statut mis a jour",
        description: "Le statut de la reunion a ete modifie.",
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
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/meetings/${meetingId}/archive`, { isArchived });
    },
    onSuccess: (_, { isArchived }) => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/tenants" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "meetings"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "stats"] });
      setSelectedMeeting(null);
      toast({
        title: isArchived ? "Reunion archivee" : "Reunion restauree",
        description: isArchived 
          ? "La reunion a ete archivee avec succes." 
          : "La reunion a ete restauree avec succes.",
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

  const filteredMeetings = meetings?.filter((meeting) => {
    return !searchQuery || 
      meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.location.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const onSubmit = (data: MeetingForm) => {
    createMeetingMutation.mutate(data);
  };

  const handleStatusChange = () => {
    if (selectedMeeting && newStatus) {
      updateStatusMutation.mutate({ meetingId: selectedMeeting.id, status: newStatus });
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (!hasMenuAccess("MEETINGS")) {
    return (
      <AdminLayout tenant={tenant || null} user={user} electedOfficial={electedOfficial} accountBlocked={accountBlocked} blockReason={blockReason}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
          <Lock className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Acces non autorise</h1>
          <p className="text-muted-foreground text-center max-w-md">
            Vous n'avez pas les permissions necessaires pour acceder a cette section.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout tenant={tenant || null} user={user} electedOfficial={electedOfficial} accountBlocked={accountBlocked} blockReason={blockReason}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-admin-meetings-title">
              Gestion des evenements
            </h1>
            <p className="text-muted-foreground mt-1">
              Planifiez et gerez vos reunions, matchs, spectacles et autres evenements.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowNewDialog(true)} data-testid="button-new-meeting">
            <Plus className="h-4 w-4" />
            Nouvel evenement
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
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
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Aucun evenement planifie</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead className="hidden lg:table-cell">Lieu</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Inscrits</TableHead>
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
                          {formatDate(new Date(meeting.dateTime))}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-xs truncate">
                          {meeting.location}
                        </TableCell>
                        <TableCell>
                          <StatusBadge type="meeting" status={meeting.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {meeting.registrationsCount}
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
                              data-testid={`button-edit-${meeting.id}`}
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

        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle reunion</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Reunion de quartier" {...field} data-testid="input-title" />
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
                      <FormLabel>Date et heure *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-datetime" />
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
                      <FormLabel>Lieu *</FormLabel>
                      <FormControl>
                        <Input placeholder="Salle des fetes" {...field} data-testid="input-location" />
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
                        <Input type="number" placeholder="50" {...field} data-testid="input-capacity" />
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
                      <FormLabel>Description (optionnel)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Ordre du jour..." {...field} data-testid="input-description" />
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
                          <SelectTrigger data-testid="select-domain">
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
                  <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMeetingMutation.isPending} data-testid="button-create">
                    {createMeetingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Creer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedMeeting?.title}</DialogTitle>
            </DialogHeader>
            {selectedMeeting && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <StatusBadge type="meeting" status={selectedMeeting.status} />
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(new Date(selectedMeeting.dateTime))}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {selectedMeeting.location}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {selectedMeeting.registrationsCount} inscrit(s)
                    {selectedMeeting.capacity && ` / ${selectedMeeting.capacity} places`}
                  </div>
                </div>
                {selectedMeeting.description && (
                  <p className="text-sm whitespace-pre-wrap">{selectedMeeting.description}</p>
                )}

                {meetingDetail?.registrations && meetingDetail.registrations.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Inscrits ({meetingDetail.registrations.length})</h4>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {meetingDetail.registrations.map((reg) => (
                        <div key={reg.id} className="text-sm p-2 bg-muted rounded">
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
                    <SelectTrigger data-testid="select-new-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Planifiee</SelectItem>
                      <SelectItem value="COMPLETED">Terminee</SelectItem>
                      <SelectItem value="CANCELLED">Annulee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedMeeting(null)}>
                Fermer
              </Button>
              <Button 
                onClick={handleStatusChange}
                disabled={updateStatusMutation.isPending || newStatus === selectedMeeting?.status}
                data-testid="button-save-status"
              >
                {updateStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
