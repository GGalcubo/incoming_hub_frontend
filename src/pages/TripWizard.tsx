import { Fragment, useState } from "react";
import type { CSSProperties } from "react";
import { AGENCIES, CATEGORIES, PLACES, TODAY } from "../data/seed";
import type { Leg, Passenger, Trip } from "../types/domain";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { useIsMobile } from "../hooks/useIsMobile";

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
  cat: "Ejecutivo",
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
      if (!t.agc) e.agc = "La agencia es obligatoria";
      if (!t.solicitante) e.solicitante = "Ingresá el solicitante";
      if (!t.date) e.date = "La fecha es obligatoria";
      if (!t.time) e.time = "La hora es obligatoria";
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
        background: "#0A0E14",
      }}
    >
      <div
        style={{
          background: "#0A0E14",
          borderBottom: "1px solid #1F2733",
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
                    font: "600 11px/14px Inter",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "#8B95A7",
                  }}
                >
                  Paso {stepIdx + 1} de {stepsBase.length}
                </span>
                <span style={{ font: "600 14px/20px Inter", color: "#F5F7FB" }}>
                  · {step.label}
                </span>
              </div>
              {mode === "edit" && t.est !== "CANCELADO" && onCancelTrip && (
                <button
                  onClick={() => setShowCancel(true)}
                  title="Cancelar viaje"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(232,68,68,.30)",
                    color: "#FF7A7A",
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
                          ? "#1FB874"
                          : done
                            ? "rgba(31,184,116,.16)"
                            : "#1A2029",
                        color: active ? "#0A0E14" : done ? "#4FD79A" : "#B5BCC9",
                        font: "600 12px/14px Inter",
                        border: "none",
                        cursor: i <= stepIdx ? "pointer" : "default",
                        flex: "none",
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </button>
                    {i < stepsBase.length - 1 && (
                      <span style={{ flex: 1, height: 1, background: "#2A323F" }} />
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
                      background: active ? "rgba(31,184,116,.10)" : "transparent",
                      color: active ? "#F5F7FB" : done ? "#4FD79A" : "#8B95A7",
                      font: active ? "600 13px/18px Inter" : "500 13px/18px Inter",
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
                          ? "#1FB874"
                          : done
                            ? "rgba(31,184,116,.16)"
                            : "#1A2029",
                        color: active ? "#0A0E14" : done ? "#4FD79A" : "#B5BCC9",
                        font: "600 12px/14px Inter",
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {s.label}
                  </button>
                  {i < stepsBase.length - 1 && (
                    <span style={{ width: 18, height: 1, background: "#2A323F" }} />
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
                <span style={{ font: "500 12px/16px Inter", color: "#8B95A7" }}>Estado</span>
                <Badge status={t.est} />
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: contentPad, background: "#0A0E14" }}>
        <div
          style={{
            maxWidth: step.id === "resumen" ? 880 : 720,
            margin: "0 auto",
            background: "#11161E",
            border: "1px solid #1F2733",
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
          borderTop: "1px solid #1F2733",
          background: "#0A0E14",
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
            <>
              {!isMobile && <Button icon="pdf">Exportar PDF</Button>}
              {!isMobile && <Button icon="excel">Exportar Excel</Button>}
              <Button
                kind="primary"
                icon="check"
                size={isMobile ? "sm" : "md"}
                onClick={() => onSave(t)}
              >
                {mode === "edit" ? "Guardar" : "Guardar viaje"}
              </Button>
            </>
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
          <div style={{ font: "400 13px/18px Inter", color: "#B5BCC9", marginBottom: 14 }}>
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
        <Field label="Agencia" required error={errs.agc}>
          <Select value={t.agc} onChange={(e) => set({ agc: e.target.value })}>
            <option value="">Seleccioná una agencia</option>
            {AGENCIES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Solicitante" required error={errs.solicitante}>
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
        <Field label="Categoría de servicio" span={isMobile ? 1 : 2}>
          <Select value={t.cat} onChange={(e) => set({ cat: e.target.value })}>
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
  const updateLeg = (i: number, patch: Partial<Leg>) =>
    set({ legs: t.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const addLeg = () =>
    set({ legs: [...t.legs, { type: "in", origin: "", destination: "", flight: "", obs: "" }] });
  const rmLeg = (i: number) => set({ legs: t.legs.filter((_, j) => j !== i) });

  return (
    <>
      <h3 style={h2}>Tramos del viaje</h3>
      <p style={p}>Agregá uno o más tramos. Para tramos in/out se pide número de vuelo.</p>

      {t.legs.map((leg, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #1F2733",
            borderRadius: 12,
            padding: isMobile ? 14 : 18,
            marginTop: 14,
            background: "#0A0E14",
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
            <div style={{ font: "600 13px/18px Inter", color: "#F5F7FB" }}>Tramo {i + 1}</div>
            {t.legs.length > 1 && (
              <button
                onClick={() => rmLeg(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FF7A7A",
                  cursor: "pointer",
                  font: "500 13px/18px Inter",
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
                onChange={(e) => updateLeg(i, { type: e.target.value as Leg["type"] })}
              >
                <option value="in">Llegada (in)</option>
                <option value="out">Salida (out)</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Vuelo" hint={leg.type === "otro" ? "No aplica" : "AA995, LA4302…"}>
              <Input
                disabled={leg.type === "otro"}
                value={leg.flight}
                onChange={(e) => updateLeg(i, { flight: e.target.value })}
                placeholder="—"
              />
            </Field>
            <Field label="Origen" required error={errs[`leg-${i}-origin`]}>
              <PlaceCombo
                value={leg.origin}
                onChange={(v) => updateLeg(i, { origin: v })}
              />
            </Field>
            <Field label="Destino" required error={errs[`leg-${i}-destination`]}>
              <PlaceCombo
                value={leg.destination}
                onChange={(v) => updateLeg(i, { destination: v })}
              />
            </Field>
            <Field label="Observaciones del tramo" span={isMobile ? 1 : 2}>
              <Textarea
                value={leg.obs}
                onChange={(e) => updateLeg(i, { obs: e.target.value })}
                placeholder="Ej. Cartel: Sr. Álvarez"
              />
            </Field>
          </div>
        </div>
      ))}

      <Button kind="ghost" icon="plus" onClick={addLeg} style={{ marginTop: 14 }}>
        Agregar tramo
      </Button>
    </>
  );
}

function PlaceCombo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const matches = PLACES.filter((p) => p.toLowerCase().includes((value || "").toLowerCase()));
  return (
    <div style={{ position: "relative" }}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Buscar lugar (Google Maps)…"
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 5,
            background: "#11161E",
            border: "1px solid #1F2733",
            borderRadius: 8,
            boxShadow: "0 6px 16px rgba(0,0,0,.45)",
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {matches.slice(0, 6).map((m) => (
            <div
              key={m}
              onMouseDown={() => {
                onChange(m);
                setOpen(false);
              }}
              style={{
                padding: "8px 12px",
                font: "400 13px/18px Inter",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#E7EBF2",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1A2029")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="mappin" size={13} style={{ color: "#8B95A7" }} />
              {m}
            </div>
          ))}
        </div>
      )}
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
            border: "1px solid #1F2733",
            borderRadius: 12,
            padding: isMobile ? 14 : 18,
            marginTop: 12,
            background: "#0A0E14",
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
            <div style={{ font: "600 13px/18px Inter", color: "#F5F7FB" }}>
              Pasajero {i + 1}
            </div>
            {t.passengers.length > 1 && (
              <button
                onClick={() => rmPax(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FF7A7A",
                  cursor: "pointer",
                  font: "500 13px/18px Inter",
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
        borderBottom: "1px solid #1F2733",
        font: "400 14px/20px Inter",
        color: "#E7EBF2",
      }}
    >
      <span style={{ color: "#8B95A7" }}>{l}</span>
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
            font: "500 11px/14px Inter",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "#8B95A7",
            background: "#1A2029",
            border: "1px solid #1F2733",
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
        style={{ border: "1px solid #1F2733", borderRadius: 12, overflow: "hidden", marginTop: 8 }}
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
            background: "#0A0E14",
            font: "600 14px/20px Inter",
            color: "#F5F7FB",
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
        borderBottom: "1px dashed #1F2733",
        gap: 18,
      }}
    >
      <span
        style={{
          font: "500 12px/16px Inter",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "#8B95A7",
          width: 160,
          flex: "none",
        }}
      >
        {l}
      </span>
      <span style={{ font: "400 14px/20px Inter", color: "#E7EBF2" }}>{v}</span>
    </div>
  );
  return (
    <>
      <h3 style={h2}>Resumen del viaje</h3>
      <div style={{ marginTop: 8 }}>
        <Item l="Reserva" v={<span style={{ fontFamily: "JetBrains Mono" }}>{t.id}</span>} />
        <Item l="Agencia" v={t.agc || "—"} />
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
                  {l.flight && (
                    <span
                      style={{
                        color: "#8B95A7",
                        fontFamily: "JetBrains Mono",
                        fontSize: 12,
                      }}
                    >
                      · {l.flight}
                    </span>
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

const h2: CSSProperties = { font: "600 17px/24px Inter", margin: "0 0 4px", color: "#F5F7FB" };
const p: CSSProperties = { font: "400 13px/18px Inter", color: "#8B95A7", margin: "0 0 14px" };
const grid2: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" };
const grid1: CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: "14px" };
const th: CSSProperties = {
  font: "600 11px/14px Inter",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "#8B95A7",
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: "1px solid #1F2733",
};
const tdHist: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid #161B23",
  font: "400 13px/18px Inter",
  color: "#E7EBF2",
};
