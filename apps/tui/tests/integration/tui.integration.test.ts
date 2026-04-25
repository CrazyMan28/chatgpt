// tests/integration/tui.integration.test.ts

import { describe, it, expect, jest } from "@jest/globals";
import { TUI } from "../../src/index";
import { mockRuntimeCore } from "../__mocks__/@chatgpt-code/runtime-core";
import { mockStorage } from "../__mocks__/@chatgpt-code/storage-sqlite";

// Mock external dependencies
jest.mock("@chatgpt-code/runtime-core", () => mockRuntimeCore);
jest.mock("@chatgpt-code/storage-sqlite", () => mockStorage);

describe("TUI Integration Tests", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockRuntimeCore.reset();
    mockStorage.reset();
  });

  it("should initialize TUI with mocked runtime and storage", () => {
    const tui = new TUI();
    expect(tui).toBeDefined();
    expect(tui.runtime).toBeDefined();
    expect(tui.storage).toBeDefined();
  });

  it("should handle basic user interaction flow", async () => {
    const tui = new TUI();
    
    // Simulate user input
    const mockUserInput = "test input";
    mockRuntimeCore.simulateUserInput(mockUserInput);
    
    // Simulate TUI processing
    const response = await tui.processInput(mockUserInput);
    
    // Verify TUI response
    expect(response).toBeDefined();
    expect(mockRuntimeCore.getUserInput).toHaveBeenCalled();
  });

  it("should handle empty user input gracefully", async () => {
    const tui = new TUI();
    
    // Simulate empty user input
    const mockUserInput = "";
    mockRuntimeCore.simulateUserInput(mockUserInput);
    
    // Simulate TUI processing
    const response = await tui.processInput(mockUserInput);
    
    // Verify TUI response for empty input
    expect(response).toBeDefined();
    expect(mockRuntimeCore.getUserInput).toHaveBeenCalled();
  });

  it("should handle invalid user input gracefully", async () => {
    const tui = new TUI();
    
    // Simulate invalid user input
    const mockUserInput = null;
    mockRuntimeCore.simulateUserInput(mockUserInput);
    
    // Simulate TUI processing
    const response = await tui.processInput(mockUserInput);
    
    // Verify TUI response for invalid input
    expect(response).toBeDefined();
    expect(mockRuntimeCore.getUserInput).toHaveBeenCalled();
  });

  it("should persist and retrieve data via storage", async () => {
    const tui = new TUI();
    
    // Test data persistence
    const testKey = "testKey";
    const testData = { value: "testValue" };
    await tui.storage.save(testKey, testData);
    
    // Verify data was saved
    expect(mockStorage.save).toHaveBeenCalledWith(testKey, testData);
    
    // Test data retrieval
    const retrievedData = await tui.storage.get(testKey);
    
    // Verify data was retrieved
    expect(mockStorage.get).toHaveBeenCalledWith(testKey);
    expect(retrievedData).toEqual(testData);
  });

  it("should handle storage errors gracefully", async () => {
    const tui = new TUI();
    
    // Simulate storage failure
    mockStorage.simulateFailure = true;
    
    // Attempt to save data
    const testKey = "testKey";
    const testData = { value: "testValue" };
    
    // Verify error handling
    await expect(tui.storage.save(testKey, testData)).rejects.toThrow("Storage failure");
  });
});