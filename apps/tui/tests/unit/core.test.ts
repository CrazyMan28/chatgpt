// Unit Tests for TUI Core Functionality
// Tests critical logic in the TUI initialization and execution flow.

import { describe, it, expect, jest } from "@jest/globals";
import { runStandaloneTui } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "@chatgpt-code/storage-sqlite";

// Use the mock implementations from the __mocks__ directory
jest.mock("@chatgpt-code/runtime-core");
jest.mock("@chatgpt-code/storage-sqlite");

// Mock fs module
jest.mock("fs", () => ({
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock constants
jest.mock("../../src/utils/constants", () => ({
  ENV_KEYS: {
    DEBUG_MODE: "DEBUG_MODE",
  },
}));

describe("TUI Core Initialization", () => {
  beforeEach(() => {
    delete process.env.DEBUG_MODE; // Ensure DEBUG_MODE is not set
  });

  it("should initialize the database and run the TUI", async () => {
    const { main } = require("../../src/index");
    await main();
    expect(PlatformDatabase).toHaveBeenCalled();
    expect(runStandaloneTui).toHaveBeenCalled();
  });

  it("should handle database migration failure", async () => {
    const mockError = new Error("Migration failed");
    require("@chatgpt-code/storage-sqlite").PlatformDatabase.mockImplementationOnce(() => ({
      migrateToLatest: jest.fn().mockRejectedValue(mockError),
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const { main } = require("../../src/index");
    await expect(main()).rejects.toThrow("Migration failed");
  });

  it("should handle workspace validation failure", async () => {
    jest.spyOn(require("fs").promises, "access").mockRejectedValue(new Error("Workspace inaccessible"));
    const { main } = require("../../src/index");
    await expect(main()).rejects.toThrow("Workspace directory does not exist or is inaccessible");
  });

  it("should close the database connection after execution", async () => {
    const mockClose = jest.fn().mockResolvedValue(undefined);
    require("@chatgpt-code/storage-sqlite").PlatformDatabase.mockImplementationOnce(() => ({
      migrateToLatest: jest.fn().mockResolvedValue(undefined),
      close: mockClose,
    }));

    const { main } = require("../../src/index");
    await main();
    expect(mockClose).toHaveBeenCalled();
  });

  it("should close the database connection even if an error occurs", async () => {
    const mockError = new Error("TUI execution failed");
    const mockClose = jest.fn().mockResolvedValue(undefined);
    require("@chatgpt-code/storage-sqlite").PlatformDatabase.mockImplementationOnce(() => ({
      migrateToLatest: jest.fn().mockResolvedValue(undefined),
      close: mockClose,
    }));
    require("@chatgpt-code/runtime-core").runStandaloneTui.mockRejectedValue(mockError);

    const { main } = require("../../src/index");
    await expect(main()).rejects.toThrow("TUI execution failed");
    expect(mockClose).toHaveBeenCalled();
  });

  it("should handle legacy workspace state migration failure", async () => {
    const mockError = new Error("Legacy migration failed");
    const mockClose = jest.fn().mockResolvedValue(undefined);
    require("@chatgpt-code/storage-sqlite").PlatformDatabase.mockImplementationOnce(() => ({
      migrateToLatest: jest.fn().mockResolvedValue(undefined),
      close: mockClose,
    }));
    require("@chatgpt-code/storage-sqlite").migrateLegacyWorkspaceState.mockRejectedValue(mockError);

    const { main } = require("../../src/index");
    await main(); // Should not throw as the error is handled gracefully
    expect(mockClose).toHaveBeenCalled();
  });

  it("should log the resolved vault passphrase in debug mode", async () => {
    process.env.DEBUG_MODE = "true";
    const { logger } = require("../../src/utils/logger");
    const { main } = require("../../src/index");

    await main();
    expect(logger.debug).toHaveBeenCalledWith("Resolved vault passphrase: [REDACTED]");
  });

  it("should redact the vault passphrase in debug logs", async () => {
    process.env.DEBUG_MODE = "true";
    const { logger } = require("../../src/utils/logger");
    const { main } = require("../../src/index");

    await main();
    // Verify that the passphrase is redacted in the log
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("[REDACTED]"));
  });

  it("should not log the resolved vault passphrase when DEBUG_MODE is not set", async () => {
    const { logger } = require("../../src/utils/logger");
    const { main } = require("../../src/index");

    await main();
    expect(logger.debug).not.toHaveBeenCalledWith("Resolved vault passphrase: [REDACTED]");
  });

  it("should log migration errors but still run the TUI", async () => {
    const mockError = new Error("Migration failed");
    const mockClose = jest.fn().mockResolvedValue(undefined);
    require("@chatgpt-code/storage-sqlite").PlatformDatabase.mockImplementationOnce(() => ({
      migrateToLatest: jest.fn().mockRejectedValue(mockError),
      close: mockClose,
    }));
    require("@chatgpt-code/runtime-core").runStandaloneTui.mockResolvedValue(undefined);

    const { logger } = require("../../src/utils/logger");
    const { main } = require("../../src/index");

    await main();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Migration failed"));
    expect(runStandaloneTui).toHaveBeenCalled();
  });

  it("should log TUI execution failure and exit gracefully", async () => {
    const mockError = new Error("TUI execution failed");
    const mockClose = jest.fn().mockResolvedValue(undefined);
    require("@chatgpt-code/storage-sqlite").PlatformDatabase.mockImplementationOnce(() => ({
      migrateToLatest: jest.fn().mockResolvedValue(undefined),
      close: mockClose,
    }));
    require("@chatgpt-code/runtime-core").runStandaloneTui.mockRejectedValue(mockError);

    const { logger } = require("../../src/utils/logger");
    const { main } = require("../../src/index");

    await expect(main()).rejects.toThrow("TUI execution failed");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("TUI execution failed"));
    expect(mockClose).toHaveBeenCalled();
  });
});