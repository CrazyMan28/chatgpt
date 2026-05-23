import { DaemonClient } from "@chatgpt-code/client-sdk";
export function createProDaemonClient() {
    return new DaemonClient({
        baseUrl: (process.env.CHATGPT_CODE_API_URL?.trim() || "http://127.0.0.1:4017").replace(/\/$/, "")
    });
}
export async function optional(load, fallback) {
    try {
        return await load();
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=api.js.map