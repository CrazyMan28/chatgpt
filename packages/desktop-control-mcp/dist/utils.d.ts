export interface CommandResult {
    code: number | null;
    command: string;
    stderr: string;
    stdout: string;
}
export declare function runCommand(command: string, args?: readonly string[], options?: {
    env?: NodeJS.ProcessEnv;
    input?: string;
    timeoutMs?: number;
}): Promise<CommandResult>;
export declare function runShell(command: string, options?: {
    input?: string;
    timeoutMs?: number;
}): Promise<CommandResult>;
export declare function commandExists(command: string): Promise<boolean>;
export declare function listAvailableCommands(commands: readonly string[]): Promise<string[]>;
export declare function firstAvailable(commands: readonly string[]): Promise<string | undefined>;
export declare function readString(value: unknown, key: string): string;
export declare function readOptionalString(value: unknown): string | undefined;
export declare function readBoolean(value: unknown, fallback: boolean): boolean;
export declare function readNumber(value: unknown, key: string): number;
export declare function readStringArray(value: unknown): string[];
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function delay(ms: number): Promise<void>;
export declare function truncate(value: string, maxLength: number): string;
export declare function shellQuote(value: string): string;
export declare function formatCommand(command: string, args: readonly string[]): string;
export declare function hashFile(path: string): Promise<string | undefined>;
//# sourceMappingURL=utils.d.ts.map