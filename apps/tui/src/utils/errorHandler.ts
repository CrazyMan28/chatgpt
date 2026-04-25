// src/utils/errorHandler.ts

import { Logger, logger as defaultLogger } from "./logger.js";
import { EXIT_CODE, ENV_KEYS } from "./constants.js";

/**
 * Validates that all provided exit codes are integers and unique.
 * @param exitCodes - Record of exit codes to validate.
 * @param options - Validation options.
 * @param options.allowPartial - If true, validates only the provided exit codes without requiring all EXIT_CODE constants. Defaults to false.
 * @throws {Error} If any exit code is not an integer, if duplicates are found, or if the input is invalid.
 */
export function validateExitCodes(
  exitCodes: Record<string, number>,
  options: { allowPartial?: boolean } = { allowPartial: false }
): void {
  if (typeof exitCodes !== "object" || exitCodes === null) {
    throw new Error("Exit codes must be an object.");
  }
  
  if (!options.allowPartial && Object.keys(exitCodes).length === 0) {
    throw new Error("No exit codes provided.");
  }
  
  const values = Object.values(exitCodes);
  const uniqueValues = new Set(values);
  
  // Check for duplicate values
  if (values.length !== uniqueValues.size) {
    throw new Error("Duplicate exit codes found. All exit codes must be unique.");
  }
  
  for (const [key, value] of Object.entries(exitCodes)) {
    if (!Number.isInteger(value)) {
      throw new Error(
        `Invalid exit code value for '${key}': Must be an integer. Received: ${JSON.stringify(value)}`
      );
    }
  }
}

// Validate EXIT_CODE constants
validateExitCodes(EXIT_CODE);

/**
 * Validates the context parameter for logging and reporting.
 * @param context - The context to validate.
 * @param maxLength - Maximum allowed length for the context.
 * @throws {Error} If the context is invalid.
 */
export function validateContext(context: string, maxLength: number = 500): void {
  if (typeof context !== "string" || context.trim() === "") {
    throw new Error(`Invalid context: Must be a non-empty string.`);
  }
  
  // Check for non-printable ASCII characters
  if (/[^\x20-\x7E]/.test(context)) {
    throw new Error(`Invalid context: Must only contain printable ASCII characters.`);
  }
  
  // Check for excessive length
  if (context.length > maxLength) {
    throw new Error(`Invalid context: Must not exceed ${maxLength} characters.`);
  }
}

/**
 * Normalizes an unknown input into an Error object.
 * @param error - The input to normalize.
 * @param context - Optional context for the error message.
 * @returns An Error object.
 */
export function toError(error: unknown, context?: string): Error {
  if (error instanceof Error) {
    return error;
  }
  
  // Explicitly handle ErrorEvent objects
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "error" in error
  ) {
    const err = new Error(context ? `[${context}] ${error.message}` : error.message);
    err.stack = error.error?.stack;
    return err;
  }
  
  if (typeof error === "string") {
    return new Error(context ? `[${context}] ${error}` : error);
  }
  
  if (error === null || error === undefined) {
    return new Error(context ? `[${context}] Unknown error` : "Unknown error");
  }
  
  // Handle objects with a message property (e.g., { message: "Custom error" })
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    const err = new Error(context ? `[${context}] ${error.message}` : error.message);
    // Copy all enumerable and non-enumerable properties from the original object to the Error object
    for (const key in error) {
      if (Object.prototype.hasOwnProperty.call(error, key)) {
        err[key] = error[key];
      }
    }
    return err;
  }
  
  return new Error(context ? `[${context}] ${String(error)}` : String(error));
}

/**
 * Safely extracts error details for logging or reporting.
 * @param error - The error to extract details from.
 * @returns An object containing the error details.
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  cause?: unknown;
  [key: string]: unknown;
} {
  const normalizedError = toError(error);
  const details = {
    message: normalizedError.message,
    stack: normalizedError.stack,
    cause: normalizedError.cause,
  };
  
  // Explicitly handle AggregateError
  if (normalizedError instanceof AggregateError) {
    details.errors = normalizedError.errors.map((err) => extractErrorDetails(err));
  }
  
  // Explicitly handle DOMException
  if (normalizedError.name === "DOMException") {
    details.name = normalizedError.name;
    details.code = (normalizedError as DOMException).code;
  }
  
  // Explicitly handle TypeError
  if (normalizedError instanceof TypeError) {
    details.name = normalizedError.name;
    // Explicitly include the cause property if it exists
    if (normalizedError.cause !== undefined) {
      details.cause = normalizedError.cause;
    }
  }
  
  // Explicitly handle SyntaxError
  if (normalizedError instanceof SyntaxError) {
    details.name = normalizedError.name;
  }
  
  // Explicitly handle RangeError
  if (normalizedError instanceof RangeError) {
    details.name = normalizedError.name;
  }
  
  // Explicitly handle EvalError
  if (normalizedError instanceof EvalError) {
    details.name = normalizedError.name;
    // Explicitly include the cause property if it exists
    if (normalizedError.cause !== undefined) {
      details.cause = normalizedError.cause;
    }
  }
  
  // Explicitly handle ReferenceError
  if (normalizedError instanceof ReferenceError) {
    details.name = normalizedError.name;
  }
  
  // Explicitly handle URIError
  if (normalizedError instanceof URIError) {
    details.name = normalizedError.name;
    // Explicitly include the cause property if it exists
    if (normalizedError.cause !== undefined) {
      details.cause = normalizedError.cause;
    }
  }
  
  // Explicitly handle InternalError
  if (normalizedError.name === "InternalError") {
    details.name = normalizedError.name;
  }
  
  // Explicitly handle SecurityError
  if (normalizedError.name === "SecurityError") {
    details.name = normalizedError.name;
    // Explicitly include the cause property if it exists
    if (normalizedError.cause !== undefined) {
      details.cause = normalizedError.cause;
    }
  }
  
  // Explicitly handle CustomError
  if (normalizedError.name === "CustomError") {
    details.name = normalizedError.name;
    // Include custom properties if they exist
    for (const key in normalizedError) {
      if (Object.prototype.hasOwnProperty.call(normalizedError, key) && !details.hasOwnProperty(key)) {
        details[key] = (normalizedError as Record<string, unknown>)[key];
      }
    }
  }
  
  // Explicitly handle AssertionError
  if (normalizedError.name === "AssertionError") {
    details.name = normalizedError.name;
    // Include assertion-specific properties if they exist
    if ("actual" in normalizedError) {
      details.actual = (normalizedError as Record<string, unknown>).actual;
    }
    if ("expected" in normalizedError) {
      details.expected = (normalizedError as Record<string, unknown>).expected;
    }
    if ("operator" in normalizedError) {
      details.operator = (normalizedError as Record<string, unknown>).operator;
    }
    if ("stackStartFunction" in normalizedError) {
      details.stackStartFunction = (normalizedError as Record<string, unknown>).stackStartFunction;
    }
  }
  
  // Explicitly handle WebAssembly.CompileError
  if (normalizedError.name === "CompileError") {
    details.name = normalizedError.name;
    // Include WebAssembly-specific properties if they exist
    if ("line" in normalizedError) {
      details.line = (normalizedError as Record<string, unknown>).line;
    }
    if ("column" in normalizedError) {
      details.column = (normalizedError as Record<string, unknown>).column;
    }
    if ("file" in normalizedError) {
      details.file = (normalizedError as Record<string, unknown>).file;
    }
  }
  
  // Explicitly handle WebAssembly.LinkError
  if (normalizedError.name === "LinkError") {
    details.name = normalizedError.name;
    // Include WebAssembly-specific properties if they exist
    if ("line" in normalizedError) {
      details.line = (normalizedError as Record<string, unknown>).line;
    }
    if ("column" in normalizedError) {
      details.column = (normalizedError as Record<string, unknown>).column;
    }
    if ("file" in normalizedError) {
      details.file = (normalizedError as Record<string, unknown>).file;
    }
  }
  
  // Explicitly handle WebAssembly.RuntimeError
  if (normalizedError.name === "RuntimeError") {
    details.name = normalizedError.name;
    // Include WebAssembly-specific properties if they exist
    if ("line" in normalizedError) {
      details.line = (normalizedError as Record<string, unknown>).line;
    }
    if ("column" in normalizedError) {
      details.column = (normalizedError as Record<string, unknown>).column;
    }
    if ("file" in normalizedError) {
      details.file = (normalizedError as Record<string, unknown>).file;
    }
  }
  
  // Safely copy all enumerable and non-enumerable properties from the error object, avoiding circular references
  const seen = new WeakSet();
  function safeCopy(source: unknown, target: Record<string, unknown>): void {
    if (typeof source !== "object" || source === null || seen.has(source)) {
      return;
    }
    seen.add(source);
    
    // Copy enumerable properties
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key) && !details.hasOwnProperty(key)) {
        try {
          const value = (source as Record<string, unknown>)[key];
          if (typeof value === "object" && value !== null) {
            target[key] = "[Object]"; // Avoid deep copying objects to prevent circular references
          } else {
            target[key] = value;
          }
        } catch (err) {
          target[key] = "[Error copying property]";
        }
      }
    }
    
    // Copy non-enumerable properties
    const nonEnumerableProperties = Object.getOwnPropertyNames(source).filter(
      (key) => !Object.prototype.propertyIsEnumerable.call(source, key)
    );
    for (const key of nonEnumerableProperties) {
      if (!details.hasOwnProperty(key)) {
        try {
          const value = (source as Record<string, unknown>)[key];
          if (typeof value === "object" && value !== null) {
            target[key] = "[Object]"; // Avoid deep copying objects to prevent circular references
          } else {
            target[key] = value;
          }
        } catch (err) {
          target[key] = "[Error copying property]";
        }
      }
    }
  }
  
  safeCopy(normalizedError, details);
  
  return details;
}

/**
 * Validates that the logger is a valid Logger instance.
 * @param logger - The logger to validate.
 * @throws {Error} If the logger is not a valid Logger instance.
 */
export function validateLogger(logger: Logger): void {
  if (
    !logger ||
    typeof logger !== "object" ||
    !logger.error ||
    !logger.warn ||
    !logger.info ||
    !logger.debug ||
    !logger.trace ||
    !logger.getLogLevel ||
    !logger.setLogLevel
  ) {
    throw new Error(
      "Invalid logger: Must be a valid Logger instance with error, warn, info, debug, trace, getLogLevel, and setLogLevel properties."
    );
  }
  
  // Validate that each method is a function
  const methodsToValidate = ["error", "warn", "info", "debug", "trace", "getLogLevel", "setLogLevel"];
  for (const method of methodsToValidate) {
    if (typeof (logger as any)[method] !== "function") {
      throw new Error(`Invalid logger: '${method}' must be a function.`);
    }
  }
}

/**
 * Centralized error handler for the application.
 * Logs errors and optionally performs additional actions like reporting or cleanup.
 * 
 * @param error - The error to handle.
 * @param context - Additional context for debugging (e.g., module name, operation).
 * @param isFatal - If true, the application will exit after handling the error.
 * @param logger - Optional logger instance. Defaults to the global logger.
 * @returns The original error for further processing.
 */
export function handleError(
  error: unknown,
  context: string = "Application",
  isFatal: boolean = false,
  logger: Logger = defaultLogger
): Error {
  // Validate logger
  validateLogger(logger);
  
  // Validate context
  validateContext(context);
  
  const normalizedError = toError(error, context);
  
  // Log the error with context using the provided or default logger
  logger.error(`[${context}] Error: ${normalizedError.message}`);
  
  // Log additional enumerable properties for debugging
  const errorDetails = extractErrorDetails(normalizedError);
  for (const key in errorDetails) {
    if (
      Object.prototype.hasOwnProperty.call(errorDetails, key) &&
      key !== "message" &&
      key !== "stack"
    ) {
      logger.error(`[${context}] ${key}: ${JSON.stringify(errorDetails[key])}`);
    }
  }
  
  // Log stack trace in development or if explicitly enabled via LOG_STACK_TRACE
  const shouldLogStackTrace =
    process.env[ENV_KEYS.NODE_ENV] === "development" && process.env[ENV_KEYS.DISABLE_STACK_TRACE] !== "true" ||
    process.env[ENV_KEYS.LOG_STACK_TRACE] === "true";
  
  if (shouldLogStackTrace) {
    logger.debug("Stack Trace:", normalizedError.stack);
  }
  
  // Perform additional actions here (e.g., reporting to an external service)
  // Example: reportErrorToService(normalizedError, context);
  
  // Exit if the error is fatal
  if (isFatal) {
    logger.error(`[${context}] Exiting due to fatal error.`);
    process.exit(EXIT_CODE.FATAL_ERROR);
  }
  
  // Return the normalized error for further processing
  return normalizedError;
}

/**
 * Validates a condition and throws an error if it fails.
 * Useful for validating inputs, states, or invariants.
 * 
 * @param condition - The condition to validate.
 * @param error - The error message or custom error object to throw if the condition fails.
 * @param context - Additional context for debugging.
 * @param isFatal - If true, the application will exit after handling the error. Defaults to false.
 * @param shouldRethrow - If true, the error will be re-thrown after handling. Defaults to true.
 * @param logger - Optional logger instance. Defaults to the global logger.
 * @throws {Error} Throws an error if the condition is false and shouldRethrow is true.
 */
export function assert(
  condition: boolean,
  error: string | { message: string; [key: string]: unknown },
  context: string = "Validation",
  isFatal: boolean = false,
  shouldRethrow: boolean = true,
  logger: Logger = defaultLogger
): asserts condition {
  // Validate logger
  validateLogger(logger);
  
  // Validate context
  validateContext(context);
  
  // Validate condition to ensure it is a boolean
  if (typeof condition !== "boolean") {
    const errorMessage = `Invalid condition: 'condition' must be a boolean value.`;
    const errorObj = new Error(errorMessage);
    handleError(errorObj, context, false, logger);
    throw errorObj;
  }
  
  // Validate isFatal and shouldRethrow to ensure they are boolean
  if (typeof isFatal !== "boolean" || typeof shouldRethrow !== "boolean") {
    const errorMessage = `Invalid parameters: 'isFatal' and 'shouldRethrow' must be boolean values.`;
    const errorObj = new Error(errorMessage);
    handleError(errorObj, context, false, logger);
    throw errorObj;
  }
  
  // Validate error parameter
  if (error === null || error === undefined) {
    const errorMessage = `Invalid error: 'error' must be a string or an object with a 'message' property.`;
    const errorObj = new Error(errorMessage);
    handleError(errorObj, context, false, logger);
    throw errorObj;
  }
  
  // Validate error for empty string or empty message property
  if (typeof error === "string" && error.trim() === "") {
    const errorMessage = `Invalid error: 'error' must be a non-empty string.`;
    const errorObj = new Error(errorMessage);
    handleError(errorObj, context, false, logger);
    throw errorObj;
  }
  
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim() === ""
  ) {
    const errorMessage = `Invalid error: 'error.message' must be a non-empty string.`;
    const errorObj = new Error(errorMessage);
    handleError(errorObj, context, false, logger);
    throw errorObj;
  }
  
  if (
    typeof error !== "string" &&
    (typeof error !== "object" || !("message" in error) || typeof error.message !== "string")
  ) {
    const errorMessage = `Invalid error object: 'error' must be a string or an object with a 'message' property.`;
    const errorObj = new Error(errorMessage);
    handleError(errorObj, context, false, logger);
    throw errorObj;
  }
  
  if (!condition) {
    const errorObj = typeof error === "string" ? new Error(error) : toError(error, context);
    handleError(errorObj, context, isFatal, logger);
    // Re-throw the error if shouldRethrow is true
    if (shouldRethrow) {
      throw errorObj;
    }
  }
}