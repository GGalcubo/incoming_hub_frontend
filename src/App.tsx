import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, setOnUnauthorized } from "./api/client";
import { ExcelUploadModal } from "./components/ExcelUploadModal";
import { Topbar } from "./components/Topbar";
import { UserSettingsModal } from "./components/UserSettingsModal";
import { Toast } from "./components/ui/Toast";
import { TODAY, TOMORROW } from "./data/seed";
import { isExpired } from "./lib/jwt";
import { Login } from "./pages/Login";
import { PassengersList } from "./pages/Passengers";
import { TripWizard } from "./pages/TripWizard";
import { TripsList } from "./pages/TripsList";
import type { Trip, User } from "./types/domain";

const STORAGE_KEY = "proxy:user";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed.token || isExpired(parsed.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function App() {
  const [user, setUser] = useState<User | null>(loadUser);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [toastKind, setToastKind] = useState<"default" | "success">("default");
  const [excelOpen, setExcelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const flash = (m: string, kind: "default" | "success" = "default") => {
    setToast(m);
    setToastKind(kind);
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
    setOnUnauthorized(handleLogout);
  }, []);

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
    flash(
      mode === "new" ? `Servicio Guardado #${saved.id}` : `Servicio Actualizado #${saved.id}`,
      "success",
    );
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
          <Shell>
            <TripsListRoute
              trips={trips}
              loading={loading}
              user={user}
              onLogout={handleLogout}
              onCargarExcel={() => setExcelOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onCopy={() => flash("Tabla copiada al portapapeles")}
              onExport={() => flash("Exportando a Excel…")}
            />
          </Shell>
        }
      />
      <Route
        path="/viajes/nuevo"
        element={
          <Shell>
            <NewTripRoute
              user={user}
              onLogout={handleLogout}
              onCargarExcel={() => setExcelOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onSave={saveTrip}
            />
          </Shell>
        }
      />
      <Route
        path="/viajes/:id"
        element={
          <Shell>
            <EditTripRoute
              trips={trips}
              user={user}
              onLogout={handleLogout}
              onCargarExcel={() => setExcelOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onSave={saveTrip}
              onCancelTrip={cancelTrip}
            />
          </Shell>
        }
      />
      <Route
        path="/pasajeros"
        element={
          <Shell>
            <Topbar
              title="Pasajeros"
              subtitle="Consulta de pasajeros registrados"
              user={user}
              onLogout={handleLogout}
              onCargarExcel={() => setExcelOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <PassengersList trips={trips} loading={loading} />
          </Shell>
        }
      />
      <Route path="/login" element={<Navigate to="/viajes" replace />} />
      <Route path="*" element={<Navigate to="/viajes" replace />} />
    </Routes>
  );

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg-app)",
        }}
      >
        {children}
        <ExcelUploadModal
          open={excelOpen}
          onClose={() => setExcelOpen(false)}
          onConfirm={(n) => flash(`${n} viajes sincronizados con Central`)}
        />
        <UserSettingsModal
          open={settingsOpen}
          user={user}
          onClose={() => setSettingsOpen(false)}
          onSave={() => flash("Preferencias guardadas", "success")}
        />
        <Toast msg={toast} kind={toastKind} />
      </div>
    );
  }
}

interface RouteCommonProps {
  user: User;
  onLogout: () => void;
  onCargarExcel: () => void;
  onOpenSettings: () => void;
}

function TripsListRoute({
  trips,
  loading,
  user,
  onLogout,
  onCargarExcel,
  onOpenSettings,
  onCopy,
  onExport,
}: RouteCommonProps & {
  trips: Trip[];
  loading: boolean;
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
        user={user}
        onLogout={onLogout}
        onCargarExcel={onCargarExcel}
        onOpenSettings={onOpenSettings}
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
  user,
  onLogout,
  onCargarExcel,
  onOpenSettings,
  onSave,
}: RouteCommonProps & {
  onSave: (t: Trip, mode: "new" | "edit") => Promise<Trip>;
}) {
  const navigate = useNavigate();
  return (
    <>
      <Topbar
        title="Nuevo viaje"
        subtitle="Completá los datos en 4 pasos."
        user={user}
        onLogout={onLogout}
        onCargarExcel={onCargarExcel}
        onOpenSettings={onOpenSettings}
      />
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
  user,
  onLogout,
  onCargarExcel,
  onOpenSettings,
  onSave,
  onCancelTrip,
}: RouteCommonProps & {
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
        subtitle={`${trip.agc} · ${
          trip.passengers[0]
            ? `${trip.passengers[0].firstName} ${trip.passengers[0].lastName}`.trim() || "—"
            : "—"
        }`}
        user={user}
        onLogout={onLogout}
        onCargarExcel={onCargarExcel}
        onOpenSettings={onOpenSettings}
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
