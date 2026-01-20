import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Image, Star, ExternalLink, Upload } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ObjectStorageService } from "@/lib/objectStorage";
import type { Tenant, User, TenantPhoto } from "@shared/schema";

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

const photoFormSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().min(1, "Photo requise"),
  displayOrder: z.coerce.number().optional(),
  isFeatured: z.boolean().optional(),
});

function getImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("/objects/")) return url;
  if (url.startsWith("http")) return url;
  return `/objects/${url}`;
}

type PhotoFormData = z.infer<typeof photoFormSchema>;

export default function AdminPhotos() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<TenantPhoto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, isLoading: userLoading, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  const { data: photos, isLoading: photosLoading } = useQuery<TenantPhoto[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "photos"],
    enabled: !!user,
  });

  const form = useForm<PhotoFormData>({
    resolver: zodResolver(photoFormSchema),
    defaultValues: {
      title: "",
      description: "",
      url: "",
      displayOrder: 0,
      isFeatured: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: PhotoFormData) => {
      return apiRequest("POST", `/api/tenants/${params.slug}/admin/photos`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "photos"] });
      setIsCreating(false);
      form.reset();
      toast({
        title: "Photo ajoutee",
        description: "La photo a ete ajoutee avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: PhotoFormData & { id: string }) => {
      return apiRequest("PATCH", `/api/tenants/${params.slug}/admin/photos/${values.id}`, {
        title: values.title || null,
        description: values.description || null,
        url: values.url,
        displayOrder: values.displayOrder || 0,
        isFeatured: values.isFeatured || false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "photos"] });
      setIsEditing(false);
      setSelectedPhoto(null);
      form.reset();
      toast({
        title: "Photo modifiee",
        description: "La photo a ete modifiee avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return apiRequest("DELETE", `/api/tenants/${params.slug}/admin/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "photos"] });
      setSelectedPhoto(null);
      toast({
        title: "Photo supprimee",
        description: "La photo a ete supprimee avec succes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  if (userError) {
    navigate(`/structures/${params.slug}/admin/login`);
    return null;
  }

  if (tenantLoading || userLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <Skeleton className="h-16 w-full mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const sortedPhotos = [...(photos || [])].sort((a, b) => a.displayOrder - b.displayOrder);

  const handleCreate = (values: PhotoFormData) => {
    createMutation.mutate(values);
  };

  const handleUpdate = (values: PhotoFormData) => {
    if (selectedPhoto) {
      updateMutation.mutate({ ...values, id: selectedPhoto.id });
    }
  };

  const handleDelete = (photoId: string) => {
    if (confirm("Etes-vous sur de vouloir supprimer cette photo ?")) {
      deleteMutation.mutate(photoId);
    }
  };

  const openEditDialog = (photo: TenantPhoto) => {
    setSelectedPhoto(photo);
    setIsEditing(true);
    form.reset({
      title: photo.title || "",
      description: photo.description || "",
      url: photo.url,
      displayOrder: photo.displayOrder,
      isFeatured: photo.isFeatured,
    });
  };

  return (
    <AdminLayout tenant={tenant || null} user={user || null} accountBlocked={user?.accountBlocked} blockReason={user?.blockReason}>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-tenant-photos-title">
              Galerie photos
            </h1>
            <p className="text-muted-foreground mt-1">Gerez les photos de votre commune.</p>
          </div>
          <Button onClick={() => { setIsCreating(true); form.reset({ title: "", description: "", url: "", displayOrder: 0, isFeatured: false }); }} data-testid="button-add-photo">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une photo
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <p className="text-sm text-muted-foreground">
              Les photos marquees comme "mise en avant" seront affichees en rotation dans le hero de votre page.
            </p>
          </CardHeader>
          <CardContent>
            {photosLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="aspect-video w-full rounded-md" />
                ))}
              </div>
            ) : sortedPhotos.length === 0 ? (
              <div className="text-center py-12">
                <Image className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground mt-4">Aucune photo ajoutee</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => { setIsCreating(true); form.reset({ title: "", description: "", url: "", displayOrder: 0, isFeatured: false }); }}
                  data-testid="button-add-first-photo"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter votre premiere photo
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group rounded-md overflow-hidden border bg-muted"
                    data-testid={`card-photo-${photo.id}`}
                  >
                    <div className="aspect-video relative">
                      <img
                        src={getImageUrl(photo.url)}
                        alt={photo.title || "Photo"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5L5 21'/%3E%3C/svg%3E";
                        }}
                      />
                      {photo.isFeatured && (
                        <div className="absolute top-2 left-2">
                          <Badge className="gap-1">
                            <Star className="h-3 w-3" />
                            En vedette
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium truncate">{photo.title || "Sans titre"}</p>
                      {photo.description && (
                        <p className="text-xs text-muted-foreground truncate">{photo.description}</p>
                      )}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(getImageUrl(photo.url), "_blank")}
                        data-testid={`button-view-photo-${photo.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(photo)}
                        data-testid={`button-edit-photo-${photo.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(photo.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-photo-${photo.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ajouter une photo</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photo *</FormLabel>
                      <div className="space-y-3">
                        {field.value && (
                          <div className="w-full max-w-xs">
                            <img
                              src={getImageUrl(field.value)}
                              alt="Apercu"
                              className="w-full h-32 object-cover rounded-md border"
                            />
                          </div>
                        )}
                        <ObjectUploader
                          onGetUploadUrl={ObjectStorageService.getUploadUrl}
                          onComplete={(uploadUrl) => {
                            const objectPath = ObjectStorageService.normalizeObjectPath(uploadUrl);
                            field.onChange(objectPath);
                          }}
                          maxImageWidth={1920}
                          maxImageHeight={1080}
                          imageQuality={0.85}
                          data-testid="uploader-photo"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {field.value ? "Changer la photo" : "Telecharger une photo"}
                        </ObjectUploader>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Place du marche" data-testid="input-photo-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Description de la photo..." className="resize-none" data-testid="input-photo-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="displayOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ordre d'affichage</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-photo-order" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <FormLabel>Mise en avant</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-photo-featured"
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">
                            {field.value ? "Oui" : "Non"}
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-photo">
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Ajouter
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditing} onOpenChange={(open) => { if (!open) { setIsEditing(false); setSelectedPhoto(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Modifier la photo</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photo *</FormLabel>
                      <div className="space-y-3">
                        {field.value && (
                          <div className="w-full max-w-xs">
                            <img
                              src={getImageUrl(field.value)}
                              alt="Apercu"
                              className="w-full h-32 object-cover rounded-md border"
                            />
                          </div>
                        )}
                        <ObjectUploader
                          onGetUploadUrl={ObjectStorageService.getUploadUrl}
                          onComplete={(uploadUrl) => {
                            const objectPath = ObjectStorageService.normalizeObjectPath(uploadUrl);
                            field.onChange(objectPath);
                          }}
                          maxImageWidth={1920}
                          maxImageHeight={1080}
                          imageQuality={0.85}
                          data-testid="uploader-edit-photo"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {field.value ? "Changer la photo" : "Telecharger une photo"}
                        </ObjectUploader>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-photo-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="resize-none" data-testid="input-edit-photo-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="displayOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ordre d'affichage</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-edit-photo-order" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <FormLabel>Mise en avant</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-edit-photo-featured"
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">
                            {field.value ? "Oui" : "Non"}
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setSelectedPhoto(null); }}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-photo">
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
