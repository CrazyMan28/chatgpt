#!/bin/bash

# Ensure the script exits on any error
set -e

# Log file configuration with environment variable support
LOG_FILE="${LOG_FILE:-screen_streamer.log}"  # Default: screen_streamer.log
MAX_LOG_SIZE_KB="${MAX_LOG_SIZE_KB:-10240}"  # Default: 10MB
BACKUP_COUNT="${BACKUP_COUNT:-5}"  # Default: 5 backups

# Validate MAX_LOG_SIZE_KB (must be a positive integer)
if [[ ! "$MAX_LOG_SIZE_KB" =~ ^[0-9]+$ ]] || [[ "$MAX_LOG_SIZE_KB" -lt 1 ]]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Invalid MAX_LOG_SIZE_KB value: $MAX_LOG_SIZE_KB. Must be a positive integer." >&2
    exit 1
fi

# Validate BACKUP_COUNT (must be a non-negative integer)
if [[ ! "$BACKUP_COUNT" =~ ^[0-9]+$ ]] || [[ "$BACKUP_COUNT" -lt 0 ]]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Invalid BACKUP_COUNT value: $BACKUP_COUNT. Must be a non-negative integer." >&2
    exit 1
fi

# Flask server configuration with environment variable support
HOST="${HOST:-0.0.0.0}"  # Default: 0.0.0.0
PORT="${PORT:-5000}"  # Default: 5000

# Validate HOST (basic validation for IPv4 or localhost)
if [[ ! "$HOST" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] && [[ "$HOST" != "localhost" ]] && [[ "$HOST" != "0.0.0.0" ]] && [[ "$HOST" != "127.0.0.1" ]]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Invalid HOST value: $HOST. Must be a valid IPv4 address or 'localhost'." >&2
    exit 1
fi

# Validate PORT (must be a number between 1 and 65535)
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || [[ "$PORT" -lt 1 ]] || [[ "$PORT" -gt 65535 ]]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Invalid PORT value: $PORT. Must be a number between 1 and 65535." >&2
    exit 1
fi

# Function to rotate logs
rotate_logs() {
    if [ -f "$LOG_FILE" ]; then
        local log_size_kb=$(du -k "$LOG_FILE" | cut -f1)
        if [ "$log_size_kb" -gt "$MAX_LOG_SIZE_KB" ]; then
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Rotating log file..."
            for ((i=BACKUP_COUNT-1; i>=1; i--)); do
                if [ -f "$LOG_FILE.$i" ]; then
                    mv "$LOG_FILE.$i" "$LOG_FILE.$((i+1))"
                fi
            done
            if [ -f "$LOG_FILE" ]; then
                mv "$LOG_FILE" "$LOG_FILE.1"
            fi
        fi
    fi
}

# Function to handle errors
handle_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Application failed. Check $LOG_FILE for details." >&2
    exit 1
}

# Trap errors
trap handle_error ERR

# Rotate logs before starting
rotate_logs

# Redirect stdout and stderr to log file
exec > >(tee -a "$LOG_FILE") 2>&1

# Start the application
echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Starting screen streamer..."
echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Log file: $LOG_FILE"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Max log size: $MAX_LOG_SIZE_KB KB"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Backup count: $BACKUP_COUNT"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Host: $HOST"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Port: $PORT"
python3 app.py --host="$HOST" --port="$PORT"

# Log successful shutdown
echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Screen streamer stopped."