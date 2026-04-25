// tests/unit/errorHandler.assert.test.ts

import { describe, it, expect } from "@jest/globals";
import { assert } from "../../src/utils/errorHandler";
import { logger as defaultLogger } from "../../src/utils/logger";

describe("assert", () => {
  it("should not throw an error if the condition is true", () => {
    expect(() => assert(true, "Error message", "Test Context", false, false, defaultLogger)).not.toThrow();
  });

  it("should throw an error if the condition is false", () => {
    expect(() => assert(false, "Error message", "Test Context", false, true, defaultLogger)).toThrow("Error message");
  });

  it("should throw an error if the condition is not a boolean", () => {
    expect(() => assert("not a boolean" as any, "Error message", "Test Context", false, true, defaultLogger)).toThrow("Invalid condition: 'condition' must be a boolean value.");
  });

  it("should throw an error if isFatal is not a boolean", () => {
    expect(() => assert(false, "Error message", "Test Context", "not a boolean" as any, true, defaultLogger)).toThrow("Invalid parameters: 'isFatal' and 'shouldRethrow' must be boolean values.");
  });

  it("should throw an error if shouldRethrow is not a boolean", () => {
    expect(() => assert(false, "Error message", "Test Context", false, "not a boolean" as any, defaultLogger)).toThrow("Invalid parameters: 'isFatal' and 'shouldRethrow' must be boolean values.");
  });

  it("should throw an error if the error parameter is null", () => {
    expect(() => assert(false, null as any, "Test Context", false, true, defaultLogger)).toThrow("Invalid error: 'error' must be a string or an object with a 'message' property.");
  });

  it("should throw an error if the error parameter is undefined", () => {
    expect(() => assert(false, undefined as any, "Test Context", false, true, defaultLogger)).toThrow("Invalid error: 'error' must be a string or an object with a 'message' property.");
  });

  it("should throw an error if the error parameter is an object without a message property", () => {
    expect(() => assert(false, { key: "value" } as any, "Test Context", false, true, defaultLogger)).toThrow("Invalid error object: 'error' must be a string or an object with a 'message' property.");
  });

  it("should throw an error with context if the error parameter is an object with a message property", () => {
    const errorObj = { message: "Custom error message", code: 123 };
    expect(() => assert(false, errorObj, "Test Context", false, true, defaultLogger)).toThrow("[Test Context] Custom error message");
  });
});