import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { UserSettingsModal } from "../components/UserSettingsModal";
import { useToast } from "./ToastContext";
import { useUser } from "./UserContext";

interface ModalsContextValue {
  // El modal de Excel lo monta App.tsx (donde vive el estado de viajes), para
  // poder refrescar la lista y saltar a la fecha al terminar el import. Acá solo
  // vive el estado de apertura.
  excelOpen: boolean;
  openExcel: () => void;
  closeExcel: () => void;
  openSettings: () => void;
}

const ModalsContext = createContext<ModalsContextValue | null>(null);

export function ModalsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { flash } = useToast();
  const [excelOpen, setExcelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const value = useMemo<ModalsContextValue>(
    () => ({
      excelOpen,
      openExcel: () => setExcelOpen(true),
      closeExcel: () => setExcelOpen(false),
      openSettings: () => setSettingsOpen(true),
    }),
    [excelOpen],
  );

  return (
    <ModalsContext.Provider value={value}>
      {children}
      <UserSettingsModal
        open={settingsOpen}
        user={user}
        onClose={() => setSettingsOpen(false)}
        onSave={() => flash("Perfil actualizado", "success")}
      />
    </ModalsContext.Provider>
  );
}

export function useModals(): ModalsContextValue {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error("useModals debe usarse dentro de <ModalsProvider>");
  return ctx;
}
