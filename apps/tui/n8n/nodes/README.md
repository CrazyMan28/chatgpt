# Core Nodes

This directory contains implementations of core nodes for the n8n-style workflow automation app.

## Node Types
- **Webhook Trigger**: Listens for HTTP requests and triggers workflows.
- **HTTP Request**: Makes HTTP calls to external APIs.
- **Condition**: Branches workflow execution based on conditions.
- **Delay**: Pauses workflow execution for a specified time.

## Structure
Each node type has:
- A `schema.ts` file defining its input/output structure (using Zod).
- An `execute.ts` file containing the execution logic.

## Usage
Nodes are loaded dynamically by the workflow engine and executed in sequence.