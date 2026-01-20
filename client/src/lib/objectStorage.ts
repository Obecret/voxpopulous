import { apiRequest } from "./queryClient";

export class ObjectStorageService {
  static async getUploadUrl(): Promise<{ uploadURL: string }> {
    const response = await apiRequest("POST", "/api/objects/upload");
    return response.json();
  }

  static normalizeObjectPath(rawUrl: string): string {
    if (!rawUrl.startsWith("https://storage.googleapis.com/")) {
      return rawUrl;
    }
    
    const url = new URL(rawUrl);
    const pathname = url.pathname;
    
    // Extract everything after "/uploads/" from the path
    // The pathname format is: /bucketname[/optional-prefix]/uploads/...
    // We need to return /objects/uploads/... (preserve full path after /uploads/)
    const uploadsIndex = pathname.indexOf("/uploads/");
    if (uploadsIndex !== -1) {
      const fullSuffix = pathname.substring(uploadsIndex + 1); // Gets "uploads/..."
      return `/objects/${fullSuffix}`;
    }
    
    // Fallback: extract everything after the bucket name (first path segment)
    const pathParts = pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2) {
      // Skip the bucket name (first part), join the rest
      const objectPath = pathParts.slice(1).join("/");
      return `/objects/${objectPath}`;
    }
    
    return pathname;
  }
}
