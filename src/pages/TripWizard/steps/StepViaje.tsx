import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Field, Input, Select } from "../../../components/ui/Field";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

export function StepViaje({ t, set, errs, mode }: StepProps) {
  const isEdit = mode === "edit";
  // Las agencias las trae el backend. Hasta que responda no hay ninguna: el
  // selector queda vacío en vez de ofrecer una lista de ejemplo.
  const [agencies, setAgencies] = useState<string[]>([]);
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
        // Agencia y solicitante del viaje ya creado: se conservan tal cual vienen
        // del backend. Recalcularlos con el usuario actual pisaba a quien generó
        // el viaje (un operador abriendo el viaje de otro se ponía a sí mismo).
        // Sólo completamos lo que venga vacío.
        // Agencia por defecto: la propia del usuario. Los no-admin quedan fijos
        // a su agencia; el admin puede cambiarla luego (sólo fijamos si está vacía).
        if (!t.agc) patch.agc = id.ownAgency ?? id.agencies[0] ?? "";
        else if (!isEdit && !id.isAdmin && id.ownAgency) patch.agc = id.ownAgency;
        // Solicitante: SOLO se calcula al dar de alta (los no-admin son siempre
        // el usuario logueado; el admin arranca con él y puede cambiarlo). Al
        // editar se muestra el que guardó el viaje, aunque venga vacío: rellenarlo
        // con el usuario actual era justamente lo que borraba a quien lo generó.
        if (!isEdit && (!t.solicitante || !id.isAdmin)) patch.solicitante = id.solicitante;
        set(patch);
      })
      .catch(() => {
        /* sin sesión o backend caído: el selector queda vacío, no se inventa */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de agencia (sólo admin), reasignamos el solicitante: mantenemos
  // el actual si pertenece a esa agencia, sino al usuario logueado y por último
  // el primero de la lista.
  const onAgencyChange = (agc: string) => {
    const list = solByAgency[agc] ?? [];
    const current = t.solicitante ?? "";
    const next = list.includes(current)
      ? current
      : list.includes(loggedUser)
        ? loggedUser
        : (list[0] ?? "");
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
          hint={isAdmin ? undefined : isEdit ? "Agencia del viaje." : "Asignada a tu usuario."}
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
          hint={
            isAdmin
              ? "Solicitante de la agencia."
              : isEdit
                ? "Quien generó el viaje."
                : "Tu usuario."
          }
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
