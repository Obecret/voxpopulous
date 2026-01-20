import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

const productTypeLabels: Record<string, string> = {
  SERVICE: "Service",
  ONE_TIME: "Ponctuel",
};

export default function SuperadminProducts() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "SERVICE" as "SERVICE" | "ONE_TIME",
    description: "",
    defaultUnitPriceEuros: 0,
    isActive: true,
  });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/superadmin/products"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        name: data.name,
        code: data.code,
        type: data.type,
        description: data.description || null,
        defaultUnitPrice: Math.round(data.defaultUnitPriceEuros * 100),
        isActive: data.isActive,
      };
      
      const res = await apiRequest("POST", "/api/superadmin/products", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/products"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Produit cree" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le produit", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload = {
        name: data.name,
        code: data.code,
        type: data.type,
        description: data.description || null,
        defaultUnitPrice: Math.round(data.defaultUnitPriceEuros * 100),
        isActive: data.isActive,
      };
      
      const res = await apiRequest("PUT", `/api/superadmin/products/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      resetForm();
      toast({ title: "Produit mis a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le produit", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/products/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/products"] });
      toast({ title: "Produit supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le produit", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      type: "SERVICE",
      description: "",
      defaultUnitPriceEuros: 0,
      isActive: true,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      type: product.type as "SERVICE" | "ONE_TIME",
      description: product.description || "",
      defaultUnitPriceEuros: product.defaultUnitPrice || 0,
      isActive: product.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatPrice = (euros: number | null | undefined) => {
    if (euros == null || euros === 0) return "-";
    return euros.toFixed(2);
  };

  const renderPriceDisplay = (product: Product) => {
    return (
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold">{formatPrice(product.defaultUnitPrice)} €</span>
      </div>
    );
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-products-title">
              Produits
            </h1>
            <p className="text-muted-foreground">
              Catalogue de produits et services pour les devis
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-product">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau produit
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Chargement...</div>
        ) : !products?.filter(p => p.type !== "SUBSCRIPTION").length ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Aucun produit configure.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Les abonnements sont geres dans la page Forfaits.
              </p>
              <Button onClick={openCreateDialog} className="mt-4">
                Creer un produit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.filter(p => p.type !== "SUBSCRIPTION").map((product) => (
              <Card key={product.id} data-testid={`card-product-${product.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <div className="flex gap-1">
                      <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs">
                        {product.isActive ? "Actif" : "Inactif"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {productTypeLabels[product.type] || product.type}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs">{product.code}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderPriceDisplay(product)}
                  
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(product)}
                      data-testid={`button-edit-product-${product.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Etes-vous sur de vouloir supprimer ce produit ?")) {
                          deleteMutation.mutate(product.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-product-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  data-testid="input-product-code"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as typeof formData.type })}
              >
                <SelectTrigger data-testid="select-product-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERVICE">Service</SelectItem>
                  <SelectItem value="ONE_TIME">Ponctuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-product-description"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="price">Prix unitaire (en euros)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.defaultUnitPriceEuros}
                onChange={(e) => setFormData({ ...formData, defaultUnitPriceEuros: parseFloat(e.target.value) || 0 })}
                data-testid="input-product-price"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-product-active"
              />
              <Label htmlFor="isActive">Actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-product"
            >
              {createMutation.isPending || updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
