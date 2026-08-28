// Protocolo de mensajes entre la web (EmpleosAR) y la extensión de
// navegador (empleosar-extension/). La web y la extensión no comparten
// código, así que estos strings deben coincidir con los de los content
// scripts de la extensión.

export const TT_PONG = "trabajoteca:pong";
export const TT_POSTULATE = "trabajoteca:postulate";
export const TT_POSTULATE_SENT = "trabajoteca:postulate-sent";
export const TT_POSTULATE_ERROR = "trabajoteca:postulate-error";
export const TT_APPLIED = "trabajoteca:applied";
export const TT_PORTAL_CLOSED = "trabajoteca:portal-closed";
export const TT_STATUS_APPLIED = "trabajoteca-status-applied";

export interface PostulatePayload {
  jobId: string;
  jobUrl: string;
  cvUrl: string;
  title?: string;
  company?: string;
  source?: string;
}