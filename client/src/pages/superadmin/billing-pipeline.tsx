import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, FileText, Send, CheckCircle, XCircle, Clock, Plus, Eye, Mail } from "lucide-react";
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
import type { Lead, Quote } from "@shared/schema";
import { Link } from "wouter";

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("fr-FR");
}

function getQuoteStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="outline">Brouillon</Badge>;
    case "SENT":
      return <Badge className="bg-blue-500">Envoye</Badge>;
    case "ACCEPTED":
      return <Badge className="bg-green-500">Accepte</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Refuse</Badge>;
    case "EXPIRED":
      return <Badge variant="secondary">Expire</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPaymentMethodBadge(method: string | null | undefined) {
  if (!method) return <Badge variant="outline">Non defini</Badge>;
  switch (method) {
    case "STRIPE":
      return <Badge className="bg-blue-500">Stripe</Badge>;
    case "ADMINISTRATIVE_MANDATE":
      return <Badge className="bg-purple-600">Mandat</Badge>;
    case "BANK_TRANSFER":
      return <Badge className="bg-orange-500">Virement</Badge>;
    case "CHECK":
      return <Badge className="bg-gray-500">Cheque</Badge>;
    default:
      return <Badge variant="outline">{method}</Badge>;
  }
}

function getLeadStatusBadge(status: string) {
  switch (status) {
    case "NEW":
      return <Badge className="bg-blue-500">Nouveau</Badge>;
    case "CONTACTED":
      return <Badge className="bg-yellow-500">Contacte</Badge>;
    case "QUALIFIED":
      return <Badge className="bg-green-500">Qualifie</Badge>;
    case "CONVERTED":
      return <Badge className="bg-purple-500">Converti</Badge>;
    case "LOST":
      return <Badge variant="destructive">Perdu</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SuperadminBillingPipeline() {
  const { toast } = useToast();

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/superadmin/leads"],
  });

  const { data: quotes, isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/superadmin/quotes"],
  });

  const activeLeads = leads?.filter(l => l.status !== "CONVERTED" && l.status !== "IGNORED") || [];
  const draftQuotes = quotes?.filter(q => q.status === "DRAFT") || [];
  const sentQuotes = quotes?.filter(q => q.status === "SENT") || [];
  const acceptedQuotes = quotes?.filter(q => q.status === "ACCEPTED") || [];
  const otherQuotes = quotes?.filter(q => q.status === "REJECTED" || q.status === "EXPIRED") || [];

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-billing-pipeline-title">
              Pipeline Commercial
            </h1>
            <p className="text-muted-foreground">
              Prospects, devis et conversions
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/superadmin/leads">
              <Button variant="outline" data-testid="button-view-all-leads">
                <Users className="h-4 w-4 mr-2" />
                Tous les prospects
              </Button>
            </Link>
            <Link href="/superadmin/quotes">
              <Button variant="outline" data-testid="button-view-all-quotes">
                <FileText className="h-4 w-4 mr-2" />
                Tous les devis
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{activeLeads.length}</p>
                  <p className="text-sm text-muted-foreground">Prospects actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{draftQuotes.length}</p>
                  <p className="text-sm text-muted-foreground">Devis brouillon</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Send className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{sentQuotes.length}</p>
                  <p className="text-sm text-muted-foreground">Devis envoyes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{acceptedQuotes.length}</p>
                  <p className="text-sm text-muted-foreground">Devis acceptes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads">Prospects ({activeLeads.length})</TabsTrigger>
            <TabsTrigger value="drafts">Brouillons ({draftQuotes.length})</TabsTrigger>
            <TabsTrigger value="sent">En attente ({sentQuotes.length})</TabsTrigger>
            <TabsTrigger value="accepted">Acceptes ({acceptedQuotes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Prospects actifs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {leadsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organisation</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeLeads.map((lead) => (
                        <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                          <TableCell className="font-medium">{lead.organisationName}</TableCell>
                          <TableCell>{lead.firstName} {lead.lastName}<br/><span className="text-muted-foreground text-sm">{lead.email}</span></TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>{getLeadStatusBadge(lead.status)}</TableCell>
                          <TableCell>{formatDate(lead.createdAt)}</TableCell>
                          <TableCell>
                            <Link href={`/superadmin/leads?create_quote=${lead.id}`}>
                              <Button size="sm" variant="outline" data-testid={`button-create-quote-${lead.id}`}>
                                <Plus className="h-3 w-3 mr-1" />
                                Devis
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {activeLeads.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucun prospect actif
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drafts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Devis brouillon
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {quotesLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Methode paiement</TableHead>
                        <TableHead>Valide jusqu'au</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftQuotes.map((quote) => (
                        <TableRow key={quote.id} data-testid={`row-quote-${quote.id}`}>
                          <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                          <TableCell>{quote.clientName}</TableCell>
                          <TableCell>{quote.total.toFixed(2)} EUR</TableCell>
                          <TableCell>{getPaymentMethodBadge(quote.paymentMethod)}</TableCell>
                          <TableCell>{formatDate(quote.validUntil)}</TableCell>
                          <TableCell>
                            <Link href={`/superadmin/quotes?edit=${quote.id}`}>
                              <Button size="sm" variant="outline" data-testid={`button-edit-quote-${quote.id}`}>
                                <Eye className="h-3 w-3 mr-1" />
                                Modifier
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {draftQuotes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucun devis brouillon
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-500" />
                  Devis envoyes (en attente de reponse)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {quotesLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Methode paiement</TableHead>
                        <TableHead>Envoye le</TableHead>
                        <TableHead>Valide jusqu'au</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentQuotes.map((quote) => (
                        <TableRow key={quote.id} data-testid={`row-quote-sent-${quote.id}`}>
                          <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                          <TableCell>{quote.clientName}</TableCell>
                          <TableCell>{quote.total.toFixed(2)} EUR</TableCell>
                          <TableCell>{getPaymentMethodBadge(quote.paymentMethod)}</TableCell>
                          <TableCell>{formatDate(quote.sentAt)}</TableCell>
                          <TableCell>{formatDate(quote.validUntil)}</TableCell>
                        </TableRow>
                      ))}
                      {sentQuotes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucun devis en attente
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accepted" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Devis acceptes (a convertir en commande)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {quotesLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Methode paiement</TableHead>
                        <TableHead>Accepte le</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acceptedQuotes.map((quote) => (
                        <TableRow key={quote.id} data-testid={`row-quote-accepted-${quote.id}`}>
                          <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                          <TableCell>{quote.clientName}</TableCell>
                          <TableCell>{quote.total.toFixed(2)} EUR</TableCell>
                          <TableCell>{getPaymentMethodBadge(quote.paymentMethod)}</TableCell>
                          <TableCell>{formatDate(quote.acceptedAt)}</TableCell>
                          <TableCell>
                            <Link href={`/superadmin/quotes?convert=${quote.id}`}>
                              <Button size="sm" data-testid={`button-convert-quote-${quote.id}`}>
                                <Plus className="h-3 w-3 mr-1" />
                                Creer commande
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {acceptedQuotes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucun devis accepte
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
