import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, FileText, Send, Check, X, Eye, ArrowRight, Pencil, Download, Mail, Loader2, Package, Calendar, Puzzle, CreditCard, Building2, Link2, Copy, CheckCircle, XCircle, FileCheck, Filter, PenTool, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Quote, Tenant, Lead, Product, SubscriptionPlan, Addon, CompanySettings } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Brouillon", color: "bg-muted text-muted-foreground" },
  SENT: { label: "Envoye", color: "bg-blue-500 text-white" },
  ACCEPTED: { label: "Accepte", color: "bg-green-500 text-white" },
  REJECTED: { label: "Refuse", color: "bg-red-500 text-white" },
  EXPIRED: { label: "Expire", color: "bg-orange-500 text-white" },
};

interface LineItem {
  productId: string;
  planId: string;
  addonId: string;
  billingInterval: "MONTHLY" | "YEARLY" | null;
  description: string;
  quantity: number;
  unitPriceEuros: number;
  totalEuros: number;
}

interface QuoteLineItem {
  id?: string;
  productId: string | null;
  planId: string | null;
  addonId: string | null;
  billingInterval: "MONTHLY" | "YEARLY" | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function SuperadminQuotes() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [viewingQuote, setViewingQuote] = useState<(Quote & { lineItems: QuoteLineItem[] }) | null>(null);
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { productId: "", planId: "", addonId: "", billingInterval: null, description: "", quantity: 1, unitPriceEuros: 0, totalEuros: 0 },
  ]);
  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    clientSiret: "",
    tenantId: "",
    leadId: "",
    taxRate: 20,
    notes: "",
    validUntil: "",
    emitterName: "",
    emitterAddress: "",
    emitterSiret: "",
    emitterTva: "",
    paymentMethod: null as "STRIPE" | "ADMINISTRATIVE_MANDATE" | null,
    quoteSource: "MANUAL" as "PROSPECT_CONTACT" | "TRIAL_CONVERSION" | "MANUAL",
  });
  const [filterMandateStatus, setFilterMandateStatus] = useState<"all" | "pending">("all");

  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/superadmin/quotes"],
  });

  const { data: tenantsData } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/superadmin/tenants"],
  });
  const tenants = tenantsData?.tenants;

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["/api/superadmin/leads"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/superadmin/products/active"],
  });

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/superadmin/plans"],
  });

  const { data: addons } = useQuery<Addon[]>({
    queryKey: ["/api/superadmin/addons"],
  });

  // Addon tiers have been removed - using flat pricing per addon unit now

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/superadmin/settings/company"],
  });

  // Pre-fill emitter info from company settings when creating a new quote
  useEffect(() => {
    if (companySettings && !editingQuoteId && !formData.emitterName) {
      setFormData(prev => ({
        ...prev,
        emitterName: companySettings.companyName || "",
        emitterAddress: companySettings.address || "",
        emitterSiret: companySettings.siret || "",
        emitterTva: companySettings.tvaNumber || "",
      }));
    }
  }, [companySettings, editingQuoteId]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/superadmin/quotes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Devis cree" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer le devis", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PUT", `/api/superadmin/quotes/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      toast({ title: "Statut mis a jour" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/superadmin/invoices/from-quote/${quoteId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/invoices"] });
      toast({ title: "Facture creee a partir du devis" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de creer la facture", variant: "destructive" });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/superadmin/quotes/${quoteId}/generate-token`);
      return res.json();
    },
    onSuccess: (data) => {
      const publicUrl = `${window.location.origin}/q/${data.publicToken}`;
      navigator.clipboard.writeText(publicUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      toast({ title: "Lien copie", description: "Le lien public du devis a ete copie dans le presse-papiers" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de generer le lien", variant: "destructive" });
    },
  });

  const approveMandateMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/superadmin/quotes/${quoteId}/mandate/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      toast({ title: "Mandat approuve", description: "Le mandat administratif a ete valide" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'approuver le mandat", variant: "destructive" });
    },
  });

  const rejectMandateMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/superadmin/quotes/${quoteId}/mandate/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      toast({ title: "Mandat rejete", description: "Le mandat administratif a ete refuse" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de rejeter le mandat", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/superadmin/quotes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      setIsDialogOpen(false);
      setEditingQuoteId(null);
      resetForm();
      toast({ title: "Devis mis a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le devis", variant: "destructive" });
    },
  });

  const loadQuoteForEdit = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/superadmin/quotes/${quoteId}`, { credentials: 'include' });
      const quoteWithItems = await res.json();
      
      setFormData({
        clientName: quoteWithItems.clientName || "",
        clientEmail: quoteWithItems.clientEmail || "",
        clientAddress: quoteWithItems.clientAddress || "",
        clientSiret: quoteWithItems.clientSiret || "",
        tenantId: quoteWithItems.tenantId || "",
        leadId: quoteWithItems.leadId || "",
        taxRate: quoteWithItems.taxRate || 20,
        notes: quoteWithItems.notes || "",
        validUntil: quoteWithItems.validUntil ? format(new Date(quoteWithItems.validUntil), "yyyy-MM-dd") : "",
        emitterName: quoteWithItems.emitterName || companySettings?.companyName || "",
        emitterAddress: quoteWithItems.emitterAddress || "",
        emitterSiret: quoteWithItems.emitterSiret || "",
        emitterTva: quoteWithItems.emitterTva || "",
        paymentMethod: quoteWithItems.paymentMethod || null,
        quoteSource: quoteWithItems.quoteSource || "MANUAL",
      });
      
      if (quoteWithItems.lineItems && quoteWithItems.lineItems.length > 0) {
        setLineItems(quoteWithItems.lineItems.map((item: QuoteLineItem) => ({
          productId: item.productId || "",
          planId: item.planId || "",
          addonId: item.addonId || "",
          billingInterval: item.billingInterval,
          description: item.description,
          quantity: item.quantity,
          unitPriceEuros: item.unitPrice || 0,
          totalEuros: item.total || 0,
        })));
      } else {
        setLineItems([{ productId: "", planId: "", addonId: "",  billingInterval: null, description: "", quantity: 1, unitPriceEuros: 0, totalEuros: 0 }]);
      }
      
      setEditingQuoteId(quoteId);
      setIsDialogOpen(true);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger le devis", variant: "destructive" });
    }
  };

  const loadQuoteForView = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/superadmin/quotes/${quoteId}`, { credentials: 'include' });
      const quoteWithItems = await res.json();
      setViewingQuote(quoteWithItems);
      setIsViewDialogOpen(true);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger le devis", variant: "destructive" });
    }
  };

  const sendQuoteByEmail = async (quoteId: string, recipientEmail: string) => {
    if (!recipientEmail) {
      toast({ title: "Erreur", description: "Aucun email client", variant: "destructive" });
      return;
    }
    setSendingQuoteId(quoteId);
    try {
      const res = await apiRequest("POST", `/api/superadmin/quotes/${quoteId}/send`, { recipientEmail });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Succes", description: result.message });
        queryClient.invalidateQueries({ queryKey: ["/api/superadmin/quotes"] });
      } else {
        toast({ title: "Erreur", description: result.error || "Erreur d'envoi", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer le devis", variant: "destructive" });
    } finally {
      setSendingQuoteId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      clientName: "",
      clientEmail: "",
      clientAddress: "",
      clientSiret: "",
      tenantId: "",
      leadId: "",
      taxRate: 20,
      notes: "",
      validUntil: "",
      emitterName: companySettings?.companyName || "Voxpopulous",
      emitterAddress: companySettings?.address || "",
      emitterSiret: companySettings?.siret || "",
      emitterTva: companySettings?.tvaNumber || "",
      paymentMethod: null,
      quoteSource: "MANUAL",
    });
    setLineItems([{ productId: "", planId: "", addonId: "",  billingInterval: null, description: "", quantity: 1, unitPriceEuros: 0, totalEuros: 0 }]);
  };

  const calculateTotals = () => {
    const subtotalEuros = lineItems.reduce((sum, item) => sum + item.totalEuros, 0);
    const taxAmountEuros = subtotalEuros * (formData.taxRate / 100);
    const totalEuros = subtotalEuros + taxAmountEuros;
    return { subtotalEuros, taxAmountEuros, totalEuros };
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPriceEuros") {
      updated[index].totalEuros = updated[index].quantity * updated[index].unitPriceEuros;
    }
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { productId: "", planId: "", addonId: "",  billingInterval: null, description: "", quantity: 1, unitPriceEuros: 0, totalEuros: 0 }]);
  };

  const handleAddonSelect = (index: number, addonId: string) => {
    const updated = [...lineItems];
    const addon = addons?.find(a => a.id === addonId);
    
    if (addon) {
      const isAdminMandate = formData.paymentMethod === "ADMINISTRATIVE_MANDATE";
      const billingInterval: "MONTHLY" | "YEARLY" = isAdminMandate ? "YEARLY" : "MONTHLY";
      const unitPriceEuros = isAdminMandate 
        ? (addon.defaultYearlyPrice || 0)
        : (addon.defaultMonthlyPrice || 0);
      updated[index] = {
        ...updated[index],
        addonId: addonId,
        productId: "",
        planId: "",
        billingInterval: billingInterval,
        description: `Option ${addon.name}`,
        unitPriceEuros: unitPriceEuros,
        totalEuros: updated[index].quantity * unitPriceEuros,
      };
      setLineItems(updated);
    }
  };

  const handlePlanSelect = (index: number, planId: string) => {
    const updated = [...lineItems];
    if (planId === "custom" || planId === "") {
      updated[index] = { ...updated[index], planId: "", productId: "", addonId: "",  billingInterval: null };
    } else {
      const plan = plans?.find(p => p.id === planId);
      if (plan) {
        const isAdminMandate = formData.paymentMethod === "ADMINISTRATIVE_MANDATE";
        let billingInterval: "MONTHLY" | "YEARLY" = isAdminMandate ? "YEARLY" : "MONTHLY";
        let unitPriceEuros = isAdminMandate ? plan.yearlyPrice : plan.monthlyPrice;
        
        updated[index] = {
          ...updated[index],
          planId: planId,
          productId: "",
          addonId: "",
          
          billingInterval: billingInterval,
          description: `Abonnement ${plan.name}`,
          unitPriceEuros: unitPriceEuros,
          totalEuros: updated[index].quantity * unitPriceEuros,
        };
      }
    }
    setLineItems(updated);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const updated = [...lineItems];
    if (productId === "custom" || productId === "") {
      updated[index] = { ...updated[index], productId: "", planId: "", addonId: "",  billingInterval: null };
    } else {
      const product = products?.find(p => p.id === productId);
      if (product) {
        let unitPriceEuros = 0;
        let billingInterval: "MONTHLY" | "YEARLY" | null = null;
        
        if (product.type === "SUBSCRIPTION") {
          if (product.monthlyPrice && product.monthlyPrice > 0) {
            unitPriceEuros = product.monthlyPrice;
            billingInterval = "MONTHLY";
          } else if (product.yearlyPrice && product.yearlyPrice > 0) {
            unitPriceEuros = product.yearlyPrice;
            billingInterval = "YEARLY";
          }
        } else {
          unitPriceEuros = product.defaultUnitPrice || 0;
        }
        
        updated[index] = {
          ...updated[index],
          productId: productId,
          planId: "",
          addonId: "",
          
          billingInterval: billingInterval,
          description: product.name,
          unitPriceEuros: unitPriceEuros,
          totalEuros: updated[index].quantity * unitPriceEuros,
        };
      }
    }
    setLineItems(updated);
  };

  const handleBillingIntervalChange = (index: number, interval: "MONTHLY" | "YEARLY") => {
    const updated = [...lineItems];
    const item = updated[index];
    
    if (item.planId) {
      const plan = plans?.find(p => p.id === item.planId);
      if (plan) {
        const unitPriceEuros = interval === "MONTHLY" ? plan.monthlyPrice : plan.yearlyPrice;
        updated[index] = {
          ...updated[index],
          billingInterval: interval,
          unitPriceEuros: unitPriceEuros,
          totalEuros: updated[index].quantity * unitPriceEuros,
        };
        setLineItems(updated);
      }
    } else if (item.addonId) {
      const addon = addons?.find(a => a.id === item.addonId);
      if (addon) {
        const unitPriceEuros = interval === "MONTHLY" 
          ? (addon.defaultMonthlyPrice || 0) 
          : (addon.defaultYearlyPrice || 0);
        updated[index] = {
          ...updated[index],
          billingInterval: interval,
          unitPriceEuros: unitPriceEuros,
          totalEuros: updated[index].quantity * unitPriceEuros,
        };
        setLineItems(updated);
      }
    } else if (item.productId) {
      const product = products?.find(p => p.id === item.productId);
      if (product) {
        let unitPriceEuros = 0;
        if (interval === "MONTHLY" && product.monthlyPrice) {
          unitPriceEuros = product.monthlyPrice;
        } else if (interval === "YEARLY" && product.yearlyPrice) {
          unitPriceEuros = product.yearlyPrice;
        }
        updated[index] = {
          ...updated[index],
          billingInterval: interval,
          unitPriceEuros: unitPriceEuros,
          totalEuros: updated[index].quantity * unitPriceEuros,
        };
        setLineItems(updated);
      }
    }
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    const { subtotalEuros, taxAmountEuros, totalEuros } = calculateTotals();
    const validUntil = formData.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const payload = {
      ...formData,
      tenantId: formData.tenantId || null,
      leadId: formData.leadId || null,
      paymentMethod: formData.paymentMethod || null,
      quoteSource: formData.quoteSource,
      subtotal: subtotalEuros,
      taxAmount: taxAmountEuros,
      total: totalEuros,
      validUntil,
      lineItems: lineItems
        .filter(item => item.description)
        .map(item => ({
          productId: item.productId || null,
          planId: item.planId || null,
          addonId: item.addonId || null,
          billingInterval: item.billingInterval || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPriceEuros,
          total: item.totalEuros,
        })),
    };

    if (editingQuoteId) {
      updateMutation.mutate({ id: editingQuoteId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingQuoteId(null);
      resetForm();
    }
    setIsDialogOpen(open);
  };

  const formatPrice = (euros: number) => euros.toFixed(2);
  const formatEuros = (euros: number) => euros.toFixed(2);

  const downloadQuotePdf = async (quoteId: string, quoteNumber: string) => {
    try {
      const res = await fetch(`/api/superadmin/quotes/${quoteId}/pdf`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error('Erreur de telechargement');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de telecharger le PDF", variant: "destructive" });
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-quotes-title">
              Devis
            </h1>
            <p className="text-muted-foreground">
              Gestion des devis pour mandats administratifs
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-quote">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau devis
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={filterMandateStatus === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMandateStatus("all")}
            data-testid="button-filter-all"
          >
            Tous
          </Button>
          <Button
            variant={filterMandateStatus === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMandateStatus("pending")}
            data-testid="button-filter-pending-mandates"
          >
            <FileCheck className="h-4 w-4 mr-2" />
            Mandats en attente
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des devis</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement...</div>
            ) : !quotes?.length ? (
              <div className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Aucun devis pour le moment.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant TTC</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Mandat</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes
                    .filter((q) => filterMandateStatus === "all" || q.administrativeMandateStatus === "PENDING")
                    .map((quote) => {
                    const statusConfig = STATUS_LABELS[quote.status];
                    const mandateStatus = quote.administrativeMandateStatus;
                    return (
                      <TableRow key={quote.id} data-testid={`row-quote-${quote.id}`}>
                        <TableCell className="font-mono">{quote.quoteNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{quote.clientName}</div>
                            <div className="text-sm text-muted-foreground">{quote.clientEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(quote.total)} €
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mandateStatus === "PENDING" && (
                            <Badge className="bg-yellow-500 text-white">En attente</Badge>
                          )}
                          {mandateStatus === "APPROVED" && (
                            <Badge className="bg-green-500 text-white">Approuve</Badge>
                          )}
                          {mandateStatus === "REJECTED" && (
                            <Badge className="bg-red-500 text-white">Refuse</Badge>
                          )}
                          {!mandateStatus && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(quote.createdAt), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => loadQuoteForView(quote.id)}
                              data-testid={`button-view-quote-${quote.id}`}
                              title="Voir le devis"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => downloadQuotePdf(quote.id, quote.quoteNumber)}
                              data-testid={`button-download-quote-${quote.id}`}
                              title="Telecharger le PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => sendQuoteByEmail(quote.id, quote.clientEmail || "")}
                              disabled={sendingQuoteId === quote.id}
                              data-testid={`button-email-quote-${quote.id}`}
                              title="Envoyer par email"
                            >
                              {sendingQuoteId === quote.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Mail className="h-4 w-4" />
                              )}
                            </Button>
                            {quote.status === "DRAFT" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => loadQuoteForEdit(quote.id)}
                                  data-testid={`button-edit-quote-${quote.id}`}
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "SENT" })}
                                  data-testid={`button-send-quote-${quote.id}`}
                                  title="Marquer comme envoye"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {quote.status === "SENT" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => generateTokenMutation.mutate(quote.id)}
                                  disabled={generateTokenMutation.isPending}
                                  data-testid={`button-link-quote-${quote.id}`}
                                  title="Copier le lien de validation"
                                >
                                  {generateTokenMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Link2 className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => createInvoiceMutation.mutate(quote.id)}
                                  data-testid={`button-accept-quote-${quote.id}`}
                                  title="Convertir en facture"
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {mandateStatus === "PENDING" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => approveMandateMutation.mutate(quote.id)}
                                  disabled={approveMandateMutation.isPending}
                                  data-testid={`button-approve-mandate-${quote.id}`}
                                  title="Approuver le mandat"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  {approveMandateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => rejectMandateMutation.mutate(quote.id)}
                                  disabled={rejectMandateMutation.isPending}
                                  data-testid={`button-reject-mandate-${quote.id}`}
                                  title="Rejeter le mandat"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  {rejectMandateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuoteId ? "Modifier le devis" : "Nouveau devis"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="font-medium">Client</h3>
                <div className="space-y-2">
                  <Label>Nom / Raison sociale</Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    data-testid="input-quote-client-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    data-testid="input-quote-client-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Textarea
                    value={formData.clientAddress}
                    onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                    data-testid="input-quote-client-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SIRET</Label>
                  <Input
                    value={formData.clientSiret}
                    onChange={(e) => setFormData({ ...formData, clientSiret: e.target.value })}
                    data-testid="input-quote-client-siret"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-medium">Lier a</h3>
                <div className="space-y-2">
                  <Label>Client existant</Label>
                  <Select
                    value={formData.tenantId || "none"}
                    onValueChange={(value) => setFormData({ ...formData, tenantId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-quote-tenant">
                      <SelectValue placeholder="Selectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {tenants?.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prospect</Label>
                  <Select
                    value={formData.leadId || "none"}
                    onValueChange={(value) => setFormData({ ...formData, leadId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-quote-lead">
                      <SelectValue placeholder="Selectionner un prospect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {leads?.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.organisationName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Validite</Label>
                  <Input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    data-testid="input-quote-valid-until"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taux TVA (%)</Label>
                  <Input
                    type="number"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: parseInt(e.target.value) || 0 })}
                    data-testid="input-quote-tax-rate"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Mode de paiement
                </Label>
                <Select
                  value={formData.paymentMethod || "none"}
                  onValueChange={(value) => {
                    const newPaymentMethod = value === "none" ? null : value as "STRIPE" | "ADMINISTRATIVE_MANDATE";
                    setFormData({ ...formData, paymentMethod: newPaymentMethod });
                    if (newPaymentMethod === "ADMINISTRATIVE_MANDATE") {
                      const updatedItems = lineItems.map(item => {
                        if (item.planId || item.addonId) {
                          const plan = item.planId ? plans?.find(p => p.id === item.planId) : null;
                          const addon = item.addonId ? addons?.find(a => a.id === item.addonId) : null;
                          const yearlyPrice = plan ? plan.yearlyPrice : (addon ? (addon.defaultYearlyPrice || 0) : item.unitPriceEuros);
                          return { ...item, billingInterval: "YEARLY" as const, unitPriceEuros: yearlyPrice, totalEuros: item.quantity * yearlyPrice };
                        }
                        return item;
                      });
                      setLineItems(updatedItems);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-quote-payment-method">
                    <SelectValue placeholder="Selectionner le mode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non defini</SelectItem>
                    <SelectItem value="STRIPE">
                      <span className="flex items-center gap-2">Carte bancaire (Stripe)</span>
                    </SelectItem>
                    <SelectItem value="ADMINISTRATIVE_MANDATE">
                      <span className="flex items-center gap-2">Mandat administratif (annuel uniquement)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formData.paymentMethod === "ADMINISTRATIVE_MANDATE" && (
                  <p className="text-xs text-muted-foreground">
                    Les forfaits seront automatiquement factures a l'annee.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Origine du devis
                </Label>
                <Select
                  value={formData.quoteSource}
                  onValueChange={(value) => setFormData({ ...formData, quoteSource: value as "PROSPECT_CONTACT" | "TRIAL_CONVERSION" | "MANUAL" })}
                >
                  <SelectTrigger data-testid="select-quote-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Saisie manuelle</SelectItem>
                    <SelectItem value="PROSPECT_CONTACT">Contact prospect</SelectItem>
                    <SelectItem value="TRIAL_CONVERSION">Conversion essai gratuit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Lignes du devis</h3>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter une ligne
                </Button>
              </div>
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded-md">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <Select
                          value={item.addonId ? `addon:${item.addonId}` : (item.planId ? `plan:${item.planId}` : (item.productId ? `product:${item.productId}` : "custom"))}
                          onValueChange={(value) => {
                            if (value === "custom") {
                              const updated = [...lineItems];
                              updated[index] = { ...updated[index], planId: "", productId: "", addonId: "",  billingInterval: null };
                              setLineItems(updated);
                            } else if (value.startsWith("plan:")) {
                              handlePlanSelect(index, value.replace("plan:", ""));
                            } else if (value.startsWith("product:")) {
                              handleProductSelect(index, value.replace("product:", ""));
                            } else if (value.startsWith("addon:")) {
                              handleAddonSelect(index, value.replace("addon:", ""));
                            }
                          }}
                        >
                          <SelectTrigger data-testid={`select-line-product-${index}`}>
                            <SelectValue placeholder="Selectionner un forfait" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Saisie libre</SelectItem>
                            {plans?.filter(p => p.isActive).map((plan) => (
                              <SelectItem key={plan.id} value={`plan:${plan.id}`}>
                                {plan.name} - {plan.monthlyPrice.toFixed(2)} EUR/mois ou {plan.yearlyPrice.toFixed(2)} EUR/an
                              </SelectItem>
                            ))}
                            {products?.filter(p => p.type !== "SUBSCRIPTION").map((product) => (
                              <SelectItem key={product.id} value={`product:${product.id}`}>
                                {product.name} - {(product.defaultUnitPrice || 0).toFixed(2)} EUR
                              </SelectItem>
                            ))}
                            {addons?.filter(a => a.isActive).map((addon) => (
                              <SelectItem key={addon.id} value={`addon:${addon.id}`}>
                                Option {addon.name} - {(addon.defaultMonthlyPrice || 0).toFixed(2)} EUR/mois
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {(() => {
                        const hasPlanSelected = !!item.planId;
                        const hasAddonSelected = !!item.addonId;
                        const hasProductSelected = !!item.productId;
                        const selectedProduct = products?.find(p => p.id === item.productId);
                        const hasBothPrices = hasPlanSelected || hasAddonSelected || (selectedProduct?.type === "SUBSCRIPTION" && 
                          selectedProduct?.monthlyPrice && selectedProduct?.yearlyPrice);
                        const isAdminMandate = formData.paymentMethod === "ADMINISTRATIVE_MANDATE";
                        
                        const getTypeBadge = () => {
                          if (hasPlanSelected) return <Badge className="bg-blue-500 text-white text-xs">Forfait</Badge>;
                          if (hasAddonSelected) return <Badge className="bg-purple-500 text-white text-xs">Option</Badge>;
                          if (hasProductSelected) return <Badge className="bg-green-500 text-white text-xs">Service</Badge>;
                          return null;
                        };
                        
                        return (
                          <>
                            {(hasPlanSelected || hasAddonSelected || hasProductSelected) && (
                              <div className="col-span-1 flex items-center">
                                {getTypeBadge()}
                              </div>
                            )}
                            {hasBothPrices && (
                              <div className={hasPlanSelected || hasAddonSelected || hasProductSelected ? "col-span-1" : "col-span-2"}>
                                <Select
                                  value={item.billingInterval || "MONTHLY"}
                                  onValueChange={(value) => handleBillingIntervalChange(index, value as "MONTHLY" | "YEARLY")}
                                  disabled={isAdminMandate}
                                >
                                  <SelectTrigger data-testid={`select-line-interval-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MONTHLY">Mensuel</SelectItem>
                                    <SelectItem value="YEARLY">Annuel</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className={`${item.planId || item.addonId || (products?.find(p => p.id === item.productId)?.type === "SUBSCRIPTION" && 
                        products?.find(p => p.id === item.productId)?.monthlyPrice && 
                        products?.find(p => p.id === item.productId)?.yearlyPrice) ? "col-span-3" : "col-span-5"}`}>
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, "description", e.target.value)}
                          data-testid={`input-line-description-${index}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          placeholder="Qte"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, "quantity", parseInt(e.target.value) || 0)}
                          data-testid={`input-line-quantity-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Prix unit."
                          value={item.unitPriceEuros}
                          onChange={(e) => updateLineItem(index, "unitPriceEuros", parseFloat(e.target.value) || 0)}
                          data-testid={`input-line-unit-price-${index}`}
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        <span className="font-medium text-sm">{formatEuros(item.totalEuros)} €</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2 text-right">
                <div className="flex justify-end gap-4">
                  <span className="text-muted-foreground">Sous-total HT:</span>
                  <span className="font-medium w-24">{formatEuros(calculateTotals().subtotalEuros)} €</span>
                </div>
                <div className="flex justify-end gap-4">
                  <span className="text-muted-foreground">TVA ({formData.taxRate}%):</span>
                  <span className="font-medium w-24">{formatEuros(calculateTotals().taxAmountEuros)} €</span>
                </div>
                <div className="flex justify-end gap-4 text-lg">
                  <span className="font-medium">Total TTC:</span>
                  <span className="font-bold w-24">{formatEuros(calculateTotals().totalEuros)} €</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes / Conditions</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Conditions de paiement, mentions particulieres..."
                data-testid="input-quote-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={(createMutation.isPending || updateMutation.isPending) || !formData.clientName || !formData.clientEmail}
              data-testid="button-save-quote"
            >
              {(createMutation.isPending || updateMutation.isPending) 
                ? (editingQuoteId ? "Mise a jour..." : "Creation...") 
                : (editingQuoteId ? "Mettre a jour" : "Creer le devis")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {viewingQuote && (
            <div className="bg-background">
              <div className="bg-muted px-8 py-6 border-b">
                <div className="flex flex-col md:flex-row md:justify-between gap-6">
                  <div className="flex-shrink-0">
                    <div className="text-3xl font-bold tracking-tight text-primary">DEVIS</div>
                    <div className="text-lg font-mono mt-1" data-testid="text-quote-number">{viewingQuote.quoteNumber}</div>
                    <div className="mt-2">
                      <Badge className={STATUS_LABELS[viewingQuote.status]?.color} data-testid="badge-quote-status">
                        {STATUS_LABELS[viewingQuote.status]?.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <h2 className="text-xl font-bold" data-testid="text-quote-emitter-name">{viewingQuote.emitterName}</h2>
                    {viewingQuote.emitterAddress && (
                      <p className="text-sm text-muted-foreground mt-1">{viewingQuote.emitterAddress.replace(/\n/g, ', ')}</p>
                    )}
                    {viewingQuote.emitterSiret && (
                      <p className="text-xs text-muted-foreground mt-1">SIRET: {viewingQuote.emitterSiret}</p>
                    )}
                    {viewingQuote.emitterTva && (
                      <p className="text-xs text-muted-foreground">TVA: {viewingQuote.emitterTva}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Destinataire</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold text-lg" data-testid="text-quote-client-name">{viewingQuote.clientName}</p>
                      <p className="text-sm text-muted-foreground">{viewingQuote.clientEmail}</p>
                      {viewingQuote.clientAddress && (
                        <p className="text-sm mt-2 whitespace-pre-line">{viewingQuote.clientAddress}</p>
                      )}
                      {viewingQuote.clientSiret && (
                        <p className="text-xs text-muted-foreground mt-2">SIRET: {viewingQuote.clientSiret}</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Informations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Date d'emission:</span>
                        <span className="font-medium">{format(new Date(viewingQuote.createdAt), "d MMMM yyyy", { locale: fr })}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Valide jusqu'au:</span>
                        <span className="font-medium">{format(new Date(viewingQuote.validUntil), "d MMMM yyyy", { locale: fr })}</span>
                      </div>
                      {viewingQuote.paymentMethod && (
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Mode de paiement:</span>
                          <span className="font-medium">
                            {viewingQuote.paymentMethod === "STRIPE" ? "Carte bancaire" : "Mandat administratif"}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="w-full">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead className="font-semibold min-w-[200px]">Description</TableHead>
                          <TableHead className="text-center font-semibold w-16">Qte</TableHead>
                          <TableHead className="text-right font-semibold w-28">Prix HT</TableHead>
                          <TableHead className="text-right font-semibold w-28">Total HT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingQuote.lineItems?.map((item, index) => (
                          <TableRow key={index} data-testid={`row-quote-item-${index}`}>
                            <TableCell>
                              <span className="font-medium">{item.description}</span>
                              {item.billingInterval && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {item.billingInterval === "MONTHLY" ? "Mensuel" : "Annuel"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right font-mono">{formatPrice(item.unitPrice)} €</TableCell>
                            <TableCell className="text-right font-mono font-medium">{formatPrice(item.total)} €</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Card className="w-72">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Sous-total HT</span>
                        <span className="font-mono">{formatPrice(viewingQuote.subtotal)} €</span>
                      </div>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">TVA ({viewingQuote.taxRate}%)</span>
                        <span className="font-mono">{formatPrice(viewingQuote.taxAmount)} €</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between gap-2 items-center">
                          <span className="font-semibold text-lg">Total TTC</span>
                          <span className="font-mono font-bold text-xl" data-testid="text-quote-total">{formatPrice(viewingQuote.total)} €</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {viewingQuote.notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Notes et conditions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-line">{viewingQuote.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Validation section - signature or scanned document */}
                {viewingQuote.status === "ACCEPTED" && (viewingQuote.signatureImageUrl || viewingQuote.scannedDocumentUrl) && (
                  <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Validation du client
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {viewingQuote.acceptedAt && (
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Date d'acceptation:</span>
                          <span className="font-medium">{format(new Date(viewingQuote.acceptedAt), "d MMMM yyyy 'a' HH:mm", { locale: fr })}</span>
                        </div>
                      )}
                      {viewingQuote.acceptedByName && (
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Accepte par:</span>
                          <span className="font-medium">{viewingQuote.acceptedByName} {viewingQuote.acceptedByEmail && `(${viewingQuote.acceptedByEmail})`}</span>
                        </div>
                      )}
                      
                      {/* Digital signature */}
                      {viewingQuote.signatureImageUrl && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <PenTool className="h-4 w-4" />
                            Signature numerique
                          </p>
                          <div className="bg-white border rounded-md p-4 inline-block">
                            <img 
                              src={viewingQuote.signatureImageUrl} 
                              alt="Signature du client" 
                              className="max-h-24 max-w-full"
                              data-testid="img-quote-signature"
                            />
                          </div>
                          {viewingQuote.signedByName && (
                            <p className="text-xs text-muted-foreground">
                              Signe par: {viewingQuote.signedByName}
                              {viewingQuote.signedByCapacity && ` - ${viewingQuote.signedByCapacity}`}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Scanned document / purchase order */}
                      {viewingQuote.scannedDocumentUrl && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <FileUp className="h-4 w-4" />
                            Document joint (bon de commande)
                          </p>
                          <div className="flex items-center gap-2">
                            <a 
                              href={viewingQuote.scannedDocumentUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                              data-testid="link-quote-document"
                            >
                              <FileText className="h-4 w-4" />
                              {viewingQuote.scannedDocumentOriginalName || "Telecharger le document"}
                            </a>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="border-t px-8 py-4 flex justify-between items-center bg-muted">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} data-testid="button-close-quote-view">
                  Fermer
                </Button>
                <div className="flex gap-2">
                  {viewingQuote.status === "DRAFT" && (
                    <Button variant="outline" onClick={() => {
                      setIsViewDialogOpen(false);
                      loadQuoteForEdit(viewingQuote.id);
                    }} data-testid="button-edit-quote">
                      <Pencil className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                  )}
                  <Button onClick={() => downloadQuotePdf(viewingQuote.id, viewingQuote.quoteNumber)} data-testid="button-download-quote-pdf">
                    <Download className="h-4 w-4 mr-2" />
                    Telecharger PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
