// server.ts
// Minimal Express server to trigger workflows via HTTP.

import express from 'express';
import { Workflow } from '../workflows/engine';
import { HttpNode } from '../nodes/HttpNode';
import { FunctionNode } from '../nodes/FunctionNode';

const app = express();
app.use(express.json());

// Example workflow: HTTP Request → Transform Data
const sampleWorkflow = new Workflow(
  'sample-1',
  'HTTP → Transform',
  [
    new HttpNode({
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
    }),
    new FunctionNode(async (input) => {
      return {
        transformed: true,
        title: (input.data as { title: string }).title.toUpperCase(),
      };
    }),
  ]
);

// Endpoint to execute the sample workflow
app.post('/workflows/sample/execute', async (req, res) => {
  try {
    const result = await sampleWorkflow.execute(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});