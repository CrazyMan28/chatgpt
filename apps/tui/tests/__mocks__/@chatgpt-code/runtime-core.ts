// Mock implementation for @chatgpt-code/runtime-core
// Placeholder for testing purposes

export const mockRuntimeCore = {
  // Mock functions and properties here
  initialize: jest.fn().mockResolvedValue(undefined),
  execute: jest.fn().mockResolvedValue("mocked result"),
  debug: jest.fn().mockImplementation((message: string) => {
    console.log(`[DEBUG] ${message}`);
  }),
};

export default mockRuntimeCore;