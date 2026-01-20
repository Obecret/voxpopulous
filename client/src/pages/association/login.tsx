import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Users, ArrowLeft } from "lucide-react";
import type { Tenant, Association } from "@shared/schema";

export default function AssociationLogin() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association, error: assocError } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/tenants/${params.slug}/associations/${params.assocSlug}/login`, { email, password });
    },
    onSuccess: () => {
      navigate(`/structures/${params.slug}/${params.assocSlug}/admin`);
    },
    onError: (error: any) => {
      toast({ title: "Erreur de connexion", description: error.message || "Email ou mot de passe incorrect", variant: "destructive" });
    },
  });

  if (assocError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Association non trouvee</p>
            <Link href={`/structures/${params.slug}`}>
              <Button variant="link">Retour a la commune</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{association?.name || "Connexion"}</CardTitle>
          <CardDescription>
            {tenant?.name && <span>Commune de {tenant.name}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                required
                data-testid="input-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
              {loginMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Se connecter
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link href={`/structures/${params.slug}/${params.assocSlug}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour a l'association
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
