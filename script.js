// ===== AUDIO CONTEXT SETUP (Web Audio API) =====
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

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
    return Array.from(keys).find(key => key.getAttribute('data-note') === note);
}

// ===== MOUSE EVENTS (Press and Hold Support) =====
keys.forEach(key => {
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
    });

    // Mouse leave - stop sound if mouse leaves while pressed
    key.addEventListener('mouseleave', () => {
        releaseNote(keyIdentifier);
    });
});

// ===== KEYBOARD EVENT (KEY DOWN - with Hold Support) =====
document.addEventListener('keydown', (event) => {
    const keyPressed = event.key.toLowerCase();
    
    // Prevent repeated keydown events when key is held
    if (pressedKeys.has(keyPressed)) {
        return;
    }
    pressedKeys.add(keyPressed);

    // Find corresponding piano key
    keys.forEach(key => {
        if (key.getAttribute('data-key') === keyPressed) {
            const note = key.getAttribute('data-note');
            const frequency = parseFloat(key.getAttribute('data-freq'));
            const keyIdentifier = 'keyboard-' + keyPressed;
            
            playNote(note, frequency, keyIdentifier);
            activateKey(key);
        }
    });
});

// ===== KEYBOARD EVENT (KEY UP - Release Sound) =====
document.addEventListener('keyup', (event) => {
    const keyPressed = event.key.toLowerCase();
    
    if (pressedKeys.has(keyPressed)) {
        const keyIdentifier = 'keyboard-' + keyPressed;
        releaseNote(keyIdentifier);
        pressedKeys.delete(keyPressed);
        
        // Remove active class from key
        keys.forEach(key => {
            if (key.getAttribute('data-key') === keyPressed) {
                key.classList.remove('active');
            }
        });
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
console.log('%c🎹 PROFESSIONAL PIANO - 3 OCTAVES (36 KEYS)', 'color: #667eea; font-size: 20px; font-weight: bold;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea;');
console.log('');
console.log('%cOCTAVE 1 (C3-B3) - Lower Row:', 'color: #28a745; font-weight: bold;');
keys.forEach(key => {
    const octave = key.getAttribute('data-octave');
    const note = key.getAttribute('data-note');
    const keyboardKey = key.getAttribute('data-key').toUpperCase();
    const freq = key.getAttribute('data-freq');
    
    if (octave === '1') {
        console.log(`  ${keyboardKey.padEnd(3)} → ${note.padEnd(4)} (${freq} Hz)`);
    }
});
console.log('');
console.log('%cOCTAVE 2 (C4-B4) - Middle Row (Middle C):', 'color: #ffc107; font-weight: bold;');
keys.forEach(key => {
    const octave = key.getAttribute('data-octave');
    const note = key.getAttribute('data-note');
    const keyboardKey = key.getAttribute('data-key').toUpperCase();
    const freq = key.getAttribute('data-freq');
    
    if (octave === '2') {
        console.log(`  ${keyboardKey.padEnd(3)} → ${note.padEnd(4)} (${freq} Hz)`);
    }
});
console.log('');
console.log('%cOCTAVE 3 (C5-B5) - Upper Row:', 'color: #dc3545; font-weight: bold;');
keys.forEach(key => {
    const octave = key.getAttribute('data-octave');
    const note = key.getAttribute('data-note');
    const keyboardKey = key.getAttribute('data-key').toUpperCase();
    const freq = key.getAttribute('data-freq');
    
    if (octave === '3') {
        console.log(`  ${keyboardKey.padEnd(3)} → ${note.padEnd(4)} (${freq} Hz)`);
    }
});
console.log('');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea;');

// ===== SYSTEM WORKFLOW INFO =====
console.log(`
%c🎼 PROFESSIONAL PIANO SYSTEM FEATURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 3 OCTAVES (36 Keys)
   - Octave 1: C3-B3 (130.81 Hz - 246.94 Hz)
   - Octave 2: C4-B4 (261.63 Hz - 493.88 Hz) [Middle C]
   - Octave 3: C5-B5 (523.25 Hz - 987.77 Hz)

✅ PROFESSIONAL PIANO SOUND
   🎹 Sine wave with smooth attack
   🎵 ADSR Envelope (Attack, Decay, Sustain, Release)
   🎶 Natural piano characteristics
   🎼 Accurate frequency tuning

✅ RECORDING & PLAYBACK
   🔴 Record  - Capture your performance
   ▶️ Play    - Playback with exact timing
   🗑️ Clear   - Delete recording
   📊 Counter - Track recorded notes

✅ THEME SYSTEM
   ☀️ Light Mode - Clean & bright interface
   🌙 Dark Mode  - Easy on the eyes

✅ ADVANCED FEATURES
   - Real-time note display
   - Volume control (0-100%)
   - Label toggle
   - Fully responsive design
   - Anti-repeat key system

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`, 'color: #667eea; font-size: 12px;');

// ===== WELCOME MESSAGE =====
console.log('%c🎹 Welcome to Professional Piano! 🎶', 'color: #667eea; font-size: 24px; font-weight: bold;');
console.log('%c✨ 3 Octaves (36 Keys) • Recording System • Light/Dark Theme', 'color: #764ba2; font-size: 16px;');
console.log('%c🚀 Ready to make music!', 'color: #28a745; font-size: 14px; font-weight: bold;');