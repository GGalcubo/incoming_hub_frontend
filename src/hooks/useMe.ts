import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { MeProfile, RoleEnum } from "../api/backend";
import { proveedorIdOf } from "../api/proveedores";
import { useUser } from "../context/UserContext";

// Perfil del usuario logueado, compartido por toda la app vía react-query (una
// sola request por sesión). Expone flags de rol para gatear navegación y vistas.
export interface UseMe {
  me: MeProfile | undefined;
  role: RoleEnum | null;
  isAdmin: boolean;
  isProvider: boolean;
  isAgency: boolean; // agency_staff | agency_operator (el "cliente")
  // Id del proveedor logueado (null para el resto de los roles). Es el "scope"
  // con el que se filtran su tarifario y sus viajes.
  proveedorId: string | null;
  loading: boolean;
}

export function useMe(): UseMe {
  const { user } = useUser();
  // La query va atada a la sesión: sin usuario no se pide el perfil (si no, se
  // cachearía uno anónimo desde el login y el rol quedaría mal), y al cambiar de
  // usuario la clave cambia y se vuelve a pedir.
  const { data, isLoading } = useQuery({
    queryKey: ["me", user?.user ?? null],
    queryFn: () => api.getMe(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const role = data?.role ?? null;
  return {
    me: data,
    role,
    isAdmin: role === "admin",
    isProvider: role === "proveedor",
    isAgency: role === "agency_staff" || role === "agency_operator",
    proveedorId: proveedorIdOf(data),
    loading: !!user && isLoading,
  };
}
