import * as React from "react";
import type { TuiThemeName } from "../types.js";
export interface CommandPaletteItem {
    category: string;
    command: string;
    description: string;
    insertOnly?: boolean;
}
export interface CommandPaletteProps {
    height: number;
    items: readonly CommandPaletteItem[];
    query: string;
    selectedIndex: number;
    themeName: TuiThemeName;
    width: number;
}
export declare function CommandPalette({ height, items, query, selectedIndex, themeName, width }: CommandPaletteProps): React.JSX.Element;
//# sourceMappingURL=command-palette.d.ts.map