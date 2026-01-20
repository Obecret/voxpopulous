import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lightbulb, AlertTriangle, Calendar, ArrowRight, Users, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import type { Tenant, TenantPhoto, Association, ElectedOfficial, TenantInterventionDomain } from "@shared/schema";

type ElectedOfficialWithDomains = ElectedOfficial & { domains?: TenantInterventionDomain[] };

function getPhotoUrl(photoObjectPath: string | null | undefined, photoUrl: string | null | undefined): string | undefined {
  if (photoObjectPath) {
    const parts = photoObjectPath.split('/');
    const uploadsIndex = parts.findIndex(p => p === 'uploads');
    if (uploadsIndex !== -1) {
      return '/objects/' + parts.slice(uploadsIndex).join('/');
    }
  }
  return photoUrl || undefined;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const ACTIVITY_IMAGES: Record<string, string> = {
  Users: "/activity-images/community_charity_volunteers.png",
  Football: "/activity-images/football_soccer_action_shot.png",
  Basketball: "/activity-images/basketball_players_in_action.png",
  Tennis: "/activity-images/tennis_player_serving.png",
  Swimming: "/activity-images/swimming_pool_athletes.png",
  Athletics: "/activity-images/athletics_track_runners.png",
  Cycling: "/activity-images/road_cycling_race.png",
  Dance: "/activity-images/dance_performance_artistic.png",
  MartialArts: "/activity-images/martial_arts_training.png",
  Music: "/activity-images/orchestra_music_performance.png",
  Palette: "/activity-images/artist_painting_studio.png",
  Theater: "/activity-images/theater_stage_performance.png",
  Camera: "/activity-images/photography_creative_session.png",
  BookOpen: "/activity-images/book_club_reading_group.png",
  TreePine: "/activity-images/nature_conservation_volunteers.png",
  Gamepad2: "/activity-images/chess_club_gaming_activity.png",
  Handshake: "/activity-images/community_charity_volunteers.png",
  Heart: "/activity-images/community_charity_volunteers.png",
  Dumbbell: "/activity-images/martial_arts_training.png",
  Bike: "/activity-images/road_cycling_race.png",
  Globe: "/activity-images/community_charity_volunteers.png",
  Star: "/activity-images/theater_stage_performance.png",
  Award: "/activity-images/athletics_track_runners.png",
  Zap: "/activity-images/martial_arts_training.png",
  Coffee: "/activity-images/community_charity_volunteers.png",
  Sparkles: "/activity-images/dance_performance_artistic.png",
  Utensils: "/activity-images/community_charity_volunteers.png",
};

import defaultHeroImage from "@assets/stock_images/french_town_hall_civ_91c606e3.jpg";
import ideasImage from "@assets/stock_images/lightbulb_idea_innov_e084be20.jpg";
import incidentsImage from "@assets/stock_images/road_construction_re_35a7d2df.jpg";
import meetingsImage from "@assets/stock_images/town_hall_meeting_pu_e049155b.jpg";

function getImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("/objects/")) return url;
  if (url.startsWith("http")) return url;
  return `/objects/${url}`;
}

export default function TenantLanding() {
  const params = useParams<{ slug: string }>();
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  const { data: tenant, isLoading, error } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: photos } = useQuery<TenantPhoto[]>({
    queryKey: ["/api/tenants", params.slug, "photos"],
    enabled: !!tenant,
  });

  const { data: associations } = useQuery<Association[]>({
    queryKey: ["/api/tenants", params.slug, "associations"],
    enabled: !!tenant,
  });

  const { data: elus } = useQuery<ElectedOfficialWithDomains[]>({
    queryKey: ["/api/tenants", params.slug, "elus"],
    enabled: !!tenant,
  });

  const activeElus = (elus || []).filter(e => e.isActive).sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 6);

  const featuredPhotos = (photos || []).filter(p => p.isFeatured).sort((a, b) => a.displayOrder - b.displayOrder);
  const heroImage = featuredPhotos.length > 0 ? getImageUrl(featuredPhotos[currentHeroIndex % featuredPhotos.length].url) : defaultHeroImage;

  useEffect(() => {
    if (featuredPhotos.length > 1) {
      const interval = setInterval(() => {
        setCurrentHeroIndex(prev => (prev + 1) % featuredPhotos.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [featuredPhotos.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="h-16 border-b" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Skeleton className="h-12 w-64 mx-auto" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page introuvable</h1>
          <p className="text-muted-foreground mb-4">
            Cette page n'existe pas ou a ete supprimee.
          </p>
          <Link href="/">
            <Button>Retour a l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Lightbulb,
      title: "Proposer une idee",
      description: "Partagez vos idees pour ameliorer la vie locale. Votez pour les propositions qui vous tiennent a coeur.",
      href: `/structures/${params.slug}/ideas`,
      cta: "Voir les idees",
      image: ideasImage,
      imageAlt: "Illustration d'une ampoule representant les idees",
    },
    {
      icon: AlertTriangle,
      title: "Signaler un probleme",
      description: "Signalez un incident : voirie, eclairage, terrain, materiel ou equipement defaillant.",
      href: `/structures/${params.slug}/incidents`,
      cta: "Faire un signalement",
      image: incidentsImage,
      imageAlt: "Illustration de signalement de probleme",
    },
    {
      icon: Calendar,
      title: "Evenements et reunions",
      description: "Inscrivez-vous aux reunions, matchs, spectacles ou autres evenements. Restez informe de l'actualite.",
      href: `/structures/${params.slug}/meetings`,
      cta: "Voir les evenements",
      image: meetingsImage,
      imageAlt: "Illustration d'un evenement",
    },
  ];

  const customColors = {
    primary: tenant.primaryColor || undefined,
    secondary: tenant.secondaryColor || undefined,
    accent: tenant.accentColor || undefined,
    background: tenant.backgroundColor || undefined,
  };

  return (
    <TenantLayout tenant={tenant}>
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div 
          className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-white mb-6">
              <Users className="h-4 w-4" />
              Participation citoyenne
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl" data-testid="text-tenant-title">
              Bienvenue a{" "}
              <span style={{ color: customColors.accent ? customColors.accent.slice(0, 7) : 'hsl(var(--primary))' }}>{tenant.name}</span>
            </h1>
            <p className="mt-6 text-lg text-white/90 max-w-xl" data-testid="text-tenant-subtitle">
              {tenant.presentationText || "Votre voix compte. Participez en proposant vos idees, en signalant des problemes ou en vous inscrivant aux evenements."}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href={`/structures/${params.slug}/ideas`}>
                <Button 
                  size="lg" 
                  className="gap-2" 
                  style={customColors.primary ? { backgroundColor: customColors.primary, borderColor: customColors.primary } : undefined}
                  data-testid="button-hero-ideas"
                >
                  <Lightbulb className="h-5 w-5" />
                  Proposer une idee
                </Button>
              </Link>
              <Link href={`/structures/${params.slug}/incidents`}>
                <Button size="lg" variant="outline" className="gap-2 bg-white/10 backdrop-blur-sm border-white/20 text-white" data-testid="button-hero-incidents">
                  <AlertTriangle className="h-5 w-5" />
                  Signaler un probleme
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-4" data-testid="text-features-title">
              Comment participer ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Trois outils simples pour vous exprimer et contribuer a la vie locale.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="group hover-elevate overflow-hidden" data-testid={`card-feature-${index}`}>
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={feature.image} 
                    alt={feature.imageAlt}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    data-testid={`img-feature-${index}`}
                  />
                </div>
                <CardContent className="p-6">
                  <div 
                    className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                    style={{ 
                      backgroundColor: customColors.primary ? `${customColors.primary.slice(0, 7)}15` : 'hsl(var(--primary) / 0.1)',
                      color: customColors.primary ? customColors.primary.slice(0, 7) : 'hsl(var(--primary))'
                    }}
                  >
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-xl mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground mb-6">{feature.description}</p>
                  <Link href={feature.href}>
                    <Button 
                      className="gap-2 w-full" 
                      style={customColors.primary ? { backgroundColor: customColors.primary, borderColor: customColors.primary } : undefined}
                      data-testid={`button-${feature.title.toLowerCase().replace(/ /g, '-')}`}
                    >
                      {feature.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {activeElus.length > 0 && (
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-foreground mb-4">
                <Users className="h-4 w-4" />
                {tenant.tenantType === "EPCI" ? "Les elus" : "Le conseil municipal"}
              </div>
              <h2 className="font-display text-3xl font-bold mb-4" data-testid="text-team-title">
                {tenant.tenantType === "EPCI" ? "Nos elus" : "Votre equipe municipale"}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Decouvrez les elus qui representent votre collectivite.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeElus.map((elu) => (
                <Link key={elu.id} href={`/structures/${params.slug}/elus/${elu.id}`}>
                  <Card className="group hover-elevate h-full" data-testid={`card-elu-${elu.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage 
                            src={getPhotoUrl(elu.photoObjectPath, elu.photoUrl)} 
                            alt={`${elu.firstName} ${elu.lastName}`} 
                          />
                          <AvatarFallback className="text-lg bg-primary/10 text-primary">
                            {getInitials(elu.firstName, elu.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate" data-testid={`text-elu-name-${elu.id}`}>
                            {elu.firstName} {elu.lastName}
                          </h3>
                          {elu.function && (
                            <p className="text-muted-foreground text-sm truncate">
                              {elu.function}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href={`/structures/${params.slug}/elus`}>
                <Button variant="outline" className="gap-2" data-testid="button-view-all-elus">
                  Voir tous les elus
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {associations && associations.length > 0 && (
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-foreground mb-4">
                <Building2 className="h-4 w-4" />
                Nos associations
              </div>
              <h2 className="font-display text-3xl font-bold mb-4" data-testid="text-associations-title">
                Associations locales
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Decouvrez les associations de notre commune et participez a leurs activites.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {associations.map((assoc) => (
                <Link key={assoc.id} href={`/structures/${params.slug}/${assoc.slug}`}>
                  <Card className="group hover-elevate h-full" data-testid={`card-association-${assoc.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden">
                          {assoc.logoUrl ? (
                            <img 
                              src={getImageUrl(assoc.logoUrl)} 
                              alt={assoc.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (assoc as any).logoIcon && ACTIVITY_IMAGES[(assoc as any).logoIcon] ? (
                            <img 
                              src={ACTIVITY_IMAGES[(assoc as any).logoIcon]} 
                              alt={assoc.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div 
                              className="h-full w-full flex items-center justify-center"
                              style={{ 
                                backgroundColor: assoc.primaryColor ? `${assoc.primaryColor.slice(0, 7)}15` : 'hsl(var(--primary) / 0.1)',
                                color: assoc.primaryColor ? assoc.primaryColor.slice(0, 7) : 'hsl(var(--primary))'
                              }}
                            >
                              <Building2 className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1 truncate" data-testid={`text-association-name-${assoc.id}`}>
                            {assoc.name}
                          </h3>
                          {assoc.description && (
                            <p className="text-muted-foreground text-sm line-clamp-2">
                              {assoc.description}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 md:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-4" data-testid="text-about-title">
                A propos de cet outil
              </h2>
              <p className="text-muted-foreground mb-4">
                Voxpopulous.fr est une plateforme de participation citoyenne mise a disposition 
                par votre commune ou association. Elle vous permet de vous exprimer de maniere simple et 
                transparente sur les sujets qui vous concernent.
              </p>
              <p className="text-muted-foreground">
                Toutes les contributions sont transmises aux responsables pour etude. 
                Ensemble, construisons une structure plus proche de ses membres.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl overflow-hidden aspect-square">
                <img 
                  src={ideasImage} 
                  alt="Participation citoyenne - Idees"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="rounded-xl overflow-hidden aspect-square mt-8">
                <img 
                  src={meetingsImage} 
                  alt="Participation citoyenne - Reunions"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </TenantLayout>
  );
}
