import { createContext, useContext } from "react";
const AppRuntimeStateContext = createContext(undefined);
export const AppRuntimeStateProvider = AppRuntimeStateContext.Provider;
export function useAppRuntimeState() {
    const value = useContext(AppRuntimeStateContext);
    if (!value) {
        throw new Error("AppRuntimeStateProvider is missing.");
    }
    return value;
}
export function toAppRuntimeState(snapshot) {
    return {
        isLoggedIn: snapshot.isAuthenticated,
        loginLabel: snapshot.loginLabel,
        model: snapshot.model,
        provider: snapshot.provider,
        providerLabel: snapshot.providerLabel
    };
}
