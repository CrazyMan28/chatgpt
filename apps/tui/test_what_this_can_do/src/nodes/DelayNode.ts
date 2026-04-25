// src/nodes/DelayNode.ts
import { AbstractNode } from './AbstractNode';

/**
 * Node for pausing execution for a specified time.
 */
export class DelayNode extends AbstractNode {
  constructor(config: { delayMs: number }) {
    super('DelayNode', config);
  }

  async execute(inputData: unknown): Promise<unknown> {
    const { delayMs } = this.config;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return inputData; // Pass through input data
  }

  validate(): void {
    if (typeof this.config.delayMs !== 'number' || this.config.delayMs <= 0) {
      throw new Error('Delay node requires a positive delayMs value.');
    }
  }
}