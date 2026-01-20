import { Link } from "wouter";
import logoImage from "@assets/logo_voxpopulous_1765723835159.png";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-6">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4" data-testid="link-footer-home">
              <img src={logoImage} alt="Voxpopulous.fr" className="h-8 w-8 rounded-lg object-cover" />
              <span className="font-display text-lg font-bold">Voxpopulous.fr</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              La plateforme de participation citoyenne pour les communes et associations. 
              Donnez la parole à vos membres.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Produit</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors" data-testid="link-footer-pricing">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-foreground transition-colors" data-testid="link-footer-signup">
                  Essai gratuit
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Guide</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/guide#essai-gratuit" className="hover:text-foreground transition-colors" data-testid="link-footer-trial">
                  Essai gratuit
                </Link>
              </li>
              <li>
                <Link href="/guide#paiement" className="hover:text-foreground transition-colors" data-testid="link-footer-payment">
                  Modes de paiement
                </Link>
              </li>
              <li>
                <Link href="/guide#fonctionnalites" className="hover:text-foreground transition-colors" data-testid="link-footer-features">
                  Fonctionnalites
                </Link>
              </li>
              <li>
                <Link href="/guide#structures-enfants" className="hover:text-foreground transition-colors" data-testid="link-footer-children">
                  EPCI et mairies
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors" data-testid="link-footer-contact">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Légal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/rgpd" className="hover:text-foreground transition-colors" data-testid="link-footer-rgpd">
                  RGPD et confidentialité
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="hover:text-foreground transition-colors" data-testid="link-footer-mentions">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="hover:text-foreground transition-colors" data-testid="link-footer-cgu">
                  CGU / CGV
                </Link>
              </li>
            </ul>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Voxpopulous.fr. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
