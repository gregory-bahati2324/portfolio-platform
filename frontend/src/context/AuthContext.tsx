import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ApiError } from "@/services/api";
import * as admin from "@/services/admin";
import type { AdminUser } from "@/types/admin";

interface Ctx { user: AdminUser | null; loading: boolean; signOut: () => Promise<void> }
const AuthCtx = createContext<Ctx>({ user: null, loading: true, signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  // Ordinary visitors never need a session check, so only admin pages ask the server who is signed in.
  const isAdminArea = useLocation().pathname.startsWith("/admin");
  const { data, isPending } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try { return await admin.me(); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
    },
    retry: false, staleTime: 60_000, enabled: isAdminArea,
  });
  const signOut = async () => {
    try {
      await admin.logout();
    } finally {
      // Mark the session as ended first so the UI leaves the dashboard at once, then drop every cached
      // admin response so nothing from the signed-in session lingers in memory.
      qc.setQueryData(["auth", "me"], null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    }
  };
  return <AuthCtx.Provider value={{ user: data ?? null, loading: isAdminArea && isPending, signOut }}>{children}</AuthCtx.Provider>;
}
