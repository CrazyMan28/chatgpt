import React from "react";
import type { ProCommand, ProTheme } from "../types.js";
export declare const COMMANDS: readonly ProCommand[];
export declare function CommandPalette({ onQueryChange, onSubmit, query, theme, width }: {
    onQueryChange: (value: string) => void;
    onSubmit: (command: string) => void;
    query: string;
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
//# sourceMappingURL=CommandPalette.d.ts.map