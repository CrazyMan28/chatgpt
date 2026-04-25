// src/workflows/engine.ts
import { Workflow } from './Workflow';
import { AbstractNode } from '../nodes/AbstractNode';

/**
 * Executes a workflow by running nodes in sequence.
 */
export class WorkflowEngine {
  /**
   * Execute a workflow.
   * @param workflow Workflow to execute.
   * @param initialData Optional initial input data.
   * @returns Output of the final node.
   */
  static async execute(workflow: Workflow, initialData?: unknown): Promise<unknown> {
    const nodeExecutionOrder = this.getExecutionOrder(workflow);
    let currentData = initialData;

    for (const nodeId of nodeExecutionOrder) {
      const node = workflow.nodes.get(nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      node.setInputData(currentData);
      currentData = await node.execute(currentData);
    }

    return currentData;
  }

  /**
   * Determine the execution order of nodes based on connections.
   * @param workflow Workflow to analyze.
   * @returns Array of node IDs in execution order.
   */
  private static getExecutionOrder(workflow: Workflow): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const connections = new Map<string, string[]>();

    // Build connection map
    for (const { from, to } of workflow.connections) {
      if (!connections.has(from)) {
        connections.set(from, []);
      }
      connections.get(from)?.push(to);
    }

    // Find entry nodes (no incoming connections)
    const entryNodes = Array.from(workflow.nodes.keys()).filter(
      (nodeId) => !Array.from(connections.values()).flat().includes(nodeId),
    );

    // Topological sort
    const queue = [...entryNodes];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      order.push(nodeId);

      const nextNodes = connections.get(nodeId) || [];
      for (const nextNode of nextNodes) {
        // Check if all predecessors are visited
        const allPredecessorsVisited = workflow.connections.every(
          ({ to }) => to !== nextNode || visited.has(to),
        );
        if (allPredecessorsVisited) {
          queue.push(nextNode);
        }
      }
    }

    if (order.length !== workflow.nodes.size) {
      throw new Error('Workflow contains cycles or disconnected nodes.');
    }

    return order;
  }
}