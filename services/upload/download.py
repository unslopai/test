import os
from flask import Flask, abort, render_template_string, send_from_directory

app = Flask(__name__)

# Define the directory where files are stored
UPLOAD_DIRECTORY = os.path.join(os.getcwd(), "downloads")

# Ensure the download directory exists and create a dummy file for testing
if not os.path.exists(UPLOAD_DIRECTORY):
    os.makedirs(UPLOAD_DIRECTORY)
    sample_file_path = os.path.join(UPLOAD_DIRECTORY, "sample.txt")
    with open(sample_file_path, "w") as f:
        f.write("Hello! This is a sample file for downloading.")


@app.route("/")
index_html = """
<!doctype html>
<title>File Download Example</title>
<h1>Available Files</h1>
<ul>
  <li><a href="/download/sample.txt">Download sample.txt</a></li>
</ul>
<p>Or use the URL directly: <code>/download/&lt;filename&gt;</code></p>
"""


@app.route("/")
def index():
    return render_template_string(index_html)


@app.route("/download/<path:filename>")
def download_file(filename):
    """Download a file by its name."""
    try:
        # send_from_directory safely handles file paths and prevents
        # directory traversal attacks (e.g., trying to download '../../passwd')
        return send_from_directory(
            directory=UPLOAD_DIRECTORY, path=filename, as_attachment=True
        )
    except FileNotFoundError:
        abort(404, description="File not found.")


if __name__ == "__main__":
    print(f"Serving files from: {UPLOAD_DIRECTORY}")
    print("A 'sample.txt' file has been created for testing.")
    app.run(debug=True, port=5000)
