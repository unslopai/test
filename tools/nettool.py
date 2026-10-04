import argparse
import os
import subprocess

def ping_host(hostname):
    try:
        # Ping the host and capture the output
        result = subprocess.run(['ping', '-c', '4', hostname], check=True, stdout=subprocess.PIPE)
        print(result.stdout.decode())
    except subprocess.CalledProcessError as e:
        print(f"Failed to ping {hostname}: {e}")

def count_lines(filename):
    try:
        # Count the number of lines in the file
        with open(filename, 'r') as file:
            line_count = sum(1 for _ in file)
        print(f"The file '{filename}' has {line_count} lines.")
    except FileNotFoundError:
        print(f"File '{filename}' not found.")
    except Exception as e:
        print(f"An error occurred while reading the file: {e}")

def main():
    parser = argparse.ArgumentParser(description='Network and File Tool')
    parser.add_argument('target', help='Hostname to ping or filename to count lines')

    args = parser.parse_args()

    if os.path.isfile(args.target):
        count_lines(args.target)
    elif subprocess.call(['ping', '-c', '1', args.target], stdout=subprocess.DEVNULL) == 0:
        ping_host(args.target)
    else:
        print(f"Invalid input: {args.target} is neither a valid filename nor a reachable hostname.")

if __name__ == "__main__":
    main()
