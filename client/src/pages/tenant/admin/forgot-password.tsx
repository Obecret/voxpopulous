import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, CheckCircle, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tenant } from "@shared/schema";

export default function ForgotPassword() {
  const params = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/password-reset/request`, { 
        email, 
        tenantSlug: params.slug 
      });
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      resetMutation.mutate();
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-12 w-12 rounded-xl mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
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

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
        <div className="w-full max-w-sm">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Email envoye</h2>
                <p className="text-muted-foreground mb-6">
                  Si un compte existe avec cette adresse email, vous recevrez un lien pour reinitialiser votre mot de passe.
                </p>
                <Link href={`/structures/${params.slug}/admin/login`}>
                  <Button data-testid="button-back-login">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour a la connexion
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold" data-testid="text-tenant-name">
            {tenant.name}
          </h1>
          <p className="text-muted-foreground mt-1">Reinitialisation du mot de passe</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Mot de passe oublie ?</CardTitle>
            <CardDescription>
              Entrez votre adresse email pour recevoir un lien de reinitialisation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={resetMutation.isPending || !email.trim()}
                data-testid="button-submit"
              >
                {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer le lien
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t py-4">
            <Link href={`/structures/${params.slug}/admin/login`}>
              <Button variant="ghost" size="sm" data-testid="button-back-login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour a la connexion
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
