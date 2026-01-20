import { useState } from "react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Building2 } from "lucide-react";

export default function Login() {
  const [slug, setSlug] = useState("");
  const [, setLocation] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (slug.trim()) {
      const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
      setLocation(`/structures/${normalizedSlug}/admin/login`);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <Building2 className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-login-title">
              Connexion Administration
            </CardTitle>
            <CardDescription>
              Entrez l'identifiant de votre commune ou association pour acceder a votre espace d'administration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="slug">Identifiant de votre structure</Label>
                <Input
                  id="slug"
                  type="text"
                  placeholder="ex: ma-structure"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  data-testid="input-commune-slug"
                />
                <p className="text-sm text-muted-foreground">
                  C'est l'identifiant que vous avez choisi lors de votre inscription.
                </p>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={!slug.trim()} data-testid="button-access-admin">
                Acceder a mon espace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
