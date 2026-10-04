import os
from flask import Flask, flash, redirect, render_template_string, request, url_for
from werkzeug.utils import secure_filename

# Configuration
UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "gif"}

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["SECRET_KEY"] = "supersecretkey"  # Needed for flash messages

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


# HTML template embedded directly in the file for simplicity
HTML_TEMPLATE = """
<!doctype html>
<title>Upload new File</title>
<h1>Upload a new File</h1>
{% with messages = get_flashed_messages() %}
  {% if messages %}
    <ul>
    {% for message in messages %}
      <li><b>{{ message }}</b></li>
    {% endfor %}
    </ul>
  {% endif %}
{% endwith %}
<form method=post enctype=multipart/form-data>
  <input type=file name=file>
  <input type=submit value=Upload>
</form>
"""


@app.route("/", methods=["GET", "POST"])
def upload_file():
    if request.method == "POST":
        # Check if the post request has the file part
        if "file" not in request.files:
            flash("No file part in the request")
            return redirect(request.url)

        file = request.files["file"]

        # If the user does not select a file, the browser submits an
        # empty file without a filename.
        if file.filename == "":
            flash("No selected file")
            return redirect(request.url)

        if file and allowed_file(file.filename):
            # Secure the filename to prevent directory traversal attacks
            filename = secure_filename(file.filename)

            # Save the file to the configured upload folder
            file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(file_path)

            flash(f"File successfully uploaded and saved as: {filename}")
            return redirect(url_for("upload_file"))
        else:
            flash("Invalid file type. Allowed types: txt, pdf, png, jpg, jpeg, gif")
            return redirect(request.url)

    return render_template_string(HTML_TEMPLATE)


if __name__ == "__main__":
    app.run(debug=True)
