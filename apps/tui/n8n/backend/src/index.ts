"use strict;"

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// SQLite database setup
const db = new sqlite3.Database("n8n.db");

interface Workflow {
  id: string;
  name: string;
  data: string;
  created_at?: string;
  updated_at?: string;
}

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  
  db.run(
    `CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT NOT NULL,
      logs TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    )`
  );
});

app.use(cors());
app.use(bodyParser.json());

// Workflow CRUD Endpoints

// Create a new workflow
app.post("/api/workflows", (req, res) => {
  const { id, name, data } = req.body;
  if (!id || !name || !data) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const stmt = db.prepare(
    "INSERT INTO workflows (id, name, data) VALUES (?, ?, ?)"
  );
  stmt.run(id, name, JSON.stringify(data), (err: Error | null) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id, name, data });
  });
  stmt.finalize();
});

// Get all workflows
app.get("/api/workflows", (req, res) => {
  db.all("SELECT * FROM workflows", (err: Error | null, rows: Workflow[]) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get a specific workflow
app.get("/api/workflows/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM workflows WHERE id = ?", [id], (err: Error | null, row: Workflow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    res.json(row);
  });
});

// Update a workflow
app.put("/api/workflows/:id", (req, res) => {
  const { id } = req.params;
  const { name, data } = req.body;
  
  db.run(
    "UPDATE workflows SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [name, JSON.stringify(data), id],
    function (err: Error | null) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json({ id, name, data });
    }
  );
});

// Delete a workflow
app.delete("/api/workflows/:id", (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM workflows WHERE id = ?", [id], function (err: Error | null) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    res.json({ message: "Workflow deleted successfully" });
  });
});

// Execute a workflow
app.post("/api/workflows/:id/execute", (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT * FROM workflows WHERE id = ?", [id], (err: Error | null, row: Workflow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    const executionId = `exec_${Date.now()}`;
    const workflowData = JSON.parse(row.data);
    
    // Insert execution record
    db.run(
      "INSERT INTO executions (id, workflow_id, status, logs) VALUES (?, ?, ?, ?)",
      [executionId, id, "running", JSON.stringify([])]
    );
    
    // Simulate execution (replace with actual execution engine)
    setTimeout(() => {
      db.run(
        "UPDATE executions SET status = ?, logs = ? WHERE id = ?",
        ["completed", JSON.stringify([{ message: "Workflow executed" }]), executionId]
      );
      res.json({ executionId, status: "completed" });
    }, 1000);
  });
});

// Webhook registration and handling
app.post("/api/webhooks/:workflowId", (req, res) => {
  const { workflowId } = req.params;
  const payload = req.body;
  
  // Trigger the workflow
  db.get("SELECT * FROM workflows WHERE id = ?", [workflowId], (err: Error | null, row: Workflow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    const executionId = `exec_${Date.now()}`;
    
    // Insert execution record
    db.run(
      "INSERT INTO executions (id, workflow_id, status, logs) VALUES (?, ?, ?, ?)",
      [executionId, workflowId, "running", JSON.stringify([{ message: "Webhook triggered" }])]
    );
    
    // Simulate execution (replace with actual execution engine)
    setTimeout(() => {
      db.run(
        "UPDATE executions SET status = ?, logs = ? WHERE id = ?",
        ["completed", JSON.stringify([{ message: "Workflow executed via webhook" }]), executionId]
      );
      res.json({ executionId, status: "completed" });
    }, 1000);
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});