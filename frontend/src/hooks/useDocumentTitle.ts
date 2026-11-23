import { useEffect } from "react";

function setMeta(attr: "name" | "property", key: string, value: string) {
  let m = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute(attr, key);
    document.head.appendChild(m);
  }
  m.setAttribute("content", value);
}

/** Sets title, description, canonical and Open Graph tags (for Google, which renders JavaScript).
 *  Link-preview bots that do not run JavaScript are served by the server-side /_meta endpoint. */
export function useDocumentTitle(title?: string, description?: string, image?: string | null) {
  useEffect(() => {
    if (title) { document.title = title; setMeta("property", "og:title", title); }
    if (description) { setMeta("name", "description", description); setMeta("property", "og:description", description); }
    if (image) setMeta("property", "og:image", new URL(image, window.location.origin).href);
    setMeta("property", "og:url", window.location.origin + window.location.pathname);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "canonical"); document.head.appendChild(link); }
    link.setAttribute("href", window.location.origin + window.location.pathname);
  }, [title, description, image]);
}
