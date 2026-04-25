// src/nodes/BaseNode.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * Abstract base class for all workflow nodes.
 * Concrete nodes must implement the `execute` method.
 */
export abstract class BaseNode {
  id: string;
  type: string;
  name: string;

  constructor(type: string, name: string) {
    this.id = uuidv4();
    this.type = type;
    this.name = name;
  }

  /**
   * Execute the node with the given input data.
   * @param inputData Data passed from the previous node or workflow trigger.
   * @returns Output data to pass to the next node.
   */
  abstract execute(inputData: any): Promise<any>;

  /**
   * Serialize the node to a JSON-compatible object.
   */
  serialize(): Record<string, any> {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
    };
  }

  /**
   * Deserialize a JSON object into a node.
   * Note: Concrete nodes should override this to handle custom config.
   */
  static deserialize(data: Record<string, any>): BaseNode {
    const node = new (this as any)(data.type, data.name);
    Object.assign(node, data);
    return node;
  }
}