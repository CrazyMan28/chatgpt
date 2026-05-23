import * as React from "react";
import type { ReactNode } from "react";
import { getTuiThemeColors } from "../theme.js";
import type { TuiThemeName } from "../types.js";
export type UiTone = "accent" | "secondary" | "success" | "warning" | "error" | "muted" | "text";
export interface StatusBadgeDescriptor {
    active?: boolean;
    label: string;
    tone?: UiTone;
}
export interface StatusBadge extends StatusBadgeDescriptor {
}
export interface StatusBadgeProps extends StatusBadgeDescriptor {
    themeName: TuiThemeName;
}
export declare function StatusBadge({ active, label, themeName, tone }: StatusBadgeProps): React.JSX.Element;
export declare const Badge: typeof StatusBadge;
export declare function BadgeStrip({ badges, themeName, width }: {
    badges: readonly StatusBadgeDescriptor[];
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function StatusBar({ badges, themeName }: {
    badges: readonly StatusBadgeDescriptor[];
    themeName: TuiThemeName;
}): React.JSX.Element;
export declare function Divider({ themeName, width }: {
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function InspectorSection({ children, title, themeName }: {
    children: ReactNode;
    title: string;
    themeName: TuiThemeName;
}): React.JSX.Element;
export declare function InspectorTabs({ active, tabs, themeName, width }: {
    active: string;
    tabs: readonly string[];
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare const PanelTabs: typeof InspectorTabs;
export declare function DataRow({ label, tone, value, width, themeName }: {
    label: string;
    tone?: UiTone;
    value: string;
    width: number;
    themeName: TuiThemeName;
}): React.JSX.Element;
export declare const ProgressRow: typeof DataRow;
export declare function KeyHintBar({ hints, themeName, width }: {
    hints: readonly string[];
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare const FooterHints: typeof KeyHintBar;
export declare function EmptyState({ detail, title, themeName, width }: {
    detail?: string;
    title: string;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function TaskRow({ currentStep, id, state, themeName, title, width }: {
    currentStep?: string;
    id: string;
    state: string;
    themeName: TuiThemeName;
    title: string;
    width: number;
}): React.JSX.Element;
export declare function TaskSummary({ age, id, state, themeName, title, width }: {
    age?: string;
    id: string;
    state: string;
    themeName: TuiThemeName;
    title: string;
    width: number;
}): React.JSX.Element;
export declare function ApprovalRow({ action, id, scope, task, themeName, width }: {
    action: string;
    id: string;
    scope: string;
    task?: string;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function ApprovalSummary({ id, scope, summary, themeName, width }: {
    id: string;
    scope: string;
    summary: string;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function FleetRow({ blockerCount, id, role, state, task, themeName, width }: {
    blockerCount: number;
    id: string;
    role: string;
    state: string;
    task: string;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function McpRow({ health, name, status, themeName, transport, width }: {
    health: string;
    name: string;
    status: string;
    themeName: TuiThemeName;
    transport: string;
    width: number;
}): React.JSX.Element;
export declare function shortenPath(value: string, width?: number): string;
export declare function truncate(value: string, width: number): string;
export declare function toneToColor(colors: ReturnType<typeof getTuiThemeColors>, tone: UiTone): string;
//# sourceMappingURL=chrome.d.ts.map