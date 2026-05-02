const NOTES =       ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];    

const StringBasePitches = [40, 45, 50, 55, 59, 64]; 
const STRINGS = [4, 9, 2, 7, 11, 4]; 
const MARKERS = [3, 5, 7, 9, 12];
let CHORD_FORMULAS=null; // to be loaded from db

const CAGED_DATA = {
    "C": { color: "#FF4500", min: [0, 0, 0, 0, 1, 0], max: [3, 3, 2, 2, 3, 3] }, // Orange-Red
    "A": { color: "#1E90FF", min: [0, 0, 0, 0, 0, 0], max: [3, 2, 2, 2, 3, 3] }, // Dodger Blue
    "G": { color: "#FFD700", min: [0, 2, 2, 2, 0, 0], max: [5, 5, 5, 4, 3, 3] }, // Gold 
    "E": { color: "#32CD32", min: [0, 0, 0, 1, 0, 0], max: [3, 2, 2, 3, 3, 3] }, // Lime Green
    "D": { color: "#9370DB", min: [0, 0, 0, 0, 0, 1], max: [2, 2, 3, 5, 5, 5] }  // Medium Purple
};
    
class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = false;
        // Create a master gain to prevent clipping
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.6, this.ctx.currentTime); 
        this.masterGain.connect(this.ctx.destination);
    }

    // Mobile browsers block audio until the user interacts
    async resume() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.enabled = true;
    }


    // Updated playNote method:
    playNote(pitch, delay = 0) {
        if (!this.enabled) return;

        const freq = 440 * Math.pow(2, (pitch - 69) / 12);
        const startTime = this.ctx.currentTime + delay;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        // Envelope adjusted for the specific start time
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.5);

        osc.connect(gain);
        // Connect to masterGain instead of destination
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 1.5);
    }
}
    
    
class FretboardEngine {
    constructor(canvas, chordFormulas) {
        CHORD_FORMULAS= chordFormulas;
        this._localStorageKey = 'fretStats';
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.fretPositions = [];
        this.variant = null;
        
        this.score = 0;
        this.history = [];
        this.animations = [];
        this.tappedKeys = new Set();
        this.gameActive = true;
        this.isPaused = false;
        this.autoPauseDuration = 10000; // 10 sec by default
        this.isAutoPaused = false; // auto pause after n seconds without tap
        this.lastTapTime = Date.now();
        
        this.showNotes = false;
        this.showDebug = false;
        this.showHistory = true;
        this.show3D = false;
        this.hasFret= true;
        
        this.stats = JSON.parse(localStorage.getItem(this._localStorageKey)) || {};
        this.tiltX = 0;
        this.tiltY = 0;
        this.mistakes = 0; // Reset mistake counter
        this.perfectAnim=null;
        this.viewHeightFactor = 1.0; // fretboard height Default to 100% of canvas height
        this.viewWidthFactor = 0.8; 
        this.avg= null;
        this.maxAvg= null;
        this.avgReactionTime= null;
        this.totalFound= 0;
        this.totalDelay= 0;

        this.lastTapX = null;
        this.lastTapY = null;
        this.tapCircleRadius = 0; // For a little "ripple" effect
        this.statKey= null; // begining of statistics key should be different for each game
        this.audioUnlocked=false;
        this.audio = new AudioController();
        this.HighlightFrets=null;
        this._currentChordVariant=null; // null: none, 0: v1, 1: v2, etc

        // 3D effect needs https connection
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (e) => {
                // We divide by a factor (e.g., 10) to keep the movement subtle
                this.tiltX = e.gamma / 10; 
                this.tiltY = e.beta / 10;
            });
        }

        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.handleTouch(e));
        this.resize();

        const display = document.getElementById('game-info-display');
        display.innerHTML = `Width: ${canvas.width}px | Height: ${canvas.height}px`;
    }

    clearLocalSorage() {
        localStorage.removeItem(this._localStorageKey);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        const designWidth = 390, designHeight = 797; 
        this.scale = this.canvas.width / designWidth;
        this.scaleH = this.canvas.height / designHeight;
        this.marginX = 25 * this.scale;
        this.marginTop = 60 * this.scale; 
        this.marginBottom = 60 * this.scale;
        this.calculateFrets();
        this.setUIProportions();
        
    }

    setUIProportions() {
        // 3. Define base sizes
        const baseBtnW = 45;
        const baseBtnH = 45;
        const basePadding = 25;
        const minDts = this.fretPositions[12] - this.fretPositions[11]; // Distance between the last two frets as a reference for node sizes
    
        // 4. Return the scaled values
        this.uiprop= {
            scale: this.scale,
            btnW: baseBtnW * this.scale,
            btnH: baseBtnH * this.scale,
            btnGap: 10 * this.scale,
            fctbtnW: 45 * this.scale,
            fctbtnH: 30 * this.scale,
            fctfntsize: 16 * this.scale,
            optbtnW: 30 * this.scale,
            optbtnH: 20 * this.scale,
            keybfntsize: 16 * this.scale,
            sidePadding: 15 * this.scale,
            arrowbtnw : 25 * this.scale,
            arrowbtnh : 43 * this.scale,
            arrowvgap : 5 * this.scale,
            arrowhgap : 10 * this.scale,
            arrowfntsize: 20 * this.scale,

            drawNodeSize: minDts * 0.45,
            drawNodeChordSize: minDts * 0.3,

        };
    }

    getOffsetX() {
        const activeW = this.canvas.width * (this.viewWidthFactor || 1.0);
        return (this.canvas.width - activeW) / 2;
    }

    getFretCoordinates(sIdx, fIdx) {
        const fullW = this.canvas.width;
        const activeW = fullW * (this.viewWidthFactor || 1.0);
        const offsetX = (fullW - activeW) / 2;
        
        const spacingX = (activeW - (this.marginX + 10) * 2) / 5;
        const x = offsetX + this.marginX + 10 + (sIdx * spacingX);
        const y = (this.fretPositions[fIdx] + this.fretPositions[fIdx - 1]) / 2;
    //this.variant.label=` >>${sIdx} ${fIdx} ${x} ${y}`;        
        return { x, y };
    }

    getNoteCoordinates(noteIdx, sIdx) {
        // Running backwards (12 down to 0) favors the higher fret over the open string
        for (let f = 12; f >= 0; f--) {
            if ((STRINGS[sIdx] + f) % 12 === noteIdx) {
                return this.getFretCoordinates(sIdx, f);
            }
        }
        return null;
    }

    calculateFrets() {
        this.fretPositions = [];
        
        // 1. Determine the effective canvas height based on the factor
        const factor = this.viewHeightFactor || 1.0;
        const effectiveHeight = this.canvas.height * factor;
    
        // 2. Calculate available space within that restricted area
        const availH = effectiveHeight - this.marginTop - this.marginBottom;
        
        // 3. The 'scale' determines the total length of the 12 frets
        // 0.5 is the mathematical constant for a 12-fret octave span
        const scale = availH / 0.5; 
    
        for (let i = 0; i <= 12; i++) {
            // Formula for logarithmic fret spacing
            const dist = scale * (1 - Math.pow(2, -(i / 12)));
            this.fretPositions.push(this.marginTop + dist);
        }
    }

    getFretCenter(sIdx, fIdx) {
        // 1. Get Horizontal Position (Strings)
        const fullW = this.canvas.width;
        const activeW = fullW * (this.viewWidthFactor || 1.0);
        const offsetX = (fullW - activeW) / 2;
        // spacingX is the distance between vertical string lines
        const spacingX = (activeW - (this.marginX + 10) * 2) / 5;
        const x = offsetX + this.marginX + 10 + (sIdx * spacingX);

        this.stringSpacing = spacingX;
        // 2. Get Vertical Position (Frets)
        let y;
        if (fIdx === 0) {
            // For the open string, place it slightly above the nut (fret 0 line)
            y = this.fretPositions[0] - 15; 
        } else {
            // Midpoint between this fret line and the one before it
            y = (this.fretPositions[fIdx] + this.fretPositions[fIdx - 1]) / 2;
        }    
        return { x, y };
    }
    
    reset(keepScore = false) {
        this.history = [];
        this.animations = [];
        this.perfectAnim = null;
        this.tappedKeys.clear();
        this.gameActive = true;
        this.isAutoPaused = false;
        this.lastTapTime = Date.now();
        this.labels =[];
        this.HighlightFrets=null;
        this.livesLeft=0; // this is to be managed by variants in init() if>0 lives are displayed on top
        if (!keepScore) this.score = 0;
        if (this.variant) {
            this.variant.init(this);
            this.statKey = this.variant.statKey;
        }
        if (! keepScore){
            this.totalDelay=0;
            this.totalFound=0;
            this.avgReactionTime=0;
            if (this.variant.countdown>0){
                this.triggerPerfect(`${this.variant.countdown}`,this.variant.countdown,1000);
                this.gameActive = false;
            }
        }
        if (this.livesLeft>0){
            this.livesLabel=this.addLabel("",
                        { color:"#600", duration: -1, 
                          size:12*this.uiprop.scale, x:this.canvas.width*1/4, y:15});
            this.incrementLives(0);// just to set the initial string with the number of lives
        }
        
    }
  
    gameOver(){
        this.gameActive=false;
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.addLabel(`GAME OVER`,
                        { color:"#666", duration: -1, size:25, x:w/2, y:h/3});
    }
    
    // const {  firstStringX, spacingX, offsetX , activeW} = engine.getFretboardLayout()
    getFretboardLayout() {
        const fullW = this.canvas.width;
        const activeW = fullW * (this.viewWidthFactor || 1.0);
        const offsetX = (fullW - activeW) / 2;
        const spacingX = (activeW - (this.marginX + 10) * 2) / 5;
        const firstStringX = offsetX + this.marginX + 10;
    
        return { firstStringX, spacingX, offsetX , activeW};
    }
    getStringX(stringNum){
        const fullW = this.canvas.width;
        const activeW = fullW * (this.viewWidthFactor || 1.0);
        const offsetX = (fullW - activeW) / 2; // The gap to the left of the centered area
        const spacingX = (activeW - (this.marginX + 10) * 2) / 5;
        const x = offsetX + this.marginX + 10 + (stringNum * spacingX);
        if (this.show3D){
            return x + (this.tiltX * 2);
        }else{
            return x;
        }
    }

    handleTouch(e) {
        if (this.isAutoPaused || !this.gameActive) {
            this.reset(true);
            return;
        }
        this.lastTapTime = Date.now();
        if ( this.isPaused) return;
        e.preventDefault();
    
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            // It is a touch event
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            // It is a mouse event
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const tx = Math.round(clientX - rect.left);
        const ty = Math.round(clientY - rect.top);
        this.lastTapX = tx;
        this.lastTapY = ty;
        this.tapCircleRadius = 20; // Reset the radius for the visual effect

        // 1. Check if the touch is within the Fretboard boundaries
        let fIdx = -1;
        
        // --- Handle Open String (Fret 0) ---
        // If the touch is above the first fret wire
        if (ty < this.fretPositions[0] && ty >= this.fretPositions[0] - 50) {
            fIdx = 0;
        } else {
            // --- Handle Frets 1 to 12 ---
            for (let i = 1; i <= 12; i++) {
                if (ty >= this.fretPositions[i - 1] && ty <= this.fretPositions[i]) {
                    fIdx = i;
                    break;
                }
            }
        }

        const { firstStringX, spacingX } = this.getFretboardLayout();
        const sIdx = Math.round((tx - firstStringX) / spacingX);
    
        // 2. Logic Branching
        if (this.hasFret && sIdx >= 0 && sIdx < 6 && fIdx !== -1) {
            // Standard Fretboard Tap
            const key = `${sIdx}-${fIdx}`;
            if (this.tappedKeys.has(key)) return;            
            
            const noteIdx = (STRINGS[sIdx] + fIdx) % 12;
            const noteName = NOTES[noteIdx];

            //alert (` ${sIdx} ${sIdx} notename=${noteName}`);

            const x = firstStringX + (sIdx * spacingX);
            const y = (fIdx==0) ? this.fretPositions[fIdx] - 20 :
                    (this.fretPositions[fIdx] + this.fretPositions[fIdx-1]) / 2;

            //this.variant.label=`> ${x} ${y} `;
            const skipSaveTap = this.variant.onTap(this, sIdx, fIdx, noteName, x, y, noteIdx);
            if (!this.variant.skipSavingTaps) this.tappedKeys.add(key);
                
                        
        } else {
            // 3. UI/Keyboard Tap (Outside the frets)
            // We pass the corrected tx and ty so variant.onTap can check its buttons

            //this.variant.label=`>> ${tx} ${ty} `;
            if (this.variant && this.variant.onTap) {
                this.variant.onTap(this, null, null, null, tx, ty, null);
            }
        }
    }

    async setVoicingVariant(variantIdx){
        if (this.currentVoicing) {
            this._currentChordVariant = variantIdx;
            this.addVoicingToHistory(this.currentVoicing.key, this.currentVoicing.suffix, variantIdx);
        }
    }
    /**
     * Fetches a specific voicing and populates the engine history
     * @param {string} key - e.g., 'C'
     * @param {string} suffix - e.g., 'maj7'
     * @param {number} variantIdx - Index in the positions array
     */
    async addVoicingToHistory(key, suffix, variantIdx = null) {
        try {
            const keyMap = { "Db": "Csharp",  "Gb": "Fsharp", 
                             "A#": "Bb", "C#": "Csharp", "D#": "Eb", "F#": "Fsharp", "G#": "Ab", 
             };
            const normalizedKey = keyMap[key] || key;

            let positions = [];
            if (variantIdx === null) 
                variantIdx = this._currentChordVariant; // If no specific variant is requested, use the last one set by the buttons
            if (variantIdx !== null) {
                positions = await dbService.getChordVoicings(normalizedKey, suffix);
                if (!positions || !positions[variantIdx]) {
                    console.warn(`Voicing ${variantIdx} not found for ${key} (${normalizedKey}) ${suffix}`);
                    return;
                }
            }

            const cvId = "chordVoicing"; // Unique ID for this type of history item
            this.removeHistoryItems(null,null,cvId); // Clear previous chord voicing from history
            this.currentVoicing = { key, suffix, variantIdx }; // Store current voicing for reference
            if (variantIdx === null || variantIdx >= positions.length) return; // If no specific variant is requested, we just update the buttons without adding to history
            KeyboardHelper.updateChordVariantButtons(this.variant, variantIdx, positions.length); // Update UI buttons based on available variants
            const voicing = positions[variantIdx];
            const frets = voicing.frets;     
            const fingers = voicing.fingers; 
            const baseFret = voicing.baseFret || 1; // Critical: use baseFret or default to 1

            const { firstStringX, spacingX } = this.getFretboardLayout();
            const semitones = CHORD_FORMULAS.find(c => c.suffix === suffix)?.semitones || [];
            const currentChordRootIdx = NOTES.indexOf(key) || FLAT_NAMES.indexOf(key) || 0; // Fallback to 0 if not found, but ideally should be found

            for (let sIdx = 0; sIdx < frets.length; sIdx++) {
                const char = frets[sIdx];
                
                // Handle muted strings
                if (char === 'x' || char === 'X' || char === -1 || char === '-1') {
                    continue;
                }

                // 1. Convert fret character (Base-36 handles up to fret 35)
                const relativeFret = parseInt(char, 36);

                // 2. Calculate Absolute Fret
                // If it's an open string (0), it stays 0. 
                // If it's fretted (>0), we calculate relative to baseFret.
                const fIdx = (relativeFret > 0) 
                    ? (baseFret + relativeFret - 1) 
                    : relativeFret;

                // 3. Y calculation logic
                const visualY = (fIdx === 0) 
                    ? this.fretPositions[fIdx] - 20 
                    : (this.fretPositions[fIdx] + this.fretPositions[fIdx - 1]) / 2;

                // 4. X calculation logic
                const visualX = firstStringX + (sIdx * spacingX);

                // 5. Resolve labels and metadata
                const noteIdx = (STRINGS[sIdx] + fIdx) % 12;
                const fingerId = fingers[sIdx];
                // 1. Calculate the distance from root (e.g., 4 semitones)
                const intervalDistance = (noteIdx - currentChordRootIdx + 12) % 12;
                const semitonePosition = semitones.indexOf(intervalDistance);
                // If the note isn't in the chord (indexOf returns -1), fallback to a default color
                const feedbackColor = (semitonePosition !== -1) 
                    ? this.getIntervalColor(semitones[semitonePosition]) 
                    : "#555"; // Default grey for notes not in the chord definition

                // 6. Push to history
                this.history.push({ 
                    x: visualX, 
                    y: visualY, 
                    sIdx: sIdx, 
                    fret: fIdx, 
                    name: (fingerId === '0' || !fingerId) ? '' : fingerId, 
                    noteIdx: noteIdx, 
                    color: feedbackColor, 
                    id: cvId, // Use the unique ID for chord voicings
                    size: this.uiprop.drawNodeChordSize,
                });
            }

        } catch (err) {
            console.error("Engine failed to load voicing:", err);
        }
    }
    animate(x, y, name, color) {
        this.animations.push({ x, y, name, color, startTime: Date.now() });
    }

    incrementLives(inc=1,max=3) {
        this.livesLeft +=inc;
        if (this.livesLeft>max) this.livesLeft=max;
        if (this.livesLeft<0) this.livesLeft=0;
        const char="❤";
        this.livesLabel.text = char.repeat(this.livesLeft);
        return this.livesLeft; // when 0 , game's over
    }
    drawLabels() {
        if (!this.labels || this.labels.length === 0) return;
        const now = Date.now();
    
        for (let i = this.labels.length - 1; i >= 0; i--) {
            const l = this.labels[i];
            const dt = (now - l.lastUpdate) / 1000; // Delta time in seconds
            const age = now - l.startTime;
    
            if (l.duration !== -1 && age > l.duration) {
                this.labels.splice(i, 1);
                continue;
            }
    
            // 1. Update Physics (Velocity & Position)
            if (l.accel !== 0) {
                // Apply acceleration to the magnitude of velocity
                const currentSpeed = Math.sqrt(l.vx * l.vx + l.vy * l.vy) + (l.accel * dt);
                l.vx = Math.cos(l.dirRad) * currentSpeed;
                l.vy = Math.sin(l.dirRad) * currentSpeed;
            }
            
            l.x += l.vx * dt;
            l.y += l.vy * dt;
    
            // 2. Update Rotation
            l.vRot += l.aRot * dt;
            l.angle += l.vRot * dt;
            
            l.lastUpdate = now;
    
            // 3. Render with Rotation
            this.ctx.save();
            this.ctx.translate(l.x, l.y);
            this.ctx.rotate(l.angle * (Math.PI / 180));
            
            // Initial "pop" scale animation (from previous step)
            let scale = l.size;
            if (age < 500) {
                scale = l.sizeStart - ( age * l.stepSize) ;
            }
    
            this.ctx.fillStyle = l.color;
            this.ctx.font = `bold ${scale}px sans-serif`;
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            
            // Fade out
            if (l.duration !== -1 && l.duration - age < 500) {
                this.ctx.globalAlpha = (l.duration - age) / 500;
            }
    
            this.ctx.fillText(l.text, 0, 0);
            this.ctx.restore();
        }
    }
        
    addLabel(text, options = {}) {
        const { 
            x = this.canvas.width / 2, 
            y = 18, 
            color = "green", 
            size = 24, 
            sizeStart = 48,
            duration = 2,
            direction = 0,         // Degrees (0 up, 90 right, 180 down)
            speed = 0,             // px/sec
            acceleration = 0,      // px/sec^2
            rotationSpeed = 0,     // deg/sec
            rotationAccel = 0      // deg/sec^2
        } = options;
    
        this.labels = this.labels || [];
        const threshold = 10;
    
        // Logic to find and replace existing labels at x,y
        const existingIndex = this.labels.findIndex(l => 
            Math.abs(l.x - x) < threshold && 
            Math.abs(l.y - y) < threshold
        );       
        // Convert direction (degrees) to a movement vector
        const rad = (direction - 90) * (Math.PI / 180); // Adjusting so 0 is Up
        const stepSize = (sizeStart - size)/500.0;

        const newLabel =({
            text, color, x, y, 
            size,
            sizeStart,
            startTime: Date.now(),
            lastUpdate: Date.now(),
            duration: duration === -1 ? -1 : duration * 1000,
            // Physics state
            vx: Math.cos(rad) * speed,
            vy: Math.sin(rad) * speed,
            accel: acceleration,
            angle: 0,
            vRot: rotationSpeed,
            aRot: rotationAccel,
            dirRad: rad,
            stepSize: stepSize // size reduction or augmentation step per ms
        });

        if (existingIndex !== -1) {
            this.labels[existingIndex] = newLabel;
        } else {
            this.labels.push(newLabel);
        }
        return newLabel;
    }

    getSectionCenterY(startFret, endFret) {
        const top = this.fretPositions[startFret - 1];
        const bottom = this.fretPositions[endFret];
        return (top + bottom) / 2;
    }
    drawTapDebug() {
        if (this.lastTapX === null || this.tapCircleRadius <= 0) return;
    
        const ctx = this.ctx;
        ctx.save();
        
        // Draw a crosshair
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        // Horizontal line
        ctx.moveTo(this.lastTapX - 15, this.lastTapY);
        ctx.lineTo(this.lastTapX + 15, this.lastTapY);
        // Vertical line
        ctx.moveTo(this.lastTapX, this.lastTapY - 15);
        ctx.lineTo(this.lastTapX, this.lastTapY + 15);
        ctx.stroke();
    
        // Draw an expanding/fading circle
        ctx.beginPath();
        ctx.arc(this.lastTapX, this.lastTapY, 25 - this.tapCircleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 0, 0, ${this.tapCircleRadius / 20})`;
        ctx.stroke();
    
        ctx.restore();
    
        // Slowly fade the debug indicator
        this.tapCircleRadius -= 0.5;
    }
    
    drawHeatMap() {
        if (!this.showDebug || !this.isAutoPaused) return;
        if (this.variant?.skipHeatMap) return;
        const ctx = this.ctx;
        const fullW = this.canvas.width;
        const activeW = fullW * (this.viewWidthFactor || 1.0);
        const offsetX = (fullW - activeW) / 2; // The gap to the left of the centered area

        const spacingX = (activeW - this.marginX * 2) / 5;
    
        let scores = Object.values(this.stats).filter(s => s !== -1);
        if (scores.length === 0) return;
    
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const range = maxScore - minScore || 1;
    
        ctx.save();
        ctx.globalCompositeOperation = "screen"; 
    
        for (let s = 0; s < 6; s++) {
            const x = this.marginX + (s * spacingX);
            
            // Change loop to go from 0 to 12 (13 positions total: Open + 12 Frets)
            for (let f = 0; f <= 12; f++) {
                // 1. Correct Note Calculation
                // If f=0, semitones added is 0 (Open String)
                const noteName = NOTES[(STRINGS[s] + f) % 12];
                const score = this.stats[`${this.statKey }${s}-${noteName}`] ?? -1;
            
                if (score === -1) continue;
            
                const normalized = (score - minScore) / range;
                const hue = normalized * 120; 
            
                // 2. Correct Y-Positioning
                let yCenter;
                if (f === 0) {
                    // Position for Open Note: roughly 25px above the first fret wire
                    yCenter = this.fretPositions[0] - 25;
                } else {
                    // Standard Fret Positioning (f-1 because fretPositions[0] is the 1st wire)
                    const yStart = this.fretPositions[f - 1];
                    const yEnd = this.fretPositions[f];
                    yCenter = (yStart + yEnd) / 2;
                }
            
                // 3. Drawing
                const grad = ctx.createRadialGradient(x + offsetX, yCenter, 0, x + offsetX, yCenter, 22);
                grad.addColorStop(0, `hsla(${hue}, 100%, 50%, 0.6)`);
                grad.addColorStop(0.4, `hsla(${hue}, 100%, 50%, 0.3)`);
                grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
            
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x + offsetX, yCenter, 25, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    highlightFretRange(startFret, endFret, inverse = false){
        this.HighlightFrets={startFret, endFret, inverse};
    }
    
    drawHighlightFretRange() {
        if (!this.HighlightFrets) return;
        const ctx = this.ctx;
        const startFret = this.HighlightFrets.startFret;
        const endFret = this.HighlightFrets.endFret;

        const yTop = startFret>0 ? 
            this.fretPositions[startFret-1]:
            this.fretPositions[0]-50;
        const yBottom = this.fretPositions[endFret];
        ctx.fillStyle = "rgba(255, 255, 255, 0.1 )"; // Soft highlight

        const fbTop = this.fretPositions[0];
        const fbBottom = this.fretPositions[12];

        const xleft = this.getStringX(0)-10;
        const w = this.getStringX(5)+10- xleft;
        if (this.HighlightFrets.inverse) {
            if (startFret>0) ctx.fillRect(xleft, fbTop, w, yTop- fbTop );
            ctx.fillRect(xleft, yBottom, w, fbBottom - yBottom);
        } else {
            // Standard behavior: Draw the selection
            ctx.fillRect(xleft, yTop, w, yBottom - yTop);
        }
    }

    draw() {
        requestAnimationFrame(() => this.draw());
        if (this.isPaused) return;
    
        const now = Date.now();
        const idleTime = now - this.lastTapTime;
        const ctx = this.ctx;
        
        // 1. Calculate dimensions and Horizontal Centering
        const fullW = this.canvas.width;
        const activeW = fullW * (this.viewWidthFactor || 1.0);
        const h = this.canvas.height;
        
        const factor = this.viewHeightFactor || 1.0;
        const fbHeight = h * factor;
    
        // Clear the entire canvas
        ctx.clearRect(0, 0, fullW, h);
               
        if (this.showDebug && this.isAutoPaused) {
            this.renderStats(true);
        } else {
           if (this.showDebug) this.renderStats(false);
        }

        const { firstStringX, spacingX , offsetX} = this.getFretboardLayout();

        if (this.hasFret){
    
            // 2. Draw Frets/Markers (applying offsetX)
            ctx.strokeStyle = "#444";
            this.fretPositions.forEach((y, i) => {
                const scaledY = y;
                ctx.lineWidth = i === 0 ? 6 : 2;
                ctx.beginPath(); 
                // Start at offsetX + margin, end at offsetX + activeW - margin
                ctx.moveTo(offsetX + this.marginX, scaledY); 
                ctx.lineTo(offsetX + activeW - this.marginX, scaledY); 
                ctx.stroke();
        
                if (MARKERS.includes(i) && i > 0) {
                    const prevScaledY = this.fretPositions[i-1];
                    const midY = (scaledY + prevScaledY) / 2;
                    ctx.fillStyle = "#777";
                    ctx.beginPath();
                    // Center markers relative to the active area
                    const markerCenterX = offsetX + (activeW / 2);
                    const sideWidth = activeW / 5 / 4.5; // 5 spacing between the 6 strings
                    if (i === 12) {
                        ctx.arc(markerCenterX - sideWidth, midY, 6, 0, Math.PI*2); ctx.fill();
                        ctx.beginPath(); ctx.arc(markerCenterX + sideWidth, midY, 6, 0, Math.PI*2);
                    } else { 
                        ctx.arc(markerCenterX, midY, 6, 0, Math.PI*2); 
                    }
                    ctx.fill();
                }
            });
        
            // 3. Draw Strings (applying offsetX)
            let x = 0;
            for (let i = 0; i < 6; i++) {
                ctx.strokeStyle = "#a87f32";
                ctx.lineWidth = 1 + ((7 - i) * 0.5);
                x = this.getStringX(i);
                ctx.beginPath(); 
                ctx.moveTo(x, this.fretPositions[0]-10); 
                ctx.lineTo(x, this.fretPositions[12]+10); 
                ctx.stroke();
            }

            ctx.strokeStyle = "#333";
            ctx.lineWidth = 1 ;
            x = offsetX+this.marginX;
            ctx.beginPath(); 
            ctx.moveTo(x, this.fretPositions[0]); 
            ctx.lineTo(x, this.fretPositions[12]+10); 
            ctx.stroke();
            x = offsetX + activeW - this.marginX;
            ctx.beginPath(); 
            ctx.moveTo(x, this.fretPositions[0]); 
            ctx.lineTo(x, this.fretPositions[12]+10); 
            ctx.stroke();

            // Highlight frets option
            if (this.HighlightFrets) this.drawHighlightFretRange();
            
            if (this.variant && this.variant.preRender) {
                this.variant.preRender(this, fbHeight); 
            }
            // 4. Draw History & Animations (applying offsetX if they aren't already absolute)
            if (this.showHistory) {
                this.history.forEach(item => {
                    let drawY = item.y;
                    
                    // If it's an open string (fret 0), ensure it's drawn above the first fret wire
                    if (item.fIdx === 0) {
                        drawY = this.fretPositions[0] - 25; 
                    }
                
                    this.drawNode(item.x, drawY, item.name, item.color, item.size, item.alpha);
                });
            }
        
            this.animations = this.animations.filter(a => {
                const p = Math.min((now - a.startTime) / 400, 1);
                this.drawNode(a.x, a.y, a.name, a.color, 80 - (p * 62), 1 - p);
                return p < 1;
            });
        }
        if (this.variant && this.variant.render) {
            this.variant.render(this, fbHeight); 
        }
        this.drawLabels();
    
        // ... [Perfect Animation remains centered to fullW] ...
        if (this.perfectAnim) {
            const elapsed = now - this.perfectAnim.startTime;
            const p = elapsed / this.perfectAnim.duration;
            if (p < 1) {
                //const scale = 1 + Math.sin(p * Math.PI) * 2;
                const scale = 1 + Math.pow(1 - p, 2) * 4;
                const alpha = Math.sin(p * Math.PI) ;
                ctx.save();
                ctx.translate(fullW / 2, h / 2); // Center to the real screen center
                //ctx.rotate(p * -45 * Math.PI / 180);
                ctx.scale(scale, scale);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = "#FFD700";
                ctx.font = "bold 40px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(this.perfectAnim.message, 0, 0);
                ctx.restore();
            } else { 
                this.perfectAnim.repeat--;
                if (this.perfectAnim.repeat ==0) {
                    this.perfectAnim = null;
                    this.gameActive = true;
                    this.lastTapTime = Date.now();
                    this.countdown=0;
                    this.variant.init(this);
                } else{
                    this.triggerPerfect( `${this.perfectAnim.repeat}`, this.perfectAnim.repeat ,  this.perfectAnim.duration);
                }
            }
        }
    
        // 5. Update Hints (applying offsetX)
        if ((this.score < -20 || this.showNotes) && this.variant && this.variant.targetNote) {
            const elapsed = now - this.variant.tapTime;
            if (elapsed > 2500) {
                ctx.font = "bold 18px sans-serif";
                ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                ctx.textAlign = "center";
                for (let s = 0; s < 6; s++) {
                    for (let f = 1; f <= 12; f++) {
                        if (NOTES[(STRINGS[s] + f) % 12] === this.variant.targetNote) {
                            const x = offsetX + this.marginX + 10 + (s * spacingX);
                            const y = (this.fretPositions[f] + this.fretPositions[f - 1]) / 2;
                            ctx.fillText(this.variant.targetNote, x, y + 6);
                        }
                    }
                }
            }
        }

        // --- AUTO-PAUSE LOGIC ---
        if (this.gameActive && !this.isAutoPaused) {
            if (idleTime > this.autoPauseDuration) { 
                this.isAutoPaused = true;
                this.gameActive = false;
            }
        }
        
        // Visual feedback for the pause (Darken and Overlay)
        if (this.isAutoPaused) {
            // Optional: Dim the background slightly
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(0, 0, fullW, h);
        
            ctx.fillStyle = "white";
            ctx.font = "bold 20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("PAUSED", fullW / 2, h / 2);
            ctx.font = "12px sans-serif";
            ctx.fillText("Tap anywhere to resume", fullW / 2, h / 2 + 40);
        }
        
        this.drawHeatMap(); // Draw the stats heatmap while idle
        this.drawTapDebug();
        // Top UI
        ctx.fillStyle = "green";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${this.variant ? this.variant.label : ""}`, fullW / 2, 18);
        
    }

    drawNode(x, y, name, color, size, alpha = 1) {
        if (!size) size = this.uiprop.drawNodeSize;
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.beginPath(); this.ctx.arc(x, y, size, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.fillStyle = alpha < 1 ? "white" : "black";
        this.ctx.font = `bold ${Math.max(12, size * 0.7)}px Arial`;
        this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        this.ctx.fillText(name, x, y);
        this.ctx.globalAlpha = 1;
    }

    getIntervalColor(semitone) {
        // Normalize to handle octaves
        const st = Math.abs(semitone) % 12;
    
        const functionalMap = {
            0:  "#FF0000", // Root: The "Anchor" (Red)
            1:  "#4B0082", // b2: High Tension (Indigo)
            2:  "#708090", // 2/9: Extension (Slate Gray)
            3:  "#FFD700", // b3: Minor Quality (Amber)
            4:  "#FFFF00", // 3: Major Quality (Bright Yellow)
            5:  "#32CD32", // 4/11: Stable but needs resolution (Lime)
            6:  "#008080", // b5: The "Blue Note"/Tritone (Teal)
            7:  "#0000FF", // 5: The "Pillar" (Blue)
            8:  "#9400D3", // b6/b13: Dark Extension (Dark Violet)
            9:  "#9370DB", // 6/13: Bright Extension (Medium Purple)
            10: "#FF00FF", // b7: Dominant Tension (Magenta)
            11: "#FF1493"  // 7: Leading Tone (Deep Pink)
        };
    
        return functionalMap[st] || "#FFFFFF";
    }

    getTheoreticName(rootNote, semitone, intervalFormula, displayNames, prefersFlats) {
        const rootIdx = NOTES.indexOf(rootNote);
        const noteIdx = (rootIdx + semitone + 120) % 12;
        let name = displayNames[noteIdx];

        // Handle Sharp-key special cases (E#, B#)
        if (!prefersFlats) {
            if (intervalFormula === "7" && name === "F") return "E#";
            if (intervalFormula === "7" && name === "C") return "B#";
            if (intervalFormula === "3" && name === "F") return "E#"; // For C# Major
        }
        
        // Handle Flat-key special cases (Cb)
        if (prefersFlats) {
            if (intervalFormula === "b7" && name === "B") return "Cb";
            if (intervalFormula === "b5" && name === "B") return "Cb";
        }

        return name;
    }

    getChordSpelling(rootNote, semitones, formula) {
        const prefersFlats = rootNote === "F" || ["A#", "D#", "G#", "C#"].includes(rootNote);
        const displayNames = prefersFlats ? FLAT_NAMES : NOTES;
        const rootIdx = NOTES.indexOf(rootNote);
        
        return semitones.map((st, i) => {
            const noteIdx = (rootIdx + st + 120) % 12;
            let name = displayNames[noteIdx];
            const theoreticName = this.getTheoreticName(
                rootNote, 
                semitones[i], 
                formula[i], 
                displayNames, 
                prefersFlats
            );
            return theoreticName;
        });
    }

    drawChordMap(rootNote, semitones, formula, data) {
        const {
            startFret = 0, endFret = 12, drawTappedOnly = false, 
            drawNoteNames = false, tappedList = [], focus = null, drawFormula = false, fntSize = 16
        } = data;

        const prefersFlats = rootNote === "F" || ["A#", "D#", "G#", "C#"].includes(rootNote);
        const displayNames = prefersFlats ? FLAT_NAMES : NOTES;
        
        const rootPitch = NOTES.indexOf(rootNote);
        const size = fntSize * this.uiprop.scale;
        
        this.ctx.font = `bold ${size}px sans-serif`;
        this.ctx.textAlign = "center";

        for (let s = 0; s < 6; s++) {
            for (let f = startFret; f <= endFret; f++) { 
                const currentPitch = StringBasePitches[s] + f;
                const relativeSemitone = (currentPitch - rootPitch + 120) % 12;
                const rawDist = currentPitch - rootPitch;
                
                const matchIdx = semitones.findIndex(st => 
                    st === rawDist || (st % 12 === relativeSemitone)
                );

                if (matchIdx !== -1) {
                    const noteKey = `${s}-${f}`;                   
                    const tapped = tappedList.includes(noteKey);
                    
                    // Focus Alpha Calculation
                    let focusAlpha = 1.0;
                    if (focus) {
                        const fretDist = Math.abs(f - focus.fret);
                        focusAlpha = Math.max(0.05, 1 - (fretDist / 5));
                    }

                    if (tapped || !drawTappedOnly) {
                        const pos = this.getFretCenter(s, f);
                        const color = this.getIntervalColor(semitones[matchIdx]);
                        
                        // REUSE THE LOGIC HERE
                        const theoreticName = this.getTheoreticName(
                            rootNote, 
                            semitones[matchIdx], 
                            formula[matchIdx], 
                            displayNames, 
                            prefersFlats
                        );

                        let label = drawNoteNames ? theoreticName : formula[matchIdx];

                        this.ctx.globalAlpha = (tapped ? 0.8 : 0.4) * focusAlpha;
                        this.ctx.fillStyle = color;
                        this.ctx.beginPath(); 
                        this.ctx.arc(pos.x, pos.y, size / 2 + 4, 0, Math.PI * 2);
                        this.ctx.fill();

                        this.ctx.globalAlpha = focusAlpha;
                        this.ctx.fillStyle = "white";
                        this.ctx.fillText(label, pos.x, pos.y + 4);
                        if (drawFormula && matchIdx!==0) {
                            this.ctx.font = `bold ${size * 0.7}px sans-serif`;
                            this.ctx.fillText(formula[matchIdx], pos.x+11, pos.y + 14);
                        }
                    }
                }
            }
        }
        this.ctx.globalAlpha = 1;
    }

    calculateAllShapePositions(rootNoteName) {
        const rootIdx = NOTES.indexOf(rootNoteName);
        const getFret = (stringIdx, targetNoteIdx) => (targetNoteIdx - StringBasePitches[stringIdx] + 120) % 12;
    
        const eRoot = getFret(0, rootIdx); // Root on Low E
        const aRoot = getFret(1, rootIdx); // Root on A string

        return {
            // "Forward" Shapes (Root is at the start of the box)
            "E": eRoot,
            "A": aRoot,
            "D": getFret(2, rootIdx), // Root on D string
    
            // "Backward" Shapes (We shift the startFret back so the Root is at the end)
            "G": (eRoot - 3 + 12) % 12, 
            "C": (aRoot - 3 + 12) % 12
        };
    }   
    
    // Add 'offsets' as the third parameter
    drawShapePolygon(startFret, shapeKey, offsets) {
        const ctx = this.ctx;
        const data = CAGED_DATA[shapeKey];
        if (!data) return;
    
        // IMPORTANT: Use the dynamic offsets passed from drawFullFretboardMap
        // fallback to data.min/max only if offsets aren't provided
        const minOffsets = offsets ? offsets.min : data.min;
        const maxOffsets = offsets ? offsets.max : data.max;
    
        ctx.beginPath();
        ctx.fillStyle = data.color + "22"; 
        ctx.strokeStyle = data.color+ "33";
        ctx.lineWidth = 1;
        ctx.lineJoin = "round";
    
        const coords = [];
    
        // Step 1: Trace Right Side (Using maxOffsets)
        for (let s = 0; s < 6; s++) {
            let f = startFret + maxOffsets[s];
            // If the offset pushes us to the "Ghost Fret", 
            // we draw the line to the very edge of the 12th fret
            let pos = this.getFretCenter(s, f);
            if (f > 12) {
                pos = this.getFretCenter(s, 12);
                pos.y=pos.y+30;
            }
            if (f <0) {
                pos = this.getFretCenter(s, 0);
                pos.y=pos.y-30;
            }
            coords.push(pos);
        }
    
        // Step 2: Trace Left Side (Using minOffsets)
        for (let s = 5; s >= 0; s--) {
            let f = startFret + minOffsets[s];
            let pos = this.getFretCenter(s, f);
            if (f > 12) {
                pos = this.getFretCenter(s, 12);
                pos.y=pos.y+30;
            }
            if (f <0) {
                pos = this.getFretCenter(s, 0);
                pos.y=pos.y-30;
            }
            coords.push(pos);
        }

        let corner=null;
        let last = null;
            
        coords.forEach((p, i) => {
            if (i === 0) {
                ctx.moveTo(p.x, p.y);
                corner = p;
            } else {
                // Only step if BOTH X and Y have changed (diagonal move)
                if (p.x !== last.x && p.y !== last.y) {
                    const halfX = (p.x - last.x) / 2;
                    const halfY = (p.y - last.y) / 2;
        
                    // Logic: Move horizontally to the half-way point, 
                    // then vertically to the target Y, 
                    // then horizontally to the target X.
                    ctx.lineTo(last.x + halfX, last.y); // Horizontal leg
                    ctx.lineTo(p.x - halfX, p.y);      // Diagonal/Vertical jump
                    ctx.lineTo(p.x, p.y);               // Final arrival
                } else {
                    // Straight horizontal or vertical line
                    ctx.lineTo(p.x, p.y);
                }
            }
            //ctx.fillStyle = "white"; ctx.fillText(`${i}`, p.x+10, p.y - 10);
            last = p;
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    
        // Labeling logic
        ctx.fillStyle = data.color+"33";
        ctx.font = "bold 20px sans-serif";
        const firstPos = this.getFretCenter(0, startFret);
        ctx.fillText(`${shapeKey}`, corner.x+30, corner.y - 30);
    }
    calculateDynamicOffsets(startFret, scaleST, rootIdx) {
        const min = [0, 0, 0, 0, 0, 0];
        const max = [0, 0, 0, 0, 0, 0];
    
        for (let s = 0; s < 6; s++) {
            const stringRoot = StringBasePitches[s];
            let foundAny = false;
    
            // Scan 6 frets ahead of the startFret to find scale members
            for (let f = 0; f < 6; f++) {
                const currentPitch = stringRoot + startFret + f;
                const dist = (currentPitch - rootIdx + 120) % 12;
    
                if (scaleST.includes(dist)) {
                    if (!foundAny) {
                        min[s] = f;
                        foundAny = true;
                    }
                    max[s] = f;
                }
            }
        }
        return { min, max };
    }
    // This function finds the actual boundaries of the scale notes within a shape's zone

    getTightOffsets(startFret, scaleST, rootIdx) {
        const min = [];
        const max = [];
    
        for (let s = 0; s < 6; s++) {
            const stringPitch = StringBasePitches[s];
            let sMin = null;
            let sMax = null;
    
            for (let offset = -1; offset <= 3; offset++) {
                const f = startFret + offset;
                
                // FAKE FRET LOGIC:
                // (f + 12) % 12 turns -1 into 11, 0 into 0, 13 into 1...
                const virtualFret = (f + 12) % 12; 
                
                const pitch = stringPitch + virtualFret;
                const dist = (pitch - rootIdx + 120) % 12;
    
                if (scaleST.includes(dist)) {
                    if (sMin === null) sMin = offset;
                    sMax = offset;
                }
            }
            // If no notes are found, we default to 0 to prevent the polygon from breaking
            min[s] = sMin !== null ? sMin : 0;
            max[s] = sMax !== null ? sMax : 0;
        }
        return { min, max };
    }
    
    drawFullFretboardMap(rootNoteName, scaleST) {
        const rootIdx = NOTES.indexOf(rootNoteName);
        const shapePositions = this.calculateAllShapePositions(rootNoteName);
        
        Object.keys(shapePositions).forEach(shapeKey => {
            //if (shapeKey!="C" && shapeKey!="G") return;
            let startFret = shapePositions[shapeKey];
            
            // Keep everything in a consistent 0-11 range before drawing
            startFret = (startFret + 12) % 12; 
            
            const dynamicData = this.getTightOffsets(startFret, scaleST, rootIdx);
            this.drawShapePolygon(startFret, shapeKey, dynamicData);
        });
    }
    
    triggerPerfect(msg, repeat=0, duration=1500 ) {
        this.perfectAnim = {
            startTime: Date.now(),
            duration: duration,
            message: msg,
            repeat: repeat
        };
    }

    getCustomRandom(a,b) {
        let num = Math.random() * (b - a) + a;
        return num ;
       }

    // returns a set of noteIdx that have been tapped on a specific string (or all strings if sIdx is null)
    tappedNoteSet(sIdx = null) {
        return new Set(
            this.history
                .filter(h => sIdx === null || h.sIdx === sIdx)
                .map(h => h.noteIdx)
        );
    }
                                            
    removeHistoryItems(sIdx = null, noteIdx = null, id = null) {
        this.history = this.history.filter(item => {
            // Check if the item matches EVERY non-null criteria provided
            const matchSIdx = (sIdx === null || item.sIdx === sIdx);
            const matchNote = (noteIdx === null || item.noteIdx === noteIdx);
            const matchId = (id === null || item.id === id);

            // If it matches all specified filters, we REMOVE it (return false)
            // Otherwise, we KEEP it (return true)
            return !(matchSIdx && matchNote && matchId);
        });
    }

    processResult(isCorrect, data) {
        const { visualX, visualY, noteName, noteIdx, sIdx, fret, distance, stayOnChallenge, color , skipHistory, skipScore} = data;
        const now = Date.now();
        const delay = now - this.variant.startTime;
        const rspeed = (Math.random() - 0.5) * 30;
        const tspeed = 180;
        const taccel = 60 + (Math.random() - 0.5) * 50;
        const up = this.getCustomRandom(360-25,360-45);
        const down = this.getCustomRandom(180+25,180+40);

        const speedBonus = Math.max(0, 100 - (delay / 100));
        const final = Math.round(Math.max(0, this.score) + speedBonus);
        
        if (isCorrect) {
            // 1. Calculate Score & Stats
            this.totalFound++;
            this.totalDelay += delay;
            this.avgReactionTime = this.totalDelay / this.totalFound / 1000;
            this.score=final;
    
            // 2. Effects (Using the specific chord-slot color if provided)
            const feedbackColor = color || "#4CAF50"; 
            if (! skipHistory){
                this.history.push({ x: visualX, y: visualY, sIdx: sIdx, fret: fret, name: noteName, noteIdx: noteIdx, color: feedbackColor, id: sIdx });
            }
            this.animate(visualX, visualY, noteName, feedbackColor);
            if (!skipScore)
                this.addLabel(`${final}`, { duration: 2 , color:"green", x: visualX+20, y: visualY-10, 
                                  rotationSpeed:rspeed, speed:tspeed, acceleration : taccel,
                                  direction: up, duration :1, size:30                               
                                  });
        } else {
            // Handle Penalties
            const penalty = (distance ? distance * 20 : 40)+ (this.mistakes*10); 
            this.score -= penalty ;
            this.mistakes++;
            if (! skipHistory){
                this.history.push({ x: visualX, y: visualY, sIdx: sIdx, name: noteName, noteIdx: noteIdx, color: "#FF5252" , id:`${sIdx}-${noteName}` });
            }
            this.animate(visualX, visualY, noteName, "#FF5252");
            if (!skipScore) 
                this.addLabel(`-${penalty}`, { duration: 2 , color:"red", x: visualX-20, y: visualY-10, 
                                  rotationSpeed:rspeed, speed: tspeed, acceleration : taccel, 
                                  direction: down, duration:1, size:30
                                 });
        }

        if (isCorrect){ // solution found record stats
            const key = `${this.statKey}${sIdx}-${noteName}`;
            const existing = this.stats[key];
            this.stats[key] = existing === undefined ? final : Math.round((final + existing) / 2);
        }        
        // check for Game over or continue
        if (!stayOnChallenge) {
            this.gameActive = false;
            localStorage.setItem(this._localStorageKey, JSON.stringify(this.stats));//persist stats
            // Short delay so you can see the game result
            setTimeout(() => this.reset(true), 1200);
        } else {
            // refresh timer challenge is not over yet
            this.variant.startTime = Date.now(); 
        }
    }
    
    getWorstCombos(limit, exclude = null, snum = null, alternate = null) {
        let unplayed = [], played = [];
        
        // if alternate is null, shoose randomly between NOTES and FLAT_NAMES for the sourceNotes. If it's true, use FLAT_NAMES, if false use NOTES.
        if (alternate===null) alternate = Math.random() < 0.5;
        const sourceNotes = alternate ? FLAT_NAMES : NOTES;
        const isExcluded = (n) => exclude !== null && n === exclude;

        if (this.variant?.noStringStat) {
            sourceNotes.forEach((n, i) => {
                if (isExcluded(n)) return; 
                const score = this.stats[`${this.statKey}-${n}`] ?? -1;
                const item = { note: n, noteIdx: i, score: score };                
                if (score === -1) unplayed.push(item);
                else played.push(item);
            });
        } else {
            const sStart = snum ? snum : 0;
            const sEnd = snum ? snum + 1 : 6;
            for (let s = sStart; s < sEnd; s++) {
                sourceNotes.forEach((n, i) => {
                    if (isExcluded(n)) return;
                    const score = this.stats[`${this.statKey}${s}-${n}`] ?? -1;
                    const item = { sIdx: s, note: n, noteIdx: i, score: score };
                    if (score === -1) unplayed.push(item);
                    else played.push(item);
                });
            }
        }

        if (unplayed.length > 0) {
            return unplayed.sort(() => Math.random() - 0.5).slice(0, limit);
        }

        return played.sort((a, b) => a.score - b.score).slice(0, limit);
    }

    renderStats(full) {
        let all = [];
        let sum = 0, count = 0;
        const ctx = this.ctx;
        const w = this.canvas.width;

        if (this.variant?.noStringStat){
            NOTES.forEach(n => {
                const val = this.stats[`${this.statKey }-${n}`] ?? -1;
                all.push({ label: `${this.statKey }-${n}`, score: val });
                if(val !== -1) { sum += val; count++; }
            });
        }if (this.variant?.singleStatKey){
            sum = this.stats[`${this.statKey }`] ?? 0;
            all.push({ label: `${this.statKey}`, score: sum });
            count=1;
        }else{
            for (let s = 0; s < 6; s++) {
                NOTES.forEach(n => {
                    const val = this.stats[`${this.statKey }${s}-${n}`] ?? -1;
                    all.push({ label: `${this.statKey }${s+1}-${n}`, score: val });
                    if(val !== -1) { sum += val; count++; }
                });
            }
        }


        const sorted = all.sort((a, b) => a.score - b.score);
        const half = Math.min(10,sorted.length/2);
        const worst10 = sorted.slice(0, half);
        const best10 = sorted.filter(x => x.score !== -1).reverse().slice(0, half);
        if (this.statKey){
            this.avg = count > 0 ? Math.round(sum / count) : 0;
        }
        ctx.textAlign = "right";
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = "#FFD700";
        let y = 30; // Starting vertical position
        const lineHeight = 15;
        
        // Header Stats
        ctx.textAlign = "right";
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = "#FFD700"+"66";
        ctx.fillText(`Average     : ${this.avg}`, w - 10, y); y += lineHeight;
        ctx.fillText(`React. time : ${(this.avgReactionTime || 0).toFixed(1)}`, w - 10, y);

        if (! full) return;
        
        y += lineHeight + 5; 
        
        // Worst 10 List
        ctx.font = "13px monospace";
        ctx.fillStyle = "#FF5252";
        ctx.fillText("--- WORST  ---", w - 10, y); y += lineHeight;
        
        worst10.forEach((obj) => {
            ctx.fillStyle = obj.score === -1 ? "#666" : "#FF5252";
            ctx.fillText(`${obj.label}: ${obj.score === -1 ? "--" : obj.score}`, w - 10, y); y += lineHeight;
        });
        
        y += 10; // Extra gap between lists
        
        // Best 10 List
        ctx.fillStyle = "#4CAF50";
        ctx.fillText("--- BEST  ---", w - 10, y); y += lineHeight;
        best10.forEach((obj) => {
                    ctx.fillStyle = "#4CAF50";
                    ctx.fillText(`${obj.label}: ${obj.score}`, w - 10, y);y += lineHeight;
        });
    }

    playChord(strumSpeed = 0.03) {
        if (!this.history.length) return;

        // 1. Group by string index and pick the highest fret/note per string 
        // (Ensures one note per string if history has duplicates)
        const activeNotes = Array.from(
            this.history.reduce((map, entry) => {
                map.set(entry.sIdx, entry);
                return map;
            }, new Map()).values()
        );

        // 2. Sort by string index (sIdx 0 is the low E string)
        activeNotes.sort((a, b) => a.sIdx - b.sIdx);

        // 3. Play each note with a staggered delay
        activeNotes.forEach((note, index) => {
            const pitch = StringBasePitches[note.sIdx] + note.fret;
            const delay = index * strumSpeed;
            this.audio.playNote(pitch, delay);
        });
    }

}
