#!/usr/bin/env python3

"""
Simple GUI for network traffic analysis using Scapy and Tkinter.
Run with: sudo python3 traffic_gui.py
"""

import os
if os.geteuid() != 0:
    print("Error: This script must be run as root (use sudo).")
    exit(1)

import tkinter as tk
from tkinter import ttk, scrolledtext
from scapy.all import sniff, IP, TCP, UDP, get_if_list
import threading
import queue


class TrafficGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Network Traffic Analyzer")
        self.root.geometry("800x600")
        
        # Detect available interfaces
        self.interfaces = get_if_list()
        default_interface = self.interfaces[0] if self.interfaces else ""
        
        # Variables
        self.interface = tk.StringVar(value=default_interface)
        self.capture_active = False
        self.packet_queue = queue.Queue()
        
        # GUI Elements
        self.create_widgets()
        
        # Check for new packets periodically
        self.root.after(100, self.process_queue)
    
    def create_widgets(self):
        # Interface selection
        ttk.Label(self.root, text="Interface:").pack(pady=5)
        self.interface_combobox = ttk.Combobox(
            self.root, 
            textvariable=self.interface,
            values=self.interfaces,
            state="readonly"
        )
        self.interface_combobox.pack(pady=5)
        
        # Buttons
        self.start_button = ttk.Button(self.root, text="Start Capture", command=self.start_capture)
        self.start_button.pack(pady=5)
        
        self.stop_button = ttk.Button(self.root, text="Stop Capture", command=self.stop_capture, state=tk.DISABLED)
        self.stop_button.pack(pady=5)
        
        # Packet display
        self.packet_display = scrolledtext.ScrolledText(self.root, wrap=tk.WORD, state=tk.DISABLED)
        self.packet_display.pack(expand=True, fill=tk.BOTH, padx=10, pady=10)
    
    def start_capture(self):
        self.capture_active = True
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.packet_display.config(state=tk.NORMAL)
        self.packet_display.delete(1.0, tk.END)
        self.packet_display.config(state=tk.DISABLED)
        
        # Start sniffing in a separate thread
        threading.Thread(
            target=self.sniff_packets,
            args=(self.interface.get(),),
            daemon=True
        ).start()
    
    def stop_capture(self):
        self.capture_active = False
        self.start_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
    
    def sniff_packets(self, interface):
        def packet_callback(packet):
            if not self.capture_active:
                return
            self.packet_queue.put(packet)
        
        sniff(iface=interface, prn=packet_callback, store=False)
    
    def process_queue(self):
        while not self.packet_queue.empty():
            packet = self.packet_queue.get()
            self.display_packet(packet)
        self.root.after(100, self.process_queue)
    
    def display_packet(self, packet):
        self.packet_display.config(state=tk.NORMAL)
        if IP in packet:
            src_ip = packet[IP].src
            dst_ip = packet[IP].dst
            proto = packet[IP].proto
            
            if TCP in packet:
                sport = packet[TCP].sport
                dport = packet[TCP].dport
                packet_info = f"TCP: {src_ip}:{sport} -> {dst_ip}:{dport}\n"
            elif UDP in packet:
                sport = packet[UDP].sport
                dport = packet[UDP].dport
                packet_info = f"UDP: {src_ip}:{sport} -> {dst_ip}:{dport}\n"
            else:
                packet_info = f"Other: {src_ip} -> {dst_ip} (Proto: {proto})\n"
            
            self.packet_display.insert(tk.END, packet_info)
            self.packet_display.see(tk.END)
        self.packet_display.config(state=tk.DISABLED)


if __name__ == "__main__":
    root = tk.Tk()
    app = TrafficGUI(root)
    root.mainloop()