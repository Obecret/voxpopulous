import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar, MapPin, Users, Clock, ArrowLeft, Ticket, ExternalLink, ChevronLeft, ChevronRight, UserPlus, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Tenant, TenantEvent, GlobalEventType } from "@shared/schema";

// Helper to normalize GCS URLs to local /objects/ paths
function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/objects/')) return url;
  if (url.startsWith('https://storage.googleapis.com/')) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const uploadsIndex = pathParts.findIndex(p => p === 'uploads');
      if (uploadsIndex >= 0) {
        return `/objects/${pathParts.slice(uploadsIndex).join('/')}`;
      }
    } catch {
      // fallback to original
    }
  }
  return url;
}

interface EventWithRegistrations extends TenantEvent {
  totalRegistrations?: number;
}

interface EventImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export default function EventDetail() {
  const params = useParams<{ slug: string; eventId: string }>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: event, isLoading } = useQuery<EventWithRegistrations>({
    queryKey: ["/api/tenants", params.slug, "events", params.eventId],
  });

  const registrationMutation = useMutation({
    mutationFn: async (data: { fullName: string; email: string; phone?: string; numberOfGuests: number; comment?: string }) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/events/${params.eventId}/register`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "events", params.eventId] });
      setShowRegistrationDialog(false);
      setFullName("");
      setEmail("");
      setPhone("");
      setComment("");
      setNumberOfGuests(1);
      toast({
        title: "Inscription confirmee",
        description: "Votre reservation a bien ete enregistree.",
      });
      // If there's a booking URL, redirect to it
      if (event?.bookingUrl) {
        window.open(event.bookingUrl, "_blank");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'inscription.",
        variant: "destructive",
      });
    },
  });

  const { data: eventTypes } = useQuery<GlobalEventType[]>({
    queryKey: ["/api/public/event-types"],
  });

  const { data: eventImages } = useQuery<EventImage[]>({
    queryKey: ["/api/public/tenants", params.slug, "events", params.eventId, "images"],
    enabled: !!event,
  });

  const eventType = event?.eventTypeId 
    ? eventTypes?.find(t => t.id === event.eventTypeId) 
    : null;

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const allImages = [
    ...(event?.posterUrl ? [{ id: 'poster', imageUrl: normalizeImageUrl(event.posterUrl) || event.posterUrl, sortOrder: -1 }] : []),
    ...(eventImages?.map(img => ({ ...img, imageUrl: normalizeImageUrl(img.imageUrl) || img.imageUrl })) || [])
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleSubmitRegistration = () => {
    if (!fullName.trim() || !email.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir votre nom et email.",
        variant: "destructive",
      });
      return;
    }
    registrationMutation.mutate({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      numberOfGuests,
      comment: comment.trim() || undefined,
    });
  };

  const nextImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }
  };

  const prevImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    }
  };

  if (isLoading) {
    return (
      <TenantLayout tenant={tenant || null}>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </TenantLayout>
    );
  }

  if (!event) {
    return (
      <TenantLayout tenant={tenant || null}>
        <div className="mx-auto max-w-4xl px-4 py-8 text-center">
          <h1 className="font-display text-2xl font-bold mb-4">Evenement non trouve</h1>
          <Link href={`/structures/${params.slug}/events`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour aux evenements
            </Button>
          </Link>
        </div>
      </TenantLayout>
    );
  }

  const eventDate = new Date(event.startDate);
  const isPast = eventDate < new Date() || event.isArchived;
  const remainingPlaces = event?.capacity !== null && event?.capacity !== undefined ? event.capacity - (event.totalRegistrations || 0) : null;
  const isFull = remainingPlaces !== null && remainingPlaces <= 0;
  const canRegister = event?.capacity !== null && !isFull && !isPast;
  const maxGuestsAllowed = remainingPlaces !== null ? Math.min(10, remainingPlaces) : 10;

  return (
    <TenantLayout tenant={tenant || null}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/structures/${params.slug}/events`}>
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Retour aux evenements
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {allImages.length > 0 && (
            <div className="space-y-4">
              <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden">
                <img
                  src={allImages[currentImageIndex]?.imageUrl}
                  alt={`${event.title} - Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                  data-testid="img-event-main"
                />
                {allImages.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                      onClick={prevImage}
                      data-testid="button-prev-image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={nextImage}
                      data-testid="button-next-image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {allImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentImageIndex ? "bg-white" : "bg-white/50"
                          }`}
                          data-testid={`button-dot-${index}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {allImages.map((img, index) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`shrink-0 w-16 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                        index === currentImageIndex ? "border-primary" : "border-transparent"
                      }`}
                      data-testid={`button-thumbnail-${index}`}
                    >
                      <img
                        src={img.imageUrl}
                        alt={`Miniature ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-6">
            <div>
              {eventType && (
                <Badge 
                  variant="outline" 
                  className="mb-3"
                  style={{ 
                    borderColor: eventType.color || undefined,
                    color: eventType.color || undefined
                  }}
                >
                  {eventType.name}
                </Badge>
              )}
              <h1 className="font-display text-3xl font-bold" data-testid="text-event-title">
                {event.title}
              </h1>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="h-5 w-5 shrink-0" />
                <span>{formatDate(event.startDate)}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5 shrink-0" />
                <span>{formatTime(event.startDate)}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="h-5 w-5 shrink-0" />
                <span>{event.location}</span>
              </div>
              {event.capacity !== null && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">
                      {event.totalRegistrations || 0} / {event.capacity} places
                    </span>
                    {remainingPlaces !== null && remainingPlaces > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {remainingPlaces} disponible{remainingPlaces > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {isFull && (
                      <Badge variant="destructive" className="text-xs">Complet</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-event-description">
                  {event.description}
                </p>
              </div>
            )}

            {canRegister && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">Reservez votre place</h3>
                      <p className="text-sm text-muted-foreground">
                        Indiquez le nombre de personnes pour votre reservation
                      </p>
                    </div>
                    <Button 
                      className="gap-2" 
                      onClick={() => setShowRegistrationDialog(true)}
                      data-testid="button-book"
                    >
                      <UserPlus className="h-4 w-4" />
                      Reserver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {event.bookingUrl && !canRegister && !isPast && !isFull && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">Reservez votre place</h3>
                      <p className="text-sm text-muted-foreground">
                        Cliquez pour acceder au site de reservation
                      </p>
                    </div>
                    <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer">
                      <Button className="gap-2" data-testid="button-book-external">
                        <Ticket className="h-4 w-4" />
                        Reserver
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {isFull && !isPast && (
              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="p-4 text-center">
                  <Badge variant="destructive" className="text-base py-2 px-4">
                    Evenement complet
                  </Badge>
                </CardContent>
              </Card>
            )}

            {isPast && (
              <Badge variant="secondary" className="text-base py-2 px-4">
                Evenement passe
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showRegistrationDialog} onOpenChange={setShowRegistrationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reservation pour {event.title}</DialogTitle>
            <DialogDescription>
              Remplissez vos informations pour reserver votre place.
              {remainingPlaces !== null && (
                <span className="block mt-1 font-medium">
                  {remainingPlaces} place{remainingPlaces > 1 ? 's' : ''} disponible{remainingPlaces > 1 ? 's' : ''}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="numberOfGuests">Nombre de personnes</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setNumberOfGuests(Math.max(1, numberOfGuests - 1))}
                  disabled={numberOfGuests <= 1}
                  data-testid="button-decrease-guests"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-2xl font-bold w-12 text-center" data-testid="text-guests-count">
                  {numberOfGuests}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setNumberOfGuests(Math.min(maxGuestsAllowed, numberOfGuests + 1))}
                  disabled={numberOfGuests >= maxGuestsAllowed}
                  data-testid="button-increase-guests"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                data-testid="input-fullname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean@example.com"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telephone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                data-testid="input-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Commentaire</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Remarques ou besoins particuliers..."
                rows={3}
                data-testid="input-comment"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowRegistrationDialog(false)}
              data-testid="button-cancel-registration"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleSubmitRegistration}
              disabled={registrationMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-registration"
            >
              {registrationMutation.isPending ? (
                "Envoi..."
              ) : (
                <>
                  Confirmer ({numberOfGuests} personne{numberOfGuests > 1 ? 's' : ''})
                  {event.bookingUrl && <ExternalLink className="h-3 w-3" />}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}
