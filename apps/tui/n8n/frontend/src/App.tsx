import React, { useState, useCallback } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 5 },
  },
  {
    id: '2',
    data: { label: 'HTTP Request' },
    position: { x: 100, y: 100 },
  },
  {
    id: '3',
    data: { label: 'Process Data' },
    position: { x: 400, y: 100 },
  },
  {
    id: '4',
    type: 'output',
    data: { label: 'End' },
    position: { x: 250, y: 200 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
];

const App: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [logs, setLogs] = useState<string[]>([]);
  const [workflowName, setWorkflowName] = useState<string>('');

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const saveWorkflow = async () => {
    const workflowData = {
      id: `workflow_${Date.now()}`,
      name: workflowName,
      data: { nodes, edges },
    };
    try {
      const response = await axios.post('http://localhost:3001/api/workflows', workflowData);
      setLogs([...logs, `Workflow saved: ${response.data.id}`]);
    } catch (error) {
      setLogs([...logs, `Error saving workflow: ${error}`]);
    }
  };

  const loadWorkflow = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/workflows');
      const workflows = response.data;
      if (workflows.length > 0) {
        const latestWorkflow = workflows[workflows.length - 1];
        setNodes(JSON.parse(latestWorkflow.data).nodes);
        setEdges(JSON.parse(latestWorkflow.data).edges);
        setLogs([...logs, `Workflow loaded: ${latestWorkflow.id}`]);
      }
    } catch (error) {
      setLogs([...logs, `Error loading workflow: ${error}`]);
    }
  };

  const runWorkflow = async () => {
    try {
      const response = await axios.post('http://localhost:3001/api/workflows/1/execute');
      setLogs([...logs, `Workflow executed: ${response.data.executionId}`]);
    } catch (error) {
      setLogs([...logs, `Error executing workflow: ${error}`]);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <div style={{ width: '300px', padding: '10px', borderLeft: '1px solid #ccc' }}>
          <h3>Node Configuration</h3>
          <input
            type="text"
            placeholder="Workflow Name"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
          />
          <button onClick={saveWorkflow}>Save Workflow</button>
          <button onClick={loadWorkflow}>Load Workflow</button>
          <button onClick={runWorkflow}>Run Workflow</button>
          <h3>Execution Logs</h3>
          <div style={{ height: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px' }}>
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;