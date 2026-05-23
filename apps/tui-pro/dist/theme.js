export const THEMES = {
    cyber: {
        accent: "cyan",
        background: "black",
        border: "cyan",
        borderDim: "gray",
        error: "red",
        muted: "gray",
        secondary: "magenta",
        success: "green",
        text: "white",
        warning: "yellow"
    },
    minimal: {
        accent: "blue",
        background: "black",
        border: "gray",
        borderDim: "gray",
        error: "red",
        muted: "gray",
        secondary: "cyan",
        success: "green",
        text: "white",
        warning: "yellow"
    },
    compact: {
        accent: "cyan",
        background: "black",
        border: "blue",
        borderDim: "gray",
        error: "red",
        muted: "gray",
        secondary: "magenta",
        success: "green",
        text: "white",
        warning: "yellow"
    }
};
export function getTheme(name) {
    return THEMES[name] ?? THEMES.cyber;
}
//# sourceMappingURL=theme.js.map