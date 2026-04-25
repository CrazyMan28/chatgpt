# n8n-Like Workflow Engine: Core Architecture

This document outlines the design for a minimal n8n-like workflow engine, focusing on **backend logic** (nodes, workflow execution, and persistence).

---

## **1. Core Components**

### **1.1 Nodes**
- **Base Class**: `AbstractNode`
  - Defines the interface for all nodes (`execute()`, `validate()`).
  - Handles input/output data passing.
- **Example Nodes**:
  - `HttpNode`: Makes HTTP requests (e.g., GET/POST).
  - `FunctionNode`: Executes custom JavaScript functions.
  - `DelayNode`: Pauses execution for a specified time.

### **1.2 Workflow Engine**
- **Workflow Class**:
  - Serializes/deserializes workflows (JSON ↔ Workflow object).
  - Executes nodes sequentially or in parallel (basic DAG support).
- **Persistence**:
  - Uses `@chatgpt-code/storage-sqlite` to save/load workflows.

### **1.3 API Layer**
- **Express Server**:
  - Endpoints:
    - `POST /workflows`: Create/update a workflow.
    - `POST /workflows/:id/execute`: Trigger a workflow.
    - `GET /workflows/:id`: Fetch a workflow definition.

---

## **2. File Structure**
```
test_what_this_can_do/
├── src/
│   ├── nodes/
│   │   ├── AbstractNode.ts      # Base node class
│   │   ├── HttpNode.ts          # HTTP request node
│   │   ├── FunctionNode.ts       # Custom function node
│   │   └── DelayNode.ts          # Delay node
│   ├── workflows/
│   │   ├── Workflow.ts          # Workflow serialization/execution
│   │   └── engine.ts             # Execution logic
│   ├── api/
│   │   └── server.ts             # Express API
│   └── index.ts                 # Entry point
├── package.json                 # Updated dependencies
└── README.md                    # Setup/usage instructions
```

---

## **3. Data Flow**
1. **Workflow Definition**:
   - JSON structure defining nodes and connections (e.g., `HttpNode → FunctionNode`).
2. **Execution**:
   - Engine deserializes the workflow → executes nodes in order → passes data between nodes.
3. **Persistence**:
   - Workflows saved to SQLite via `@chatgpt-code/storage-sqlite`.

---

## **4. Example Workflow**
```json
{
  "id": "weather-workflow",
  "nodes": [
    {
      "id": "http-1",
      "type": "HttpNode",
      "config": {
        "url": "https://api.weatherapi.com/v1/current.json?key=API_KEY&q=London"
      }
    },
    {
      "id": "function-1",
      "type": "FunctionNode",
      "config": {
        "code": "return input.temperature_c > 20 ? 'Warm' : 'Cold';"
      }
    }
  ],
  "connections": [
    {"from": "http-1", "to": "function-1"}
  ]
}
```

---

## **5. Dependencies**
| Dependency               | Purpose                          |
|--------------------------|----------------------------------|
| `@chatgpt-code/storage-sqlite` | Store workflows/execution history |
| `express`                | API server                       |
| `axios`                  | HTTP requests in `HttpNode`      |
| `uuid`                   | Generate workflow/node IDs       |

---

## **6. Next Steps**
1. Implement `AbstractNode` and example nodes.
2. Build the `Workflow` class and execution engine.
3. Add API endpoints and SQLite persistence.
4. Test with a sample workflow (e.g., HTTP → Function).