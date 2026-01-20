import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupFormSchema, type SignupForm, type SubscriptionPlan, type SignupPaymentMethod } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft, Eye, EyeOff, Check, CreditCard, FileText, Info } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type TenantType = "MAIRIE" | "EPCI" | "ASSOCIATION";

interface PlanWithFeatures extends SubscriptionPlan {
  catalogFeatures?: any[];
}

const tenantTypeLabels: Record<TenantType, string> = {
  MAIRIE: "Commune / Mairie",
  EPCI: "EPCI",
  ASSOCIATION: "Association",
};

export default function SignupAccount() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const planId = searchParams.get("plan");
  const tenantType = searchParams.get("type") as TenantType | null;
  const communes = parseInt(searchParams.get("communes") || "0");
  const associations = parseInt(searchParams.get("associations") || "0");
  const adminsFromUrl = parseInt(searchParams.get("admins") || "1");
  const admins = Math.max(1, adminsFromUrl);

  const [success, setSuccess] = useState<{ slug: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const { data: allPlans } = useQuery<PlanWithFeatures[]>({
    queryKey: ["/api/public/plans-catalog"],
  });

  const plan = allPlans?.find(p => p.id === planId);

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      tenantType: tenantType || ("MAIRIE" as TenantType),
      planId: planId || "",
      communeName: "",
      epci: "",
      slug: "",
      adminEmail: "",
      adminName: "",
      password: "",
      confirmPassword: "",
      communesCount: communes,
      associationsCount: associations,
      adminsCount: admins,
      paymentMethod: "STRIPE" as SignupPaymentMethod,
      billingInterval: "monthly",
      mandateDetails: undefined,
    },
  });

  const paymentMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (paymentMethod === "ADMINISTRATIVE_MANDATE") {
      form.setValue("billingInterval", "yearly");
      if (!form.getValues("mandateDetails")) {
        form.setValue("mandateDetails", {
          siret: "",
        });
      }
    } else if (paymentMethod === "STRIPE") {
      form.setValue("mandateDetails", undefined);
    }
  }, [paymentMethod, form]);


  const password = form.watch("password");

  const passwordChecks = {
    minLength: password.length >= 10,
    uppercase: (password.match(/[A-Z]/g) || []).length >= 2,
    lowercase: (password.match(/[a-z]/g) || []).length >= 2,
    number: /[0-9]/.test(password),
    special: (password.match(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/g) || []).length >= 2,
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  const handleCommuneNameChange = (value: string, onChange: (value: string) => void) => {
    const currentSlug = form.getValues("slug");
    const previousName = form.getValues("communeName");
    const expectedSlug = generateSlug(previousName);
    onChange(value);
    if (!currentSlug || currentSlug === expectedSlug) {
      form.setValue("slug", generateSlug(value));
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      const { confirmPassword, ...submitData } = data;
      const response = await apiRequest("POST", "/api/signup", submitData);
      return response.json();
    },
    onSuccess: (data) => {
      setSuccess({ slug: data.slug });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupForm) => {
    mutation.mutate(data);
  };

  const onFormError = (errors: any) => {
    console.log("Form validation errors:", errors);
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => `${field}: ${error?.message || 'erreur'}`)
      .join(', ');
    toast({
      title: "Formulaire incomplet",
      description: errorMessages || "Veuillez remplir tous les champs obligatoires",
      variant: "destructive",
    });
  };

  if (!planId || !tenantType) {
    return (
      <MainLayout>
        <section className="py-20">
          <div className="mx-auto max-w-lg px-4 text-center">
            <h1 className="font-display text-2xl font-bold mb-4">Parametres manquants</h1>
            <p className="text-muted-foreground mb-8">
              Veuillez d'abord selectionner un forfait.
            </p>
            <Link href="/signup">
              <Button>Commencer l'inscription</Button>
            </Link>
          </div>
        </section>
      </MainLayout>
    );
  }

  if (success) {
    return (
      <MainLayout>
        <section className="py-20 md:py-32">
          <div className="mx-auto max-w-lg px-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-4" data-testid="text-success-title">
              Compte cree avec succes !
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Votre espace Voxpopulous.fr est pret. Vous pouvez maintenant vous connecter 
              a votre espace d'administration.
            </p>
            {paymentMethod === "ADMINISTRATIVE_MANDATE" && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                      Prochaine etape : completez vos informations
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Pour finaliser votre inscription par mandat administratif, rendez-vous dans 
                      <strong> Parametres &gt; Facturation</strong> de votre espace d'administration 
                      pour completer vos informations de facturation (adresse, contact comptable, Chorus Pro...).
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <Link href={`/structures/${success.slug}/admin/login`}>
                <Button size="lg" className="gap-2" data-testid="button-go-admin">
                  Acceder a l'administration
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <div className="text-sm text-muted-foreground">
                Votre page citoyenne:{" "}
                <Link href={`/structures/${success.slug}`} className="text-primary hover:underline">
                  /structures/{success.slug}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-lg px-4">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold" data-testid="text-account-title">
              Finalisez votre inscription
            </h1>
            <p className="mt-2 text-muted-foreground">
              Essai gratuit de 30 jours, sans engagement
            </p>
          </div>

          <div className="flex items-center justify-between mb-6">
            <Link href={`/subscribe/options?plan=${planId}&type=${tenantType}`}>
              <Button variant="ghost" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{tenantTypeLabels[tenantType]}</Badge>
              <Badge variant="outline">{plan?.name}</Badge>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
              <Card>
                <CardHeader>
                  <CardTitle>Informations de votre structure</CardTitle>
                  <CardDescription>
                    Renseignez les informations de votre {tenantType === "MAIRIE" ? "commune" : tenantType === "EPCI" ? "EPCI" : "association"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="communeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {tenantType === "MAIRIE" ? "Nom de la commune" : tenantType === "EPCI" ? "Nom de l'EPCI" : "Nom de l'association"}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={tenantType === "MAIRIE" ? "Ex: Saint-Martin-de-Crau" : tenantType === "EPCI" ? "Ex: Communaute d'agglomeration du Grand Paris" : "Ex: Les Amis de la Nature"}
                            {...field} 
                            onChange={(e) => handleCommuneNameChange(e.target.value, field.onChange)}
                            data-testid="input-commune-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {tenantType === "MAIRIE" && (
                    <FormField
                      control={form.control}
                      name="epci"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EPCI de rattachement (optionnel)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ex: Communaute de communes des Alpilles"
                              {...field}
                              data-testid="input-epci"
                            />
                          </FormControl>
                          <FormDescription>
                            Indiquez l'intercommunalite dont vous faites partie
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identifiant URL</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="text-sm text-muted-foreground mr-2">/structures/</span>
                            <Input 
                              placeholder="votre-commune"
                              {...field}
                              data-testid="input-slug"
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          L'adresse web de votre espace citoyen
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-4">Compte administrateur</h3>
                    
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="adminName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom complet</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Jean Dupont"
                                {...field}
                                data-testid="input-admin-name"
                              />
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
                              <Input 
                                type="email"
                                placeholder="jean.dupont@mairie.fr"
                                {...field}
                                data-testid="input-admin-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mot de passe</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Votre mot de passe"
                                  {...field}
                                  data-testid="input-password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <div className="mt-2 space-y-1 text-xs">
                              <div className={passwordChecks.minLength ? "text-green-600" : "text-muted-foreground"}>
                                {passwordChecks.minLength ? <Check className="inline h-3 w-3 mr-1" /> : "○"} Au moins 10 caracteres
                              </div>
                              <div className={passwordChecks.uppercase ? "text-green-600" : "text-muted-foreground"}>
                                {passwordChecks.uppercase ? <Check className="inline h-3 w-3 mr-1" /> : "○"} Au moins 2 majuscules
                              </div>
                              <div className={passwordChecks.lowercase ? "text-green-600" : "text-muted-foreground"}>
                                {passwordChecks.lowercase ? <Check className="inline h-3 w-3 mr-1" /> : "○"} Au moins 2 minuscules
                              </div>
                              <div className={passwordChecks.number ? "text-green-600" : "text-muted-foreground"}>
                                {passwordChecks.number ? <Check className="inline h-3 w-3 mr-1" /> : "○"} Au moins 1 chiffre
                              </div>
                              <div className={passwordChecks.special ? "text-green-600" : "text-muted-foreground"}>
                                {passwordChecks.special ? <Check className="inline h-3 w-3 mr-1" /> : "○"} Au moins 2 caracteres speciaux
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer le mot de passe</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="Confirmez votre mot de passe"
                                  {...field}
                                  data-testid="input-confirm-password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-4">Mode de paiement</h3>
                    
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="grid grid-cols-1 gap-3"
                            >
                              <div className={`flex items-center space-x-3 p-4 border rounded-md cursor-pointer ${field.value === "STRIPE" ? "border-primary bg-primary/5" : "border-border"}`}>
                                <RadioGroupItem value="STRIPE" id="stripe" data-testid="radio-stripe" />
                                <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-primary" />
                                    <span className="font-medium">Paiement par carte bancaire</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Paiement securise par Stripe. Facturation mensuelle ou annuelle.
                                  </p>
                                </Label>
                              </div>
                              
                              <div className={`flex items-center space-x-3 p-4 border rounded-md cursor-pointer ${field.value === "ADMINISTRATIVE_MANDATE" ? "border-primary bg-primary/5" : "border-border"}`}>
                                <RadioGroupItem value="ADMINISTRATIVE_MANDATE" id="mandate" data-testid="radio-mandate" />
                                <Label htmlFor="mandate" className="flex-1 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <span className="font-medium">Mandat administratif</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Pour les organismes publics et associations. Facturation annuelle sur bon de commande.
                                  </p>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {paymentMethod === "ADMINISTRATIVE_MANDATE" && (
                      <div className="mt-4 space-y-4 p-4 bg-muted/50 rounded-md">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Info className="h-4 w-4" />
                          <span>Le mandat administratif necessite un abonnement annuel. Vous pourrez completer les informations de facturation (adresse, contact comptable, Chorus Pro) dans votre espace d'administration apres inscription.</span>
                        </div>

                        <FormField
                          control={form.control}
                          name="mandateDetails.siret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SIRET de la collectivite *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345678901234"
                                  maxLength={14}
                                  {...field}
                                  data-testid="input-siret"
                                />
                              </FormControl>
                              <FormDescription>14 chiffres sans espaces</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full gap-2" 
                    disabled={mutation.isPending}
                    data-testid="button-submit"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creation en cours...
                      </>
                    ) : (
                      <>
                        Creer mon espace
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </div>
      </section>
    </MainLayout>
  );
}
