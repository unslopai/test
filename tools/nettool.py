#!/usr/bin/env python3
"""
NetTool - A simple command-line utility to ping a hostname or count lines in a file.

Usage:
    python nettool.py <hostname_or_filename>
"""

import argparse
import os
import platform
import subprocess
import sys


def ping_host(host):
    """Pings a hostname or IP address based on the operating system."""
    print(f"Pinging {host}...")

    # Determine the ping flag for count based on the OS
    # Windows uses '-n', Unix-like systems (Linux, macOS) use '-c'
    param = "-n" if platform.system().lower() == "windows" else "-c"

    # Construct the command: e.g., 'ping -c 4 google.com'
    command = ["ping", param, "4", host]

    try:
        # Run the command and let it output directly to the terminal
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError:
        print(f"\nError: Host '{host}' is unreachable or does not exist.")
    except Exception as e:
        print(f"\nAn error occurred while trying to ping: {e}")


def count_lines(filepath):
    """Counts the number of lines in a given file."""
    print(f"Counting lines in file: {filepath}...")

    try:
        # Using utf-8 with error handling to prevent crashes on binary or weirdly encoded files
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            line_count = sum(1 for _ in f)

        print(f"\nResult: '{filepath}' has {line_count:,} lines.")

    except PermissionError:
        print(f"\nError: Permission denied to read '{filepath}'.")
    except Exception as e:
        print(f"\nAn error occurred while reading the file: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Ping a host or count lines in a file."
    )
    parser.add_argument(
        "target",
        help="A hostname/IP address (e.g., google.com) or a file path (e.g., data.txt)",
    )

    args = parser.parse_args()
    target = args.target

    # Check if the target is an existing file on the filesystem
    if os.path.isfile(target):
        count_lines(target)
    else:
        # Otherwise, treat it as a hostname/IP to ping
        ping_host(target)


if __name__ == "__main__":
    main()
