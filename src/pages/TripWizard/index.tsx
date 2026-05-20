import { Fragment, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Textarea } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { Trip } from "../../types/domain";
import { StepCostos } from "./steps/StepCostos";
import { StepHistorial } from "./steps/StepHistorial";
import { StepResumen } from "./steps/StepResumen";
import { StepTramos } from "./steps/StepTramos";
import { StepViaje } from "./steps/StepViaje";
import { EMPTY_TRIP, type Mode, type StepDef } from "./types";
import { validateTripStep } from "./validation";

interface TripWizardProps {
  mode: Mode;
  trip?: Trip;
  onSave: (t: Trip) => void;
  onCancel: () => void;
  onCancelTrip?: (t: Trip) => void;
}

export function TripWizard({ mode, trip, onSave, onCancel, onCancelTrip }: TripWizardProps) {
  const isMobile = useIsMobile();
  const stepsBase: StepDef[] = [
    { id: "viaje", label: "Viaje" },
    { id: "tramos", label: "Destinos" },
    { id: "costos", label: "Costos" },
    { id: "resumen", label: "Resumen" },
    ...(mode === "edit" ? [{ id: "historial" as const, label: "Historial" }] : []),
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
    const e = validateTripStep(step.id, t);
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

      <div style={{ flex: 1, overflow: "auto", padding: contentPad, background: "var(--bg-app)" }}>
        <div
          style={{
            maxWidth: step.id === "resumen" || step.id === "historial" ? 880 : 720,
            margin: "0 auto",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: cardPad,
          }}
        >
          {step.id === "viaje" && <StepViaje t={t} set={set} errs={errs} isMobile={isMobile} />}
          {step.id === "tramos" && <StepTramos t={t} set={set} errs={errs} isMobile={isMobile} />}
          {step.id === "costos" && <StepCostos t={t} />}
          {step.id === "resumen" && <StepResumen t={t} />}
          {step.id === "historial" && <StepHistorial t={t} />}
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
          {stepIdx === stepsBase.length - 1 ? (
            <Button
              kind="primary"
              icon="check"
              size={isMobile ? "sm" : "md"}
              onClick={() => onSave(t)}
            >
              {mode === "edit" ? "Guardar" : "Guardar viaje"}
            </Button>
          ) : stepIdx < stepsBase.length - 1 ? (
            <Button kind="primary" size={isMobile ? "sm" : "md"} onClick={next}>
              Siguiente <Icon name="chevright" size={isMobile ? 12 : 14} />
            </Button>
          ) : null}
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
