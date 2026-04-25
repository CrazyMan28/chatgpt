import { Logger, ConsoleLoggingBackend, updateLoggerFromEnv, isValidLoggingBackend, validateSuppressConsoleError, sanitizeString } from "../../src/utils/logger";
import { ENV_KEYS } from "../../src/utils/constants";

// Mock console methods to capture logs
declare const globalThis: {
  mockConsole: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    trace: jest.Mock;
  };
};

globalThis.mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  trace: jest.fn(),
};

// Mock ConsoleLoggingBackend to use the mock console
class MockConsoleLoggingBackend extends ConsoleLoggingBackend {
  constructor(suppressConsoleError: boolean = false) {
    super(suppressConsoleError);
  }

  debug(message: string, ...meta: unknown[]): void {
    globalThis.mockConsole.debug(message, ...meta);
  }

  info(message: string, ...meta: unknown[]): void {
    globalThis.mockConsole.info(message, ...meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    globalThis.mockConsole.warn(message, ...meta);
  }

  error(message: string, ...meta: unknown[]): void {
    globalThis.mockConsole.error(message, ...meta);
  }

  trace(message: string, ...meta: unknown[]): void {
    globalThis.mockConsole.trace(message, ...meta);
  }
}

describe("Logger", () => {
  let logger: Logger;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save the original environment variables
    originalEnv = { ...process.env };
    // Reset mocks
    jest.clearAllMocks();
    // Initialize logger with default settings
    logger = new Logger("info", "", new MockConsoleLoggingBackend());
  });

  afterEach(() => {
    // Restore the original environment variables
    process.env = originalEnv;
  });

  describe("sanitizeString", () => {
    it("should return a sanitized string for valid input", () => {
      const result = sanitizeString("  test  ");
      expect(result).toBe("test");
    });

    it("should handle non-string inputs by converting them to a string", () => {
      const result = sanitizeString(123);
      expect(result).toBe("123");
    });

    it("should replace non-printable characters with a space", () => {
      const result = sanitizeString("test\x01\x02");
      expect(result).toBe("test  ");
    });

    it("should handle null and undefined inputs", () => {
      const resultNull = sanitizeString(null);
      const resultUndefined = sanitizeString(undefined);
      expect(resultNull).toBe("");
      expect(resultUndefined).toBe("");
    });

    it("should limit the length of the output string", () => {
      const longString = "a".repeat(100);
      const result = sanitizeString(longString);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe("updateLoggerFromEnv", () => {
    it("should update log level from environment variable", () => {
      process.env[ENV_KEYS.LOG_LEVEL] = "debug";
      updateLoggerFromEnv();
      expect(logger.getLogLevel()).toBe("debug");
    });

    it("should not update log level if environment variable is invalid", () => {
      process.env[ENV_KEYS.LOG_LEVEL] = "invalid" as any;
      updateLoggerFromEnv();
      expect(logger.getLogLevel()).toBe("info");
      expect(globalThis.mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid LOG_LEVEL"),
        expect.anything()
      );
    });

    it("should update log prefix from environment variable", () => {
      process.env[ENV_KEYS.LOG_PREFIX] = "test-prefix";
      updateLoggerFromEnv();
      expect(logger.getPrefix()).toBe("test-prefix");
    });

    it("should sanitize log prefix from environment variable", () => {
      process.env[ENV_KEYS.LOG_PREFIX] = "  unsanitized  ";
      updateLoggerFromEnv();
      expect(logger.getPrefix()).toBe("unsanitized");
    });

    it("should use console backend if LOG_BACKEND is set to 'console'", () => {
      process.env.LOG_BACKEND = "console";
      updateLoggerFromEnv();
      expect(logger.getPrefix()).toBe("");
    });

    it("should not update backend if LOG_BACKEND is invalid", () => {
      process.env.LOG_BACKEND = "invalid";
      updateLoggerFromEnv();
      expect(globalThis.mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid LOG_BACKEND"),
        expect.anything()
      );
    });

    it("should use custom backend if LOG_BACKEND is set to 'custom' and customBackend is provided", () => {
      const customBackend = new MockConsoleLoggingBackend();
      process.env.LOG_BACKEND = "custom";
      updateLoggerFromEnv(false, customBackend);
      expect(logger.getPrefix()).toBe("");
    });

    it("should not update backend if LOG_BACKEND is 'custom' but no customBackend is provided", () => {
      process.env.LOG_BACKEND = "custom";
      updateLoggerFromEnv();
      expect(globalThis.mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining("LOG_BACKEND is set to 'custom' but no customBackend is provided"),
        expect.anything()
      );
    });

    it("should validate suppressConsoleError parameter", () => {
      const result = validateSuppressConsoleError("invalid");
      expect(result).toBe(false);
    });

    it("should validate customBackend parameter", () => {
      const validBackend = new MockConsoleLoggingBackend();
      const invalidBackend = { debug: "not a function" };

      expect(isValidLoggingBackend(validBackend)).toBe(true);
      expect(isValidLoggingBackend(invalidBackend)).toBe(false);
    });
  });
});