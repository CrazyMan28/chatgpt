// src/utils/constants.ts

// Consolidated constants object
const CONSTANTS = {
  // Exit codes for the application
  EXIT_CODE: {
    SUCCESS: 0,
    ERROR: 1,
    INVALID_ARGS: 2,
    FATAL_ERROR: 3,  // Reserved for unrecoverable errors that require immediate termination
  },

  // Log prefix for the application
  LOG_PREFIX: "[YoYo]",

  // Environment variable keys for consistency
  ENV_KEYS: {
    NODE_ENV: "NODE_ENV",
    DISABLE_STACK_TRACE: "DISABLE_STACK_TRACE",
    LOG_STACK_TRACE: "LOG_STACK_TRACE",
    DEBUG_MODE: "DEBUG_MODE",
    LOG_LEVEL: "LOG_LEVEL",
    LOG_PREFIX: "LOG_PREFIX",
    SUPPRESS_CONSOLE_ERROR: "SUPPRESS_CONSOLE_ERROR",
    LOG_BACKEND: "LOG_BACKEND",
  },

  // Default log levels for the application
  LOG_LEVEL: {
    ERROR: "error",
    WARN: "warn",
    INFO: "info",
    DEBUG: "debug",
    TRACE: "trace",
  },

  // Fallback log level for SIGUSR2 toggling
  FALLBACK_LOG_LEVEL: "info",

  // Valid log levels for validation
  VALID_LOG_LEVELS: ["error", "warn", "info", "debug", "trace"],

  // Timeout constants for asynchronous operations (in milliseconds)
  TIMEOUT: {
    DEFAULT: 5000,          // Default timeout for general operations
    NETWORK: 10000,         // Timeout for network-related operations
    LONG_RUNNING: 30000,     // Timeout for long-running operations
    SHORT: 1000,            // Timeout for short operations
    VERY_SHORT: 100,         // Timeout for very short operations (e.g., health checks)
    VERY_LONG: 3600000,      // Timeout for very long operations (e.g., batch processing)
  },

  // Retry constants for operations like network requests, database connections, or API calls
  RETRY: {
    DEFAULT: 3,          // Default maximum retry attempts for general operations
    NETWORK: 5,          // Maximum retry attempts for network-related operations
    DATABASE: 3,         // Maximum retry attempts for database operations
    VERY_SHORT: 1,       // Maximum retry attempts for minimal retry scenarios
  },
};

// Valid log backends for validation
const VALID_LOG_BACKENDS = ["console", "custom"];

// Export individual constants for backward compatibility
const {
  EXIT_CODE,
  LOG_PREFIX,
  ENV_KEYS,
  LOG_LEVEL,
  FALLBACK_LOG_LEVEL,
  VALID_LOG_LEVELS,
  TIMEOUT,
  RETRY,
} = CONSTANTS;

/**
 * Validates that all LOG_LEVEL constants are valid log levels and unique.
 * @throws {Error} If any LOG_LEVEL constant is not a valid log level or if duplicates are found.
 */
export function validateLogLevels(levels: Record<string, string>): void {
  if (typeof levels !== "object" || levels === null) {
    throw new Error("Log levels must be an object.");
  }
  
  if (Object.keys(levels).length === 0) {
    throw new Error("No log levels provided.");
  }
  
  const values = Object.values(levels);
  const uniqueValues = new Set(values);
  
  // Check for duplicate values
  if (values.length !== uniqueValues.size) {
    throw new Error("Duplicate log levels found. All log levels must be unique.");
  }
  
  for (const [key, value] of Object.entries(levels)) {
    if (!VALID_LOG_LEVELS.includes(value)) {
      throw new Error(`Invalid log level for ${key}: Must be one of ${VALID_LOG_LEVELS.join(", ")}).`);
    }
    
    // Ensure LOG_LEVEL keys are uppercase
    if (key !== key.toUpperCase()) {
      throw new Error(`Invalid LOG_LEVEL key: ${key}. All keys must be uppercase.`);
    }
  }
}

/**
 * Validates that the FALLBACK_LOG_LEVEL is a valid log level.
 * @throws {Error} If FALLBACK_LOG_LEVEL is not a valid log level.
 */
export function validateFallbackLogLevel(level: string): void {
  if (!VALID_LOG_LEVELS.includes(level)) {
    throw new Error(`Invalid FALLBACK_LOG_LEVEL: Must be one of ${VALID_LOG_LEVELS.join(", ")}).`);
  }
}

/**
 * Validates that all TIMEOUT constants are positive integers and within reasonable bounds.
 * @throws {Error} If any TIMEOUT constant is not a positive integer or exceeds the maximum allowed value.
 */
export function validateTimeouts(timeouts: Record<string, number>): void {
  if (typeof timeouts !== "object" || timeouts === null) {
    throw new Error("Timeouts must be an object.");
  }
  
  if (Object.keys(timeouts).length === 0) {
    throw new Error("No timeouts provided.");
  }
  
  const MAX_TIMEOUT = 3600000; // 1 hour in milliseconds
  const MAX_VERY_SHORT_TIMEOUT = 100; // 100ms for VERY_SHORT timeout
  const MAX_SHORT_TIMEOUT = 5000; // 5000ms for SHORT timeout
  const MAX_DEFAULT_TIMEOUT = 10000; // 10,000ms for DEFAULT timeout
  const MAX_NETWORK_TIMEOUT = 30000; // 30,000ms for NETWORK timeout
  const MAX_LONG_RUNNING_TIMEOUT = 3600000; // 1 hour in milliseconds for LONG_RUNNING timeout
  const MAX_VERY_LONG_TIMEOUT = 86400000; // 24 hours in milliseconds for VERY_LONG timeout
  
  for (const [key, value] of Object.entries(timeouts)) {
    if (typeof value !== "number" || value <= 0 || !Number.isInteger(value)) {
      throw new Error(`Invalid timeout value for ${key}: Must be a positive integer.`);
    }

    if (value > MAX_TIMEOUT) {
      throw new Error(`Invalid timeout value for ${key}: Must not exceed ${MAX_TIMEOUT} milliseconds (1 hour).`);
    }

    // Explicitly validate VERY_SHORT timeout
    if (key === "VERY_SHORT" && value > MAX_VERY_SHORT_TIMEOUT) {
      throw new Error(`Invalid timeout value for ${key}: Must not exceed ${MAX_VERY_SHORT_TIMEOUT} milliseconds.`);
    }

    // Explicitly validate SHORT timeout
    if (key === "SHORT" && value > MAX_SHORT_TIMEOUT) {
      throw new Error(`Invalid timeout value for ${key}: Must not exceed ${MAX_SHORT_TIMEOUT} milliseconds.`);
    }

    // Explicitly validate DEFAULT timeout
    if (key === "DEFAULT" && value > MAX_DEFAULT_TIMEOUT) {
      throw new Error(`Invalid timeout value for ${key}: Must not exceed ${MAX_DEFAULT_TIMEOUT} milliseconds (10 seconds).`);
    }

    // Explicitly validate NETWORK timeout
    if (key === "NETWORK" && value > MAX_NETWORK_TIMEOUT) {
      throw new Error(`Invalid timeout value for ${key}: Must not exceed ${MAX_NETWORK_TIMEOUT} milliseconds (30 seconds).`);
    }

    // Explicitly validate LONG_RUNNING timeout
    if (key === "LONG_RUNNING" && value > MAX_LONG_RUNNING_TIMEOUT) {
      throw new Error(`Invalid timeout value for ${key}: Must not exceed ${MAX_LONG_RUNNING_TIMEOUT} milliseconds (1 hour).`);
    }

    // Explicitly validate VERY_LONG timeout
    if (key === "VERY_LONG" && value > MAX_VERY_LONG_TIMEOUT) {
      throw new Error(`Invalid timeout value for ${key}: Must not exceed ${MAX_VERY_LONG_TIMEOUT} milliseconds (24 hours).`);
    }
  }
}

/**
 * Validates that all RETRY constants are positive integers and within reasonable bounds.
 * @throws {Error} If any RETRY constant is not a positive integer or exceeds the maximum allowed value.
 */
export function validateRetries(retries: Record<string, number>): void {
  if (typeof retries !== "object" || retries === null) {
    throw new Error("Retries must be an object.");
  }
  
  if (Object.keys(retries).length === 0) {
    throw new Error("No retries provided.");
  }
  
  const MAX_RETRIES = 10; // Maximum allowed retry attempts
  const MAX_VERY_SHORT_RETRIES = 1; // Maximum allowed retry attempts for VERY_SHORT
  const MAX_DEFAULT_RETRIES = 5; // Maximum allowed retry attempts for DEFAULT
  const MAX_NETWORK_RETRIES = 10; // Maximum allowed retry attempts for NETWORK
  
  for (const [key, value] of Object.entries(retries)) {
    if (typeof value !== "number" || value <= 0 || !Number.isInteger(value)) {
      throw new Error(`Invalid retry value for ${key}: Must be a positive integer.`);
    }
    
    if (value > MAX_RETRIES) {
      throw new Error(`Invalid retry value for ${key}: Must not exceed ${MAX_RETRIES} attempts.`);
    }
    
    // Explicitly validate VERY_SHORT retries
    if (key === "VERY_SHORT" && value > MAX_VERY_SHORT_RETRIES) {
      throw new Error(`Invalid retry value for ${key}: Must not exceed ${MAX_VERY_SHORT_RETRIES} attempt.`);
    }
    
    // Explicitly validate DEFAULT retries
    if (key === "DEFAULT" && value > MAX_DEFAULT_RETRIES) {
      throw new Error(`Invalid retry value for ${key}: Must not exceed ${MAX_DEFAULT_RETRIES} attempts.`);
    }
    
    // Explicitly validate NETWORK retries
    if (key === "NETWORK" && value > MAX_NETWORK_RETRIES) {
      throw new Error(`Invalid retry value for ${key}: Must not exceed ${MAX_NETWORK_RETRIES} attempts.`);
    }
  }
}

/**
 * Validates that the LOG_PREFIX is a non-empty string without invalid characters.
 * @throws {Error} If LOG_PREFIX is not a non-empty string or contains invalid characters.
 */
export function validateLogPrefix(prefix: string): void {
  if (typeof prefix !== "string" || prefix.trim() === "") {
    throw new Error(`Invalid LOG_PREFIX: Must be a non-empty string.`);
  }
  
  // Check for empty string after trimming
  if (prefix.trim().length === 0) {
    throw new Error(`Invalid LOG_PREFIX: Must not be empty after trimming.`);
  }
  
  // Check for leading or trailing whitespace after trimming
  if (prefix !== prefix.trim()) {
    throw new Error(`Invalid LOG_PREFIX: Must not contain leading or trailing whitespace.`);
  }
  
  // Check for non-printable ASCII characters
  if (/[^\x20-\x7E]/.test(prefix)) {
    throw new Error(`Invalid LOG_PREFIX: Must only contain printable ASCII characters.`);
  }
  
  // Check for excessive length
  if (prefix.length > 50) {
    throw new Error(`Invalid LOG_PREFIX: Must not exceed 50 characters.`);
  }
}

/**
 * Validates that the EXIT_CODE.SUCCESS is equal to 0.
 * @throws {Error} If EXIT_CODE.SUCCESS is not equal to 0.
 */
export function validateSuccessExitCode(successCode: number): void {
  if (successCode !== 0) {
    throw new Error(`Invalid EXIT_CODE.SUCCESS: Must be equal to 0.`);
  }
}

/**
 * Validates that all ENV_KEYS are non-empty strings and unique.
 * @throws {Error} If any ENV_KEYS value is not a non-empty string or if duplicates are found.
 */
export function validateEnvKeys(envKeys: Record<string, string>): void {
  if (typeof envKeys !== "object" || envKeys === null) {
    throw new Error("Environment keys must be an object.");
  }
  
  if (Object.keys(envKeys).length === 0) {
    throw new Error("No environment keys provided.");
  }
  
  const values = Object.values(envKeys);
  const uniqueValues = new Set(values);
  
  // Check for duplicate values
  if (values.length !== uniqueValues.size) {
    throw new Error("Duplicate environment keys found. All environment keys must be unique.");
  }
  
  for (const [key, value] of Object.entries(envKeys)) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Invalid environment key for ${key}: Must be a non-empty string.`);
    }
  }
}

/**
 * Validates that all EXIT_CODE constants are integers.
 * @throws {Error} If any EXIT_CODE constant is not an integer.
 */
export function validateExitCodes(exitCodes: Record<string, number>): void {
  if (typeof exitCodes !== "object" || exitCodes === null) {
    throw new Error("Exit codes must be an object.");
  }
  
  if (Object.keys(exitCodes).length === 0) {
    throw new Error("No exit codes provided.");
  }
  
  for (const [key, value] of Object.entries(exitCodes)) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(`Invalid exit code for ${key}: Must be an integer.`);
    }
  }
}

/**
 * Validates that the LOG_BACKEND environment key is valid.
 * @throws {Error} If LOG_BACKEND is not a valid backend.
 */
export function validateLogBackend(backend: string): void {
  if (!VALID_LOG_BACKENDS.includes(backend)) {
    throw new Error(`Invalid LOG_BACKEND: Must be one of ${VALID_LOG_BACKENDS.join(", ")}.`);
  }
}

/**
 * Validates the VALID_LOG_BACKENDS array to ensure it contains only valid and unique values.
 * @throws {Error} If VALID_LOG_BACKENDS contains invalid or duplicate values.
 */
export function validateLogBackends(backends: string[]): void {
  if (!Array.isArray(backends)) {
    throw new Error("Log backends must be an array.");
  }
  
  if (backends.length === 0) {
    throw new Error("No log backends provided.");
  }
  
  const uniqueBackends = new Set(backends);
  
  // Check for duplicate values
  if (backends.length !== uniqueBackends.size) {
    throw new Error("Duplicate log backends found. All log backends must be unique.");
  }
  
  for (const backend of backends) {
    if (typeof backend !== "string" || backend.trim() === "") {
      throw new Error(`Invalid log backend: Must be a non-empty string.`);
    }
  }
}

/**
 * Validates the LOG_BACKEND environment variable at runtime.
 * @throws {Error} If the LOG_BACKEND environment variable is set to an invalid value.
 */
export function validateRuntimeLogBackend(): void {
  // Check if process.env exists
  if (typeof process === 'undefined' || typeof process.env !== 'object' || process.env === null) {
    throw new Error("process.env is not available. Cannot validate LOG_BACKEND.");
  }
  
  const logBackend = process.env[ENV_KEYS.LOG_BACKEND];
  if (logBackend && !VALID_LOG_BACKENDS.includes(logBackend.toLowerCase())) {
    throw new Error(`Invalid LOG_BACKEND environment variable: Must be one of ${VALID_LOG_BACKENDS.join(", ")}.`);
  }
}

/**
 * Freezes an object to prevent modifications.
 * @param obj - The object to freeze.
 */
export function FREEZE_CONSTANTS(obj: Record<string, unknown>): void {
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "object" && value !== null) {
      FREEZE_CONSTANTS(value as Record<string, unknown>);
    }
  }
}

// Validate and freeze all constants
validateLogLevels(LOG_LEVEL);
validateFallbackLogLevel(FALLBACK_LOG_LEVEL);
validateLogPrefix(LOG_PREFIX);
validateEnvKeys(ENV_KEYS);
validateSuccessExitCode(EXIT_CODE.SUCCESS);
validateExitCodes(EXIT_CODE);
validateTimeouts(TIMEOUT);
validateRetries(RETRY);
validateLogBackends(VALID_LOG_BACKENDS);

// Freeze the VALID_LOG_BACKENDS array
Object.freeze(VALID_LOG_BACKENDS);

// Freeze the entire CONSTANTS object
FREEZE_CONSTANTS(CONSTANTS);

// Export constants for use in the application
export {
  EXIT_CODE,
  LOG_PREFIX,
  ENV_KEYS,
  LOG_LEVEL,
  FALLBACK_LOG_LEVEL,
  VALID_LOG_LEVELS,
  TIMEOUT,
  RETRY,
  VALID_LOG_BACKENDS,
};
