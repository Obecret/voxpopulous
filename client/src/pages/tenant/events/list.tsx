import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Users, Clock, ArrowRight, Ticket, ExternalLink } from "lucide-react";
import type { Tenant, TenantEvent, GlobalEventType } from "@shared/schema";

interface TenantEventWithType extends TenantEvent {
  eventType?: GlobalEventType;
  registrationsCount?: number;
}

export default function EventsList() {
  const params = useParams<{ slug: string }>();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: events, isLoading } = useQuery<TenantEventWithType[]>({
    queryKey: ["/api/tenants", params.slug, "events"],
  });

  const { data: eventTypes } = useQuery<EventType[]>({
    queryKey: ["/api/public/event-types"],
  });

  const now = new Date();
  const upcomingEvents = events?.filter(
    (e) => !e.isArchived && new Date(e.startDate) >= now
  ) || [];
  const pastEvents = events?.filter(
    (e) => e.isArchived || new Date(e.startDate) < now
  ) || [];

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

  const getEventType = (eventTypeId: string | null) => {
    if (!eventTypeId) return null;
    return eventTypes?.find(t => t.id === eventTypeId);
  };

  const EventCard = ({ event }: { event: TenantEventWithType }) => {
    const eventDate = new Date(event.startDate);
    const isPast = eventDate < now || event.isArchived;
    const eventType = getEventType(event.eventTypeId);
    const isFull = event.capacity !== null && (event.registrationsCount || 0) >= event.capacity;

    return (
      <Card 
        className={`hover-elevate ${isPast ? "opacity-75" : ""}`} 
        data-testid={`card-event-${event.id}`}
        style={eventType?.color ? { borderLeft: `4px solid ${eventType.color}` } : undefined}
      >
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div 
              className="flex items-center justify-center w-16 h-16 rounded-lg shrink-0"
              style={{ 
                backgroundColor: eventType?.color ? `${eventType.color}20` : undefined,
                color: eventType?.color || undefined
              }}
            >
              <div className="text-center">
                <div className="text-2xl font-bold leading-none">{eventDate.getDate()}</div>
                <div className="text-xs uppercase mt-0.5">
                  {eventDate.toLocaleDateString("fr-FR", { month: "short" })}
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{event.title}</h3>
                  {eventType && (
                    <Badge 
                      variant="outline" 
                      className="mt-1"
                      style={{ 
                        borderColor: eventType.color || undefined,
                        color: eventType.color || undefined
                      }}
                    >
                      {eventType.name}
                    </Badge>
                  )}
                </div>
                {isFull && (
                  <Badge variant="secondary">Complet</Badge>
                )}
              </div>
              {event.description && (
                <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                  {event.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(event.startDate)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{event.location}</span>
                </div>
                {event.capacity && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>
                      {event.registrationsCount || 0} / {event.capacity} places
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:ml-4 flex flex-col gap-2">
              {event.bookingUrl && !isPast && (
                <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer">
                  <Button 
                    variant="default" 
                    className="gap-2 w-full lg:w-auto"
                    data-testid={`button-book-${event.id}`}
                  >
                    <Ticket className="h-4 w-4" />
                    Reserver
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              )}
              {event.posterUrl && (
                <a href={event.posterUrl} target="_blank" rel="noopener noreferrer">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2 w-full lg:w-auto"
                    data-testid={`button-poster-${event.id}`}
                  >
                    Voir l'affiche
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <TenantLayout tenant={tenant || null}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold" data-testid="text-events-title">
            Evenements
          </h1>
          <p className="text-muted-foreground mt-1">
            Decouvrez les prochains evenements, spectacles, conferences et reunions.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-16 w-16 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList className="mb-6">
              <TabsTrigger value="upcoming" className="gap-2">
                <Calendar className="h-4 w-4" />
                A venir ({upcomingEvents.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="gap-2">
                Passes ({pastEvents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              {upcomingEvents.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Aucun evenement a venir</h3>
                    <p className="text-muted-foreground">
                      Revenez bientot pour decouvrir les prochains evenements.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents
                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                    .map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              {pastEvents.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Aucun evenement passe</h3>
                    <p className="text-muted-foreground">
                      Les evenements passes s'afficheront ici.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {pastEvents
                    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                    .map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TenantLayout>
  );
}
