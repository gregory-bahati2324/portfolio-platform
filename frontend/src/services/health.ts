import { api } from "./api";

export interface Health {
  status: string;
  database?: string;
}

export const getHealth = () => api<Health>("/health");
export const getReadiness = () => api<Health>("/health/ready");
