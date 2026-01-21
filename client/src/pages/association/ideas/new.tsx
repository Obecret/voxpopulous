import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Lightbulb, CheckCircle2 } from "lucide-react";
import type { Tenant, Association } from "@shared/schema";
import { IDEA_CATEGORIES } from "@shared/schema";

const ideaFormSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caracteres"),
  description: z.string().min(20, "La description doit contenir au moins 20 caracteres"),
  category: z.string().min(1, "Veuillez choisir une categorie"),
  createdByEmail: z.string().email("Email invalide").optional().or(z.literal("")),
});

type IdeaForm = z.infer<typeof ideaFormSchema>;

export default function AssociationNewIdea() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const { toast } = useToast();
  const [success, setSuccess] = useState(false);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const form = useForm<IdeaForm>({
    resolver: zodResolver(ideaFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      createdByEmail: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: IdeaForm) => {
      const response = await apiRequest("POST", `/api/associations/${association?.id}/ideas`, {
        ...data,
        createdByEmail: data.createdByEmail || null,
      });
      return response.json();
    },
    onSuccess: () => {
      if (association?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/associations", association.id, "ideas"] });
      }
      setSuccess(true);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IdeaForm) => {
    mutation.mutate(data);
  };

  if (success) {
    return (
      <AssociationLayout association={association || null} tenant={tenant || null}>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-4" data-testid="text-success-title">
            Idee soumise avec succes !
          </h1>
          <p className="text-muted-foreground mb-8">
            Merci pour votre contribution. Votre idee sera examinee par les responsables de l'association.
          </p>
          <div className="space-y-4">
            <Link href={`/structures/${params.slug}/${params.assocSlug}/ideas`}>
              <Button size="lg" data-testid="button-back-list">
                Voir toutes les idees
              </Button>
            </Link>
          </div>
        </div>
      </AssociationLayout>
    );
  }

  return (
    <AssociationLayout association={association || null} tenant={tenant || null}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/structures/${params.slug}/${params.assocSlug}/ideas`}>
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Retour aux idees
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4">
              <Lightbulb className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Proposer une idee</CardTitle>
            <CardDescription>
              Partagez votre proposition pour ameliorer l'association.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre de votre idee *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Organiser un tournoi de petanque" 
                          {...field} 
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categorie *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Choisir une categorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {IDEA_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description detaillee *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Decrivez votre idee en detail..."
                          className="min-h-32"
                          {...field} 
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="createdByEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Votre email (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="Pour etre informe de l'avancement"
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormDescription>
                        Si vous renseignez votre email, vous serez informe lorsque le statut de votre idee evoluera.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={mutation.isPending}
                  data-testid="button-submit"
                >
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Soumettre mon idee
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AssociationLayout>
  );
}
