import { Fragment, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field, Textarea } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Modal } from "../../components/ui/Modal";
import { StatusPicker } from "../../components/ui/StatusPicker";
import { CODIGO_ESTADO } from "../../api/viajes";
import { useEstados } from "../../hooks/useEstados";
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
  onCancelTrip?: (t: Trip) => void | Promise<unknown>;
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
  const { idPorCodigo } = useEstados();
  const stepsBase: StepDef[] = [
    { id: "viaje", label: "Viaje" },
    { id: "pasajeros", label: "Pasajeros" },
    { id: "tramos", label: "Destinos" },
    { id: "tarifa", label: "Cotización" },
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
  // Qué guardado está en vuelo. Bloquea TODOS los botones de guardar mientras la
  // request no vuelve (para que un doble click no cree el viaje duplicado), pero
  // el spinner lo muestra sólo el botón que se tocó.
  const [saving, setSaving] = useState<null | "save" | "saveAndNew" | "step">(null);
  const isSaving = saving !== null;
  // Error del último guardado. Queda fijo en pantalla hasta el próximo intento:
  // el toast dura 2,4s y el detalle del backend suele ser lo único accionable.
  const [saveError, setSaveError] = useState("");
  // Cancelación: mismo trato que el guardado, pero el error se muestra dentro
  // del modal, que se queda abierto para reintentar.
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const mensajeError = (err: unknown) =>
    err instanceof Error && err.message ? err.message : "Error desconocido";

  const resetForm = () => {
    setT(EMPTY_TRIP);
    setStepIdx(0);
    setErrs({});
    setDirty(false);
    setSaveError("");
  };

  // Guarda y bloquea hasta que la request termina. Si falla, se muestra el error
  // que devolvió el servidor y el botón se re-habilita para reintentar; si tiene
  // éxito, el padre navega a /viajes y desmonta el wizard.
  const handleSave = async (tripToSave: Trip) => {
    if (isSaving) return;
    setSaving("save");
    setSaveError("");
    try {
      await onSave(tripToSave);
    } catch (err) {
      setSaveError(mensajeError(err));
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAndNew = async () => {
    if (!onSaveAndNew || isSaving) return;
    setSaving("saveAndNew");
    setSaveError("");
    try {
      await onSaveAndNew(t);
      resetForm();
    } catch (err) {
      setSaveError(mensajeError(err));
    } finally {
      setSaving(null);
    }
  };

  // Cancela y bloquea hasta que la request termina. Si el backend la rechaza el
  // modal queda abierto con el motivo; si sale bien, el padre navega a /viajes.
  const handleCancelTrip = async () => {
    if (!onCancelTrip || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      // El estado lo resuelve la API (api/viajes cancelTrip): acá solo va el
      // motivo, que se anexa a las observaciones.
      await onCancelTrip({
        ...t,
        obs: t.obs + (t.obs ? " · " : "") + "Cancelado: " + cancelReason,
      });
      setShowCancel(false);
    } catch (err) {
      setCancelError(mensajeError(err));
    } finally {
      setCancelling(false);
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
    const e = validateTripStep(step.id, t, { requireCoords: hasGoogleMapsKey(), mode });
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  // Estados a los que el wizard ata acciones. Salen del catálogo del backend: si
  // alguno no está cargado, la acción se deshabilita en vez de mandar otro.
  // "Cancelado" (CAN) hoy NO existe en /estados/ — ver docs/pendientes.md.
  const canceladoId = idPorCodigo(CODIGO_ESTADO.CANCELADO);
  const modificadoId = idPorCodigo(CODIGO_ESTADO.MODIFICADO);
  const esCancelado = canceladoId != null && t.est === canceladoId;
  // Sin estado "Cancelado" en el backend no hay a dónde mandar el viaje, así que
  // el botón no se ofrece: antes mandaba un id fijo que allá es "En Progreso".
  const puedeCancelar = canceladoId != null;
  // Al guardar una edición el viaje pasa a "Modificado", salvo que ya esté
  // cancelado (ahí no se lo revive).
  const marcarModificado = (trip: Trip): Trip =>
    esCancelado || modificadoId == null ? trip : { ...trip, est: modificadoId };

  const advance = () => setStepIdx((i) => Math.min(i + 1, stepsBase.length - 1));

  const next = async () => {
    if (!validateStep()) return;
    // En modo edición persistimos los cambios al avanzar de pantalla, así no se
    // pierde nada si el usuario abandona antes de llegar al final. Si el guardado
    // falla no avanzamos para que el usuario lo reintente.
    if (mode === "edit" && onStepSave && dirty && !isSaving) {
      const tripToSave: Trip = marcarModificado(t);
      setSaving("step");
      setSaveError("");
      try {
        await onStepSave(tripToSave);
        setT(tripToSave);
        setDirty(false);
      } catch (err) {
        setSaveError(mensajeError(err));
        return;
      } finally {
        setSaving(null);
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
              {mode === "edit" && !esCancelado && puedeCancelar && onCancelTrip && (
                <button
                  onClick={() => {
                    setCancelError("");
                    setShowCancel(true);
                  }}
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
            {mode === "edit" && !esCancelado && puedeCancelar && (
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
          {step.id === "viaje" && <StepViaje t={t} set={set} errs={errs} mode={mode} />}
          {step.id === "pasajeros" && <StepPasajeros t={t} set={set} errs={errs} />}
          {step.id === "tramos" && <StepTramos t={t} set={set} errs={errs} />}
          {step.id === "tarifa" && <StepTarifa t={t} set={set} errs={errs} />}
          {step.id === "costos" && <StepCostos t={t} set={set} />}
          {step.id === "resumen" && <StepResumen t={t} />}
          {step.id === "historial" && <StepHistorial t={t} />}
        </div>
      </div>

      {saveError && (
        <div className={cx(styles.errorBox, styles.saveError)} role="alert">
          <Icon name="alert" size={14} />
          <span>No se pudo guardar el viaje: {saveError}</span>
        </div>
      )}

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
                  disabled={isSaving}
                  loading={saving === "saveAndNew"}
                  onClick={handleSaveAndNew}
                >
                  {isMobile ? "Crear otro" : "Guardar y crear otro"}
                </Button>
              )}
              <Button
                kind="primary"
                icon="check"
                size={isMobile ? "sm" : "md"}
                disabled={isSaving}
                loading={saving === "save"}
                onClick={() =>
                  mode === "edit"
                    ? dirty
                      ? setShowSaveConfirm(true)
                      : handleSave(t)
                    : handleSave(t)
                }
              >
                {saving === "save"
                  ? "Guardando…"
                  : mode === "edit"
                    ? "Guardar"
                    : "Guardar viaje"}
              </Button>
            </>
          ) : stepIdx < stepsBase.length - 1 ? (
            <Button
              kind="primary"
              size={isMobile ? "sm" : "md"}
              disabled={isSaving}
              loading={saving === "step"}
              onClick={next}
            >
              {saving === "step" ? "Guardando…" : "Siguiente"}
              {saving !== "step" && <Icon name="chevright" size={isMobile ? 12 : 14} />}
            </Button>
          ) : null}
        </div>
      </div>

      {showCancel && onCancelTrip && (
        <Modal
          open
          onClose={() => {
            if (!cancelling) setShowCancel(false);
          }}
          title="Cancelar viaje"
          width={460}
          footer={
            <>
              <Button disabled={cancelling} onClick={() => setShowCancel(false)}>
                Volver
              </Button>
              <Button
                kind="dangerSolid"
                disabled={!cancelReason.trim()}
                loading={cancelling}
                onClick={handleCancelTrip}
              >
                {cancelling ? "Cancelando…" : "Confirmar cancelación"}
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
          {cancelError && (
            <div className={cx(styles.errorBox, styles.cancelError)} role="alert">
              <Icon name="alert" size={14} />
              <span>No se pudo cancelar el viaje: {cancelError}</span>
            </div>
          )}
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
                disabled={isSaving}
                onClick={() => {
                  setShowSaveConfirm(false);
                  handleSave(marcarModificado(t));
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
