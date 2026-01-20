import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
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
import { useAnonymousId } from "@/hooks/use-anonymous-id";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Camera, X, ImageIcon } from "lucide-react";
import type { Tenant, TenantInterventionDomain } from "@shared/schema";
import { INCIDENT_CATEGORIES } from "@shared/schema";
import { LocationPicker } from "@/components/location-picker";

const incidentFormSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caracteres"),
  description: z.string().min(20, "La description doit contenir au moins 20 caracteres"),
  domainId: z.string().min(1, "Veuillez choisir un domaine"),
  locationText: z.string().min(5, "Veuillez indiquer une localisation"),
  createdByEmail: z.string().email("Email invalide").optional().or(z.literal("")),
});

type IncidentForm = z.infer<typeof incidentFormSchema>;

export default function NewIncident() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { anonymousId } = useAnonymousId();
  const [success, setSuccess] = useState<{ publicToken: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: domains = [], isLoading: domainsLoading } = useQuery<TenantInterventionDomain[]>({
    queryKey: ["/api/tenants", params.slug, "domains"],
  });

  const form = useForm<IncidentForm>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      domainId: "",
      locationText: "",
      createdByEmail: "",
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximum est de 10 Mo",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const response = await apiRequest("POST", "/api/objects/upload");
      const { uploadURL } = await response.json();
      
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      const url = new URL(uploadURL);
      const pathname = url.pathname;
      const uploadIdMatch = pathname.match(/\/uploads\/([^/]+)$/);
      const objectId = uploadIdMatch ? uploadIdMatch[1] : pathname.split('/').pop();
      const normalizedPath = `/objects/uploads/${objectId}`;
      setPhotoUrl(normalizedPath);
      
      toast({
        title: "Photo ajoutee",
        description: "La photo a ete enregistree avec succes",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la photo",
        variant: "destructive",
      });
      setPhotoPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoUrl(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: IncidentForm) => {
      const selectedDomain = domains.find(d => d.id === data.domainId);
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/incidents`, {
        title: data.title,
        description: data.description,
        locationText: data.locationText,
        domainId: data.domainId,
        category: selectedDomain?.name || "Autre",
        createdByEmail: data.createdByEmail || null,
        anonymousSubmitterId: anonymousId || null,
        photoUrl: photoUrl,
        latitude: latitude,
        longitude: longitude,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSuccess({ publicToken: data.publicToken });
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
      <TenantLayout tenant={tenant || null}>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-4" data-testid="text-success-title">
            Signalement enregistre !
          </h1>
          <p className="text-muted-foreground mb-8">
            Merci pour votre signalement. Les responsables ont ete informes.
          </p>
          <div className="space-y-4">
            <Link href={`/structures/${params.slug}/incidents/track/${success.publicToken}`}>
              <Button size="lg" data-testid="button-track">
                Suivre mon signalement
              </Button>
            </Link>
            <div>
              <Link href={`/structures/${params.slug}/incidents`}>
                <Button variant="ghost" data-testid="button-back-list">
                  Retour a la liste
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout tenant={tenant || null}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/structures/${params.slug}/incidents`}>
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Retour aux signalements
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Signaler un probleme</CardTitle>
            <CardDescription>
              Indiquez-nous un probleme : voirie, eclairage, terrain, materiel ou equipement.
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
                          placeholder="Ex: Trou dans la chaussee rue Victor Hugo" 
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
                  name="domainId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domaine *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-domain">
                            <SelectValue placeholder={domainsLoading ? "Chargement..." : "Type de probleme"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {domains.length > 0 ? (
                            domains.map((domain) => (
                              <SelectItem key={domain.id} value={domain.id}>{domain.name}</SelectItem>
                            ))
                          ) : (
                            INCIDENT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localisation *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: 23 rue Victor Hugo, devant la boulangerie" 
                          {...field} 
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormDescription>
                        Soyez le plus precis possible pour faciliter l'intervention.
                      </FormDescription>
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
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
                  name="createdByEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Votre email (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="Pour etre informe de la resolution"
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormDescription>
                        Si vous renseignez votre email, vous serez informe lorsque le probleme sera resolu.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Photo (optionnel)</FormLabel>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                    data-testid="input-photo"
                  />
                  
                  {photoPreview ? (
                    <div className="relative rounded-md border overflow-hidden">
                      <img 
                        src={photoPreview} 
                        alt="Apercu" 
                        className="w-full h-48 object-cover"
                        data-testid="img-photo-preview"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removePhoto}
                        data-testid="button-remove-photo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {isUploading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-24 flex-col gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      data-testid="button-add-photo"
                    >
                      {isUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <>
                          <Camera className="h-6 w-6" />
                          <span>Ajouter une photo</span>
                        </>
                      )}
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Une photo peut aider a mieux identifier le probleme.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={mutation.isPending}
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
    </TenantLayout>
  );
}
