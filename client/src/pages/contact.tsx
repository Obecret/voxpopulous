import { useState } from "react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";

const contactSchema = z.object({
  organisationName: z.string().min(2, "Minimum 2 caracteres"),
  lastName: z.string().min(2, "Minimum 2 caracteres"),
  firstName: z.string().min(2, "Minimum 2 caracteres"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  message: z.string().optional(),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      organisationName: "",
      lastName: "",
      firstName: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      return apiRequest("POST", "/api/leads", data);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez reessayer.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactForm) => {
    mutation.mutate(data);
  };

  if (submitted) {
    return (
      <MainLayout>
        <section className="py-20 md:py-32">
          <div className="mx-auto max-w-lg px-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-4" data-testid="text-success-title">
              Merci pour votre message !
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Notre equipe reviendra vers vous dans les plus brefs delais.
            </p>
            <Button onClick={() => setSubmitted(false)} variant="outline" data-testid="button-new-message">
              Envoyer un autre message
            </Button>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl font-bold sm:text-5xl" data-testid="text-contact-title">
              Contactez-nous
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Vous avez des questions sur Voxpopulous.fr ? Notre equipe est la pour vous repondre.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-5">
            <div className="md:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Demande d'informations</CardTitle>
                  <CardDescription>
                    Remplissez ce formulaire et nous vous recontacterons rapidement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="organisationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom de la commune ou de l'association *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Mairie de... / Association..." 
                                {...field} 
                                data-testid="input-organisation"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Dupont" 
                                  {...field} 
                                  data-testid="input-lastname"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prenom *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Jean" 
                                  {...field} 
                                  data-testid="input-firstname"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="contact@mairie.fr" 
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
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telephone (optionnel)</FormLabel>
                            <FormControl>
                              <Input 
                                type="tel" 
                                placeholder="01 23 45 67 89" 
                                {...field} 
                                data-testid="input-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message (optionnel)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Decrivez votre projet ou posez vos questions..."
                                className="min-h-32"
                                {...field} 
                                data-testid="input-message"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={mutation.isPending}
                        data-testid="button-submit"
                      >
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Envoyer ma demande
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Email</h3>
                      <p className="text-muted-foreground text-sm">contact@voxpopulous.fr</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Telephone</h3>
                      <p className="text-muted-foreground text-sm">01 23 45 67 89</p>
                      <p className="text-muted-foreground text-xs mt-1">Du lundi au vendredi, 9h-18h</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Adresse</h3>
                      <p className="text-muted-foreground text-sm">
                        123 Avenue de la Republique<br />
                        75011 Paris, France
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
