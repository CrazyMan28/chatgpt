import { createContext, useContext } from "react";

import type { FilesystemScope } from "../platform/types.js";
import type { ModelRuntimeSnapshot } from "../providers/provider-types.js";

export interface AppRuntimeState {
  cwd: string;
  isLoggedIn: boolean;
  loginLabel: string;
  model: string;
  projectLabel: string;
  provider: string;
  providerLabel: string;
  scope: FilesystemScope;
}

const AppRuntimeStateContext = createContext<AppRuntimeState | undefined>(
  undefined
);

export const AppRuntimeStateProvider = AppRuntimeStateContext.Provider;

export function useAppRuntimeState(): AppRuntimeState {
  const value = useContext(AppRuntimeStateContext);

  if (!value) {
    throw new Error("AppRuntimeStateProvider is missing.");
  }

  return value;
}

export function toAppRuntimeState(
  snapshot: ModelRuntimeSnapshot,
  options?: {
    cwd?: string;
    projectLabel?: string;
    scope?: FilesystemScope;
  }
): AppRuntimeState {
  return {
    cwd: options?.cwd ?? ".",
    isLoggedIn: snapshot.isAuthenticated,
    loginLabel: snapshot.loginLabel,
    model: snapshot.model,
    projectLabel: options?.projectLabel ?? "workspace",
    provider: snapshot.provider,
    providerLabel: snapshot.providerLabel,
    scope: options?.scope ?? "workspace"
  };
}
