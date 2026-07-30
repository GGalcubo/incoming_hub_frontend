import styles from "./Tarifas.module.css";

// Cartel para lo que TODAVÍA no persiste en el backend. Hoy solo lo usan las dos
// solapas de Extras (espera / hora a disposición / km): el backend no las modela
// —no tiene km, ni columna cliente, ni endpoint para escribirlas—, así que se
// guardan en localStorage y se pierden al cambiar de navegador o de máquina.
// El resto del tarifario ya es real (ver api/tarifasCrud.ts).
export function AvisoMock({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.mockNotice} role="status">
      <span className={styles.mockNoticeTitle}>Datos de demo</span>
      <span>{children}</span>
    </div>
  );
}
