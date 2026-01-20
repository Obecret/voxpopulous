import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  User, 
  Server, 
  Mail,
  FileText,
  Loader2
} from "lucide-react";

interface LegalSettings {
  raisonSociale?: string;
  formeJuridique?: string;
  capitalSocial?: string;
  siret?: string;
  rcsVille?: string;
  rcsNumero?: string;
  tvaIntracommunautaire?: string;
  siegeAdresse?: string;
  directeurNom?: string;
  directeurFonction?: string;
  contactEmail?: string;
  contactPhone?: string;
  hebergeurNom?: string;
  hebergeurAdresse?: string;
  tribunalCompetent?: string;
}

export default function MentionsLegales() {
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
            <Badge className="mb-4" data-testid="badge-mentions">
              <FileText className="h-3 w-3 mr-1" />
              Informations legales
            </Badge>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-mentions-title">
              Mentions legales
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Conformement aux dispositions de la loi n°2004-575 du 21 juin 2004 pour la confiance 
              dans l'economie numerique, il est porte a la connaissance des utilisateurs les presentes mentions legales.
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
                    <Building2 className="h-5 w-5 text-primary" />
                    Editeur du site
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Raison sociale</h4>
                      <p className="text-sm text-muted-foreground">{displayValue(settings?.raisonSociale)}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Forme juridique</h4>
                      <p className="text-sm text-muted-foreground">{displayValue(settings?.formeJuridique)}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Capital social</h4>
                      <p className="text-sm text-muted-foreground">{displayValue(settings?.capitalSocial)}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">SIRET</h4>
                      <p className="text-sm text-muted-foreground">{displayValue(settings?.siret)}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">RCS</h4>
                      <p className="text-sm text-muted-foreground">
                        {settings?.rcsVille && settings?.rcsNumero 
                          ? `${settings.rcsVille} ${settings.rcsNumero}` 
                          : displayValue(undefined)}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">TVA intracommunautaire</h4>
                      <p className="text-sm text-muted-foreground">{displayValue(settings?.tvaIntracommunautaire)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <h4 className="font-semibold text-sm mb-1">Siege social</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{displayValue(settings?.siegeAdresse)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Directeur de la publication
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Le directeur de la publication est {displayValue(settings?.directeurNom)}, 
                    en qualite de {displayValue(settings?.directeurFonction)}.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    Hebergement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Hebergeur</h4>
                      <p className="text-sm text-muted-foreground">{displayValue(settings?.hebergeurNom, "Replit, Inc.")}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Adresse</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {displayValue(settings?.hebergeurAdresse, "1450 Veterans Blvd. Suite 200\nRedwood City, CA 94063, USA")}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Les donnees sont hebergees sur des serveurs situes dans l'Union Europeenne, 
                    conformement aux exigences du RGPD.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Contact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>
                      <strong>Email :</strong>{" "}
                      {settings?.contactEmail ? (
                        <a href={`mailto:${settings.contactEmail}`} className="text-primary hover:underline">
                          {settings.contactEmail}
                        </a>
                      ) : (
                        <a href="mailto:contact@voxpopulous.fr" className="text-primary hover:underline">
                          contact@voxpopulous.fr
                        </a>
                      )}
                    </li>
                    <li>
                      <strong>Telephone :</strong> {displayValue(settings?.contactPhone)}
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Propriete intellectuelle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    L'ensemble du contenu du site Voxpopulous.fr (textes, images, graphismes, logo, icones, 
                    logiciels, etc.) est la propriete exclusive de {displayValue(settings?.raisonSociale, "l'editeur")} ou de ses partenaires, 
                    a l'exception des marques, logos ou contenus appartenant a d'autres societes partenaires 
                    ou auteurs.
                  </p>
                  <p className="text-muted-foreground">
                    Toute reproduction, representation, modification, publication, adaptation de tout ou partie 
                    des elements du site, quel que soit le moyen ou le procede utilise, est interdite, 
                    sauf autorisation ecrite prealable de {displayValue(settings?.raisonSociale, "l'editeur")}.
                  </p>
                  <p className="text-muted-foreground">
                    Toute exploitation non autorisee du site ou de l'un quelconque des elements qu'il contient 
                    sera consideree comme constitutive d'une contrefacon et poursuivie conformement aux 
                    dispositions des articles L.335-2 et suivants du Code de la Propriete Intellectuelle.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Limitation de responsabilite
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    {displayValue(settings?.raisonSociale, "L'editeur")} ne pourra etre tenue responsable des dommages directs et indirects 
                    causes au materiel de l'utilisateur, lors de l'acces au site Voxpopulous.fr, et resultant 
                    soit de l'utilisation d'un materiel ne repondant pas aux specifications indiquees, 
                    soit de l'apparition d'un bug ou d'une incompatibilite.
                  </p>
                  <p className="text-muted-foreground">
                    {displayValue(settings?.raisonSociale, "L'editeur")} ne pourra egalement etre tenue responsable des dommages indirects 
                    (tels par exemple qu'une perte de marche ou perte d'une chance) consecutifs a l'utilisation 
                    du site Voxpopulous.fr.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Droit applicable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Tout litige en relation avec l'utilisation du site Voxpopulous.fr est soumis au droit francais. 
                    En dehors des cas ou la loi ne le permet pas, il est fait attribution exclusive de juridiction 
                    aux tribunaux competents de {displayValue(settings?.tribunalCompetent)}.
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
