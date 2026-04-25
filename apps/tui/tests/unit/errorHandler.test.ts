// tests/unit/errorHandler.test.ts

import { describe, it, expect } from "@jest/globals";
import { assert, extractErrorDetails } from "../../src/utils/errorHandler";
import { logger } from "../../src/utils/logger";

describe("Error Handler Utilities", () => {
  describe("assert", () => {
    it("should not throw an error if the condition is true", () => {
      expect(() => assert(true, "Error message")).not.toThrow();
    });

    it("should throw an error if the condition is false", () => {
      expect(() => assert(false, "Error message")).toThrow("Error message");
    });

    it("should throw an error if the condition is not a boolean", () => {
      expect(() => assert("invalid" as any, "Error message")).toThrow("Invalid condition: 'condition' must be a boolean value.");
    });

    it("should throw an error if isFatal is not a boolean", () => {
      expect(() => assert(false, "Error message", "Context", "invalid" as any)).toThrow("Invalid parameters: 'isFatal' and 'shouldRethrow' must be boolean values.");
    });

    it("should throw an error if shouldRethrow is not a boolean", () => {
      expect(() => assert(false, "Error message", "Context", false, "invalid" as any)).toThrow("Invalid parameters: 'isFatal' and 'shouldRethrow' must be boolean values.");
    });

    it("should throw an error if the error parameter is null or undefined", () => {
      expect(() => assert(false, null as any)).toThrow("Invalid error: 'error' must be a string or an object with a 'message' property.");
      expect(() => assert(false, undefined as any)).toThrow("Invalid error: 'error' must be a string or an object with a 'message' property.");
    });

    it("should throw an error if the error parameter is not a string or an object with a message property", () => {
      expect(() => assert(false, 123 as any)).toThrow("Invalid error object: 'error' must be a string or an object with a 'message' property.");
      expect(() => assert(false, { message: 123 } as any)).toThrow("Invalid error object: 'error' must be a string or an object with a 'message' property.");
    });

    it("should use a custom logger if provided", () => {
      const customLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        getLogLevel: jest.fn(),
        setLogLevel: jest.fn(),
      };
      expect(() => assert(false, "Error message", "Context", false, true, customLogger as any)).toThrow("Error message");
      expect(customLogger.error).toHaveBeenCalled();
    });
  });

  describe("extractErrorDetails", () => {
    it("should extract message and stack from an Error object", () => {
      const error = new Error("Test error");
      const details = extractErrorDetails(error);
      expect(details.message).toBe("Test error");
      expect(details.stack).toBeDefined();
    });

    it("should handle non-Error objects with a message property", () => {
      const error = { message: "Custom error", code: 123 };
      const details = extractErrorDetails(error);
      expect(details.message).toBe("Custom error");
      expect(details.code).toBe(123);
    });

    it("should handle string inputs", () => {
      const details = extractErrorDetails("String error");
      expect(details.message).toBe("String error");
      expect(details.stack).toBeUndefined();
    });

    it("should handle null and undefined inputs", () => {
      const nullDetails = extractErrorDetails(null);
      const undefinedDetails = extractErrorDetails(undefined);
      expect(nullDetails.message).toBe("Unknown error");
      expect(undefinedDetails.message).toBe("Unknown error");
    });

    it("should include additional properties from the error object", () => {
      const error = new Error("Test error");
      (error as any).customProperty = "custom value";
      const details = extractErrorDetails(error);
      expect(details.message).toBe("Test error");
      expect(details.customProperty).toBe("custom value");
    });
  });
});