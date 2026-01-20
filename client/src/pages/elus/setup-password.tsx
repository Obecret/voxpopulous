import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ElectedOfficialSetupPassword() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const { data: tokenInfo, isLoading: isValidating, error: validationError } = useQuery<{
    firstName: string;
    lastName: string;
    tenantName: string;
  }>({
    queryKey: ["/api/elus/validate-token", token],
    queryFn: async () => {
      const response = await fetch(`/api/elus/validate-token?token=${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Token invalide");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const setPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/elus/set-password", { token, password });
      return response.json();
    },
    onSuccess: (data) => {
      navigate(`/structures/${data.tenantSlug}/admin/login`);
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
    
    setPasswordMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
              <p className="text-muted-foreground">
                Ce lien d'invitation est invalide ou incomplet. Veuillez contacter votre administrateur.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Verification de l'invitation...</p>
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
              <h2 className="text-xl font-semibold mb-2">Invitation invalide</h2>
              <p className="text-muted-foreground">
                {(validationError as any)?.message || "Ce lien d'invitation est invalide ou a expire. Veuillez contacter votre administrateur."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (setPasswordMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Mot de passe cree</h2>
              <p className="text-muted-foreground mb-4">
                Votre compte a ete configure avec succes. Vous allez etre redirige vers la page de connexion.
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
          <CardTitle>Bienvenue, {tokenInfo.firstName} !</CardTitle>
          <CardDescription>
            Creez votre mot de passe pour acceder a l'espace d'administration de {tokenInfo.tenantName}.
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
              disabled={setPasswordMutation.isPending}
              data-testid="button-submit-password"
            >
              {setPasswordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Creer mon compte
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
