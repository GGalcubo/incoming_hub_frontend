import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "./api/client";
import { Topbar } from "./components/Topbar";
import { ExcelUploadModal } from "./components/ExcelUploadModal";
import { STATUSES, TODAY, TOMORROW } from "./data/seed";
import { useModals } from "./context/ModalsContext";
import { useToast } from "./context/ToastContext";
import { useUser } from "./context/UserContext";
import { Login } from "./pages/Login";
import { PassengersList } from "./pages/Passengers";
import { TripWizard } from "./pages/TripWizard";
import { TripsList } from "./pages/TripsList";
import type { Trip, TripStatus } from "./types/domain";
import styles from "./App.module.css";

export function App() {
  const { user } = useUser();
  const { flash } = useToast();
  const { excelOpen, closeExcel } = useModals();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  // Señal para que la lista salte a la fecha de los viajes recién cargados.
  // Objeto nuevo en cada import para forzar el efecto aunque la fecha repita.
  const [dateFocus, setDateFocus] = useState<{ date: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    api
      .listTrips()
      .then((list) => {
        if (!cancelled) setTrips(list);
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
  }, [user, flash]);

  useEffect(() => {
    if (!user) {
      setIsOperator(false);
      return;
    }
    let cancelled = false;
    api
      .getMe()
      .then((me) => {
        if (!cancelled) setIsOperator(me.role !== null && me.role !== "admin");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    flash(
      mode === "new"
        ? `Servicio Guardado #${saved.id}`
        : `Viaje #${saved.id} modificado correctamente`,
      "success",
    );
    return saved;
  };

  // Tras cargar viajes desde el Excel: recargamos la lista para que aparezcan al
  // instante y saltamos a la fecha más temprana de lo cargado (sin tener que
  // cambiar el filtro a mano).
  const onExcelImported = async (n: number, dates: string[]) => {
    const list = await api.listTrips();
    setTrips(list);
    const earliest = dates.filter(Boolean).sort()[0];
    if (earliest) setDateFocus({ date: earliest });
    flash(`${n} viaje${n === 1 ? "" : "s"} creado${n === 1 ? "" : "s"}`, "success");
  };

  const changeStatus = async (t: Trip, est: TripStatus): Promise<Trip> => {
    const updated = await api.setStatus(t.id, est);
    setTrips((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    const label = STATUSES.find((s) => s.id === est)?.label ?? est;
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
              dateFocus={dateFocus}
            />
          }
        />
        <Route path="/viajes/nuevo" element={<NewTripRoute onSave={saveTrip} />} />
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

function TripsListRoute({
  trips,
  loading,
  onChangeStatus,
  isOperator,
  dateFocus,
}: {
  trips: Trip[];
  loading: boolean;
  onChangeStatus: (t: Trip, est: TripStatus) => Promise<Trip>;
  isOperator: boolean;
  dateFocus: { date: string } | null;
}) {
  const navigate = useNavigate();
  const { flash } = useToast();
  const todayCount = trips.filter((t) => t.date === TODAY).length;
  const tomorrowCount = trips.filter((t) => t.date === TOMORROW).length;

  return (
    <>
      <Topbar
        title="Viajes"
        subtitle={
          loading ? "Cargando…" : `${todayCount} para hoy · ${tomorrowCount} para mañana`
        }
      />
      <TripsList
        trips={trips}
        onOpen={(t) => navigate(`/viajes/${t.id}`)}
        onCopy={(msg) => flash(msg)}
        onExport={(msg) => flash(msg)}
        onChangeStatus={onChangeStatus}
        isOperator={isOperator}
        dateFocus={dateFocus}
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
