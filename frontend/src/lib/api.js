import axios from "axios";

// Rimuove eventuali slash finali dalla variabile d'ambiente per sicurezza
const rawUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
export const BACKEND_URL = rawUrl.replace(/\/$/, ""); 

export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export function wsUrl(code, role, id = "") {
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}/api/ws/${code}?role=${role}&id=${encodeURIComponent(id)}`;
}

export function fileUrl(storagePath) {
  return `${API}/files/${storagePath}`;
}
