from flask import Flask, render_template, request, jsonify
import os
import uuid
from gtts import gTTS
from mutagen.mp3 import MP3  # Add this import

app = Flask(__name__)

# Path configurations
TEXT_FILE_PATH = os.path.join('texts', 'metaphysics.mb.txt')
BOOKMARK_FILE_PATH = os.path.join('texts', 'bookmark.txt')
AUDIO_DIR = os.path.join('static', 'audio')

# Ensure audio directory exists
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

def load_bookmark():
    if os.path.exists(BOOKMARK_FILE_PATH):
        with open(BOOKMARK_FILE_PATH, 'r') as f:
            return int(f.read().strip())
    return 0

def save_bookmark(bookmark):
    with open(BOOKMARK_FILE_PATH, 'w') as f:
        f.write(str(bookmark))

def read_text_file(bookmark, word_count):
    with open(TEXT_FILE_PATH, 'r') as f:
        f.seek(bookmark)
        text = f.read()
        words = text.split()
        selected_words = words[:word_count]
        selected_text = ' '.join(selected_words)
        # Find the last sentence boundary
        last_boundary = max(
            selected_text.rfind('.'),
            selected_text.rfind('!'),
            selected_text.rfind('?')
        )
        if last_boundary != -1:
            selected_text = selected_text[:last_boundary + 1]
        new_bookmark = bookmark + len(selected_text) + 1
        return selected_text, new_bookmark

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/load_more', methods=['POST'])
def load_more():
    word_count = request.json.get('word_count', 200)
    bookmark = load_bookmark()
    text, new_bookmark = read_text_file(bookmark, word_count)
    save_bookmark(new_bookmark)
    return jsonify({'text': text})

@app.route('/generate_audio', methods=['POST'])
def generate_audio():
    text = request.json.get('text')
    # Generate audio using gTTS
    tts = gTTS(text)
    filename = str(uuid.uuid4()) + '.mp3'
    audio_path = os.path.join(AUDIO_DIR, filename)
    tts.save(audio_path)
    audio_url = '/static/audio/' + filename
    
    # Get audio duration using mutagen
    audio = MP3(audio_path)
    duration = audio.info.length  # Duration in seconds

    return jsonify({'audio_url': audio_url, 'duration': duration})


@app.route('/reset_bookmark', methods=['POST'])
def reset_bookmark():
    with open(BOOKMARK_FILE_PATH, 'w') as f:
        f.write('0')
    return jsonify({'status': 'Bookmark reset'})

if __name__ == '__main__':
    app.run(debug=True)

