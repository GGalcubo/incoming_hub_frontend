import { useState } from "react";
import { Topbar } from "../../components/Topbar";
import { useMe } from "../../hooks/useMe";
import { cx } from "../../lib/cx";
import { TarifasBase } from "./TarifasBase";
import { TarifasClienteBase } from "./TarifasClienteBase";
import { TarifasClienteExtras } from "./TarifasClienteExtras";
import { TarifasExtras } from "./TarifasExtras";
import styles from "./Tarifas.module.css";

type Tab = "base" | "extras";

// Layout compartido por los dos tarifarios (proveedor y cliente): mismo header,
// mismas dos solapas. Lo único que cambia es qué tablas se renderizan.
function TarifasLayout({
  title,
  subtitle,
  base,
  extras,
}: {
  title: string;
  subtitle: string;
  base: React.ReactNode;
  extras: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("base");

  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <div className={styles.page}>
        <div className={styles.tabs}>
          <button
            className={cx(styles.tab, tab === "base" && styles.tabActive)}
            onClick={() => setTab("base")}
          >
            Tarifas por destino
          </button>
          <button
            className={cx(styles.tab, tab === "extras" && styles.tabActive)}
            onClick={() => setTab("extras")}
          >
            Extras
          </button>
        </div>

        {tab === "base" ? base : extras}
      </div>
    </>
  );
}

// Tarifario de PROVEEDOR: lo que cuesta cada traslado según quién lo presta.
// Solo admin y proveedor: la agencia no llega acá (la ruta la redirige).
export function TarifasProveedorPage() {
  const me = useMe();

  const subtitle = me.isProvider
    ? "Gestioná tus tarifas base y de extras."
    : "Tarifas base por destino y extras, por proveedor.";

  return (
    <TarifasLayout
      title="Tarifas Proveedor"
      subtitle={subtitle}
      base={<TarifasBase me={me} />}
      extras={<TarifasExtras me={me} />}
    />
  );
}

// Tarifario de CLIENTE: lo que se le factura a cada agencia. Solo admin; ni el
// proveedor ni la propia agencia llegan acá (la ruta los redirige).
export function TarifasClientePage() {
  const me = useMe();

  return (
    <TarifasLayout
      title="Tarifas Cliente"
      subtitle="Tarifas base por destino y extras, por cliente."
      base={<TarifasClienteBase me={me} />}
      extras={<TarifasClienteExtras me={me} />}
    />
  );
}
