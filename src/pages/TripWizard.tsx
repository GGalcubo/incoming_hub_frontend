import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CATEGORIES, PLACES, TODAY } from "../data/seed";
import type { Leg, Passenger, Trip } from "../types/domain";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  hasGoogleMapsKey,
  loadGoogleMaps,
  loadGoogleMapsPlaces,
  type GMapsAutocompleteService,
  type GMapsGeocoder,
  type GMapsLatLngLiteral,
  type GMapsMap,
  type GMapsMarker,
  type GMapsMouseEvent,
  type GMapsPlacePrediction,
  type GMapsPolyline,
} from "../lib/gmaps";

const BA_CENTER: GMapsLatLngLiteral = { lat: -34.6037, lng: -58.3816 };

type Mode = "new" | "edit";

interface TripWizardProps {
  mode: Mode;
  trip?: Trip;
  onSave: (t: Trip) => void;
  onCancel: () => void;
  onCancelTrip?: (t: Trip) => void;
}

const EMPTY_TRIP: Trip = {
  id: "RX-NEW",
  agc: "",
  solicitante: "",
  date: TODAY,
  time: "",
  cat: "",
  legs: [{ type: "in", origin: "", destination: "", flight: "", obs: "" }],
  passengers: [{ name: "", phone: "", dni: "", luggage: 0 }],
  obs: "",
  est: "PENDIENTE",
  costs: { total: 0, viaje: 0, espera: 0, peajes: 0, estacionamiento: 0, otros: 0 },
  history: [],
  pax: 1,
  ori: "",
  dst: "",
  ref: "",
  unit: "",
};

interface StepDef {
  id: "datos" | "tramos" | "pasajeros" | "costos" | "historial" | "resumen";
  label: string;
}

export function TripWizard({ mode, trip, onSave, onCancel, onCancelTrip }: TripWizardProps) {
  const isMobile = useIsMobile();
  const stepsBase: StepDef[] = [
    { id: "datos", label: "Datos" },
    { id: "tramos", label: "Tramos" },
    { id: "pasajeros", label: "Pasajeros" },
    ...(mode === "edit"
      ? ([
          { id: "costos", label: "Costos" },
          { id: "historial", label: "Historial" },
        ] as StepDef[])
      : []),
    { id: "resumen", label: "Resumen" },
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const [t, setT] = useState<Trip>(() => trip ?? EMPTY_TRIP);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const step = stepsBase[stepIdx];
  const set = (patch: Partial<Trip>) => setT((prev) => ({ ...prev, ...patch }));
  const pad = isMobile ? "12px 16px" : "14px 28px";
  const contentPad = isMobile ? "16px" : "24px 28px";
  const cardPad = isMobile ? 16 : 24;

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step.id === "datos") {
      if (!t.solicitante) e.solicitante = "Ingresá el solicitante";
      if (!t.date) e.date = "La fecha es obligatoria";
      if (!t.time) e.time = "La hora es obligatoria";
      if (!t.cat) e.cat = "La categoría es obligatoria";
    }
    if (step.id === "tramos") {
      t.legs.forEach((leg, i) => {
        if (!leg.origin) e[`leg-${i}-origin`] = "Origen requerido";
        if (!leg.destination) e[`leg-${i}-destination`] = "Destino requerido";
      });
    }
    if (step.id === "pasajeros") {
      t.passengers.forEach((p, i) => {
        if (!p.name) e[`pax-${i}-name`] = "Ingresá el nombre";
        if (p.phone && !/^[+\d\s-]{8,20}$/.test(p.phone)) e[`pax-${i}-phone`] = "Teléfono inválido";
      });
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validateStep()) setStepIdx((i) => Math.min(i + 1, stepsBase.length - 1));
  };
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-app)",
      }}
    >
      <div
        style={{
          background: "var(--bg-app)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: pad,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 10 : 8,
          flex: "none",
        }}
      >
        {isMobile ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    font: "600 11px/14px Heming",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "var(--fg-muted)",
                  }}
                >
                  Paso {stepIdx + 1} de {stepsBase.length}
                </span>
                <span style={{ font: "600 14px/20px Heming", color: "var(--fg-primary)" }}>
                  · {step.label}
                </span>
              </div>
              {mode === "edit" && t.est !== "CANCELADO" && onCancelTrip && (
                <button
                  onClick={() => setShowCancel(true)}
                  title="Cancelar viaje"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--danger-border)",
                    color: "var(--danger-fg)",
                    width: 32,
                    height: 32,
                    borderRadius: 9999,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {stepsBase.map((s, i) => {
                const done = i < stepIdx;
                const active = i === stepIdx;
                return (
                  <Fragment key={s.id}>
                    <button
                      onClick={() => {
                        if (i <= stepIdx) setStepIdx(i);
                      }}
                      title={s.label}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: active
                          ? "var(--brand-500)"
                          : done
                            ? "var(--brand-tint)"
                            : "var(--bg-elevated)",
                        color: active
                          ? "var(--fg-on-brand)"
                          : done
                            ? "var(--success-fg)"
                            : "var(--fg-tertiary)",
                        font: "600 12px/14px Heming",
                        border: "none",
                        cursor: i <= stepIdx ? "pointer" : "default",
                        flex: "none",
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </button>
                    {i < stepsBase.length - 1 && (
                      <span style={{ flex: 1, height: 1, background: "var(--border-strong)" }} />
                    )}
                  </Fragment>
                );
              })}
              {mode === "edit" && (
                <span style={{ marginLeft: 6 }}>
                  <Badge status={t.est} />
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            {stepsBase.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <Fragment key={s.id}>
                  <button
                    onClick={() => {
                      if (i <= stepIdx) setStepIdx(i);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: active ? "var(--brand-tint-soft)" : "transparent",
                      color: active
                        ? "var(--fg-primary)"
                        : done
                          ? "var(--success-fg)"
                          : "var(--fg-muted)",
                      font: active ? "600 13px/18px Heming" : "500 13px/18px Heming",
                      cursor: i <= stepIdx ? "pointer" : "default",
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: active
                          ? "var(--brand-500)"
                          : done
                            ? "var(--brand-tint)"
                            : "var(--bg-elevated)",
                        color: active
                          ? "var(--fg-on-brand)"
                          : done
                            ? "var(--success-fg)"
                            : "var(--fg-tertiary)",
                        font: "600 12px/14px Heming",
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {s.label}
                  </button>
                  {i < stepsBase.length - 1 && (
                    <span style={{ width: 18, height: 1, background: "var(--border-strong)" }} />
                  )}
                </Fragment>
              );
            })}

            <div style={{ flex: 1 }} />
            {mode === "edit" && t.est !== "CANCELADO" && (
              <Button kind="danger" icon="x" onClick={() => setShowCancel(true)}>
                Cancelar viaje
              </Button>
            )}
            {mode === "edit" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
                <span style={{ font: "500 12px/16px Heming", color: "var(--fg-muted)" }}>
                  Estado
                </span>
                <Badge status={t.est} />
              </div>
            )}
          </>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: contentPad,
          background: "var(--bg-app)",
        }}
      >
        <div
          style={{
            maxWidth: step.id === "resumen" ? 880 : 720,
            margin: "0 auto",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: cardPad,
          }}
        >
          {step.id === "datos" && <StepDatos t={t} set={set} errs={errs} isMobile={isMobile} />}
          {step.id === "tramos" && <StepTramos t={t} set={set} errs={errs} isMobile={isMobile} />}
          {step.id === "pasajeros" && (
            <StepPasajeros t={t} set={set} errs={errs} isMobile={isMobile} />
          )}
          {step.id === "costos" && <StepCostos t={t} />}
          {step.id === "historial" && <StepHistorial t={t} />}
          {step.id === "resumen" && <StepResumen t={t} />}
        </div>
      </div>

      <div
        style={{
          minHeight: 64,
          padding: isMobile ? "10px 16px" : "0 28px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-app)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flex: "none",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Button kind="ghost" size={isMobile ? "sm" : "md"} onClick={onCancel}>
          {mode === "edit" ? "Volver" : "Descartar"}
        </Button>
        <div style={{ display: "flex", gap: isMobile ? 6 : 10, flexWrap: "wrap" }}>
          {stepIdx > 0 && (
            <Button icon="chevleft" size={isMobile ? "sm" : "md"} onClick={back}>
              {isMobile ? "" : "Anterior"}
            </Button>
          )}
          {stepIdx < stepsBase.length - 1 && (
            <Button kind="primary" size={isMobile ? "sm" : "md"} onClick={next}>
              Siguiente <Icon name="chevright" size={isMobile ? 12 : 14} />
            </Button>
          )}
          {step.id === "resumen" && (
            <Button
              kind="primary"
              icon="check"
              size={isMobile ? "sm" : "md"}
              onClick={() => onSave(t)}
            >
              {mode === "edit" ? "Guardar" : "Guardar viaje"}
            </Button>
          )}
        </div>
      </div>

      {showCancel && onCancelTrip && (
        <Modal
          open
          onClose={() => setShowCancel(false)}
          title="Cancelar viaje"
          width={460}
          footer={
            <>
              <Button onClick={() => setShowCancel(false)}>Volver</Button>
              <Button
                kind="dangerSolid"
                disabled={!cancelReason.trim()}
                onClick={() => {
                  onCancelTrip({
                    ...t,
                    est: "CANCELADO",
                    obs: t.obs + (t.obs ? " · " : "") + "Cancelado: " + cancelReason,
                  });
                  setShowCancel(false);
                }}
              >
                Confirmar cancelación
              </Button>
            </>
          }
        >
          <div
            style={{
              font: "400 13px/18px Heming",
              color: "var(--fg-tertiary)",
              marginBottom: 14,
            }}
          >
            Una vez cancelado el viaje no se puede revertir. Indicá el motivo:
          </div>
          <Field label="Motivo de cancelación" required>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej. Cancelado por el pasajero"
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}

interface StepProps {
  t: Trip;
  set: (patch: Partial<Trip>) => void;
  errs: Record<string, string>;
  isMobile: boolean;
}

function StepDatos({ t, set, errs, isMobile }: StepProps) {
  const grid: CSSProperties = isMobile ? grid1 : grid2;
  return (
    <>
      <h3 style={h2}>Datos principales</h3>
      <div style={grid}>
        <Field label="Solicitante" required error={errs.solicitante} span={isMobile ? 1 : 2}>
          <Input
            value={t.solicitante ?? ""}
            onChange={(e) => set({ solicitante: e.target.value })}
            placeholder="Nombre y apellido"
          />
        </Field>
        <Field label="Fecha" required error={errs.date}>
          <Input type="date" value={t.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Hora" required error={errs.time}>
          <Input type="time" value={t.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field
          label="Categoría de servicio"
          required
          error={errs.cat}
          span={isMobile ? 1 : 2}
        >
          <Select value={t.cat} onChange={(e) => set({ cat: e.target.value })}>
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
}

function StepTramos({ t, set, errs, isMobile }: StepProps) {
  const grid: CSSProperties = isMobile ? grid1 : grid2;
  const updateLeg = (i: number, patch: Partial<Leg>) => {
    const next = t.legs.map((l, j) => (j === i ? { ...l, ...patch } : l));
    if ("destination" in patch && i + 1 < next.length) {
      next[i + 1] = {
        ...next[i + 1],
        origin: patch.destination ?? "",
        originCoords: patch.destinationCoords ?? next[i].destinationCoords,
      };
    }
    set({ legs: next });
  };
  const addLeg = () => {
    const last = t.legs[t.legs.length - 1];
    set({
      legs: [
        ...t.legs,
        {
          type: "in",
          origin: last?.destination ?? "",
          originCoords: last?.destinationCoords,
          destination: "",
          flight: "",
          obs: "",
        },
      ],
    });
  };
  const rmLeg = (i: number) => {
    const next = t.legs.filter((_, j) => j !== i);
    if (i > 0 && i < t.legs.length) {
      const prev = next[i - 1];
      if (next[i]) {
        next[i] = {
          ...next[i],
          origin: prev.destination,
          originCoords: prev.destinationCoords,
        };
      }
    }
    set({ legs: next });
  };

  return (
    <>
      <h3 style={h2}>Tramos del viaje</h3>
      <p style={p}>Agregá uno o más tramos. Para tramos in/out se pide número de vuelo.</p>

      {t.legs.map((leg, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: isMobile ? 14 : 18,
            marginTop: 14,
            background: "var(--bg-app)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ font: "600 13px/18px Heming", color: "var(--fg-primary)" }}>
              Tramo {i + 1}
            </div>
            {t.legs.length > 1 && (
              <button
                onClick={() => rmLeg(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--danger-fg)",
                  cursor: "pointer",
                  font: "500 13px/18px Heming",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icon name="trash" size={14} />
                Quitar
              </button>
            )}
          </div>
          <div style={grid}>
            <Field label="Tipo de servicio">
              <Select
                value={leg.type}
                onChange={(e) => {
                  const next = e.target.value as Leg["type"];
                  updateLeg(i, {
                    type: next,
                    flight: next === "disposicion" ? "" : leg.flight,
                    hours: next === "disposicion" ? (leg.hours ?? 1) : undefined,
                  });
                }}
              >
                <option value="in">Llegada (in)</option>
                <option value="out">Salida (out)</option>
                <option value="otro">Otro</option>
                <option value="disposicion">Hs disposición</option>
              </Select>
            </Field>
            {leg.type === "disposicion" ? (
              <Field label="Horas de disposición" hint="Entre 1 y 12 hs">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={leg.hours ?? 1}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10);
                    if (Number.isNaN(raw)) {
                      updateLeg(i, { hours: undefined });
                      return;
                    }
                    const clamped = Math.max(1, Math.min(12, raw));
                    updateLeg(i, { hours: clamped });
                  }}
                  placeholder="1-12"
                />
              </Field>
            ) : (
              <Field label="Vuelo" hint={leg.type === "otro" ? "No aplica" : "AA995, LA4302…"}>
                <Input
                  disabled={leg.type === "otro"}
                  value={leg.flight}
                  onChange={(e) => updateLeg(i, { flight: e.target.value })}
                  placeholder="—"
                />
              </Field>
            )}
            <Field
              label="Origen"
              required
              error={errs[`leg-${i}-origin`]}
              hint={i > 0 ? "Heredado del destino del tramo anterior" : undefined}
            >
              {i === 0 ? (
                <PlaceCombo
                  value={leg.origin}
                  onChange={(v) => updateLeg(i, { origin: v, originCoords: undefined })}
                  onPick={(desc, placeId) =>
                    geocodePlaceId(placeId, (coords) => {
                      if (coords) updateLeg(i, { origin: desc, originCoords: coords });
                    })
                  }
                />
              ) : (
                <Input value={leg.origin} disabled placeholder="—" />
              )}
            </Field>
            <Field
              label={i === 0 ? "Destino" : `Destino ${i + 1}`}
              required
              error={errs[`leg-${i}-destination`]}
            >
              <PlaceCombo
                value={leg.destination}
                onChange={(v) => updateLeg(i, { destination: v, destinationCoords: undefined })}
                onPick={(desc, placeId) =>
                  geocodePlaceId(placeId, (coords) => {
                    if (coords)
                      updateLeg(i, { destination: desc, destinationCoords: coords });
                  })
                }
              />
            </Field>
            {hasGoogleMapsKey() && (
              <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                <LegMap
                  leg={leg}
                  lockOrigin={i > 0}
                  onPickOrigin={(text, coords) =>
                    updateLeg(i, { origin: text, originCoords: coords })
                  }
                  onPickDestination={(text, coords) =>
                    updateLeg(i, { destination: text, destinationCoords: coords })
                  }
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <Button kind="ghost" icon="plus" onClick={addLeg} style={{ marginTop: 14 }}>
        Agregar tramo
      </Button>

      <div style={{ marginTop: 18 }}>
        <Field label="Observaciones">
          <Textarea
            value={t.obs}
            onChange={(e) => set({ obs: e.target.value })}
            placeholder="Ej. Cartel: Sr. Álvarez"
          />
        </Field>
      </div>
    </>
  );
}

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

function PlaceCombo({ value, onChange, onPick }: PlaceComboProps) {
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
    return PLACES.filter((p) => p.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((p) => ({ id: p, main: p, full: p }));
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
          preds.slice(0, 6).map((p: GMapsPlacePrediction) => ({
            id: p.place_id,
            placeId: p.place_id,
            main: p.structured_formatting?.main_text ?? p.description,
            secondary: p.structured_formatting?.secondary_text,
            full: p.description,
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
    <div style={{ position: "relative" }}>
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
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 5,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {loading && suggestions.length === 0 && (
            <div
              style={{
                padding: "8px 12px",
                font: "400 13px/18px Heming",
                color: "var(--fg-muted)",
              }}
            >
              Buscando…
            </div>
          )}
          {suggestions.map((s) => (
            <div
              key={s.id}
              onMouseDown={() => {
                onChange(s.full);
                if (s.placeId && onPick) onPick(s.full, s.placeId);
                setSuggestions([]);
                setOpen(false);
              }}
              style={{
                padding: "8px 12px",
                font: "400 13px/18px Heming",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--fg-secondary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="mappin" size={13} style={{ color: "var(--fg-muted)" }} />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    color: "var(--fg-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.main}
                </span>
                {s.secondary && (
                  <span
                    style={{
                      font: "400 11px/14px Heming",
                      color: "var(--fg-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.secondary}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

let geocoderInstance: GMapsGeocoder | null = null;
function getGeocoder(cb: (g: GMapsGeocoder | null) => void) {
  if (geocoderInstance) {
    cb(geocoderInstance);
    return;
  }
  loadGoogleMaps().then((maps) => {
    if (!maps) {
      cb(null);
      return;
    }
    geocoderInstance = new maps.Geocoder();
    cb(geocoderInstance);
  });
}

function geocodePlaceId(placeId: string, cb: (coords: GMapsLatLngLiteral | null) => void) {
  getGeocoder((g) => {
    if (!g) {
      cb(null);
      return;
    }
    g.geocode({ placeId }, (results) => {
      const loc = results?.[0]?.geometry?.location;
      cb(loc ? { lat: loc.lat(), lng: loc.lng() } : null);
    });
  });
}

function reverseGeocode(
  point: GMapsLatLngLiteral,
  cb: (address: string | null) => void,
) {
  getGeocoder((g) => {
    if (!g) {
      cb(null);
      return;
    }
    g.geocode({ location: point }, (results) => {
      cb(results?.[0]?.formatted_address ?? null);
    });
  });
}

function geocodeAddress(address: string, cb: (coords: GMapsLatLngLiteral | null) => void) {
  getGeocoder((g) => {
    if (!g) {
      cb(null);
      return;
    }
    g.geocode(
      { address, componentRestrictions: { country: "ar" }, region: "AR" },
      (results) => {
        const loc = results?.[0]?.geometry?.location;
        cb(loc ? { lat: loc.lat(), lng: loc.lng() } : null);
      },
    );
  });
}

interface LegMapProps {
  leg: Leg;
  onPickOrigin: (text: string, coords: GMapsLatLngLiteral) => void;
  onPickDestination: (text: string, coords: GMapsLatLngLiteral) => void;
  lockOrigin?: boolean;
}

function LegMap({ leg, onPickOrigin, onPickDestination, lockOrigin = false }: LegMapProps) {
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

function StepPasajeros({ t, set, errs, isMobile }: StepProps) {
  const grid: CSSProperties = isMobile ? grid1 : grid2;
  const updatePax = (i: number, patch: Partial<Passenger>) =>
    set({ passengers: t.passengers.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addPax = () => {
    if (t.passengers.length < 4)
      set({ passengers: [...t.passengers, { name: "", phone: "", dni: "", luggage: 0 }] });
  };
  const rmPax = (i: number) => set({ passengers: t.passengers.filter((_, j) => j !== i) });

  return (
    <>
      <h3 style={h2}>Pasajeros</h3>
      <p style={p}>Hasta 4 pasajeros nominales. Para grupos más grandes, adjuntá un Excel.</p>

      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 10 : 14,
          marginBottom: 14,
        }}
      >
        <Field label="Cantidad total" style={{ width: isMobile ? "100%" : 160 }}>
          <Input type="number" min={1} value={t.passengers.length} onChange={() => {}} disabled />
        </Field>
        <Button
          icon="excel"
          style={{
            alignSelf: isMobile ? "stretch" : "flex-end",
            justifyContent: isMobile ? "center" : undefined,
          }}
        >
          Adjuntar Excel de grupo
        </Button>
      </div>

      {t.passengers.map((px, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: isMobile ? 14 : 18,
            marginTop: 12,
            background: "var(--bg-app)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ font: "600 13px/18px Heming", color: "var(--fg-primary)" }}>
              Pasajero {i + 1}
            </div>
            {t.passengers.length > 1 && (
              <button
                onClick={() => rmPax(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--danger-fg)",
                  cursor: "pointer",
                  font: "500 13px/18px Heming",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icon name="trash" size={14} />
                Quitar
              </button>
            )}
          </div>
          <div style={grid}>
            <Field label="Nombre y apellido" required error={errs[`pax-${i}-name`]}>
              <Input value={px.name} onChange={(e) => updatePax(i, { name: e.target.value })} />
            </Field>
            <Field label="Teléfono" error={errs[`pax-${i}-phone`]}>
              <Input
                value={px.phone}
                onChange={(e) => updatePax(i, { phone: e.target.value })}
                placeholder="+54 11 …"
              />
            </Field>
            <Field label="DNI">
              <Input value={px.dni} onChange={(e) => updatePax(i, { dni: e.target.value })} />
            </Field>
            <Field label="Valijas">
              <Input
                type="number"
                min={0}
                value={px.luggage}
                onChange={(e) => updatePax(i, { luggage: +e.target.value })}
              />
            </Field>
          </div>
        </div>
      ))}

      <Button
        kind="ghost"
        icon="plus"
        disabled={t.passengers.length >= 4}
        onClick={addPax}
        style={{ marginTop: 14 }}
      >
        Agregar pasajero {t.passengers.length >= 4 && "(máx 4)"}
      </Button>
    </>
  );
}

function StepCostos({ t }: { t: Trip }) {
  const c = t.costs;
  const row = (k: keyof typeof c, l: string) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        font: "400 14px/20px Heming",
        color: "var(--fg-secondary)",
      }}
    >
      <span style={{ color: "var(--fg-muted)" }}>{l}</span>
      <span style={{ fontFeatureSettings: '"tnum" 1' }}>
        $ {c[k].toLocaleString("es-AR", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <h3 style={{ ...h2, margin: 0 }}>Costos</h3>
        <span
          style={{
            font: "500 11px/14px Heming",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            padding: "2px 8px",
            borderRadius: 9999,
          }}
        >
          Solo lectura · API Central
        </span>
      </div>
      <p style={p}>
        Los valores se sincronizan desde Central. Si encontrás una diferencia, contactá al
        administrador.
      </p>
      <div
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 8,
        }}
      >
        {row("viaje", "Viaje")}
        {row("espera", "Espera")}
        {row("peajes", "Peajes")}
        {row("estacionamiento", "Estacionamiento")}
        {row("otros", "Otros")}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "14px",
            background: "var(--bg-app)",
            font: "600 14px/20px Heming",
            color: "var(--fg-primary)",
          }}
        >
          <span>Total</span>
          <span style={{ fontFeatureSettings: '"tnum" 1' }}>
            $ {c.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </>
  );
}

function StepHistorial({ t }: { t: Trip }) {
  return (
    <>
      <h3 style={h2}>Historial</h3>
      <p style={p}>Auditoría de eventos del viaje. Solo lectura.</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={th}>Fecha y hora</th>
            <th style={th}>Usuario</th>
            <th style={th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {t.history.map((h, i) => (
            <tr key={i}>
              <td style={{ ...tdHist, fontFamily: "JetBrains Mono" }}>{h.ts}</td>
              <td style={tdHist}>{h.user}</td>
              <td style={tdHist}>{h.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function StepResumen({ t }: { t: Trip }) {
  const Item = ({ l, v }: { l: string; v: React.ReactNode }) => (
    <div
      style={{
        display: "flex",
        padding: "8px 0",
        borderBottom: "1px dashed var(--border-subtle)",
        gap: 18,
      }}
    >
      <span
        style={{
          font: "500 12px/16px Heming",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          width: 160,
          flex: "none",
        }}
      >
        {l}
      </span>
      <span style={{ font: "400 14px/20px Heming", color: "var(--fg-secondary)" }}>{v}</span>
    </div>
  );
  return (
    <>
      <h3 style={h2}>Resumen del viaje</h3>
      <div style={{ marginTop: 8 }}>
        <Item l="Reserva" v={<span style={{ fontFamily: "JetBrains Mono" }}>{t.id}</span>} />
        <Item l="Solicitante" v={t.solicitante || "—"} />
        <Item l="Fecha y hora" v={`${t.date} · ${t.time || "—"}`} />
        <Item l="Categoría" v={t.cat} />
        <Item
          l="Tramos"
          v={
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {t.legs.map((l, i) => (
                <span key={i}>
                  {l.origin || "—"} → {l.destination || "—"}{" "}
                  {l.type === "disposicion" && l.hours ? (
                    <span
                      style={{
                        color: "var(--fg-muted)",
                        fontFamily: "JetBrains Mono",
                        fontSize: 12,
                      }}
                    >
                      · {l.hours} hs disposición
                    </span>
                  ) : (
                    l.flight && (
                      <span
                        style={{
                          color: "var(--fg-muted)",
                          fontFamily: "JetBrains Mono",
                          fontSize: 12,
                        }}
                      >
                        · {l.flight}
                      </span>
                    )
                  )}
                </span>
              ))}
            </div>
          }
        />
        <Item
          l="Pasajeros"
          v={
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {t.passengers.map((p, i) => (
                <span key={i}>
                  {p.name || "—"}
                  {p.phone && ` · ${p.phone}`}
                  {p.luggage > 0 && ` · ${p.luggage} valija(s)`}
                </span>
              ))}
            </div>
          }
        />
      </div>
    </>
  );
}

const h2: CSSProperties = {
  font: "600 17px/24px Heming",
  margin: "0 0 4px",
  color: "var(--fg-primary)",
};
const p: CSSProperties = {
  font: "400 13px/18px Heming",
  color: "var(--fg-muted)",
  margin: "0 0 14px",
};
const grid2: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" };
const grid1: CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: "14px" };
const th: CSSProperties = {
  font: "600 11px/14px Heming",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--fg-muted)",
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: "1px solid var(--border-subtle)",
};
const tdHist: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid var(--border-subtle)",
  font: "400 13px/18px Heming",
  color: "var(--fg-secondary)",
};
