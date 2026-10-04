#!/usr/bin/env python3
import argparse
import ast
import operator
import sys
import yaml

# Supported operators for safe math evaluation
SUPPORTED_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def safe_eval(node):
    """Recursively evaluates an AST tree containing only safe math expressions."""
    if isinstance(node, ast.Constant):  # Python 3.8+ for numbers/strings
        if isinstance(node.value, (int, float)):
            return node.value
        raise TypeError(f"Unsupported constant type: {type(node.value)}")

    elif isinstance(node, ast.Num):  # Backward compatibility for Python < 3.8
        return node.n

    elif isinstance(node, ast.BinOp):  # e.g., 60 * 5
        op_type = type(node.op)
        if op_type in SUPPORTED_OPERATORS:
            left = safe_eval(node.left)
            right = safe_eval(node.right)
            return SUPPORTED_OPERATORS[op_type](left, right)
        raise TypeError(f"Unsupported binary operator: {op_type.__name__}")

    elif isinstance(node, ast.UnaryOp):  # e.g., -5
        op_type = type(node.op)
        if op_type in SUPPORTED_OPERATORS:
            operand = safe_eval(node.operand)
            return SUPPORTED_OPERATORS[op_type](operand)
        raise TypeError(f"Unsupported unary operator: {op_type.__name__}")

    else:
        raise TypeError(f"Unsupported expression type: {type(node).__name__}")


def evaluate_config_values(config):
    """Recursively traverse the config dictionary and evaluate string math expressions."""
    if isinstance(config, dict):
        return {
            k: evaluate_config_values(v) for k, v in config.items()
        }
    elif isinstance(config, list):
        return [evaluate_config_values(v) for v in config]
    elif isinstance(config, str):
        # Try to parse the string as a math expression
        try:
            tree = ast.parse(config.strip(), mode="eval")
            return safe_eval(tree.body)
        except (SyntaxError, TypeError, ValueError):
            # If it's not a math expression, just return the original string
            return config
    else:
        # Integers, floats, booleans, None, etc.
        return config


def load_config(file_path):
    """Loads a YAML configuration file and evaluates any math expressions."""
    try:
        with open(file_path, "r") as f:
            raw_config = yaml.safe_load(f)
            
        if not raw_config:
            return {}
            
        return evaluate_config_values(raw_config)
    except FileNotFoundError:
        print(f"Error: Config file '{file_path}' not found.", file=sys.stderr)
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"Error parsing YAML: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    # Setup command line argument parsing
    parser = argparse.ArgumentParser(description="Load a config file and evaluate math expressions.")
    parser.add_argument("config_file", nargs="?", default="config.yaml", help="Path to the config file (default: config.yaml)")
    
    args = parser.parse_args()

    print(f"Loading configuration from: {args.config_file}\n")
    
    # Load and process the config
    config = load_config(args.config_file)

    # Print out the results to demonstrate it worked
    print("Processed Configuration:")
    for key, value in config.items():
        print(f"  {key}: {value} (Type: {type(value).__name__})")
