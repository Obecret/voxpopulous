import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { MapPin, Locate, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number | null, lng: number | null) => void;
  readonly?: boolean;
  height?: string;
}

function LocationMarker({ 
  position, 
  onPositionChange,
  readonly 
}: { 
  position: [number, number] | null; 
  onPositionChange: (lat: number, lng: number) => void;
  readonly?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (!readonly) {
        onPositionChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return position ? <Marker position={position} /> : null;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  
  return null;
}

export function LocationPicker({ 
  latitude, 
  longitude, 
  onLocationChange, 
  readonly = false,
  height = "300px"
}: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(
    latitude && longitude ? [latitude, longitude] : null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.603354, 1.888334]);

  useEffect(() => {
    if (latitude && longitude) {
      setPosition([latitude, longitude]);
      setMapCenter([latitude, longitude]);
    }
  }, [latitude, longitude]);

  const handlePositionChange = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationChange(lat, lng);
    setLocationError(null);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setLocationError("La geolocalisation n'est pas supportee par votre navigateur");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition([lat, lng]);
        setMapCenter([lat, lng]);
        onLocationChange(lat, lng);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Acces a la localisation refuse. Veuillez autoriser l'acces dans votre navigateur.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Position indisponible. Verifiez que le GPS est active.");
            break;
          case error.TIMEOUT:
            setLocationError("Delai depasse pour obtenir la position.");
            break;
          default:
            setLocationError("Erreur lors de la geolocalisation.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="space-y-2">
      {!readonly && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGeolocate}
            disabled={isLocating}
            data-testid="button-geolocate"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Locate className="h-4 w-4 mr-2" />
            )}
            Me localiser
          </Button>
          {position && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {position[0].toFixed(5)}, {position[1].toFixed(5)}
            </span>
          )}
        </div>
      )}

      {locationError && (
        <p className="text-sm text-destructive">{locationError}</p>
      )}

      <div 
        className="rounded-md overflow-hidden border"
        style={{ height }}
        data-testid="map-container"
      >
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController center={mapCenter} />
          <LocationMarker 
            position={position} 
            onPositionChange={handlePositionChange}
            readonly={readonly}
          />
        </MapContainer>
      </div>

      {!readonly && !position && (
        <p className="text-sm text-muted-foreground">
          Cliquez sur la carte pour indiquer l'emplacement du signalement, ou utilisez le bouton "Me localiser".
        </p>
      )}
    </div>
  );
}

export function LocationDisplay({ 
  latitude, 
  longitude,
  height = "200px"
}: { 
  latitude?: number | null; 
  longitude?: number | null;
  height?: string;
}) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return (
      <div className="flex items-center justify-center h-32 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Aucune localisation enregistree
        </p>
      </div>
    );
  }

  return (
    <LocationPicker
      latitude={latitude}
      longitude={longitude}
      onLocationChange={() => {}}
      readonly={true}
      height={height}
    />
  );
}

interface MapMarker {
  id: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  title?: string;
  status?: string;
}

interface MultiMarkerMapProps {
  markers: MapMarker[];
  height?: string;
  onMarkerClick?: (id: string) => void;
}

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  NEW: "#ef4444",
  ACKNOWLEDGED: "#f97316",
  IN_PROGRESS: "#3b82f6",
  RESOLVED: "#22c55e",
  REJECTED: "#6b7280",
};

function createColoredIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function MultiMarkerMap({ 
  markers, 
  height = "400px",
  onMarkerClick
}: MultiMarkerMapProps) {
  const validMarkers = markers.filter(m => 
    m.latitude !== null && m.latitude !== undefined && 
    m.longitude !== null && m.longitude !== undefined
  ) as Array<Omit<MapMarker, 'latitude' | 'longitude'> & { latitude: number; longitude: number }>;
  
  const defaultCenter: [number, number] = [46.603354, 1.888334];
  const center: [number, number] = validMarkers.length > 0 
    ? [validMarkers[0].latitude, validMarkers[0].longitude]
    : defaultCenter;
  
  const bounds = validMarkers.length > 1 
    ? L.latLngBounds(validMarkers.map(m => [m.latitude, m.longitude] as [number, number]))
    : null;

  if (validMarkers.length === 0) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-md" style={{ height }}>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Aucun signalement avec localisation
        </p>
      </div>
    );
  }

  return (
    <div 
      className="rounded-md overflow-hidden border"
      style={{ height }}
      data-testid="multi-marker-map"
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        bounds={bounds || undefined}
        boundsOptions={{ padding: [50, 50] }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds && <FitBounds bounds={bounds} />}
        {validMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            icon={createColoredIcon(INCIDENT_STATUS_COLORS[marker.status || "NEW"] || "#ef4444")}
            eventHandlers={{
              click: () => onMarkerClick?.(marker.id),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}

function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  
  useEffect(() => {
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [bounds, map]);
  
  return null;
}
