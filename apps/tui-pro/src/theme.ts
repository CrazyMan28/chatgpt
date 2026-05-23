import type { ProTheme, ProThemeName } from "./types.js";

export const THEMES: Record<ProThemeName, ProTheme> = {
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

export function getTheme(name: ProThemeName): ProTheme {
  return THEMES[name] ?? THEMES.cyber;
}

