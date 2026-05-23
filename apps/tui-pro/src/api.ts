import { DaemonClient } from "@chatgpt-code/client-sdk";

export function createProDaemonClient(): DaemonClient {
  return new DaemonClient({
    baseUrl: (process.env.CHATGPT_CODE_API_URL?.trim() || "http://127.0.0.1:4017").replace(/\/$/, "")
  });
}

export async function optional<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

