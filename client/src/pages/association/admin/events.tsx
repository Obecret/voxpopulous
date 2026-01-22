import { useState } from "react";
import { useParams } from "wouter";
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
import { Search, Plus, Pencil, Calendar, MapPin, Loader2, Archive, ArchiveRestore, Ticket, Image, ExternalLink, Upload, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { Association, AssociationUser, AssociationEvent, GlobalAssociationDomain, GlobalEventType } from "@shared/schema";

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

const eventFormSchema = z.object({
  title: z.string().min(3, "Minimum 3 caracteres"),
  description: z.string().optional(),
  eventTypeId: z.string().min(1, "Type d'evenement requis"),
  isMultiDay: z.boolean().default(false),
  startDate: z.string().min(1, "Date de debut requise"),
  endDate: z.string().optional(),
  location: z.string().min(3, "Minimum 3 caracteres"),
  domainId: z.string().optional(),
  posterUrl: z.string().optional(),
  bookingUrl: z.string().optional(),
  capacity: z.number().optional(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

export default function AssociationAdminEvents() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AssociationEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [editImages, setEditImages] = useState<string[]>([]);

  const { data, isLoading: userLoading, error } = useQuery<{ user: SafeAssociationUser; association: Association }>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug, "me"],
    retry: false,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<AssociationEvent[]>({
    queryKey: ["/api/associations", data?.association?.id, "admin", "events", { showArchived }],
    queryFn: async () => {
      const response = await fetch(`/api/associations/${data?.association?.id}/admin/events?includeArchived=${showArchived}`);
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
    enabled: !!data?.association?.id,
  });

  const { data: domains = [] } = useQuery<GlobalAssociationDomain[]>({
    queryKey: ["/api/public/association-domains"],
  });

  const { data: eventTypes = [] } = useQuery<GlobalEventType[]>({
    queryKey: ["/api/public/event-types"],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      eventTypeId: "",
      isMultiDay: false,
      startDate: "",
      endDate: "",
      location: "",
      domainId: "",
      posterUrl: "",
      bookingUrl: "",
      capacity: undefined,
    },
  });

  const watchEventTypeId = form.watch("eventTypeId");
  const selectedEventType = eventTypes.find(t => t.id === watchEventTypeId);
  const watchIsMultiDay = form.watch("isMultiDay");

  const editForm = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      eventTypeId: "",
      isMultiDay: false,
      startDate: "",
      endDate: "",
      location: "",
      domainId: "",
      posterUrl: "",
      bookingUrl: "",
      capacity: undefined,
    },
  });

  const watchEditEventTypeId = editForm.watch("eventTypeId");
  const editEventType = eventTypes.find(t => t.id === watchEditEventTypeId);
  const watchEditIsMultiDay = editForm.watch("isMultiDay");

  const openEditDialog = async (event: AssociationEvent) => {
    setSelectedEvent(event);
    setIsEditing(true);
    const startDateLocal = new Date(event.startDate).toISOString().slice(0, 16);
    const endDateLocal = event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : "";
    editForm.reset({
      title: event.title,
      description: event.description ?? "",
      eventTypeId: event.eventTypeId ?? "",
      isMultiDay: event.isMultiDay ?? false,
      startDate: startDateLocal,
      endDate: endDateLocal,
      location: event.location,
      domainId: event.domainId ?? "",
      posterUrl: event.posterUrl ?? "",
      bookingUrl: event.bookingUrl ?? "",
      capacity: event.capacity ?? undefined,
    });
    try {
      const response = await fetch(`/api/associations/${data?.association?.id}/admin/events/${event.id}/images`);
      if (response.ok) {
        const images = await response.json();
        setEditImages(images.map((img: { imageUrl: string }) => img.imageUrl));
      } else {
        setEditImages([]);
      }
    } catch (error) {
      console.error("Error loading event images:", error);
      setEditImages([]);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: EventFormData & { images?: string[] }) => {
      const response = await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/events`, {
        title: values.title,
        description: values.description || null,
        eventTypeId: values.eventTypeId,
        isMultiDay: values.isMultiDay,
        startDate: new Date(values.startDate).toISOString(),
        endDate: values.isMultiDay && values.endDate ? new Date(values.endDate).toISOString() : null,
        location: values.location,
        domainId: values.domainId || null,
        posterUrl: values.posterUrl || null,
        bookingUrl: values.bookingUrl || null,
        capacity: values.capacity || null,
        status: "SCHEDULED",
      });
      const event = await response.json();
      if (values.images && values.images.length > 0) {
        for (let i = 0; i < values.images.length; i++) {
          await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/events/${event.id}/images`, {
            imageUrl: values.images[i],
            sortOrder: i,
          });
        }
      }
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/associations" &&
          query.queryKey[2] === "admin" &&
          query.queryKey[3] === "events"
      });
      setIsCreating(false);
      setUploadedImages([]);
      form.reset();
      toast({
        title: "Evenement cree",
        description: "L'evenement a ete planifie avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la creation.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ eventId, values, images }: { eventId: string; values: EventFormData; images?: string[] }) => {
      await apiRequest("PUT", `/api/associations/${data?.association?.id}/admin/events/${eventId}`, {
        title: values.title,
        description: values.description || null,
        eventTypeId: values.eventTypeId,
        isMultiDay: values.isMultiDay,
        startDate: new Date(values.startDate).toISOString(),
        endDate: values.isMultiDay && values.endDate ? new Date(values.endDate).toISOString() : null,
        location: values.location,
        domainId: values.domainId || null,
        posterUrl: values.posterUrl || null,
        bookingUrl: values.bookingUrl || null,
        capacity: values.capacity || null,
      });
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/events/${eventId}/images`, {
            imageUrl: images[i],
            sortOrder: i + 100,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/associations" &&
          query.queryKey[2] === "admin" &&
          query.queryKey[3] === "events"
      });
      setSelectedEvent(null);
      setIsEditing(false);
      setEditImages([]);
      toast({
        title: "Evenement mis a jour",
        description: "L'evenement a ete modifie avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la modification.",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ eventId, isArchived }: { eventId: string; isArchived: boolean }) => {
      return apiRequest("POST", `/api/associations/${data?.association?.id}/admin/events/${eventId}/archive`, { isArchived });
    },
    onSuccess: (_, { isArchived }) => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/associations" &&
          query.queryKey[2] === "admin" &&
          query.queryKey[3] === "events"
      });
      setSelectedEvent(null);
      setIsEditing(false);
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

  const filteredEvents = events?.filter((event) => {
    return !searchQuery ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const onSubmit = (values: EventFormData) => {
    createMutation.mutate({ ...values, images: uploadedImages });
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatDateRange = (startDate: Date | string, endDate?: Date | string | null) => {
    const start = formatDate(startDate);
    if (!endDate) return start;
    const end = formatDate(endDate);
    return `${start} - ${end}`;
  };

  if (userLoading) {
    return (
      <AssociationAdminLayout association={null} user={null} tenantSlug={params.slug}>
        <div className="p-6">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AssociationAdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AssociationAdminLayout association={null} user={null} tenantSlug={params.slug}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
          <h1 className="font-display text-2xl font-bold mb-2">Session expiree</h1>
          <p className="text-muted-foreground">Veuillez vous reconnecter.</p>
        </div>
      </AssociationAdminLayout>
    );
  }

  return (
    <AssociationAdminLayout association={data.association} user={data.user} tenantSlug={params.slug}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-association-events-title">
              Agenda des evenements
            </h1>
            <p className="text-muted-foreground mt-1">
              Planifiez et gerez vos spectacles, manifestations et evenements.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsCreating(true)} data-testid="button-new-event">
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
            {eventsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                      const eventType = eventTypes.find(t => t.id === event.eventTypeId);
                      return (
                      <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">
                          <div className="flex items-center gap-2">
                            {eventType?.hasPoster && (
                              <Ticket className="h-4 w-4 text-primary shrink-0" />
                            )}
                            {event.title}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatDateRange(event.startDate, event.endDate)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-xs truncate">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {eventType?.name || "Standard"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge type="event" status={event.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(event)}
                              data-testid={`button-edit-${event.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => archiveMutation.mutate({ eventId: event.id, isArchived: !event.isArchived })}
                              disabled={archiveMutation.isPending}
                              title={event.isArchived ? "Restaurer" : "Archiver"}
                              data-testid={`button-archive-${event.id}`}
                            >
                              {event.isArchived ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
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

        <Dialog open={isCreating} onOpenChange={(open) => {
          setIsCreating(open);
          if (!open) setUploadedImages([]);
        }}>
          <DialogContent 
            className="max-w-4xl max-h-[85vh] overflow-y-auto"
            style={selectedEventType?.color ? { 
              borderTop: `4px solid ${selectedEventType.color}`,
              background: `linear-gradient(to bottom, ${selectedEventType.color}10 0%, transparent 100px)`
            } : undefined}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedEventType?.color && (
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: selectedEventType.color }}
                  />
                )}
                Nouvel evenement
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titre</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Assemblee generale" {...field} data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="eventTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type d'evenement</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-event-type">
                                <SelectValue placeholder="Selectionner un type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {eventTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  <span className="flex items-center gap-2">
                                    {type.color && (
                                      <span 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: type.color }}
                                      />
                                    )}
                                    {type.name}
                                  </span>
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
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lieu</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Salle polyvalente" {...field} data-testid="input-location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedEventType?.hasMultiDay && (
                      <FormField
                        control={form.control}
                        name="isMultiDay"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-multi-day"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Evenement sur plusieurs jours</FormLabel>
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{selectedEventType?.hasMultiDay && watchIsMultiDay ? "Date de debut" : "Date"}</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} data-testid="input-start-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedEventType?.hasMultiDay && watchIsMultiDay && (
                        <FormField
                          control={form.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date de fin</FormLabel>
                              <FormControl>
                                <Input type="datetime-local" {...field} data-testid="input-end-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {domains.length > 0 && (
                      <FormField
                        control={form.control}
                        name="domainId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Domaine</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-domain">
                                  <SelectValue placeholder="Selectionner un domaine" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {domains.map((domain) => (
                                  <SelectItem key={domain.id} value={domain.id}>
                                    {domain.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {selectedEventType?.hasCapacity && (
                      <FormField
                        control={form.control}
                        name="capacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacite</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="Nombre de places" 
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                data-testid="input-capacity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {selectedEventType?.hasBookingUrl && (
                      <FormField
                        control={form.control}
                        name="bookingUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL de reservation</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://..."
                                {...field}
                                data-testid="input-booking-url"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Description de l'evenement..."
                              className="resize-none min-h-[120px]"
                              {...field}
                              data-testid="input-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label>Photos de l'evenement</Label>
                      <div className="border rounded-lg p-3 bg-muted/30">
                        {uploadedImages.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {uploadedImages.map((url, index) => (
                              <div key={index} className="relative group">
                                <img 
                                  src={url} 
                                  alt={`Image ${index + 1}`} 
                                  className="w-full h-20 object-cover rounded-md"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== index))}
                                  data-testid={`button-remove-image-${index}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <ObjectUploader
                          onGetUploadUrl={async () => {
                            const response = await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/photos/upload-url`);
                            return response.json();
                          }}
                          onComplete={(objectPath) => {
                            setUploadedImages(prev => [...prev, objectPath]);
                          }}
                          accept="image/*"
                          compressImages={true}
                          maxImageWidth={1920}
                          maxImageHeight={1080}
                        >
                          <Button type="button" variant="outline" size="sm" className="w-full" data-testid="button-upload-image">
                            <Upload className="h-4 w-4 mr-2" />
                            Ajouter une photo
                          </Button>
                        </ObjectUploader>
                        <p className="text-xs text-muted-foreground mt-2">
                          Ajoutez des photos pour illustrer l'evenement (affiche, lieu, etc.)
                        </p>
                      </div>
                    </div>

                    {selectedEventType?.hasPoster && (
                      <FormField
                        control={form.control}
                        name="posterUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL de l'affiche (externe)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://..."
                                {...field}
                                data-testid="input-poster-url"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Creer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditing && !!selectedEvent} onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null);
            setIsEditing(false);
            setEditImages([]);
          }
        }}>
          <DialogContent 
            className="max-w-4xl max-h-[85vh] overflow-y-auto"
            style={editEventType?.color ? { 
              borderTop: `4px solid ${editEventType.color}`,
              background: `linear-gradient(to bottom, ${editEventType.color}10 0%, transparent 100px)`
            } : undefined}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editEventType?.color && (
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: editEventType.color }}
                  />
                )}
                Modifier l'evenement
              </DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit((values) => {
                  updateMutation.mutate({ eventId: selectedEvent.id, values, images: editImages });
                })} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <FormField
                        control={editForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Titre</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Assemblee generale" {...field} data-testid="edit-input-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="eventTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type d'evenement</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="edit-select-event-type">
                                  <SelectValue placeholder="Selectionner un type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {eventTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id}>
                                    <span className="flex items-center gap-2">
                                      {type.color && (
                                        <span 
                                          className="w-2 h-2 rounded-full" 
                                          style={{ backgroundColor: type.color }}
                                        />
                                      )}
                                      {type.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lieu</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Salle polyvalente" {...field} data-testid="edit-input-location" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {editEventType?.hasMultiDay && (
                        <FormField
                          control={editForm.control}
                          name="isMultiDay"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="edit-switch-multi-day"
                                />
                              </FormControl>
                              <FormLabel className="!mt-0">Evenement sur plusieurs jours</FormLabel>
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{editEventType?.hasMultiDay && watchEditIsMultiDay ? "Date de debut" : "Date"}</FormLabel>
                              <FormControl>
                                <Input type="datetime-local" {...field} data-testid="edit-input-start-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {editEventType?.hasMultiDay && watchEditIsMultiDay && (
                          <FormField
                            control={editForm.control}
                            name="endDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Date de fin</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" {...field} data-testid="edit-input-end-date" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      {domains.length > 0 && (
                        <FormField
                          control={editForm.control}
                          name="domainId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Domaine</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="edit-select-domain">
                                    <SelectValue placeholder="Selectionner un domaine" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {domains.map((domain) => (
                                    <SelectItem key={domain.id} value={domain.id}>
                                      {domain.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {editEventType?.hasCapacity && (
                        <FormField
                          control={editForm.control}
                          name="capacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Capacite</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  placeholder="Nombre de places" 
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                  data-testid="edit-input-capacity"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {editEventType?.hasBookingUrl && (
                        <FormField
                          control={editForm.control}
                          name="bookingUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL de reservation</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://..." 
                                  {...field} 
                                  data-testid="edit-input-booking-url"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={editForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Description de l'evenement..." 
                                className="resize-none min-h-[120px]" 
                                {...field} 
                                data-testid="edit-input-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <Label>Ajouter des photos</Label>
                        <div className="border rounded-lg p-3 bg-muted/30">
                          {editImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {editImages.map((url, index) => (
                                <div key={index} className="relative group">
                                  <img 
                                    src={url} 
                                    alt={`Image ${index + 1}`} 
                                    className="w-full h-20 object-cover rounded-md"
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setEditImages(prev => prev.filter((_, i) => i !== index))}
                                    data-testid={`edit-button-remove-image-${index}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <ObjectUploader
                            onGetUploadUrl={async () => {
                              const response = await apiRequest("POST", `/api/associations/${data?.association?.id}/admin/photos/upload-url`);
                              return response.json();
                            }}
                            onComplete={(objectPath) => {
                              setEditImages(prev => [...prev, objectPath]);
                            }}
                            accept="image/*"
                            compressImages={true}
                            maxImageWidth={1920}
                            maxImageHeight={1080}
                          >
                            <Button type="button" variant="outline" size="sm" className="w-full" data-testid="edit-button-upload-image">
                              <Upload className="h-4 w-4 mr-2" />
                              Ajouter une photo
                            </Button>
                          </ObjectUploader>
                        </div>
                      </div>

                      {editEventType?.hasPoster && (
                        <FormField
                          control={editForm.control}
                          name="posterUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL de l'affiche (externe)</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://..." 
                                  {...field} 
                                  data-testid="edit-input-poster-url"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => archiveMutation.mutate({ 
                        eventId: selectedEvent.id, 
                        isArchived: !selectedEvent.isArchived 
                      })}
                      disabled={archiveMutation.isPending}
                    >
                      {selectedEvent.isArchived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restaurer
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Archiver
                        </>
                      )}
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        setSelectedEvent(null);
                        setIsEditing(false);
                        setEditImages([]);
                      }}>
                        Annuler
                      </Button>
                      <Button type="submit" disabled={updateMutation.isPending} data-testid="edit-button-submit">
                        {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Enregistrer
                      </Button>
                    </div>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AssociationAdminLayout>
  );
}
