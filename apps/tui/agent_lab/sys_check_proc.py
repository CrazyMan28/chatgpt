#!/usr/bin/env python3
"""
System Diagnostic Tool (No Dependencies)
Gathers kernel version, RAM, and CPU usage by parsing /proc.
"""

import platform


def get_kernel_version():
    """Return the current kernel version."""
    return platform.release()


def get_ram_usage():
    """Return total RAM and used RAM in GB by parsing /proc/meminfo."""
    with open("/proc/meminfo", "r") as f:
        meminfo = f.readlines()
    
    mem_data = {}
    for line in meminfo:
        if ":" in line:
            key, value = line.split(":")
            mem_data[key.strip()] = int(value.split()[0]) * 1024  # Convert KB to bytes
    
    total_ram = mem_data.get("MemTotal", 0)
    free_ram = mem_data.get("MemFree", 0)
    used_ram = total_ram - free_ram
    
    return {
        "total_GB": round(total_ram / (1024 ** 3), 2),
        "used_GB": round(used_ram / (1024 ** 3), 2)
    }


def get_cpu_usage():
    """Return CPU usage percentage by parsing /proc/stat."""
    with open("/proc/stat", "r") as f:
        stat = f.readline()
    
    # Parse CPU times (user, nice, system, idle, iowait, etc.)
    cpu_times = list(map(int, stat.split()[1:]))
    total_time = sum(cpu_times)
    idle_time = cpu_times[3]  # Index 3 is 'idle'
    
    # Wait 1 second and measure again
    with open("/proc/stat", "r") as f:
        stat2 = f.readline()
    
    cpu_times2 = list(map(int, stat2.split()[1:]))
    total_time2 = sum(cpu_times2)
    idle_time2 = cpu_times2[3]
    
    # Calculate usage percentage
    total_diff = total_time2 - total_time
    idle_diff = idle_time2 - idle_time
    usage_percent = 100 - (idle_diff / total_diff * 100)
    
    return round(usage_percent, 1)


def main():
    """Run diagnostics and save results to final_report.log."""
    report = {
        "kernel_version": get_kernel_version(),
        "ram_usage_GB": get_ram_usage(),
        "cpu_usage_percent": get_cpu_usage()
    }
    
    # Write to final_report.log
    with open("agent_lab/final_report.log", "w") as f:
        f.write("=== System Diagnostic Report (No Dependencies) ===\n")
        f.write(f"Kernel Version: {report['kernel_version']}\n")
        f.write(f"RAM Usage: {report['ram_usage_GB']}\n")
        f.write(f"CPU Usage: {report['cpu_usage_percent']}%\n")
    
    print("Report generated: agent_lab/final_report.log")


if __name__ == "__main__":
    main()