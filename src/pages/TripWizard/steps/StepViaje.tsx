import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Field, Input, Select } from "../../../components/ui/Field";
import { AGENCIES } from "../../../data/seed";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

export function StepViaje({ t, set, errs }: StepProps) {
  const [agencies, setAgencies] = useState<string[]>(AGENCIES);
  // El solicitante es el usuario logueado; el admin puede elegir otro de la agencia.
  const [loggedUser, setLoggedUser] = useState<string>(t.solicitante ?? "");
  const [isAdmin, setIsAdmin] = useState(false);
  const [solByAgency, setSolByAgency] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    api
      .getWizardIdentity()
      .then((id) => {
        if (!active) return;
        if (id.agencies.length) setAgencies(id.agencies);
        setLoggedUser(id.solicitante);
        setIsAdmin(id.isAdmin);
        setSolByAgency(id.solicitantesByAgency);

        const patch: Partial<typeof t> = {};
        // Agencia por defecto: la propia del usuario. Los no-admin quedan fijos
        // a su agencia; el admin puede cambiarla luego (sólo fijamos si está vacía).
        if (id.ownAgency && (!t.agc || !id.isAdmin)) patch.agc = id.ownAgency;
        else if (!t.agc && id.agencies.length) patch.agc = id.agencies[0];
        // Solicitante: los no-admin son siempre el usuario logueado. El admin
        // arranca con el usuario logueado pero puede cambiarlo.
        if (!id.isAdmin) patch.solicitante = id.solicitante;
        else if (!t.solicitante) patch.solicitante = id.solicitante;
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

  // Al cambiar de agencia (sólo admin), reasignamos el solicitante: mantenemos
  // al usuario logueado si pertenece a esa agencia, sino el primero de la lista.
  const onAgencyChange = (agc: string) => {
    const list = solByAgency[agc] ?? [];
    const next = list.includes(loggedUser) ? loggedUser : (list[0] ?? "");
    set({ agc, solicitante: next });
  };

  // Si el viaje en edición trae una agencia que no está en el catálogo, la
  // incluimos para que la selección no se pierda.
  const agcOptions =
    t.agc && !agencies.includes(t.agc) ? [t.agc, ...agencies] : agencies;

  // Solicitantes disponibles: para el admin, los de la agencia elegida; para el
  // resto, sólo el usuario logueado.
  const baseSol = isAdmin ? (solByAgency[t.agc] ?? []) : loggedUser ? [loggedUser] : [];
  const solOptions =
    t.solicitante && !baseSol.includes(t.solicitante) ? [t.solicitante, ...baseSol] : baseSol;

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
            onChange={(e) => onAgencyChange(e.target.value)}
            disabled={!isAdmin}
          >
            <option value="">—</option>
            {agcOptions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Solicitante"
          required
          error={errs.solicitante}
          hint={isAdmin ? "Solicitante de la agencia." : "Tu usuario."}
        >
          <Select
            value={t.solicitante ?? ""}
            onChange={(e) => set({ solicitante: e.target.value })}
            disabled={!isAdmin}
          >
            <option value="">—</option>
            {solOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" required error={errs.date}>
          <Input type="date" value={t.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Hora" required error={errs.time} span={2}>
          <Input
            type="time"
            lang="es-ES"
            step={60}
            value={t.time}
            onChange={(e) => set({ time: e.target.value })}
          />
        </Field>
      </div>
    </>
  );
}
