import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { HAS_BACKEND } from "../../../api/http";
import { AvisoMock } from "../../../components/ui/AvisoMock";
import { Button } from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/Field";
import type { TripComentario } from "../../../types/domain";
import styles from "./steps.module.css";

// De qué lado del mostrador vino el comentario. Solo lo tienen los comentarios
// del modo mock, que guardan el rol del autor; el backend devuelve el nombre
// pero NO el rol, así que ahí la chapita no se muestra (preferimos eso a
// deducirla mal). Si hace falta, hay que pedirle al backend que lo exponga.
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

      {/* Con backend los comentarios son reales (cuelgan del costo del viaje).
          Sin él siguen viviendo en el localStorage de este navegador, así que el
          otro lado del mostrador no los ve: hay que avisarlo. */}
      {!HAS_BACKEND && (
        <AvisoMock>
          Los comentarios se guardan solo en este navegador: el resto del equipo no los ve y se
          pierden al cambiar de equipo o borrar los datos del sitio.
        </AvisoMock>
      )}

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
