// src/nodes/HttpNode.ts
import axios from 'axios';
import { AbstractNode } from './AbstractNode';

/**
 * Node for making HTTP requests.
 */
export class HttpNode extends AbstractNode {
  constructor(config: { url: string; method?: string; headers?: Record<string, string> }) {
    super('HttpNode', config);
  }

  async execute(): Promise<unknown> {
    const { url, method = 'GET', headers = {} } = this.config;
    try {
      const response = await axios({ url, method, headers });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  validate(): void {
    if (!this.config.url) {
      throw new Error('HTTP node requires a URL.');
    }
  }
}