import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/Icon";
import { cx } from "../../lib/cx";
import {
  loadGoogleMaps,
  type GMapsDirectionsRenderer,
  type GMapsDirectionsService,
  type GMapsLatLngLiteral,
  type GMapsMap,
  type GMapsMarker,
  type GMapsMouseEvent,
  type GMapsPolyline,
} from "../../lib/gmaps";
import type { Leg } from "../../types/domain";
import { BA_CENTER, geocodeAddress, reverseGeocode } from "./geocode";
import styles from "./RouteMap.module.css";

interface RoutePoint {
  label: string;
  text: string;
  coords?: GMapsLatLngLiteral;
}

// El recorrido es una cadena: origen del leg 0 = A, y el destino de cada leg
// es el siguiente punto (B, C, D...). El destino de un leg es a su vez el
// origen del siguiente, por eso hay legs.length + 1 puntos.
function buildPoints(legs: Leg[]): RoutePoint[] {
  const first = legs[0];
  const pts: RoutePoint[] = [
    { label: "A", text: first?.origin ?? "", coords: first?.originCoords },
  ];
  legs.forEach((leg, i) => {
    pts.push({
      label: String.fromCharCode(66 + i),
      text: leg.destination,
      coords: leg.destinationCoords,
    });
  });
  return pts;
}

interface RouteMapProps {
  legs: Leg[];
  onSetPoint: (index: number, text: string, coords: GMapsLatLngLiteral) => void;
}

export function RouteMap({ legs, onSetPoint }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMapsMap | null>(null);
  const markersRef = useRef<(GMapsMarker | null)[]>([]);
  const polylineRef = useRef<GMapsPolyline | null>(null);
  const directionsServiceRef = useRef<GMapsDirectionsService | null>(null);
  const directionsRendererRef = useRef<GMapsDirectionsRenderer | null>(null);
  // Clave del último recorrido pedido: descarta respuestas de Directions tardías.
  const routeKeyRef = useRef("");

  const points = buildPoints(legs);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onSetPointRef = useRef(onSetPoint);
  onSetPointRef.current = onSetPoint;

  const firstUnset = points.findIndex((p) => !p.coords);
  const [activeIdx, setActiveIdx] = useState(firstUnset === -1 ? 0 : firstUnset);
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;
  const [ready, setReady] = useState(false);

  // Si se quitan destinos y el punto activo deja de existir, lo reubicamos.
  useEffect(() => {
    if (activeIdx >= points.length) {
      setActiveIdx(Math.max(0, points.length - 1));
    }
  }, [points.length, activeIdx]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !maps || !containerRef.current) return;
      const pts = pointsRef.current;
      const firstCoords = pts.find((p) => p.coords)?.coords;
      const map = new maps.Map(containerRef.current, {
        center: firstCoords ?? BA_CENTER,
        zoom: firstCoords ? 13 : 11,
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
        const idx = activeIdxRef.current;
        reverseGeocode(point, (addr) => {
          const text = addr ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
          onSetPointRef.current(idx, text, point);
          const cur = pointsRef.current;
          let next = -1;
          for (let j = idx + 1; j < cur.length; j++) {
            if (!cur[j].coords) {
              next = j;
              break;
            }
          }
          if (next === -1) {
            for (let j = 0; j < cur.length; j++) {
              if (j !== idx && !cur[j].coords) {
                next = j;
                break;
              }
            }
          }
          if (next === -1) next = Math.min(idx + 1, cur.length - 1);
          activeIdxRef.current = next;
          setActiveIdx(next);
        });
      });
      setReady(true);
      pts.forEach((p, idx) => {
        if (p.text && !p.coords) {
          geocodeAddress(p.text, (coords) => {
            if (coords) onSetPointRef.current(idx, p.text, coords);
          });
        }
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coordsKey = points
    .map((p) => (p.coords ? `${p.coords.lat},${p.coords.lng}` : "_"))
    .join("|");

  useEffect(() => {
    if (!ready) return;
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;
    const pts = pointsRef.current;
    const markers = markersRef.current;

    for (let i = pts.length; i < markers.length; i++) {
      markers[i]?.setMap(null);
      markers[i] = null;
    }
    markers.length = pts.length;

    pts.forEach((p, i) => {
      if (!p.coords) {
        markers[i]?.setMap(null);
        markers[i] = null;
        return;
      }
      const existing = markers[i];
      if (existing) {
        existing.setPosition(p.coords);
        return;
      }
      const marker = new maps.Marker({
        position: p.coords,
        map,
        draggable: true,
        label: { text: p.label, color: "#fff", fontWeight: "700" },
        title: p.label,
      });
      marker.addListener("dragend", (...args: unknown[]) => {
        const ev = args[0] as GMapsMouseEvent | undefined;
        const ll = ev?.latLng;
        if (!ll) return;
        const point = { lat: ll.lat(), lng: ll.lng() };
        reverseGeocode(point, (addr) => {
          const text = addr ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
          onSetPointRef.current(i, text, point);
        });
      });
      markers[i] = marker;
    });

    const path = pts.filter((p) => p.coords).map((p) => p.coords!);
    routeKeyRef.current = coordsKey;

    // Dibuja una línea recta (geodésica) como fallback si no hay ruta por calle.
    const drawStraight = () => {
      if (polylineRef.current) {
        polylineRef.current.setPath(path);
      } else {
        polylineRef.current = new maps.Polyline({
          path,
          map,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.85,
          strokeWeight: 3,
          geodesic: true,
        });
      }
    };
    const clearStraight = () => {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
    const clearRoute = () => {
      directionsRendererRef.current?.setMap(null);
      directionsRendererRef.current = null;
    };

    if (path.length >= 2) {
      const bounds = new maps.LatLngBounds();
      path.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, 48);

      if (!directionsServiceRef.current && maps.DirectionsService) {
        directionsServiceRef.current = new maps.DirectionsService();
      }
      const svc = directionsServiceRef.current;
      if (svc) {
        // Pedimos la ruta por calle (en auto). Mientras llega, ocultamos la recta.
        clearStraight();
        svc.route(
          {
            origin: path[0],
            destination: path[path.length - 1],
            waypoints: path.slice(1, -1).map((c) => ({ location: c, stopover: true })),
            travelMode: maps.TravelMode?.DRIVING ?? "DRIVING",
          },
          (result, status) => {
            // Descarta respuestas obsoletas (los puntos ya cambiaron).
            if (routeKeyRef.current !== coordsKey) return;
            if (result && status === (maps.DirectionsStatus?.OK ?? "OK")) {
              if (!directionsRendererRef.current) {
                directionsRendererRef.current = new maps.DirectionsRenderer({
                  map,
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: "#3b82f6",
                    strokeOpacity: 0.9,
                    strokeWeight: 4,
                  },
                });
              }
              directionsRendererRef.current.setDirections(result);
              clearStraight();
            } else {
              // Sin ruta (p. ej. tramo no manejable): caemos a la línea recta.
              clearRoute();
              drawStraight();
            }
          },
        );
      } else {
        drawStraight();
      }
    } else {
      clearRoute();
      clearStraight();
      if (path.length === 1) {
        map.panTo(path[0]);
        map.setZoom(14);
      }
    }
  }, [ready, coordsKey]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m?.setMap(null));
      polylineRef.current?.setMap(null);
      directionsRendererRef.current?.setMap(null);
    };
  }, []);

  const activeLabel = points[activeIdx]?.label ?? "A";

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.pinGroup}>
          {points.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cx(styles.pinBtn, activeIdx === i && styles.pinBtnActive)}
            >
              <Icon name="mappin" size={12} />
              {p.label}
            </button>
          ))}
        </div>
        <span className={styles.hint}>
          Hacé click para marcar el punto {activeLabel} o arrastrá los pines
        </span>
      </div>
      <div ref={containerRef} className={styles.map} />
    </div>
  );
}
