import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, Mail, ArrowLeft, LogIn, Lightbulb, AlertTriangle, Calendar, UserCircle, ArrowRight,
  Music, Palette, Dumbbell, Heart, BookOpen, TreePine, Camera, Utensils, 
  Gamepad2, Bike, Globe, Star, Award, Zap, Coffee, Sparkles, Handshake,
  type LucideIcon
} from "lucide-react";
import type { Tenant, Association, AssociationPhoto, BureauMember, AssociationInterventionDomain } from "@shared/schema";

type BureauMemberWithDomains = BureauMember & { domains?: AssociationInterventionDomain[] };

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

const LOGO_ICONS: Record<string, LucideIcon> = {
  Users, Music, Palette, Dumbbell, Heart, BookOpen, TreePine, Camera, Utensils,
  Gamepad2, Bike, Globe, Star, Award, Zap, Coffee, Sparkles, Handshake
};

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

export default function AssociationLanding() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association, isLoading, error } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const { data: photos = [] } = useQuery<AssociationPhoto[]>({
    queryKey: ["/api/associations", association?.id, "photos"],
    enabled: !!association?.id,
  });

  const { data: bureauMembers } = useQuery<BureauMemberWithDomains[]>({
    queryKey: ["/api/associations", association?.id, "bureau"],
    enabled: !!association?.id,
  });

  const activeBureauMembers = (bureauMembers || []).filter(m => m.isActive).slice(0, 6);

  const featuredPhotos = photos.filter((p) => p.isFeatured).sort((a, b) => a.displayOrder - b.displayOrder);
  const heroImage = featuredPhotos.length > 0 ? getImageUrl(featuredPhotos[currentHeroIndex % featuredPhotos.length].url) : defaultHeroImage;

  useEffect(() => {
    if (featuredPhotos.length > 1) {
      const interval = setInterval(() => {
        setCurrentHeroIndex((prev) => (prev + 1) % featuredPhotos.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [featuredPhotos.length]);

  const basePath = `/structures/${params.slug}/${params.assocSlug}`;

  const features = [
    {
      icon: Lightbulb,
      title: "Boite a idees",
      description: "Proposez vos idees pour ameliorer l'association et votez pour celles que vous soutenez.",
      href: `${basePath}/ideas`,
      cta: "Voir les idees",
      image: ideasImage,
      imageAlt: "Illustration d'une ampoule representant les idees",
    },
    {
      icon: AlertTriangle,
      title: "Signalements",
      description: "Signalez un probleme ou consultez les signalements en cours de traitement.",
      href: `${basePath}/incidents`,
      cta: "Faire un signalement",
      image: incidentsImage,
      imageAlt: "Illustration de signalement de probleme",
    },
    {
      icon: Calendar,
      title: "Evenements",
      description: "Decouvrez les prochains evenements et inscrivez-vous pour y participer.",
      href: `${basePath}/meetings`,
      cta: "Voir les evenements",
      image: meetingsImage,
      imageAlt: "Illustration d'un evenement",
    },
  ];

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

  if (error || !association) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Association introuvable</h1>
          <p className="text-muted-foreground mb-6">
            Cette association n'existe pas ou a ete supprimee.
          </p>
          <Link href={`/structures/${params.slug}`}>
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour a la commune
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const customColors = {
    primary: association.primaryColor || undefined,
    secondary: association.secondaryColor || undefined,
    accent: association.accentColor || undefined,
    background: association.backgroundColor || undefined,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {association.logoUrl ? (
              <img 
                src={getImageUrl(association.logoUrl)} 
                alt={association.name} 
                className="h-10 w-10 rounded-full object-cover"
                data-testid="img-association-logo"
              />
            ) : association.logoIcon && ACTIVITY_IMAGES[association.logoIcon] ? (
              <img 
                src={ACTIVITY_IMAGES[association.logoIcon]} 
                alt={association.name} 
                className="h-10 w-10 rounded-full object-cover"
                data-testid="img-association-logo"
              />
            ) : (
              <div 
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: customColors.primary ? `${customColors.primary.slice(0, 7)}20` : 'hsl(var(--primary) / 0.1)' }}
              >
                <Users className="h-5 w-5" style={{ color: customColors.primary ? customColors.primary.slice(0, 7) : 'hsl(var(--primary))' }} />
              </div>
            )}
            <div>
              <h1 className="font-semibold" data-testid="text-association-name">{association.name}</h1>
              {tenant && <p className="text-sm text-muted-foreground">Commune de {tenant.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/structures/${params.slug}`}>
              <Button variant="ghost" size="sm" data-testid="button-back-to-commune">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Commune
              </Button>
            </Link>
            <Link href={`${basePath}/login`}>
              <Button variant="outline" size="sm" data-testid="button-login">
                <LogIn className="h-4 w-4 mr-2" />
                Connexion
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${heroImage})` }}
          data-testid="hero-background"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-white mb-6">
              <Users className="h-4 w-4" />
              Association
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl" data-testid="text-hero-title">
              Bienvenue a{" "}
              <span style={{ color: customColors.accent ? customColors.accent.slice(0, 7) : 'hsl(var(--primary))' }}>
                {association.name}
              </span>
            </h1>
            <p className="mt-6 text-lg text-white/90 max-w-xl" data-testid="text-hero-description">
              {association.description || "Participez a la vie de votre association. Proposez des idees, signalez des problemes ou inscrivez-vous aux evenements."}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href={`${basePath}/ideas`}>
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
              <Link href={`${basePath}/bureau`}>
                <Button size="lg" variant="outline" className="gap-2 bg-white/10 backdrop-blur-sm border-white/20 text-white" data-testid="button-hero-bureau">
                  <UserCircle className="h-5 w-5" />
                  Le bureau
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {featuredPhotos.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {featuredPhotos.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentHeroIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentHeroIndex ? "bg-white w-6" : "bg-white/50"
                }`}
                data-testid={`hero-dot-${index}`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-4" data-testid="text-features-title">
              Comment participer ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Trois outils simples pour vous exprimer et contribuer a la vie associative.
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
                      data-testid={`button-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
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

      {activeBureauMembers.length > 0 && (
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-foreground mb-4">
                <Users className="h-4 w-4" />
                Le bureau
              </div>
              <h2 className="font-display text-3xl font-bold mb-4" data-testid="text-bureau-title">
                Notre equipe
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Decouvrez les membres du bureau qui font vivre votre association.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeBureauMembers.map((member) => (
                <Link key={member.id} href={`${basePath}/bureau/${member.id}`}>
                  <Card className="group hover-elevate h-full" data-testid={`card-bureau-${member.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage 
                            src={getPhotoUrl(member.photoObjectPath, member.photoUrl)} 
                            alt={`${member.firstName} ${member.lastName}`} 
                          />
                          <AvatarFallback className="text-lg bg-primary/10 text-primary">
                            {getInitials(member.firstName, member.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate" data-testid={`text-bureau-name-${member.id}`}>
                            {member.firstName} {member.lastName}
                          </h3>
                          {member.function && (
                            <p className="text-muted-foreground text-sm truncate">
                              {member.function}
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
              <Link href={`${basePath}/bureau`}>
                <Button variant="outline" className="gap-2" data-testid="button-view-all-bureau">
                  Voir tout le bureau
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {association.contactEmail && (
        <section className="py-16 md:py-20 bg-background">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center mb-12">
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-4" data-testid="text-contact-title">
                Nous contacter
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Vous avez une question ? N'hesitez pas a nous contacter.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <a 
                href={`mailto:${association.contactEmail}`}
                className="flex items-center gap-3 px-6 py-4 rounded-xl bg-muted/50 hover-elevate"
                data-testid="link-contact-email"
              >
                <Mail className="h-5 w-5" style={{ color: customColors.primary ? customColors.primary.slice(0, 7) : 'hsl(var(--primary))' }} />
                <span>{association.contactEmail}</span>
              </a>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t py-8 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{association.name}</span>
              {tenant && (
                <>
                  <span className="mx-2">|</span>
                  <span>Commune de {tenant.name}</span>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Propulse par{" "}
              <a href="/" className="text-primary hover:underline">
                Voxpopulous.fr
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
