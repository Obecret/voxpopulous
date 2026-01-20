import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Users, Mail, Phone, MessageSquare, Building2, UserPlus, Trash2, 
  Send, FileText, Clock, CheckCircle, XCircle, CreditCard, Loader2,
  ChevronRight, Plus, Eye, Copy, SendHorizonal, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { SuperadminLayout } from "./layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead, LeadMessage, Quote, SubscriptionPlan, Addon } from "@shared/schema";

type LeadDetail = Lead & {
  messages: LeadMessage[];
  quotes: Quote[];
  unreadCount: number;
};

type PipelineStage = "NEW" | "CONTACTED" | "QUOTED" | "AWAITING_DECISION" | "AWAITING_PAYMENT" | "CONVERTED" | "LOST";

const PIPELINE_STAGES: { stage: PipelineStage; label: string; color: string; icon: any }[] = [
  { stage: "NEW", label: "Nouveaux", color: "bg-blue-500", icon: Users },
  { stage: "CONTACTED", label: "Contactes", color: "bg-indigo-500", icon: MessageSquare },
  { stage: "QUOTED", label: "Devis envoye", color: "bg-purple-500", icon: FileText },
  { stage: "AWAITING_DECISION", label: "En attente", color: "bg-amber-500", icon: Clock },
  { stage: "AWAITING_PAYMENT", label: "Paiement", color: "bg-orange-500", icon: CreditCard },
  { stage: "CONVERTED", label: "Convertis", color: "bg-green-500", icon: CheckCircle },
  { stage: "LOST", label: "Perdus", color: "bg-gray-500", icon: XCircle },
];

function formatCurrency(euros: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}

function LeadCard({ 
  lead, 
  onClick,
  onDelete 
}: { 
  lead: Lead; 
  onClick: () => void;
  onDelete: () => void;
}) {
  const hasUnread = (lead as any).unreadCount > 0;
  
  return (
    <Card 
      className="cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-lead-${lead.id}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm truncate">{lead.organisationName}</span>
          </div>
          {hasUnread && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              {(lead as any).unreadCount}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {lead.firstName} {lead.lastName}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span className="truncate">{lead.email}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {format(new Date(lead.createdAt), "d MMM", { locale: fr })}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-testid={`button-delete-lead-${lead.id}`}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ message }: { message: LeadMessage }) {
  const isFromSuperadmin = message.senderType === "SUPERADMIN";
  
  return (
    <div className={`flex ${isFromSuperadmin ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isFromSuperadmin
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {message.subject && (
          <p className="font-medium text-sm mb-1">{message.subject}</p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <p className={`text-xs mt-2 ${isFromSuperadmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {format(new Date(message.createdAt), "d MMM HH:mm", { locale: fr })}
        </p>
      </div>
    </div>
  );
}

export default function SuperadminLeads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingInterval, setBillingInterval] = useState<string>("YEARLY");
  const [tenantType, setTenantType] = useState<string>("MAIRIE");
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quotePlanId, setQuotePlanId] = useState<string>("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteBillingInterval, setQuoteBillingInterval] = useState<string>("YEARLY");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/superadmin/leads"],
  });

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/superadmin/plans"],
  });

  const { data: addons } = useQuery<Addon[]>({
    queryKey: ["/api/superadmin/addons"],
  });

  const { data: selectedLeadDetail, isLoading: isLoadingDetail } = useQuery<LeadDetail>({
    queryKey: ["/api/superadmin/leads", selectedLeadId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/superadmin/leads/${selectedLeadId}/detail`);
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      // Flatten the response: merge lead properties with messages/quotes/unreadCount
      return { ...data.lead, messages: data.messages, quotes: data.quotes, unreadCount: data.unreadCount };
    },
    enabled: !!selectedLeadId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ leadId, subject, body }: { leadId: string; subject?: string; body: string }) => {
      return apiRequest("POST", `/api/superadmin/leads/${leadId}/messages`, { subject, body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads", selectedLeadId, "detail"] });
      setNewMessage("");
      setMessageSubject("");
      toast({ title: "Message envoye" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async ({ leadId, planId, billingInterval, notes, addons }: { 
      leadId: string; 
      planId: string; 
      billingInterval: string; 
      notes?: string;
      addons?: { addonId: string; quantity: number }[];
    }) => {
      return apiRequest("POST", `/api/superadmin/leads/${leadId}/quote`, { planId, billingInterval, notes, addons });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads", selectedLeadId, "detail"] });
      setQuoteDialogOpen(false);
      setQuotePlanId("");
      setQuoteNotes("");
      setQuoteBillingInterval("YEARLY");
      setSelectedAddons({});
      toast({ title: "Devis cree" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiRequest("POST", `/api/superadmin/quotes/${quoteId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads", selectedLeadId, "detail"] });
      toast({ title: "Devis envoye au prospect" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const updatePipelineStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      return apiRequest("PATCH", `/api/superadmin/leads/${id}/pipeline-stage`, { pipelineStage: stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads", selectedLeadId, "detail"] });
      toast({ title: "Etape mise a jour" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/superadmin/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads"] });
      setDeleteLeadId(null);
      if (selectedLeadId === deleteLeadId) {
        setSelectedLeadId(null);
      }
      toast({ title: "Prospect supprime" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, subscriptionPlanId, billingInterval, tenantType }: { 
      id: string; 
      subscriptionPlanId?: string;
      billingInterval: string;
      tenantType: string;
    }) => {
      return apiRequest("POST", `/api/superadmin/leads/${id}/convert`, { 
        subscriptionPlanId, 
        billingInterval,
        tenantType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      setConvertDialogOpen(false);
      setSelectedLeadId(null);
      toast({ title: "Client cree avec succes. La commande a ete creee." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newMessage.trim()) return;
    sendMessageMutation.mutate({
      leadId: selectedLeadId,
      subject: messageSubject.trim() || undefined,
      body: newMessage.trim(),
    });
  };

  const handleCreateQuote = () => {
    if (!selectedLeadId || !quotePlanId) return;
    const addonsList = Object.entries(selectedAddons)
      .filter(([_, qty]) => qty > 0)
      .map(([addonId, quantity]) => ({ addonId, quantity }));
    createQuoteMutation.mutate({
      leadId: selectedLeadId,
      planId: quotePlanId,
      billingInterval: quoteBillingInterval,
      notes: quoteNotes.trim() || undefined,
      addons: addonsList.length > 0 ? addonsList : undefined,
    });
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev => {
      if (prev[addonId]) {
        const { [addonId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [addonId]: 1 };
    });
  };

  const updateAddonQuantity = (addonId: string, quantity: number) => {
    if (quantity < 1) {
      setSelectedAddons(prev => {
        const { [addonId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setSelectedAddons(prev => ({ ...prev, [addonId]: quantity }));
    }
  };

  const calculateQuoteTotal = () => {
    let total = 0;
    const selectedPlan = plans?.find(p => p.id === quotePlanId);
    if (selectedPlan) {
      total += quoteBillingInterval === "MONTHLY" ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice;
    }
    Object.entries(selectedAddons).forEach(([addonId, qty]) => {
      const addon = addons?.find(a => a.id === addonId);
      if (addon && qty > 0) {
        const price = quoteBillingInterval === "MONTHLY" ? addon.defaultMonthlyPrice : addon.defaultYearlyPrice;
        total += price * qty;
      }
    });
    return total;
  };

  // Find accepted quote for the selected lead
  const acceptedQuote = selectedLeadDetail?.quotes?.find(q => q.status === "ACCEPTED");
  
  // Get billing info from accepted quote
  const getQuoteBillingInterval = () => {
    if (!acceptedQuote) return null;
    // For mandate payments, always yearly
    if (acceptedQuote.paymentMethod === "ADMINISTRATIVE_MANDATE") return "YEARLY";
    // For Stripe, check line items for billing interval
    const lineItems = (acceptedQuote as any).lineItems;
    if (lineItems && lineItems.length > 0) {
      return lineItems[0].billingInterval || "YEARLY";
    }
    return "YEARLY";
  };

  const quoteBillingInfo = getQuoteBillingInterval();
  const quotePaymentMethod = acceptedQuote?.paymentMethod;

  const handleConvert = () => {
    if (!selectedLeadDetail) return;
    // Use quote billing interval if available, otherwise use selected value
    const finalBillingInterval = quoteBillingInfo || billingInterval;
    convertMutation.mutate({
      id: selectedLeadDetail.id,
      subscriptionPlanId: selectedPlanId || undefined,
      billingInterval: finalBillingInterval,
      tenantType,
    });
  };

  const copyPortalLink = (token: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copie" });
  };

  const groupedLeads = PIPELINE_STAGES.reduce((acc, { stage }) => {
    acc[stage] = leads?.filter(lead => (lead.pipelineStage || "NEW") === stage) || [];
    return acc;
  }, {} as Record<PipelineStage, Lead[]>);

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-leads-title">
              Pipeline Commercial
            </h1>
            <p className="text-muted-foreground">
              Gerez vos prospects du premier contact a la conversion
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-1">
            {leads?.length || 0} prospects
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE_STAGES.map(({ stage, label, color, icon: Icon }) => {
                const stageLeads = groupedLeads[stage] || [];
                return (
                  <div key={stage} className="w-64 shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${color}`} />
                      <span className="font-medium text-sm">{label}</span>
                      <Badge variant="outline" className="ml-auto">
                        {stageLeads.length}
                      </Badge>
                    </div>
                    <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2">
                      {stageLeads.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                          Aucun prospect
                        </div>
                      ) : (
                        stageLeads.map((lead) => (
                          <LeadCard
                            key={lead.id}
                            lead={lead}
                            onClick={() => setSelectedLeadId(lead.id)}
                            onDelete={() => setDeleteLeadId(lead.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {isLoadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedLeadDetail ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedLeadDetail.organisationName}
                </SheetTitle>
                <SheetDescription>
                  {selectedLeadDetail.firstName} {selectedLeadDetail.lastName}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Pipeline stage badge (read-only) */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const stageInfo = PIPELINE_STAGES.find(s => s.stage === (selectedLeadDetail.pipelineStage || "NEW"));
                    const StageIcon = stageInfo?.icon || Users;
                    return (
                      <Badge className={`${stageInfo?.color || "bg-blue-500"} text-white`} data-testid="badge-pipeline-stage">
                        <StageIcon className="h-3 w-3 mr-1" />
                        {stageInfo?.label || "Nouveaux"}
                      </Badge>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground">
                    Cree le {format(new Date(selectedLeadDetail.createdAt), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>

                <Tabs defaultValue="infos">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="infos" className="gap-2" data-testid="tab-infos">
                      <Building2 className="h-4 w-4" />
                      Infos
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="gap-2" data-testid="tab-messages">
                      <MessageSquare className="h-4 w-4" />
                      Messages
                    </TabsTrigger>
                    <TabsTrigger value="quotes" className="gap-2" data-testid="tab-quotes">
                      <FileText className="h-4 w-4" />
                      Devis
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="infos" className="mt-4">
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Organisation</p>
                            <p className="text-sm font-medium" data-testid="text-organisation">{selectedLeadDetail.organisationName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Type</p>
                            <p className="text-sm" data-testid="text-org-type">{selectedLeadDetail.tenantType || "-"}</p>
                          </div>
                        </div>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground">Contact</p>
                          <p className="text-sm" data-testid="text-contact">{selectedLeadDetail.firstName} {selectedLeadDetail.lastName}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span data-testid="text-email">{selectedLeadDetail.email}</span>
                          </div>
                          {selectedLeadDetail.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span data-testid="text-phone">{selectedLeadDetail.phone}</span>
                            </div>
                          )}
                        </div>
                        {selectedLeadDetail.message && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Message initial</p>
                              <p className="text-sm" data-testid="text-initial-message">{selectedLeadDetail.message}</p>
                            </div>
                          </>
                        )}
                        {selectedLeadDetail.publicToken && (
                          <>
                            <Separator />
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyPortalLink(selectedLeadDetail.publicToken!)}
                                data-testid="button-copy-portal-link"
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copier lien portail
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="messages" className="mt-4">
                    <Card>
                      <CardContent className="p-4">
                        <ScrollArea className="h-[250px] pr-4">
                          {selectedLeadDetail.messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                              <p className="text-sm">Aucun message</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {selectedLeadDetail.messages
                                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                                .map((msg) => (
                                  <MessageBubble key={msg.id} message={msg} />
                                ))}
                            </div>
                          )}
                        </ScrollArea>
                        <Separator className="my-4" />
                        <form onSubmit={handleSendMessage} className="space-y-2">
                          <Input
                            placeholder="Sujet (optionnel)"
                            value={messageSubject}
                            onChange={(e) => setMessageSubject(e.target.value)}
                            data-testid="input-message-subject"
                          />
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Votre message..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              className="flex-1 min-h-[60px]"
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
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Devis</CardTitle>
                          <Button
                            size="sm"
                            onClick={() => setQuoteDialogOpen(true)}
                            data-testid="button-create-quote"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Creer
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        {selectedLeadDetail.quotes.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm">Aucun devis</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedLeadDetail.quotes.map((quote) => (
                              <Card key={quote.id} className="hover-elevate">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="font-medium text-sm">{quote.quoteNumber}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatCurrency(quote.total)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={
                                        quote.status === "ACCEPTED" ? "default" :
                                        quote.status === "REJECTED" ? "destructive" :
                                        "secondary"
                                      }>
                                        {quote.status}
                                      </Badge>
                                      {(quote.status === "DRAFT" || quote.status === "SENT") && (
                                        <Button
                                          size="sm"
                                          onClick={() => sendQuoteMutation.mutate(quote.id)}
                                          disabled={sendQuoteMutation.isPending}
                                          data-testid={`button-send-quote-${quote.id}`}
                                        >
                                          <SendHorizonal className="h-4 w-4 mr-1" />
                                          {quote.status === "DRAFT" ? "Envoyer" : "Renvoyer"}
                                        </Button>
                                      )}
                                      {quote.publicToken && quote.status !== "DRAFT" && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/q/${quote.publicToken}`);
                                            toast({ title: "Lien du devis copie" });
                                          }}
                                          data-testid={`button-copy-quote-link-${quote.id}`}
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2">
                  {selectedLeadDetail.pipelineStage !== "CONVERTED" && (
                    <Button
                      className="flex-1"
                      onClick={() => setConvertDialogOpen(true)}
                      data-testid="button-convert-lead"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Convertir en client
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Creer un devis</DialogTitle>
            <DialogDescription>
              Creer un devis pour {selectedLeadDetail?.organisationName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={quotePlanId} onValueChange={setQuotePlanId}>
                <SelectTrigger data-testid="select-quote-plan">
                  <SelectValue placeholder="Selectionnez un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.filter(p => p.isActive).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(quoteBillingInterval === "MONTHLY" ? plan.monthlyPrice : plan.yearlyPrice)}/{quoteBillingInterval === "MONTHLY" ? "mois" : "an"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Facturation</Label>
              <Select value={quoteBillingInterval} onValueChange={setQuoteBillingInterval}>
                <SelectTrigger data-testid="select-quote-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensuelle</SelectItem>
                  <SelectItem value="YEARLY">Annuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addons && addons.filter(a => a.isActive).length > 0 && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="border rounded-md p-3 space-y-3">
                  {addons.filter(a => a.isActive).map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <Checkbox
                          id={`addon-${addon.id}`}
                          checked={!!selectedAddons[addon.id]}
                          onCheckedChange={() => toggleAddon(addon.id)}
                          data-testid={`checkbox-addon-${addon.code}`}
                        />
                        <label
                          htmlFor={`addon-${addon.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {addon.name}
                        </label>
                      </div>
                      {selectedAddons[addon.id] && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={selectedAddons[addon.id]}
                            onChange={(e) => updateAddonQuantity(addon.id, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-center"
                            data-testid={`input-addon-qty-${addon.code}`}
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            x {formatCurrency(quoteBillingInterval === "MONTHLY" ? addon.defaultMonthlyPrice : addon.defaultYearlyPrice)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Notes internes..."
                data-testid="input-quote-notes"
              />
            </div>
            {quotePlanId && (
              <div className="bg-muted rounded-md p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(calculateQuoteTotal())}/{quoteBillingInterval === "MONTHLY" ? "mois" : "an"}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateQuote}
              disabled={!quotePlanId || createQuoteMutation.isPending}
              data-testid="button-confirm-create-quote"
            >
              {createQuoteMutation.isPending ? "Creation..." : "Creer le devis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convertir en client</DialogTitle>
            <DialogDescription>
              Creer un compte client pour {selectedLeadDetail?.organisationName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Show accepted quote info - will become order after conversion */}
            {acceptedQuote && (
              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                    <Check className="h-4 w-4" />
                    Commande basee sur le devis {acceptedQuote.quoteNumber}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Montant:</span>
                      <span className="ml-2 font-medium">{formatCurrency(acceptedQuote.total)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Paiement:</span>
                      <span className="ml-2 font-medium">
                        {quotePaymentMethod === "ADMINISTRATIVE_MANDATE" ? "Mandat administratif" : "Carte bancaire"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Facturation:</span>
                      <span className="ml-2 font-medium">
                        {quoteBillingInfo === "YEARLY" ? "Annuelle" : "Mensuelle"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Type de structure</Label>
              <Select value={tenantType} onValueChange={setTenantType}>
                <SelectTrigger data-testid="select-tenant-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAIRIE">Mairie</SelectItem>
                  <SelectItem value="EPCI">EPCI</SelectItem>
                  <SelectItem value="ASSOCIATION">Association</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Only show plan/billing selectors if no accepted quote */}
            {!acceptedQuote && (
              <>
                <div className="space-y-2">
                  <Label>Forfait (optionnel)</Label>
                  <Select value={selectedPlanId || "none"} onValueChange={(v) => setSelectedPlanId(v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-plan">
                      <SelectValue placeholder="Periode d'essai" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Periode d'essai (30 jours)</SelectItem>
                      {plans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - {formatCurrency(plan.monthlyPrice)}/mois
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Facturation</Label>
                  <Select value={billingInterval} onValueChange={setBillingInterval}>
                    <SelectTrigger data-testid="select-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Mensuelle</SelectItem>
                      <SelectItem value="YEARLY">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertMutation.isPending}
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? "Conversion..." : "Creer le compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLeadId} onOpenChange={(open) => !open && setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce prospect ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-lead">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLeadId && deleteLeadMutation.mutate(deleteLeadId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-lead"
            >
              {deleteLeadMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperadminLayout>
  );
}
