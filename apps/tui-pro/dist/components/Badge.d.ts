import React from "react";
import type { ProTheme } from "../types.js";
export declare function Badge({ label, tone, value, theme }: {
    label: string;
    theme: ProTheme;
    tone?: "accent" | "error" | "muted" | "secondary" | "success" | "warning";
    value?: string | number;
}): React.JSX.Element;
export declare function toneColor(theme: ProTheme, tone: "accent" | "error" | "muted" | "secondary" | "success" | "warning"): string;
//# sourceMappingURL=Badge.d.ts.map