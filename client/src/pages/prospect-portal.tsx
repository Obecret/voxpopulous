import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  FileText, 
  Send, 
  Loader2, 
  AlertCircle, 
  Building2,
  Mail,
  Calendar,
  Check,
  X,
  Clock,
  ArrowRight
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead, LeadMessage, Quote } from "@shared/schema";

type ProspectData = {
  lead: Lead;
  messages: LeadMessage[];
  quotes: Quote[];
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(euros: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}

function getQuoteStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary">Brouillon</Badge>;
    case "SENT":
      return <Badge variant="default">En attente</Badge>;
    case "ACCEPTED":
      return <Badge className="bg-green-600 hover:bg-green-700">Accepte</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Refuse</Badge>;
    case "EXPIRED":
      return <Badge variant="outline">Expire</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function MessageBubble({ message, isFromProspect }: { message: LeadMessage; isFromProspect: boolean }) {
  return (
    <div className={`flex ${isFromProspect ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isFromProspect
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {message.subject && (
          <p className="font-medium text-sm mb-1">{message.subject}</p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <p className={`text-xs mt-2 ${isFromProspect ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function ProspectPortal() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [messageSubject, setMessageSubject] = useState("");

  const { data, isLoading, error } = useQuery<ProspectData>({
    queryKey: ["/api/public/leads", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/leads/${token}`);
      if (!res.ok) throw new Error("Portail non trouve");
      return res.json();
    },
    enabled: !!token,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ subject, body }: { subject?: string; body: string }) => {
      const res = await apiRequest("POST", `/api/public/leads/${token}/messages`, {
        subject,
        body,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/leads", token] });
      setNewMessage("");
      setMessageSubject("");
      toast({ title: "Message envoye" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur lors de l'envoi" });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate({
      subject: messageSubject.trim() || undefined,
      body: newMessage.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Portail non trouve</h2>
            <p className="text-muted-foreground">
              Ce lien n'est pas valide ou a expire.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { lead, messages, quotes } = data;
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Votre espace prospect</h1>
          <p className="text-muted-foreground">
            Bienvenue {lead.firstName} {lead.lastName}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">{lead.organisationName}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Mail className="h-3 w-3" />
                  {lead.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="messages" className="gap-2" data-testid="tab-messages">
              <MessageSquare className="h-4 w-4" />
              Messages ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-2" data-testid="tab-quotes">
              <FileText className="h-4 w-4" />
              Devis ({quotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation
                </CardTitle>
                <CardDescription>
                  Echangez avec notre equipe commerciale
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  {sortedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                      <p>Aucun message pour le moment</p>
                      <p className="text-sm">Envoyez-nous un message ci-dessous</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedMessages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isFromProspect={msg.senderType === "LEAD"}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <Separator className="my-4" />
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <div>
                    <Label htmlFor="subject" className="sr-only">Sujet (optionnel)</Label>
                    <Input
                      id="subject"
                      placeholder="Sujet (optionnel)"
                      value={messageSubject}
                      onChange={(e) => setMessageSubject(e.target.value)}
                      data-testid="input-message-subject"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Votre message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 min-h-[80px]"
                      data-testid="input-message-body"
                    />
                    <Button
                      type="submit"
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      className="self-end"
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Vos devis
                </CardTitle>
                <CardDescription>
                  Consultez et validez vos devis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p>Aucun devis pour le moment</p>
                    <p className="text-sm">Nous vous enverrons un devis prochainement</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((quote) => {
                      const isExpired = new Date(quote.validUntil) < new Date();
                      const canValidate = quote.status === "SENT" && !isExpired;
                      
                      return (
                        <Card key={quote.id} className="hover-elevate">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <CardTitle className="text-base">
                                Devis n. {quote.quoteNumber}
                              </CardTitle>
                              {getQuoteStatusBadge(isExpired && quote.status === "SENT" ? "EXPIRED" : quote.status)}
                            </div>
                            <CardDescription className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              Valide jusqu'au {formatDate(quote.validUntil)}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Montant TTC</span>
                              <span className="text-lg font-semibold">{formatCurrency(quote.total)}</span>
                            </div>
                          </CardContent>
                          {canValidate && quote.publicToken && (
                            <CardFooter className="pt-2">
                              <Button
                                className="w-full gap-2"
                                onClick={() => window.location.href = `/q/${quote.publicToken}`}
                                data-testid={`button-validate-quote-${quote.id}`}
                              >
                                Valider ce devis
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </CardFooter>
                          )}
                          {quote.status === "ACCEPTED" && (
                            <CardFooter className="pt-2">
                              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <Check className="h-4 w-4" />
                                <span className="text-sm">Devis accepte le {formatDate(quote.acceptedAt!)}</span>
                              </div>
                            </CardFooter>
                          )}
                          {quote.status === "REJECTED" && (
                            <CardFooter className="pt-2">
                              <div className="flex items-center gap-2 text-destructive">
                                <X className="h-4 w-4" />
                                <span className="text-sm">Devis refuse</span>
                              </div>
                            </CardFooter>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
