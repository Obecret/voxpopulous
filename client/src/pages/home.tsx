import { Link } from "wouter";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  AlertTriangle, 
  Calendar, 
  ArrowRight, 
  Users, 
  Shield, 
  BarChart3,
  Search,
  Sparkles,
  Building2,
  Heart,
  Zap,
  Globe,
  Lock
} from "lucide-react";

import heroImage1 from "@assets/stock_images/french_town_hall_bui_35a06392.jpg";
import heroImage2 from "@assets/stock_images/french_town_hall_bui_be513a77.jpg";
import heroImage3 from "@assets/stock_images/french_town_hall_bui_683abf54.jpg";
import heroImage4 from "@assets/stock_images/citizens_community_m_ff005690.jpg";
import heroImage5 from "@assets/stock_images/citizens_community_m_ec0bd397.jpg";

import ideaBoxImage from "@assets/generated_images/citizen_idea_box_illustration.png";
import incidentImage from "@assets/generated_images/incident_reporting_illustration.png";
import meetingsImage from "@assets/generated_images/public_meetings_illustration.png";
import engagementImage from "@assets/generated_images/citizen_engagement_illustration.png";
import securityImage from "@assets/generated_images/secure_data_illustration.png";
import dashboardImage from "@assets/generated_images/admin_dashboard_illustration.png";

const heroImages = [heroImage1, heroImage2, heroImage3, heroImage4, heroImage5];

export default function Home() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: Lightbulb,
      title: "Boîte à idées",
      description: "Permettez à vos membres de proposer des idées et de voter pour celles qu'ils soutiennent.",
      image: ideaBoxImage,
      color: "from-amber-500/20 to-orange-500/20",
    },
    {
      icon: AlertTriangle,
      title: "Signalements",
      description: "Facilitez le signalement des problèmes : voirie, éclairage, terrain, matériel ou équipement.",
      image: incidentImage,
      color: "from-red-500/20 to-rose-500/20",
    },
    {
      icon: Calendar,
      title: "Événements et réunions",
      description: "Organisez réunions, matchs, spectacles ou rencontres avec inscription en ligne.",
      image: meetingsImage,
      color: "from-blue-500/20 to-cyan-500/20",
    }
  ];

  const benefits = [
    {
      icon: Users,
      title: "Engagement citoyen",
      description: "Renforcez le lien entre votre structure et vos membres ou administrés.",
      image: engagementImage,
    },
    {
      icon: Shield,
      title: "Données sécurisées",
      description: "Vos données sont sécurisées et protégées selon les normes RGPD.",
      image: securityImage,
    },
    {
      icon: BarChart3,
      title: "Tableau de bord",
      description: "Suivez les propositions et incidents en temps réel, gérez vos événements.",
      image: dashboardImage,
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Inscrivez votre structure",
      description: "Créez votre compte en quelques minutes avec un essai gratuit de 30 jours.",
      icon: Sparkles,
    },
    {
      number: "02",
      title: "Personnalisez votre espace",
      description: "Configurez votre page aux couleurs de votre commune, EPCI ou association.",
      icon: Building2,
    },
    {
      number: "03",
      title: "Engagez vos membres",
      description: "Partagez le lien et recevez les premières contributions.",
      icon: Heart,
    }
  ];

  const stats = [
    { value: "30", label: "jours d'essai gratuit", suffix: "" },
    { value: "100", label: "de satisfaction", suffix: "%" },
    { value: "24/7", label: "disponibilite", suffix: "" },
  ];

  const trustPoints = [
    { icon: Lock, text: "Donnees hebergees en France" },
    { icon: Shield, text: "Conforme RGPD" },
    { icon: Zap, text: "Mise en place en 5 minutes" },
    { icon: Globe, text: "Accessible sur tous les appareils" },
  ];

  return (
    <MainLayout>
      {/* Hero Section - Full impact */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {heroImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentImageIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={image}
                alt={`Illustration ${index + 1}`}
                className="h-full w-full object-cover scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80" />
            </div>
          ))}
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-40" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20">
          <div className="max-w-4xl">
            <Badge className="mb-6 bg-white/10 text-white border-white/20 backdrop-blur-sm px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              Plateforme de participation citoyenne
            </Badge>
            
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight" data-testid="text-hero-title">
              Donnez la parole à vos{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                citoyens
              </span>
            </h1>
            
            <p className="mt-6 text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed" data-testid="text-hero-subtitle">
              La plateforme tout-en-un pour les communes, EPCI et associations qui souhaitent 
              recueillir les idées, signalements et avis de leurs membres.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
              <Link href="/signup">
                <Button size="lg" className="gap-2 text-base px-8 py-6 shadow-lg shadow-primary/25" data-testid="button-hero-signup">
                  Essai gratuit 30 jours
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-white/30 text-white bg-white/5 backdrop-blur-sm text-base px-8 py-6" data-testid="button-hero-pricing">
                  Découvrir les tarifs
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap gap-6">
              {trustPoints.map((point, index) => (
                <div key={index} className="flex items-center gap-2 text-white/70 text-sm">
                  <point.icon className="h-4 w-4 text-primary" />
                  <span>{point.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Citizen search - moved to bottom right */}
          <div className="absolute bottom-8 right-4 md:right-8">
            <Link href="/recherche">
              <Button variant="outline" className="border-white/30 text-white bg-white/10 backdrop-blur-md gap-2" data-testid="button-hero-search">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Trouver votre mairie ou association</span>
                <span className="sm:hidden">Rechercher</span>
              </Button>
            </Link>
          </div>

          {/* Carousel indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? "bg-primary w-8" 
                    : "bg-white/40 w-1.5 hover:bg-white/60"
                }`}
                aria-label={`Image ${index + 1}`}
                data-testid={`button-carousel-dot-${index}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50 border-y">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="font-display text-4xl md:text-5xl font-bold text-primary">
                  {stat.value}{stat.suffix}
                </div>
                <p className="mt-2 text-sm md:text-base text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Modern cards */}
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Fonctionnalites</Badge>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold" data-testid="text-features-title">
              Trois outils essentiels
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Une plateforme complete pour renforcer la participation et 
              ameliorer le quotidien de vos membres.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group overflow-visible hover-elevate border-0 shadow-lg" 
                data-testid={`card-feature-${index}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg">
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${feature.color} to-transparent opacity-60`} />
                  <div className="absolute bottom-4 left-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/90 backdrop-blur-sm text-primary shadow-lg">
                      <feature.icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-xl mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - Modern timeline */}
      <section className="py-24 md:py-32 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Comment ca marche</Badge>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold" data-testid="text-how-title">
              Lancez-vous en 3 etapes
            </h2>
          </div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
            
            <div className="grid gap-12 md:grid-cols-3">
              {steps.map((step, index) => (
                <div key={index} className="relative text-center" data-testid={`step-${index}`}>
                  <div className="relative inline-flex flex-col items-center">
                    <span className="text-6xl font-display font-bold text-primary/10 absolute -top-6 left-1/2 -translate-x-1/2">
                      {step.number}
                    </span>
                    <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 mb-6">
                      <step.icon className="h-7 w-7" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-xl mb-3">{step.title}</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Avantages</Badge>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold" data-testid="text-benefits-title">
              Pourquoi choisir Voxpopulous ?
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {benefits.map((benefit, index) => (
              <Card key={index} className="group overflow-visible hover-elevate border-0 shadow-lg" data-testid={`benefit-${index}`}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg">
                  <img 
                    src={benefit.image} 
                    alt={benefit.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                    <benefit.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* Final CTA Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-primary" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6" data-testid="text-cta-title">
            Prêt à transformer votre collectivité ?
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10">
            Rejoignez les communes et associations qui ont déjà choisi Voxpopulous.fr 
            pour renforcer le dialogue avec leurs membres.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="gap-2 text-base px-8 py-6 shadow-lg" data-testid="button-cta-signup">
                Démarrer l'essai gratuit
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground bg-primary-foreground/5 text-base px-8 py-6" data-testid="button-cta-contact">
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
