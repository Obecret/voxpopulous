import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, CreditCard, FileText, Loader2, Upload, AlertCircle, Building2, Calendar, CalendarDays, PenTool, FileUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/signature-pad";
import type { Quote, QuoteLineItem, SubscriptionPlan, Product } from "@shared/schema";

type EnrichedLineItem = QuoteLineItem & { 
  plan?: SubscriptionPlan; 
  product?: Product;
  planMonthlyPrice?: number;
  planYearlyPrice?: number;
  addonMonthlyPrice?: number;
  addonYearlyPrice?: number;
};

type QuoteWithItems = {
  quote: Quote;
  lineItems: EnrichedLineItem[];
};

function formatCurrency(euros: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StripePaymentForm({ 
  clientSecret, 
  onSuccess, 
  onError 
}: { 
  clientSecret: string; 
  onSuccess: () => void; 
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href + "?success=true",
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message || "Une erreur est survenue");
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        data-testid="button-pay-stripe"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Traitement en cours...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Payer maintenant
          </>
        )}
      </Button>
    </form>
  );
}

function MandateValidationForm({
  token,
  onSuccess,
  onError,
}: {
  token: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const [validationMethod, setValidationMethod] = useState<"signature" | "upload">("signature");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerCapacity, setSignerCapacity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureDataUrl(dataUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validationMethod === "signature") {
      if (!signatureDataUrl) {
        toast({ variant: "destructive", title: "Veuillez signer le devis" });
        return;
      }
      if (!signerName) {
        toast({ variant: "destructive", title: "Veuillez entrer votre nom" });
        return;
      }
      if (!signerCapacity) {
        toast({ variant: "destructive", title: "Veuillez entrer votre qualite" });
        return;
      }
    } else {
      if (!file) {
        toast({ variant: "destructive", title: "Veuillez selectionner un fichier" });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (validationMethod === "signature") {
        await apiRequest("POST", `/api/public/quotes/${token}/accept-with-signature`, {
          signatureDataUrl,
          signerName,
          signerCapacity,
        });
      } else {
        const uploadUrlRes = await apiRequest("POST", `/api/public/quotes/${token}/scanned-document/upload-url`, {
          filename: file!.name,
          contentType: file!.type,
        });
        const { signedUrl, key } = await uploadUrlRes.json();

        await fetch(signedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file!.type,
          },
        });

        await apiRequest("POST", `/api/public/quotes/${token}/accept-with-document`, {
          documentKey: key,
          originalFilename: file!.name,
        });
      }

      onSuccess();
    } catch (error: any) {
      onError(error.message || "Erreur lors de la validation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={validationMethod} onValueChange={(v) => setValidationMethod(v as "signature" | "upload")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signature" data-testid="tab-signature">
            <PenTool className="h-4 w-4 mr-1" />
            Signature
          </TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <FileUp className="h-4 w-4 mr-1" />
            Document
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signature" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="signer-name">Nom complet du signataire</Label>
            <Input
              id="signer-name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Jean Dupont"
              data-testid="input-signer-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signer-capacity">Qualite / Fonction</Label>
            <Input
              id="signer-capacity"
              value={signerCapacity}
              onChange={(e) => setSignerCapacity(e.target.value)}
              placeholder="Maire, Directeur General des Services..."
              data-testid="input-signer-capacity"
            />
          </div>
          <div className="space-y-2">
            <Label>Votre signature</Label>
            <SignaturePad onSignatureChange={handleSignatureChange} width={380} height={150} />
          </div>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Telechargez le devis signe et scanne au format PDF, JPG ou PNG.
          </p>
          <div className="space-y-2">
            <Label htmlFor="scanned-file">Document signe</Label>
            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <Input
                id="scanned-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                data-testid="input-scanned-file"
              />
              <label htmlFor="scanned-file" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Cliquez pour selectionner un fichier
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Button 
        type="submit" 
        disabled={isSubmitting || (validationMethod === "signature" ? (!signatureDataUrl || !signerName || !signerCapacity) : !file)} 
        className="w-full"
        data-testid="button-validate-quote"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Validation en cours...
          </>
        ) : (
          <>
            <Check className="mr-2 h-4 w-4" />
            Valider le devis
          </>
        )}
      </Button>
    </form>
  );
}

export default function PublicQuoteValidation() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<"STRIPE" | "ADMINISTRATIVE_MANDATE">("STRIPE");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setIsAccepted(true);
    }
  }, []);

  const { data: quoteData, isLoading, error } = useQuery<QuoteWithItems>({
    queryKey: ["/api/public/quotes", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/quotes/${token}`);
      if (!res.ok) throw new Error("Devis non trouve");
      return res.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    async function loadStripeKey() {
      try {
        const res = await fetch("/api/stripe/publishable-key");
        const { publishableKey } = await res.json();
        if (publishableKey) {
          setStripePromise(loadStripe(publishableKey));
        }
      } catch (e) {
        console.error("Failed to load Stripe key:", e);
      }
    }
    loadStripeKey();
  }, []);

  const createSubscriptionMutation = useMutation({
    mutationFn: async (interval: "MONTHLY" | "YEARLY") => {
      const res = await apiRequest("POST", `/api/public/quotes/${token}/stripe/create-subscription`, {
        billingInterval: interval,
        email: quoteData?.quote?.clientEmail,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/public/quotes/${token}/stripe/create-payment-intent`, {
        email: quoteData?.quote?.clientEmail,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: error.message || "Erreur" });
    },
  });

  const hasPlanItems = quoteData?.lineItems?.some(item => item.planId) || false;

  const handleBillingIntervalChange = (interval: "MONTHLY" | "YEARLY") => {
    setBillingInterval(interval);
    // Reset client secret so user can re-initiate payment with new interval
    setClientSecret(null);
  };

  // Only create payment intent for non-subscription items automatically
  useEffect(() => {
    if (quoteData?.quote?.status === "SENT" && paymentMethod === "STRIPE" && !clientSecret && stripePromise && !hasPlanItems) {
      createPaymentIntentMutation.mutate();
    }
  }, [quoteData, paymentMethod, clientSecret, stripePromise, hasPlanItems]);

  const handlePaymentMethodSelect = (value: "STRIPE" | "ADMINISTRATIVE_MANDATE") => {
    setPaymentMethod(value);
    if (value === "ADMINISTRATIVE_MANDATE") {
      setBillingInterval("YEARLY");
    }
    // Only create payment intent for non-plan items automatically
    if (value === "STRIPE" && !clientSecret && !hasPlanItems) {
      createPaymentIntentMutation.mutate();
    }
  };
  
  // Handler to initiate Stripe subscription payment when user confirms
  const handleInitiateStripePayment = () => {
    if (hasPlanItems && !clientSecret) {
      createSubscriptionMutation.mutate(billingInterval);
    }
  };

  const handlePaymentSuccess = () => {
    setIsAccepted(true);
    toast({ title: "Paiement effectue avec succes" });
  };

  const handleMandateSuccess = () => {
    setIsAccepted(true);
    toast({ title: "Mandat envoye avec succes. Nous vous contacterons sous peu." });
  };

  const handleError = (error: string) => {
    toast({ variant: "destructive", title: error });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !quoteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Devis non trouve</h2>
            <p className="text-muted-foreground">
              Ce lien n'est pas valide ou a expire.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { quote, lineItems } = quoteData;
  const isExpired = new Date(quote.validUntil) < new Date();
  const alreadyAccepted = quote.status === "ACCEPTED";
  
  // Calculate dynamic totals based on billing interval for Stripe payments
  const calculateDynamicTotal = (interval: "MONTHLY" | "YEARLY") => {
    let subtotal = 0;
    lineItems.forEach(item => {
      if (item.planId && item.planMonthlyPrice !== undefined && item.planYearlyPrice !== undefined) {
        subtotal += (interval === "YEARLY" ? item.planYearlyPrice : item.planMonthlyPrice) * item.quantity;
      } else if (item.addonId && item.addonMonthlyPrice !== undefined && item.addonYearlyPrice !== undefined) {
        subtotal += (interval === "YEARLY" ? item.addonYearlyPrice : item.addonMonthlyPrice) * item.quantity;
      } else {
        subtotal += item.unitPrice * item.quantity;
      }
    });
    return subtotal;
  };
  
  // Get the display total based on payment method and interval
  const displaySubtotal = paymentMethod === "STRIPE" ? calculateDynamicTotal(billingInterval) : quote.subtotal;
  const displayTotal = displaySubtotal; // TVA non applicable (auto-entrepreneur)

  if (isAccepted || alreadyAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 mx-auto mb-4 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Devis accepte</h2>
            <p className="text-muted-foreground">
              Merci ! Votre devis a ete accepte. Nous vous contacterons prochainement.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Devis expire</h2>
            <p className="text-muted-foreground">
              Ce devis a expire le {formatDate(quote.validUntil)}.
              Veuillez nous contacter pour obtenir un nouveau devis.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quote.status !== "SENT") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Devis non disponible</h2>
            <p className="text-muted-foreground">
              Ce devis ne peut pas etre valide pour le moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Validation du devis</h1>
          <p className="text-muted-foreground">
            Devis n. {quote.quoteNumber}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resume du devis
              </CardTitle>
              <CardDescription>
                Valide jusqu'au {formatDate(quote.validUntil)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{quote.clientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{quote.clientEmail}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {lineItems.map((item) => {
                  // Calculate display price based on payment method and interval
                  let displayPrice = item.unitPrice;
                  if (paymentMethod === "STRIPE") {
                    if (item.planId && item.planMonthlyPrice !== undefined && item.planYearlyPrice !== undefined) {
                      displayPrice = billingInterval === "YEARLY" ? item.planYearlyPrice : item.planMonthlyPrice;
                    } else if (item.addonId && item.addonMonthlyPrice !== undefined && item.addonYearlyPrice !== undefined) {
                      displayPrice = billingInterval === "YEARLY" ? item.addonYearlyPrice : item.addonMonthlyPrice;
                    }
                  }
                  return (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.description}</p>
                        {item.planId && paymentMethod === "STRIPE" && (
                          <Badge variant="secondary" className="mt-1">
                            {billingInterval === "YEARLY" ? "Annuel" : "Mensuel"}
                          </Badge>
                        )}
                        {item.planId && paymentMethod === "ADMINISTRATIVE_MANDATE" && (
                          <Badge variant="secondary" className="mt-1">Annuel</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(displayPrice * item.quantity)}</p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x {formatCurrency(displayPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT</span>
                  <span>{formatCurrency(displaySubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TVA non applicable - art. 293B CGI</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(displayTotal)}{paymentMethod === "STRIPE" && hasPlanItems ? `/${billingInterval === "YEARLY" ? "an" : "mois"}` : ""}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Methode de paiement
              </CardTitle>
              <CardDescription>
                Choisissez votre methode de validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => handlePaymentMethodSelect(v as "STRIPE" | "ADMINISTRATIVE_MANDATE")}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 rounded-md border hover-elevate cursor-pointer">
                  <RadioGroupItem value="STRIPE" id="stripe" data-testid="radio-stripe" />
                  <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span className="font-medium">Carte bancaire</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Paiement immediat par carte
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-md border hover-elevate cursor-pointer">
                  <RadioGroupItem value="ADMINISTRATIVE_MANDATE" id="mandate" data-testid="radio-mandate" />
                  <Label htmlFor="mandate" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium">Mandat administratif</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pour les collectivites publiques
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              <Separator />

              {paymentMethod === "STRIPE" && (
                <div className="space-y-4">
                  {hasPlanItems && (
                    <div className="space-y-3">
                      <Label>Frequence de facturation</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant={billingInterval === "MONTHLY" ? "default" : "outline"}
                          onClick={() => handleBillingIntervalChange("MONTHLY")}
                          className="justify-start"
                          data-testid="button-monthly"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Mensuel
                        </Button>
                        <Button
                          type="button"
                          variant={billingInterval === "YEARLY" ? "default" : "outline"}
                          onClick={() => handleBillingIntervalChange("YEARLY")}
                          className="justify-start"
                          data-testid="button-yearly"
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          Annuel
                        </Button>
                      </div>
                    </div>
                  )}
                  {(createSubscriptionMutation.isPending || createPaymentIntentMutation.isPending) ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : clientSecret && stripePromise ? (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: "stripe",
                          variables: {
                            colorPrimary: "#0f172a",
                          },
                        },
                      }}
                    >
                      <StripePaymentForm
                        clientSecret={clientSecret}
                        onSuccess={handlePaymentSuccess}
                        onError={handleError}
                      />
                    </Elements>
                  ) : (
                    <Button
                      onClick={hasPlanItems ? handleInitiateStripePayment : () => createPaymentIntentMutation.mutate()}
                      className="w-full"
                      data-testid="button-init-payment"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Proceder au paiement ({billingInterval === "YEARLY" ? "annuel" : "mensuel"})
                    </Button>
                  )}
                </div>
              )}

              {paymentMethod === "ADMINISTRATIVE_MANDATE" && (
                <MandateValidationForm
                  token={token}
                  onSuccess={handleMandateSuccess}
                  onError={handleError}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          En validant ce devis, vous acceptez nos conditions generales de vente.
        </p>
      </div>
    </div>
  );
}
