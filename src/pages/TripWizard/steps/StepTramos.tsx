import type { CSSProperties } from "react";
import { Button } from "../../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import { hasGoogleMapsKey } from "../../../lib/gmaps";
import type { Leg } from "../../../types/domain";
import { LegMap } from "../LegMap";
import { PlaceCombo } from "../PlaceCombo";
import { geocodePlaceId } from "../geocode";
import { cardHeaderRow, grid1, grid2, h2, itemCard, itemCardTitle, p, removeBtn } from "../styles";
import type { StepProps } from "../types";

export function StepTramos({ t, set, errs, isMobile }: StepProps) {
  const grid: CSSProperties = isMobile ? grid1 : grid2;
  const updateLeg = (i: number, patch: Partial<Leg>) => {
    const next = t.legs.map((l, j) => (j === i ? { ...l, ...patch } : l));
    if ("destination" in patch && i + 1 < next.length) {
      next[i + 1] = {
        ...next[i + 1],
        origin: patch.destination ?? "",
        originCoords: patch.destinationCoords ?? next[i].destinationCoords,
      };
    }
    set({ legs: next });
  };
  const addLeg = () => {
    const last = t.legs[t.legs.length - 1];
    set({
      legs: [
        ...t.legs,
        {
          type: "otro",
          origin: last?.destination ?? "",
          originCoords: last?.destinationCoords,
          destination: "",
          flight: "",
          obs: "",
        },
      ],
    });
  };
  const rmLeg = (i: number) => {
    const next = t.legs.filter((_, j) => j !== i);
    if (i > 0 && i < t.legs.length) {
      const prev = next[i - 1];
      if (next[i]) {
        next[i] = {
          ...next[i],
          origin: prev.destination,
          originCoords: prev.destinationCoords,
        };
      }
    }
    set({ legs: next });
  };

  return (
    <>
      <h3 style={h2}>Destinos del viaje</h3>
      <p style={p}>Agregá uno o más destinos. Para llegadas/salidas se pide número de vuelo.</p>

      {t.legs.map((leg, i) => (
        <div key={i} style={{ ...itemCard(isMobile), marginTop: 14 }}>
          <div style={cardHeaderRow}>
            <div style={itemCardTitle}>Destino {i + 1}</div>
            {t.legs.length > 1 && (
              <button onClick={() => rmLeg(i)} style={removeBtn}>
                <Icon name="trash" size={14} />
                Quitar
              </button>
            )}
          </div>
          <div style={grid}>
            {i === 0 && (
              <>
                <Field label="Tipo de servicio">
                  <Select
                    value={leg.type}
                    onChange={(e) => {
                      const next = e.target.value as Leg["type"];
                      updateLeg(i, {
                        type: next,
                        flight: next === "disposicion" ? "" : leg.flight,
                        hours: next === "disposicion" ? (leg.hours ?? 1) : undefined,
                      });
                    }}
                  >
                    <option value="in">Llegada (in)</option>
                    <option value="out">Salida (out)</option>
                    <option value="otro">Otro</option>
                    <option value="disposicion">Hs disposición</option>
                  </Select>
                </Field>
                {leg.type === "disposicion" ? (
                  <Field label="Horas de disposición" hint="Entre 1 y 12 hs">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      step={1}
                      value={leg.hours ?? 1}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value, 10);
                        if (Number.isNaN(raw)) {
                          updateLeg(i, { hours: undefined });
                          return;
                        }
                        const clamped = Math.max(1, Math.min(12, raw));
                        updateLeg(i, { hours: clamped });
                      }}
                      placeholder="1-12"
                    />
                  </Field>
                ) : (
                  <Field label="Vuelo" hint={leg.type === "otro" ? "No aplica" : "AA995, LA4302…"}>
                    <Input
                      disabled={leg.type === "otro"}
                      value={leg.flight}
                      onChange={(e) => updateLeg(i, { flight: e.target.value })}
                      placeholder="—"
                    />
                  </Field>
                )}
                <Field label="Origen" required error={errs[`leg-${i}-origin`]}>
                  <PlaceCombo
                    value={leg.origin}
                    onChange={(v) => updateLeg(i, { origin: v, originCoords: undefined })}
                    onPick={(desc, placeId) =>
                      geocodePlaceId(placeId, (coords) => {
                        if (coords) updateLeg(i, { origin: desc, originCoords: coords });
                      })
                    }
                  />
                </Field>
              </>
            )}
            <Field
              label={i === 0 ? "Destino" : undefined}
              required={i === 0}
              error={errs[`leg-${i}-destination`]}
              span={i === 0 ? undefined : isMobile ? 1 : 2}
            >
              <PlaceCombo
                value={leg.destination}
                onChange={(v) => updateLeg(i, { destination: v, destinationCoords: undefined })}
                onPick={(desc, placeId) =>
                  geocodePlaceId(placeId, (coords) => {
                    if (coords) updateLeg(i, { destination: desc, destinationCoords: coords });
                  })
                }
              />
            </Field>
            {hasGoogleMapsKey() && (
              <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                <LegMap
                  leg={leg}
                  lockOrigin={i > 0}
                  onPickOrigin={(text, coords) =>
                    updateLeg(i, { origin: text, originCoords: coords })
                  }
                  onPickDestination={(text, coords) =>
                    updateLeg(i, { destination: text, destinationCoords: coords })
                  }
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <Button kind="ghost" icon="plus" onClick={addLeg} style={{ marginTop: 14 }}>
        Agregar destino
      </Button>

      <div style={{ marginTop: 18 }}>
        <Field label="Observaciones">
          <Textarea
            value={t.obs}
            onChange={(e) => set({ obs: e.target.value })}
            placeholder="Ej. Cartel: Sr. Álvarez"
          />
        </Field>
      </div>
    </>
  );
}
