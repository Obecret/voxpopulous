import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, Clock, AlertTriangle, CheckCircle, Send, CreditCard, FileText, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperadminLayout } from "./layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ClientSubscription {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  paymentType: "STRIPE" | "MANDATE";
  planName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  durationMonths: number;
  daysRemaining: number | null;
  renewalReminderSent: boolean;
  nextReminderDate: string | null;
  stripeSubscriptionId?: string;
  mandateSubscriptionId?: string;
}

interface RenewalReminder {
  id: string;
  tenantId: string;
  tenantName: string;
  subscriptionId: string | null;
  reminderLevel: number;
  scheduledFor: string;
  sentAt: string | null;
  emailTo: string;
  subscriptionEndDate?: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function getDaysRemainingBadge(days: number | null) {
  if (days === null) return <Badge variant="outline">N/A</Badge>;
  if (days < 0) return <Badge variant="destructive">Expire</Badge>;
  if (days <= 30) return <Badge variant="destructive">{days}j</Badge>;
  if (days <= 60) return <Badge className="bg-orange-500">{days}j</Badge>;
  if (days <= 90) return <Badge className="bg-yellow-500">{days}j</Badge>;
  return <Badge variant="secondary">{days}j</Badge>;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
    case "active":
      return <Badge className="bg-green-500">Actif</Badge>;
    case "PENDING_ACTIVATION":
      return <Badge className="bg-yellow-500">En attente</Badge>;
    case "EXPIRED":
    case "canceled":
      return <Badge variant="destructive">Expire</Badge>;
    case "GRACE_PERIOD":
      return <Badge className="bg-orange-500">Periode de grace</Badge>;
    case "READ_ONLY":
      return <Badge variant="destructive">Lecture seule</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SuperadminClientSubscriptions() {
  const { toast } = useToast();

  const { data: subscriptions, isLoading } = useQuery<ClientSubscription[]>({
    queryKey: ["/api/superadmin/client-subscriptions"],
  });

  const { data: reminders, isLoading: remindersLoading } = useQuery<RenewalReminder[]>({
    queryKey: ["/api/superadmin/renewal-reminders"],
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      return apiRequest("POST", `/api/superadmin/renewal-reminders/${reminderId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/renewal-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/client-subscriptions"] });
      toast({ title: "Relance envoyee avec succes" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    },
  });

  const generateRenewalsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/superadmin/generate-renewal-reminders");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/renewal-reminders"] });
      toast({ title: `${data.created || 0} relances generees` });
    },
    onError: () => {
      toast({ title: "Erreur lors de la generation", variant: "destructive" });
    },
  });

  const generateRenewalOrderMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      return apiRequest("POST", `/api/superadmin/generate-renewal-order/${subscriptionId}`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/client-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-orders"] });
      toast({ title: data.message || "Bon de commande genere" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la generation du BC", variant: "destructive" });
    },
  });

  const stripeSubscriptions = subscriptions?.filter(s => s.paymentType === "STRIPE") || [];
  const mandateSubscriptions = subscriptions?.filter(s => s.paymentType === "MANDATE") || [];
  
  const expiringCount = subscriptions?.filter(s => s.daysRemaining !== null && s.daysRemaining <= 60 && s.daysRemaining >= 0).length || 0;
  const pendingReminders = reminders?.filter(r => !r.sentAt).length || 0;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-client-subscriptions-title">
              Suivi des Abonnements Clients
            </h1>
            <p className="text-muted-foreground">
              Dates, durees et relances de renouvellement
            </p>
          </div>
          <Button
            onClick={() => generateRenewalsMutation.mutate()}
            disabled={generateRenewalsMutation.isPending}
            data-testid="button-generate-renewals"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Generer les relances
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stripeSubscriptions.length}</p>
                  <p className="text-sm text-muted-foreground">Abonnements Stripe</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{mandateSubscriptions.length}</p>
                  <p className="text-sm text-muted-foreground">Mandats Administratifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{expiringCount}</p>
                  <p className="text-sm text-muted-foreground">Expirent sous 60j</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Send className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingReminders}</p>
                  <p className="text-sm text-muted-foreground">Relances en attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Tous ({subscriptions?.length || 0})</TabsTrigger>
            <TabsTrigger value="stripe">Stripe ({stripeSubscriptions.length})</TabsTrigger>
            <TabsTrigger value="mandate">Mandats ({mandateSubscriptions.length})</TabsTrigger>
            <TabsTrigger value="reminders">Relances ({reminders?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tous les abonnements</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Forfait</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date debut</TableHead>
                        <TableHead>Duree</TableHead>
                        <TableHead>Date fin</TableHead>
                        <TableHead>Jours restants</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions?.map((sub) => (
                        <TableRow key={`${sub.paymentType}-${sub.tenantId}`} data-testid={`row-subscription-${sub.tenantSlug}`}>
                          <TableCell className="font-medium">{sub.tenantName}</TableCell>
                          <TableCell>
                            {sub.paymentType === "STRIPE" ? (
                              <Badge className="bg-blue-500">Stripe</Badge>
                            ) : (
                              <Badge className="bg-purple-600">Mandat</Badge>
                            )}
                          </TableCell>
                          <TableCell>{sub.planName}</TableCell>
                          <TableCell>{getStatusBadge(sub.status)}</TableCell>
                          <TableCell>{formatDate(sub.startDate)}</TableCell>
                          <TableCell>{sub.durationMonths} mois</TableCell>
                          <TableCell>{formatDate(sub.endDate)}</TableCell>
                          <TableCell>{getDaysRemainingBadge(sub.daysRemaining)}</TableCell>
                        </TableRow>
                      ))}
                      {(!subscriptions || subscriptions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Aucun abonnement trouve
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stripe" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                  Abonnements Stripe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Forfait</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date debut</TableHead>
                      <TableHead>Date fin</TableHead>
                      <TableHead>Jours restants</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stripeSubscriptions.map((sub) => (
                      <TableRow key={sub.tenantId}>
                        <TableCell className="font-medium">{sub.tenantName}</TableCell>
                        <TableCell>{sub.planName}</TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>{formatDate(sub.startDate)}</TableCell>
                        <TableCell>{formatDate(sub.endDate)}</TableCell>
                        <TableCell>{getDaysRemainingBadge(sub.daysRemaining)}</TableCell>
                      </TableRow>
                    ))}
                    {stripeSubscriptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Aucun abonnement Stripe
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mandate" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-500" />
                  Mandats Administratifs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Forfait</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date debut</TableHead>
                      <TableHead>Date fin</TableHead>
                      <TableHead>Jours restants</TableHead>
                      <TableHead>Relance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mandateSubscriptions.map((sub) => (
                      <TableRow key={sub.tenantId}>
                        <TableCell className="font-medium">{sub.tenantName}</TableCell>
                        <TableCell>{sub.planName}</TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>{formatDate(sub.startDate)}</TableCell>
                        <TableCell>{formatDate(sub.endDate)}</TableCell>
                        <TableCell>{getDaysRemainingBadge(sub.daysRemaining)}</TableCell>
                        <TableCell>
                          {sub.renewalReminderSent ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          {sub.mandateSubscriptionId && sub.daysRemaining !== null && sub.daysRemaining <= 60 && sub.daysRemaining >= 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateRenewalOrderMutation.mutate(sub.mandateSubscriptionId!)}
                              disabled={generateRenewalOrderMutation.isPending}
                              data-testid={`button-generate-renewal-order-${sub.tenantSlug}`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              BC Renouvellement
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {mandateSubscriptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Aucun mandat administratif
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reminders" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Relances de renouvellement
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {remindersLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Niveau</TableHead>
                        <TableHead>Date prevue</TableHead>
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reminders?.map((reminder) => (
                        <TableRow key={reminder.id}>
                          <TableCell className="font-medium">{reminder.tenantName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {reminder.reminderLevel === 1 ? "J-60" : reminder.reminderLevel === 2 ? "J-30" : "J-15"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(reminder.scheduledFor)}</TableCell>
                          <TableCell>{reminder.emailTo}</TableCell>
                          <TableCell>
                            {reminder.sentAt ? (
                              <Badge className="bg-green-500">Envoye le {formatDate(reminder.sentAt)}</Badge>
                            ) : (
                              <Badge variant="outline">En attente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!reminder.sentAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendReminderMutation.mutate(reminder.id)}
                                disabled={sendReminderMutation.isPending}
                                data-testid={`button-send-reminder-${reminder.id}`}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Envoyer
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!reminders || reminders.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucune relance programmee
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperadminLayout>
  );
}
