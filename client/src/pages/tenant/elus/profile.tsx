import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Mail, MessageCircle, Send, Loader2, Building2, Briefcase } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, ElectedOfficial, GlobalMunicipalityDomain } from "@shared/schema";

type ElectedOfficialWithDomains = ElectedOfficial & { domains?: GlobalMunicipalityDomain[] };

function getPhotoUrl(photoObjectPath: string | null | undefined, photoUrl: string | null | undefined): string | undefined {
  if (photoObjectPath) {
    const parts = photoObjectPath.split('/');
    const uploadsIndex = parts.findIndex(p => p === 'uploads');
    if (uploadsIndex !== -1) {
      return '/objects/' + parts.slice(uploadsIndex).join('/');
    }
  }
  return photoUrl || undefined;
}

function getFunctionLevel(fn: string | null | undefined): "primary" | "secondary" | "tertiary" {
  if (!fn) return "tertiary";
  const lower = fn.toLowerCase();
  if (lower.includes("maire") && !lower.includes("adjoint")) return "primary";
  if (lower.includes("president") && !lower.includes("vice")) return "primary";
  if (lower.includes("adjoint") || lower.includes("vice")) return "secondary";
  return "tertiary";
}

function getFunctionColors(level: "primary" | "secondary" | "tertiary") {
  switch (level) {
    case "primary":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
        badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-800",
      };
    case "secondary":
      return {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
        badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800",
      };
    case "tertiary":
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        badge: "",
      };
  }
}

const contactFormSchema = z.object({
  requesterName: z.string().min(2, "Votre nom est requis"),
  requesterEmail: z.string().email("Email invalide"),
  subject: z.string().min(5, "Sujet trop court (minimum 5 caracteres)"),
  message: z.string().min(20, "Message trop court (minimum 20 caracteres)"),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function EluProfile() {
  const params = useParams<{ slug: string; id: string }>();
  const { toast } = useToast();
  const [isContactOpen, setIsContactOpen] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      requesterName: "",
      requesterEmail: "",
      subject: "",
      message: "",
    },
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: elu, isLoading } = useQuery<ElectedOfficialWithDomains>({
    queryKey: ["/api/tenants", params.slug, "elus", params.id],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      if (!tenant?.id) {
        throw new Error("Tenant non disponible");
      }
      const subjectType = tenant.tenantType === "EPCI" ? "EPCI_ELU" : "TENANT_ELU";
      const response = await apiRequest("POST", "/api/chat/threads", {
        subjectType,
        subjectId: params.id,
        tenantId: tenant.id,
        ...data,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message envoye",
        description: "Votre message a ete transmis. Vous recevrez une reponse par email.",
      });
      form.reset();
      setIsContactOpen(false);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer votre message. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (tenantLoading || isLoading) {
    return (
      <div className="min-h-screen flex flex-wrap items-center justify-center">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  if (!tenant || !elu) {
    return (
      <div className="min-h-screen flex flex-wrap items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" data-testid="text-profile-not-found">Profil introuvable</h1>
          <p className="text-muted-foreground mb-4">Ce profil n'existe pas.</p>
          <Link href={`/structures/${params.slug}/elus`} data-testid="link-back-list">
            <Button data-testid="button-back-list">Retour a la liste</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isAssociation = tenant.tenantType === "ASSOCIATION";
  const isEpci = tenant.tenantType === "EPCI";
  const level = getFunctionLevel(elu.function);
  const colors = getFunctionColors(level);

  const onSubmit = (data: ContactFormValues) => {
    sendMessageMutation.mutate(data);
  };

  return (
    <TenantLayout tenant={tenant}>
      <section className="py-12 md:py-16 bg-background">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-8">
            <Link href={`/structures/${params.slug}/elus`} data-testid="link-back">
              <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour a la liste
              </Button>
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:flex-wrap items-start gap-6">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={getPhotoUrl(elu.photoObjectPath, elu.photoUrl)} alt={`${elu.firstName} ${elu.lastName}`} />
                      <AvatarFallback className="text-3xl">{getInitials(elu.firstName, elu.lastName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h1 className="font-display text-3xl font-bold mb-2" data-testid="text-elu-name">
                        {elu.firstName} {elu.lastName}
                      </h1>
                      <Badge className={`${colors.badge} mb-4`} data-testid="badge-elu-function">
                        {elu.function}
                      </Badge>
                      
                      {elu.bio && (
                        <p className="text-muted-foreground mt-4" data-testid="text-elu-bio">{elu.bio}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {elu.domains && elu.domains.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Domaines de competence
                    </CardTitle>
                    <CardDescription>
                      {isAssociation ? "Responsabilites au sein de l'association" : "Delegations et responsabilites municipales"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {elu.domains.map((domain) => (
                        <Badge 
                          key={domain.id} 
                          variant="outline"
                          className="text-sm py-1.5 px-3"
                          style={domain.color ? { 
                            borderColor: domain.color, 
                            color: domain.color,
                            backgroundColor: `${domain.color}10` 
                          } : undefined}
                          data-testid={`badge-domain-${domain.id}`}
                        >
                          {domain.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {isAssociation ? "Association" : isEpci ? "EPCI" : "Commune"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    {tenant.logoUrl && (
                      <img 
                        src={tenant.logoUrl} 
                        alt={tenant.name} 
                        className="h-12 w-12 object-contain"
                      />
                    )}
                    <div>
                      <p className="font-medium" data-testid="text-tenant-name">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-tenant-epci">{tenant.epci}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Contacter
                  </CardTitle>
                  <CardDescription>
                    Envoyez un message direct
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!isContactOpen ? (
                    <div className="space-y-3">
                      <Button 
                        className="w-full" 
                        onClick={() => setIsContactOpen(true)}
                        data-testid="button-open-contact"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Envoyer un message
                      </Button>
                      {elu.email && (
                        <a href={`mailto:${elu.email}`} data-testid="link-email">
                          <Button variant="outline" className="w-full" data-testid="button-email">
                            <Mail className="h-4 w-4 mr-2" />
                            Envoyer un email
                          </Button>
                        </a>
                      )}
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="requesterName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Votre nom</FormLabel>
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
                          name="requesterEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Votre email</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email"
                                  placeholder="jean@example.com" 
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
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sujet</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Objet de votre message" 
                                  {...field} 
                                  data-testid="input-subject"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Votre message..."
                                  className="min-h-[120px]"
                                  {...field} 
                                  data-testid="input-message"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => setIsContactOpen(false)}
                            data-testid="button-cancel"
                          >
                            Annuler
                          </Button>
                          <Button 
                            type="submit" 
                            className="flex-1"
                            disabled={sendMessageMutation.isPending || !tenant?.id}
                            data-testid="button-send-message"
                          >
                            {sendMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Envoyer
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </TenantLayout>
  );
}
