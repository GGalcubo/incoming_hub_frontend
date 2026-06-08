import { useEffect, useState } from "react";

// Devuelve `value` con un retardo: solo se actualiza cuando pasaron `delay` ms
// sin cambios. Útil para no disparar una request por cada tecla en un buscador.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
