# n8n-Like Workflow Engine Prototype

A minimal workflow automation tool inspired by n8n, built with TypeScript and Node.js.

---

## **Features**
- **Nodes**: HTTP requests, custom functions, delays.
- **Workflow Execution**: Sequential node execution with data passing.
- **Persistence**: Workflows stored in SQLite.
- **API**: REST endpoints to manage/execute workflows.

---

## **Setup**
1. Install dependencies:
   ```bash
   npm install express axios uuid @chatgpt-code/storage-sqlite
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Start the API server:
   ```bash
   npm start
   ```

---

## **API Endpoints**
| Endpoint                     | Description                     |
|------------------------------|---------------------------------|
| `POST /workflows`            | Create/update a workflow.       |
| `POST /workflows/:id/execute`| Trigger a workflow.             |
| `GET /workflows/:id`         | Fetch a workflow definition.    |

---

## **Example Workflow**
```json
{
  "id": "weather-check",
  "nodes": [
    {
      "id": "http-1",
      "type": "HttpNode",
      "config": {"url": "https://api.weatherapi.com/v1/current.json?key=API_KEY&q=London"}
    },
    {
      "id": "function-1",
      "type": "FunctionNode",
      "config": {"code": "return input.current.temp_c > 20 ? 'Warm' : 'Cold';"}
    }
  ],
  "connections": [{"from": "http-1", "to": "function-1"}]
}
```

---

## **Extending Nodes**
1. Create a new class extending `AbstractNode`.
2. Implement `execute()` and `validate()`.
3. Register the node type in the workflow engine.

---

## **Project Structure**
```
test_what_this_can_do/
├── src/
│   ├── nodes/               # Node implementations
│   ├── workflows/           # Workflow engine
│   ├── api/                 # Express API
│   └── index.ts             # Entry point
├── ARCHITECTURE.md          # Design doc
└── README.md                # This file
```