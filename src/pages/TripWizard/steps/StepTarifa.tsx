import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Field, Input, Select } from "../../../components/ui/Field";
import { useMe } from "../../../hooks/useMe";
import { cx } from "../../../lib/cx";
import type { CategoriaTarifada, TarifaExtras } from "../../../types/tarifas";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

// Adivina el lugar tarifado (EZE/AEP/Centro) a partir del texto libre de un
// extremo del tramo. Para lo que no matchea un aeropuerto, asumimos "Centro".
function guessLugar(text: string | undefined, lugares: string[]): string {
  const s = (text ?? "").toLowerCase();
  if (s.includes("eze") || s.includes("ezeiza")) return "EZE";
  if (s.includes("aep") || s.includes("aeroparque") || s.includes("newbery")) return "AEP";
  return lugares.includes("Centro") ? "Centro" : (lugares[0] ?? "");
}

// Precio cliente/proveedor de una categoría según la modalidad elegida.
function priceOf(
  cat: CategoriaTarifada,
  modalidad: "traslado" | "horas",
  horas: number,
  extras: TarifaExtras | null,
): { cliente: number | null; proveedor: number | null } {
  if (modalidad === "horas") {
    if (!extras || !(horas > 0)) return { cliente: null, proveedor: null };
    return {
      cliente: +(extras.horaDispoCliente * horas).toFixed(2),
      proveedor: +(extras.horaDispoProveedor * horas).toFixed(2),
    };
  }
  return { cliente: cat.tarifaCliente, proveedor: cat.tarifaProveedor };
}

export function StepTarifa({ t, set, errs }: StepProps) {
  const { isProvider } = useMe();
  const [lugares, setLugares] = useState<string[]>([]);
  const [cats, setCats] = useState<CategoriaTarifada[]>([]);
  const [extras, setExtras] = useState<TarifaExtras | null>(null);
  const [loading, setLoading] = useState(false);

  const origen = t.tarifa?.origen ?? "";
  const destino = t.tarifa?.destino ?? "";
  const modalidad = t.tarifa?.modalidad ?? "traslado";
  const horas = t.tarifa?.horas ?? 1;

  // Catálogos: lugares y extras. Al entrar, si no hay ruta elegida, la inferimos
  // del primer y último destino del viaje.
  useEffect(() => {
    let active = true;
    Promise.all([api.listTarifaLugares(), api.getTarifasExtras()])
      .then(([lg, ex]) => {
        if (!active) return;
        setLugares(lg);
        setExtras(ex);
        if (!t.tarifa?.origen && !t.tarifa?.destino && t.legs.length) {
          const o = guessLugar(t.legs[0]?.origin, lg);
          const d = guessLugar(t.legs[t.legs.length - 1]?.destination, lg);
          set({ tarifa: { ...t.tarifa, origen: o, destino: d, modalidad } });
        }
      })
      .catch(() => {
        /* sin backend/mocks: se queda vacío */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Categorías tarifadas de la ruta elegida.
  useEffect(() => {
    if (!origen || !destino) {
      setCats([]);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .getCategoriasTarifadas(origen, destino)
      .then((c) => {
        if (active) setCats(c);
      })
      .catch(() => {
        if (active) setCats([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [origen, destino]);

  const patchTarifa = (patch: Partial<NonNullable<typeof t.tarifa>>) =>
    set({ tarifa: { ...t.tarifa, ...patch } });

  // Aplica la selección de una categoría: fija cat (nombre), guarda la metadata y
  // recalcula los costos. `viaje` es el precio al cliente; `tarifaProveedor` el
  // costo del proveedor (nunca se muestra al cliente).
  const commit = (
    codigo: string,
    nombre: string,
    cliente: number | null,
    proveedor: number | null,
  ) => {
    const viaje = cliente ?? 0;
    const c = t.costs;
    set({
      cat: nombre,
      tarifa: { ...t.tarifa, origen, destino, categoria: codigo, modalidad, horas },
      costs: {
        ...c,
        viaje,
        total: viaje + c.espera + c.peajes + c.estacionamiento + c.otros,
        moneda: "USD",
        ...(proveedor != null ? { tarifaProveedor: proveedor } : {}),
      },
    });
  };

  // Reaplica el precio de la categoría ya elegida (al cambiar modalidad/horas).
  const recommit = (nextModalidad: "traslado" | "horas", nextHoras: number) => {
    const sel = cats.find((c) => c.codigo === t.tarifa?.categoria);
    if (!sel) return;
    const p = priceOf(sel, nextModalidad, nextHoras, extras);
    // commit usa el `modalidad`/`horas` de t.tarifa, que ya vamos a haber seteado
    const viaje = p.cliente ?? 0;
    const c = t.costs;
    set({
      cat: sel.nombre,
      tarifa: { ...t.tarifa, categoria: sel.codigo, modalidad: nextModalidad, horas: nextHoras },
      costs: {
        ...c,
        viaje,
        total: viaje + c.espera + c.peajes + c.estacionamiento + c.otros,
        moneda: "USD",
        ...(p.proveedor != null ? { tarifaProveedor: p.proveedor } : {}),
      },
    });
  };

  const onRoute = (patch: { origen?: string; destino?: string }) => {
    // Al cambiar la ruta el precio cambia: limpiamos la selección para re-elegir.
    set({
      cat: "",
      tarifa: { ...t.tarifa, ...patch, categoria: undefined },
      costs: { ...t.costs, viaje: 0, total: t.costs.espera + t.costs.peajes + t.costs.estacionamiento + t.costs.otros },
    });
  };

  return (
    <>
      <h3 className={styles.h2}>Tarifa</h3>
      <p className={styles.p}>
        El precio se calcula según origen y destino. En modo “horas a disposición” se multiplican
        las horas por el valor de hora. Montos en dólares (u$s).
      </p>

      <div className={styles.tarifaRouteRow}>
        <Field label="Origen" required error={errs.cat && !origen ? "Elegí un origen" : undefined}>
          <Select value={origen} onChange={(e) => onRoute({ origen: e.target.value })}>
            <option value="">—</option>
            {lugares.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Destino" required>
          <Select value={destino} onChange={(e) => onRoute({ destino: e.target.value })}>
            <option value="">—</option>
            {lugares.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        {modalidad === "horas" && (
          <Field label="Horas" error={errs.horas} className={styles.horasField}>
            <Input
              type="number"
              min={1}
              step={1}
              value={horas || ""}
              onChange={(e) => {
                const h = Number(e.target.value);
                patchTarifa({ horas: h });
                recommit("horas", h);
              }}
            />
          </Field>
        )}
      </div>

      <div className={styles.modalidadRow}>
        <span className={styles.catCurrency}>Modalidad:</span>
        <button
          type="button"
          className={cx(styles.modChip, modalidad === "traslado" && styles.modChipActive)}
          onClick={() => {
            patchTarifa({ modalidad: "traslado" });
            recommit("traslado", horas);
          }}
        >
          Traslado
        </button>
        <button
          type="button"
          className={cx(styles.modChip, modalidad === "horas" && styles.modChipActive)}
          onClick={() => {
            patchTarifa({ modalidad: "horas" });
            recommit("horas", horas);
          }}
        >
          Horas a disposición
        </button>
      </div>

      {errs.cat && !t.cat && (
        <div className={styles.catNoPrice} style={{ color: "var(--danger-fg)" }}>
          {errs.cat}
        </div>
      )}

      {!origen || !destino ? (
        <div className={styles.catNoPrice}>Elegí origen y destino para ver las tarifas.</div>
      ) : loading ? (
        <div className={styles.catNoPrice}>Cargando tarifas…</div>
      ) : (
        <div className={styles.catGrid}>
          {cats.map((c) => {
            const p = priceOf(c, modalidad, horas, extras);
            const shown = isProvider ? p.proveedor : p.cliente;
            const selected = t.tarifa?.categoria === c.codigo;
            const disabled = shown == null;
            return (
              <button
                type="button"
                key={c.codigo}
                disabled={disabled}
                className={cx(
                  styles.catCard,
                  selected && styles.catCardActive,
                  disabled && styles.catCardDisabled,
                )}
                onClick={() => commit(c.codigo, c.nombre, p.cliente, p.proveedor)}
              >
                <span className={cx(styles.catRadio, selected && styles.catRadioOn)} />
                {shown != null ? (
                  <>
                    <span className={styles.catPrice}>{shown}</span>
                    <span className={styles.catCurrency}>USD</span>
                    <span className={styles.catPeajes}>(Incluye peajes)</span>
                  </>
                ) : (
                  <span className={styles.catNoPrice}>Sin tarifa</span>
                )}
                <span className={styles.catName}>{c.nombre}</span>
                <span className={styles.catVehiculo}>{c.vehiculo}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
