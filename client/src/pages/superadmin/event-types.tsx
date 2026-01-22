import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save,
  Users,
  CalendarDays,
  Image,
  Link,
  Lightbulb,
  Images,
  Palette
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GlobalEventType } from "@shared/schema";

interface EventTypeFormData {
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  hasCapacity: boolean;
  hasMultiDay: boolean;
  hasPoster: boolean;
  hasBookingUrl: boolean;
  hasIdeaLinking: boolean;
  hasMultipleImages: boolean;
  displayOrder: number;
  isActive: boolean;
}

const defaultFormData: EventTypeFormData = {
  name: "",
  code: "",
  description: "",
  icon: "Calendar",
  color: "#3B82F6",
  hasCapacity: false,
  hasMultiDay: false,
  hasPoster: false,
  hasBookingUrl: false,
  hasIdeaLinking: false,
  hasMultipleImages: false,
  displayOrder: 0,
  isActive: true,
};

const colorOptions = [
  "#3B82F6", "#8B5CF6", "#22C55E", "#EF4444", "#F59E0B", 
  "#EC4899", "#06B6D4", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#0EA5E9", "#A855F7", "#10B981", "#64748B"
];

const iconOptions = [
  "Calendar", "Users", "Music", "Presentation", "Wrench", 
  "Mic", "Theater", "Trophy", "PartyPopper", "Megaphone"
];

export default function EventTypesPage() {
  const { toast } = useToast();
  const [editingEventType, setEditingEventType] = useState<GlobalEventType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<EventTypeFormData>(defaultFormData);

  const { data: eventTypes, isLoading } = useQuery<GlobalEventType[]>({
    queryKey: ["/api/superadmin/settings/event-types"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: EventTypeFormData) => {
      const res = await apiRequest("POST", "/api/superadmin/settings/event-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/event-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/event-types"] });
      toast({ title: "Type d'evenement cree avec succes" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le type d'evenement", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventTypeFormData> }) => {
      const res = await apiRequest("PUT", `/api/superadmin/settings/event-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/event-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/event-types"] });
      toast({ title: "Type d'evenement mis a jour" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le type d'evenement", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/settings/event-types/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/event-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/event-types"] });
      toast({ title: "Type d'evenement supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le type d'evenement", variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingEventType(null);
    setFormData(defaultFormData);
  };

  const openCreateDialog = () => {
    setFormData(defaultFormData);
    setEditingEventType(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (eventType: GlobalEventType) => {
    setEditingEventType(eventType);
    setFormData({
      name: eventType.name,
      code: eventType.code,
      description: eventType.description || "",
      icon: eventType.icon || "Calendar",
      color: eventType.color || "#3B82F6",
      hasCapacity: eventType.hasCapacity,
      hasMultiDay: eventType.hasMultiDay,
      hasPoster: eventType.hasPoster,
      hasBookingUrl: eventType.hasBookingUrl,
      hasIdeaLinking: eventType.hasIdeaLinking,
      hasMultipleImages: eventType.hasMultipleImages,
      displayOrder: eventType.displayOrder,
      isActive: eventType.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({ title: "Erreur", description: "Le nom et le code sont requis", variant: "destructive" });
      return;
    }

    if (editingEventType) {
      updateMutation.mutate({ id: editingEventType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (eventType: GlobalEventType) => {
    if (confirm(`Supprimer le type "${eventType.name}" ?`)) {
      deleteMutation.mutate(eventType.id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Types d'evenements
            </h1>
            <p className="text-muted-foreground">
              Configurez les differents types d'evenements disponibles pour les tenants
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-event-type">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau type
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Types d'evenements configures</CardTitle>
            <CardDescription>
              Chaque type d'evenement peut activer differentes options (capacite, multi-jours, affiche, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : eventTypes && eventTypes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Options activees</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventTypes.map((eventType) => (
                    <TableRow key={eventType.id} data-testid={`row-event-type-${eventType.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: eventType.color || "#3B82F6" }}
                          />
                          <span className="font-medium">{eventType.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">{eventType.code}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {eventType.hasCapacity && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              Capacite
                            </Badge>
                          )}
                          {eventType.hasMultiDay && (
                            <Badge variant="outline" className="text-xs">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              Multi-jours
                            </Badge>
                          )}
                          {eventType.hasPoster && (
                            <Badge variant="outline" className="text-xs">
                              <Image className="h-3 w-3 mr-1" />
                              Affiche
                            </Badge>
                          )}
                          {eventType.hasBookingUrl && (
                            <Badge variant="outline" className="text-xs">
                              <Link className="h-3 w-3 mr-1" />
                              Reservation
                            </Badge>
                          )}
                          {eventType.hasIdeaLinking && (
                            <Badge variant="outline" className="text-xs">
                              <Lightbulb className="h-3 w-3 mr-1" />
                              Idees
                            </Badge>
                          )}
                          {eventType.hasMultipleImages && (
                            <Badge variant="outline" className="text-xs">
                              <Images className="h-3 w-3 mr-1" />
                              Multi-images
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={eventType.isActive ? "default" : "secondary"}>
                          {eventType.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => openEditDialog(eventType)}
                            data-testid={`button-edit-event-type-${eventType.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleDelete(eventType)}
                            data-testid={`button-delete-event-type-${eventType.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucun type d'evenement configure
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEventType ? "Modifier le type d'evenement" : "Nouveau type d'evenement"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Reunion publique"
                    data-testid="input-event-type-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
                    placeholder="REUNION_PUBLIQUE"
                    data-testid="input-event-type-code"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du type d'evenement..."
                  data-testid="input-event-type-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icone</Label>
                  <div className="flex flex-wrap gap-2">
                    {iconOptions.map((icon) => (
                      <Button
                        key={icon}
                        type="button"
                        size="sm"
                        variant={formData.icon === icon ? "default" : "outline"}
                        onClick={() => setFormData({ ...formData, icon })}
                        data-testid={`button-icon-${icon}`}
                      >
                        {icon}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Couleur
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-md border-2 transition-all ${
                          formData.color === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                        data-testid={`button-color-${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Options disponibles</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Capacite / Inscriptions</span>
                    </div>
                    <Switch
                      checked={formData.hasCapacity}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasCapacity: checked })}
                      data-testid="switch-has-capacity"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span>Multi-jours</span>
                    </div>
                    <Switch
                      checked={formData.hasMultiDay}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasMultiDay: checked })}
                      data-testid="switch-has-multi-day"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      <span>Affiche principale</span>
                    </div>
                    <Switch
                      checked={formData.hasPoster}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasPoster: checked })}
                      data-testid="switch-has-poster"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <span>Lien de reservation</span>
                    </div>
                    <Switch
                      checked={formData.hasBookingUrl}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasBookingUrl: checked })}
                      data-testid="switch-has-booking-url"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-muted-foreground" />
                      <span>Liaison avec les idees</span>
                    </div>
                    <Switch
                      checked={formData.hasIdeaLinking}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasIdeaLinking: checked })}
                      data-testid="switch-has-idea-linking"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Images className="h-4 w-4 text-muted-foreground" />
                      <span>Images multiples (carrousel)</span>
                    </div>
                    <Switch
                      checked={formData.hasMultipleImages}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasMultipleImages: checked })}
                      data-testid="switch-has-multiple-images"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayOrder">Ordre d'affichage</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    data-testid="input-event-type-display-order"
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>Actif</span>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-is-active"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save">
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingEventType ? "Mettre a jour" : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
