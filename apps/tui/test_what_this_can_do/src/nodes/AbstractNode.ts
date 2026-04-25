// src/nodes/AbstractNode.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * Base class for all workflow nodes.
 * Defines the interface for execution and validation.
 */
export abstract class AbstractNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
  inputData: unknown;

  constructor(type: string, config: Record<string, unknown>) {
    this.id = uuidv4();
    this.type = type;
    this.config = config;
    this.inputData = null;
  }

  /**
   * Execute the node's logic.
   * @param inputData Data passed from the previous node.
   * @returns Output data to pass to the next node.
   */
  abstract execute(inputData: unknown): Promise<unknown>;

  /**
   * Validate the node's configuration.
   * @throws Error if configuration is invalid.
   */
  abstract validate(): void;

  /**
   * Set input data for the node (called by the workflow engine).
   * @param data Input data.
   */
  setInputData(data: unknown): void {
    this.inputData = data;
  }
}