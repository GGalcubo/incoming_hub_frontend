import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Field, Input, Select } from "../../../components/ui/Field";
import { CATEGORIES } from "../../../data/seed";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

export function StepViaje({ t, set, errs }: StepProps) {
  const [categories, setCategories] = useState<string[]>(CATEGORIES);

  useEffect(() => {
    let active = true;
    api
      .listCategorias()
      .then((cats) => {
        if (active && cats.length) setCategories(cats);
      })
      .catch(() => {
        /* sin backend: se mantiene el catálogo por defecto */
      });
    return () => {
      active = false;
    };
  }, []);

  // Si el viaje en edición trae una categoría que no está en el catálogo, la
  // incluimos para que el valor seleccionado no se pierda.
  const options =
    t.cat && !categories.includes(t.cat) ? [t.cat, ...categories] : categories;

  return (
    <>
      <h3 className={styles.h2}>Datos principales</h3>
      <div className={styles.formGrid}>
        <Field label="Solicitante" required error={errs.solicitante} span={2}>
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
        <Field label="Categoría de servicio" required error={errs.cat} span={2}>
          <Select value={t.cat} onChange={(e) => set({ cat: e.target.value })}>
            <option value="">—</option>
            {options.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
}
