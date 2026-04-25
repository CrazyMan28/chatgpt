// src/workflows/Workflow.ts
import { AbstractNode } from '../nodes/AbstractNode';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a workflow composed of nodes and connections.
 */
export class Workflow {
  id: string;
  nodes: Map<string, AbstractNode>;
  connections: Array<{ from: string; to: string }>;

  constructor(id?: string) {
    this.id = id || uuidv4();
    this.nodes = new Map();
    this.connections = [];
  }

  /**
   * Add a node to the workflow.
   * @param node Node instance.
   */
  addNode(node: AbstractNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Add a connection between two nodes.
   * @param from Source node ID.
   * @param to Target node ID.
   */
  addConnection(from: string, to: string): void {
    this.connections.push({ from, to });
  }

  /**
   * Serialize the workflow to JSON.
   */
  serialize(): object {
    return {
      id: this.id,
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        type: node.type,
        config: node.config,
      })),
      connections: this.connections,
    };
  }

  /**
   * Deserialize a workflow from JSON.
   * @param data Serialized workflow data.
   */
  static async deserialize(data: any): Promise<Workflow> {
    const workflow = new Workflow(data.id);
    for (const nodeData of data.nodes) {
      let node: AbstractNode;
      // Dynamically instantiate the correct node class
      switch (nodeData.type) {
        case 'HttpNode':
          const { HttpNode } = await import('../nodes/HttpNode');
          node = new HttpNode(nodeData.config);
          node.id = nodeData.id; // Preserve ID
          break;
        case 'FunctionNode':
          const { FunctionNode } = await import('../nodes/FunctionNode');
          node = new FunctionNode(nodeData.config);
          node.id = nodeData.id;
          break;
        case 'DelayNode':
          const { DelayNode } = await import('../nodes/DelayNode');
          node = new DelayNode(nodeData.config);
          node.id = nodeData.id;
          break;
        default:
          throw new Error(`Unknown node type: ${nodeData.type}`);
      }
      workflow.addNode(node);
    }
    workflow.connections = data.connections;
    return workflow;
  }
}