# n8n-style Workflow Automation App

A lightweight, self-hosted workflow automation tool inspired by n8n.

## Features
- **Visual Workflow Canvas**: Drag-and-drop interface using `reactflow`
- **Core Nodes**: Webhook Trigger, HTTP Request, Condition, Delay
- **Workflow Management**: Save, load, and execute workflows
- **Execution Logs**: Real-time logging for debugging
- **Database**: SQLite for workflow and execution persistence

## Project Structure
```
n8n/
├── backend/          # Express.js server and workflow engine
├── frontend/         # React.js + TypeScript UI
├── shared/           # Shared TypeScript types and utilities
├── database/         # SQLite schema and migrations
├── nodes/            # Core node implementations
└── README.md         # Project documentation
```

## Prerequisites
- Node.js (v18+)
- npm (v9+)
- SQLite (included in Node.js)

## Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd n8n
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   cd database
   npm run migrate
   ```

## Running the App
1. Start the backend:
   ```bash
   cd backend
   npm start
   ```

2. Start the frontend (in a new terminal):
   ```bash
   cd frontend
   npm start
   ```

3. Open your browser to:
   ```
   http://localhost:3000
   ```

## Example Workflow
1. Create a workflow with a **Webhook Trigger** node.
2. Add an **HTTP Request** node to call an API.
3. Use a **Condition** node to branch logic.
4. Save and manually run the workflow.

## Testing
- Use `curl` or Postman to trigger the webhook:
  ```bash
  curl -X POST http://localhost:5000/webhook/test -H "Content-Type: application/json" -d '{"key":"value"}'
  ```
- Verify execution logs in the UI.

## License
MIT