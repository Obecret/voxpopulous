import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Scale,
  Shield,
  Users,
  Ban,
  Loader2
} from "lucide-react";

interface LegalSettings {
  raisonSociale?: string;
  tribunalCompetent?: string;
  mediateur?: string;
}

export default function CGU() {
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
            <Badge className="mb-4" data-testid="badge-cgu">
              <FileText className="h-3 w-3 mr-1" />
              Conditions generales
            </Badge>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-cgu-title">
              Conditions Generales d'Utilisation et de Vente
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Les presentes conditions regissent l'utilisation de la plateforme Voxpopulous.fr 
              et les relations contractuelles entre Voxpopulous et ses clients.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Derniere mise a jour : Janvier 2026
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
                    <FileText className="h-5 w-5 text-primary" />
                    Article 1 - Objet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Les presentes Conditions Generales d'Utilisation et de Vente (ci-apres "CGU/CGV") ont pour objet 
                    de definir les modalites et conditions d'utilisation de la plateforme Voxpopulous.fr, 
                    ainsi que les droits et obligations des parties dans le cadre de la souscription aux services proposes.
                  </p>
                  <p className="text-muted-foreground">
                    Voxpopulous.fr est une plateforme SaaS de participation citoyenne destinee aux collectivites 
                    territoriales (communes, EPCI) et aux associations, leur permettant de recueillir les propositions, 
                    signalements et avis de leurs membres.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Article 2 - Acceptation des conditions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    L'inscription et l'utilisation de la plateforme impliquent l'acceptation pleine et entiere 
                    des presentes CGU/CGV. Ces conditions sont opposables a l'utilisateur des leur acceptation.
                  </p>
                  <p className="text-muted-foreground">
                    Voxpopulous se reserve le droit de modifier les presentes CGU/CGV a tout moment. 
                    Les utilisateurs seront informes de toute modification par email et/ou par notification 
                    sur la plateforme. L'utilisation continue du service apres notification vaut acceptation 
                    des nouvelles conditions.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Article 3 - Inscription et compte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h4 className="font-semibold">3.1 Eligibilite</h4>
                  <p className="text-muted-foreground">
                    La plateforme est destinee aux :
                  </p>
                  <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                    <li>Communes et EPCI (Etablissements Publics de Cooperation Intercommunale)</li>
                    <li>Associations declarees en prefecture (loi 1901)</li>
                  </ul>

                  <h4 className="font-semibold mt-4">3.2 Creation de compte</h4>
                  <p className="text-muted-foreground">
                    L'inscription necessite la fourniture d'informations exactes et a jour. 
                    Le client s'engage a maintenir ces informations actualisees.
                  </p>

                  <h4 className="font-semibold mt-4">3.3 Securite du compte</h4>
                  <p className="text-muted-foreground">
                    Le client est responsable de la confidentialite de ses identifiants de connexion 
                    et de toutes les activites effectuees sous son compte.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Article 4 - Services proposes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Voxpopulous.fr propose les services suivants :
                  </p>
                  <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                    <li><strong>Boite a idees</strong> : Module de collecte et vote sur les propositions citoyennes</li>
                    <li><strong>Signalements</strong> : Module de remontee d'incidents et problemes</li>
                    <li><strong>Evenements</strong> : Module de gestion des reunions publiques et inscriptions</li>
                    <li><strong>Administration</strong> : Tableau de bord et outils de gestion</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Les fonctionnalites disponibles dependent du plan souscrit (Starter, Standard, Premium).
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Article 5 - Tarifs et paiement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h4 className="font-semibold">5.1 Tarification</h4>
                  <p className="text-muted-foreground">
                    Les tarifs en vigueur sont ceux affiches sur la page tarifaire au moment de la souscription. 
                    Les prix sont indiques en euros hors taxes (HT) et toutes taxes comprises (TTC).
                  </p>

                  <h4 className="font-semibold mt-4">5.2 Periode d'essai</h4>
                  <p className="text-muted-foreground">
                    Une periode d'essai gratuit de 30 jours est proposee. A l'issue de cette periode, 
                    le client peut choisir de souscrire a un abonnement ou de resilier.
                  </p>

                  <h4 className="font-semibold mt-4">5.3 Modes de paiement</h4>
                  <p className="text-muted-foreground">
                    Deux modes de paiement sont acceptes :
                  </p>
                  <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                    <li><strong>Carte bancaire</strong> : Via Stripe, paiement mensuel ou annuel</li>
                    <li><strong>Mandat administratif</strong> : Pour les collectivites publiques, avec emission de facture et delai de paiement de 30 jours</li>
                  </ul>

                  <h4 className="font-semibold mt-4">5.4 Facturation</h4>
                  <p className="text-muted-foreground">
                    Les abonnements sont factures a l'avance (mensuellement ou annuellement selon le choix du client). 
                    Les factures sont envoyees par email et disponibles dans l'espace client.
                  </p>

                  <h4 className="font-semibold mt-4">5.5 Retard de paiement</h4>
                  <p className="text-muted-foreground">
                    En cas de retard de paiement, des penalites de retard pourront etre appliquees conformement 
                    a l'article L.441-10 du Code de commerce. Voxpopulous se reserve le droit de suspendre 
                    l'acces au service apres mise en demeure restee infructueuse.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    Article 6 - Resiliation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h4 className="font-semibold">6.1 Resiliation par le client</h4>
                  <p className="text-muted-foreground">
                    Le client peut resilier son abonnement a tout moment depuis son espace d'administration. 
                    La resiliation prend effet a la fin de la periode de facturation en cours. 
                    Aucun remboursement prorata temporis n'est effectue.
                  </p>

                  <h4 className="font-semibold mt-4">6.2 Resiliation par Voxpopulous</h4>
                  <p className="text-muted-foreground">
                    Voxpopulous peut resilier l'abonnement en cas de :
                  </p>
                  <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                    <li>Non-paiement apres mise en demeure</li>
                    <li>Violation des presentes CGU/CGV</li>
                    <li>Utilisation frauduleuse ou abusive du service</li>
                  </ul>

                  <h4 className="font-semibold mt-4">6.3 Consequences de la resiliation</h4>
                  <p className="text-muted-foreground">
                    A la resiliation, l'acces au service est suspendu. Les donnees sont conservees pendant 30 jours 
                    permettant au client d'exporter ses donnees. Passe ce delai, les donnees sont supprimees, 
                    a l'exception de celles devant etre conservees pour des obligations legales.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Article 7 - Propriete intellectuelle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h4 className="font-semibold">7.1 Plateforme</h4>
                  <p className="text-muted-foreground">
                    L'ensemble des elements constituant la plateforme (logiciel, interface, graphismes, etc.) 
                    est la propriete exclusive de Voxpopulous. Le client dispose d'un droit d'utilisation 
                    non exclusif et non transferable pendant la duree de son abonnement.
                  </p>

                  <h4 className="font-semibold mt-4">7.2 Contenus du client</h4>
                  <p className="text-muted-foreground">
                    Le client reste proprietaire des contenus qu'il publie sur la plateforme. 
                    Il accorde a Voxpopulous une licence d'utilisation limitee aux besoins techniques 
                    de fourniture du service.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-primary" />
                    Article 8 - Obligations et responsabilites
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h4 className="font-semibold">8.1 Obligations du client</h4>
                  <p className="text-muted-foreground">Le client s'engage a :</p>
                  <ul className="list-disc ml-6 text-muted-foreground space-y-1">
                    <li>Utiliser le service conformement a sa destination</li>
                    <li>Ne pas porter atteinte a l'integrite ou au fonctionnement du service</li>
                    <li>Respecter la vie privee et les droits des tiers</li>
                    <li>Ne pas publier de contenus illicites, diffamatoires ou contraires aux bonnes moeurs</li>
                  </ul>

                  <h4 className="font-semibold mt-4">8.2 Responsabilite de Voxpopulous</h4>
                  <p className="text-muted-foreground">
                    Voxpopulous s'engage a fournir un service de qualite avec une disponibilite cible de 99,5%. 
                    La responsabilite de Voxpopulous est limitee au montant des sommes versees par le client 
                    au cours des 12 derniers mois.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Voxpopulous n'est pas responsable des contenus publies par les utilisateurs de la plateforme.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Article 9 - Protection des donnees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Le traitement des donnees personnelles est regi par notre{" "}
                    <a href="/rgpd" className="text-primary hover:underline">Politique de confidentialite RGPD</a>. 
                    Voxpopulous s'engage a respecter le Reglement General sur la Protection des Donnees (RGPD) 
                    et a mettre en oeuvre les mesures techniques et organisationnelles appropriees pour 
                    assurer la securite des donnees.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-primary" />
                    Article 10 - Droit applicable et litiges
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Les presentes CGU/CGV sont soumises au droit francais.
                  </p>
                  <p className="text-muted-foreground">
                    En cas de litige, les parties s'engagent a rechercher une solution amiable avant toute 
                    action judiciaire. A defaut d'accord amiable dans un delai de 30 jours, le litige sera 
                    soumis aux tribunaux competents de {displayValue(settings?.tribunalCompetent)}.
                  </p>
                  <p className="text-muted-foreground">
                    Conformement aux articles L.616-1 et R.616-1 du Code de la consommation, le client peut 
                    recourir gratuitement au service de mediation dont Voxpopulous releve.
                    {settings?.mediateur && (
                      <span className="block mt-2">{settings.mediateur}</span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Article 11 - Dispositions diverses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Si une disposition des presentes CGU/CGV est declaree nulle ou inapplicable, 
                    les autres dispositions resteront en vigueur.
                  </p>
                  <p className="text-muted-foreground">
                    Le fait pour Voxpopulous de ne pas exercer un droit prevu par les presentes CGU/CGV 
                    ne saurait constituer une renonciation a ce droit.
                  </p>
                  <p className="text-muted-foreground">
                    Les presentes CGU/CGV constituent l'integralite de l'accord entre les parties et 
                    remplacent tout accord anterieur.
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
