// 1. 상태 관리 변수
let activeNotes = new Set();
let timer = null;

// 2. MIDI 연결
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
} else {
    // Web MIDI not supported
    updateMidiIndicator(false);
}

function onMIDISuccess(midiAccess) {
    const checkInputs = () => {
        updateMidiIndicator(midiAccess.inputs.size > 0);
    };

    checkInputs();

    for (let input of midiAccess.inputs.values()) {
        input.onmidimessage = getMIDIMessage;
    }

    midiAccess.onstatechange = function() {
        checkInputs();
        // Re-bind inputs in case new ones were connected
        for (let input of midiAccess.inputs.values()) {
            input.onmidimessage = getMIDIMessage;
        }
    };
}

function onMIDIFailure() { 
    console.error("MIDI 연결 실패"); 
    updateMidiIndicator(false); 
}

function updateMidiIndicator(connected) {
    window.midiConnected = connected;
    const dot = document.getElementById("midi-dot");
    if (dot) {
        dot.style.backgroundColor = connected ? "#34c759" : "#ff3b30";
    }
}

// Apply state after DOM loads
document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.midiConnected !== 'undefined') {
        updateMidiIndicator(window.midiConnected);
    } else {
        updateMidiIndicator(false);
    }
});

// 3. 신호 처리
function getMIDIMessage(message) {
    const command = message.data[0];
    const note = message.data[1];
    const velocity = (message.data.length > 2) ? message.data[2] : 0;

    if (command === 144 && velocity > 0) {
        const name = convertNoteName(note);
        activeNotes.add(name);

        // 여러 음이 동시에 눌릴 때까지 아주 잠깐(50ms) 기다린 후 체크
        if (timer) clearTimeout(timer);
        timer = setTimeout(sendToGame, 50);
    } else if (command === 128 || (command === 144 && velocity === 0)) {
        activeNotes.delete(convertNoteName(note));
    }
}

// 4. 음 이름 변환 (모든 HTML 파일 대응용)
function convertNoteName(note) {
    const sharpNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const flatNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    
    const octave = Math.floor(note / 12) - 1;
    
    // 플랫 모드인지 체크
    const isFlatMode = (typeof accidentalMode !== 'undefined' && accidentalMode === 'flat');
    const baseName = isFlatMode ? flatNotes[note % 12] : sharpNotes[note % 12];

    // 가운데 C (60번) 특수 처리
    if (note === 60) {
        // 2음 파일에서는 "가운데 C", 3음 파일에서는 "C"라고 부르므로 둘 다 대비
        if (typeof scale !== 'undefined' && scale.includes("가운데 C")) return "가운데 C";
        if (typeof scale !== 'undefined' && scale.includes("C")) return "C";
        return "C4";
    }
    
    // 3음 파일의 C2(높은 도) 대응
    if (note === 72 && typeof scale !== 'undefined' && scale.includes("C2")) return "C2";

    // 기본 이름 반환 (예: F3, G3, D4 등)
    // 만약 3음 파일처럼 '4'를 안 붙이는 파일(C, D, E...)이라면 숫자를 떼고 보냄
    if (typeof scale !== 'undefined' && scale.includes(baseName)) return baseName;
    
    return baseName + octave;
}

// 5. 게임 함수 호출
function sendToGame() {
    if (typeof press === 'function' && activeNotes.size > 0) {
        const notes = Array.from(activeNotes);
        
        // 중요: 화음 모드(2음, 3음)일 때는 userSelection 배열을 직접 비워주고 
        // 한꺼번에 음들을 입력하는 방식으로 동작해야 합니다.
        if (typeof userSelection !== 'undefined') {
            userSelection = []; // 기존 선택 초기화
            document.querySelectorAll('.white, .black').forEach(k => k.classList.remove('selected'));
            
            notes.forEach(n => {
                // 게임의 press 함수 호출 (내부적으로 userSelection에 추가됨)
                press(n); 
            });
        } else {
            // 단음 모드일 때는 그냥 첫 번째 음 전송
            press(notes[0]);
        }
    }
}