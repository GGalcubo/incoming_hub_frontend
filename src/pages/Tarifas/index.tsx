import { useState } from "react";
import { Topbar } from "../../components/Topbar";
import { useMe } from "../../hooks/useMe";
import { cx } from "../../lib/cx";
import { TarifasBase } from "./TarifasBase";
import { TarifasExtras } from "./TarifasExtras";
import styles from "./Tarifas.module.css";

type Tab = "base" | "extras";

export function TarifasPage() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>("base");

  const subtitle = me.isProvider
    ? "Gestioná tus tarifas base y de extras."
    : me.isAgency
      ? "Consultá las tarifas vigentes."
      : "Tarifas base por destino y extras.";

  return (
    <>
      <Topbar title="Tarifas" subtitle={subtitle} />
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

        {tab === "base" ? <TarifasBase me={me} /> : <TarifasExtras me={me} />}
      </div>
    </>
  );
}
