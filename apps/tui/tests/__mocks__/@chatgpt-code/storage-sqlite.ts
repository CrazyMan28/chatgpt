// Mock implementation for @chatgpt-code/storage-sqlite
// Enhanced to simulate failure scenarios for better test coverage

const mockStorage = {
  // Default successful behavior
  connect: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue("mocked data"),
  close: jest.fn().mockResolvedValue(undefined),
  
  // Simulate connection failure
  simulateConnectionFailure: () => {
    mockStorage.connect.mockRejectedValue(new Error("Connection failed"));
  },
  
  // Simulate save failure
  simulateSaveFailure: () => {
    mockStorage.save.mockRejectedValue(new Error("Save operation failed"));
  },
  
  // Simulate get failure
  simulateGetFailure: () => {
    mockStorage.get.mockRejectedValue(new Error("Get operation failed"));
  },
  
  // Reset all mocks to default behavior
  reset: () => {
    mockStorage.connect.mockReset().mockResolvedValue(undefined);
    mockStorage.save.mockReset().mockResolvedValue(undefined);
    mockStorage.get.mockReset().mockResolvedValue("mocked data");
    mockStorage.close.mockReset().mockResolvedValue(undefined);
  },
};

export default mockStorage;