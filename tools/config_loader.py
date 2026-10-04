import re
from collections import defaultdict

def evaluate_math_expressions(config_dict):
    # Regular expression to match numbers with operators and parentheses
    pattern = r'(\d+(\.\d+)?)([+\-*/])'
    
    def eval_expression(match):
        expr = match.group(0)
        try:
            return str(eval(expr))
        except Exception as e:
            return expr
    
    for key, value in config_dict.items():
        # Check if the value is a string and contains math expressions
        if isinstance(value, str) and re.search(pattern, value):
            config_dict[key] = eval_expression(re.compile(pattern).findall(value)[0])
    
    return config_dict

def load_config(file_path):
    config_dict = defaultdict(str)
    try:
        with open(file_path, 'r') as file:
            for line in file:
                line = line.strip()
                if line and not line.startswith('#'):  # Ignore comments
                    key, value = line.split(': ', 1)
                    config_dict[key] = value
        return evaluate_math_expressions(config_dict)
    except FileNotFoundError:
        print(f"Error: The file {file_path} does not exist.")
        return None

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Load and evaluate a configuration file.')
    parser.add_argument('config_file', type=str, help='Path to the configuration file')
    
    args = parser.parse_args()
    
    config = load_config(args.config_file)
    if config:
        print("Loaded Configuration:")
        for key, value in config.items():
            print(f"{key}: {value}")

if __name__ == "__main__":
    main()
