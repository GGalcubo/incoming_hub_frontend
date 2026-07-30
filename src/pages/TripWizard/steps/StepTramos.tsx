import { Button } from "../../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import { hasGoogleMapsKey } from "../../../lib/gmaps";
import { cx } from "../../../lib/cx";
import type { LatLng, Leg } from "../../../types/domain";
import { RouteMap } from "../RouteMap";
import { PlaceCombo } from "../PlaceCombo";
import { geocodePlaceId } from "../geocode";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

export function StepTramos({ t, set, errs }: StepProps) {
  // El destino de un tramo es el origen del siguiente: al cambiarlo, arrastramos
  // también el texto desglosado (nombre + dirección) para que la cadena quede
  // consistente y el backend reciba lo mismo en ambos extremos del empalme.
  const updateLeg = (i: number, patch: Partial<Leg>) => {
    const next = t.legs.map((l, j) => (j === i ? { ...l, ...patch } : l));
    if ("destination" in patch && i + 1 < next.length) {
      const cur = next[i];
      next[i + 1] = {
        ...next[i + 1],
        origin: cur.destination,
        originCoords: cur.destinationCoords,
        originName: cur.destinationName,
        originAddress: cur.destinationAddress,
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
          originName: last?.destinationName,
          originAddress: last?.destinationAddress,
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
          originName: prev.destinationName,
          originAddress: prev.destinationAddress,
        };
      }
    }
    set({ legs: next });
  };
  // El punto 0 del recorrido es el origen del primer tramo; el punto k (>=1)
  // es el destino del tramo k-1 (que updateLeg propaga como origen del k).
  const setPoint = (index: number, text: string, coords: LatLng) => {
    // Al marcar en el mapa no hay desglose nombre/dirección: limpiamos el que
    // hubiera quedado de una elección previa del autocomplete.
    if (index === 0)
      updateLeg(0, {
        origin: text,
        originCoords: coords,
        originName: undefined,
        originAddress: undefined,
      });
    else
      updateLeg(index - 1, {
        destination: text,
        destinationCoords: coords,
        destinationName: undefined,
        destinationAddress: undefined,
      });
  };

  const showMap = hasGoogleMapsKey();

  return (
    <>
      <h3 className={styles.h2}>Destinos del viaje</h3>
      <p className={styles.p}>
        Agregá uno o más destinos. Para llegadas/salidas se pide número de
        vuelo.
      </p>

      <div
        className={cx(
          styles.tramosLayout,
          !showMap && styles.tramosLayoutSingle,
        )}
      >
        <div className={styles.tramosLeft}>
          {t.legs.map((leg, i) => (
            <div key={i} className={cx(styles.itemCard, styles.legCard)}>
              <div className={styles.cardHeaderRow}>
                <div className={styles.itemCardTitle}>Destino {i + 1}</div>
                {t.legs.length > 1 && (
                  <button onClick={() => rmLeg(i)} className={styles.removeBtn}>
                    <Icon name="trash" size={14} />
                    Quitar
                  </button>
                )}
              </div>
              <div className={styles.formGrid}>
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
                            hours:
                              next === "disposicion"
                                ? (leg.hours ?? 1)
                                : undefined,
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
                      <Field
                        label="Horas de disposición"
                        hint="Entre 1 y 12 hs"
                        error={errs[`leg-${i}-hours`]}
                      >
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
                      <Field
                        label="Vuelo"
                        hint={
                          leg.type === "otro" ? "No aplica" : "AA995, LA4302…"
                        }
                      >
                        <Input
                          disabled={leg.type === "otro"}
                          value={leg.flight}
                          onChange={(e) =>
                            updateLeg(i, { flight: e.target.value })
                          }
                          placeholder="—"
                        />
                      </Field>
                    )}
                    <Field
                      label="Origen"
                      required
                      error={errs[`leg-${i}-origin`]}
                      span={2}
                    >
                      <PlaceCombo
                        value={leg.origin}
                        onChange={(v) =>
                          updateLeg(i, {
                            origin: v,
                            originCoords: undefined,
                            originName: undefined,
                            originAddress: undefined,
                          })
                        }
                        onPick={(pick, placeId) =>
                          geocodePlaceId(placeId, (coords) => {
                            if (coords)
                              updateLeg(i, {
                                origin: pick.description,
                                originName: pick.name,
                                originAddress: pick.address,
                                originCoords: coords,
                              });
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
                  span={2}
                >
                  <PlaceCombo
                    value={leg.destination}
                    onChange={(v) =>
                      updateLeg(i, {
                        destination: v,
                        destinationCoords: undefined,
                        destinationName: undefined,
                        destinationAddress: undefined,
                      })
                    }
                    onPick={(pick, placeId) =>
                      geocodePlaceId(placeId, (coords) => {
                        if (coords)
                          updateLeg(i, {
                            destination: pick.description,
                            destinationName: pick.name,
                            destinationAddress: pick.address,
                            destinationCoords: coords,
                          });
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}

          <Button
            kind="ghost"
            icon="plus"
            onClick={addLeg}
            className={styles.addBtn}
          >
            Agregar destino
          </Button>

          <div className={styles.obsRow}>
            <Field label="Observaciones">
              <Textarea
                value={t.obs}
                onChange={(e) => set({ obs: e.target.value })}
                placeholder="Ej. Cartel: Sr. Álvarez"
              />
            </Field>
          </div>
        </div>

        {showMap && (
          <div className={styles.tramosRight}>
            <div className={styles.routeMapSticky}>
              <RouteMap legs={t.legs} onSetPoint={setPoint} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
