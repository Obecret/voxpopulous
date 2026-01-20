import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, MapPin, Users, Clock, Lightbulb, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { Tenant, Meeting, Idea } from "@shared/schema";

interface PublicRegistration {
  id: string;
  fullName: string;
  createdAt: string;
}

interface MeetingDetail extends Meeting {
  registrationsCount: number;
  ideas: Idea[];
}

const registrationSchema = z.object({
  fullName: z.string().min(2, "Minimum 2 caracteres"),
  email: z.string().email("Email invalide"),
  comment: z.string().optional(),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export default function MeetingDetail() {
  const params = useParams<{ slug: string; id: string }>();
  const { toast } = useToast();
  const [showRegistrations, setShowRegistrations] = useState(false);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: meeting, isLoading, error } = useQuery<MeetingDetail>({
    queryKey: ["/api/tenants", params.slug, "meetings", params.id],
  });

  const { data: registrations, isLoading: loadingRegistrations } = useQuery<PublicRegistration[]>({
    queryKey: ["/api/tenants", params.slug, "meetings", params.id, "registrations"],
    enabled: showRegistrations && !!params.id,
  });

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      email: "",
      comment: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationForm) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/meetings/${params.id}/register`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "meetings", params.id] });
      form.reset();
      toast({
        title: "Inscription confirmee",
        description: "Vous etes inscrit a cette reunion. Un email de confirmation vous sera envoye.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegistrationForm) => {
    registerMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <TenantLayout tenant={tenant || null}>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-8 w-3/4 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </TenantLayout>
    );
  }

  if (error || !meeting) {
    return (
      <TenantLayout tenant={tenant || null}>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Reunion introuvable</h1>
          <p className="text-muted-foreground mb-6">
            Cette reunion n'existe pas ou a ete supprimee.
          </p>
          <Link href={`/structures/${params.slug}/meetings`}>
            <Button>Retour aux reunions</Button>
          </Link>
        </div>
      </TenantLayout>
    );
  }

  const meetingDate = new Date(meeting.dateTime);
  const now = new Date();
  const isPast = meetingDate < now || meeting.status !== "SCHEDULED";
  const isFull = meeting.capacity !== null && meeting.registrationsCount >= meeting.capacity;
  const canRegister = !isPast && !isFull;

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
    <TenantLayout tenant={tenant || null}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/structures/${params.slug}/meetings`}>
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Retour aux reunions
          </Button>
        </Link>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <StatusBadge type="meeting" status={meeting.status} />
                </div>
                <CardTitle className="text-2xl" data-testid="text-meeting-title">
                  {meeting.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">{formatDate(meetingDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Heure</p>
                      <p className="font-medium">{formatTime(meetingDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Lieu</p>
                      <p className="font-medium">{meeting.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Participants</p>
                      <p className="font-medium">
                        {meeting.registrationsCount} inscrit(s)
                        {meeting.capacity && ` / ${meeting.capacity} places`}
                      </p>
                    </div>
                  </div>
                </div>

                {meeting.description && (
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {meeting.description}
                    </p>
                  </div>
                )}

                {meeting.registrationsCount > 0 && (
                  <div className="pt-4 border-t">
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
                  </div>
                )}
              </CardContent>
            </Card>

            {meeting.ideas && meeting.ideas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Idees a l'ordre du jour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {meeting.ideas.map((idea) => (
                      <li key={idea.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{idea.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {idea.description}
                          </p>
                        </div>
                        <Link href={`/structures/${params.slug}/ideas/track/${idea.publicToken}`}>
                          <Button variant="ghost" size="sm">
                            Voir
                          </Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">
                  {isPast ? "Reunion terminee" : isFull ? "Complet" : "S'inscrire"}
                </CardTitle>
                {!isPast && !isFull && (
                  <CardDescription>
                    Remplissez le formulaire pour vous inscrire a cette reunion.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {isPast ? (
                  <div className="text-center py-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      Cette reunion a deja eu lieu.
                    </p>
                  </div>
                ) : isFull ? (
                  <div className="text-center py-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 mb-3">
                      <Users className="h-6 w-6 text-amber-600" />
                    </div>
                    <p className="text-muted-foreground">
                      Le nombre maximum de participants a ete atteint.
                    </p>
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom complet *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Jean Dupont" 
                                {...field} 
                                data-testid="input-name"
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
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="jean@exemple.fr" 
                                {...field} 
                                data-testid="input-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="comment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Commentaire (optionnel)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Question ou sujet que vous souhaitez aborder..."
                                {...field} 
                                data-testid="input-comment"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmer mon inscription
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
