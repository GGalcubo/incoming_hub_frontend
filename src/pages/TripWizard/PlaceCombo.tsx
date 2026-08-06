import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Field";
import {
  hasGoogleMapsKey,
  loadGoogleMapsPlaces,
  type GMapsAutocompleteService,
  type GMapsPlacePrediction,
} from "../../lib/gmaps";
import { normalizePlace } from "../../lib/places";
import { shortenAddress } from "./geocode";
import styles from "./PlaceCombo.module.css";

interface PlaceSuggestion {
  id: string;
  main: string;
  secondary?: string;
  full: string;
  placeId?: string;
}

// Datos del lugar elegido en el autocomplete: la descripción completa que se
// muestra en el input y sus partes (nombre + dirección) ya desglosadas por
// Google, para persistirlas por separado.
export interface PlacePick {
  description: string;
  name: string;
  address: string;
}

interface PlaceComboProps {
  value: string;
  onChange: (v: string) => void;
  onPick?: (pick: PlacePick, placeId: string) => void;
}

export function PlaceCombo({ value, onChange, onPick }: PlaceComboProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef<GMapsAutocompleteService | null>(null);
  const sessionTokenRef = useRef<unknown>(null);
  const debounceRef = useRef<number | null>(null);
  const usingGmaps = hasGoogleMapsKey();

  useEffect(() => {
    if (!usingGmaps) return;
    let cancelled = false;
    loadGoogleMapsPlaces().then((places) => {
      if (cancelled || !places) return;
      serviceRef.current = new places.AutocompleteService();
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    });
    return () => {
      cancelled = true;
    };
  }, [usingGmaps]);

  const queryGmaps = (q: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setLoading(true);
    svc.getPlacePredictions(
      {
        // Resuelve alias comunes (EZE → Aeropuerto Ezeiza) antes de consultar a
        // Google, así devuelve la terminal real con su placeId.
        input: normalizePlace(q),
        componentRestrictions: { country: "ar" },
        language: "es",
        sessionToken: sessionTokenRef.current,
      },
      (preds) => {
        setLoading(false);
        if (!preds) {
          setSuggestions([]);
          return;
        }
        setSuggestions(
          preds.slice(0, 6).map((pred: GMapsPlacePrediction) => ({
            id: pred.place_id,
            placeId: pred.place_id,
            main: pred.structured_formatting?.main_text ?? pred.description,
            secondary: pred.structured_formatting?.secondary_text
              ? shortenAddress(pred.structured_formatting.secondary_text)
              : undefined,
            full: shortenAddress(pred.description),
          })),
        );
      },
    );
  };

  const handleInput = (next: string) => {
    onChange(next);
    setOpen(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = next.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    // Sin Google Maps no hay sugerencias: el campo queda como texto libre. Antes
    // caía a una lista fija de lugares de ejemplo, que parecían resultados reales.
    if (usingGmaps && serviceRef.current) {
      debounceRef.current = window.setTimeout(() => queryGmaps(trimmed), 180);
    }
  };

  return (
    <div className={styles.wrap}>
      <Input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          setOpen(true);
          const trimmed = (value || "").trim();
          if (trimmed && suggestions.length === 0 && usingGmaps && serviceRef.current) {
            queryGmaps(trimmed);
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={usingGmaps ? "Buscar lugar (Google Maps)…" : "Buscar lugar…"}
      />
      {open && (loading || suggestions.length > 0) && (
        <div className={styles.dropdown}>
          {loading && suggestions.length === 0 && <div className={styles.loading}>Buscando…</div>}
          {suggestions.map((s) => (
            <div
              key={s.id}
              onMouseDown={() => {
                onChange(s.full);
                if (s.placeId && onPick)
                  onPick(
                    { description: s.full, name: s.main, address: s.secondary ?? "" },
                    s.placeId,
                  );
                setSuggestions([]);
                setOpen(false);
              }}
              className={styles.option}
            >
              <Icon name="mappin" size={13} className={styles.pinIcon} />
              <span className={styles.optText}>
                <span className={styles.optMain}>{s.main}</span>
                {s.secondary && <span className={styles.optSub}>{s.secondary}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
