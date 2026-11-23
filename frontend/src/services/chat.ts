import { api } from "./api";

export interface ChatConfig { enabled: boolean; welcome_message: string; suggested_questions: string[] }
export interface ChatReply { session_id: string; reply: string; links: { label: string; url: string }[] }

export const getChatConfig = () => api<ChatConfig>("/chat/config");
export const sendChat = (message: string, session_id?: string) =>
  api<ChatReply>("/chat", { method: "POST", body: JSON.stringify({ message, session_id }) });
