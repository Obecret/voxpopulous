import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Palette, FileText, Image, Upload, X } from "lucide-react";
import { useState, useEffect } from "react";
import type { Tenant, User } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ObjectStorageService } from "@/lib/objectStorage";

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

interface SettingsData {
  presentationText: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
}

const COLOR_PRESETS = [
  { name: "Bleu Marine", primary: "#1e3a5f", secondary: "#4a6fa5", accent: "#7ca9d8", background: "#f5f7fa" },
  { name: "Vert Foret", primary: "#1b4332", secondary: "#2d6a4f", accent: "#52b788", background: "#f0f7f4" },
  { name: "Bordeaux", primary: "#5c1624", secondary: "#8b2942", accent: "#c75d73", background: "#fdf5f6" },
  { name: "Violet", primary: "#3c1a5b", secondary: "#5e3d76", accent: "#9b6dc6", background: "#f8f5fc" },
  { name: "Orange Terre", primary: "#7c4a03", secondary: "#b36b17", accent: "#e09f3e", background: "#fdf8f0" },
];

export default function AdminSettings() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<SettingsData>({
    presentationText: "",
    logoUrl: "",
    primaryColor: "#1e3a5f",
    secondaryColor: "#4a6fa5",
    accentColor: "#7ca9d8",
    backgroundColor: "#f5f7fa",
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<SettingsData>({
    queryKey: ["/api/tenants", params.slug, "admin", "settings"],
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        presentationText: settings.presentationText || "",
        logoUrl: settings.logoUrl || "",
        primaryColor: settings.primaryColor || "#1e3a5f",
        secondaryColor: settings.secondaryColor || "#4a6fa5",
        accentColor: settings.accentColor || "#7ca9d8",
        backgroundColor: settings.backgroundColor || "#f5f7fa",
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsData) => {
      return apiRequest("PATCH", `/api/tenants/${params.slug}/admin/settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug] });
      toast({ title: "Parametres enregistres", description: "Les modifications ont ete appliquees avec succes." });
    },
    onError: (error: any) => {
      const message = error.data?.message || error.message || "Une erreur est survenue.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    },
  });

  if (userError) {
    navigate(`/structures/${params.slug}/admin/login`);
    return null;
  }

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setFormData((prev) => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
      backgroundColor: preset.background,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const isLoading = tenantLoading || settingsLoading;

  return (
    <AdminLayout tenant={tenant || null} user={user || null} accountBlocked={user?.accountBlocked} blockReason={user?.blockReason}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold" data-testid="text-admin-settings-title">
            Parametres
          </h1>
          <p className="text-muted-foreground mt-1">
            Personnalisez l'apparence de votre page publique.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Presentation
                </CardTitle>
                <CardDescription>
                  Texte affiche sur votre page d'accueil publique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="presentationText">Texte de presentation</Label>
                  <Textarea
                    id="presentationText"
                    value={formData.presentationText || ""}
                    onChange={(e) => setFormData({ ...formData, presentationText: e.target.value })}
                    placeholder="Bienvenue sur la plateforme de participation citoyenne de notre commune..."
                    rows={4}
                    data-testid="input-presentation-text"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Logo
                </CardTitle>
                <CardDescription>
                  Televersez votre logo pour l'afficher sur votre page publique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo de la structure</Label>
                  <div className="flex items-center gap-3">
                    <ObjectUploader
                      onGetUploadUrl={ObjectStorageService.getUploadUrl}
                      onComplete={(uploadUrl) => {
                        const objectPath = ObjectStorageService.normalizeObjectPath(uploadUrl);
                        setFormData({ ...formData, logoUrl: objectPath });
                      }}
                      maxImageWidth={512}
                      maxImageHeight={512}
                      imageQuality={0.9}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Telecharger un logo
                    </ObjectUploader>
                    {formData.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData({ ...formData, logoUrl: "" })}
                        data-testid="button-remove-logo"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {formData.logoUrl && (
                  <div className="mt-4">
                    <Label className="text-sm text-muted-foreground">Apercu</Label>
                    <div className="mt-2 p-4 border rounded-md bg-muted/50 flex items-center justify-center">
                      <img 
                        src={formData.logoUrl.startsWith('/objects/') ? formData.logoUrl : formData.logoUrl.startsWith('http') ? formData.logoUrl : `/objects/${formData.logoUrl}`} 
                        alt="Logo preview" 
                        className="max-h-24 max-w-48 object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        data-testid="img-logo-preview"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Couleurs
                </CardTitle>
                <CardDescription>
                  Palette de couleurs pour personnaliser votre page publique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Palettes predefinies</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <Button
                        key={preset.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className="gap-2"
                        data-testid={`button-preset-${preset.name.toLowerCase().replace(/\s/g, '-')}`}
                      >
                        <div 
                          className="w-4 h-4 rounded-full border" 
                          style={{ backgroundColor: preset.primary }} 
                        />
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Couleur principale</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={formData.primaryColor || "#1e3a5f"}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                        data-testid="input-primary-color"
                      />
                      <Input
                        type="text"
                        value={formData.primaryColor || ""}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        placeholder="#1e3a5f"
                        className="flex-1"
                        data-testid="input-primary-color-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Couleur secondaire</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={formData.secondaryColor || "#4a6fa5"}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                        data-testid="input-secondary-color"
                      />
                      <Input
                        type="text"
                        value={formData.secondaryColor || ""}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        placeholder="#4a6fa5"
                        className="flex-1"
                        data-testid="input-secondary-color-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Couleur d'accent</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accentColor"
                        type="color"
                        value={formData.accentColor || "#7ca9d8"}
                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                        data-testid="input-accent-color"
                      />
                      <Input
                        type="text"
                        value={formData.accentColor || ""}
                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                        placeholder="#7ca9d8"
                        className="flex-1"
                        data-testid="input-accent-color-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backgroundColor">Couleur de fond</Label>
                    <div className="flex gap-2">
                      <Input
                        id="backgroundColor"
                        type="color"
                        value={formData.backgroundColor || "#f5f7fa"}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                        data-testid="input-background-color"
                      />
                      <Input
                        type="text"
                        value={formData.backgroundColor || ""}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        placeholder="#f5f7fa"
                        className="flex-1"
                        data-testid="input-background-color-text"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Apercu de la palette</Label>
                  <div className="flex gap-2 p-4 border rounded-md" style={{ backgroundColor: formData.backgroundColor || "#f5f7fa" }}>
                    <div 
                      className="w-12 h-12 rounded-md" 
                      style={{ backgroundColor: formData.primaryColor || "#1e3a5f" }}
                      title="Principale"
                    />
                    <div 
                      className="w-12 h-12 rounded-md" 
                      style={{ backgroundColor: formData.secondaryColor || "#4a6fa5" }}
                      title="Secondaire"
                    />
                    <div 
                      className="w-12 h-12 rounded-md" 
                      style={{ backgroundColor: formData.accentColor || "#7ca9d8" }}
                      title="Accent"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer les modifications
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
