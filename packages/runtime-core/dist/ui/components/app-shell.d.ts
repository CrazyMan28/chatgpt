import * as React from "react";
import type { ReactNode } from "react";
import type { TuiThemeName } from "../types.js";
export interface AppShellProps {
    footer: ReactNode;
    height: number;
    inspector?: ReactNode;
    inspectorWidth: number;
    isWide: boolean;
    main: ReactNode;
    mainHeight: number;
    mainWidth: number;
    themeName: TuiThemeName;
    topBar: ReactNode;
}
export declare function AppShell({ footer, height, inspector, inspectorWidth, isWide, main, mainHeight, mainWidth, topBar }: AppShellProps): React.JSX.Element;
//# sourceMappingURL=app-shell.d.ts.map