from app import app
from flask import render_template, request
import pandas as pd
import json

@app.route('/')
def index():
    return render_template('classer.html')

@app.route('/exportedData', methods=['POST'])
def exported_data():
    content = request.get_json(force=True, silent=True)
    with open('test.txt', 'w') as f:
        json.dump(content, f)
    return json.dumps(content)




