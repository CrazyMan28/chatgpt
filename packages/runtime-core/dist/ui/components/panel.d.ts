import type { ReactNode } from "react";
export interface PanelProps {
    children: ReactNode;
    footer?: string;
    height?: number;
    subtitle?: string;
    title: string;
    width?: number;
}
export declare function Panel({ children, footer, height, subtitle, title, width }: PanelProps): React.JSX.Element;
//# sourceMappingURL=panel.d.ts.map