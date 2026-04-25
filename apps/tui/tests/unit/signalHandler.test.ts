import { registerSignalHandlers, logSignalHandlers } from "../../src/utils/signalHandler";
import { logger } from "../../src/utils/logger";
import { EXIT_CODE } from "../../src/utils/constants";

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLogLevel: jest.fn(),
    setLogLevel: jest.fn(),
  },
  validateExitCodes: jest.fn(),
}));

describe("Signal Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logSignalHandlers", () => {
    it("should log available signal handlers", () => {
      logSignalHandlers();
      expect(logger.debug).toHaveBeenCalledWith(
        "Available signal handlers:",
        {
          SIGINT: "Graceful shutdown (Ctrl+C)",
          SIGTERM: "Graceful shutdown (termination request)",
          SIGUSR1: "Enable debugging output (if DEBUG_MODE is truthy)",
          SIGUSR2: "Toggle verbose logging (debug/info)",
        }
      );
    });
  });

  describe("registerSignalHandlers", () => {
    it("should register SIGINT handler for graceful shutdown", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {}
        as jest.Mock & ((code?: number) => never));

      registerSignalHandlers();
      process.emit("SIGINT");

      expect(logger.info).toHaveBeenCalledWith(
        "Received SIGINT. Shutting down gracefully..."
      );
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODE.SUCCESS);
    });

    it("should register SIGTERM handler for graceful shutdown", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {}
        as jest.Mock & ((code?: number) => never));

      registerSignalHandlers();
      process.emit("SIGTERM");

      expect(logger.info).toHaveBeenCalledWith(
        "Received SIGTERM. Shutting down gracefully..."
      );
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODE.SUCCESS);
    });

    it("should enable debugging output on SIGUSR1 if DEBUG_MODE is enabled", () => {
      process.env.DEBUG_MODE = "true";

      registerSignalHandlers();
      process.emit("SIGUSR1");

      expect(logger.info).toHaveBeenCalledWith(
        "Debugging output enabled via SIGUSR1."
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "Current process state:",
        expect.objectContaining({
          env: process.env,
          pid: process.pid,
          uptime: expect.any(Number),
          memoryUsage: expect.any(Object),
          cpuUsage: expect.any(Object),
        })
      );
    });

    it("should warn if DEBUG_MODE is not enabled on SIGUSR1", () => {
      process.env.DEBUG_MODE = "false";

      registerSignalHandlers();
      process.emit("SIGUSR1");

      expect(logger.warn).toHaveBeenCalledWith(
        "DEBUG_MODE is not enabled. Set DEBUG_MODE=true to enable debugging output."
      );
    });

    it("should toggle verbose logging on SIGUSR2", () => {
      (logger.getLogLevel as jest.Mock).mockReturnValue("info");

      registerSignalHandlers();
      process.emit("SIGUSR2");

      expect(logger.setLogLevel).toHaveBeenCalledWith("debug");
      expect(logger.info).toHaveBeenCalledWith(
        "Verbose logging enabled via SIGUSR2."
      );
    });

    it("should disable verbose logging on SIGUSR2 if already enabled", () => {
      (logger.getLogLevel as jest.Mock).mockReturnValue("debug");

      registerSignalHandlers();
      process.emit("SIGUSR2");

      expect(logger.setLogLevel).toHaveBeenCalledWith("info");
      expect(logger.info).toHaveBeenCalledWith(
        "Verbose logging disabled via SIGUSR2."
      );
    });
  });
});