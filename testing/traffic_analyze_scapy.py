#!/usr/bin/env python3

"""
Script to analyze network traffic using Scapy.
Usage: sudo ./traffic_analyze_scapy.py <interface> <packet_count>
Example: sudo ./traffic_analyze_scapy.py eth0 100
"""

import sys
from scapy.all import sniff, IP, TCP, UDP

def packet_callback(packet):
    if IP in packet:
        src_ip = packet[IP].src
        dst_ip = packet[IP].dst
        proto = packet[IP].proto
        
        if TCP in packet:
            sport = packet[TCP].sport
            dport = packet[TCP].dport
            print(f"TCP Packet: {src_ip}:{sport} -> {dst_ip}:{dport}")
        elif UDP in packet:
            sport = packet[UDP].sport
            dport = packet[UDP].dport
            print(f"UDP Packet: {src_ip}:{sport} -> {dst_ip}:{dport}")
        else:
            print(f"Other IP Packet: {src_ip} -> {dst_ip} (Proto: {proto})")

def main():
    if len(sys.argv) != 3:
        print("Usage: sudo ./traffic_analyze_scapy.py <interface> <packet_count>")
        sys.exit(1)
    
    interface = sys.argv[1]
    packet_count = int(sys.argv[2])
    
    print(f"Analyzing {packet_count} packets on interface {interface}...")
    sniff(iface=interface, prn=packet_callback, count=packet_count)

if __name__ == "__main__":
    main()