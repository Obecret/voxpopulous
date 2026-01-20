import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, ShoppingCart, Loader2, CreditCard, FileText, Building2, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SubscriptionPlan, Addon, PlanAddonAccess } from "@shared/schema";
import { planThemes, type OrganizationType } from "@/lib/plan-themes";

type PlanAddonAccessWithAddon = PlanAddonAccess & { addon: Addon };
type PlanWithAddons = SubscriptionPlan & { addonAccess: PlanAddonAccessWithAddon[] };

const organizationSchema = z.object({
  organizationType: z.enum(["mairie", "association"]),
  organizationName: z.string().min(2, "Le nom doit faire au moins 2 caracteres"),
  slug: z.string().min(2, "L'identifiant doit faire au moins 2 caracteres").regex(/^[a-z0-9-]+$/, "Uniquement des lettres minuscules, chiffres et tirets"),
  contactEmail: z.string().email("Email invalide"),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  siret: z.string().optional(),
  adminName: z.string().min(2, "Le nom doit faire au moins 2 caracteres"),
  adminEmail: z.string().email("Email invalide"),
  adminPassword: z.string().min(8, "Le mot de passe doit faire au moins 8 caracteres"),
  adminPasswordConfirm: z.string(),
  paymentMethod: z.enum(["stripe", "administrative"]),
}).refine((data) => data.adminPassword === data.adminPasswordConfirm, {
  message: "Les mots de passe ne correspondent pas",
  path: ["adminPasswordConfirm"],
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      planId: searchParams.get("plan"),
      tenantType: (searchParams.get("type") || "MAIRIE") as OrganizationType,
      communes: parseInt(searchParams.get("communes") || "0") || 0,
      associations: parseInt(searchParams.get("associations") || "0") || 0,
      admins: parseInt(searchParams.get("admins") || "0") || 0,
    };
  }, []);
  const planId = urlParams.planId;
  const theme = planThemes[urlParams.tenantType] || planThemes.MAIRIE;
  const ThemeIcon = theme.icon;
  
  const [step, setStep] = useState(1);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [addonQuantities, setAddonQuantities] = useState<Map<string, number>>(new Map());
  const [initialized, setInitialized] = useState(false);

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    mode: "onSubmit",
    defaultValues: {
      organizationType: "mairie",
      organizationName: "",
      slug: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      city: "",
      postalCode: "",
      siret: "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
      adminPasswordConfirm: "",
      paymentMethod: "stripe",
    },
  });

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/public/plans"],
  });

  const { data: plansWithAddons } = useQuery<PlanWithAddons[]>({
    queryKey: ["/api/public/plans-with-addons"],
  });

  const { data: addons } = useQuery<Addon[]>({
    queryKey: ["/api/public/addons"],
  });

  const selectedPlan = plans?.find(p => p.id === planId);
  const planWithAddons = plansWithAddons?.find(p => p.id === planId);
  const enabledAddons = planWithAddons?.addonAccess?.filter(a => a.isEnabled) || [];

  // Auto-generate slug from organization name
  const watchedName = form.watch("organizationName");
  const [userEditedSlug, setUserEditedSlug] = useState(false);
  
  useEffect(() => {
    if (watchedName && !userEditedSlug) {
      const slug = watchedName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  }, [watchedName, userEditedSlug]);

  // Initialize addon quantities from URL params
  useEffect(() => {
    if (enabledAddons.length > 0 && !initialized && addons) {
      const initialQuantities = new Map<string, number>();
      enabledAddons.forEach(access => {
        const addon = addons?.find(a => a.id === access.addonId);
        if (!addon) return;
        
        // Only enabled addons can have quantities set
        if (addon.code === "ADMIN") {
          initialQuantities.set(access.addonId, Math.max(0, urlParams.admins));
        } else if (addon.code === "ASSOCIATIONS") {
          initialQuantities.set(access.addonId, Math.max(0, urlParams.associations));
        } else if (addon.code === "MAIRIES") {
          initialQuantities.set(access.addonId, Math.max(0, urlParams.communes));
        } else {
          initialQuantities.set(access.addonId, 0);
        }
      });
      setAddonQuantities(initialQuantities);
      setInitialized(true);
    }
  }, [enabledAddons, addons, urlParams, initialized]);

  // Subscription creation mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: OrganizationFormData) => {
      // Filter to only enabled addons with quantity > 0
      const addonSelections = Array.from(addonQuantities.entries())
        .filter(([addonId, quantity]) => {
          const isEnabled = enabledAddons.some(a => a.addonId === addonId);
          return isEnabled && quantity > 0;
        })
        .map(([addonId, quantity]) => ({ addonId, quantity }));

      const response = await apiRequest("POST", "/api/public/subscribe", {
        planId,
        billingPeriod,
        addonSelections,
        organization: {
          type: data.organizationType,
          name: data.organizationName,
          slug: data.slug,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          address: data.address,
          city: data.city,
          postalCode: data.postalCode,
          siret: data.siret,
        },
        admin: {
          name: data.adminName,
          email: data.adminEmail,
          password: data.adminPassword,
        },
        paymentMethod: data.paymentMethod,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.quoteId) {
        toast({
          title: "Demande enregistree",
          description: "Un devis vous sera envoye par email sous 24h.",
        });
        navigate(`/subscribe/confirmation?quote=${data.quoteId}`);
      } else {
        navigate(`/structures/${data.slug}/admin`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const isAdminAddon = (addonId: string): boolean => {
    const addon = addons?.find(a => a.id === addonId);
    return addon?.code === "ADMIN";
  };

  const getAddonUnitPrice = (addonId: string): number => {
    // Check for plan-specific override, otherwise use addon default
    const access = planWithAddons?.addonAccess?.find(a => a.addonId === addonId);
    const addon = addons?.find(a => a.id === addonId);
    if (!addon) return 0;
    
    if (billingPeriod === "yearly") {
      return access?.yearlyPrice ?? addon.defaultYearlyPrice;
    }
    return access?.monthlyPrice ?? addon.defaultMonthlyPrice;
  };

  const getAddonPrice = (addonId: string, quantity: number): number => {
    if (quantity <= 0) return 0;
    const unitPrice = getAddonUnitPrice(addonId);
    return unitPrice * quantity;
  };

  const calculateAddonsCost = (): number => {
    let total = 0;
    addonQuantities.forEach((quantity, addonId) => {
      const isEnabled = enabledAddons.some(a => a.addonId === addonId);
      if (isEnabled) {
        total += getAddonPrice(addonId, quantity);
      }
    });
    return total;
  };

  const getBasePlanPrice = (): number => {
    if (!selectedPlan) return 0;
    // All prices are in EUROS
    return billingPeriod === "yearly" ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
  };

  const getTotalPrice = (): number => {
    return getBasePlanPrice() + calculateAddonsCost();
  };

  const updateQuantity = (addonId: string, delta: number) => {
    setAddonQuantities(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(addonId) || 0;
      const newValue = Math.max(0, current + delta);
      newMap.set(addonId, newValue);
      return newMap;
    });
  };

  const setQuantity = (addonId: string, value: number) => {
    setAddonQuantities(prev => {
      const newMap = new Map(prev);
      const newValue = Math.max(0, value);
      newMap.set(addonId, newValue);
      return newMap;
    });
  };

  const onSubmit = (data: OrganizationFormData) => {
    createSubscriptionMutation.mutate(data);
  };

  const handleSubmitClick = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      const errors = form.formState.errors;
      console.log("Form validation errors:", errors);
      const errorMessages = Object.entries(errors)
        .map(([field, error]) => `${field}: ${error?.message || 'erreur'}`)
        .join(', ');
      toast({
        title: "Formulaire incomplet",
        description: errorMessages || "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }
    form.handleSubmit(onSubmit)();
  };

  const goToStep2 = () => {
    setStep(2);
    window.scrollTo(0, 0);
  };

  const goToStep1 = () => {
    setStep(1);
    window.scrollTo(0, 0);
  };

  if (plansLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!planId || !selectedPlan) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto py-20 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Aucun forfait selectionne</h1>
          <p className="text-muted-foreground mb-6">
            Veuillez choisir un forfait sur notre page tarifs pour continuer.
          </p>
          <Button asChild data-testid="button-back-to-pricing">
            <Link href="/pricing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voir les forfaits
            </Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div 
          className="rounded-lg px-6 py-6 text-white mb-8"
          style={{ background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})` }}
        >
          <Link href="/pricing" className="text-sm opacity-80 hover:opacity-100 inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" />
            Retour aux tarifs
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <ThemeIcon className="h-6 w-6" />
            <span className="text-sm font-medium uppercase tracking-wide opacity-90">{theme.label}</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="text-subscribe-title">
            {step === 1 ? "Configurez votre abonnement" : "Finalisez votre inscription"}
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`flex items-center gap-2`} style={{ color: step >= 1 ? theme.colors.primary : undefined }}>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium`}
              style={step >= 1 ? { backgroundColor: theme.colors.primary, color: 'white' } : undefined}
            >
              1
            </div>
            <span className="hidden sm:inline">Forfait et options</span>
          </div>
          <div className="flex-1 h-px bg-border" />
          <div className={`flex items-center gap-2`} style={{ color: step >= 2 ? theme.colors.primary : undefined }}>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step < 2 ? "bg-muted" : ""}`}
              style={step >= 2 ? { backgroundColor: theme.colors.primary, color: 'white' } : undefined}
            >
              2
            </div>
            <span className="hidden sm:inline">Organisation et paiement</span>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {step === 1 ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                      <span>Forfait {selectedPlan.name}</span>
                      <Badge style={{ backgroundColor: theme.colors.badgeBg, color: theme.colors.badgeText }}>{selectedPlan.code}</Badge>
                    </CardTitle>
                    {selectedPlan.description && (
                      <CardDescription>{selectedPlan.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 mb-4">
                      <Button
                        variant={billingPeriod === "monthly" ? "default" : "outline"}
                        onClick={() => setBillingPeriod("monthly")}
                        data-testid="button-billing-monthly"
                      >
                        Mensuel
                      </Button>
                      <Button
                        variant={billingPeriod === "yearly" ? "default" : "outline"}
                        onClick={() => setBillingPeriod("yearly")}
                        data-testid="button-billing-yearly"
                      >
                        Annuel
                        {selectedPlan.monthlyPrice > 0 && selectedPlan.yearlyPrice > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            -{Math.round((1 - selectedPlan.yearlyPrice / (selectedPlan.monthlyPrice * 12)) * 100)}%
                          </Badge>
                        )}
                      </Button>
                    </div>
                    <p className="text-2xl font-bold">
                      {getBasePlanPrice().toFixed(0)} EUR
                      <span className="text-sm font-normal text-muted-foreground">
                        /{billingPeriod === "monthly" ? "mois" : "an"}
                      </span>
                    </p>
                  </CardContent>
                </Card>

                {enabledAddons.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Options disponibles</CardTitle>
                      <CardDescription>
                        Ajustez les quantites selon vos besoins
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {enabledAddons.map(access => {
                        const addon = addons?.find(a => a.id === access.addonId);
                        if (!addon) return null;

                        const isAdmin = addon.code === "ADMIN";
                        const quantity = addonQuantities.get(access.addonId) || 0;
                        const unitPrice = getAddonUnitPrice(access.addonId);
                        const totalPrice = getAddonPrice(access.addonId, quantity);

                        return (
                          <div key={access.id} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">
                                  {isAdmin ? "Administrateurs supplementaires" : addon.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {isAdmin ? "1 admin inclus dans le forfait - " : ""}
                                  {unitPrice} EUR/unite/{billingPeriod === "monthly" ? "mois" : "an"}
                                </p>
                              </div>
                              {quantity > 0 && (
                                <div className="text-right">
                                  <p className="font-bold">{totalPrice.toFixed(0)} EUR</p>
                                  <p className="text-xs text-muted-foreground">
                                    /{billingPeriod === "monthly" ? "mois" : "an"}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Label className="text-sm">
                                {isAdmin ? "Admin supp.:" : "Quantite:"}
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(access.addonId, -1)}
                                  disabled={quantity <= 0}
                                  data-testid={`button-decrease-${addon.code}`}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  min={0}
                                  value={quantity}
                                  onChange={(e) => setQuantity(access.addonId, parseInt(e.target.value) || 0)}
                                  className="w-20 text-center"
                                  data-testid={`input-quantity-${addon.code}`}
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(access.addonId, 1)}
                                  data-testid={`button-increase-${addon.code}`}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              {isAdmin && quantity > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  (Total: {quantity + 1} admins)
                                </span>
                              )}
                            </div>

                            <Separator />
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Votre organisation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="organizationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type d'organisation</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-organization-type">
                                  <SelectValue placeholder="Selectionnez le type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="mairie">Mairie / Commune</SelectItem>
                                <SelectItem value="association">Association</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="organizationName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom de l'organisation</FormLabel>
                              <FormControl>
                                <Input placeholder="Mairie de Paris" {...field} data-testid="input-organization-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Identifiant URL</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="mairie-de-paris" 
                                  {...field} 
                                  onChange={(e) => {
                                    setUserEditedSlug(true);
                                    field.onChange(e);
                                  }}
                                  data-testid="input-slug" 
                                />
                              </FormControl>
                              <FormDescription>
                                voxpopulous.fr/structures/{field.value || "..."}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="contactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email de contact</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="contact@mairie.fr" {...field} data-testid="input-contact-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="contactPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telephone (optionnel)</FormLabel>
                              <FormControl>
                                <Input placeholder="01 23 45 67 89" {...field} data-testid="input-contact-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse (optionnel)</FormLabel>
                            <FormControl>
                              <Input placeholder="1 rue de la Mairie" {...field} data-testid="input-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Code postal (optionnel)</FormLabel>
                              <FormControl>
                                <Input placeholder="75001" {...field} data-testid="input-postal-code" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ville (optionnel)</FormLabel>
                              <FormControl>
                                <Input placeholder="Paris" {...field} data-testid="input-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="siret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SIRET (optionnel)</FormLabel>
                            <FormControl>
                              <Input placeholder="123 456 789 00012" {...field} data-testid="input-siret" />
                            </FormControl>
                            <FormDescription>
                              Requis pour les factures officielles
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Compte administrateur
                      </CardTitle>
                      <CardDescription>
                        Ce sera le premier administrateur de votre espace
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="adminName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom complet</FormLabel>
                            <FormControl>
                              <Input placeholder="Jean Dupont" {...field} data-testid="input-admin-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="adminEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="jean.dupont@mairie.fr" {...field} data-testid="input-admin-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="adminPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mot de passe</FormLabel>
                              <FormControl>
                                <PasswordInput placeholder="••••••••" {...field} data-testid="input-admin-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="adminPasswordConfirm"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirmer le mot de passe</FormLabel>
                              <FormControl>
                                <PasswordInput placeholder="••••••••" {...field} data-testid="input-admin-password-confirm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Mode de paiement</CardTitle>
                      <CardDescription>
                        Choisissez comment vous souhaitez regler votre abonnement
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="space-y-4"
                              >
                                <div className="flex items-start space-x-3 p-4 border rounded-md hover-elevate cursor-pointer">
                                  <RadioGroupItem value="stripe" id="stripe" data-testid="radio-payment-stripe" />
                                  <div className="flex-1">
                                    <Label htmlFor="stripe" className="flex items-center gap-2 cursor-pointer">
                                      <CreditCard className="h-4 w-4" />
                                      Carte bancaire
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Paiement securise par Stripe. Prelevement automatique mensuel ou annuel.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start space-x-3 p-4 border rounded-md hover-elevate cursor-pointer">
                                  <RadioGroupItem value="administrative" id="administrative" data-testid="radio-payment-administrative" />
                                  <div className="flex-1">
                                    <Label htmlFor="administrative" className="flex items-center gap-2 cursor-pointer">
                                      <FileText className="h-4 w-4" />
                                      Virement administratif
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Pour les collectivites et associations. Vous recevrez un devis officiel a valider, puis une facture.
                                    </p>
                                  </div>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </form>
              </Form>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Recapitulatif
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Forfait {selectedPlan.name}</span>
                  <span>{getBasePlanPrice().toFixed(0)} EUR</span>
                </div>

                {enabledAddons.map(access => {
                  const addon = addons?.find(a => a.id === access.addonId);
                  if (!addon) return null;
                  const quantity = addonQuantities.get(access.addonId) || 0;
                  if (quantity <= 0) return null;
                  const price = getAddonPrice(access.addonId, quantity);

                  return (
                    <div key={access.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {addon.name} (x{quantity})
                      </span>
                      <span>{price.toFixed(0)} EUR</span>
                    </div>
                  );
                })}

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span data-testid="text-total-price">
                    {getTotalPrice().toFixed(0)} EUR
                    <span className="text-sm font-normal text-muted-foreground">
                      /{billingPeriod === "monthly" ? "mois" : "an"}
                    </span>
                  </span>
                </div>

                {billingPeriod === "yearly" && (
                  <p className="text-xs text-muted-foreground text-center">
                    Soit {(getTotalPrice() / 12).toFixed(0)} EUR/mois
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-3">
                {step === 1 ? (
                  <>
                    <Button 
                      className="w-full text-white border-0" 
                      size="lg" 
                      onClick={goToStep2}
                      style={{ backgroundColor: theme.colors.primary }}
                      data-testid="button-continue-subscription"
                    >
                      Continuer
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Etape suivante: informations de votre organisation
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={goToStep1}
                      data-testid="button-back-to-step1"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Modifier le forfait
                    </Button>
                    <Button 
                      className="w-full text-white border-0" 
                      size="lg"
                      type="button"
                      onClick={() => {
                        console.log("Button clicked!");
                        handleSubmitClick();
                      }}
                      disabled={createSubscriptionMutation.isPending}
                      style={{ backgroundColor: theme.colors.primary }}
                      data-testid="button-submit-subscription"
                    >
                      {createSubscriptionMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Finaliser l'inscription
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      {form.watch("paymentMethod") === "stripe" 
                        ? "Vous serez redirige vers Stripe pour le paiement"
                        : "Un devis vous sera envoye par email"
                      }
                    </p>
                  </>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
