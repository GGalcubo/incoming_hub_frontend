import type { CSSProperties } from "react";
import { Button } from "../../../components/ui/Button";
import { Field, Input, Select } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import { CATEGORIES } from "../../../data/seed";
import type { Passenger } from "../../../types/domain";
import {
  cardHeaderRow,
  grid1,
  grid2,
  h2,
  itemCard,
  itemCardTitle,
  p,
  removeBtn,
} from "../styles";
import type { StepProps } from "../types";

export function StepViaje({ t, set, errs, isMobile }: StepProps) {
  const grid: CSSProperties = isMobile ? grid1 : grid2;
  const updatePax = (i: number, patch: Partial<Passenger>) =>
    set({ passengers: t.passengers.map((px, j) => (j === i ? { ...px, ...patch } : px)) });
  const addPax = () => {
    if (t.passengers.length < 4)
      set({ passengers: [...t.passengers, { firstName: "", lastName: "", phone: "" }] });
  };
  const rmPax = (i: number) => set({ passengers: t.passengers.filter((_, j) => j !== i) });

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
        <Field label="Categoría de servicio" required error={errs.cat} span={isMobile ? 1 : 2}>
          <Select value={t.cat} onChange={(e) => set({ cat: e.target.value })}>
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>

      <h3 style={{ ...h2, marginTop: 24 }}>Pasajeros</h3>
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
        <div key={i} style={itemCard(isMobile)}>
          <div style={cardHeaderRow}>
            <div style={itemCardTitle}>Pasajero {i + 1}</div>
            {t.passengers.length > 1 && (
              <button onClick={() => rmPax(i)} style={removeBtn}>
                <Icon name="trash" size={14} />
                Quitar
              </button>
            )}
          </div>
          <div style={grid}>
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
            <Field label="Teléfono" error={errs[`pax-${i}-phone`]} span={isMobile ? 1 : 2}>
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
        style={{ marginTop: 14 }}
      >
        Agregar pasajero {t.passengers.length >= 4 && "(máx 4)"}
      </Button>
    </>
  );
}
