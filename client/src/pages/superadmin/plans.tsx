import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, Check, X, Settings2, Puzzle, GripVertical, CreditCard } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { SubscriptionPlan, Feature, PlanFeatureAssignment, Addon, PlanAddonAccess } from "@shared/schema";

export default function SuperadminPlans() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);
  const [isAddonAccessDialogOpen, setIsAddonAccessDialogOpen] = useState(false);
  const [selectedPlanForCatalog, setSelectedPlanForCatalog] = useState<SubscriptionPlan | null>(null);
  const [selectedPlanForAddons, setSelectedPlanForAddons] = useState<SubscriptionPlan | null>(null);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [addonPricing, setAddonPricing] = useState<Map<string, { monthly: number; yearly: number }>>(new Map());
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    monthlyPriceEuros: 0,
    yearlyPriceEuros: 0,
    hasIdeas: true,
    hasIncidents: true,
    hasMeetings: true,
    maxAdmins: 1,
    isActive: true,
    isFree: false,
    isBestValue: false,
    hasPromo: false,
    promoPercent: 0,
    targetTenantTypes: [] as string[],
    stripePriceIdMonthlyTest: "",
    stripePriceIdYearlyTest: "",
    stripePriceIdMonthlyLive: "",
    stripePriceIdYearlyLive: "",
  });

  const TENANT_TYPE_OPTIONS = [
    { value: "MAIRIE", label: "Mairie" },
    { value: "EPCI", label: "EPCI" },
    { value: "ASSOCIATION", label: "Association" },
  ];

  const { data: plans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/superadmin/plans"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        monthlyPrice: Math.round(data.monthlyPriceEuros),
        yearlyPrice: Math.round(data.yearlyPriceEuros),
      };
      const res = await apiRequest("POST", "/api/superadmin/plans", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/plans"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Forfait cree" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le forfait", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload = {
        ...data,
        monthlyPrice: Math.round(data.monthlyPriceEuros),
        yearlyPrice: Math.round(data.yearlyPriceEuros),
      };
      const res = await apiRequest("PUT", `/api/superadmin/plans/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/plans"] });
      setIsDialogOpen(false);
      setEditingPlan(null);
      resetForm();
      toast({ title: "Forfait mis a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le forfait", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/plans/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/plans"] });
      toast({ title: "Forfait supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le forfait", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (planIds: string[]) => {
      const res = await apiRequest("PUT", "/api/superadmin/plans/reorder", { planIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/plans"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de reordonner les forfaits", variant: "destructive" });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && plans) {
      const oldIndex = plans.findIndex((p) => p.id === active.id);
      const newIndex = plans.findIndex((p) => p.id === over.id);
      const newOrder = arrayMove(plans, oldIndex, newIndex);
      reorderMutation.mutate(newOrder.map((p) => p.id));
    }
  };

  const { data: catalogFeatures } = useQuery<Feature[]>({
    queryKey: ["/api/superadmin/features"],
  });

  const { data: planAssignments, isLoading: assignmentsLoading } = useQuery<(PlanFeatureAssignment & { feature: Feature })[]>({
    queryKey: ["/api/superadmin/plans", selectedPlanForCatalog?.id, "assignments"],
    enabled: !!selectedPlanForCatalog,
  });

  // Fetch all plans with their catalog assignments for card display
  type PlanWithCatalog = SubscriptionPlan & { catalogFeatures: (PlanFeatureAssignment & { feature: Feature })[] };
  const { data: plansWithCatalog } = useQuery<PlanWithCatalog[]>({
    queryKey: ["/api/public/plans-catalog"],
  });

  // Fetch all plans with their addon access for card display
  type PlanWithAddons = SubscriptionPlan & { addonAccess: (PlanAddonAccess & { addon: Addon })[] };
  const { data: plansWithAddons } = useQuery<PlanWithAddons[]>({
    queryKey: ["/api/public/plans-with-addons"],
  });

  // Helper to get assigned feature IDs for a plan
  const getAssignedFeatureIds = (planId: string): Set<string> => {
    const plan = plansWithCatalog?.find(p => p.id === planId);
    return new Set(plan?.catalogFeatures?.map(cf => cf.featureId) || []);
  };

  // Helper to get enabled addons for a plan
  const getEnabledAddons = (planId: string): (PlanAddonAccess & { addon: Addon })[] => {
    const plan = plansWithAddons?.find(p => p.id === planId);
    return plan?.addonAccess?.filter(a => a.isEnabled) || [];
  };


  useEffect(() => {
    if (planAssignments) {
      setSelectedFeatureIds(new Set(planAssignments.map(a => a.featureId)));
    }
  }, [planAssignments]);

  const savePlanFeaturesMutation = useMutation({
    mutationFn: async ({ planId, featureIds }: { planId: string; featureIds: string[] }) => {
      const res = await apiRequest("POST", `/api/superadmin/plans/${planId}/features`, { featureIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/plans", selectedPlanForCatalog?.id, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/plans-catalog"] });
      setIsCatalogDialogOpen(false);
      toast({ title: "Fonctionnalites mises a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    },
  });

  // Addon access management
  const { data: allAddons } = useQuery<Addon[]>({
    queryKey: ["/api/superadmin/addons"],
  });

  const { data: planAddonAccess } = useQuery<(PlanAddonAccess & { addon: Addon })[]>({
    queryKey: ["/api/superadmin/plans", selectedPlanForAddons?.id, "addon-access"],
    enabled: !!selectedPlanForAddons,
  });

  useEffect(() => {
    if (planAddonAccess && allAddons) {
      setSelectedAddonIds(new Set(planAddonAccess.filter(a => a.isEnabled).map(a => a.addonId)));
      const pricing = new Map<string, { monthly: number; yearly: number }>();
      planAddonAccess.forEach(a => {
        pricing.set(a.addonId, {
          monthly: a.monthlyPrice ?? 0,
          yearly: a.yearlyPrice ?? 0,
        });
      });
      setAddonPricing(pricing);
    }
  }, [planAddonAccess, allAddons]);

  const savePlanAddonAccessMutation = useMutation({
    mutationFn: async ({ planId, addonAccess }: { planId: string; addonAccess: { addonId: string; isEnabled: boolean; monthlyPrice?: number | null; yearlyPrice?: number | null }[] }) => {
      const res = await apiRequest("POST", `/api/superadmin/plans/${planId}/addon-access`, { addonAccess });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/plans", selectedPlanForAddons?.id, "addon-access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/plans-with-addons"] });
      setIsAddonAccessDialogOpen(false);
      toast({ title: "Options mises a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    },
  });

  const openAddonAccessDialog = (plan: SubscriptionPlan) => {
    setSelectedPlanForAddons(plan);
    setIsAddonAccessDialogOpen(true);
  };

  const handleSaveAddonAccess = () => {
    if (!selectedPlanForAddons || !allAddons) {
      toast({ 
        title: "Chargement en cours", 
        description: "Veuillez patienter...",
        variant: "destructive"
      });
      return;
    }

    const addonAccess = allAddons.map(addon => {
      const pricing = addonPricing.get(addon.id);
      const monthly = pricing?.monthly;
      const yearly = pricing?.yearly;
      return {
        addonId: addon.id,
        isEnabled: selectedAddonIds.has(addon.id),
        monthlyPrice: (monthly !== undefined && monthly !== null && !isNaN(monthly) && monthly > 0) ? monthly : null,
        yearlyPrice: (yearly !== undefined && yearly !== null && !isNaN(yearly) && yearly > 0) ? yearly : null,
      };
    });
    
    savePlanAddonAccessMutation.mutate({ 
      planId: selectedPlanForAddons.id, 
      addonAccess 
    });
  };

  const updateAddonPrice = (addonId: string, field: "monthly" | "yearly", rawValue: string) => {
    const parsed = parseFloat(rawValue);
    const value = isNaN(parsed) ? 0 : parsed;
    setAddonPricing(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(addonId) || { monthly: 0, yearly: 0 };
      newMap.set(addonId, { ...current, [field]: value });
      return newMap;
    });
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(addonId)) {
        newSet.delete(addonId);
      } else {
        newSet.add(addonId);
      }
      return newSet;
    });
  };

  const openCatalogDialog = (plan: SubscriptionPlan) => {
    setSelectedPlanForCatalog(plan);
    setIsCatalogDialogOpen(true);
  };

  const handleSaveCatalogFeatures = () => {
    if (!selectedPlanForCatalog) return;
    savePlanFeaturesMutation.mutate({ 
      planId: selectedPlanForCatalog.id, 
      featureIds: Array.from(selectedFeatureIds) 
    });
  };

  const toggleFeature = (featureId: string) => {
    setSelectedFeatureIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(featureId)) {
        newSet.delete(featureId);
      } else {
        newSet.add(featureId);
      }
      return newSet;
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      monthlyPriceEuros: 0,
      yearlyPriceEuros: 0,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 1,
      isActive: true,
      isFree: false,
      isBestValue: false,
      hasPromo: false,
      promoPercent: 0,
      targetTenantTypes: [],
      stripePriceIdMonthlyTest: "",
      stripePriceIdYearlyTest: "",
      stripePriceIdMonthlyLive: "",
      stripePriceIdYearlyLive: "",
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingPlan(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      code: plan.code,
      description: plan.description || "",
      monthlyPriceEuros: plan.monthlyPrice,
      yearlyPriceEuros: plan.yearlyPrice,
      hasIdeas: plan.hasIdeas,
      hasIncidents: plan.hasIncidents,
      hasMeetings: plan.hasMeetings,
      maxAdmins: plan.maxAdmins,
      isActive: plan.isActive,
      isFree: plan.isFree || false,
      isBestValue: plan.isBestValue || false,
      hasPromo: plan.hasPromo || false,
      promoPercent: plan.promoPercent || 0,
      targetTenantTypes: plan.targetTenantTypes || [],
      stripePriceIdMonthlyTest: plan.stripePriceIdMonthlyTest || "",
      stripePriceIdYearlyTest: plan.stripePriceIdYearlyTest || "",
      stripePriceIdMonthlyLive: plan.stripePriceIdMonthlyLive || "",
      stripePriceIdYearlyLive: plan.stripePriceIdYearlyLive || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatPrice = (euros: number) => euros.toFixed(2);

  function SortablePlanCard({ id, children }: { id: string; children: (props: { dragHandleProps: Record<string, unknown> }) => React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };
    return (
      <div ref={setNodeRef} style={style}>
        {children({ dragHandleProps: { ...attributes, ...listeners } })}
      </div>
    );
  }

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-plans-title">
              Forfaits
            </h1>
            <p className="text-muted-foreground">
              Gestion des plans d'abonnement et tarification
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-plan">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau forfait
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Chargement...</div>
        ) : !plans?.length ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Aucun forfait configure.</p>
              <Button onClick={openCreateDialog} className="mt-4">
                Creer un forfait
              </Button>
            </CardContent>
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={plans.map(p => p.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <SortablePlanCard key={plan.id} id={plan.id}>
                    {({ dragHandleProps }: { dragHandleProps: any }) => (
                    <Card data-testid={`card-plan-${plan.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div {...dragHandleProps} className="cursor-grab touch-none">
                              <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <CardTitle>{plan.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {plan.isFree && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Gratuit
                              </Badge>
                            )}
                            {plan.isBestValue && (
                              <Badge className="bg-primary">
                                Meilleur choix
                              </Badge>
                            )}
                            {plan.hasPromo && plan.promoPercent && plan.promoPercent > 0 && (
                              <Badge variant="destructive">
                                -{plan.promoPercent}%
                              </Badge>
                            )}
                            <Badge variant={plan.isActive ? "default" : "secondary"}>
                              {plan.isActive ? "Actif" : "Inactif"}
                            </Badge>
                            {(plan.stripePriceIdMonthlyTest || plan.stripePriceIdMonthlyLive) && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600" title="Paiement en ligne configure">
                                <CreditCard className="h-3 w-3 mr-1" />
                                Stripe
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardDescription>{plan.code}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                  {plan.isFree ? (
                    <div>
                      <p className="text-2xl font-bold">
                        0 €<span className="text-sm font-normal text-muted-foreground">/mois</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Gratuit 30 jours, puis Pro
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold">
                        {plan.monthlyPrice.toFixed(0)} €<span className="text-sm font-normal text-muted-foreground">/mois</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ou {plan.yearlyPrice.toFixed(0)} €/an
                      </p>
                    </div>
                  )}
                  
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}

                  {plan.targetTenantTypes && plan.targetTenantTypes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">Cible:</span>
                      {plan.targetTenantTypes.map((type) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {type === "MAIRIE" ? "Mairie" : type === "EPCI" ? "EPCI" : "Association"}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {catalogFeatures && catalogFeatures.length > 0 ? (
                      <>
                        {catalogFeatures.map((feature) => {
                          const isActive = getAssignedFeatureIds(plan.id).has(feature.id);
                          return (
                            <div key={feature.id} className="flex items-center gap-2 text-sm">
                              {isActive ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className={isActive ? "" : "text-muted-foreground"}>
                                {feature.name}
                              </span>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          {plan.hasIdeas ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
                          <span className={plan.hasIdeas ? "" : "text-muted-foreground"}>Boite a idees</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {plan.hasIncidents ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
                          <span className={plan.hasIncidents ? "" : "text-muted-foreground"}>Signalements</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {plan.hasMeetings ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
                          <span className={plan.hasMeetings ? "" : "text-muted-foreground"}>Evenements</span>
                        </div>
                      </>
                    )}
                  </div>

                  {getEnabledAddons(plan.id).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Options disponibles</p>
                      {getEnabledAddons(plan.id).map((access) => (
                        <div key={access.id} className="flex items-center gap-2 text-sm">
                          <Puzzle className="h-4 w-4 text-primary" />
                          <span>{access.addon.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                        <div className="flex gap-2 pt-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCatalogDialog(plan)}
                            data-testid={`button-catalog-plan-${plan.id}`}
                          >
                            <Settings2 className="h-4 w-4 mr-1" />
                            Fonctionnalites
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddonAccessDialog(plan)}
                            data-testid={`button-addons-plan-${plan.id}`}
                          >
                            <Puzzle className="h-4 w-4 mr-1" />
                            Options
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(plan)}
                            data-testid={`button-edit-plan-${plan.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(plan.id)}
                            data-testid={`button-delete-plan-${plan.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    )}
                  </SortablePlanCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingPlan ? "Modifier le forfait" : "Nouveau forfait"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-plan-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  data-testid="input-plan-code"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px]"
                data-testid="input-plan-description"
              />
            </div>
            
            <div className="grid grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="monthlyPrice">Prix mensuel (€)</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  step="0.01"
                  value={formData.monthlyPriceEuros}
                  onChange={(e) => setFormData({ ...formData, monthlyPriceEuros: parseFloat(e.target.value) || 0 })}
                  data-testid="input-plan-monthly-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearlyPrice">Prix annuel (€)</Label>
                <Input
                  id="yearlyPrice"
                  type="number"
                  step="0.01"
                  value={formData.yearlyPriceEuros}
                  onChange={(e) => setFormData({ ...formData, yearlyPriceEuros: parseFloat(e.target.value) || 0 })}
                  data-testid="input-plan-yearly-price"
                />
              </div>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-plan-active"
                />
                <Label htmlFor="isActive">Actif</Label>
              </div>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  id="isFree"
                  checked={formData.isFree}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFree: checked })}
                  data-testid="switch-plan-free"
                />
                <Label htmlFor="isFree">Gratuit</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Types d'etablissements cibles</p>
                <div className="flex flex-wrap gap-3">
                  {TENANT_TYPE_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`tenant-type-${option.value}`}
                        checked={formData.targetTenantTypes.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              targetTenantTypes: [...formData.targetTenantTypes, option.value],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              targetTenantTypes: formData.targetTenantTypes.filter((t) => t !== option.value),
                            });
                          }
                        }}
                        data-testid={`checkbox-tenant-type-${option.value.toLowerCase()}`}
                      />
                      <Label htmlFor={`tenant-type-${option.value}`} className="text-sm">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Options d'affichage</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isBestValue"
                      checked={formData.isBestValue}
                      onCheckedChange={(checked) => setFormData({ ...formData, isBestValue: checked })}
                      data-testid="switch-plan-best-value"
                    />
                    <Label htmlFor="isBestValue" className="text-sm">Meilleur choix</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="hasPromo"
                      checked={formData.hasPromo}
                      onCheckedChange={(checked) => setFormData({ ...formData, hasPromo: checked })}
                      data-testid="switch-plan-promo"
                    />
                    <Label htmlFor="hasPromo" className="text-sm">En promotion</Label>
                  </div>
                  {formData.hasPromo && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="promoPercent" className="text-sm">Reduction:</Label>
                      <Input
                        id="promoPercent"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.promoPercent}
                        onChange={(e) => setFormData({ ...formData, promoPercent: parseInt(e.target.value) || 0 })}
                        className="w-16 h-8"
                        data-testid="input-plan-promo-percent"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Configuration Stripe (paiement en ligne)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md">
                  <p className="text-xs font-medium text-orange-600">Mode Test</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="stripePriceIdMonthlyTest" className="text-xs">ID Mensuel</Label>
                      <Input
                        id="stripePriceIdMonthlyTest"
                        placeholder="price_..."
                        value={formData.stripePriceIdMonthlyTest}
                        onChange={(e) => setFormData({ ...formData, stripePriceIdMonthlyTest: e.target.value })}
                        className="h-8 text-sm"
                        data-testid="input-stripe-price-monthly-test"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="stripePriceIdYearlyTest" className="text-xs">ID Annuel</Label>
                      <Input
                        id="stripePriceIdYearlyTest"
                        placeholder="price_..."
                        value={formData.stripePriceIdYearlyTest}
                        onChange={(e) => setFormData({ ...formData, stripePriceIdYearlyTest: e.target.value })}
                        className="h-8 text-sm"
                        data-testid="input-stripe-price-yearly-test"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                  <p className="text-xs font-medium text-green-600">Mode Production</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="stripePriceIdMonthlyLive" className="text-xs">ID Mensuel</Label>
                      <Input
                        id="stripePriceIdMonthlyLive"
                        placeholder="price_..."
                        value={formData.stripePriceIdMonthlyLive}
                        onChange={(e) => setFormData({ ...formData, stripePriceIdMonthlyLive: e.target.value })}
                        className="h-8 text-sm"
                        data-testid="input-stripe-price-monthly-live"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="stripePriceIdYearlyLive" className="text-xs">ID Annuel</Label>
                      <Input
                        id="stripePriceIdYearlyLive"
                        placeholder="price_..."
                        value={formData.stripePriceIdYearlyLive}
                        onChange={(e) => setFormData({ ...formData, stripePriceIdYearlyLive: e.target.value })}
                        className="h-8 text-sm"
                        data-testid="input-stripe-price-yearly-live"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-plan"
            >
              {createMutation.isPending || updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Fonctionnalites du forfait : {selectedPlanForCatalog?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <p className="text-sm text-muted-foreground">
              Selectionnez les fonctionnalites du catalogue a inclure dans ce forfait.
            </p>

            {assignmentsLoading ? (
              <div className="text-center text-muted-foreground py-4">Chargement...</div>
            ) : !catalogFeatures?.length ? (
              <div className="text-center text-muted-foreground py-4 border rounded-md">
                Aucune fonctionnalite dans le catalogue. Creez-en d'abord dans la section Fonctionnalites.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {catalogFeatures.map((feature) => (
                  <div 
                    key={feature.id} 
                    className="flex items-center gap-3 p-2 border rounded-md hover-elevate cursor-pointer"
                    onClick={() => toggleFeature(feature.id)}
                    data-testid={`catalog-feature-${feature.id}`}
                  >
                    <Checkbox
                      checked={selectedFeatureIds.has(feature.id)}
                      onCheckedChange={() => toggleFeature(feature.id)}
                      data-testid={`checkbox-feature-${feature.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{feature.name}</div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{feature.code}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 pt-4 border-t gap-2">
            <Button variant="outline" onClick={() => setIsCatalogDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveCatalogFeatures}
              disabled={savePlanFeaturesMutation.isPending}
              data-testid="button-save-catalog-features"
            >
              {savePlanFeaturesMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddonAccessDialogOpen} onOpenChange={setIsAddonAccessDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Options du forfait : {selectedPlanForAddons?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <p className="text-sm text-muted-foreground">
              Activez les options que les clients de ce forfait pourront souscrire.
            </p>

            {!allAddons?.length ? (
              <div className="text-center text-muted-foreground py-4 border rounded-md">
                Aucune option disponible. Creez des addons dans la section Options.
              </div>
            ) : (
              <div className="space-y-2">
                {allAddons.map((addon) => {
                  const isEnabled = selectedAddonIds.has(addon.id);
                  const pricing = addonPricing.get(addon.id);
                  
                  return (
                    <div 
                      key={addon.id} 
                      className="p-3 border rounded-md"
                      data-testid={`addon-access-${addon.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={() => toggleAddon(addon.id)}
                          data-testid={`checkbox-addon-${addon.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{addon.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Defaut: {addon.defaultMonthlyPrice} €/mois, {addon.defaultYearlyPrice} €/an
                          </div>
                        </div>
                        <Badge variant={isEnabled ? "default" : "secondary"} className="shrink-0">
                          {isEnabled ? "Autorise" : "Non autorise"}
                        </Badge>
                        {isEnabled && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">€/mois:</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={addon.defaultMonthlyPrice.toString()}
                                value={pricing?.monthly || ""}
                                onChange={(e) => updateAddonPrice(addon.id, "monthly", e.target.value)}
                                className="h-7 w-20 text-sm"
                                data-testid={`input-price-monthly-${addon.id}`}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">€/an:</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={addon.defaultYearlyPrice.toString()}
                                value={pricing?.yearly || ""}
                                onChange={(e) => updateAddonPrice(addon.id, "yearly", e.target.value)}
                                className="h-7 w-20 text-sm"
                                data-testid={`input-price-yearly-${addon.id}`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 pt-4 border-t gap-2">
            <Button variant="outline" onClick={() => setIsAddonAccessDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveAddonAccess}
              disabled={savePlanAddonAccessMutation.isPending}
              data-testid="button-save-addon-access"
            >
              {savePlanAddonAccessMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
