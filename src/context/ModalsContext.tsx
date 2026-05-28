import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ExcelUploadModal } from "../components/ExcelUploadModal";
import { UserSettingsModal } from "../components/UserSettingsModal";
import { useToast } from "./ToastContext";
import { useUser } from "./UserContext";

interface ModalsContextValue {
  openExcel: () => void;
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
      openExcel: () => setExcelOpen(true),
      openSettings: () => setSettingsOpen(true),
    }),
    [],
  );

  return (
    <ModalsContext.Provider value={value}>
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
