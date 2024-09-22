let isPlaying = false;
let isPaused = true;
let wordCounter = {};
const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'cannot',
    'be', 'way', 'ways', 'most', 'is', 'also', 'any', 'should', 'nor', 'this',
    'must', 'which', 'would', 'it', 'so', 'above', 'all', 'other', 'others',
    'are', 'more', 'than', 'this', 'none', 'all', 'among', 'indeed', 'none',
    'yet', 'who', 'have', 'that', 'there', 'thing', 'we', 'as', 'end', 'much',
    'if', 'then', 'for', 'what', 'our', 'whole', 'these', 'too', 'before', 'us',
    'for', 'say', 'know', 'each', 'only', 'when', 'think', 'first', 'second',
    'third', 'fourth', 'why', 'its', 'they', 'do', 'not', 'just', 'else',
    'some', 'one', 'said', 'neither', 'least', 'them', 'kind', 'said', 'was',
    'were', 'those', 'he', 'such', 'things', 'make', 'two', 'had', 'again',
    'their', 'put', 'she', 'says', 'will', 'might'
]);

document.addEventListener('DOMContentLoaded', function() {
    const loadMoreButton = document.getElementById('load-more-button');
    const playPauseButton = document.getElementById('play-pause-button');
    const resetBookmarkButton = document.getElementById('reset-bookmark-button');
    const textDisplay = document.getElementById('text-display');
    const audioPlayer = document.getElementById('audio-player');
    const loadingSpinner = document.getElementById('loading-spinner');

    let currentText = '';
    let words = [];
    let wordIndex = 0;
    let wordTimings = [];
    let syncInterval = null;    

    loadMoreButton.addEventListener('click', function() {
        fetch('/load_more', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({word_count: 200})
        })
        .then(response => response.json())
        .then(data => {
            currentText = data.text;
            textDisplay.innerHTML = '';
            wordCounter = {};
            displayText(currentText);
        });
    });

    playPauseButton.addEventListener('click', function() {
        if (!isPlaying) {
            // Start playing
            isPlaying = true;
            isPaused = false;
            playPauseButton.textContent = 'Pause';
            generateAudio(currentText);
        } else if (isPaused) {
            // Resume playing
            isPaused = false;
            playPauseButton.textContent = 'Pause';
            audioPlayer.play();
        } else {
            // Pause playing
            isPaused = true;
            playPauseButton.textContent = 'Play';
            audioPlayer.pause();
        }
    });

    resetBookmarkButton.addEventListener('click', function() {
        fetch('/reset_bookmark', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        })
        .then(response => response.json())
        .then(data => {
            alert(data.status);
        });
    });


    function getTagForWord(word) {
        let significance = calculateWordSignificance(word);
        if (significance < 0.5) {
            return 'small';
        } else if (significance < 0.7) {
            return 'medium';
        } else if (significance < 0.85) {
            return 'large';
        } else {
            return 'very_large';
        }
    }

    function calculateWordSignificance(word) {
        word = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        word = word.toLowerCase();

        if (!word) {
            return 0;
        }

        if (!wordCounter[word]) {
            wordCounter[word] = 0;
        }
        wordCounter[word] +=1;

        // Factor 1: Word frequency (inverse)
        let frequency_factor = 1 / (wordCounter[word] + 1);

        // Factor 2: Word length
        let length_factor = Math.min(word.length / 10, 1);

        // Factor 3: Not a stopword
        let stopword_factor = stopwords.has(word) ? 0 : 1;

        // Factor 4: Contains non-alphanumeric characters
        let special_char_factor = /[^a-zA-Z0-9]/.test(word) ? 1 : 0;

        let significance = (
            frequency_factor * 0.1 +
            length_factor * 0.3 +
            stopword_factor * 0.5 +
            special_char_factor * 0.1
        );

        return Math.min(significance, 1);
    }

    function generateAudio(text) {
        // Show loading spinner
        loadingSpinner.style.display = 'block';
        fetch('/generate_audio', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({text: text})
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading spinner
            loadingSpinner.style.display = 'none';
            audioPlayer.src = data.audio_url;
            audioPlayer.load();

            // Set up word synchronization
            let duration = data.duration; // Audio duration in seconds
            words = text.split(' ');
            wordIndex = 0;
            wordTimings = calculateWordTimings(words, duration);

            // Start playing after metadata is loaded
            audioPlayer.addEventListener('loadedmetadata', function() {
                audioPlayer.play();
            });

            audioPlayer.addEventListener('timeupdate', synchronizeText);

            audioPlayer.addEventListener('ended', function() {
                isPlaying = false;
                isPaused = true;
                playPauseButton.textContent = 'Play';
                // Reset word highlighting
                resetWordHighlighting();
                audioPlayer.removeEventListener('timeupdate', synchronizeText);
            });
        })
        .catch(error => {
            // Hide loading spinner
            loadingSpinner.style.display = 'none';
            console.error('Error generating audio:', error);
            alert('An error occurred while generating the audio.');
        });
    }

    function calculateWordTimings(words, duration) {
        let totalWords = words.length;
        let averageTimePerWord = duration / totalWords;
        let timings = [];
        for (let i = 0; i < totalWords; i++) {
            timings.push(i * averageTimePerWord);
        }
        return timings;
    }

    function synchronizeText() {
        let currentTime = audioPlayer.currentTime;
        if (wordIndex < words.length && currentTime >= wordTimings[wordIndex]) {
            // Highlight current word
            highlightWord(wordIndex);
            wordIndex++;
        }
    }

    function highlightWord(index) {
        // Remove previous highlights
        resetWordHighlighting();

        // Highlight current word
        let spans = textDisplay.getElementsByTagName('span');
        if (index < spans.length) {
            spans[index].classList.add('highlight');
            // Scroll into view if necessary
            spans[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function resetWordHighlighting() {
        let spans = textDisplay.getElementsByTagName('span');
        for (let span of spans) {
            span.classList.remove('highlight');
        }
    }

    // Modify displayText function to create spans for each word
    function displayText(text) {
        textDisplay.innerHTML = ''; // Clear existing content
        words = text.split(' ');
        wordCounter = {};
        wordIndex = 0;
        wordTimings = [];

        words.forEach(word => {
            const span = document.createElement('span');
            const tag = getTagForWord(word);
            span.className = tag;
            span.textContent = word + ' ';
            textDisplay.appendChild(span);
        });
    }

});
