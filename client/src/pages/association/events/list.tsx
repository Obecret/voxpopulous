import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import type { Tenant, Association, AssociationEvent, GlobalEventType } from "@shared/schema";

interface AssociationEventWithType extends AssociationEvent {
  eventType?: GlobalEventType;
  registrationsCount?: number;
}

export default function AssociationEventsList() {
  const params = useParams<{ slug: string; assocSlug: string }>();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/public/associations", params.slug, params.assocSlug],
  });

  const { data: events, isLoading } = useQuery<AssociationEventWithType[]>({
    queryKey: ["/api/public/associations", association?.id, "events"],
    enabled: !!association?.id,
  });

  const { data: eventTypes } = useQuery<GlobalEventType[]>({
    queryKey: ["/api/public/event-types"],
  });

  const now = new Date();
  const upcomingEvents = events?.filter(
    (e) => !e.isArchived && new Date(e.startDate) >= now
  ) || [];
  const pastEvents = events?.filter(
    (e) => e.isArchived || new Date(e.startDate) < now
  ) || [];

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

  const EventCard = ({ event }: { event: AssociationEventWithType }) => {
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
            <div className="flex items-start gap-3 shrink-0">
              {event.posterUrl && (
                <a href={normalizeImageUrl(event.posterUrl) || undefined} target="_blank" rel="noopener noreferrer" className="block shrink-0">
                  <img 
                    src={normalizeImageUrl(event.posterUrl) || undefined} 
                    alt={`Affiche ${event.title}`}
                    className="w-12 h-16 object-cover rounded-md shadow-sm hover:shadow-md transition-shadow"
                    data-testid={`img-poster-${event.id}`}
                  />
                </a>
              )}
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
              </div>
            </div>
            <div className="lg:ml-4">
              <Link href={`/structures/${params.slug}/${params.assocSlug}/events/${event.id}`}>
                <Button 
                  variant="outline" 
                  className="gap-2 w-full lg:w-auto"
                  data-testid={`button-view-event-${event.id}`}
                >
                  Voir l'evenement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AssociationLayout association={association || null} tenant={tenant || null}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold" data-testid="text-events-title">
            Evenements
          </h1>
          <p className="text-muted-foreground mt-1">
            Decouvrez les prochains evenements de l'association.
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
    </AssociationLayout>
  );
}
