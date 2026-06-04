import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Field, Input, Select } from "../../../components/ui/Field";
import { AGENCIES, CATEGORIES } from "../../../data/seed";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

export function StepViaje({ t, set, errs }: StepProps) {
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [agencies, setAgencies] = useState<string[]>(AGENCIES);
  // El solicitante es siempre el usuario logueado; admin puede cambiar de agencia.
  const [solicitante, setSolicitante] = useState<string>(t.solicitante ?? "");
  const [isAdmin, setIsAdmin] = useState(false);

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

  useEffect(() => {
    let active = true;
    api
      .getWizardIdentity()
      .then((id) => {
        if (!active) return;
        if (id.agencies.length) setAgencies(id.agencies);
        setSolicitante(id.solicitante);
        setIsAdmin(id.isAdmin);
        // El solicitante siempre es el usuario logueado.
        const patch: Partial<typeof t> = { solicitante: id.solicitante };
        // Agencia por defecto: la propia del usuario. Los no-admin quedan fijos
        // a su agencia; el admin puede cambiarla luego (sólo fijamos si está vacía).
        if (id.ownAgency && (!t.agc || !id.isAdmin)) patch.agc = id.ownAgency;
        else if (!t.agc && id.agencies.length) patch.agc = id.agencies[0];
        set(patch);
      })
      .catch(() => {
        /* sin backend / sin sesión: se mantienen los valores por defecto */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el viaje en edición trae valores que no están en el catálogo, los
  // incluimos para que la selección no se pierda.
  const catOptions =
    t.cat && !categories.includes(t.cat) ? [t.cat, ...categories] : categories;
  const agcOptions =
    t.agc && !agencies.includes(t.agc) ? [t.agc, ...agencies] : agencies;
  const solOptions = solicitante ? [solicitante] : [];

  return (
    <>
      <h3 className={styles.h2}>Datos principales</h3>
      <div className={styles.formGrid}>
        <Field
          label="Agencia"
          required
          error={errs.agc}
          hint={isAdmin ? undefined : "Asignada a tu usuario."}
        >
          <Select
            value={t.agc}
            onChange={(e) => set({ agc: e.target.value })}
            disabled={!isAdmin}
          >
            <option value="">—</option>
            {agcOptions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Solicitante" required error={errs.solicitante} hint="Tu usuario.">
          <Select value={solicitante} disabled>
            {solOptions.length === 0 && <option value="">—</option>}
            {solOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
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
            {catOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
}
