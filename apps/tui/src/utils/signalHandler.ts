// src/utils/signalHandler.ts

import { logger } from "./logger.js";
import { EXIT_CODE } from "./constants.js";
import { validateExitCodes } from "./errorHandler.js";

/**
 * Dynamically generates signal descriptions for debugging.
 * @returns An object mapping signal names to their descriptions.
 */
function getSignalDescriptions(): Record<string, string> {
  return {
    SIGINT: "Graceful shutdown (Ctrl+C)",
    SIGTERM: "Graceful shutdown (termination request)",
    SIGUSR1: "Enable debugging output (if DEBUG_MODE is truthy)",
    SIGUSR2: "Toggle verbose logging (debug/info)",
  };
}

/**
 * Logs available signal handlers and their purposes for debugging.
 */
export function logSignalHandlers(): void {
  const signalDescriptions = getSignalDescriptions();
  logger.debug("Available signal handlers:", signalDescriptions);
}

/**
 * Registers signal handlers for graceful shutdown and debugging.
 * This is a standalone version of the signal handler logic for reusability.
 */
export function registerSignalHandlers(): void {
  // Validate logger methods before proceeding
  if (!logger || typeof logger.info !== "function" || typeof logger.debug !== "function") {
    throw new Error("Invalid logger: Required methods (info, debug) are missing.");
  }

  // Validate EXIT_CODE constants
  validateExitCodes(EXIT_CODE);

  logSignalHandlers(); // Log available handlers on registration

  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", () => {
    logger.info("Received SIGINT. Shutting down gracefully...");
    process.exit(EXIT_CODE.SUCCESS);
  });

  // Handle SIGTERM (termination request)
  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM. Shutting down gracefully...");
    process.exit(EXIT_CODE.SUCCESS);
  });

  // Handle SIGUSR1 for dynamic debugging output
  process.on("SIGUSR1", () => {
    // Check if process.env exists before accessing it
    if (typeof process.env !== "undefined" && process.env) {
      const debugMode = process.env.DEBUG_MODE && process.env.DEBUG_MODE !== "false";
      if (debugMode) {
        logger.info("Debugging output enabled via SIGUSR1.");
        
        // Check for availability of process methods before accessing them
        const processState: Record<string, unknown> = {};
        
        if (typeof process.pid === "number") {
          processState.pid = process.pid;
        }
        
        if (typeof process.uptime === "function") {
          processState.uptime = process.uptime();
        }
        
        if (typeof process.memoryUsage === "function") {
          processState.memoryUsage = process.memoryUsage();
        }
        
        if (typeof process.cpuUsage === "function") {
          processState.cpuUsage = process.cpuUsage();
        }
        
        logger.debug("Current process state:", processState);
      } else {
        logger.warn("DEBUG_MODE is not enabled. Set DEBUG_MODE=true to enable debugging output.");
      }
    } else {
      logger.warn("process.env is not available. Debugging output cannot be enabled.");
    }
  });

  // Validate logger support for getLogLevel and setLogLevel before registering SIGUSR2
  if (typeof logger.getLogLevel !== "function" || typeof logger.setLogLevel !== "function") {
    throw new Error("Logger does not support dynamic log level changes. SIGUSR2 handler cannot be registered.");
  }

  // Handle SIGUSR2 for toggling verbose logging
  process.on("SIGUSR2", () => {
    const currentLogLevel = logger.getLogLevel();
    if (currentLogLevel === "debug") {
      logger.setLogLevel("info");
      logger.info("Verbose logging disabled via SIGUSR2.");
    } else {
      logger.setLogLevel("debug");
      logger.info("Verbose logging enabled via SIGUSR2.");
    }
  });
}