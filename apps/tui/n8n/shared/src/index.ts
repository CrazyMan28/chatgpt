// Shared types and utilities for the n8n-style app

export interface Workflow {
  id: string;
  name: string;
  nodes: Node[];
  createdAt: string;
  updatedAt: string;
}

export interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface ExecutionLog {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  logs: string[];
  createdAt: string;
}