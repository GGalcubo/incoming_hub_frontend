import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/Field";
import type { TripComentario } from "../../../types/domain";
import styles from "./steps.module.css";

// De qué lado del mostrador vino el comentario. El código lo manda el backend en
// `autor_rol`; si viene vacío o con uno que no conocemos, la chapita se dibuja
// con el código crudo antes que mentir con una etiqueta linda.
const ROL_LABEL: Record<string, string> = {
  admin: "Administración",
  provider: "Proveedor",
  // Comentarios viejos guardados cuando el rol se llamaba "proveedor".
  proveedor: "Proveedor",
  agency_staff: "Agencia",
  agency_operator: "Agencia",
};

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Comentarios del viaje: todos los roles los ven y todos pueden agregar.
export function TripComentarios({ tripId }: { tripId: string }) {
  const [list, setList] = useState<TripComentario[] | null>(null);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .listComentarios(tripId)
      .then((c) => {
        if (active) setList(c);
      })
      .catch(() => {
        if (active) setList([]);
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  const enviar = async () => {
    if (!texto.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const nuevo = await api.addComentario(tripId, texto);
      setList((prev) => [...(prev ?? []), nuevo]);
      setTexto("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el comentario.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.comments}>
      <div className={styles.commentsHead}>
        <span>Comentarios</span>
        <span className={styles.commentsCount}>{list?.length ?? 0}</span>
      </div>

      {list === null ? (
        <div className={styles.commentsEmpty}>Cargando comentarios…</div>
      ) : list.length === 0 ? (
        <div className={styles.commentsEmpty}>Sin comentarios todavía.</div>
      ) : (
        list.map((c) => (
          <div key={c.id} className={styles.comment}>
            <div className={styles.commentHead}>
              <span className={styles.commentAutor}>{c.autor}</span>
              {c.rol && <span className={styles.commentRol}>{ROL_LABEL[c.rol] ?? c.rol}</span>}
              <span className={styles.commentFecha}>{fmtFecha(c.fecha)}</span>
            </div>
            <div className={styles.commentText}>{c.texto}</div>
          </div>
        ))
      )}

      <div className={styles.commentForm}>
        <Textarea
          className={styles.commentInput}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Agregar un comentario..."
          rows={2}
        />
        <Button kind="primary" disabled={!texto.trim() || sending} onClick={enviar}>
          {sending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
      {error && <div className={styles.commentError}>{error}</div>}
    </div>
  );
}
