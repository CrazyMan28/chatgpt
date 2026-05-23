from flask import Flask, Response, render_template, send_from_directory, request, jsonify
import pyautogui
import cv2
import numpy as np
import time
import threading
import os
import logging
import sys
from config import load_config

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Set to INFO to capture more detailed logs
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Load configuration
config = load_config()
host = config["HOST"]
port = config["PORT"]
frame_rate_limit = config["FRAME_RATE_LIMIT"]
quality_presets = config["QUALITY_PRESETS"]

# Validate frame_rate_limit
if not isinstance(frame_rate_limit, int) or frame_rate_limit < 1 or frame_rate_limit > 60:
    logging.warning(f"Invalid frame_rate_limit: {frame_rate_limit}. Defaulting to 15 FPS.")
    frame_rate_limit = 15

# Global state for pause and quality
stream_paused = False
quality_level = "medium"  # low, medium, high

# Lock to ensure thread-safe state updates and logging
state_lock = threading.Lock()


def validate_quality_level(quality):
    """Validate if the provided quality level is supported."""
    if quality not in quality_presets:
        raise ValueError(f"Invalid quality level: {quality}. Supported values: {list(quality_presets.keys())}")


def log_state_change(message):
    """Thread-safe logging for state changes."""
    with state_lock:
        logging.info(message)


def get_screen_resolution():
    """Get the user's screen resolution dynamically."""
    try:
        screenshot = pyautogui.screenshot()
        return screenshot.width, screenshot.height
    except:
        # Fallback to default resolution if detection fails
        return 1920, 1080  # Default: Full HD


def create_error_frame(error_message):
    """Create a visual error frame with the error message, dynamically sized to screen resolution."""
    screen_width, screen_height = get_screen_resolution()
    
    # Use a fraction of the screen resolution for the error frame (e.g., 1/3 of width, 1/4 of height)
    frame_width = min(screen_width // 3, 800)  # Cap at 800px for readability
    frame_height = min(screen_height // 4, 480)  # Cap at 480px for readability
    
    # Create a black background
    frame = np.zeros((frame_height, frame_width, 3), dtype=np.uint8)
    
    # Add red overlay for error visibility
    cv2.rectangle(frame, (0, 0), (frame_width, frame_height), (0, 0, 150), -1)
    
    # Add error text
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(frame, "ERROR:", (50, 150), font, 1, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, error_message, (50, 200), font, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, "Check logs for details.", (50, 250), font, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    
    return frame


def generate_frames():
    global stream_paused, quality_level
    scale_percent, compression = quality_presets.get(quality_level, (75, 60))
    last_frame_time = 0

    while True:
        with state_lock:
            if stream_paused:
                time.sleep(0.5)
                continue

        # Frame rate limiting
        current_time = time.time()
        elapsed = current_time - last_frame_time
        target_delay = 1.0 / frame_rate_limit
        if elapsed < target_delay:
            time.sleep(target_delay - elapsed)
        last_frame_time = time.time()

        # Capture screen
        try:
            screenshot = pyautogui.screenshot()
            frame = np.array(screenshot)

            # Resize for performance/quality
            if scale_percent != 100:
                width = int(frame.shape[1] * scale_percent / 100)
                height = int(frame.shape[0] * scale_percent / 100)
                frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)

            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

            # Encode as JPEG with adjustable quality
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), compression]
            ret, buffer = cv2.imencode('.jpg', frame, encode_param)
            frame_bytes = buffer.tobytes()

            # Yield frame in MJPEG format
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        except Exception as e:
            # Log error for debugging
            logging.error(f"Error in generate_frames: {str(e)}")
            
            # Create and yield a visual error frame
            error_frame = create_error_frame(str(e))
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 80]
            ret, buffer = cv2.imencode('.jpg', error_frame, encode_param)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(1)


@app.errorhandler(Exception)
def handle_exception(e):
    """Global error handler to standardize error responses and prevent crashes."""
    logging.error(f"Unhandled exception: {str(e)}", exc_info=True)
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected error occurred. Check logs for details."
    }), 500


@app.route('/')
def index():
    logging.info("Serving index page")
    return render_template('index.html')


@app.route('/favicon.ico')
def favicon():
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')


@app.route('/video_feed')
def video_feed():
    global quality_level
    # Allow dynamic quality selection via query param
    quality = request.args.get('quality', quality_level)
    try:
        validate_quality_level(quality)
        with state_lock:
            if quality != quality_level:
                old_quality = quality_level
                quality_level = quality
                log_state_change(f"Quality level updated from {old_quality} to: {quality_level}")
    except ValueError as e:
        logging.warning(f"Invalid quality level requested: {quality}. Using default: {quality_level}")
    
    logging.info(f"Video feed requested with quality: {quality_level}")
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/state')
def get_state():
    with state_lock:
        state = {
            "paused": stream_paused,
            "quality": quality_level,
            "frame_rate_limit": frame_rate_limit
        }
    logging.info(f"State requested: {state}")
    return state


@app.route('/api/pause', methods=['POST'])
def pause_stream():
    global stream_paused
    with state_lock:
        if not stream_paused:
            stream_paused = True
            log_state_change("Stream paused via API")
    return {"status": "paused"}


@app.route('/api/play', methods=['POST'])
def play_stream():
    global stream_paused
    with state_lock:
        if stream_paused:
            stream_paused = False
            log_state_change("Stream resumed via API")
    return {"status": "playing"}


@app.route('/health')
def health_check():
    """Health check endpoint for monitoring the service."""
    # Check if critical dependencies are available
    dependencies_ok = True
    try:
        # Test pyautogui
        pyautogui.size()
        # Test cv2
        cv2.getVersionString()
    except Exception as e:
        logging.error(f"Dependency check failed: {str(e)}")
        dependencies_ok = False
    
    if dependencies_ok:
        status = {
            "status": "healthy",
            "frame_rate_limit": frame_rate_limit,
            "quality_level": quality_level
        }
        logging.info(f"Health check: {status}")
        return jsonify(status), 200
    else:
        status = {
            "status": "unhealthy",
            "error": "Dependency check failed"
        }
        logging.error(f"Health check: {status}")
        return jsonify(status), 503


if __name__ == '__main__':
    # Log the configured frame rate limit
    logging.info(f"Starting screen streamer with frame rate limit: {frame_rate_limit} FPS")
    
    # Ensure static folder exists
    os.makedirs(app.static_folder, exist_ok=True)
    app.run(host=host, port=port, threaded=True)