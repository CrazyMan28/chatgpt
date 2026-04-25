// src/utils/logger.ts

import { ENV_KEYS } from "./constants.js";

export type LogLevel = "debug" | "info" | "warn" | "error" | "trace";

// Logging backend interface for abstraction
export interface LoggingBackend {
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
  trace(message: string, ...meta: unknown[]): void;
}

// Default console-based logging backend
export class ConsoleLoggingBackend implements LoggingBackend {
  private suppressConsoleError: boolean;

  constructor(suppressConsoleError: boolean = false) {
    this.suppressConsoleError = suppressConsoleError;
  }

  debug(message: string, ...meta: unknown[]): void {
    console.debug(message, ...meta.filter(m => m !== undefined && m !== null));
  }

  info(message: string, ...meta: unknown[]): void {
    console.info(message, ...meta.filter(m => m !== undefined && m !== null));
  }

  warn(message: string, ...meta: unknown[]): void {
    console.warn(message, ...meta.filter(m => m !== undefined && m !== null));
  }

  error(message: string, ...meta: unknown[]): void {
    if (!this.suppressConsoleError) {
      console.error(message, ...meta.filter(m => m !== undefined && m !== null));
    }
  }

  trace(message: string, ...meta: unknown[]): void {
    console.trace(message, ...meta.filter(m => m !== undefined && m !== null));
  }
}

// Main Logger class
export class Logger {
  private logLevel: LogLevel;
  private prefix: string;
  private backend: LoggingBackend;

  // Static priority mapping for log levels
  private static readonly LEVEL_PRIORITIES: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
  };

  // Valid log levels for runtime validation
  public static readonly VALID_LOG_LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error"];

  // Maximum allowed length for the log prefix
  public static readonly MAX_PREFIX_LENGTH = 50;

  constructor(
    logLevel: LogLevel = "info",
    prefix: string = "",
    backend: LoggingBackend = new ConsoleLoggingBackend()
  ) {
    this.logLevel = logLevel;
    this.prefix = this.sanitizePrefix(prefix);
    this.backend = backend;
  }

  public setLogLevel(level: LogLevel): void {
    if (!Logger.VALID_LOG_LEVELS.includes(level)) {
      throw new Error(
        `Invalid log level: ${level}. Valid levels are: ${Logger.VALID_LOG_LEVELS.join(", ")}`
      );
    }
    this.logLevel = level;
  }

  public setPrefix(newPrefix: string): void {
    this.prefix = this.sanitizePrefix(newPrefix);
  }

  public setBackend(newBackend: LoggingBackend): void {
    this.backend = newBackend;
  }

  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  public getPrefix(): string {
    return this.prefix;
  }

  public trace(message: string, ...meta: unknown[]): void {
    if (this.shouldLog("trace")) {
      this.backend.trace(`${this.prefix}${message}`, ...meta.filter(m => m !== undefined && m !== null));
    }
  }

  public debug(message: string, ...meta: unknown[]): void {
    if (this.shouldLog("debug")) {
      this.backend.debug(`${this.prefix}${message}`, ...meta.filter(m => m !== undefined && m !== null));
    }
  }

  public info(message: string, ...meta: unknown[]): void {
    if (this.shouldLog("info")) {
      this.backend.info(`${this.prefix}${message}`, ...meta.filter(m => m !== undefined && m !== null));
    }
  }

  public warn(message: string, ...meta: unknown[]): void {
    if (this.shouldLog("warn")) {
      this.backend.warn(`${this.prefix}${message}`, ...meta.filter(m => m !== undefined && m !== null));
    }
  }

  public error(message: string, ...meta: unknown[]): void {
    if (this.shouldLog("error")) {
      this.backend.error(`${this.prefix}${message}`, ...meta.filter(m => m !== undefined && m !== null));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.LEVEL_PRIORITIES[level] >= Logger.LEVEL_PRIORITIES[this.logLevel];
  }

  /**
   * Sanitizes and validates the log prefix.
   * @param prefix The prefix to sanitize.
   * @returns A sanitized and validated prefix.
   */
  protected sanitizePrefix(prefix: unknown): string {
    return sanitizeString(prefix);
  }

  /**
   * Creates a child logger with a modified prefix.
   * @param suffix The suffix to append to the current prefix.
   * @returns A new Logger instance with the updated prefix.
   */
  public createChildLogger(suffix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix} ${suffix}` : suffix;
    return new Logger(this.logLevel, childPrefix, this.backend);
  }

  /**
   * Updates this logger's log level and prefix from environment variables.
   * Delegates to updateLoggerFromEnv() for consistent environment variable handling.
   */
  public updateFromEnv(): void {
    updateLoggerFromEnv(false, undefined);
  }
}

/**
 * Sanitizes and validates a string input.
 * @param input The input to sanitize.
 * @returns A sanitized and validated string.
 */
export function sanitizeString(input: unknown): string {
  // Handle non-string inputs by converting to string or defaulting to empty string
  if (input === null || input === undefined) {
    return "";
  }
  
  // Explicitly handle ErrorCause objects
  if (
    typeof input === "object" &&
    input !== null &&
    "cause" in input
  ) {
    return `ErrorCause: ${sanitizeString(input.cause)}`;
  }
  
  // Explicitly handle ErrorEvent objects
  if (
    typeof input === "object" &&
    input !== null &&
    "message" in input &&
    "error" in input
  ) {
    return `ErrorEvent: ${input.message || "[No message]"} (Error: ${input.error || "[No error]"})`;
  }
  
  // Explicitly handle Error objects
  if (input instanceof Error) {
    const errorMessage = input.message || input.name || "[Error]";
    // Explicitly include the cause property if it exists
    if (input.cause !== undefined) {
      return `${errorMessage} (Cause: ${sanitizeString(input.cause)})`;
    }
    return errorMessage;
  }
  
  // Explicitly handle boolean
  if (typeof input === "boolean") {
    return input ? "true" : "false";
  }
  
  // Explicitly handle BigInt
  if (typeof input === "bigint") {
    return `BigInt(${input.toString()})`;
  }
  
  // Explicitly handle Date
  if (input instanceof Date) {
    return input.toISOString();
  }
  
  // Explicitly handle RegExp
  if (input instanceof RegExp) {
    return `RegExp(${input.toString()})`;
  }
  
  // Explicitly handle URL
  if (input instanceof URL) {
    return input.toString();
  }
  
  // Explicitly handle WeakMap
  if (input instanceof WeakMap) {
    return "[WeakMap]";
  }
  
  // Explicitly handle WeakSet
  if (input instanceof WeakSet) {
    return "[WeakSet]";
  }
  
  // Explicitly handle WeakRef
  if (input instanceof WeakRef) {
    return "[WeakRef]";
  }
  
  // Explicitly handle FinalizationRegistry
  if (input instanceof FinalizationRegistry) {
    return "[FinalizationRegistry]";
  }
  
  // Explicitly handle Promise
  if (input instanceof Promise) {
    return "[Promise]";
  }
  
  // Explicitly handle ArrayBuffer
  if (input instanceof ArrayBuffer) {
    return `[ArrayBuffer with ${input.byteLength} bytes]`;
  }
  
  // Explicitly handle SharedArrayBuffer
  if (input instanceof SharedArrayBuffer) {
    return `[SharedArrayBuffer with ${input.byteLength} bytes]`;
  }
  
  // Explicitly handle DataView
  if (input instanceof DataView) {
    return `[DataView with ${input.byteLength} bytes]`;
  }
  
  // Explicitly handle typed arrays
  if (input instanceof Int8Array) {
    return `[Int8Array with ${input.length} elements]`;
  }
  
  if (input instanceof Uint8Array) {
    return `[Uint8Array with ${input.length} elements]`;
  }
  
  if (input instanceof Uint8ClampedArray) {
    return `[Uint8ClampedArray with ${input.length} elements]`;
  }
  
  if (input instanceof Int16Array) {
    return `[Int16Array with ${input.length} elements]`;
  }
  
  if (input instanceof Uint16Array) {
    return `[Uint16Array with ${input.length} elements]`;
  }
  
  if (input instanceof Int32Array) {
    return `[Int32Array with ${input.length} elements]`;
  }
  
  if (input instanceof Uint32Array) {
    return `[Uint32Array with ${input.length} elements]`;
  }
  
  if (input instanceof Float32Array) {
    return `[Float32Array with ${input.length} elements]`;
  }
  
  if (input instanceof Float64Array) {
    return `[Float64Array with ${input.length} elements]`;
  }
  
  // Explicitly handle functions and symbols
  if (typeof input === "function") {
    return "[Function]";
  }
  
  if (typeof input === "symbol") {
    return "[Symbol]";
  }
  
  // Explicitly handle Map and Set
  if (input instanceof Map) {
    return `[Map with ${input.size} entries]`;
  }
  
  if (input instanceof Set) {
    return `[Set with ${input.size} entries]`;
  }
  
  // Explicitly handle Array
  if (Array.isArray(input)) {
    return `[Array with ${input.length} elements]`;
  }
  
  // Explicitly handle Blob
  if (
    typeof Blob !== "undefined" &&
    input instanceof Blob
  ) {
    return `[Blob with type: ${input.type} and size: ${input.size} bytes]`;
  }
  
  // Explicitly handle File
  if (
    typeof File !== "undefined" &&
    input instanceof File
  ) {
    return `[File with name: ${input.name}, type: ${input.type}, and size: ${input.size} bytes]`;
  }
  
  // Explicitly handle ReadableStream
  if (
    typeof ReadableStream !== "undefined" &&
    input instanceof ReadableStream
  ) {
    return `[ReadableStream]`;
  }
  
  // Explicitly handle WebAssembly.Module
  if (
    typeof WebAssembly !== "undefined" &&
    input instanceof WebAssembly.Module
  ) {
    return `[WebAssembly.Module]`;
  }
  
  // Explicitly handle WebAssembly.Memory
  if (
    typeof WebAssembly !== "undefined" &&
    input instanceof WebAssembly.Memory
  ) {
    return `[WebAssembly.Memory with ${input.buffer.byteLength} bytes]`;
  }
  
  // Explicitly handle FormData
  if (
    typeof FormData !== "undefined" &&
    input instanceof FormData
  ) {
    return `[FormData]`;
  }
  
  // Explicitly handle objects
  if (typeof input === "object") {
    try {
      return JSON.stringify(input);
    } catch (error) {
      return "[unserializable object]";
    }
  }

  const sanitized = String(input);
  // Trim whitespace and limit length
  const trimmed = sanitized.trim().substring(0, Logger.MAX_PREFIX_LENGTH);
  // Replace non-printable characters with a space
  return trimmed.replace(/[^\x20-\x7E]/g, " ");
}

// Default logger instance with console backend
const logLevel = (process.env[ENV_KEYS.LOG_LEVEL] as LogLevel) || "info";
const logPrefix = process.env[ENV_KEYS.LOG_PREFIX] || "";
const suppressConsoleError = process.env[ENV_KEYS.SUPPRESS_CONSOLE_ERROR] === "true";

export const logger = new Logger(logLevel, logPrefix, new ConsoleLoggingBackend(suppressConsoleError));

/**
 * Validates if the provided customBackend fully implements the LoggingBackend interface.
 * @param customBackend The backend to validate.
 * @returns True if the backend is valid, false otherwise.
 */
export function isValidLoggingBackend(customBackend: unknown): customBackend is LoggingBackend {
  if (!customBackend || typeof customBackend !== 'object') {
    return false;
  }

  const requiredMethods: Array<keyof LoggingBackend> = ['debug', 'info', 'warn', 'error', 'trace'];
  return requiredMethods.every(method => {
    return typeof (customBackend as LoggingBackend)[method] === 'function';
  });
}

/**
 * Validates that the suppressConsoleError parameter is a boolean.
 * @param suppressConsoleError The parameter to validate.
 * @returns A validated boolean value.
 */
export function validateSuppressConsoleError(suppressConsoleError: unknown): boolean {
  return typeof suppressConsoleError === 'boolean' ? suppressConsoleError : false;
}

/**
 * Updates the default logger's log level, prefix, and backend from environment variables.
 * Useful for runtime configuration changes.
 * 
 * @param suppressConsoleError If true, suppresses redundant console.error logging when the logger backend is console-based.
 * @param customBackend If provided, uses this backend when LOG_BACKEND is set to "custom".
 */
export function updateLoggerFromEnv(
  suppressConsoleError: boolean = false,
  customBackend?: LoggingBackend
): void {
  // Validate suppressConsoleError
  const validatedSuppressConsoleError = validateSuppressConsoleError(suppressConsoleError);

  // Validate LOG_BACKEND before applying
  const validBackends = ["console", "custom"];
  const logBackend = process.env.LOG_BACKEND ? process.env.LOG_BACKEND.toLowerCase() : undefined;

  if (logBackend && !validBackends.includes(logBackend)) {
    logger.error(
      `Invalid LOG_BACKEND: ${process.env.LOG_BACKEND}. ` +
      `Valid backends: ${validBackends.join(", ")}. ` +
      `Using current backend: ${logger["backend"]}.`
    );
  }
  else {
    // Update log backend if LOG_BACKEND is specified
    if (logBackend === "console") {
      logger.setBackend(new ConsoleLoggingBackend(validatedSuppressConsoleError));
    } else if (logBackend === "custom") {
      if (!customBackend) {
        logger.error(
          `LOG_BACKEND is set to 'custom' but no customBackend is provided. Using current backend: ${logger["backend"]}.`
        );
      } else {
        // Validate customBackend before applying
        if (!isValidLoggingBackend(customBackend)) {
          logger.error(
            `Invalid customBackend: Must implement LoggingBackend interface. Using current backend: ${logger["backend"]}.`
          );
        } else {
          logger.setBackend(customBackend);
        }
      }
    }
  }

  // Validate LOG_LEVEL before applying
  if (process.env[ENV_KEYS.LOG_LEVEL]) {
    const newLogLevel = process.env[ENV_KEYS.LOG_LEVEL] as LogLevel;
    if (Logger.VALID_LOG_LEVELS.includes(newLogLevel)) {
      logger.setLogLevel(newLogLevel);
    } else {
      logger.error(
        `Invalid ${ENV_KEYS.LOG_LEVEL}: ${process.env[ENV_KEYS.LOG_LEVEL]}. ` +
        `Valid levels: ${Logger.VALID_LOG_LEVELS.join(", ")}. ` +
        `Using current level: ${logger.getLogLevel()}.`
      );
    }
  }

  const newLogPrefix = sanitizeString(
    process.env[ENV_KEYS.LOG_PREFIX] || logger.getPrefix()
  );
  logger.setPrefix(newLogPrefix);
}
