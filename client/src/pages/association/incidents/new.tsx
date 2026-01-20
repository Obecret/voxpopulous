import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Tenant, Association } from "@shared/schema";
import { INCIDENT_CATEGORIES } from "@shared/schema";
import { LocationPicker } from "@/components/location-picker";

const incidentFormSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caracteres"),
  description: z.string().min(20, "La description doit contenir au moins 20 caracteres"),
  category: z.string().min(1, "Veuillez choisir une categorie"),
  location: z.string().optional().or(z.literal("")),
  createdByEmail: z.string().email("Email invalide").optional().or(z.literal("")),
});

type IncidentForm = z.infer<typeof incidentFormSchema>;

export default function AssociationNewIncident() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const { toast } = useToast();
  const [success, setSuccess] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const form = useForm<IncidentForm>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      location: "",
      createdByEmail: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: IncidentForm) => {
      if (!association?.id) {
        throw new Error("Association non chargee");
      }
      const response = await apiRequest("POST", `/api/associations/${association.id}/incidents`, {
        ...data,
        locationText: data.location || null,
        createdByEmail: data.createdByEmail || null,
        latitude: latitude,
        longitude: longitude,
      });
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IncidentForm) => {
    mutation.mutate(data);
  };

  if (success) {
    return (
      <AssociationLayout association={association || null} tenant={tenant || null}>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-4" data-testid="text-success-title">
            Signalement envoye !
          </h1>
          <p className="text-muted-foreground mb-8">
            Merci pour votre signalement. L'equipe de l'association le traitera dans les plus brefs delais.
          </p>
          <div className="space-y-4">
            <Link href={`/structures/${params.slug}/${params.assocSlug}/incidents`}>
              <Button size="lg" data-testid="button-back-list">
                Voir tous les signalements
              </Button>
            </Link>
          </div>
        </div>
      </AssociationLayout>
    );
  }

  return (
    <AssociationLayout association={association || null} tenant={tenant || null}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/structures/${params.slug}/${params.assocSlug}/incidents`}>
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Retour aux signalements
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Faire un signalement</CardTitle>
            <CardDescription>
              Signalez un probleme ou une anomalie a l'association.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre du signalement *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Materiel deteriore dans le local" 
                          {...field} 
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categorie *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Choisir une categorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INCIDENT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description detaillee *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Decrivez le probleme en detail..."
                          className="min-h-32"
                          {...field} 
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localisation (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Local associatif, salle 2"
                          {...field} 
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Position sur la carte (optionnel)</FormLabel>
                  <LocationPicker
                    latitude={latitude}
                    longitude={longitude}
                    onLocationChange={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur la carte ou utilisez la geolocalisation pour indiquer l'emplacement exact.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="createdByEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Votre email (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="Pour etre informe de l'avancement"
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormDescription>
                        Si vous renseignez votre email, vous serez informe lorsque le statut de votre signalement evoluera.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={mutation.isPending || !association?.id}
                  data-testid="button-submit"
                >
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Envoyer le signalement
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AssociationLayout>
  );
}
