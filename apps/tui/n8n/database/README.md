# Database Setup

This directory contains scripts for setting up and migrating the SQLite database.

## Schema
- Workflows table: Stores workflow definitions.
- Executions table: Stores execution logs.

## Migration Scripts
- `init.sql`: Initial schema setup.
- `migrations/`: Future migration scripts.

## Usage
1. Run `sqlite3 n8n.db < init.sql` to initialize the database.
2. Update `init.sql` or add migration scripts as needed.