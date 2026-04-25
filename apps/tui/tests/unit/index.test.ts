// tests/unit/index.test.ts

import { describe, it, expect, jest } from "@jest/globals";
import { validateWorkspaceRoot } from "../../src/index";
import { access } from "node:fs/promises";

// Mock node:fs/promises
jest.mock("node:fs/promises", () => ({
  access: jest.fn()
}));

describe("Index Utilities", () => {
  describe("validateWorkspaceRoot", () => {
    it("should not throw an error if workspaceRoot is a non-empty string and accessible", async () => {
      (access as jest.Mock).mockResolvedValue(undefined);
      await expect(validateWorkspaceRoot("/valid/path")).resolves.not.toThrow();
    });

    it("should throw an error if workspaceRoot is an empty string", async () => {
      await expect(validateWorkspaceRoot("")).rejects.toThrow("Workspace root must be a non-empty string.");
    });

    it("should throw an error if workspaceRoot is a string with only whitespace", async () => {
      await expect(validateWorkspaceRoot("   ")).rejects.toThrow("Workspace root must be a non-empty string.");
    });

    it("should throw an error if workspaceRoot is not a string", async () => {
      await expect(validateWorkspaceRoot(null as any)).rejects.toThrow("Workspace root must be a non-empty string.");
      await expect(validateWorkspaceRoot(undefined as any)).rejects.toThrow("Workspace root must be a non-empty string.");
      await expect(validateWorkspaceRoot(123 as any)).rejects.toThrow("Workspace root must be a non-empty string.");
    });

    it("should throw an error if workspaceRoot is inaccessible", async () => {
      (access as jest.Mock).mockRejectedValue(new Error("Access denied"));
      await expect(validateWorkspaceRoot("/inaccessible/path")).rejects.toThrow("Workspace root is inaccessible: /inaccessible/path");
    });
  });
});

describe("main Function", () => {
  it("should use the current working directory if process.env is not available", async () => {
    const originalEnv = process.env;
    // @ts-ignore
    delete process.env;
    
    const mockValidateWorkspaceRoot = jest.fn().mockResolvedValue(undefined);
    jest.mock("../../src/index", () => ({
      validateWorkspaceRoot: mockValidateWorkspaceRoot
    }));
    
    const { main } = require("../../src/index");
    
    await main();
    
    expect(mockValidateWorkspaceRoot).toHaveBeenCalledWith(process.cwd());
    
    process.env = originalEnv;
  });
});