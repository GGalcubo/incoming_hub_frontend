import { useEffect, useRef, useState } from "react";
import { api, type TarifaOpcion } from "../../../api/client";
import { useMe } from "../../../hooks/useMe";
import { cx } from "../../../lib/cx";
import type { Trip } from "../../../types/domain";
import type { VehicleCategoria } from "../../../types/tarifas";
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

// Precio cliente/proveedor de una opción según la modalidad del viaje.
//
// En "horas a disposición" la tarifa de la categoría es el valor de la hora: se
// cobra horas × tarifa, y ese total es el que muestra la card (es lo que va a
// gastar el cliente). En traslado, la tarifa es el precio del viaje.
//
// OJO con backend real: la base del costo la recalcula el servidor a partir de la
// tarifa del tramo, y las horas viajan aparte (costo.horas_disponibles). Este
// total es lo que el wizard muestra y manda; si el servidor no multiplica igual,
// al releer el viaje el monto vuelve al precio plano de la tarifa.
function priceOf(
  op: TarifaOpcion,
  modalidad: "traslado" | "horas",
  horas: number,
): { cliente: number | null; proveedor: number | null } {
  if (modalidad === "horas") {
    if (!(horas > 0)) return { cliente: null, proveedor: null };
    const por = (v: number | null) => (v == null ? null : +(v * horas).toFixed(2));
    return { cliente: por(op.precioCliente), proveedor: por(op.precioProveedor) };
  }
  return { cliente: op.precioCliente, proveedor: op.precioProveedor };
}

// Categoría del catálogo (sin tarifa para la ruta) presentada como una opción
// más: se puede elegir igual, con el precio en cero, y el costo se carga a mano
// en el paso Costos. El viaje guarda la categoría por NOMBRE (`Trip.cat`), que
// no depende del tarifario, así que una categoría sin tarifa se guarda bien.
function opcionSinTarifa(c: VehicleCategoria, moneda: string): TarifaOpcion {
  return {
    proveedorId: "",
    proveedorNombre: "",
    codigo: c.codigo,
    nombre: c.nombre,
    vehiculo: c.vehiculo,
    precioCliente: null,
    precioProveedor: null,
    moneda,
  };
}

export function StepTarifa({ t, set, errs }: StepProps) {
  const { isProvider, isAgency, proveedorId } = useMe();
  const [lugares, setLugares] = useState<string[]>([]);
  // Catálogo completo de categorías de vehículo: es lo que se ofrece cuando la
  // ruta no tiene tarifa (o le falta alguna categoría).
  const [catalogo, setCatalogo] = useState<VehicleCategoria[]>([]);
  const [catalogoListo, setCatalogoListo] = useState(false);
  const [opciones, setOpciones] = useState<TarifaOpcion[]>([]);
  // Falló el pedido de tarifas (no es lo mismo que "la ruta no tiene tarifa":
  // eso no se avisa, las categorías se ofrecen igual a cotizar).
  const [errorRuta, setErrorRuta] = useState(false);
  const [loading, setLoading] = useState(false);
  // Ruta a la que corresponden las opciones ya cargadas. Sirve para no recotizar
  // con las tarifas de la ruta anterior mientras la nueva está en vuelo.
  const [cotizada, setCotizada] = useState("");
  // Categoría elegida que quedó pendiente de recotizar tras cambiar la ruta.
  const [pendiente, setPendiente] = useState<string | null>(null);
  // Viaje que ya venía con tarifa (edición): se respeta la ruta con la que se
  // guardó en vez de rearmarla. Pasa a false si el backend no sabe cuál era.
  const [rutaFija, setRutaFija] = useState(t.tarifa != null);

  const origen = t.tarifa?.origen ?? "";
  const destino = t.tarifa?.destino ?? "";
  const modalidad = t.tarifa?.modalidad ?? "traslado";
  const horas = t.tarifa?.horas ?? 1;
  const tarifaId = t.tarifa?.tarifaId;
  // El precio sale del tarifario del proveedor que presta el servicio; mientras
  // no haya uno asignado, del general (lo resuelve la API). El proveedor logueado
  // solo ve viajes suyos, así que es siempre el propio.
  const proveedorViaje = t.proveedorId ?? proveedorId ?? "";

  // Catálogo de lugares tarifados. Al entrar, si el viaje ya tiene tarifa pero no
  // sabemos de qué ruta es, se la pedimos al backend. La ruta de un viaje nuevo la
  // arma el efecto de abajo a partir del primer destino.
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
          if (!active) return;
          if (ruta) {
            set({ tarifa: { ...t.tarifa, ...ruta, modalidad } });
            return;
          }
        }
        // No hay ruta guardada que respetar: la arma el primer destino.
        setRutaFija(false);
      })
      .catch(() => {
        /* sin backend/mocks: se queda vacío */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catálogo de categorías de vehículo. No depende de la ruta: es el que permite
  // elegir una categoría aunque no haya tarifa vigente para el tramo.
  useEffect(() => {
    let active = true;
    api
      .listCategoriasTarifa()
      .then((cats) => {
        if (active) setCatalogo(cats);
      })
      .catch(() => {
        /* sin catálogo: solo se ofrecen las categorías que devuelva la cotización */
      })
      .finally(() => {
        if (active) setCatalogoListo(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Tarifas vigentes de la ruta elegida.
  const rutaKey = `${origen}|${destino}|${proveedorViaje}`;
  useEffect(() => {
    if (!origen || !destino) {
      setOpciones([]);
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
        setErrorRuta(false);
      })
      .catch(() => {
        if (!active) return;
        setOpciones([]);
        setErrorRuta(true);
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

  // El proveedor no se elige acá: lo define la tarifa que se elija. Se ven las de
  // todos los que tengan tarifa vigente para la ruta (así se puede cambiar de
  // proveedor eligiendo otra), salvo para el proveedor logueado, que solo ve las
  // suyas.
  const visibles =
    isProvider && proveedorViaje
      ? opciones.filter((o) => o.proveedorId === proveedorViaje)
      : opciones;
  // El cliente nunca ve de qué proveedor es la tarifa.
  const showProveedorEnCard =
    !isAgency && new Set(visibles.map((o) => o.proveedorId)).size > 1;

  // Lo que se ofrece en pantalla: las tarifas de la ruta, y detrás las categorías
  // del catálogo que la ruta no cotiza. Estas últimas se pueden elegir igual (sin
  // precio): el viaje se guarda con la categoría y el costo queda en cero para
  // cargarlo a mano.
  const monedaRuta = visibles.find((o) => o.moneda)?.moneda ?? t.costs.moneda ?? "USD";
  const conTarifa = new Set(visibles.map((o) => o.codigo));
  const cards: TarifaOpcion[] = [
    ...visibles,
    ...catalogo
      .filter((c) => !conTarifa.has(c.codigo))
      .map((c) => opcionSinTarifa(c, monedaRuta)),
  ];
  // Precio de una opción para el rol que está mirando (null = sin tarifa).
  const precioDe = (op: TarifaOpcion) => {
    const p = priceOf(op, modalidad, horas);
    return isProvider ? p.proveedor : p.cliente;
  };
  const elegida = cards.find((o) => o.codigo === t.tarifa?.categoria);
  const elegidaSinTarifa = !!elegida && precioDe(elegida) == null;

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
    const p = priceOf(op, nextModalidad, nextHoras);
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
        // Se pisa SIEMPRE (también con null): al pasar de una categoría tarifada
        // a una sin tarifa, dejar el costo del proveedor anterior sería mentira.
        tarifaProveedor: p.proveedor ?? undefined,
      },
    });
  };

  // Reaplica el precio de la categoría ya elegida (al cambiar modalidad/horas).
  const recommit = (nextModalidad: "traslado" | "horas", nextHoras: number) => {
    const sel = cards.find((o) => o.codigo === t.tarifa?.categoria);
    if (!sel) return;
    commit(sel, nextModalidad, nextHoras);
  };

  // Deja el viaje sin categoría: solo cuando la elegida no existe ni siquiera en
  // el catálogo (no hay nada que volver a marcar).
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

  // Deja la categoría elegida pero sin precio ("a cotizar por el proveedor"): se
  // usa cuando ya no hay ruta contra la cual cotizar. La categoría es una
  // decisión del usuario y no depende del tarifario, así que no se pierde.
  const clearPrecio = (patch: Partial<Trip> = {}) => {
    const c = t.costs;
    set({
      tarifa: { ...t.tarifa, tarifaId: undefined },
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
  // ruta nueva no la cotiza, la categoría SIGUE elegida pero sin precio (queda a
  // cotizar por el proveedor); solo se limpia si no existe ni en el catálogo.
  useEffect(() => {
    if (!pendiente || loading || cotizada !== rutaKey || !catalogoListo) return;
    const op = cards.find((o) => o.codigo === pendiente);
    setPendiente(null);
    if (op) commit(op);
    else clearSeleccion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendiente, loading, cotizada, rutaKey, opciones, catalogoListo]);

  const setRuta = (patch: Partial<NonNullable<typeof t.tarifa>>) => {
    const ruta = { ...t.tarifa, ...patch };
    // Ruta incompleta (todavía sin destinos cargados): no hay contra qué
    // cotizar, así que se cae el precio. La categoría elegida se mantiene: sin
    // tarifa el servicio queda "a cotizar por el proveedor".
    if (!ruta.origen || !ruta.destino) {
      setPendiente(null);
      clearPrecio({ tarifa: { ...ruta, tarifaId: undefined } });
      return;
    }
    // Al cambiar la ruta cambia el precio, pero NO la categoría elegida: la
    // dejamos marcada y la recotizamos cuando lleguen las tarifas de la ruta
    // nueva (efecto de arriba). Mientras tanto se mantiene el precio anterior,
    // así el viaje nunca queda a medio camino sin tarifa.
    setPendiente(t.tarifa?.categoria ?? null);
    set({ tarifa: ruta });
  };

  // Acá no se carga nada: lo que se cotiza sale del PRIMER destino del viaje (paso
  // Destinos). El origen y el destino son los de ese tramo, y la modalidad su tipo
  // de servicio ("Hs disposición" ⇒ horas a disposición, con sus horas). Si el
  // usuario vuelve atrás y los cambia, la cotización los sigue y se recotiza sola.
  const leg0 = t.legs[0];
  const leg0Origen = leg0?.origin;
  const leg0Destino = leg0?.destination;
  const legModalidad: "traslado" | "horas" =
    leg0?.type === "disposicion" ? "horas" : "traslado";
  // En traslado las horas no juegan: se deja lo que ya había para no ensuciar.
  const legHoras = legModalidad === "horas" ? (leg0?.hours ?? horas) : horas;
  // Un viaje ya tarifado conserva la ruta con la que se guardó… hasta que el
  // usuario toca el primer destino: ahí la cotización vuelve a seguirlo.
  const legKey = `${leg0Origen}|${leg0Destino}|${legModalidad}|${legHoras}`;
  const legInicial = useRef(legKey);
  useEffect(() => {
    if (rutaFija && legKey !== legInicial.current) setRutaFija(false);
  }, [legKey, rutaFija]);

  useEffect(() => {
    if (rutaFija || !lugares.length) return;
    const o = leg0Origen ? guessLugar(leg0Origen, lugares) : "";
    const d = leg0Destino ? guessLugar(leg0Destino, lugares) : "";
    if (o !== origen || d !== destino) {
      setRuta({ origen: o, destino: d, modalidad: legModalidad, horas: legHoras });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg0Origen, leg0Destino, lugares, rutaFija, origen, destino]);

  // La modalidad y las horas salen SIEMPRE del primer destino, también al editar:
  // son el tipo de servicio del viaje. Cambiarlas recotiza la categoría elegida
  // (en horas a disposición el precio depende de la cantidad de horas).
  useEffect(() => {
    if (legModalidad === modalidad && legHoras === horas) return;
    patchTarifa({ modalidad: legModalidad, horas: legHoras });
    recommit(legModalidad, legHoras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legModalidad, legHoras, modalidad, horas]);

  return (
    <>
      <h3 className={styles.h2}>Cotización</h3>
      <p className={styles.p}>
        El precio sale del primer destino del viaje.{" "}
        {modalidad === "horas"
          ? `Horas a disposición: la tarifa es el valor de la hora, y la card muestra el total por las ${horas} hs.`
          : ""}{" "}
        Elegí la categoría de vehículo. Montos en dólares (u$s). Las categorías sin tarifa para
        la ruta se pueden elegir igual: quedan a cotizar por el proveedor.
      </p>

      {errs.cat && !t.cat && (
        <div className={styles.catNoPrice} style={{ color: "var(--danger-fg)" }}>
          {errs.cat}
        </div>
      )}

      {/* Estado de la cotización. Nunca reemplaza a las cards: la categoría se
          elige igual, con tarifa o sin ella. Que la ruta no tenga tarifa no se
          avisa acá: cada card ya dice "Servicio a cotizar por el proveedor". */}
      {!origen || !destino ? (
        <div className={styles.catNoPrice}>
          Cargá el origen y el destino en el paso Destinos para ver las tarifas.
        </div>
      ) : loading ? (
        <div className={styles.catNoPrice}>Cargando tarifas…</div>
      ) : errorRuta ? (
        <div className={styles.catNoPrice} style={{ color: "var(--danger-fg)" }}>
          No se pudieron cargar las tarifas de la ruta.
        </div>
      ) : null}

      <div className={styles.catGrid}>
        {cards.map((op) => {
          const p = priceOf(op, modalidad, horas);
          const shown = isProvider ? p.proveedor : p.cliente;
          // Precio unitario de la tarifa (por hora en "horas a disposición"),
          // para que se entienda de dónde sale el total de la card.
          const unit = isProvider ? op.precioProveedor : op.precioCliente;
          // Con backend real la selección es la tarifa concreta (dos proveedores
          // pueden ofrecer la misma categoría); una categoría elegida sin tarifa
          // no tiene id, así que se la reconoce por su código.
          const selected =
            t.tarifa?.categoria === op.codigo &&
            (tarifaId == null || op.tarifaId == null || op.tarifaId === tarifaId);
          return (
            <button
              type="button"
              key={op.tarifaId ?? `${op.proveedorId}-${op.codigo}`}
              className={cx(
                styles.catCard,
                selected && styles.catCardActive,
                shown == null && styles.catCardSinTarifa,
              )}
              onClick={() => commit(op)}
            >
              <span className={cx(styles.catRadio, selected && styles.catRadioOn)} />
              {shown != null ? (
                <>
                  <span className={styles.catPrice}>{shown}</span>
                  <span className={styles.catCurrency}>{op.moneda}</span>
                  <span className={styles.catPeajes}>
                    {modalidad === "horas" ? `(${horas} hs × ${unit})` : "(Incluye peajes)"}
                  </span>
                </>
              ) : (
                <span className={styles.catACotizar}>Servicio a cotizar por el proveedor</span>
              )}
              <span className={styles.catName}>{op.nombre}</span>
              <span className={styles.catVehiculo}>
                {showProveedorEnCard && op.proveedorNombre ? op.proveedorNombre : op.vehiculo}
              </span>
            </button>
          );
        })}
      </div>

      {elegidaSinTarifa && (
        <div className={styles.catNoPrice}>
          {elegida?.nombre}: servicio a cotizar por el proveedor. El viaje se guarda con el costo
          en cero y se carga en el paso Costos.
        </div>
      )}
    </>
  );
}
