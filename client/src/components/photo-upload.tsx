import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  currentPhotoUrl?: string | null;
  currentPhotoObjectPath?: string | null;
  initials?: string;
  onPhotoChange: (photoObjectPath: string | null) => void;
  disabled?: boolean;
}

export function PhotoUpload({
  currentPhotoUrl,
  currentPhotoObjectPath,
  initials = "?",
  onPhotoChange,
  disabled = false,
}: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getPhotoDisplayUrl = (objectPath: string | null | undefined, photoUrl: string | null | undefined): string | undefined => {
    if (objectPath) {
      const parts = objectPath.split('/');
      const uploadsIndex = parts.findIndex(p => p === 'uploads');
      if (uploadsIndex !== -1) {
        return '/objects/' + parts.slice(uploadsIndex).join('/');
      }
    }
    return photoUrl || undefined;
  };

  const displayUrl = previewUrl || getPhotoDisplayUrl(currentPhotoObjectPath, currentPhotoUrl);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Erreur", description: "Veuillez selectionner une image.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erreur", description: "L'image ne doit pas depasser 5 Mo.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      const response = await apiRequest("POST", "/api/objects/upload");
      const { uploadURL } = await response.json() as { uploadURL: string };

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      const url = new URL(uploadURL);
      const objectPath = url.pathname;
      
      onPhotoChange(objectPath);
      toast({ title: "Photo telechargee", description: "La photo a ete telechargee avec succes." });
    } catch (error: any) {
      console.error("Upload error:", error);
      setPreviewUrl(null);
      toast({ title: "Erreur", description: error.message || "Echec du telechargement.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onPhotoChange(null);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={displayUrl || undefined} alt="Photo" />
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          data-testid="input-photo-file"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            data-testid="button-upload-photo"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? "Telechargement..." : "Choisir une photo"}
          </Button>
          {(displayUrl || previewUrl) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              data-testid="button-remove-photo"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou GIF. Max 5 Mo.</p>
      </div>
    </div>
  );
}
