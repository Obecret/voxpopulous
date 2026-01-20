import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, MapPin, Users, Clock, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { Tenant, Association, AssociationMeeting } from "@shared/schema";

interface PublicRegistration {
  id: string;
  fullName: string;
  createdAt: string;
}

interface MeetingWithRegistrations extends AssociationMeeting {
  registrationsCount: number;
}

const registrationFormSchema = z.object({
  fullName: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  email: z.string().email("Email invalide"),
});

type RegistrationForm = z.infer<typeof registrationFormSchema>;

export default function AssociationMeetingDetail() {
  const params = useParams<{ slug: string; assocSlug: string; id: string }>();
  const { toast } = useToast();
  const [registered, setRegistered] = useState(false);
  const [showRegistrations, setShowRegistrations] = useState(false);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const { data: meeting, isLoading, error } = useQuery<MeetingWithRegistrations>({
    queryKey: ["/api/associations", association?.id, "meetings", params.id],
    enabled: !!association?.id && !!params.id,
  });

  const { data: registrations, isLoading: loadingRegistrations } = useQuery<PublicRegistration[]>({
    queryKey: ["/api/associations", association?.id, "meetings", params.id, "registrations"],
    enabled: showRegistrations && !!association?.id && !!params.id,
  });

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationForm) => {
      const response = await apiRequest(
        "POST",
        `/api/associations/${association?.id}/meetings/${params.id}/register`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      setRegistered(true);
      queryClient.invalidateQueries({ 
        queryKey: ["/api/associations", association?.id, "meetings", params.id] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegistrationForm) => {
    registerMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <AssociationLayout association={association || null} tenant={tenant || null}>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AssociationLayout>
    );
  }

  if (error || !meeting) {
    return (
      <AssociationLayout association={association || null} tenant={tenant || null}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Evenement non trouve</h1>
          <p className="text-muted-foreground mb-6">
            Cet evenement n'existe pas ou a ete supprime.
          </p>
          <Link href={`/structures/${params.slug}/${params.assocSlug}/meetings`}>
            <Button variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux evenements
            </Button>
          </Link>
        </div>
      </AssociationLayout>
    );
  }

  const meetingDate = new Date(meeting.dateTime);
  const isPast = meetingDate < new Date() || meeting.status !== "SCHEDULED";
  const isFull = meeting.capacity !== null && meeting.registrationsCount >= meeting.capacity;

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

  return (
    <AssociationLayout association={association || null} tenant={tenant || null}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href={`/structures/${params.slug}/${params.assocSlug}/meetings`}>
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Retour aux evenements
          </Button>
        </Link>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-primary/10 text-primary shrink-0">
                <div className="text-center">
                  <div className="text-3xl font-bold leading-none">{meetingDate.getDate()}</div>
                  <div className="text-sm uppercase mt-0.5">
                    {meetingDate.toLocaleDateString("fr-FR", { month: "short" })}
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h1 className="font-display text-2xl font-bold" data-testid="text-meeting-title">
                    {meeting.title}
                  </h1>
                  <StatusBadge type="meeting" status={meeting.status} />
                </div>
                {meeting.description && (
                  <p className="text-muted-foreground mb-4">{meeting.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(meetingDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{formatTime(meetingDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{meeting.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {meeting.registrationsCount} inscrit(s)
                      {meeting.capacity && ` / ${meeting.capacity}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {meeting.registrationsCount > 0 && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setShowRegistrations(!showRegistrations)}
                data-testid="button-toggle-registrations"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Voir les inscrits ({meeting.registrationsCount})
                </span>
                {showRegistrations ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              {showRegistrations && (
                <div className="mt-3 space-y-2" data-testid="list-registrations">
                  {loadingRegistrations ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : registrations && registrations.length > 0 ? (
                    <ul className="space-y-2">
                      {registrations.map((reg) => (
                        <li key={reg.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm" data-testid={`text-registration-${reg.id}`}>
                            {reg.fullName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Aucun inscrit pour le moment
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {registered ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="font-semibold text-xl mb-2" data-testid="text-registration-success">
                Inscription confirmee !
              </h2>
              <p className="text-muted-foreground">
                Vous recevrez un email de confirmation avec tous les details.
              </p>
            </CardContent>
          </Card>
        ) : isPast ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="font-semibold text-xl mb-2">Evenement termine</h2>
              <p className="text-muted-foreground">
                Cet evenement est deja passe. Consultez les prochains evenements.
              </p>
            </CardContent>
          </Card>
        ) : isFull ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="font-semibold text-xl mb-2">Complet</h2>
              <p className="text-muted-foreground">
                Cet evenement a atteint sa capacite maximale d'inscrits.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>S'inscrire a l'evenement</CardTitle>
              <CardDescription>
                Remplissez le formulaire ci-dessous pour vous inscrire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Votre nom *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Jean Dupont" 
                            {...field} 
                            data-testid="input-fullname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Votre email *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="jean.dupont@email.com"
                            {...field} 
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={registerMutation.isPending}
                    data-testid="button-submit"
                  >
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmer mon inscription
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </AssociationLayout>
  );
}
