import { useEffect, useRef, useState } from "react";
import { api, type TarifaOpcion } from "../../../api/client";
import { HAS_BACKEND } from "../../../api/http";
import { Field, Input, Select } from "../../../components/ui/Field";
import { useMe } from "../../../hooks/useMe";
import { cx } from "../../../lib/cx";
import type { Trip } from "../../../types/domain";
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
  // Ruta a la que corresponden las opciones ya cargadas. Sirve para no recotizar
  // con las tarifas de la ruta anterior mientras la nueva está en vuelo.
  const [cotizada, setCotizada] = useState("");
  // Categoría elegida que quedó pendiente de recotizar tras cambiar la ruta.
  const [pendiente, setPendiente] = useState<string | null>(null);
  // Una vez que el usuario elige origen/destino a mano dejamos de seguir al
  // primer tramo: manda lo que eligió.
  const [rutaManual, setRutaManual] = useState(false);
  // Viaje que ya venía con tarifa (edición): la ruta guardada no se toca.
  const rutaGuardada = useRef(t.tarifa != null);

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

  // Catálogo de lugares tarifados. Al entrar, si el viaje ya tiene tarifa pero no
  // sabemos de qué ruta es, se la pedimos al backend. La ruta de un viaje nuevo la
  // arma el efecto de abajo a partir del primer tramo.
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
          if (active && ruta) set({ tarifa: { ...t.tarifa, ...ruta, modalidad } });
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
  const rutaKey = `${origen}|${destino}|${proveedorViaje}`;
  useEffect(() => {
    if (!origen || !destino) {
      setOpciones([]);
      setProveedores([]);
      setCotizada("");
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
        if (!active) return;
        setLoading(false);
        setCotizada(rutaKey);
      });
    return () => {
      active = false;
    };
  }, [origen, destino, proveedorViaje, rutaKey]);

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

  // Deja el viaje sin tarifa: se usa cuando la selección ya no es válida (cambio
  // de proveedor, o categoría sin tarifa en la ruta nueva).
  const clearSeleccion = (patch: Partial<Trip> = {}) => {
    const c = t.costs;
    set({
      cat: "",
      tarifa: { ...t.tarifa, categoria: undefined, tarifaId: undefined },
      costs: {
        ...c,
        viaje: 0,
        tarifaProveedor: undefined,
        total: c.espera + c.peajes + c.estacionamiento + c.otros,
      },
      ...patch,
    });
  };

  // Recotiza la categoría ya elegida cuando cambia la ruta: apenas llegan las
  // tarifas del nuevo origen/destino se reaplica el precio de esa misma
  // categoría (y con él el tarifaId, que es lo que se manda al backend). Si la
  // ruta nueva no tiene esa categoría (o la tiene sin precio), se limpia para
  // que se vuelva a elegir.
  useEffect(() => {
    if (!pendiente || loading || cotizada !== rutaKey) return;
    const op = visibles.find((o) => o.codigo === pendiente);
    const p = op ? priceOf(op, modalidad, horas, extras) : null;
    const precio = isProvider ? p?.proveedor : p?.cliente;
    setPendiente(null);
    if (op && precio != null) commit(op);
    else clearSeleccion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendiente, loading, cotizada, rutaKey, opciones]);

  // Cambiar de proveedor cambia el tarifario: se limpia la tarifa elegida y su
  // precio para que se vuelva a elegir con los valores del nuevo.
  const onProveedor = (id: string) => {
    setPendiente(null);
    clearSeleccion({ proveedorId: id || undefined });
  };

  const onRoute = (patch: { origen?: string; destino?: string }, manual = true) => {
    if (manual) setRutaManual(true);
    const ruta = { ...t.tarifa, ...patch };
    // Ruta incompleta (eligió "—"): no hay contra qué recotizar, se limpia.
    if (!ruta.origen || !ruta.destino) {
      setPendiente(null);
      clearSeleccion({ tarifa: { ...ruta, categoria: undefined, tarifaId: undefined } });
      return;
    }
    // Al cambiar la ruta cambia el precio, pero NO la categoría elegida: la
    // dejamos marcada y la recotizamos cuando lleguen las tarifas de la ruta
    // nueva (efecto de arriba). Mientras tanto se mantiene el precio anterior,
    // así el viaje nunca queda a medio camino sin tarifa.
    setPendiente(t.tarifa?.categoria ?? null);
    set({ tarifa: ruta });
  };

  // Viaje nuevo: la ruta tarifada es la del PRIMER tramo, el origen y el destino
  // que cargó el usuario en la pantalla anterior. Si vuelve atrás y los cambia,
  // la tarifa los sigue (y se recotiza sola). Deja de seguirlos en cuanto elige
  // origen/destino a mano, y nunca pisa la ruta de un viaje ya tarifado.
  const leg0Origen = t.legs[0]?.origin;
  const leg0Destino = t.legs[0]?.destination;
  useEffect(() => {
    if (rutaManual || rutaGuardada.current || !lugares.length) return;
    if (!leg0Origen || !leg0Destino) return;
    const o = guessLugar(leg0Origen, lugares);
    const d = guessLugar(leg0Destino, lugares);
    if (o === origen && d === destino) return;
    onRoute({ origen: o, destino: d }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg0Origen, leg0Destino, lugares, rutaManual]);

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
