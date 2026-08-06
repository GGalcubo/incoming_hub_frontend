import { useState } from "react";
import { Topbar } from "../../components/Topbar";
import { useMe } from "../../hooks/useMe";
import { cx } from "../../lib/cx";
import { TarifasBase } from "./TarifasBase";
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
// Solo admin y proveedor: la agencia entra por TarifasClientePage (la ruta la
// redirige).
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

// Tarifario del CLIENTE: lo que la agencia paga por cada traslado. NO es otro
// tarifario — es el MISMO (una tarifa por proveedor/ruta/categoría, con los dos
// precios adentro) mirado del otro lado del mostrador: solo la columna cliente,
// solo tarifas vigentes y sin poder tocar nada. El recorte lo hacen
// TarifasBase/TarifasExtras según el rol, no esta pantalla.
//
// Al admin no se la mostramos: su tabla de proveedor ya trae las dos columnas.
// App.tsx manda a admin/proveedor de /tarifas/cliente a /tarifas/proveedor.
export function TarifasClientePage() {
  const me = useMe();

  return (
    <TarifasLayout
      title="Tarifario"
      subtitle="Precios vigentes por destino y extras. Solo consulta."
      base={<TarifasBase me={me} />}
      extras={<TarifasExtras me={me} />}
    />
  );
}

// Lo que esta pantalla NO tiene son los extras POR AGENCIA (espera / hora a
// disposición / km facturados a cada cliente): no existen en el backend, y lo
// único que había era un set guardado en el localStorage del navegador. Los
// extras que se ven acá son los del proveedor, columna cliente.
