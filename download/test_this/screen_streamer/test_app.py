import pytest
from unittest.mock import patch
import os
import sys
import logging
import subprocess
from config import load_config, validate_host, validate_port, validate_quality_presets

# Test data for quality levels
def test_validate_host():
    """Test host validation logic."""
    assert validate_host("localhost") == "localhost"
    assert validate_host("127.0.0.1") == "127.0.0.1"
    assert validate_host("192.168.1.1") == "192.168.1.1"
    assert validate_host("::1") == "::1"
    assert validate_host("invalid_host") == "0.0.0.0"  # Default fallback


def test_validate_port():
    """Test port validation logic."""
    assert validate_port(80) == 80
    assert validate_port(8080) == 8080
    assert validate_port(65535) == 65535
    assert validate_port(0) == 5000  # Default fallback
    assert validate_port(65536) == 5000  # Default fallback


def test_load_config_defaults():
    """Test loading default configuration."""
    config = load_config()
    assert config["HOST"] == "0.0.0.0"
    assert config["PORT"] == 5000
    assert config["FRAME_RATE_LIMIT"] == 15
    assert config["QUALITY_PRESETS"] == {
        "low": (50, 80),
        "medium": (75, 60),
        "high": (100, 30)
    }


def test_load_config_env_overrides():
    """Test environment variable overrides."""
    with patch.dict(os.environ, {
        "HOST": "192.168.1.100",
        "PORT": "8080",
        "FRAME_RATE_LIMIT": "30"
    }):
        config = load_config()
        assert config["HOST"] == "192.168.1.100"
        assert config["PORT"] == 8080
        assert config["FRAME_RATE_LIMIT"] == 30


def test_load_config_invalid_frame_rate():
    """Test invalid frame rate values."""
    with patch.dict(os.environ, {"FRAME_RATE_LIMIT": "0"}):
        config = load_config()
        assert config["FRAME_RATE_LIMIT"] == 15  # Default fallback

    with patch.dict(os.environ, {"FRAME_RATE_LIMIT": "61"}):
        config = load_config()
        assert config["FRAME_RATE_LIMIT"] == 15  # Default fallback

    with patch.dict(os.environ, {"FRAME_RATE_LIMIT": "invalid"}):
        config = load_config()
        assert config["FRAME_RATE_LIMIT"] == 15  # Default fallback


def test_validate_quality_presets():
    """Test validation logic for quality presets."""
    # Test valid presets
    valid_presets = {
        "low": (50, 80),
        "medium": (75, 60),
        "high": (100, 30)
    }
    validated = validate_quality_presets(valid_presets)
    assert validated == valid_presets

    # Test invalid scale_percent (out of bounds)
    invalid_scale_presets = {
        "low": (0, 80),  # Too low
        "medium": (101, 60),  # Too high
        "high": (100, 30)
    }
    validated = validate_quality_presets(invalid_scale_presets)
    assert validated["low"] == (75, 80)  # Default fallback
    assert validated["medium"] == (75, 60)  # Default fallback
    assert validated["high"] == (100, 30)

    # Test invalid compression (out of bounds)
    invalid_compression_presets = {
        "low": (50, 0),  # Too low
        "medium": (75, 101),  # Too high
        "high": (100, 30)
    }
    validated = validate_quality_presets(invalid_compression_presets)
    assert validated["low"] == (50, 60)  # Default fallback
    assert validated["medium"] == (75, 60)  # Default fallback
    assert validated["high"] == (100, 30)

    # Test non-integer values (should not occur due to env parsing, but test robustness)
    with pytest.raises(TypeError):
        validate_quality_presets({"low": ("50", 80)})


def test_quality_level_validation(app):
    """Test quality level validation in app.py."""
    from app import validate_quality_level
    
    # Test valid quality levels
    validate_quality_level("low")
    validate_quality_level("medium")
    validate_quality_level("high")
    
    # Test invalid quality level
    with pytest.raises(ValueError):
        validate_quality_level("invalid")


def test_app_state_initialization(app):
    """Test initial state of the app."""
    assert app.stream_paused is False
    assert app.quality_level == "medium"


def test_frame_rate_limit_validation(app):
    """Test frame_rate_limit validation in app.py."""
    # Test valid frame rate (already validated in config.py, but ensure app uses it correctly)
    assert 1 <= app.frame_rate_limit <= 60


def test_run_sh_script_validations():
    """Test validation logic in run.sh script."""
    # Test valid HOST values
    valid_hosts = ["localhost", "127.0.0.1", "192.168.1.1", "0.0.0.0"]
    for host in valid_hosts:
        result = subprocess.run(
            ["./run.sh"],
            env={**os.environ, "HOST": host, "PORT": "5000", "MAX_LOG_SIZE_KB": "1024", "BACKUP_COUNT": "5"},
            capture_output=True,
            text=True
        )
        assert result.returncode == 0 or "Starting screen streamer" in result.stdout

    # Test invalid HOST value
    result = subprocess.run(
        ["./run.sh"],
        env={**os.environ, "HOST": "invalid_host", "PORT": "5000", "MAX_LOG_SIZE_KB": "1024", "BACKUP_COUNT": "5"},
        capture_output=True,
        text=True
    )
    assert result.returncode != 0
    assert "Invalid HOST value" in result.stderr

    # Test valid PORT values
    valid_ports = ["1", "8080", "65535"]
    for port in valid_ports:
        result = subprocess.run(
            ["./run.sh"],
            env={**os.environ, "HOST": "localhost", "PORT": port, "MAX_LOG_SIZE_KB": "1024", "BACKUP_COUNT": "5"},
            capture_output=True,
            text=True
        )
        assert result.returncode == 0 or "Starting screen streamer" in result.stdout

    # Test invalid PORT values
    invalid_ports = ["0", "65536", "invalid"]
    for port in invalid_ports:
        result = subprocess.run(
            ["./run.sh"],
            env={**os.environ, "HOST": "localhost", "PORT": port, "MAX_LOG_SIZE_KB": "1024", "BACKUP_COUNT": "5"},
            capture_output=True,
            text=True
        )
        assert result.returncode != 0
        assert "Invalid PORT value" in result.stderr

    # Test valid MAX_LOG_SIZE_KB values
    valid_log_sizes = ["1", "1024", "10240"]
    for log_size in valid_log_sizes:
        result = subprocess.run(
            ["./run.sh"],
            env={**os.environ, "HOST": "localhost", "PORT": "5000", "MAX_LOG_SIZE_KB": log_size, "BACKUP_COUNT": "5"},
            capture_output=True,
            text=True
        )
        assert result.returncode == 0 or "Starting screen streamer" in result.stdout

    # Test invalid MAX_LOG_SIZE_KB values
    invalid_log_sizes = ["0", "-1", "invalid"]
    for log_size in invalid_log_sizes:
        result = subprocess.run(
            ["./run.sh"],
            env={**os.environ, "HOST": "localhost", "PORT": "5000", "MAX_LOG_SIZE_KB": log_size, "BACKUP_COUNT": "5"},
            capture_output=True,
            text=True
        )
        assert result.returncode != 0
        assert "Invalid MAX_LOG_SIZE_KB value" in result.stderr

    # Test valid BACKUP_COUNT values
    valid_backup_counts = ["0", "1", "5"]
    for backup_count in valid_backup_counts:
        result = subprocess.run(
            ["./run.sh"],
            env={**os.environ, "HOST": "localhost", "PORT": "5000", "MAX_LOG_SIZE_KB": "1024", "BACKUP_COUNT": backup_count},
            capture_output=True,
            text=True
        )
        assert result.returncode == 0 or "Starting screen streamer" in result.stdout

    # Test invalid BACKUP_COUNT values
    invalid_backup_counts = ["-1", "invalid"]
    for backup_count in invalid_backup_counts:
        result = subprocess.run(
            ["./run.sh"],
            env={**os.environ, "HOST": "localhost", "PORT": "5000", "MAX_LOG_SIZE_KB": "1024", "BACKUP_COUNT": backup_count},
            capture_output=True,
            text=True
        )
        assert result.returncode != 0
        assert "Invalid BACKUP_COUNT value" in result.stderr