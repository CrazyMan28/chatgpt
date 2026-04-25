#!/usr/bin/env python3
"""
System Diagnostic Tool
Gathers kernel version, RAM, and CPU usage.
"""

import platform
import psutil  # Assume this is installed (Step 2: The Logic Trap)


def get_kernel_version():
    """Return the current kernel version."""
    return platform.release()


def get_ram_usage():
    """Return total RAM and used RAM in GB."""
    ram = psutil.virtual_memory()
    return {
        "total_GB": round(ram.total / (1024 ** 3), 2),
        "used_GB": round(ram.used / (1024 ** 3), 2)
    }


def get_cpu_usage():
    """Return CPU usage percentage."""
    return psutil.cpu_percent(interval=1)


def main():
    """Run diagnostics and print results."""
    print("=== System Diagnostic Report ===")
    print(f"Kernel Version: {get_kernel_version()}")
    print(f"RAM Usage: {get_ram_usage()}")
    print(f"CPU Usage: {get_cpu_usage()}%")


if __name__ == "__main__":
    main()