import shlex
import subprocess

from flask import Flask, request

app = Flask(__name__)


@app.route("/run")
def run_command():
    return str(subprocess.call(shlex.split(request.args.get("command"))))


def evaluate_formula(formula_text):
    return eval(formula_text)
