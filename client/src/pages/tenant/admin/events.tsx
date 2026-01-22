import { useState } from "react";
import { useParams } from "wouter";
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
import { Search, Plus, Eye, MapPin, Calendar, Loader2, Lock, Archive, ArchiveRestore, Ticket, Image, ExternalLink, Upload, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { TenantEvent, GlobalMunicipalityDomain, GlobalEventType } from "@shared/schema";

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

type EventForm = z.infer<typeof eventFormSchema>;

export default function AdminEvents() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { session, tenant, user, electedOfficial, accountBlocked, blockReason, hasMenuAccess } = useAdminSession(params.slug);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TenantEvent | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const { data: events, isLoading } = useQuery<TenantEvent[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "events", { showArchived }],
    queryFn: async () => {
      const response = await fetch(`/api/tenants/${params.slug}/admin/events?includeArchived=${showArchived}`);
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
    enabled: !!session,
  });

  const { data: domains = [] } = useQuery<GlobalMunicipalityDomain[]>({
    queryKey: ["/api/public/municipality-domains"],
  });

  const { data: eventTypes = [] } = useQuery<GlobalEventType[]>({
    queryKey: ["/api/public/event-types"],
  });

  const form = useForm<EventForm>({
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

  const createEventMutation = useMutation({
    mutationFn: async (data: EventForm & { images?: string[] }) => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/events`, {
        title: data.title,
        description: data.description || null,
        eventTypeId: data.eventTypeId,
        isMultiDay: data.isMultiDay,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.isMultiDay && data.endDate ? new Date(data.endDate).toISOString() : null,
        location: data.location,
        domainId: data.domainId || null,
        posterUrl: data.posterUrl || null,
        bookingUrl: data.bookingUrl || null,
        capacity: data.capacity || null,
        status: "SCHEDULED",
      });
      const event = await response.json();
      if (data.images && data.images.length > 0) {
        for (let i = 0; i < data.images.length; i++) {
          await apiRequest("POST", `/api/tenants/${params.slug}/admin/events/${event.id}/images`, {
            imageUrl: data.images[i],
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
          query.queryKey[0] === "/api/tenants" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "events"
      });
      setShowNewDialog(false);
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
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: Partial<EventForm> }) => {
      return apiRequest("PUT", `/api/tenants/${params.slug}/admin/events/${eventId}`, {
        ...data,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/tenants" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "events"
      });
      setSelectedEvent(null);
      toast({
        title: "Evenement mis a jour",
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

  const archiveMutation = useMutation({
    mutationFn: async ({ eventId, isArchived }: { eventId: string; isArchived: boolean }) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/events/${eventId}/archive`, { isArchived });
    },
    onSuccess: (_, { isArchived }) => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/tenants" && 
          query.queryKey[2] === "admin" && 
          query.queryKey[3] === "events"
      });
      setSelectedEvent(null);
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

  const onSubmit = (data: EventForm) => {
    createEventMutation.mutate({ ...data, images: uploadedImages });
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

  if (!hasMenuAccess("EVENTS")) {
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
            <h1 className="font-display text-3xl font-bold" data-testid="text-admin-events-title">
              Agenda des evenements
            </h1>
            <p className="text-muted-foreground mt-1">
              Planifiez et gerez vos spectacles, manifestations et evenements.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowNewDialog(true)} data-testid="button-new-event">
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
                              onClick={() => setSelectedEvent(event)}
                              data-testid={`button-edit-${event.id}`}
                            >
                              <Eye className="h-4 w-4" />
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

        <Dialog open={showNewDialog} onOpenChange={(open) => {
          setShowNewDialog(open);
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
                            <Input placeholder="Ex: Concert de Noel" {...field} data-testid="input-title" />
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
                            <Input placeholder="Ex: Salle des fetes" {...field} data-testid="input-location" />
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
                            const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/photos/upload-url`);
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
                  <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-submit">
                    {createEventMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Creer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Details de l'evenement</DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
                  {selectedEvent.description && (
                    <p className="text-muted-foreground mt-1">{selectedEvent.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p>{formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lieu:</span>
                    <p>{selectedEvent.location}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p>{eventTypes.find(t => t.id === selectedEvent.eventTypeId)?.name || "Standard"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Statut:</span>
                    <div className="mt-1">
                      <StatusBadge type="event" status={selectedEvent.status} />
                    </div>
                  </div>
                  {selectedEvent.capacity && (
                    <div>
                      <span className="text-muted-foreground">Capacite:</span>
                      <p>{selectedEvent.capacity} places</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedEvent.posterUrl && (
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      <a 
                        href={selectedEvent.posterUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Voir l'affiche
                      </a>
                    </div>
                  )}
                  {selectedEvent.bookingUrl && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      <a 
                        href={selectedEvent.bookingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Lien de reservation
                      </a>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button 
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
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
