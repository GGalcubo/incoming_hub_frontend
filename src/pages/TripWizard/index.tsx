import { Fragment, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field, Textarea } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { StatusPicker } from "../../components/ui/StatusPicker";
import { useIsMobile } from "../../hooks/useIsMobile";
import { cx } from "../../lib/cx";
import { hasGoogleMapsKey } from "../../lib/gmaps";
import type { Trip } from "../../types/domain";
import { StepCostos } from "./steps/StepCostos";
import { StepHistorial } from "./steps/StepHistorial";
import { StepPasajeros } from "./steps/StepPasajeros";
import { StepResumen } from "./steps/StepResumen";
import { StepTarifa } from "./steps/StepTarifa";
import { StepTramos } from "./steps/StepTramos";
import { StepViaje } from "./steps/StepViaje";
import { EMPTY_TRIP, type Mode, type StepDef } from "./types";
import { validateTripStep } from "./validation";
import styles from "./TripWizard.module.css";

interface TripWizardProps {
  mode: Mode;
  trip?: Trip;
  onSave: (t: Trip) => void | Promise<unknown>;
  onSaveAndNew?: (t: Trip) => Promise<unknown>;
  // Guarda los cambios sin navegar fuera del wizard. Se usa para persistir al
  // avanzar de pantalla con "Siguiente" en modo edición.
  onStepSave?: (t: Trip) => Promise<unknown>;
  onCancel: () => void;
  onCancelTrip?: (t: Trip) => void;
}

export function TripWizard({
  mode,
  trip,
  onSave,
  onSaveAndNew,
  onStepSave,
  onCancel,
  onCancelTrip,
}: TripWizardProps) {
  const isMobile = useIsMobile();
  const stepsBase: StepDef[] = [
    { id: "viaje", label: "Viaje" },
    { id: "pasajeros", label: "Pasajeros" },
    { id: "tramos", label: "Destinos" },
    { id: "tarifa", label: "Tarifa" },
    ...(mode === "edit" ? [{ id: "costos" as const, label: "Costos" }] : []),
    { id: "resumen", label: "Resumen" },
    ...(mode === "edit" ? [{ id: "historial" as const, label: "Historial" }] : []),
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const [t, setT] = useState<Trip>(() => trip ?? EMPTY_TRIP);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Único flag de "guardando": bloquea TODOS los botones de guardar mientras la
  // request está en vuelo, para que un doble click no cree el viaje duplicado.
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setT(EMPTY_TRIP);
    setStepIdx(0);
    setErrs({});
    setDirty(false);
  };

  // Guarda y bloquea hasta que la request termina. Si falla, el botón se
  // re-habilita; si tiene éxito, el padre navega a /viajes y desmonta el wizard.
  const handleSave = async (tripToSave: Trip) => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(tripToSave);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNew = async () => {
    if (!onSaveAndNew || saving) return;
    setSaving(true);
    try {
      await onSaveAndNew(t);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const step = stepsBase[stepIdx];
  const set = (patch: Partial<Trip>) => {
    setDirty(true);
    setT((prev) => ({ ...prev, ...patch }));
  };
  const wide =
    step.id === "resumen" ||
    step.id === "historial" ||
    step.id === "tramos" ||
    step.id === "tarifa";

  const validateStep = () => {
    // Con Google Maps disponible exigimos que cada destino esté geocodificado:
    // el backend crea los tramos solo con coordenadas (ver buildTramosInput).
    const e = validateTripStep(step.id, t, { requireCoords: hasGoogleMapsKey() });
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const advance = () => setStepIdx((i) => Math.min(i + 1, stepsBase.length - 1));

  const next = async () => {
    if (!validateStep()) return;
    // En modo edición persistimos los cambios al avanzar de pantalla, así no se
    // pierde nada si el usuario abandona antes de llegar al final. Si el guardado
    // falla no avanzamos para que el usuario lo reintente.
    if (mode === "edit" && onStepSave && dirty && !saving) {
      const tripToSave: Trip = t.est === "CANCELADO" ? t : { ...t, est: "MODIFICADO" };
      setSaving(true);
      try {
        await onStepSave(tripToSave);
        setT(tripToSave);
        setDirty(false);
      } catch {
        return;
      } finally {
        setSaving(false);
      }
    }
    advance();
  };
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  return (
    <div className={styles.wizard}>
      <div className={styles.head}>
        {isMobile ? (
          <>
            <div className={styles.mTopRow}>
              <div className={styles.mLabelGroup}>
                <span className={styles.mCounter}>
                  Paso {stepIdx + 1} de {stepsBase.length}
                </span>
                <span className={styles.mStepName}>· {step.label}</span>
              </div>
              {mode === "edit" && t.est !== "CANCELADO" && onCancelTrip && (
                <button
                  onClick={() => setShowCancel(true)}
                  title="Cancelar viaje"
                  className={styles.mCancelBtn}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
            <div className={styles.mDots}>
              {stepsBase.map((s, i) => {
                const done = i < stepIdx;
                const active = i === stepIdx;
                const reachable = mode === "edit" || i <= stepIdx;
                return (
                  <Fragment key={s.id}>
                    <button
                      onClick={() => {
                        if (reachable) setStepIdx(i);
                      }}
                      title={s.label}
                      className={cx(
                        styles.circle,
                        done && styles.circleDone,
                        active && styles.circleActive,
                        reachable && styles.clickable,
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </button>
                    {i < stepsBase.length - 1 && <span className={styles.mConnector} />}
                  </Fragment>
                );
              })}
              {mode === "edit" && (
                <span className={styles.mBadge}>
                  <StatusPicker value={t.est} onChange={(est) => set({ est })} align="right" />
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            {stepsBase.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              const reachable = mode === "edit" || i <= stepIdx;
              return (
                <Fragment key={s.id}>
                  <button
                    onClick={() => {
                      if (reachable) setStepIdx(i);
                    }}
                    className={cx(
                      styles.dStepBtn,
                      done && styles.dStepDone,
                      active && styles.dStepActive,
                      reachable && styles.clickable,
                    )}
                  >
                    <span
                      className={cx(
                        styles.circle,
                        done && styles.circleDone,
                        active && styles.circleActive,
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {s.label}
                  </button>
                  {i < stepsBase.length - 1 && <span className={styles.dConnector} />}
                </Fragment>
              );
            })}

            <div className={styles.spacer} />
            {mode === "edit" && t.est !== "CANCELADO" && (
              <Button kind="danger" icon="x" onClick={() => setShowCancel(true)}>
                Cancelar viaje
              </Button>
            )}
            {mode === "edit" && (
              <div className={styles.estadoWrap}>
                <span className={styles.estadoLabel}>Estado</span>
                <StatusPicker
                  value={t.est}
                  onChange={(est) => set({ est })}
                  align="right"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.content}>
        <div className={cx(styles.card, wide && styles.cardWide)}>
          {step.id === "viaje" && <StepViaje t={t} set={set} errs={errs} />}
          {step.id === "pasajeros" && <StepPasajeros t={t} set={set} errs={errs} />}
          {step.id === "tramos" && <StepTramos t={t} set={set} errs={errs} />}
          {step.id === "tarifa" && <StepTarifa t={t} set={set} errs={errs} />}
          {step.id === "costos" && <StepCostos t={t} set={set} />}
          {step.id === "resumen" && <StepResumen t={t} />}
          {step.id === "historial" && <StepHistorial t={t} />}
        </div>
      </div>

      <div className={styles.footer}>
        <Button kind="ghost" size={isMobile ? "sm" : "md"} onClick={onCancel}>
          {mode === "edit" ? "Volver" : "Descartar"}
        </Button>
        <div className={styles.footerRight}>
          {stepIdx > 0 && (
            <Button icon="chevleft" size={isMobile ? "sm" : "md"} onClick={back}>
              {isMobile ? "" : "Anterior"}
            </Button>
          )}
          {stepIdx === stepsBase.length - 1 ? (
            <>
              {mode === "new" && onSaveAndNew && (
                <Button
                  icon="plus"
                  size={isMobile ? "sm" : "md"}
                  disabled={saving}
                  onClick={handleSaveAndNew}
                >
                  {isMobile ? "Crear otro" : "Guardar y crear otro"}
                </Button>
              )}
              <Button
                kind="primary"
                icon="check"
                size={isMobile ? "sm" : "md"}
                disabled={saving}
                onClick={() =>
                  mode === "edit"
                    ? dirty
                      ? setShowSaveConfirm(true)
                      : handleSave(t)
                    : handleSave(t)
                }
              >
                {mode === "edit" ? "Guardar" : "Guardar viaje"}
              </Button>
            </>
          ) : stepIdx < stepsBase.length - 1 ? (
            <Button
              kind="primary"
              size={isMobile ? "sm" : "md"}
              disabled={saving}
              onClick={next}
            >
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
          <div className={styles.cancelText}>
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

      {showSaveConfirm && (
        <Modal
          open
          onClose={() => setShowSaveConfirm(false)}
          title="Modificar viaje"
          width={460}
          footer={
            <>
              <Button onClick={() => setShowSaveConfirm(false)}>Volver</Button>
              <Button
                kind="primary"
                icon="check"
                disabled={saving}
                onClick={() => {
                  setShowSaveConfirm(false);
                  handleSave(t.est === "CANCELADO" ? t : { ...t, est: "MODIFICADO" });
                }}
              >
                Sí, continuar
              </Button>
            </>
          }
        >
          <div className={styles.cancelText}>
            Estás modificando un viaje que ya está creado. ¿Estás seguro que deseás continuar?
          </div>
        </Modal>
      )}
    </div>
  );
}
