import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ObjectUploaderProps {
  onGetUploadUrl: () => Promise<{ uploadURL: string }>;
  onComplete?: (objectPath: string) => void;
  buttonClassName?: string;
  children: ReactNode;
  accept?: string;
  maxFileSize?: number;
  compressImages?: boolean;
  maxImageWidth?: number;
  maxImageHeight?: number;
  imageQuality?: number;
}

async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export function ObjectUploader({
  onGetUploadUrl,
  onComplete,
  buttonClassName,
  children,
  accept = "image/*",
  maxFileSize = 10485760,
  compressImages = true,
  maxImageWidth = 1920,
  maxImageHeight = 1080,
  imageQuality = 0.8,
}: ObjectUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      alert(`Le fichier est trop volumineux. Taille maximum: ${Math.round(maxFileSize / 1024 / 1024)} Mo`);
      return;
    }

    setIsUploading(true);
    try {
      let uploadData: Blob = file;
      let contentType = file.type;

      if (compressImages && file.type.startsWith("image/") && file.type !== "image/gif") {
        uploadData = await compressImage(file, maxImageWidth, maxImageHeight, imageQuality);
        contentType = "image/jpeg";
      }

      const { uploadURL } = await onGetUploadUrl();
      
      await fetch(uploadURL, {
        method: "PUT",
        body: uploadData,
        headers: {
          "Content-Type": contentType,
        },
      });

      const publicUrl = uploadURL.split("?")[0];
      onComplete?.(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Erreur lors de l'envoi du fichier");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        style={{ display: "none" }}
        data-testid="input-file-upload"
      />
      <Button 
        type="button" 
        variant="outline" 
        onClick={handleClick} 
        className={buttonClassName}
        disabled={isUploading}
        data-testid="button-upload-file"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Envoi...
          </>
        ) : (
          children
        )}
      </Button>
    </div>
  );
}
