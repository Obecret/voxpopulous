import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Menu, X, LogIn, Download } from "lucide-react";
import { useState } from "react";
import logoImage from "@assets/logo_voxpopulous_1765723835159.png";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export function Header() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { canInstall, triggerInstall } = usePWAInstall();

  const navLinks = [
    { href: "/", label: "Accueil" },
    { href: "/recherche", label: "Trouver une organisation" },
    { href: "/pricing", label: "Tarifs" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <img src={logoImage} alt="Voxpopulous.fr" className="h-9 w-9 rounded-lg object-cover" />
            <span className="font-display text-xl font-bold tracking-tight">Voxpopulous.fr</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location === link.href ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid={`link-nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {canInstall && (
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2" 
                onClick={triggerInstall}
                data-testid="button-install-app-header"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Installer</span>
              </Button>
            )}
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" className="gap-2" data-testid="button-login-header">
                <LogIn className="h-4 w-4" />
                Connexion
              </Button>
            </Link>
            <Link href="/signup" className="hidden sm:block">
              <Button data-testid="button-signup-header">
                Essai gratuit
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium py-2 transition-colors hover:text-primary ${
                    location === link.href ? "text-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`link-mobile-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full gap-2" data-testid="button-login-mobile">
                  <LogIn className="h-4 w-4" />
                  Connexion
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full" data-testid="button-signup-mobile">
                  Essai gratuit
                </Button>
              </Link>
              {canInstall && (
                <Button 
                  variant="secondary" 
                  className="w-full gap-2" 
                  onClick={() => {
                    triggerInstall();
                    setMobileMenuOpen(false);
                  }}
                  data-testid="button-install-app-mobile"
                >
                  <Download className="h-4 w-4" />
                  Installer l'application
                </Button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
