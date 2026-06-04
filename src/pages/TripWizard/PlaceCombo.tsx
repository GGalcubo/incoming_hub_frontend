import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Field";
import { PLACES } from "../../data/seed";
import {
  hasGoogleMapsKey,
  loadGoogleMapsPlaces,
  type GMapsAutocompleteService,
  type GMapsPlacePrediction,
} from "../../lib/gmaps";
import { shortenAddress } from "./geocode";
import styles from "./PlaceCombo.module.css";

interface PlaceSuggestion {
  id: string;
  main: string;
  secondary?: string;
  full: string;
  placeId?: string;
}

interface PlaceComboProps {
  value: string;
  onChange: (v: string) => void;
  onPick?: (description: string, placeId: string) => void;
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

  const queryLocal = (q: string): PlaceSuggestion[] => {
    const needle = q.toLowerCase();
    return PLACES.filter((place) => place.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((place) => ({ id: place, main: place, full: place }));
  };

  const queryGmaps = (q: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setLoading(true);
    svc.getPlacePredictions(
      {
        input: q,
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
    if (usingGmaps && serviceRef.current) {
      debounceRef.current = window.setTimeout(() => queryGmaps(trimmed), 180);
    } else {
      setSuggestions(queryLocal(trimmed));
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
          if (trimmed && suggestions.length === 0) {
            if (usingGmaps && serviceRef.current) queryGmaps(trimmed);
            else setSuggestions(queryLocal(trimmed));
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
                if (s.placeId && onPick) onPick(s.full, s.placeId);
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
