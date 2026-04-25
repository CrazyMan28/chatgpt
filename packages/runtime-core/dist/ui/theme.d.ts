export declare const uiTheme: {
    readonly colors: {
        readonly accent: "cyanBright";
        readonly border: "gray";
        readonly muted: "gray";
        readonly text: "white";
        readonly user: "cyanBright";
        readonly assistant: "white";
        readonly system: "gray";
        readonly success: "green";
        readonly warning: "yellow";
    };
};
export interface TuiLayout {
    bodyHeight: number;
    frameWidth: number;
    headerHeight: number;
    inputHeight: number;
    isWide: boolean;
    mainHeight: number;
    mainWidth: number;
    sideHeight: number;
    sideWidth: number;
}
export declare function calculateTuiLayout(columns: number, rows: number): TuiLayout;
//# sourceMappingURL=theme.d.ts.map