// tests/unit/constants.test.ts

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  validateEnvKeys,
  validateExitCodes,
  validateLogLevels,
  validateFallbackLogLevel,
  validateLogPrefix,
  validateSuccessExitCode,
  validateTimeouts,
  validateRetries,
  validateLogBackends,
  validateRuntimeLogBackend,
  VALID_LOG_LEVELS,
  ENV_KEYS,
} from "../../src/utils/constants";

describe("Constants Utilities", () => {
  describe("validateEnvKeys", () => {
    it("should throw an error if envKeys is not an object", () => {
      expect(() => validateEnvKeys(null as any)).toThrow("Environment keys must be an object.");
      expect(() => validateEnvKeys(undefined as any)).toThrow("Environment keys must be an object.");
      expect(() => validateEnvKeys("invalid" as any)).toThrow("Environment keys must be an object.");
    });

    it("should throw an error if envKeys is an empty object", () => {
      expect(() => validateEnvKeys({})).toThrow("No environment keys provided.");
    });

    it("should throw an error if any envKey value is not a non-empty string", () => {
      const invalidEnvKeys1 = { KEY1: "", KEY2: "valid" };
      const invalidEnvKeys2 = { KEY1: 123, KEY2: "valid" };
      const invalidEnvKeys3 = { KEY1: null as any, KEY2: "valid" };

      expect(() => validateEnvKeys(invalidEnvKeys1)).toThrow("Must be a non-empty string");
      expect(() => validateEnvKeys(invalidEnvKeys2)).toThrow("Must be a non-empty string");
      expect(() => validateEnvKeys(invalidEnvKeys3)).toThrow("Must be a non-empty string");
    });

    it("should not throw an error for valid envKeys", () => {
      const validEnvKeys = { KEY1: "VALUE1", KEY2: "VALUE2" };
      expect(() => validateEnvKeys(validEnvKeys)).not.toThrow();
    });
  });

  describe("validateExitCodes", () => {
    it("should throw an error if exitCodes is not an object", () => {
      expect(() => validateExitCodes(null as any)).toThrow("Exit codes must be an object.");
      expect(() => validateExitCodes(undefined as any)).toThrow("Exit codes must be an object.");
      expect(() => validateExitCodes("invalid" as any)).toThrow("Exit codes must be an object.");
    });

    it("should throw an error if exitCodes is an empty object", () => {
      expect(() => validateExitCodes({})).toThrow("No exit codes provided.");
    });

    it("should throw an error if any exitCode value is not an integer", () => {
      const invalidExitCodes1 = { SUCCESS: 0, ERROR: "invalid" };
      const invalidExitCodes2 = { SUCCESS: 0, ERROR: 1.5 };

      expect(() => validateExitCodes(invalidExitCodes1 as any)).toThrow("Must be an integer");
      expect(() => validateExitCodes(invalidExitCodes2 as any)).toThrow("Must be an integer");
    });

    it("should not throw an error for valid exitCodes", () => {
      const validExitCodes = { SUCCESS: 0, ERROR: 1, INVALID_ARGS: 2 };
      expect(() => validateExitCodes(validExitCodes)).not.toThrow();
    });
  });

  describe("validateLogLevels", () => {
    it("should throw an error if logLevels is not an object", () => {
      expect(() => validateLogLevels(null as any)).toThrow("Log levels must be an object.");
      expect(() => validateLogLevels(undefined as any)).toThrow("Log levels must be an object.");
      expect(() => validateLogLevels("invalid" as any)).toThrow("Log levels must be an object.");
    });

    it("should throw an error if logLevels is an empty object", () => {
      expect(() => validateLogLevels({})).toThrow("No log levels provided.");
    });

    it("should throw an error if any logLevel value is not valid", () => {
      const invalidLogLevels = { ERROR: "error", WARN: "invalid" };

      expect(() => validateLogLevels(invalidLogLevels)).toThrow("Must be one of");
    });

    it("should not throw an error for valid logLevels", () => {
      const validLogLevels = { ERROR: "error", WARN: "warn", INFO: "info" };
      expect(() => validateLogLevels(validLogLevels)).not.toThrow();
    });
  });

  describe("validateFallbackLogLevel", () => {
    it("should throw an error if fallbackLogLevel is not valid", () => {
      expect(() => validateFallbackLogLevel("invalid")).toThrow("Must be one of");
    });

    it("should not throw an error for valid fallbackLogLevel", () => {
      VALID_LOG_LEVELS.forEach((level) => {
        expect(() => validateFallbackLogLevel(level)).not.toThrow();
      });
    });
  });

  describe("validateLogPrefix", () => {
    it("should throw an error if logPrefix is not a non-empty string", () => {
      expect(() => validateLogPrefix("")).toThrow("Must be a non-empty string");
      expect(() => validateLogPrefix("   ")).toThrow("Must not contain whitespace");
      expect(() => validateLogPrefix("invalid\nprefix")).toThrow("Must not contain whitespace");
    });

    it("should not throw an error for valid logPrefix", () => {
      expect(() => validateLogPrefix("[YoYo]")).not.toThrow();
    });
  });

  describe("validateSuccessExitCode", () => {
    it("should throw an error if successCode is not equal to 0", () => {
      expect(() => validateSuccessExitCode(1)).toThrow("Must be equal to 0");
    });

    it("should not throw an error for valid successCode", () => {
      expect(() => validateSuccessExitCode(0)).not.toThrow();
    });
  });

  describe("validateTimeouts", () => {
    it("should throw an error if timeouts is not an object", () => {
      expect(() => validateTimeouts(null as any)).toThrow("Timeouts must be an object.");
      expect(() => validateTimeouts(undefined as any)).toThrow("Timeouts must be an object.");
      expect(() => validateTimeouts("invalid" as any)).toThrow("Timeouts must be an object.");
    });

    it("should throw an error if timeouts is an empty object", () => {
      expect(() => validateTimeouts({})).toThrow("No timeouts provided.");
    });

    it("should throw an error if any timeout value is not a positive integer", () => {
      const invalidTimeouts1 = { DEFAULT: 5000, NETWORK: -1000 };
      const invalidTimeouts2 = { DEFAULT: 5000, NETWORK: 1000.5 };

      expect(() => validateTimeouts(invalidTimeouts1)).toThrow("Must be a positive integer");
      expect(() => validateTimeouts(invalidTimeouts2)).toThrow("Must be a positive integer");
    });

    it("should not throw an error for valid timeouts", () => {
      const validTimeouts = { DEFAULT: 5000, NETWORK: 10000 };
      expect(() => validateTimeouts(validTimeouts)).not.toThrow();
    });
  });

  describe("validateRetries", () => {
    it("should throw an error if retries is not an object", () => {
      expect(() => validateRetries(null as any)).toThrow("Retries must be an object.");
      expect(() => validateRetries(undefined as any)).toThrow("Retries must be an object.");
      expect(() => validateRetries("invalid" as any)).toThrow("Retries must be an object.");
    });

    it("should throw an error if retries is an empty object", () => {
      expect(() => validateRetries({})).toThrow("No retries provided.");
    });

    it("should throw an error if any retry value is not a positive integer", () => {
      const invalidRetries1 = { DEFAULT: 3, NETWORK: -5 };
      const invalidRetries2 = { DEFAULT: 3, NETWORK: 5.5 };

      expect(() => validateRetries(invalidRetries1)).toThrow("Must be a positive integer");
      expect(() => validateRetries(invalidRetries2)).toThrow("Must be a positive integer");
    });

    it("should not throw an error for valid retries", () => {
      const validRetries = { DEFAULT: 3, NETWORK: 5 };
      expect(() => validateRetries(validRetries)).not.toThrow();
    });
  });

  describe("validateLogBackends", () => {
    it("should throw an error if logBackends is not an array", () => {
      expect(() => validateLogBackends(null as any)).toThrow("Log backends must be an array.");
      expect(() => validateLogBackends(undefined as any)).toThrow("Log backends must be an array.");
      expect(() => validateLogBackends("invalid" as any)).toThrow("Log backends must be an array.");
    });

    it("should throw an error if logBackends is an empty array", () => {
      expect(() => validateLogBackends([])).toThrow("No log backends provided.");
    });

    it("should throw an error if any logBackend value is not a non-empty string", () => {
      const invalidLogBackends1 = ["console", ""];
      const invalidLogBackends2 = ["console", 123];
      const invalidLogBackends3 = ["console", null as any];

      expect(() => validateLogBackends(invalidLogBackends1)).toThrow("Must be a non-empty string");
      expect(() => validateLogBackends(invalidLogBackends2)).toThrow("Must be a non-empty string");
      expect(() => validateLogBackends(invalidLogBackends3)).toThrow("Must be a non-empty string");
    });

    it("should throw an error if logBackends contains duplicate values", () => {
      const duplicateLogBackends = ["console", "console"];
      expect(() => validateLogBackends(duplicateLogBackends)).toThrow("Duplicate log backends found");
    });

    it("should not throw an error for valid logBackends", () => {
      const validLogBackends = ["console", "custom"];
      expect(() => validateLogBackends(validLogBackends)).not.toThrow();
    });
  });

  describe("validateRuntimeLogBackend", () => {
    beforeEach(() => {
      // Reset environment variables before each test
      delete process.env[ENV_KEYS.LOG_BACKEND];
    });

    it("should not throw an error if LOG_BACKEND is not set", () => {
      expect(() => validateRuntimeLogBackend()).not.toThrow();
    });

    it("should not throw an error if LOG_BACKEND is set to a valid value", () => {
      process.env[ENV_KEYS.LOG_BACKEND] = "console";
      expect(() => validateRuntimeLogBackend()).not.toThrow();
    });

    it("should throw an error if LOG_BACKEND is set to an invalid value", () => {
      process.env[ENV_KEYS.LOG_BACKEND] = "invalid";
      expect(() => validateRuntimeLogBackend()).toThrow("Invalid LOG_BACKEND environment variable");
    });

    it("should not throw an error if LOG_BACKEND is set to a valid value (case-insensitive)", () => {
      process.env[ENV_KEYS.LOG_BACKEND] = "Console"; // Mixed case
      expect(() => validateRuntimeLogBackend()).not.toThrow();
    });

    it("should throw an error if process.env is not available", () => {
      const originalProcessEnv = process.env;
      // @ts-ignore
      delete process.env;
      
      expect(() => validateRuntimeLogBackend()).toThrow("process.env is not available. Cannot validate LOG_BACKEND.");
      
      // Restore process.env
      process.env = originalProcessEnv;
    });
  });
});