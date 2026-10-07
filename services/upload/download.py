from flask import Flask, send_file

app = Flask(__name__)

# Define the directory where your files are stored
UPLOAD_FOLDER = '/path/to/your/upload/folder'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    # Construct the full path to the file
    filepath = app.config['UPLOAD_FOLDER'] + '/' + filename
    
    # Check if the file exists
    try:
        return send_file(filepath, as_attachment=True)
    except FileNotFoundError:
        return "File not found", 404

if __name__ == '__main__':
    app.run(debug=True)
