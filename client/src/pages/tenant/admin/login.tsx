import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginFormSchema, type LoginForm, type Tenant } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLogin() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      // Try admin login first
      try {
        const adminResponse = await apiRequest("POST", `/api/tenants/${params.slug}/admin/login`, data);
        if (adminResponse.ok) {
          return { type: "admin", data: await adminResponse.json() };
        }
      } catch (e) {
        // Admin login failed, try elected official login
      }
      
      // Try elected official login
      const eluResponse = await apiRequest("POST", `/api/elus/login`, data);
      if (!eluResponse.ok) {
        throw new Error("Invalid credentials");
      }
      const eluData = await eluResponse.json();
      // Verify the elected official belongs to this tenant
      if (eluData.tenant?.slug !== params.slug) {
        throw new Error("Invalid credentials");
      }
      return { type: "elu", data: eluData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "me"] });
      navigate(`/structures/${params.slug}/admin`);
    },
    onError: () => {
      toast({
        title: "Echec de connexion",
        description: "Email ou mot de passe incorrect.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary mb-4">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold" data-testid="text-login-title">
            {tenant.name}
          </h1>
          <p className="text-muted-foreground mt-1">Administration</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Connexion</CardTitle>
            <CardDescription>
              Connectez-vous a votre espace d'administration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="admin@mairie.fr" 
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Mot de passe</FormLabel>
                        <Link 
                          href={`/structures/${params.slug}/admin/forgot-password`}
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                          data-testid="link-forgot-password"
                        >
                          Mot de passe oublie ?
                        </Link>
                      </div>
                      <FormControl>
                        <PasswordInput 
                          placeholder="Votre mot de passe" 
                          {...field} 
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Se connecter
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-center border-t py-4">
            <Link href={`/structures/${params.slug}`}>
              <Button variant="ghost" size="sm" data-testid="button-back-public">
                Retour au site public
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
