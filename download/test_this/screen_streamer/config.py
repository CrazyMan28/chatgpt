# Configuration file for Screen Streamer
# Centralized settings for host, port, frame rate, and quality presets

import os
import logging
import re
from typing import Dict, Tuple

# Default configuration values
DEFAULT_CONFIG = {
    "HOST": "0.0.0.0",
    "PORT": 5000,
    "FRAME_RATE_LIMIT": 15,
    "QUALITY_PRESETS": {
        "low": (50, 80),
        "medium": (75, 60),
        "high": (100, 30)
    }
}


def validate_quality_presets(presets: Dict[str, Tuple[int, int]]) -> Dict[str, Tuple[int, int]]:
    """Validate scale_percent and compression values in quality presets."""
    validated_presets = {}
    for key, (scale_percent, compression) in presets.items():
        # Validate scale_percent (1-100)
        if not isinstance(scale_percent, int) or scale_percent < 1 or scale_percent > 100:
            logging.warning(f"Invalid scale_percent for preset '{key}': {scale_percent}. Defaulting to 75.")
            scale_percent = 75
        
        # Validate compression (1-100)
        if not isinstance(compression, int) or compression < 1 or compression > 100:
            logging.warning(f"Invalid compression for preset '{key}': {compression}. Defaulting to 60.")
            compression = 60
        
        validated_presets[key] = (scale_percent, compression)
    
    return validated_presets


def validate_host(host: str) -> str:
    """Validate the HOST address."""
    # Basic validation for IPv4, IPv6, or localhost
    ipv4_pattern = re.compile(r"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")
    ipv6_pattern = re.compile(r"^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$")
    
    if host == "localhost" or ipv4_pattern.match(host) or ipv6_pattern.match(host):
        return host
    else:
        logging.warning(f"Invalid HOST value: {host}. Defaulting to {DEFAULT_CONFIG['HOST']}.")
        return DEFAULT_CONFIG["HOST"]


def validate_port(port: int) -> int:
    """Validate the PORT number."""
    if 1 <= port <= 65535:
        return port
    else:
        logging.warning(f"Invalid PORT value: {port}. Defaulting to {DEFAULT_CONFIG['PORT']}.")
        return DEFAULT_CONFIG["PORT"]


def load_config() -> Dict:
    """Load configuration from environment variables or use defaults."""
    config = DEFAULT_CONFIG.copy()
    
    # Override with environment variables if they exist
    host_env = os.getenv("HOST", config["HOST"])
    config["HOST"] = validate_host(host_env)
    
    port_env = os.getenv("PORT", str(config["PORT"]))
    try:
        port = int(port_env)
        config["PORT"] = validate_port(port)
    except ValueError:
        logging.warning(f"Invalid PORT value: {port_env}. Defaulting to {config['PORT']}.")
    
    # Validate and sanitize FRAME_RATE_LIMIT
    frame_rate_env = os.getenv("FRAME_RATE_LIMIT", str(config["FRAME_RATE_LIMIT"]))
    try:
        frame_rate = int(frame_rate_env)
        if frame_rate <= 0 or frame_rate > 60:
            raise ValueError("Frame rate must be between 1 and 60.")
        config["FRAME_RATE_LIMIT"] = frame_rate
    except ValueError as e:
        logging.warning(f"Invalid FRAME_RATE_LIMIT value: {frame_rate_env}. Defaulting to {config['FRAME_RATE_LIMIT']} FPS. Error: {str(e)}")
    
    # Validate QUALITY_PRESETS
    presets_env = os.getenv("QUALITY_PRESETS")
    if presets_env:
        try:
            # Parse environment variable (e.g., "low:50,80;medium:75,60;high:100,30")
            presets = {}
            for preset_str in presets_env.split(";"):
                key, values = preset_str.split(":")
                scale_percent, compression = map(int, values.split(","))
                presets[key] = (scale_percent, compression)
            config["QUALITY_PRESETS"] = validate_quality_presets(presets)
        except Exception as e:
            logging.warning(f"Invalid QUALITY_PRESETS value: {presets_env}. Using defaults. Error: {str(e)}")
    else:
        config["QUALITY_PRESETS"] = validate_quality_presets(config["QUALITY_PRESETS"])
    
    return config