import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "./api/client";
import { ExcelUploadModal } from "./components/ExcelUploadModal";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Button } from "./components/ui/Button";
import { Toast } from "./components/ui/Toast";
import { TODAY, TOMORROW } from "./data/seed";
import { Login } from "./pages/Login";
import { PassengersList } from "./pages/Passengers";
import { TripWizard } from "./pages/TripWizard";
import { TripsList } from "./pages/TripsList";
import type { Trip, User } from "./types/domain";

const STORAGE_KEY = "proxy:user";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [user, setUser] = useState<User | null>(loadUser);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [excelOpen, setExcelOpen] = useState(false);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    api.listTrips().then((list) => {
      if (!cancelled) {
        setTrips(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveTrip = async (t: Trip, mode: "new" | "edit"): Promise<Trip> => {
    const saved = mode === "new" ? await api.createTrip(t) : await api.updateTrip(t);
    setTrips((prev) =>
      mode === "new" ? [saved, ...prev] : prev.map((x) => (x.id === saved.id ? saved : x)),
    );
    flash(mode === "new" ? `Viaje ${saved.id} creado` : `Viaje ${saved.id} actualizado`);
    return saved;
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
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/viajes"
        element={
          <Shell view="trips" user={user} onLogout={handleLogout}>
            <TripsListRoute
              trips={trips}
              loading={loading}
              onCargarExcel={() => setExcelOpen(true)}
              onCopy={() => flash("Tabla copiada al portapapeles")}
              onExport={() => flash("Exportando a Excel…")}
            />
            <ExcelUploadModal
              open={excelOpen}
              onClose={() => setExcelOpen(false)}
              onConfirm={(n) => flash(`${n} viajes sincronizados con Central`)}
            />
          </Shell>
        }
      />
      <Route
        path="/viajes/nuevo"
        element={
          <Shell view="new" user={user} onLogout={handleLogout}>
            <NewTripRoute onSave={saveTrip} />
          </Shell>
        }
      />
      <Route
        path="/viajes/:id"
        element={
          <Shell view="trips" user={user} onLogout={handleLogout}>
            <EditTripRoute trips={trips} onSave={saveTrip} onCancelTrip={cancelTrip} />
          </Shell>
        }
      />
      <Route
        path="/pasajeros"
        element={
          <Shell view="passengers" user={user} onLogout={handleLogout}>
            <Topbar title="Pasajeros" subtitle="Consulta de pasajeros registrados" />
            <PassengersList trips={trips} loading={loading} />
          </Shell>
        }
      />
      <Route path="/login" element={<Navigate to="/viajes" replace />} />
      <Route path="*" element={<Navigate to="/viajes" replace />} />
    </Routes>
  );

  function Shell({
    view,
    user,
    onLogout,
    children,
  }: {
    view: "trips" | "new" | "passengers";
    user: User;
    onLogout: () => void;
    children: React.ReactNode;
  }) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg-app)",
        }}
      >
        <Sidebar view={view} user={user} onLogout={onLogout} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
        <Toast msg={toast} />
      </div>
    );
  }
}

function TripsListRoute({
  trips,
  loading,
  onCargarExcel,
  onCopy,
  onExport,
}: {
  trips: Trip[];
  loading: boolean;
  onCargarExcel: () => void;
  onCopy: () => void;
  onExport: () => void;
}) {
  const navigate = useNavigate();
  const todayCount = trips.filter((t) => t.date === TODAY).length;
  const tomorrowCount = trips.filter((t) => t.date === TOMORROW).length;

  return (
    <>
      <Topbar
        title="Viajes"
        subtitle={
          loading
            ? "Cargando…"
            : `${todayCount} para hoy · ${tomorrowCount} para mañana`
        }
        actions={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Button kind="primary" icon="upload" onClick={onCargarExcel}>
              Cargar Excel
            </Button>
            <Button kind="primary" icon="plus" onClick={() => navigate("/viajes/nuevo")}>
              Nuevo viaje
            </Button>
          </div>
        }
      />
      <TripsList
        trips={trips}
        onOpen={(t) => navigate(`/viajes/${t.id}`)}
        onCopy={onCopy}
        onExport={onExport}
      />
    </>
  );
}

function NewTripRoute({
  onSave,
}: {
  onSave: (t: Trip, mode: "new" | "edit") => Promise<Trip>;
}) {
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
    return (
      <div style={{ padding: 28, color: "var(--fg-muted)" }}>
        Cargando viaje…
      </div>
    );
  }

  if (!trip) {
    return (
      <Navigate
        to="/viajes"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return (
    <>
      <Topbar
        title={`Editar viaje ${trip.id}`}
        subtitle={`${trip.agc} · ${trip.passengers[0]?.name ?? "—"}`}
      />
      <TripWizard
        mode="edit"
        trip={trip}
        onSave={async (t) => {
          await onSave(t, "edit");
          navigate("/viajes");
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
