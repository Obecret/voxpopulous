import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, Palette, Building2, Save, Loader2, RefreshCw, User, CreditCard, Shield, Server, AlertTriangle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const THEMES = [
  { key: "blue", name: "Bleu Ocean", primary: "221 83% 53%", accent: "199 89% 48%" },
  { key: "green", name: "Vert Nature", primary: "142 76% 36%", accent: "158 64% 52%" },
  { key: "purple", name: "Violet Royal", primary: "271 91% 65%", accent: "262 83% 58%" },
  { key: "orange", name: "Orange Soleil", primary: "24 95% 53%", accent: "38 92% 50%" },
  { key: "red", name: "Rouge Passion", primary: "0 84% 60%", accent: "348 83% 47%" },
  { key: "teal", name: "Turquoise", primary: "173 80% 40%", accent: "181 69% 47%" },
  { key: "pink", name: "Rose Elegance", primary: "330 81% 60%", accent: "322 81% 43%" },
  { key: "slate", name: "Gris Moderne", primary: "215 16% 47%", accent: "215 20% 65%" },
];

interface ThemeSettings {
  themeKey: string;
}

interface CompanySettings {
  id?: string;
  companyName?: string;
  formeJuridique?: string;
  capitalSocial?: string;
  address?: string;
  siret?: string;
  siren?: string;
  rcsVille?: string;
  rcsNumero?: string;
  tvaNumber?: string;
  iban?: string;
  bic?: string;
  email?: string;
  phone?: string;
  website?: string;
  directeurNom?: string;
  directeurFonction?: string;
  dpoEmail?: string;
  dpoAdresse?: string;
  mediateur?: string;
  tribunalCompetent?: string;
  hebergeurNom?: string;
  hebergeurAdresse?: string;
  paymentTerms?: string;
  legalMentions?: string;
}

export default function SuperadminConfiguration() {
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanySettings>({
    companyName: "",
    formeJuridique: "",
    capitalSocial: "",
    address: "",
    siret: "",
    siren: "",
    rcsVille: "",
    rcsNumero: "",
    tvaNumber: "",
    email: "",
    phone: "",
    website: "",
    iban: "",
    bic: "",
    directeurNom: "",
    directeurFonction: "",
    dpoEmail: "",
    dpoAdresse: "",
    mediateur: "",
    tribunalCompetent: "",
    hebergeurNom: "",
    hebergeurAdresse: "",
    paymentTerms: "Paiement a 30 jours",
    legalMentions: "",
  });

  const { data: themeSettings, isLoading: themeLoading } = useQuery<ThemeSettings>({
    queryKey: ["/api/superadmin/settings/theme"],
  });

  const { data: companySettings, isLoading: companyLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/superadmin/settings/company"],
  });

  const { data: stripeModeData, isLoading: stripeModeLoading } = useQuery<{ stripeMode: 'test' | 'live' }>({
    queryKey: ["/api/superadmin/settings/stripe-mode"],
  });

  useEffect(() => {
    if (themeSettings?.themeKey && selectedTheme === null) {
      setSelectedTheme(themeSettings.themeKey);
    }
  }, [themeSettings, selectedTheme]);

  useEffect(() => {
    if (companySettings && companySettings.id) {
      setCompanyForm({
        companyName: companySettings.companyName || "",
        formeJuridique: companySettings.formeJuridique || "",
        capitalSocial: companySettings.capitalSocial || "",
        address: companySettings.address || "",
        siret: companySettings.siret || "",
        siren: companySettings.siren || "",
        rcsVille: companySettings.rcsVille || "",
        rcsNumero: companySettings.rcsNumero || "",
        tvaNumber: companySettings.tvaNumber || "",
        email: companySettings.email || "",
        phone: companySettings.phone || "",
        website: companySettings.website || "",
        iban: companySettings.iban || "",
        bic: companySettings.bic || "",
        directeurNom: companySettings.directeurNom || "",
        directeurFonction: companySettings.directeurFonction || "",
        dpoEmail: companySettings.dpoEmail || "",
        dpoAdresse: companySettings.dpoAdresse || "",
        mediateur: companySettings.mediateur || "",
        tribunalCompetent: companySettings.tribunalCompetent || "",
        hebergeurNom: companySettings.hebergeurNom || "",
        hebergeurAdresse: companySettings.hebergeurAdresse || "",
        paymentTerms: companySettings.paymentTerms || "Paiement a 30 jours",
        legalMentions: companySettings.legalMentions || "",
      });
    }
  }, [companySettings]);

  const updateThemeMutation = useMutation({
    mutationFn: async (themeKey: string) => {
      const res = await apiRequest("PUT", "/api/superadmin/settings/theme", { themeKey });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/theme"] });
      toast({ title: "Theme mis a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le theme", variant: "destructive" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: CompanySettings) => {
      const res = await apiRequest("PUT", "/api/superadmin/settings/company", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/company"] });
      toast({ title: "Informations enregistrees avec succes" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour les informations", variant: "destructive" });
    },
  });

  const syncDocumentsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/superadmin/settings/company/sync-documents", {});
      return res.json();
    },
    onSuccess: (data: { quotesUpdated: number; invoicesUpdated: number; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/invoices"] });
      toast({ 
        title: "Documents synchronises", 
        description: `${data.quotesUpdated} devis et ${data.invoicesUpdated} factures ont ete mis a jour` 
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de synchroniser les documents", variant: "destructive" });
    },
  });

  const updateStripeModeMutation = useMutation({
    mutationFn: async (stripeMode: 'test' | 'live') => {
      const res = await apiRequest("PUT", "/api/superadmin/settings/stripe-mode", { stripeMode });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings/stripe-mode"] });
      toast({ 
        title: "Mode Stripe mis a jour", 
        description: data.stripeMode === 'live' 
          ? "Attention: Vous utilisez maintenant les cles de production" 
          : "Mode test active - les paiements sont simules"
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de changer le mode Stripe", variant: "destructive" });
    },
  });

  const currentTheme = themeSettings?.themeKey || "blue";
  const currentStripeMode = stripeModeData?.stripeMode || 'test';
  const activeSelection = selectedTheme || currentTheme;

  const handleSelectTheme = (themeKey: string) => {
    setSelectedTheme(themeKey);
  };

  const handleSaveTheme = () => {
    if (activeSelection) {
      updateThemeMutation.mutate(activeSelection);
    }
  };

  const handleSaveCompany = () => {
    updateCompanyMutation.mutate(companyForm);
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-configuration-title">
            Configuration
          </h1>
          <p className="text-muted-foreground">
            Configurez les informations de votre societe et l'apparence de la plateforme
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informations de l'entreprise
            </CardTitle>
            <CardDescription>
              Ces informations sont utilisees sur les devis, factures et pages legales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {companyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    Identite de la societe
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Raison sociale</Label>
                      <Input
                        id="companyName"
                        value={companyForm.companyName}
                        onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                        placeholder="Voxpopulous SAS"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formeJuridique">Forme juridique</Label>
                      <Input
                        id="formeJuridique"
                        value={companyForm.formeJuridique}
                        onChange={(e) => setCompanyForm({ ...companyForm, formeJuridique: e.target.value })}
                        placeholder="SAS, SARL, etc."
                        data-testid="input-forme-juridique"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capitalSocial">Capital social</Label>
                      <Input
                        id="capitalSocial"
                        value={companyForm.capitalSocial}
                        onChange={(e) => setCompanyForm({ ...companyForm, capitalSocial: e.target.value })}
                        placeholder="10 000 euros"
                        data-testid="input-capital-social"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="siret">SIRET</Label>
                      <Input
                        id="siret"
                        value={companyForm.siret}
                        onChange={(e) => setCompanyForm({ ...companyForm, siret: e.target.value })}
                        placeholder="123 456 789 00012"
                        data-testid="input-company-siret"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="siren">SIREN</Label>
                      <Input
                        id="siren"
                        value={companyForm.siren}
                        onChange={(e) => setCompanyForm({ ...companyForm, siren: e.target.value })}
                        placeholder="123 456 789"
                        data-testid="input-company-siren"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tvaNumber">TVA intracommunautaire</Label>
                      <Input
                        id="tvaNumber"
                        value={companyForm.tvaNumber}
                        onChange={(e) => setCompanyForm({ ...companyForm, tvaNumber: e.target.value })}
                        placeholder="FR12345678901"
                        data-testid="input-company-tva"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rcsVille">RCS - Ville</Label>
                      <Input
                        id="rcsVille"
                        value={companyForm.rcsVille}
                        onChange={(e) => setCompanyForm({ ...companyForm, rcsVille: e.target.value })}
                        placeholder="Paris"
                        data-testid="input-rcs-ville"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rcsNumero">RCS - Numero</Label>
                      <Input
                        id="rcsNumero"
                        value={companyForm.rcsNumero}
                        onChange={(e) => setCompanyForm({ ...companyForm, rcsNumero: e.target.value })}
                        placeholder="B 123 456 789"
                        data-testid="input-rcs-numero"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tribunalCompetent">Tribunal competent</Label>
                      <Input
                        id="tribunalCompetent"
                        value={companyForm.tribunalCompetent}
                        onChange={(e) => setCompanyForm({ ...companyForm, tribunalCompetent: e.target.value })}
                        placeholder="Paris"
                        data-testid="input-tribunal"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse du siege social</Label>
                    <Textarea
                      id="address"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      placeholder="123 Rue de la Republique&#10;75001 Paris&#10;France"
                      rows={3}
                      data-testid="input-company-address"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    Contact et direction
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email de contact</Label>
                      <Input
                        id="email"
                        type="email"
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                        placeholder="contact@voxpopulous.fr"
                        data-testid="input-company-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telephone</Label>
                      <Input
                        id="phone"
                        value={companyForm.phone}
                        onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                        placeholder="+33 1 23 45 67 89"
                        data-testid="input-company-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Site web</Label>
                      <Input
                        id="website"
                        value={companyForm.website}
                        onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                        placeholder="https://voxpopulous.fr"
                        data-testid="input-company-website"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="directeurNom">Directeur de publication - Nom</Label>
                      <Input
                        id="directeurNom"
                        value={companyForm.directeurNom}
                        onChange={(e) => setCompanyForm({ ...companyForm, directeurNom: e.target.value })}
                        placeholder="Jean Dupont"
                        data-testid="input-directeur-nom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="directeurFonction">Directeur de publication - Fonction</Label>
                      <Input
                        id="directeurFonction"
                        value={companyForm.directeurFonction}
                        onChange={(e) => setCompanyForm({ ...companyForm, directeurFonction: e.target.value })}
                        placeholder="President"
                        data-testid="input-directeur-fonction"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    Informations bancaires
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="iban">IBAN</Label>
                      <Input
                        id="iban"
                        value={companyForm.iban}
                        onChange={(e) => setCompanyForm({ ...companyForm, iban: e.target.value })}
                        placeholder="FR76 1234 5678 9012 3456 7890 123"
                        data-testid="input-company-iban"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bic">BIC</Label>
                      <Input
                        id="bic"
                        value={companyForm.bic}
                        onChange={(e) => setCompanyForm({ ...companyForm, bic: e.target.value })}
                        placeholder="BNPAFRPP"
                        data-testid="input-company-bic"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="paymentTerms">Conditions de paiement</Label>
                      <Input
                        id="paymentTerms"
                        value={companyForm.paymentTerms}
                        onChange={(e) => setCompanyForm({ ...companyForm, paymentTerms: e.target.value })}
                        placeholder="Paiement a 30 jours"
                        data-testid="input-company-payment-terms"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    RGPD et Mediation
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dpoEmail">DPO - Email</Label>
                      <Input
                        id="dpoEmail"
                        type="email"
                        value={companyForm.dpoEmail}
                        onChange={(e) => setCompanyForm({ ...companyForm, dpoEmail: e.target.value })}
                        placeholder="dpo@voxpopulous.fr"
                        data-testid="input-dpo-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dpoAdresse">DPO - Adresse</Label>
                      <Input
                        id="dpoAdresse"
                        value={companyForm.dpoAdresse}
                        onChange={(e) => setCompanyForm({ ...companyForm, dpoAdresse: e.target.value })}
                        placeholder="Voxpopulous - DPO, 123 Rue..."
                        data-testid="input-dpo-adresse"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="mediateur">Mediateur de la consommation</Label>
                      <Textarea
                        id="mediateur"
                        value={companyForm.mediateur}
                        onChange={(e) => setCompanyForm({ ...companyForm, mediateur: e.target.value })}
                        placeholder="Nom et coordonnees du mediateur de la consommation"
                        rows={2}
                        data-testid="input-mediateur"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Server className="h-4 w-4" />
                    Hebergement
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="hebergeurNom">Hebergeur - Nom</Label>
                      <Input
                        id="hebergeurNom"
                        value={companyForm.hebergeurNom}
                        onChange={(e) => setCompanyForm({ ...companyForm, hebergeurNom: e.target.value })}
                        placeholder="Replit, Inc."
                        data-testid="input-hebergeur-nom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hebergeurAdresse">Hebergeur - Adresse</Label>
                      <Input
                        id="hebergeurAdresse"
                        value={companyForm.hebergeurAdresse}
                        onChange={(e) => setCompanyForm({ ...companyForm, hebergeurAdresse: e.target.value })}
                        placeholder="1450 Veterans Blvd, Redwood City, CA"
                        data-testid="input-hebergeur-adresse"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="legalMentions">Mentions legales supplementaires</Label>
                  <Textarea
                    id="legalMentions"
                    value={companyForm.legalMentions}
                    onChange={(e) => setCompanyForm({ ...companyForm, legalMentions: e.target.value })}
                    placeholder="Autres mentions legales specifiques..."
                    rows={3}
                    data-testid="input-company-legal"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => syncDocumentsMutation.mutate()}
                    disabled={syncDocumentsMutation.isPending || !companySettings?.companyName}
                    data-testid="button-sync-documents"
                  >
                    {syncDocumentsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Synchronisation...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Appliquer aux documents existants
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSaveCompany}
                    disabled={updateCompanyMutation.isPending}
                    data-testid="button-save-company"
                  >
                    {updateCompanyMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Mode Stripe
            </CardTitle>
            <CardDescription>
              Basculez entre le mode test et le mode production pour les paiements Stripe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stripeModeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-md border">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Mode actuel:</span>
                      {currentStripeMode === 'live' ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          PRODUCTION
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          TEST
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {currentStripeMode === 'live' 
                        ? "Les paiements reels sont actives. Les cartes seront debitees."
                        : "Mode test active. Utilisez les cartes de test Stripe (ex: 4242 4242 4242 4242)."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${currentStripeMode === 'test' ? 'font-medium' : 'text-muted-foreground'}`}>
                    Test
                  </span>
                  <Switch
                    checked={currentStripeMode === 'live'}
                    onCheckedChange={(checked) => {
                      updateStripeModeMutation.mutate(checked ? 'live' : 'test');
                    }}
                    disabled={updateStripeModeMutation.isPending}
                    data-testid="switch-stripe-mode"
                  />
                  <span className={`text-sm ${currentStripeMode === 'live' ? 'font-medium' : 'text-muted-foreground'}`}>
                    Live
                  </span>
                </div>
              </div>
            )}
            {currentStripeMode === 'live' && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Attention: Mode Production actif</p>
                  <p className="text-muted-foreground">
                    Les transactions seront reelles et les cartes de vos clients seront debitees. 
                    Assurez-vous que vos cles API Stripe Live sont correctement configurees.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme de couleurs
            </CardTitle>
            <CardDescription>
              Choisissez le theme de couleurs principal de la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {themeLoading ? (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  {THEMES.map((theme) => {
                    const isSelected = activeSelection === theme.key;
                    const isCurrent = currentTheme === theme.key;
                    return (
                      <button
                        key={theme.key}
                        onClick={() => handleSelectTheme(theme.key)}
                        className={`relative flex flex-col items-center justify-center p-4 rounded-md border-2 transition-all ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover-elevate"
                        }`}
                        data-testid={`button-theme-${theme.key}`}
                      >
                        <div className="flex gap-2 mb-3">
                          <div
                            className="w-8 h-8 rounded-full"
                            style={{ backgroundColor: `hsl(${theme.primary})` }}
                          />
                          <div
                            className="w-8 h-8 rounded-full"
                            style={{ backgroundColor: `hsl(${theme.accent})` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{theme.name}</span>
                        {isCurrent && (
                          <span className="text-xs text-muted-foreground mt-1">(actuel)</span>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Theme selectionne: <span className="font-medium">{THEMES.find(t => t.key === activeSelection)?.name}</span>
                  </p>
                  <Button
                    onClick={handleSaveTheme}
                    disabled={updateThemeMutation.isPending || activeSelection === currentTheme}
                    data-testid="button-save-theme"
                  >
                    {updateThemeMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperadminLayout>
  );
}
