const WIDE_LAYOUT_BREAKPOINT = 80;
const HEADER_HEIGHT = 3;
const INPUT_HEIGHT = 4;
const BODY_GAP = 1;
export const uiTheme = {
    colors: {
        accent: "cyanBright",
        border: "gray",
        muted: "gray",
        text: "white",
        user: "cyanBright",
        assistant: "white",
        system: "gray",
        success: "green",
        warning: "yellow"
    }
};
export function calculateTuiLayout(columns, rows) {
    const frameWidth = Math.max(20, columns - 2);
    const bodyHeight = Math.max(10, rows - HEADER_HEIGHT - INPUT_HEIGHT - BODY_GAP);
    if (columns >= WIDE_LAYOUT_BREAKPOINT) {
        const sideWidth = clamp(Math.floor(frameWidth * 0.3), 28, 36);
        const mainWidth = Math.max(20, frameWidth - sideWidth - 1);
        return {
            bodyHeight,
            frameWidth,
            headerHeight: HEADER_HEIGHT,
            inputHeight: INPUT_HEIGHT,
            isWide: true,
            mainHeight: bodyHeight,
            mainWidth,
            sideHeight: bodyHeight,
            sideWidth
        };
    }
    const sideHeight = clamp(Math.floor(bodyHeight * 0.34), 8, 12);
    const mainHeight = Math.max(6, bodyHeight - sideHeight - 1);
    return {
        bodyHeight,
        frameWidth,
        headerHeight: HEADER_HEIGHT,
        inputHeight: INPUT_HEIGHT,
        isWide: false,
        mainHeight,
        mainWidth: frameWidth,
        sideHeight,
        sideWidth: frameWidth
    };
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
