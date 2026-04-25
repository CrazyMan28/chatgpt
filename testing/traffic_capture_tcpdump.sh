#!/bin/bash

# Script to capture network traffic using tcpdump
# Usage: ./traffic_capture_tcpdump.sh <interface> <output_file>
# Example: ./traffic_capture_tcpdump.sh eth0 capture.pcap

INTERFACE=${1:-eth0}  # Default interface: eth0
OUTPUT_FILE=${2:-capture.pcap}  # Default output file: capture.pcap

echo "Capturing traffic on interface $INTERFACE. Saving to $OUTPUT_FILE...
Press Ctrl+C to stop."

tcpdump -i $INTERFACE -w $OUTPUT_FILE