import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Lock, 
  Eye, 
  Trash2, 
  FileText, 
  Mail, 
  Server,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

interface LegalSettings {
  raisonSociale?: string;
  dpoEmail?: string;
  dpoAdresse?: string;
  hebergeurNom?: string;
  hebergeurAdresse?: string;
}

export default function RGPD() {
  const { data: settings, isLoading } = useQuery<LegalSettings>({
    queryKey: ["/api/public/legal-settings"],
  });

  const displayValue = (value?: string, placeholder: string = "[Non renseigne]") => {
    return value && value.trim() ? value : placeholder;
  };

  return (
    <MainLayout>
      <div className="py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4" data-testid="badge-rgpd">
              <Shield className="h-3 w-3 mr-1" />
              Protection des donnees
            </Badge>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-rgpd-title">
              Politique de confidentialite et RGPD
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Voxpopulous.fr s'engage a proteger vos donnees personnelles conformement au 
              Reglement General sur la Protection des Donnees (RGPD).
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Donnees collectees
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                          Ce que nous ne collectons PAS
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Voxpopulous.fr <strong>ne stocke aucune donnee personnelle</strong> sur les citoyens, 
                          membres ou utilisateurs finaux des organismes clients. Les propositions, signalements 
                          et inscriptions aux evenements sont anonymises ou pseudonymises.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                          Ce que nous collectons
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                          Nous collectons uniquement les donnees necessaires a la gestion des comptes administrateurs :
                        </p>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
                          <li>Pour les <strong>Mairies et EPCI</strong> : nom, prenom et email des elus et agents administratifs designes</li>
                          <li>Pour les <strong>Associations</strong> : nom, prenom et email des membres du bureau (president, tresorier, secretaire)</li>
                          <li>Informations de facturation de l'organisme (SIRET, adresse, coordonnees)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Base legale du traitement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Conformement a l'article 6 du RGPD, nous traitons vos donnees sur les bases legales suivantes :
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">1</span>
                      </div>
                      <div>
                        <strong>Execution du contrat</strong> : Les donnees des administrateurs sont necessaires 
                        pour fournir l'acces a la plateforme et gerer l'abonnement.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">2</span>
                      </div>
                      <div>
                        <strong>Obligations legales</strong> : Conservation des donnees de facturation 
                        conformement au Code de commerce (10 ans).
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">3</span>
                      </div>
                      <div>
                        <strong>Interet legitime</strong> : Amelioration de nos services et support technique.
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Vos droits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Conformement au RGPD, vous disposez des droits suivants sur vos donnees personnelles :
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Droit d'acces</h4>
                      <p className="text-xs text-muted-foreground">
                        Obtenir une copie de vos donnees personnelles
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Droit de rectification</h4>
                      <p className="text-xs text-muted-foreground">
                        Corriger des donnees inexactes ou incompletes
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Droit a l'effacement</h4>
                      <p className="text-xs text-muted-foreground">
                        Demander la suppression de vos donnees
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Droit a la portabilite</h4>
                      <p className="text-xs text-muted-foreground">
                        Recevoir vos donnees dans un format structure
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Droit d'opposition</h4>
                      <p className="text-xs text-muted-foreground">
                        S'opposer au traitement de vos donnees
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-1">Droit a la limitation</h4>
                      <p className="text-xs text-muted-foreground">
                        Limiter le traitement dans certains cas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    Hebergement et securite
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Localisation des donnees</h4>
                      <p className="text-sm text-muted-foreground">
                        Toutes les donnees sont hebergees sur des serveurs situes dans l'Union Europeenne, 
                        garantissant la conformite au RGPD.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Chiffrement</h4>
                      <p className="text-sm text-muted-foreground">
                        Les donnees sont chiffrees en transit (TLS 1.3) et au repos. 
                        Les mots de passe sont hashes avec bcrypt.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Acces restreint</h4>
                      <p className="text-sm text-muted-foreground">
                        Seul le personnel autorise a acces aux donnees, avec tracabilite complete des acces.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Sauvegardes</h4>
                      <p className="text-sm text-muted-foreground">
                        Sauvegardes quotidiennes chiffrees avec conservation de 30 jours.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-primary" />
                    Duree de conservation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-semibold">Type de donnees</th>
                          <th className="text-left py-2 font-semibold">Duree de conservation</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-b">
                          <td className="py-2">Comptes administrateurs actifs</td>
                          <td className="py-2">Duree de l'abonnement + 1 an</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">Donnees de facturation</td>
                          <td className="py-2">10 ans (obligation legale)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">Logs de connexion</td>
                          <td className="py-2">1 an</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">Propositions et signalements</td>
                          <td className="py-2">Duree de l'abonnement (donnees anonymisees)</td>
                        </tr>
                        <tr>
                          <td className="py-2">Cookies de session</td>
                          <td className="py-2">Session uniquement</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Cookies et traceurs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Voxpopulous.fr utilise uniquement des cookies strictement necessaires au fonctionnement du service :
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span><strong>Cookie de session</strong> : Authentification et maintien de la connexion</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span><strong>Preference de theme</strong> : Mode clair ou sombre</span>
                    </li>
                  </ul>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">
                      <strong>Aucun cookie publicitaire ou de pistage n'est utilise.</strong> Nous n'utilisons 
                      pas Google Analytics ni aucun autre outil de tracking tiers.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Sous-traitants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Nous faisons appel aux sous-traitants suivants, tous conformes au RGPD :
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-semibold">Sous-traitant</th>
                          <th className="text-left py-2 font-semibold">Usage</th>
                          <th className="text-left py-2 font-semibold">Localisation</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-b">
                          <td className="py-2">Stripe</td>
                          <td className="py-2">Paiement par carte bancaire</td>
                          <td className="py-2">UE (Ireland)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">Resend</td>
                          <td className="py-2">Envoi d'emails transactionnels</td>
                          <td className="py-2">UE</td>
                        </tr>
                        <tr>
                          <td className="py-2">{displayValue(settings?.hebergeurNom, "Neon (PostgreSQL)")}</td>
                          <td className="py-2">Base de donnees</td>
                          <td className="py-2">UE</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Contact et reclamations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Delegue a la Protection des Donnees (DPO)</h4>
                    <p className="text-sm text-muted-foreground">
                      Pour toute question relative a vos donnees personnelles ou pour exercer vos droits, 
                      vous pouvez nous contacter :
                    </p>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                      <li>Email : <a href={`mailto:${settings?.dpoEmail || 'dpo@voxpopulous.fr'}`} className="text-primary hover:underline">{displayValue(settings?.dpoEmail, "dpo@voxpopulous.fr")}</a></li>
                      <li>Courrier : {displayValue(settings?.dpoAdresse, `${displayValue(settings?.raisonSociale, "Voxpopulous")} - DPO`)}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Autorite de controle</h4>
                    <p className="text-sm text-muted-foreground">
                      Si vous estimez que le traitement de vos donnees constitue une violation du RGPD, 
                      vous pouvez introduire une reclamation aupres de la CNIL :
                    </p>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                      <li>Site : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.cnil.fr</a></li>
                      <li>Telephone : 01 53 73 22 22</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Mise a jour de cette politique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Cette politique de confidentialite peut etre mise a jour pour refleter les evolutions 
                    legales ou les modifications de nos pratiques. La date de derniere mise a jour est 
                    indiquee ci-dessous.
                  </p>
                  <p className="mt-4 text-sm font-semibold">
                    Derniere mise a jour : Janvier 2026
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
