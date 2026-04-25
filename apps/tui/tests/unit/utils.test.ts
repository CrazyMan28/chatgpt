// tests/unit/utils.test.ts

import { describe, it, expect, jest } from "@jest/globals";
import { handleError, assert, validateExitCodes } from "../../src/utils/errorHandler";
import {
  Logger,
  logger as defaultLogger,
  LogLevel,
  LoggingBackend,
  ConsoleLoggingBackend,
  updateLoggerFromEnv,
} from "../../src/utils/logger";
import { ENV_KEYS, RETRY, TIMEOUT, EXIT_CODE, validateTimeouts, validateRetries } from "../../src/utils/constants";

class MockLoggingBackend implements LoggingBackend {
  debug = jest.fn();
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
}

// Utility function to mock and restore console methods
type ConsoleMethods = {
  debug: typeof console.debug;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
};

type MockedConsole = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

function mockConsole() {
  const originalConsole: ConsoleMethods = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  const mockedConsole: MockedConsole = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  console.debug = mockedConsole.debug;
  console.info = mockedConsole.info;
  console.warn = mockedConsole.warn;
  console.error = mockedConsole.error;

  return {
    mockedConsole,
    restore: () => {
      console.debug = originalConsole.debug;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    },
  };
}

describe("Utility Functions", () => {
  describe("EXIT_CODE Constants", () => {
    it("should have the correct default exit code values", () => {
      expect(EXIT_CODE.SUCCESS).toBe(0);
      expect(EXIT_CODE.ERROR).toBe(1);
      expect(EXIT_CODE.INVALID_ARGS).toBe(2);
      expect(EXIT_CODE.FATAL_ERROR).toBe(3);
    });

    it("should validate exit code values as integers", () => {
      expect(() => validateExitCodes(EXIT_CODE)).not.toThrow();
    });

    it("should throw an error for invalid exit code values", () => {
      const invalidExitCodes = {
        SUCCESS: 0,
        ERROR: 1.5,
        INVALID_ARGS: 2,
        FATAL_ERROR: "invalid",
      };
      expect(() => validateExitCodes(invalidExitCodes)).toThrow("Invalid exit code value" );
    });
  });

  describe("RETRY Constants", () => {
    it("should have the correct default retry values", () => {
      expect(RETRY.DEFAULT).toBe(3);
      expect(RETRY.NETWORK).toBe(5);
      expect(RETRY.DATABASE).toBe(3);
    });

    it("should validate retry values as positive integers", () => {
      expect(() => validateRetries(RETRY)).not.toThrow();
    });

    it("should throw an error for invalid retry values", () => {
      const invalidRetries = {
        DEFAULT: -1,
        NETWORK: 0,
        DATABASE: 3,
      };
      expect(() => validateRetries(invalidRetries)).toThrow("Invalid retry value" );
    });
  });

  describe("TIMEOUT Constants", () => {
    it("should have the correct default timeout values", () => {
      expect(TIMEOUT.DEFAULT).toBe(5000);
      expect(TIMEOUT.NETWORK).toBe(10000);
      expect(TIMEOUT.LONG_RUNNING).toBe(30000);
      expect(TIMEOUT.SHORT).toBe(1000);
    });

    it("should validate timeout values as positive integers", () => {
      expect(() => validateTimeouts(TIMEOUT)).not.toThrow();
    });

    it("should throw an error for invalid timeout values", () => {
      const invalidTimeouts = {
        DEFAULT: -1,
        NETWORK: 0,
        LONG_RUNNING: 30000,
        SHORT: "invalid",
      };
      expect(() => validateTimeouts(invalidTimeouts)).toThrow("Invalid timeout value" );
    });
  });

describe("toError", () => {
    it("should preserve the message property of custom error objects", () => {
      const customError = { message: "Custom error" };
      const error = handleError(customError, "TestContext");
      expect(error.message).toBe("[TestContext] Custom error");
    });

    it("should handle custom error objects without context", () => {
      const customError = { message: "Custom error" };
      const error = handleError(customError);
      expect(error.message).toBe("Custom error");
    });

    it("should normalize objects without a message property", () => {
      const genericObject = { key: "value" };
      const error = handleError(genericObject, "TestContext");
      expect(error.message).toBe("[TestContext] [object Object]");
    });

    it("should preserve additional enumerable properties from the original object", () => {
      const customError = {
        message: "Custom error",
        code: 123,
        status: "FAILED",
        metadata: { key: "value" },
      };
      const error = handleError(customError, "TestContext");
      expect(error.message).toBe("[TestContext] Custom error");
      expect(error.code).toBe(123);
      expect(error.status).toBe("FAILED");
      expect(error.metadata).toEqual({ key: "value" });
    });
  });

describe("handleError", () => {
    let mockedLogger: MockLoggingBackend;
    let originalLogger: Logger;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      mockedLogger = new MockLoggingBackend();
      originalLogger = defaultLogger;
      originalEnv = process.env;
      defaultLogger["backend"] = mockedLogger;
    });

    afterEach(() => {
      defaultLogger["backend"] = originalLogger["backend"];
      process.env = originalEnv;
    });

    it("should log additional enumerable properties from the normalized error object", () => {
      const customError = {
        message: "Custom error",
        code: 123,
        status: "FAILED",
        metadata: { key: "value" },
      };
      handleError(customError, "TestContext");

      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("[TestContext] Error: [TestContext] Custom error")
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("[TestContext] code: 123")
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('"status": "FAILED"')
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('"metadata": {"key":"value"}')
      );
    });

    it("should log stack trace when LOG_STACK_TRACE is enabled", () => {
      process.env[ENV_KEYS.NODE_ENV] = "production";
      process.env[ENV_KEYS.LOG_STACK_TRACE] = "true";
      const error = new Error("Test error");
      handleError(error, "TestContext");
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        "Stack Trace:",
        expect.stringContaining("Test error")
      );
    });

    it("should not log stack trace when DISABLE_STACK_TRACE is enabled", () => {
      process.env[ENV_KEYS.NODE_ENV] = "development";
      process.env[ENV_KEYS.DISABLE_STACK_TRACE] = "true";
      const error = new Error("Test error");
      handleError(error, "TestContext");
      expect(mockedLogger.debug).not.toHaveBeenCalledWith(
        "Stack Trace:",
        expect.anything()
      );
    });
  });

describe("Logger Environment Validation", () => {
    let mockedConsole: MockedConsole;
    let restoreConsole: () => void;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      const consoleMock = mockConsole();
      mockedConsole = consoleMock.mockedConsole;
      restoreConsole = consoleMock.restore;
      originalEnv = process.env;
    });

    afterEach(() => {
      restoreConsole();
      process.env = originalEnv;
    });

    it("should reject invalid LOG_LEVEL and log an error", () => {
      process.env[ENV_KEYS.LOG_LEVEL] = "invalid" as LogLevel;
      const logger = new Logger("info", "TEST");
      logger.updateFromEnv();
      expect(mockedConsole.error).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid ${ENV_KEYS.LOG_LEVEL}: invalid`)
      );
      expect(logger.getLogLevel()).toBe("info"); // Should retain current level
    });

    it("should apply valid LOG_LEVEL from environment", () => {
      process.env[ENV_KEYS.LOG_LEVEL] = "debug";
      const logger = new Logger("info", "TEST");
      logger.updateFromEnv();
      expect(logger.getLogLevel()).toBe("debug");
    });

    it("should update default logger with valid LOG_LEVEL", () => {
      process.env[ENV_KEYS.LOG_LEVEL] = "warn";
      updateLoggerFromEnv();
      expect(defaultLogger.getLogLevel()).toBe("warn");
    });

    it("should log an error for invalid LOG_LEVEL in default logger", () => {
      process.env[ENV_KEYS.LOG_LEVEL] = "invalid" as LogLevel;
      updateLoggerFromEnv();
      expect(mockedConsole.error).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid ${ENV_KEYS.LOG_LEVEL}: invalid`)
      );
      expect(defaultLogger.getLogLevel()).toBe("info"); // Default level
    });

    it("should update LOG_PREFIX from environment", () => {
      process.env[ENV_KEYS.LOG_PREFIX] = "UPDATED";
      const logger = new Logger("info", "OLD");
      logger.updateFromEnv();
      expect(logger.getPrefix()).toBe("UPDATED");
    });

    it("should retain current prefix if LOG_PREFIX is not set", () => {
      const logger = new Logger("info", "OLD");
      logger.updateFromEnv();
      expect(logger.getPrefix()).toBe("OLD");
    });

    it("should sanitize LOG_PREFIX by trimming whitespace and limiting length", () => {
      process.env[ENV_KEYS.LOG_PREFIX] = "  LONG_PREFIX_WITH_SPACES_AND_SPECIAL_CHARS_!@#  ";
      const logger = new Logger("info", "OLD");
      logger.updateFromEnv();
      expect(logger.getPrefix()).toBe("LONG_PREFIX_WITH_SPACES_AND_SPECIAL_CHARS_");
    });

    it("should handle non-string LOG_PREFIX by converting to string or defaulting to empty", () => {
      process.env[ENV_KEYS.LOG_PREFIX] = null as unknown as string;
      const logger = new Logger("info", "OLD");
      logger.updateFromEnv();
      expect(logger.getPrefix()).toBe("");
    });
  });

describe("updateLoggerFromEnv Function", () => {
    let mockedConsole: MockedConsole;
    let restoreConsole: () => void;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      const consoleMock = mockConsole();
      mockedConsole = consoleMock.mockedConsole;
      restoreConsole = consoleMock.restore;
      originalEnv = process.env;
    });

    afterEach(() => {
      restoreConsole();
      process.env = originalEnv;
    });

    it("should suppress console.error when suppressConsoleError is true and backend is console-based", () => {
      process.env[ENV_KEYS.LOG_LEVEL] = "invalid" as LogLevel;
      updateLoggerFromEnv(true); // suppressConsoleError = true
      expect(mockedConsole.error).not.toHaveBeenCalledWith(
        expect.stringContaining(`Invalid ${ENV_KEYS.LOG_LEVEL}: invalid`)
      );
    });

    it("should log to console.error when suppressConsoleError is false and backend is not console-based", () => {
      const customBackend = new MockLoggingBackend();
      defaultLogger.setBackend(customBackend);
      process.env[ENV_KEYS.LOG_LEVEL] = "invalid" as LogLevel;
      updateLoggerFromEnv(false); // suppressConsoleError = false
      expect(mockedConsole.error).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid ${ENV_KEYS.LOG_LEVEL}: invalid`)
      );
    });

    it("should update the logging backend based on LOG_BACKEND environment variable", () => {
      process.env.LOG_BACKEND = "console";
      const customBackend = new MockLoggingBackend();
      defaultLogger.setBackend(customBackend);
      updateLoggerFromEnv();
      expect(defaultLogger["backend"]).toBeInstanceOf(ConsoleLoggingBackend);
    });

    it("should apply custom logging backend when LOG_BACKEND is set to 'custom'", () => {
      const customBackend = new MockLoggingBackend();
      process.env.LOG_BACKEND = "custom";
      updateLoggerFromEnv(false, customBackend);
      expect(defaultLogger["backend"]).toBe(customBackend);
    });
  });

describe("assert Function", () => {
    let mockedConsole: MockedConsole;
    let restoreConsole: () => void;

    beforeEach(() => {
      const consoleMock = mockConsole();
      mockedConsole = consoleMock.mockedConsole;
      restoreConsole = consoleMock.restore;
    });

    afterEach(() => {
      restoreConsole();
    });

    it("should re-throw error when shouldRethrow is true", () => {
      expect(() => {
        assert(false, "Test error", "TestContext", false, true);
      }).toThrow("Test error");
    });

    it("should not re-throw error when shouldRethrow is false", () => {
      expect(() => {
        assert(false, "Test error", "TestContext", false, false);
      }).not.toThrow();
    });

    it("should handle custom error objects", () => {
      const customError = {
        message: "Custom error",
        code: 123,
        status: "FAILED",
      };
      try {
        assert(false, customError, "TestContext", false, true);
      } catch (error) {
        expect(error.message).toBe("[TestContext] Custom error");
        expect(error.code).toBe(123);
        expect(error.status).toBe("FAILED");
      }
    });

    it("should validate isFatal and shouldRethrow parameters to ensure they are boolean", () => {
      expect(() => {
        assert(false, "Test error", "TestContext", "invalid" as unknown as boolean, true);
      }).toThrow("Invalid parameters: 'isFatal' and 'shouldRethrow' must be boolean values.");

      expect(() => {
        assert(false, "Test error", "TestContext", false, "invalid" as unknown as boolean);
      }).toThrow("Invalid parameters: 'isFatal' and 'shouldRethrow' must be boolean values.");
    });
  });