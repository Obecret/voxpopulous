import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Building2, 
  Users, 
  Heart, 
  CreditCard, 
  FileText, 
  ArrowRight,
  CheckCircle,
  Sparkles,
  Settings,
  UserPlus
} from "lucide-react";

export default function Guide() {
  return (
    <MainLayout>
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4" data-testid="text-guide-title">
              Guide d'utilisation
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Tout ce que vous devez savoir pour demarrer avec Voxpopulous selon votre type d'organisation.
            </p>
          </div>
        </div>
      </section>

      <section id="essai-gratuit" className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-3xl font-bold">Demarrer l'essai gratuit</h2>
            </div>
            <p className="text-muted-foreground text-lg max-w-3xl">
              Chaque type d'organisation peut beneficier de 30 jours d'essai gratuit pour tester toutes les fonctionnalites.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card data-testid="card-trial-mairie">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <CardTitle>Mairies</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Cliquez sur "Essai gratuit" et selectionnez "Mairie"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Renseignez le nom de votre commune et votre SIRET</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Choisissez votre forfait et mode de paiement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Acces immediat pendant 30 jours</span>
                  </li>
                </ul>
                <Link href="/signup?type=MAIRIE">
                  <Button className="w-full gap-2" data-testid="button-trial-mairie">
                    Essayer maintenant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="card-trial-epci">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle>EPCI</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Cliquez sur "Essai gratuit" et selectionnez "EPCI"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Renseignez le nom de l'EPCI et votre SIRET</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Ajoutez vos communes membres ensuite</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Gerez les abonnements de toutes vos structures</span>
                  </li>
                </ul>
                <Link href="/signup?type=EPCI">
                  <Button className="w-full gap-2" data-testid="button-trial-epci">
                    Essayer maintenant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="card-trial-association">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Heart className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle>Associations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Cliquez sur "Essai gratuit" et selectionnez "Association"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Renseignez le nom de votre association</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Optionnel : associez-vous a une mairie ou EPCI</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Acces immediat pendant 30 jours</span>
                  </li>
                </ul>
                <Link href="/signup?type=ASSOCIATION">
                  <Button className="w-full gap-2" data-testid="button-trial-association">
                    Essayer maintenant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="paiement" className="py-16 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-3xl font-bold">Modes de paiement</h2>
            </div>
            <p className="text-muted-foreground text-lg max-w-3xl">
              Deux options de paiement adaptees aux besoins du secteur public et prive.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-2" data-testid="card-payment-stripe">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Paiement par carte bancaire</CardTitle>
                    <CardDescription>Via Stripe - Paiement securise</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Paiement immediat par carte bancaire</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Renouvellement automatique de l'abonnement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Factures disponibles dans votre espace client</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Ideal pour les associations et petites structures</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 dark:border-purple-800" data-testid="card-payment-mandate">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Mandat administratif</CardTitle>
                    <CardDescription>Pour le secteur public francais</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Paiement apres service rendu (30 jours)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Compatible Chorus Pro pour les collectivites</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Devis et bons de commande fournis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Ideal pour les mairies et EPCI</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-3xl font-bold">Gerer vos fonctionnalites</h2>
            </div>
            <p className="text-muted-foreground text-lg max-w-3xl">
              Chaque forfait inclut un ensemble de fonctionnalites. Voici comment les configurer.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Boite a idees</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Activez la boite a idees pour permettre a vos membres de proposer des ameliorations.</p>
                <p>Configurez les categories, moderez les propositions et suivez les votes.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Signalements</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Permettez aux citoyens de signaler des problemes : voirie, eclairage, materiel...</p>
                <p>Suivez les signalements, assignez-les et mettez a jour leur statut.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evenements</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Organisez reunions, matchs, spectacles avec inscription en ligne.</p>
                <p>Gerez les places disponibles et les inscriptions.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Elus / Membres du bureau</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Presentez vos elus (mairies) ou membres du bureau (associations).</p>
                <p>Ajoutez photos, fonctions et domaines d'intervention.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personnalisation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Personnalisez votre page aux couleurs de votre structure.</p>
                <p>Ajoutez votre logo, photos et texte de presentation.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Administrateurs</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Ajoutez plusieurs administrateurs pour gerer votre espace.</p>
                <p>Definissez les permissions selon les besoins.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="structures-enfants" className="py-16 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-3xl font-bold">Gestion des structures enfants</h2>
            </div>
            <p className="text-muted-foreground text-lg max-w-3xl">
              Les EPCI et mairies peuvent creer et gerer des structures rattachees.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-2 border-purple-200 dark:border-purple-800" data-testid="card-epci-children">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>EPCI : gerez vos mairies et associations</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  En tant qu'EPCI, vous pouvez creer des comptes pour vos communes membres et associations du territoire.
                </p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Mairies rattachees :</strong> Creez des comptes mairie dans l'onglet "Communes" de votre administration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Associations :</strong> Creez des comptes association dans l'onglet "Associations"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Facturation centralisee :</strong> Une seule facture pour l'ensemble des structures</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Quota partage :</strong> Le quota d'associations est partage entre l'EPCI et ses structures</span>
                  </li>
                </ul>
                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <p className="text-sm">
                    <strong>Comment faire ?</strong> Connectez-vous a votre espace admin, puis rendez-vous dans "Communes" pour ajouter une mairie ou "Associations" pour ajouter une association. Ces structures n'auront pas de menu de facturation - tout est gere par l'EPCI.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 dark:border-blue-800" data-testid="card-mairie-children">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Mairies : gerez vos associations</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  En tant que mairie, vous pouvez creer des comptes pour les associations de votre commune.
                </p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Associations rattachees :</strong> Creez des comptes association dans l'onglet "Associations"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Facturation centralisee :</strong> La mairie paie pour ses associations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Quota d'associations :</strong> Selon votre forfait, un nombre d'associations est inclus</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Ajout de quota :</strong> Besoin de plus d'associations ? Ajoutez des options dans votre facturation</span>
                  </li>
                </ul>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-sm">
                    <strong>Comment faire ?</strong> Connectez-vous a votre espace admin, puis rendez-vous dans "Associations" pour creer un compte association. L'association recevra ses identifiants et pourra gerer son propre espace sans s'occuper de la facturation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Des questions ?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Notre equipe est la pour vous accompagner dans la mise en place de votre espace de participation citoyenne.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact">
              <Button size="lg" variant="outline" className="gap-2" data-testid="button-guide-contact">
                Nous contacter
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" className="gap-2" data-testid="button-guide-signup">
                Commencer l'essai gratuit
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
