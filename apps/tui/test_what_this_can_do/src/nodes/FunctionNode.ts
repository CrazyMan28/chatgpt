// src/nodes/FunctionNode.ts
import { AbstractNode } from './AbstractNode';

/**
 * Node for executing custom JavaScript functions.
 */
export class FunctionNode extends AbstractNode {
  constructor(config: { code: string }) {
    super('FunctionNode', config);
  }

  async execute(inputData: unknown): Promise<unknown> {
    const { code } = this.config;
    try {
      // Create a function from the user-provided code
      const func = new Function('input', code);
      return func(inputData);
    } catch (error) {
      throw new Error(`Function execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  validate(): void {
    if (!this.config.code) {
      throw new Error('Function node requires code.');
    }
  }
}