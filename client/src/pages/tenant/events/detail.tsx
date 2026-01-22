import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users, Clock, ArrowLeft, Ticket, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Tenant, TenantEvent, GlobalEventType } from "@shared/schema";

interface EventImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export default function EventDetail() {
  const params = useParams<{ slug: string; eventId: string }>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: event, isLoading } = useQuery<TenantEvent>({
    queryKey: ["/api/tenants", params.slug, "events", params.eventId],
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
    ...(event?.posterUrl ? [{ id: 'poster', imageUrl: event.posterUrl, sortOrder: -1 }] : []),
    ...(eventImages || [])
  ].sort((a, b) => a.sortOrder - b.sortOrder);

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
              {event.capacity && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Users className="h-5 w-5 shrink-0" />
                  <span>{event.capacity} places</span>
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

            {event.bookingUrl && !isPast && (
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
                      <Button className="gap-2" data-testid="button-book">
                        <Ticket className="h-4 w-4" />
                        Reserver
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
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
    </TenantLayout>
  );
}
