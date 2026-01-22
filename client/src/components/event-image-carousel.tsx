import { useQuery } from "@tanstack/react-query";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Image as ImageIcon } from "lucide-react";

interface EventImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
}

interface EventImageCarouselProps {
  tenantSlug?: string;
  associationId?: string;
  eventId: string;
  className?: string;
}

export function EventImageCarousel({ 
  tenantSlug, 
  associationId, 
  eventId, 
  className = "" 
}: EventImageCarouselProps) {
  const apiUrl = tenantSlug 
    ? `/api/public/tenants/${tenantSlug}/events/${eventId}/images`
    : `/api/public/associations/${associationId}/events/${eventId}/images`;

  const { data: images = [], isLoading } = useQuery<EventImage[]>({
    queryKey: ["event-images", eventId],
    queryFn: async () => {
      const response = await fetch(apiUrl);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!eventId && (!!tenantSlug || !!associationId),
  });

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <Skeleton className="w-full h-48 rounded-lg" />
      </div>
    );
  }

  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    return (
      <div className={className}>
        <div className="overflow-hidden rounded-lg">
          <img
            src={images[0].imageUrl}
            alt={images[0].caption || "Image de l'evenement"}
            className="w-full h-48 object-cover"
          />
          {images[0].caption && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {images[0].caption}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Carousel className="w-full" opts={{ loop: true }}>
        <CarouselContent>
          {images.map((image) => (
            <CarouselItem key={image.id}>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={image.imageUrl}
                    alt={image.caption || "Image de l'evenement"}
                    className="w-full h-48 object-cover"
                  />
                  {image.caption && (
                    <p className="text-sm text-muted-foreground p-2 text-center">
                      {image.caption}
                    </p>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
      <p className="text-xs text-muted-foreground text-center mt-2">
        {images.length} images
      </p>
    </div>
  );
}

interface EventImageGalleryProps {
  images: EventImage[];
  className?: string;
}

export function EventImageGallery({ images, className = "" }: EventImageGalleryProps) {
  if (images.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 border border-dashed rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2" />
          <p>Aucune image</p>
        </div>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className={className}>
        <div className="overflow-hidden rounded-lg">
          <img
            src={images[0].imageUrl}
            alt={images[0].caption || "Image de l'evenement"}
            className="w-full h-48 object-cover"
          />
          {images[0].caption && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {images[0].caption}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Carousel className="w-full" opts={{ loop: true }}>
        <CarouselContent>
          {images.map((image) => (
            <CarouselItem key={image.id}>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={image.imageUrl}
                    alt={image.caption || "Image de l'evenement"}
                    className="w-full h-48 object-cover"
                  />
                  {image.caption && (
                    <p className="text-sm text-muted-foreground p-2 text-center">
                      {image.caption}
                    </p>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
      <p className="text-xs text-muted-foreground text-center mt-2">
        {images.length} images
      </p>
    </div>
  );
}
