import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "./api/client";
import type { RoleEnum } from "./api/backend";
import { Topbar } from "./components/Topbar";
import { ExcelUploadModal } from "./components/ExcelUploadModal";
import { TODAY, TOMORROW } from "./data/catalogos";
import { useModals } from "./context/ModalsContext";
import { useToast } from "./context/ToastContext";
import { useUser } from "./context/UserContext";
import { useEstados } from "./hooks/useEstados";
import { useMe } from "./hooks/useMe";
import { Login } from "./pages/Login";
import { PassengersList } from "./pages/Passengers";
import { TarifasClientePage, TarifasProveedorPage } from "./pages/Tarifas";
import { TripWizard } from "./pages/TripWizard";
import { TripsList } from "./pages/TripsList";
import type { Trip, TripStatus } from "./types/domain";
import styles from "./App.module.css";

export function App() {
  const { user } = useUser();
  const { flash } = useToast();
  const { excelOpen, closeExcel } = useModals();
  const { role, isProvider, isAgency } = useMe();
  const { metaOf } = useEstados();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  // Vista reducida para todo el que no es admin (operador de agencia y proveedor).
  const isOperator = role != null && role !== "admin";
  // Cada lado del mostrador tiene SU tarifario: la agencia el de cliente (solo
  // lectura), admin y proveedor el de proveedor. Es el destino de /tarifas y al
  // que se manda a quien entre por la puerta que no le toca.
  const tarifasHome = isAgency ? "/tarifas/cliente" : "/tarifas/proveedor";
  // El día y la página que se están mirando viven acá, no en la lista: son lo que
  // se le pide al servidor (antes se bajaban TODOS los viajes y la lista filtraba
  // por fecha en el navegador).
  const [dateFilter, setDateFilter] = useState<string>(TODAY);
  // Filtros que resuelve el servidor. Viven acá, con el día y la página, porque
  // son parte de lo que se le pide a /viajes/: cambiarlos recarga la lista.
  const [estadoFilter, setEstadoFilter] = useState<TripStatus | null>(null);
  const [qViaje, setQViaje] = useState("");
  const [qPasajero, setQPasajero] = useState("");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, pages: 1 });
  const [dayCounts, setDayCounts] = useState({ today: 0, tomorrow: 0 });
  // Se incrementa para forzar una recarga (alta de un viaje, import de Excel).
  const [reloadKey, setReloadKey] = useState(0);

  const verDia = (date: string) => {
    setDateFilter(date);
    setPage(1);
  };

  // Cualquier filtro nuevo vuelve a la página 1: la que se estaba mirando puede
  // no existir en el resultado filtrado.
  const filtrar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    api
      .listTrips({ date: dateFilter, page, estado: estadoFilter, qViaje, qPasajero })
      .then((res) => {
        if (cancelled) return;
        setTrips(res.trips);
        setPageInfo({ count: res.count, pages: res.pages });
        // La página pedida podía estar fuera de rango (se borraron viajes, quedó
        // vieja): la API devuelve cuál sirvió y el estado se acomoda a eso.
        if (res.page !== page) setPage(res.page);
      })
      .catch((err) => {
        if (!cancelled) {
          const detail = err instanceof Error ? err.message : "Error desconocido";
          flash(`No se pudieron cargar los viajes: ${detail}`, "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, flash, dateFilter, page, estadoFilter, qViaje, qPasajero, reloadKey]);

  // Contadores del encabezado. Van aparte de la lista porque son de OTROS días:
  // con la lista paginada por día, "hoy" y "mañana" ya no se pueden contar sobre
  // lo que hay cargado.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([api.countTrips(TODAY), api.countTrips(TOMORROW)])
      .then(([today, tomorrow]) => {
        if (!cancelled) setDayCounts({ today, tomorrow });
      })
      .catch(() => {
        /* los contadores son informativos: si fallan, la lista sigue andando */
      });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  const saveTrip = async (t: Trip, mode: "new" | "edit"): Promise<Trip> => {
    let saved: Trip;
    try {
      saved = mode === "new" ? await api.createTrip(t) : await api.updateTrip(t);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Error desconocido";
      flash(
        mode === "new"
          ? `No se pudo guardar el viaje: ${detail}`
          : `No se pudo modificar el viaje: ${detail}`,
        "error",
      );
      throw err;
    }
    setTrips((prev) =>
      mode === "new" ? [saved, ...prev] : prev.map((x) => (x.id === saved.id ? saved : x)),
    );
    // Un viaje nuevo puede caer en otro día o en otra página: se recarga lo que
    // corresponde al filtro actual en vez de quedarse con el agregado a mano.
    if (mode === "new") setReloadKey((k) => k + 1);
    flash(
      mode === "new"
        ? `Servicio Guardado #${saved.id}`
        : `Viaje #${saved.id} modificado correctamente`,
      "success",
    );
    return saved;
  };

  // Tras cargar viajes desde el Excel: saltamos a la fecha más temprana de lo
  // cargado (sin tener que cambiar el filtro a mano) y recargamos la lista para
  // que aparezcan al instante.
  const onExcelImported = async (n: number, dates: string[]) => {
    const earliest = dates.filter(Boolean).sort()[0];
    if (earliest) verDia(earliest);
    else setPage(1);
    setReloadKey((k) => k + 1);
    flash(`${n} viaje${n === 1 ? "" : "s"} creado${n === 1 ? "" : "s"}`, "success");
  };

  const changeStatus = async (t: Trip, est: TripStatus): Promise<Trip> => {
    const updated = await api.setStatus(t.id, est);
    setTrips((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    const label = metaOf(est)?.label ?? est;
    flash(`Viaje ${updated.id} → ${label}`);
    return updated;
  };

  const cancelTrip = async (t: Trip): Promise<Trip> => {
    const reasonMatch = t.obs.match(/Cancelado: (.+)$/);
    const reason = reasonMatch ? reasonMatch[1] : "Sin motivo";
    const updated = await api.cancelTrip(t.id, reason);
    setTrips((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    flash(`Viaje ${updated.id} cancelado`);
    return updated;
  };

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route
          path="/viajes"
          element={
            <TripsListRoute
              trips={trips}
              loading={loading}
              onChangeStatus={changeStatus}
              isOperator={isOperator}
              estadoFilter={estadoFilter}
              onEstadoChange={filtrar(setEstadoFilter)}
              qViaje={qViaje}
              onQViajeChange={filtrar(setQViaje)}
              qPasajero={qPasajero}
              onQPasajeroChange={filtrar(setQPasajero)}
              dateFilter={dateFilter}
              onDateChange={verDia}
              page={page}
              pages={pageInfo.pages}
              count={pageInfo.count}
              onPageChange={setPage}
              dayCounts={dayCounts}
            />
          }
        />
        {/* El proveedor no crea viajes: solo trabaja sobre los que le asignaron. */}
        <Route
          path="/viajes/nuevo"
          element={
            isProvider ? <Navigate to="/viajes" replace /> : <NewTripRoute onSave={saveTrip} />
          }
        />
        <Route
          path="/viajes/:id"
          element={<EditTripRoute trips={trips} onSave={saveTrip} onCancelTrip={cancelTrip} />}
        />
        <Route
          path="/pasajeros"
          element={
            <>
              <Topbar title="Pasajeros" subtitle="Consulta de pasajeros registrados" />
              <PassengersList />
            </>
          }
        />
        {/* El tarifario de proveedor muestra el costo: la agencia no entra (se la
            manda al suyo). El proveedor ve solo el suyo, sin el precio cliente. */}
        <Route
          path="/tarifas/proveedor"
          element={
            <RoleRoute allow={["admin", "provider"]} redirect={tarifasHome}>
              <TarifasProveedorPage />
            </RoleRoute>
          }
        />
        {/* El tarifario del cliente es la MISMA tabla con la columna cliente y sin
            edición: es para la agencia. Al admin no le hace falta —la de proveedor
            ya le muestra las dos columnas—, así que a él y al proveedor se los
            manda ahí (eso también cubre los links viejos a /tarifas/cliente). */}
        <Route
          path="/tarifas/cliente"
          element={
            <RoleRoute allow={["agency_staff", "agency_operator"]} redirect="/tarifas/proveedor">
              <TarifasClientePage />
            </RoleRoute>
          }
        />
        <Route
          path="/tarifas"
          element={
            <RoleRoute allow={["admin", "provider", "agency_staff", "agency_operator"]}>
              <Navigate to={tarifasHome} replace />
            </RoleRoute>
          }
        />
        <Route path="/login" element={<Navigate to="/viajes" replace />} />
        <Route path="*" element={<Navigate to="/viajes" replace />} />
      </Routes>
      <ExcelUploadModal open={excelOpen} onClose={closeExcel} onConfirm={onExcelImported} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}

// Gateo de ruta por rol, con la misma lista blanca declarativa que la nav del
// Topbar. Mientras el perfil carga no decidimos nada: así el contenido no
// aparece un instante para quien no debería verlo (ni redirigimos de más).
function RoleRoute({
  allow,
  redirect = "/viajes",
  children,
}: {
  allow: RoleEnum[];
  redirect?: string;
  children: React.ReactNode;
}) {
  const { role, loading } = useMe();
  if (loading) return <div className={styles.loading}>Cargando…</div>;
  if (role == null || !allow.includes(role)) return <Navigate to={redirect} replace />;
  return <>{children}</>;
}

function TripsListRoute({
  trips,
  loading,
  onChangeStatus,
  isOperator,
  estadoFilter,
  onEstadoChange,
  qViaje,
  onQViajeChange,
  qPasajero,
  onQPasajeroChange,
  dateFilter,
  onDateChange,
  page,
  pages,
  count,
  onPageChange,
  dayCounts,
}: {
  trips: Trip[];
  loading: boolean;
  onChangeStatus: (t: Trip, est: TripStatus) => Promise<Trip>;
  isOperator: boolean;
  estadoFilter: TripStatus | null;
  onEstadoChange: (est: TripStatus | null) => void;
  qViaje: string;
  onQViajeChange: (q: string) => void;
  qPasajero: string;
  onQPasajeroChange: (q: string) => void;
  dateFilter: string;
  onDateChange: (date: string) => void;
  page: number;
  pages: number;
  count: number;
  onPageChange: (page: number) => void;
  dayCounts: { today: number; tomorrow: number };
}) {
  const navigate = useNavigate();
  const { flash } = useToast();

  return (
    <>
      <Topbar
        title="Viajes"
        subtitle={
          loading
            ? "Cargando…"
            : `${dayCounts.today} para hoy · ${dayCounts.tomorrow} para mañana`
        }
      />
      <TripsList
        trips={trips}
        onOpen={(t) => navigate(`/viajes/${t.id}`)}
        onCopy={(msg) => flash(msg)}
        onExport={(msg) => flash(msg)}
        onChangeStatus={onChangeStatus}
        isOperator={isOperator}
        estadoFilter={estadoFilter}
        onEstadoChange={onEstadoChange}
        qViaje={qViaje}
        onQViajeChange={onQViajeChange}
        qPasajero={qPasajero}
        onQPasajeroChange={onQPasajeroChange}
        dateFilter={dateFilter}
        onDateChange={onDateChange}
        page={page}
        pages={pages}
        count={count}
        onPageChange={onPageChange}
        loading={loading}
      />
    </>
  );
}

function NewTripRoute({ onSave }: { onSave: (t: Trip, mode: "new" | "edit") => Promise<Trip> }) {
  const navigate = useNavigate();
  return (
    <>
      <Topbar title="Nuevo viaje" subtitle="Completá los datos en 4 pasos." />
      <TripWizard
        mode="new"
        onSave={async (t) => {
          await onSave(t, "new");
          navigate("/viajes");
        }}
        onSaveAndNew={async (t) => {
          await onSave(t, "new");
        }}
        onCancel={() => navigate("/viajes")}
      />
    </>
  );
}

function EditTripRoute({
  trips,
  onSave,
  onCancelTrip,
}: {
  trips: Trip[];
  onSave: (t: Trip, mode: "new" | "edit") => Promise<Trip>;
  onCancelTrip: (t: Trip) => Promise<Trip>;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const trip = trips.find((t) => t.id === id);

  if (trips.length === 0) {
    return <div className={styles.loading}>Cargando viaje…</div>;
  }

  if (!trip) {
    return <Navigate to="/viajes" replace state={{ from: location.pathname }} />;
  }

  return (
    <>
      <Topbar
        title={`Editar viaje ${trip.id}`}
        subtitle={`${trip.agc} · ${
          trip.passengers[0]
            ? `${trip.passengers[0].firstName} ${trip.passengers[0].lastName}`.trim() || "—"
            : "—"
        }`}
      />
      <TripWizard
        mode="edit"
        trip={trip}
        onSave={async (t) => {
          await onSave(t, "edit");
          navigate("/viajes");
        }}
        onStepSave={async (t) => {
          await onSave(t, "edit");
        }}
        onCancel={() => navigate("/viajes")}
        onCancelTrip={async (t) => {
          await onCancelTrip(t);
          navigate("/viajes");
        }}
      />
    </>
  );
}
