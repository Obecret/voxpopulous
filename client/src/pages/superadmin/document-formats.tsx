import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  FileText, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save,
  X,
  Hash,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocumentNumberFormat } from "@shared/schema";

const DOCUMENT_TYPES = [
  { value: "DEVIS", label: "Devis", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "COMMANDE", label: "Bon de commande", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "FACTURE", label: "Facture", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "AVOIR", label: "Avoir", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

interface FormatFormData {
  code: string;
  name: string;
  description: string;
  documentType: string;
  pattern: string;
  prefix: string;
  separator: string;
  yearFormat: string;
  sequenceDigits: number;
  includeMonth: boolean;
  example: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

const defaultFormData: FormatFormData = {
  code: "",
  name: "",
  description: "",
  documentType: "DEVIS",
  pattern: "{PREFIX}-{YEAR}-{SEQ:4}",
  prefix: "",
  separator: "-",
  yearFormat: "YYYY",
  sequenceDigits: 4,
  includeMonth: false,
  example: "",
  isDefault: false,
  isActive: true,
  displayOrder: 0,
};

export default function DocumentFormatsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("DEVIS");
  const [editingFormat, setEditingFormat] = useState<DocumentNumberFormat | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormatFormData>(defaultFormData);

  const { data: formats, isLoading } = useQuery<DocumentNumberFormat[]>({
    queryKey: ["/api/superadmin/settings/document-formats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormatFormData) => {
      const res = await apiRequest("POST", "/api/superadmin/settings/document-formats", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/document-formats"] });
      toast({ title: "Format cree avec succes" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le format", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormatFormData> }) => {
      const res = await apiRequest("PUT", `/api/superadmin/settings/document-formats/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/document-formats"] });
      toast({ title: "Format mis a jour" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le format", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/settings/document-formats/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/document-formats"] });
      toast({ title: "Format supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le format", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingFormat(null);
    setFormData({ ...defaultFormData, documentType: activeTab });
    setIsDialogOpen(true);
  };

  const openEditDialog = (format: DocumentNumberFormat) => {
    setEditingFormat(format);
    setFormData({
      code: format.code,
      name: format.name,
      description: format.description || "",
      documentType: format.documentType,
      pattern: format.pattern,
      prefix: format.prefix || "",
      separator: format.separator || "-",
      yearFormat: format.yearFormat || "YYYY",
      sequenceDigits: format.sequenceDigits || 4,
      includeMonth: format.includeMonth || false,
      example: format.example || "",
      isDefault: format.isDefault || false,
      isActive: format.isActive !== false,
      displayOrder: format.displayOrder || 0,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFormat(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (editingFormat) {
      updateMutation.mutate({ id: editingFormat.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const generateExample = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const seq = "1".padStart(formData.sequenceDigits, "0");
    
    let example = formData.prefix;
    if (formData.separator) {
      example += formData.separator + year;
      if (formData.includeMonth) {
        example += formData.separator + month;
      }
      example += formData.separator + seq;
    } else {
      example += year;
      if (formData.includeMonth) {
        example += month;
      }
      example += seq;
    }
    setFormData({ ...formData, example });
  };

  const filteredFormats = formats?.filter(f => f.documentType === activeTab) || [];

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-document-formats-title">
              <Hash className="h-6 w-6" />
              Formats de numerotation
            </h1>
            <p className="text-muted-foreground">
              Configurez les formats de numerotation pour les devis, commandes, factures et avoirs
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-format">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un format
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Formats disponibles</CardTitle>
            <CardDescription>
              Les communes peuvent choisir parmi ces formats lors de leur inscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                {DOCUMENT_TYPES.map(type => (
                  <TabsTrigger key={type.value} value={type.value} data-testid={`tab-${type.value}`}>
                    {type.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {DOCUMENT_TYPES.map(docType => (
                <TabsContent key={docType.value} value={docType.value}>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredFormats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucun format configure pour ce type de document
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {filteredFormats.map(format => (
                        <Card key={format.id} className={`relative ${!format.isActive ? 'opacity-50' : ''}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{format.name}</span>
                                  {format.isDefault && (
                                    <Badge variant="secondary" className="text-xs">Par defaut</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Code: <code className="bg-muted px-1 rounded">{format.code}</code>
                                </div>
                                <div className="text-lg font-mono bg-muted px-2 py-1 rounded inline-block">
                                  {format.example}
                                </div>
                                {format.description && (
                                  <p className="text-sm text-muted-foreground">{format.description}</p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(format)}
                                  data-testid={`button-edit-format-${format.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(format.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-format-${format.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingFormat ? "Modifier le format" : "Nouveau format de numerotation"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="code">Code unique</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="BC_ANNUAL_4"
                    data-testid="input-format-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="BC Annuel 4 chiffres"
                    data-testid="input-format-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentType">Type de document</Label>
                <Select
                  value={formData.documentType}
                  onValueChange={(value) => setFormData({ ...formData, documentType: value })}
                >
                  <SelectTrigger data-testid="select-document-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefixe</Label>
                  <Input
                    id="prefix"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                    placeholder="BC"
                    data-testid="input-format-prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="separator">Separateur</Label>
                  <Input
                    id="separator"
                    value={formData.separator}
                    onChange={(e) => setFormData({ ...formData, separator: e.target.value })}
                    placeholder="-"
                    data-testid="input-format-separator"
                  />
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sequenceDigits">Nombre de chiffres</Label>
                  <Select
                    value={String(formData.sequenceDigits)}
                    onValueChange={(value) => setFormData({ ...formData, sequenceDigits: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-sequence-digits">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} chiffres</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearFormat">Format annee</Label>
                  <Select
                    value={formData.yearFormat}
                    onValueChange={(value) => setFormData({ ...formData, yearFormat: value })}
                  >
                    <SelectTrigger data-testid="select-year-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY">YYYY (2026)</SelectItem>
                      <SelectItem value="YY">YY (26)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="includeMonth">Inclure le mois</Label>
                <Switch
                  id="includeMonth"
                  checked={formData.includeMonth}
                  onCheckedChange={(checked) => setFormData({ ...formData, includeMonth: checked })}
                  data-testid="switch-include-month"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="example">Exemple</Label>
                  <Button variant="outline" size="sm" onClick={generateExample} data-testid="button-generate-example">
                    Generer
                  </Button>
                </div>
                <Input
                  id="example"
                  value={formData.example}
                  onChange={(e) => setFormData({ ...formData, example: e.target.value })}
                  placeholder="BC-2026-0001"
                  className="font-mono"
                  data-testid="input-format-example"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du format..."
                  rows={2}
                  data-testid="input-format-description"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                    data-testid="switch-is-default"
                  />
                  <Label htmlFor="isDefault">Par defaut</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-is-active"
                  />
                  <Label htmlFor="isActive">Actif</Label>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={closeDialog}>
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-format"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingFormat ? "Mettre a jour" : "Creer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
