import { useEffect, useState } from "react";
import { api, type TarifaOpcion } from "../../../api/client";
import { HAS_BACKEND } from "../../../api/http";
import { Field, Input, Select } from "../../../components/ui/Field";
import { useMe } from "../../../hooks/useMe";
import { cx } from "../../../lib/cx";
import type { Proveedor, TarifaExtras } from "../../../types/tarifas";
import type { StepProps } from "../types";
import styles from "./steps.module.css";

// Adivina el lugar tarifado (EZE/AEP/Centro) a partir del texto libre de un
// extremo del tramo. Para lo que no matchea un aeropuerto, asumimos la primera
// zona "de ciudad" disponible (Centro/CABA según el catálogo).
function guessLugar(text: string | undefined, lugares: string[]): string {
  const s = (text ?? "").toLowerCase();
  const has = (code: string) => lugares.find((l) => l.toUpperCase() === code);
  if (s.includes("eze") || s.includes("ezeiza")) return has("EZE") ?? "";
  if (s.includes("aep") || s.includes("aeroparque") || s.includes("newbery")) {
    return has("AEP") ?? "";
  }
  return has("CENTRO") ?? has("CABA") ?? (lugares[0] ?? "");
}

// Precio cliente/proveedor de una opción según la modalidad elegida.
//
// Con backend real el precio SIEMPRE es el de la tarifa: la base del costo la
// calcula el servidor a partir de la tarifa del tramo, y las horas a disposición
// viajan aparte (costo.horas_disponibles). Sin backend se mantiene el cálculo
// del mock: valor de la hora × horas.
function priceOf(
  op: TarifaOpcion,
  modalidad: "traslado" | "horas",
  horas: number,
  extras: TarifaExtras | null,
): { cliente: number | null; proveedor: number | null } {
  if (modalidad === "horas" && !HAS_BACKEND) {
    if (!extras || !(horas > 0)) return { cliente: null, proveedor: null };
    return {
      cliente: +(extras.horaDispoCliente * horas).toFixed(2),
      proveedor: +(extras.horaDispoProveedor * horas).toFixed(2),
    };
  }
  return { cliente: op.precioCliente, proveedor: op.precioProveedor };
}

export function StepTarifa({ t, set, errs }: StepProps) {
  const { isProvider, isAgency, proveedorId } = useMe();
  const [lugares, setLugares] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [opciones, setOpciones] = useState<TarifaOpcion[]>([]);
  const [detalle, setDetalle] = useState("");
  const [extras, setExtras] = useState<TarifaExtras | null>(null);
  const [loading, setLoading] = useState(false);

  const origen = t.tarifa?.origen ?? "";
  const destino = t.tarifa?.destino ?? "";
  const modalidad = t.tarifa?.modalidad ?? "traslado";
  const horas = t.tarifa?.horas ?? 1;
  const tarifaId = t.tarifa?.tarifaId;
  // El precio sale del tarifario del proveedor que presta el servicio; mientras
  // no haya uno asignado, del general (lo resuelve la API). El proveedor logueado
  // solo ve viajes suyos, así que es siempre el propio.
  const proveedorViaje = t.proveedorId ?? proveedorId ?? "";
  // Solo el admin asigna proveedor. La agencia crea el viaje sin saber quién lo
  // va a prestar: no ve el campo. El proveedor lo ve pero no lo cambia.
  const canSetProveedor = !isProvider && !isAgency;

  // Catálogo de lugares tarifados. Al entrar, si no hay ruta elegida, la
  // reconstruimos: de la tarifa ya guardada en el viaje si la hay, o inferida del
  // primer y último destino.
  useEffect(() => {
    let active = true;
    api
      .listLugaresRuta()
      .then(async (lg) => {
        if (!active) return;
        setLugares(lg);
        if (t.tarifa?.origen || t.tarifa?.destino) return;
        // Viaje ya creado con tarifa: el tramo solo guarda su id, así que le
        // pedimos al backend de qué ruta es para poder marcar la selección.
        if (tarifaId != null) {
          const ruta = await api.rutaDeTarifa(tarifaId).catch(() => null);
          if (active && ruta) {
            set({ tarifa: { ...t.tarifa, ...ruta, modalidad } });
            return;
          }
        }
        if (!active || !t.legs.length) return;
        set({
          tarifa: {
            ...t.tarifa,
            origen: guessLugar(t.legs[0]?.origin, lg),
            destino: guessLugar(t.legs[t.legs.length - 1]?.destination, lg),
            modalidad,
          },
        });
      })
      .catch(() => {
        /* sin backend/mocks: se queda vacío */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extras (valor de la hora a disposición) del proveedor del viaje. Es lo único
  // del tarifario que el backend todavía no expone por proveedor: con backend
  // real se usa el set general del mock.
  useEffect(() => {
    let active = true;
    api
      .getTarifasExtras(HAS_BACKEND ? undefined : proveedorViaje)
      .then((ex) => {
        if (active) setExtras(ex);
      })
      .catch(() => {
        if (active) setExtras(null);
      });
    return () => {
      active = false;
    };
  }, [proveedorViaje]);

  // Tarifas vigentes de la ruta elegida.
  useEffect(() => {
    if (!origen || !destino) {
      setOpciones([]);
      setProveedores([]);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .cotizarRuta(origen, destino, proveedorViaje)
      .then((c) => {
        if (!active) return;
        setOpciones(c.opciones);
        setProveedores(c.proveedores);
        setDetalle(c.detalle);
      })
      .catch(() => {
        if (!active) return;
        setOpciones([]);
        setProveedores([]);
        setDetalle("No se pudieron cargar las tarifas de la ruta.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [origen, destino, proveedorViaje]);

  // Con un proveedor asignado se muestran solo sus tarifas; sin asignar, las de
  // todos (elegir una es lo que asigna el proveedor del viaje).
  const visibles = proveedorViaje
    ? opciones.filter((o) => o.proveedorId === proveedorViaje)
    : opciones;
  // El cliente nunca ve de qué proveedor es la tarifa.
  const showProveedorEnCard =
    !isAgency && new Set(visibles.map((o) => o.proveedorId)).size > 1;

  const patchTarifa = (patch: Partial<NonNullable<typeof t.tarifa>>) =>
    set({ tarifa: { ...t.tarifa, ...patch } });

  // Aplica la selección de una tarifa: fija cat (nombre de la categoría), guarda
  // el id de la tarifa (es lo que viaja al backend en el tramo) y recalcula los
  // costos. `viaje` es el precio al cliente; `tarifaProveedor` el costo del
  // proveedor (nunca se muestra al cliente). Con backend real estos montos son
  // una previsualización: la base definitiva la recalcula el servidor con la
  // tarifa del tramo.
  const commit = (
    op: TarifaOpcion,
    nextModalidad: "traslado" | "horas" = modalidad,
    nextHoras: number = horas,
  ) => {
    const p = priceOf(op, nextModalidad, nextHoras, extras);
    const viaje = p.cliente ?? 0;
    const c = t.costs;
    set({
      cat: op.nombre,
      // Elegir la tarifa define el proveedor del viaje.
      ...(op.proveedorId ? { proveedorId: op.proveedorId } : {}),
      tarifa: {
        ...t.tarifa,
        tarifaId: op.tarifaId,
        origen,
        destino,
        categoria: op.codigo,
        modalidad: nextModalidad,
        horas: nextHoras,
      },
      costs: {
        ...c,
        viaje,
        total: viaje + c.espera + c.peajes + c.estacionamiento + c.otros,
        moneda: op.moneda,
        ...(p.proveedor != null ? { tarifaProveedor: p.proveedor } : {}),
      },
    });
  };

  // Reaplica el precio de la categoría ya elegida (al cambiar modalidad/horas).
  const recommit = (nextModalidad: "traslado" | "horas", nextHoras: number) => {
    const sel = visibles.find((o) => o.codigo === t.tarifa?.categoria);
    if (!sel) return;
    commit(sel, nextModalidad, nextHoras);
  };

  // Cambiar de proveedor cambia el tarifario: se limpia la tarifa elegida y su
  // precio para que se vuelva a elegir con los valores del nuevo.
  const onProveedor = (id: string) => {
    const c = t.costs;
    set({
      proveedorId: id || undefined,
      cat: "",
      tarifa: { ...t.tarifa, categoria: undefined, tarifaId: undefined },
      costs: {
        ...c,
        viaje: 0,
        tarifaProveedor: undefined,
        total: c.espera + c.peajes + c.estacionamiento + c.otros,
      },
    });
  };

  const onRoute = (patch: { origen?: string; destino?: string }) => {
    // Al cambiar la ruta el precio cambia: limpiamos la selección para re-elegir.
    set({
      cat: "",
      tarifa: { ...t.tarifa, ...patch, categoria: undefined, tarifaId: undefined },
      costs: {
        ...t.costs,
        viaje: 0,
        total: t.costs.espera + t.costs.peajes + t.costs.estacionamiento + t.costs.otros,
      },
    });
  };

  return (
    <>
      <h3 className={styles.h2}>Tarifa</h3>
      <p className={styles.p}>
        El precio se calcula según origen y destino.{" "}
        {HAS_BACKEND
          ? "En modo “horas a disposición” se informan las horas junto con el costo del viaje."
          : "En modo “horas a disposición” se multiplican las horas por el valor de hora."}{" "}
        Montos en dólares (u$s).
      </p>

      {!isAgency && (
        <Field
          label="Proveedor"
          className={styles.proveedorField}
          hint={
            canSetProveedor
              ? "Quién presta el servicio: define su tarifario y quién carga los costos. Elegir una tarifa lo asigna solo."
              : undefined
          }
        >
          {canSetProveedor ? (
            <Select value={proveedorViaje} onChange={(e) => onProveedor(e.target.value)}>
              <option value="">
                {HAS_BACKEND ? "Sin asignar (ver todas las tarifas)" : "Sin asignar (tarifario general)"}
              </option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              readOnly
              value={proveedores.find((p) => p.id === proveedorViaje)?.nombre ?? "Sin asignar"}
            />
          )}
        </Field>
      )}

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
      ) : !visibles.length ? (
        <div className={styles.catNoPrice}>
          {detalle || "No hay tarifas vigentes para esa ruta."}
        </div>
      ) : (
        <div className={styles.catGrid}>
          {visibles.map((op) => {
            const p = priceOf(op, modalidad, horas, extras);
            const shown = isProvider ? p.proveedor : p.cliente;
            // Con backend real la selección es la tarifa concreta (dos
            // proveedores pueden ofrecer la misma categoría); sin él, la categoría.
            const selected =
              op.tarifaId != null ? op.tarifaId === tarifaId : t.tarifa?.categoria === op.codigo;
            const disabled = shown == null;
            return (
              <button
                type="button"
                key={op.tarifaId ?? `${op.proveedorId}-${op.codigo}`}
                disabled={disabled}
                className={cx(
                  styles.catCard,
                  selected && styles.catCardActive,
                  disabled && styles.catCardDisabled,
                )}
                onClick={() => commit(op)}
              >
                <span className={cx(styles.catRadio, selected && styles.catRadioOn)} />
                {shown != null ? (
                  <>
                    <span className={styles.catPrice}>{shown}</span>
                    <span className={styles.catCurrency}>{op.moneda}</span>
                    <span className={styles.catPeajes}>(Incluye peajes)</span>
                  </>
                ) : (
                  <span className={styles.catNoPrice}>Sin tarifa</span>
                )}
                <span className={styles.catName}>{op.nombre}</span>
                <span className={styles.catVehiculo}>
                  {showProveedorEnCard ? op.proveedorNombre : op.vehiculo}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
