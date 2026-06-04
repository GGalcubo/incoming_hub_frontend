import { Button } from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import type { Passenger } from "../../../types/domain";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

export function StepPasajeros({ t, set, errs }: StepProps) {
  const updatePax = (i: number, patch: Partial<Passenger>) =>
    set({ passengers: t.passengers.map((px, j) => (j === i ? { ...px, ...patch } : px)) });
  const addPax = () => {
    if (t.passengers.length < 4)
      set({ passengers: [...t.passengers, { firstName: "", lastName: "", phone: "" }] });
  };
  const rmPax = (i: number) => set({ passengers: t.passengers.filter((_, j) => j !== i) });

  return (
    <>
      <h3 className={styles.h2}>Pasajeros</h3>
      <p className={styles.p}>
        Hasta 4 pasajeros nominales. Para grupos más grandes, adjuntá un Excel.
      </p>

      <div className={styles.paxControls}>
        <Field label="Cantidad total" className={styles.qtyField}>
          <Input type="number" min={1} value={t.passengers.length} onChange={() => {}} disabled />
        </Field>
        <Button icon="excel" className={styles.attachBtn}>
          Adjuntar Excel de grupo
        </Button>
      </div>

      {t.passengers.map((px, i) => (
        <div key={i} className={styles.itemCard}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.itemCardTitle}>Pasajero {i + 1}</div>
            {t.passengers.length > 1 && (
              <button onClick={() => rmPax(i)} className={styles.removeBtn}>
                <Icon name="trash" size={14} />
                Quitar
              </button>
            )}
          </div>
          <div className={styles.formGrid}>
            <Field label="Nombre" required error={errs[`pax-${i}-firstName`]}>
              <Input
                value={px.firstName}
                onChange={(e) => updatePax(i, { firstName: e.target.value })}
              />
            </Field>
            <Field label="Apellido" required error={errs[`pax-${i}-lastName`]}>
              <Input
                value={px.lastName}
                onChange={(e) => updatePax(i, { lastName: e.target.value })}
              />
            </Field>
            <Field label="Teléfono" error={errs[`pax-${i}-phone`]} span={2}>
              <Input
                value={px.phone}
                onChange={(e) => updatePax(i, { phone: e.target.value })}
                placeholder="+54 11 …"
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
        className={styles.addBtn}
      >
        Agregar pasajero {t.passengers.length >= 4 && "(máx 4)"}
      </Button>
    </>
  );
}
