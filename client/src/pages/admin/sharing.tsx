import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Download, Share2, QrCode, ExternalLink, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Tenant, User } from "@shared/schema";

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

export default function AdminSharing() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  if (userError) {
    navigate(`/structures/${params.slug}/admin/login`);
    return null;
  }

  const publicUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/structures/${params.slug}` 
    : `/structures/${params.slug}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast({
        title: "Lien copie",
        description: "Le lien a ete copie dans le presse-papiers.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien.",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 400, 400);
      }
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-${params.slug}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <AdminLayout 
      tenant={tenant || null} 
      user={user || null}
      accountBlocked={user?.accountBlocked}
      blockReason={user?.blockReason}
    >
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-sharing-title">
            <Share2 className="h-7 w-7 text-primary" />
            Partage
          </h1>
          <p className="text-muted-foreground mt-2">
            Partagez le lien de votre espace citoyen pour engager vos membres et recevoir leurs contributions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Lien de partage
              </CardTitle>
              <CardDescription>
                Ce lien permet aux citoyens d'acceder a votre espace de participation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  value={publicUrl} 
                  readOnly 
                  className="font-mono text-sm"
                  data-testid="input-public-url"
                />
                <Button 
                  onClick={copyToClipboard}
                  variant="outline"
                  size="icon"
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2" data-testid="button-open-link">
                    <ExternalLink className="h-4 w-4" />
                    Ouvrir
                  </Button>
                </a>
                <Button onClick={copyToClipboard} className="gap-2" data-testid="button-copy-full">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copie" : "Copier le lien"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code
              </CardTitle>
              <CardDescription>
                Integrez ce QR code dans vos communications pour un acces facile via smartphone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <QRCodeSVG 
                  id="qr-code-svg"
                  value={publicUrl}
                  size={200}
                  level="H"
                  includeMargin
                  data-testid="img-qr-code"
                />
              </div>
              
              <Button onClick={downloadQRCode} className="w-full gap-2" data-testid="button-download-qr">
                <Download className="h-4 w-4" />
                Telecharger le QR code
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Comment utiliser ces outils ?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Badge variant="secondary" className="mb-2">Etape 1</Badge>
                <h4 className="font-semibold">Communications papier</h4>
                <p className="text-sm text-muted-foreground">
                  Imprimez le QR code sur vos bulletins municipaux, affiches ou flyers pour un acces rapide via smartphone.
                </p>
              </div>
              <div className="space-y-2">
                <Badge variant="secondary" className="mb-2">Etape 2</Badge>
                <h4 className="font-semibold">Communications numeriques</h4>
                <p className="text-sm text-muted-foreground">
                  Partagez le lien dans vos emails, newsletters ou sur les reseaux sociaux de votre collectivite.
                </p>
              </div>
              <div className="space-y-2">
                <Badge variant="secondary" className="mb-2">Etape 3</Badge>
                <h4 className="font-semibold">Site web</h4>
                <p className="text-sm text-muted-foreground">
                  Ajoutez un bouton ou banniere sur votre site officiel redirigeant vers votre espace de participation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
