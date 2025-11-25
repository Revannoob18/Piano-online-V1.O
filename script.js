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

// ===== KEYBOARD MAPPING FOR THREE OCTAVES (C4-B6) =====
const keyboardMap = {
    // Lower octave (C4-B4)
    'z': 'C4', 's': 'C#4', 'x': 'D4', 'd': 'D#4', 'c': 'E4',
    'v': 'F4', 'g': 'F#4', 'b': 'G4', 'h': 'G#4', 'n': 'A4',
    'j': 'A#4', 'm': 'B4',
    // Middle octave (C5-B5)
    'q': 'C5', '2': 'C#5', 'w': 'D5', '3': 'D#5', 'e': 'E5',
    'r': 'F5', '5': 'F#5', 't': 'G5', '6': 'G#5', 'y': 'A5',
    '7': 'A#5', 'u': 'B5',
    // Upper octave (C6-B6)
    'a': 'C6', '8': 'C#6', 'l': 'D6', '9': 'D#6', 'i': 'E6',
    'o': 'F6', '0': 'F#6', 'p': 'G6', '[': 'G#6', ']': 'A6',
    '\\': 'A#6', 'k': 'B6'
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
            
            // Add octave-specific class for different colors
            if (keyData.note.includes('4')) {
                keyboardLabel.classList.add('octave-c4');
            } else if (keyData.note.includes('5')) {
                keyboardLabel.classList.add('octave-c5');
            } else if (keyData.note.includes('6')) {
                keyboardLabel.classList.add('octave-c6');
            }
            
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
const presetSelector = document.getElementById('sound-preset');

// ===== PIANO SETTINGS =====
const pianoSettings = {
    type: 'sine',
    attack: 0.01,
    decay: 0.3,
    sustain: 0.7,
    release: 1.5,
    volume: 0.3
};

// ===== SOUND PRESETS =====
const soundPresets = {
    bright: {
        name: 'Bright Piano',
        partials: [1.0, 0.6, 0.4, 0.2],
        filterFreq: 8,
        filterQ: 0.9,
        attack: 0.005,
        decay: 0.25,
        sustain: 0.65,
        release: 1.2
    },
    warm: {
        name: 'Warm Piano',
        partials: [1.0, 0.45, 0.25, 0.12],
        filterFreq: 6,
        filterQ: 0.7,
        attack: 0.01,
        decay: 0.3,
        sustain: 0.7,
        release: 1.5
    },
    mellow: {
        name: 'Mellow Piano',
        partials: [1.0, 0.35, 0.15, 0.08],
        filterFreq: 4,
        filterQ: 0.5,
        attack: 0.015,
        decay: 0.35,
        sustain: 0.75,
        release: 1.8
    }
};

let currentPreset = 'warm'; // default
const MAX_VOICES = 10; // mobile optimization

// ===== PIANO VOICE (additive synthesis with percussive attack) =====
function createPianoVoice(frequency) {
    const now = audioContext.currentTime;
    const preset = soundPresets[currentPreset];

    // Create filter and master gain
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(2000, frequency * preset.filterFreq), now);
    filter.Q.setValueAtTime(preset.filterQ, now);

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(1, now);

    // Percussive attack noise (short burst)
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    noiseSource.connect(noiseGain);
    noiseGain.connect(filter);
    noiseSource.start(now);

    // Partial oscillators (4 harmonics based on preset)
    const oscillators = [];
    const gains = [];
    const partialRatios = preset.partials;

    for (let i = 0; i < 4; i++) {
        const osc = audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency * (i + 1), now);
        
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        
        osc.connect(gain);
        gain.connect(filter);
        osc.start(now);
        
        oscillators.push(osc);
        gains.push(gain);
    }

    filter.connect(masterGain);
    masterGain.connect(audioContext.destination);

    // ADSR ramp for partials using preset settings
    const maxGain = volume * pianoSettings.volume;
    gains.forEach((gain, i) => {
        const ratio = partialRatios[i] || 0;
        gain.gain.linearRampToValueAtTime(maxGain * ratio, now + preset.attack);
        gain.gain.linearRampToValueAtTime(maxGain * preset.sustain * ratio, now + preset.attack + preset.decay);
    });

    // Return stop function which applies release and stops nodes
    function stopVoice(releaseTime = preset.release) {
        const t = audioContext.currentTime;
        gains.forEach(gain => {
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);
        });

        setTimeout(() => {
            oscillators.forEach(osc => { try { osc.stop(); } catch (e) {} });
            try { filter.disconnect(); masterGain.disconnect(); } catch (e) {}
        }, (releaseTime + 0.06) * 1000);
    }

    return { stop: stopVoice };
}

// ===== START SOUND FUNCTION (Sustain - sound continues while key is held) =====
function startSound(frequency, noteName, keyIdentifier) {
    if (activeOscillators.has(keyIdentifier)) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    // Mobile optimization: limit concurrent voices
    if (activeOscillators.size >= MAX_VOICES) {
        const firstKey = activeOscillators.keys().next().value;
        stopSound(firstKey);
    }

    const voice = createPianoVoice(frequency);
    activeOscillators.set(keyIdentifier, voice);

    // Record note if recording
    if (isRecording) {
        recordedNotes.push({ note: noteName, frequency: frequency, timestamp: Date.now() });
        notesCount.textContent = `${recordedNotes.length} notes`;
    }
}

// ===== STOP SOUND FUNCTION (Release envelope when key is released) =====
function stopSound(keyIdentifier) {
    const voice = activeOscillators.get(keyIdentifier);
    if (!voice) return;
    voice.stop(pianoSettings.release);
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

    // Use the same piano voice but stop it after a short duration
    const voice = createPianoVoice(frequency);
    // stop after short fixed time (attack+decay+0.5s)
    const stopAfter = pianoSettings.attack + pianoSettings.decay + 0.5;
    setTimeout(() => {
        voice.stop(0.35);
    }, stopAfter * 1000);
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

// ===== PRESET SELECTOR =====
presetSelector.addEventListener('change', (event) => {
    currentPreset = event.target.value;
    console.log(`🎹 Preset changed to: ${soundPresets[currentPreset].name}`);
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
console.log('%c🎹 PROFESSIONAL 36-KEY PIANO WITH PRESETS', 'color: #667eea; font-size: 20px; font-weight: bold;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea;');
console.log('');
console.log(`%cTotal Keys: 36 (21 white + 15 black)`, 'color: #28a745; font-weight: bold;');
console.log(`%cRange: C4 (${allKeys[0].frequency.toFixed(2)} Hz) to B6 (${allKeys[35].frequency.toFixed(2)} Hz)`, 'color: #28a745; font-weight: bold;');
console.log(`%cMiddle C: C4 at 261.63 Hz (First Key)`, 'color: #ffc107; font-weight: bold;');
console.log(`%cCurrent Preset: ${soundPresets[currentPreset].name}`, 'color: #667eea; font-weight: bold;');
console.log('');
console.log('%cKeyboard Shortcuts:', 'color: #667eea; font-weight: bold;');
console.log('  C4-B4: Z X C V B N M (+ S D G H J for sharps)');
console.log('  C5-B5: Q W E R T Y U (+ 2 3 5 6 7 for sharps)');
console.log('  C6-B6: A L I O P K (+ 8 9 0 [ ] \\\\ for sharps)');
console.log('');
console.log('%c💡 Tip: Try different sound presets for unique tones!', 'color: #764ba2; font-style: italic;');
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

✅ ENHANCED PIANO SOUND ENGINE
   🎹 Additive synthesis (4 harmonic partials)
   🥁 Percussive attack envelope (realistic strike)
   🎛️ Dynamic lowpass filtering
   🎵 Full ADSR Envelope per partial
   🎼 Accurate equal temperament tuning
   🎯 Sustain: Hold key to continue sound

✅ SOUND PRESETS
   🌟 Bright Piano - Crisp & clear with rich harmonics
   🔥 Warm Piano - Balanced & natural (default)
   🌙 Mellow Piano - Soft & gentle with smooth decay

✅ RECORDING & PLAYBACK
   🔴 Record  - Capture your performance
   ▶️ Play    - Playback with exact timing
   🗑️ Clear   - Delete recording
   📊 Counter - Track recorded notes

✅ THEME SYSTEM
   ☀️ Light Mode - Clean & bright interface
   🌙 Dark Mode  - Easy on the eyes

✅ PERFORMANCE OPTIMIZATION
   📱 Mobile-optimized (max 10 concurrent voices)
   ⚡ Efficient audio node management
   🚀 Smooth playback and sustain

✅ ADVANCED FEATURES
   - 3 switchable sound presets
   - Real-time note display
   - Volume control (0-100%)
   - Label toggle
   - Responsive design

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`, 'color: #667eea; font-size: 12px;');

// ===== WELCOME MESSAGE =====
console.log('%c🎹 Welcome to Enhanced 36-Key Piano! 🎶', 'color: #667eea; font-size: 24px; font-weight: bold;');
console.log('%c✨ Full Range (A0-C8) • Recording System • Light/Dark Theme', 'color: #764ba2; font-size: 16px;');
console.log('%c🚀 Ready to make professional music!', 'color: #28a745; font-size: 14px; font-weight: bold;');