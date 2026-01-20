import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Tenant } from "@shared/schema";

export default function ResetPassword() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: tokenInfo, isLoading: isValidating, error: validationError } = useQuery<{
    email: string;
    type: "admin" | "elu";
  }>({
    queryKey: ["/api/password-reset/validate", token],
    queryFn: async () => {
      const response = await fetch(`/api/password-reset/validate?token=${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Token invalide");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/password-reset/confirm", { token, password });
      return response.json();
    },
    onSuccess: () => {
      setTimeout(() => {
        navigate(`/structures/${params.slug}/admin/login`);
      }, 2000);
    },
    onError: (error: any) => {
      setError(error.message || "Une erreur est survenue");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    
    resetMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
              <p className="text-muted-foreground mb-4">
                Ce lien de reinitialisation est invalide ou incomplet.
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
    );
  }

  if (tenantLoading || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Verification du lien...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validationError || !tokenInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Lien expire</h2>
              <p className="text-muted-foreground mb-4">
                {(validationError as any)?.message || "Ce lien de reinitialisation est invalide ou a expire."}
              </p>
              <Link href={`/structures/${params.slug}/admin/forgot-password`}>
                <Button data-testid="button-request-new">
                  Demander un nouveau lien
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Mot de passe modifie</h2>
              <p className="text-muted-foreground mb-4">
                Votre mot de passe a ete reinitialise avec succes. Vous allez etre redirige vers la page de connexion.
              </p>
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe pour votre compte ({tokenInfo.email}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caracteres"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le mot de passe"
                data-testid="input-confirm-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={resetMutation.isPending}
              data-testid="button-submit-password"
            >
              {resetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Changer mon mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
