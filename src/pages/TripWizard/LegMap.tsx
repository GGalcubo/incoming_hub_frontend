import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/Icon";
import {
  loadGoogleMaps,
  type GMapsLatLngLiteral,
  type GMapsMap,
  type GMapsMarker,
  type GMapsMouseEvent,
  type GMapsPolyline,
} from "../../lib/gmaps";
import type { Leg } from "../../types/domain";
import { BA_CENTER, geocodeAddress, reverseGeocode } from "./geocode";

interface LegMapProps {
  leg: Leg;
  onPickOrigin: (text: string, coords: GMapsLatLngLiteral) => void;
  onPickDestination: (text: string, coords: GMapsLatLngLiteral) => void;
  lockOrigin?: boolean;
}

export function LegMap({ leg, onPickOrigin, onPickDestination, lockOrigin = false }: LegMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMapsMap | null>(null);
  const originMarkerRef = useRef<GMapsMarker | null>(null);
  const destinationMarkerRef = useRef<GMapsMarker | null>(null);
  const polylineRef = useRef<GMapsPolyline | null>(null);
  const initialPin: "origin" | "destination" = lockOrigin ? "destination" : "origin";
  const activePinRef = useRef<"origin" | "destination">(initialPin);
  const lockOriginRef = useRef(lockOrigin);
  const onPickOriginRef = useRef(onPickOrigin);
  const onPickDestinationRef = useRef(onPickDestination);
  const [activePin, setActivePin] = useState<"origin" | "destination">(initialPin);
  const [ready, setReady] = useState(false);

  lockOriginRef.current = lockOrigin;
  onPickOriginRef.current = onPickOrigin;
  onPickDestinationRef.current = onPickDestination;

  useEffect(() => {
    activePinRef.current = activePin;
  }, [activePin]);

  useEffect(() => {
    if (lockOrigin && activePin === "origin") {
      setActivePin("destination");
      activePinRef.current = "destination";
    }
  }, [lockOrigin, activePin]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !maps || !containerRef.current) return;
      const map = new maps.Map(containerRef.current, {
        center: leg.originCoords ?? leg.destinationCoords ?? BA_CENTER,
        zoom: leg.originCoords || leg.destinationCoords ? 13 : 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        zoomControl: true,
      });
      mapRef.current = map;
      map.addListener("click", (...args: unknown[]) => {
        const ev = args[0] as GMapsMouseEvent | undefined;
        const ll = ev?.latLng;
        if (!ll) return;
        const point = { lat: ll.lat(), lng: ll.lng() };
        reverseGeocode(point, (addr) => {
          const text = addr ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
          if (lockOriginRef.current) {
            onPickDestinationRef.current(text, point);
            activePinRef.current = "destination";
            setActivePin("destination");
            return;
          }
          if (activePinRef.current === "origin") onPickOriginRef.current(text, point);
          else onPickDestinationRef.current(text, point);
          activePinRef.current = activePinRef.current === "origin" ? "destination" : "origin";
          setActivePin(activePinRef.current);
        });
      });
      setReady(true);
      if (leg.origin && !leg.originCoords) {
        geocodeAddress(leg.origin, (coords) => {
          if (coords) onPickOriginRef.current(leg.origin, coords);
        });
      }
      if (leg.destination && !leg.destinationCoords) {
        geocodeAddress(leg.destination, (coords) => {
          if (coords) onPickDestinationRef.current(leg.destination, coords);
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    const placeOrSet = (
      ref: React.MutableRefObject<GMapsMarker | null>,
      coords: GMapsLatLngLiteral | undefined,
      label: string,
      kind: "origin" | "destination",
    ) => {
      if (!coords) {
        ref.current?.setMap(null);
        ref.current = null;
        return;
      }
      if (ref.current) {
        ref.current.setPosition(coords);
        return;
      }
      const draggable = !(kind === "origin" && lockOriginRef.current);
      const marker = new maps.Marker({
        position: coords,
        map,
        draggable,
        label: { text: label, color: "#fff", fontWeight: "700" },
        title: kind === "origin" ? "Origen" : "Destino",
      });
      if (draggable) {
        marker.addListener("dragend", (...args: unknown[]) => {
          const ev = args[0] as GMapsMouseEvent | undefined;
          const ll = ev?.latLng;
          if (!ll) return;
          const point = { lat: ll.lat(), lng: ll.lng() };
          reverseGeocode(point, (addr) => {
            const text = addr ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
            if (kind === "origin") onPickOriginRef.current(text, point);
            else onPickDestinationRef.current(text, point);
          });
        });
      }
      ref.current = marker;
    };

    placeOrSet(originMarkerRef, leg.originCoords, "A", "origin");
    placeOrSet(destinationMarkerRef, leg.destinationCoords, "B", "destination");

    if (leg.originCoords && leg.destinationCoords) {
      const bounds = new maps.LatLngBounds();
      bounds.extend(leg.originCoords);
      bounds.extend(leg.destinationCoords);
      map.fitBounds(bounds, 48);
      if (polylineRef.current) {
        polylineRef.current.setPath([leg.originCoords, leg.destinationCoords]);
      } else {
        polylineRef.current = new maps.Polyline({
          path: [leg.originCoords, leg.destinationCoords],
          map,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.85,
          strokeWeight: 3,
          geodesic: true,
        });
      }
    } else {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      const single = leg.originCoords ?? leg.destinationCoords;
      if (single) {
        map.panTo(single);
        map.setZoom(14);
      }
    }
  }, [ready, leg.originCoords, leg.destinationCoords]);

  useEffect(() => {
    return () => {
      originMarkerRef.current?.setMap(null);
      destinationMarkerRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
    };
  }, []);

  const pinBtn = (kind: "origin" | "destination", label: string) => {
    const active = activePin === kind;
    return (
      <button
        type="button"
        onClick={() => setActivePin(kind)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${active ? "var(--fg-primary)" : "var(--border-subtle)"}`,
          background: active ? "var(--brand-tint-soft)" : "var(--bg-surface)",
          color: active ? "var(--fg-primary)" : "var(--fg-secondary)",
          font: active ? "600 12px/16px Heming" : "500 12px/16px Heming",
          cursor: "pointer",
        }}
      >
        <Icon name="mappin" size={12} />
        {label}
      </button>
    );
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {!lockOrigin && pinBtn("origin", "Marcar origen (A)")}
          {pinBtn("destination", "Marcar destino (B)")}
        </div>
        <span style={{ font: "400 11px/14px Heming", color: "var(--fg-muted)" }}>
          {lockOrigin
            ? "Hacé click o arrastrá el pin de destino"
            : "Hacé click o arrastrá los pines"}
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 280,
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      />
    </div>
  );
}
