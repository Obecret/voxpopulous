import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Users, Clock, ArrowRight } from "lucide-react";
import type { Tenant, Association, AssociationMeeting } from "@shared/schema";

interface MeetingWithRegistrations extends AssociationMeeting {
  registrationsCount: number;
}

export default function AssociationMeetingsList() {
  const params = useParams<{ slug: string; assocSlug: string }>();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const { data: meetings, isLoading } = useQuery<MeetingWithRegistrations[]>({
    queryKey: ["/api/associations", association?.id, "meetings"],
    enabled: !!association?.id,
  });

  const now = new Date();
  const upcomingMeetings = meetings?.filter(
    (m) => m.status === "SCHEDULED" && new Date(m.dateTime) >= now
  ) || [];
  const pastMeetings = meetings?.filter(
    (m) => m.status !== "SCHEDULED" || new Date(m.dateTime) < now
  ) || [];

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const MeetingCard = ({ meeting }: { meeting: MeetingWithRegistrations }) => {
    const meetingDate = new Date(meeting.dateTime);
    const isPast = meetingDate < now || meeting.status !== "SCHEDULED";
    const isFull = meeting.capacity !== null && meeting.registrationsCount >= meeting.capacity;

    return (
      <Card className={`hover-elevate ${isPast ? "opacity-75" : ""}`} data-testid={`card-meeting-${meeting.id}`}>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 text-primary shrink-0">
              <div className="text-center">
                <div className="text-2xl font-bold leading-none">{meetingDate.getDate()}</div>
                <div className="text-xs uppercase mt-0.5">
                  {meetingDate.toLocaleDateString("fr-FR", { month: "short" })}
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-lg">{meeting.title}</h3>
                <StatusBadge type="meeting" status={meeting.status} />
              </div>
              {meeting.description && (
                <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                  {meeting.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(meetingDate)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{meeting.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>
                    {meeting.registrationsCount} inscrit(s)
                    {meeting.capacity && ` / ${meeting.capacity}`}
                  </span>
                </div>
              </div>
            </div>
            <div className="lg:ml-4">
              <Link href={`/structures/${params.slug}/${params.assocSlug}/meetings/${meeting.id}`}>
                <Button 
                  variant={isPast ? "outline" : "default"} 
                  className="gap-2 w-full lg:w-auto"
                  data-testid={`button-view-${meeting.id}`}
                >
                  {isPast ? "Voir les details" : isFull ? "Complet" : "S'inscrire"}
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
          <h1 className="font-display text-3xl font-bold" data-testid="text-meetings-title">
            Evenements et reunions
          </h1>
          <p className="text-muted-foreground mt-1">
            Participez aux evenements organises par l'association.
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
                A venir ({upcomingMeetings.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="gap-2">
                Passees ({pastMeetings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              {upcomingMeetings.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Aucun evenement a venir</h3>
                    <p className="text-muted-foreground">
                      Il n'y a pas d'evenement planifie pour le moment. Revenez bientot !
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {upcomingMeetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              {pastMeetings.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Aucun evenement passe</h3>
                    <p className="text-muted-foreground">
                      L'historique des evenements apparaitra ici.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {pastMeetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} />
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
