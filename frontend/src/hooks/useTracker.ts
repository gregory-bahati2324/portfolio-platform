import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/services/api";

const optedOut = () => navigator.doNotTrack === "1" || (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

function send(body: Record<string, unknown>) {
  if (optedOut()) return;
  api("/analytics/event", { method: "POST", body: JSON.stringify(body) }).catch(() => { /* analytics must never affect the page */ });
}

/** Cookie-free page-view tracking. The server also honours DNT/GPC and ignores bots. */
export function usePageViewTracking() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    send({ type: "page_view", path: pathname, referrer: document.referrer || undefined });
  }, [pathname]);
}

export const trackProjectView = (slug: string) => send({ type: "project_view", path: `/projects/${slug}`, slug });
