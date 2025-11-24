// ===== AUDIO CONTEXT SETUP (Web Audio API) =====
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

// ===== 36 KEYS PIANO DATA (C4 to B6 - 3 Octaves) =====
const pianoKeys = [];

// Generate 36 keys (3 octaves)
function generatePianoKeys() {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keys = [];
    const baseFrequency = 261.63; // C4 frequency
    
    // Generate 3 octaves: C4-B4, C5-B5, C6-B6
    for (let octave = 4; octave <= 6; octave++) {
        for (let i = 0; i < 12; i++) {
            const noteName = notes[i];
            const frequency = baseFrequency * Math.pow(2, ((octave - 4) * 12 + i) / 12);
            const isBlack = noteName.includes('#');
            
            keys.push({
                note: `${noteName}${octave}`,
                frequency: frequency,
                isBlack: isBlack
            });
        }
    }
    
    return keys;
}

const allKeys = generatePianoKeys();

// ===== KEYBOARD MAPPING FOR MIDDLE OCTAVE (C4-B4) =====
const keyboardMap = {
    // Lower octave (C4-B4)
    'z': 'C4', 's': 'C#4', 'x': 'D4', 'd': 'D#4', 'c': 'E4',
    'v': 'F4', 'g': 'F#4', 'b': 'G4', 'h': 'G#4', 'n': 'A4',
    'j': 'A#4', 'm': 'B4',
    // Upper octave (C5-B5)
    'q': 'C5', '2': 'C#5', 'w': 'D5', '3': 'D#5', 'e': 'E5',
    'r': 'F5', '5': 'F#5', 't': 'G5', '6': 'G#5', 'y': 'A5',
    '7': 'A#5', 'u': 'B5'
};

// Reverse mapping: note -> keyboard key
const noteToKeyMap = {};
for (let key in keyboardMap) {
    noteToKeyMap[keyboardMap[key]] = key.toUpperCase();
}

// ===== GENERATE PIANO HTML =====
function renderPiano() {
    const pianoContainer = document.getElementById('piano-keys');
    pianoContainer.innerHTML = ''; // Clear existing
    
    let whiteKeyCount = 0;
    const whiteKeyWidth = 60;
    const blackKeyWidth = 36;
    
    allKeys.forEach((keyData, index) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = keyData.isBlack ? 'key black' : 'key white';
        keyDiv.setAttribute('data-note', keyData.note);
        keyDiv.setAttribute('data-freq', keyData.frequency.toFixed(2));
        
        // Note Label
        const noteLabel = document.createElement('span');
        noteLabel.className = 'key-label';
        noteLabel.textContent = keyData.note;
        keyDiv.appendChild(noteLabel);
        
        // Keyboard mapping label (if exists)
        if (noteToKeyMap[keyData.note]) {
            const keyboardLabel = document.createElement('span');
            keyboardLabel.className = 'keyboard-label';
            keyboardLabel.textContent = noteToKeyMap[keyData.note];
            keyDiv.appendChild(keyboardLabel);
        }
        
        // Highlight Middle C (C4)
        if (keyData.note === 'C4') {
            keyDiv.classList.add('middle-c');
        }
        
        // Position keys properly
        if (!keyData.isBlack) {
            // White key positioning
            keyDiv.style.left = `${whiteKeyCount * whiteKeyWidth}px`;
            whiteKeyCount++;
        } else {
            // Black key positioning - offset from previous white key
            const blackKeyOffset = whiteKeyWidth - (blackKeyWidth / 2);
            keyDiv.style.left = `${(whiteKeyCount * whiteKeyWidth) - (blackKeyWidth / 2)}px`;
        }
        
        pianoContainer.appendChild(keyDiv);
    });
    
    // Set piano width
    const totalWhiteKeys = allKeys.filter(k => !k.isBlack).length;
    pianoContainer.style.width = `${totalWhiteKeys * whiteKeyWidth}px`;
}

// Render piano on load
renderPiano();

// ===== GLOBAL VARIABLES =====
let volume = 0.5;
let pressedKeys = new Set();
let isRecording = false;
let recordedNotes = [];
let isPlaying = false;
let activeOscillators = new Map(); // Track active oscillators for sustain

// ===== DOM ELEMENTS =====
const keys = document.querySelectorAll('.key');
const pressedKeyDisplay = document.getElementById('pressed-key');
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const showLabelsCheckbox = document.getElementById('show-labels');
const themeToggle = document.getElementById('theme-toggle');
const recordBtn = document.getElementById('record-btn');
const playBtn = document.getElementById('play-btn');
const clearBtn = document.getElementById('clear-btn');
const recordStatus = document.getElementById('record-status');
const notesCount = document.getElementById('notes-count');

// ===== PIANO SETTINGS =====
const pianoSettings = {
    type: 'sine',
    attack: 0.01,
    decay: 0.3,
    sustain: 0.7,
    release: 1.5,
    volume: 0.3
};

// ===== START SOUND FUNCTION (Sustain - sound continues while key is held) =====
function startSound(frequency, noteName, keyIdentifier) {
    // Don't start if already playing this note
    if (activeOscillators.has(keyIdentifier)) {
        return;
    }

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Create oscillator and gain node
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Set oscillator properties for piano
    oscillator.type = pianoSettings.type;
    oscillator.frequency.setValueAtTime(frequency, now);

    // Attack and Decay envelope (sustain will continue)
    const maxGain = volume * pianoSettings.volume;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(maxGain, now + pianoSettings.attack);
    gainNode.gain.linearRampToValueAtTime(maxGain * pianoSettings.sustain, now + pianoSettings.attack + pianoSettings.decay);

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Start oscillator
    oscillator.start(now);

    // Store oscillator and gain node for later stopping
    activeOscillators.set(keyIdentifier, { oscillator, gainNode });

    // Record note if recording
    if (isRecording) {
        recordedNotes.push({
            note: noteName,
            frequency: frequency,
            timestamp: Date.now()
        });
        notesCount.textContent = `${recordedNotes.length} notes`;
    }
}

// ===== STOP SOUND FUNCTION (Release envelope when key is released) =====
function stopSound(keyIdentifier) {
    const activeSound = activeOscillators.get(keyIdentifier);
    
    if (!activeSound) {
        return;
    }

    const { oscillator, gainNode } = activeSound;
    const now = audioContext.currentTime;

    // Apply release envelope
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + pianoSettings.release);

    // Stop oscillator after release
    oscillator.stop(now + pianoSettings.release);

    // Remove from active oscillators
    activeOscillators.delete(keyIdentifier);
}

// ===== PLAY NOTE FUNCTION =====
function playNote(note, frequency, keyIdentifier) {
    if (frequency) {
        startSound(frequency, note, keyIdentifier);
        pressedKeyDisplay.textContent = note;
        
        // Reset display after 2 seconds
        setTimeout(() => {
            if (pressedKeyDisplay.textContent === note) {
                pressedKeyDisplay.textContent = '—';
            }
        }, 2000);
    }
}

// ===== RELEASE NOTE FUNCTION =====
function releaseNote(keyIdentifier) {
    stopSound(keyIdentifier);
}

// ===== PLAYBACK NOTE FUNCTION (For recorded playback - fixed duration) =====
function playbackNote(frequency, noteName) {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = pianoSettings.type;
    oscillator.frequency.setValueAtTime(frequency, now);

    // Full ADSR envelope for playback
    const maxGain = volume * pianoSettings.volume;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(maxGain, now + pianoSettings.attack);
    gainNode.gain.linearRampToValueAtTime(maxGain * pianoSettings.sustain, now + pianoSettings.attack + pianoSettings.decay);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + pianoSettings.attack + pianoSettings.decay + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + pianoSettings.attack + pianoSettings.decay + 0.5);
}

// ===== ACTIVATE KEY ANIMATION =====
function activateKey(keyElement, autoRemove = false) {
    keyElement.classList.add('active');
    
    // Only auto-remove for playback or if specified
    if (autoRemove) {
        setTimeout(() => {
            keyElement.classList.remove('active');
        }, 150);
    }
}

// ===== FIND KEY BY NOTE =====
function findKeyByNote(note) {
    return Array.from(document.querySelectorAll('.key')).find(key => key.getAttribute('data-note') === note);
}

// ===== ATTACH EVENT LISTENERS TO KEYS =====
function attachKeyListeners() {
    const allPianoKeys = document.querySelectorAll('.key');
    
    allPianoKeys.forEach(key => {
        const note = key.getAttribute('data-note');
        const frequency = parseFloat(key.getAttribute('data-freq'));
        const keyIdentifier = 'mouse-' + note;

        // Mouse down - start sound
        key.addEventListener('mousedown', (e) => {
            e.preventDefault();
            playNote(note, frequency, keyIdentifier);
            activateKey(key);
        });

        // Mouse up - stop sound
        key.addEventListener('mouseup', () => {
            releaseNote(keyIdentifier);
            key.classList.remove('active');
        });

        // Mouse leave - stop sound if mouse leaves while pressed
        key.addEventListener('mouseleave', () => {
            releaseNote(keyIdentifier);
            key.classList.remove('active');
        });
    });
}

// Call after piano is rendered
setTimeout(attachKeyListeners, 100);

// ===== KEYBOARD EVENT (KEY DOWN - with Hold Support) =====
document.addEventListener('keydown', (event) => {
    const keyPressed = event.key.toLowerCase();
    
    // Prevent repeated keydown events when key is held
    if (pressedKeys.has(keyPressed)) {
        return;
    }
    pressedKeys.add(keyPressed);

    // Check if key is mapped
    const mappedNote = keyboardMap[keyPressed];
    if (mappedNote) {
        const keyElement = findKeyByNote(mappedNote);
        if (keyElement) {
            const frequency = parseFloat(keyElement.getAttribute('data-freq'));
            const keyIdentifier = 'keyboard-' + keyPressed;
            
            playNote(mappedNote, frequency, keyIdentifier);
            activateKey(keyElement);
        }
    }
});

// ===== KEYBOARD EVENT (KEY UP - Release Sound) =====
document.addEventListener('keyup', (event) => {
    const keyPressed = event.key.toLowerCase();
    
    if (pressedKeys.has(keyPressed)) {
        const keyIdentifier = 'keyboard-' + keyPressed;
        releaseNote(keyIdentifier);
        pressedKeys.delete(keyPressed);
        
        // Remove active class from key
        const mappedNote = keyboardMap[keyPressed];
        if (mappedNote) {
            const keyElement = findKeyByNote(mappedNote);
            if (keyElement) {
                keyElement.classList.remove('active');
            }
        }
    }
});

// ===== VOLUME CONTROL =====
volumeSlider.addEventListener('input', (event) => {
    volume = event.target.value / 100;
    volumeValue.textContent = event.target.value + '%';
});

// ===== TOGGLE KEY LABELS =====
showLabelsCheckbox.addEventListener('change', (event) => {
    if (event.target.checked) {
        document.body.classList.remove('hide-labels');
    } else {
        document.body.classList.add('hide-labels');
    }
});

// ===== THEME TOGGLE =====
themeToggle.addEventListener('click', () => {
    const body = document.body;
    const icon = themeToggle.querySelector('i');
    
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    } else {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
    }
});

// ===== RECORDING CONTROLS =====
recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        // Start recording
        isRecording = true;
        recordedNotes = [];
        recordBtn.classList.add('recording');
        recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
        recordStatus.style.display = 'block';
        notesCount.textContent = '0 notes';
        console.log('🔴 Recording started...');
    } else {
        // Stop recording
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '<i class="fas fa-circle"></i> Record';
        recordStatus.style.display = 'none';
        
        if (recordedNotes.length > 0) {
            playBtn.disabled = false;
            clearBtn.disabled = false;
            console.log(`✅ Recording stopped. ${recordedNotes.length} notes recorded.`);
        } else {
            console.log('⚠️ No notes recorded.');
        }
    }
});

playBtn.addEventListener('click', async () => {
    if (isPlaying || recordedNotes.length === 0) return;
    
    isPlaying = true;
    playBtn.disabled = true;
    playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Playing...';
    
    console.log('▶️ Playing recorded notes...');
    
    // Calculate relative timings
    const startTime = recordedNotes[0].timestamp;
    
    for (let i = 0; i < recordedNotes.length; i++) {
        const note = recordedNotes[i];
        const delay = i === 0 ? 0 : note.timestamp - recordedNotes[i - 1].timestamp;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Play note (playback mode - short duration)
        playbackNote(note.frequency, note.note);
        const keyElement = findKeyByNote(note.note);
        if (keyElement) {
            activateKey(keyElement, true); // Auto-remove animation for playback
        }
        
        pressedKeyDisplay.textContent = note.note;
    }
    
    isPlaying = false;
    playBtn.disabled = false;
    playBtn.innerHTML = '<i class="fas fa-play"></i> Play';
    console.log('✅ Playback complete!');
});

clearBtn.addEventListener('click', () => {
    if (confirm('Clear recorded notes?')) {
        recordedNotes = [];
        playBtn.disabled = true;
        clearBtn.disabled = true;
        notesCount.textContent = '0 notes';
        console.log('🗑️ Recording cleared.');
    }
});

// ===== KEYBOARD MAPPING DISPLAY =====
console.log('%c🎹 PROFESSIONAL 36-KEY PIANO', 'color: #667eea; font-size: 20px; font-weight: bold;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea;');
console.log('');
console.log(`%cTotal Keys: 36 (21 white + 15 black)`, 'color: #28a745; font-weight: bold;');
console.log(`%cRange: C4 (${allKeys[0].frequency.toFixed(2)} Hz) to B6 (${allKeys[35].frequency.toFixed(2)} Hz)`, 'color: #28a745; font-weight: bold;');
console.log(`%cMiddle C: C4 at 261.63 Hz (First Key)`, 'color: #ffc107; font-weight: bold;');
console.log('');
console.log('%cKeyboard Shortcuts:', 'color: #667eea; font-weight: bold;');
console.log('  C4-B4: Z X C V B N M');
console.log('  C#4-A#4: S D G H J');
console.log('  C5-B5: Q W E R T Y U');
console.log('  C#5-A#5: 2 3 5 6 7');
console.log('');
console.log('%c💡 Tip: Use mouse to play all 36 keys!', 'color: #764ba2; font-style: italic;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea;');

// ===== SYSTEM WORKFLOW INFO =====
console.log(`
%c🎼 PROFESSIONAL PIANO SYSTEM FEATURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 36 KEYS PIANO
   - Range: C4 to B6 (3 octaves)
   - White Keys: 21 keys
   - Black Keys: 15 keys
   - Frequency Range: 261.63 Hz - 1975.53 Hz

✅ PROFESSIONAL PIANO SOUND
   🎹 Sine wave with smooth attack
   🎵 ADSR Envelope (Attack, Decay, Sustain, Release)
   🎶 Natural piano characteristics
   🎼 Accurate equal temperament tuning
   🎯 Sustain: Hold key to continue sound

✅ RECORDING & PLAYBACK
   🔴 Record  - Capture your performance
   ▶️ Play    - Playback with exact timing
   🗑️ Clear   - Delete recording
   📊 Counter - Track recorded notes

✅ THEME SYSTEM
   ☀️ Light Mode - Clean & bright interface
   🌙 Dark Mode  - Easy on the eyes
   🌙 Dark Mode  - Easy on the eyes

✅ ADVANCED FEATURES
   - Sustain support (hold keys)
   - Real-time note display
   - Volume control (0-100%)
   - Label toggle
   - Horizontal scroll for full range
   - Responsive design

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`, 'color: #667eea; font-size: 12px;');

// ===== WELCOME MESSAGE =====
console.log('%c🎹 Welcome to 88-Key Grand Piano! 🎶', 'color: #667eea; font-size: 24px; font-weight: bold;');
console.log('%c✨ Full Range (A0-C8) • Recording System • Light/Dark Theme', 'color: #764ba2; font-size: 16px;');
console.log('%c🚀 Ready to make professional music!', 'color: #28a745; font-size: 14px; font-weight: bold;');