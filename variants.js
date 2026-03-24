const ExtremeAccidentalVariant = {
    label: "EXTREME DRILL",
    statKey: "Ex",
    init(engine) {
        KeyboardHelper.initButtons(engine, this);

        // 1. Truly Random Anchor (Any of the 12 notes)
        this.anchorIdx = Math.floor(Math.random() * 12);
        this.anchorNote = NOTES[this.anchorIdx];

        // 2. Random Shift (-2 to +2, excluding 0)
        const shifts = [-2, -1];
        this.currentShift = shifts[Math.floor(Math.random() * shifts.length)];

        const labels = {
            "-2": "bb (Double Flat)",
            "-1": "b (Flat)",
            "1": "# (Sharp)",
            "2": "## (Double Sharp)"
        };
        
        // This is the "Dictionary" prompt
        this.instruction = `${this.anchorNote} ${labels[this.currentShift]}`;

        // 3. Calculate Target Note
        const targetIdx = (this.anchorIdx + this.currentShift + 12) % 12;
        this.targetNote = NOTES[targetIdx];

        this.userAttempt = null;
        this.startTime = Date.now();
        this.skipHeatMap=true;
    },

    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);
        if (!btn) return;

        const isCorrect = btn.note === this.targetNote;
        const tappedIdx = NOTES.indexOf(btn.note);
        
        // Calculate relative position for the 7-square visual
        let diff = tappedIdx - this.anchorIdx;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;

        this.userAttempt = { 
            note: btn.note, 
            isCorrect: isCorrect,
            relPos: diff 
        };

        engine.processResult(isCorrect, {
            visualX: x, visualY: y, noteName: btn.note, distance: 0
        });
    },

    render(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const sqSize = 46, gap = 8;
        const startX = (w - (7 * sqSize + 6 * gap)) / 2;
        const centerY = h / 2 - 40;

        ctx.textAlign = "center";
        
        // Main prompt: e.g., "Bb #"
        ctx.fillStyle = "white";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText(this.instruction, w / 2, centerY - 50);

        for (let i = -3; i <= 3; i++) {
            const x = startX + (i + 3) * (sqSize + gap);
            const isAnchor = (i === 0);
            const isTarget = (i === this.currentShift);

            // Square Styling
            ctx.strokeStyle = isTarget ? "#FFD700" : "#444";
            ctx.lineWidth = isTarget ? 3 : 1;
            KeyboardHelper.roundRect(ctx, x, centerY, sqSize, sqSize, 6, false, true);

            // Square Label (Directional Hint)
            ctx.fillStyle = "#666";
            ctx.font = "10px sans-serif";
            const dirLabels = ["", "bb", "b", "REF", "#", "##", ""];
            ctx.fillText(dirLabels[i + 3], x + sqSize/2, centerY - 8);

            if (isAnchor) {
                // The note you are starting from
                ctx.fillStyle = "white";
                ctx.font = "bold 18px sans-serif";
                ctx.fillText(this.anchorNote, x + sqSize/2, centerY + sqSize/2 + 7);
            } else if (isTarget && !this.userAttempt) {
                // The goal square
                ctx.fillStyle = "rgba(255, 215, 0, 0.4)";
                ctx.font = "bold 22px sans-serif";
                ctx.fillText("?", x + sqSize/2, centerY + sqSize/2 + 7);
            }

            // Visual feedback of your tap
            if (this.userAttempt && this.userAttempt.relPos === i) {
                ctx.fillStyle = this.userAttempt.isCorrect ? "#4CAF50" : "#FF5252";
                ctx.font = "bold 18px sans-serif";
                ctx.fillText(this.userAttempt.note, x + sqSize/2, centerY + sqSize/2 + 7);
            }
        }

        KeyboardHelper.draw(ctx, this.buttons);
    }
};

const KeyboardVariant = {
    label: "What's that note?",
    statKey: "K",
    countdown: 3,
    init(engine) {
        // Pick a target location (using your existing worst-score logic)
        const candidates = engine.getWorstCombos(10);
        const selection = candidates.length > 0 ? 
            candidates[Math.floor(Math.random() * candidates.length)] : 
            { sIdx: Math.floor(Math.random() * 6), note: NOTES[Math.floor(Math.random() * 12)] };

        this.targetString = selection.sIdx;
        this.targetNote = selection.note;
        
        // Find the physical fret for drawing the marker
        for (let f = 1; f <= 12; f++) {
            if (NOTES[(STRINGS[this.targetString] + f) % 12] === this.targetNote) {
                this.targetFret = f;
                break;
            }
        }
        KeyboardHelper.initButtons(engine, this);
        this.startTime = Date.now();
        engine.score=100;
        engine.mistakes=0;
        engine.gameActive = true;

    },
    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);
        if (!btn) return;

        const isCorrect = btn.note === this.targetNote;
        const coords = isCorrect ? 
            engine.getFretCoordinates(this.targetString, this.targetFret) :
            engine.getNoteCoordinates(btn.note, this.targetString);

        engine.processResult(isCorrect, {
            visualX: coords.x, visualY: coords.y,
            sIdx: this.targetString, noteName: btn.note, distance: 0,
            stayOnChallenge: false
        });
        
    },
    render(engine) {
        KeyboardHelper.draw(engine.ctx, this.buttons);
        if (!engine.gameActive) return;
        const coords = engine.getFretCoordinates(this.targetString, this.targetFret);
        engine.drawNode(coords.x, coords.y, "?", "gold", 12, 1);

    }
};

const CHORD_FORMULAS = [
    { label: "Major Chord", formula: ["1", "3", "5"], semitones: [0, 4, 7] },
    { label: "Minor Chord", formula: ["1", "b3", "5"], semitones: [0, 3, 7] },
    { label: "Dominant 7th", formula: ["1", "3", "5", "b7"], semitones: [0, 4, 7, 10] },
    { label: "Major 7th", formula: ["1", "3", "5", "7"], semitones: [0, 4, 7, 11] },
    { label: "Minor 7th", formula: ["1", "b3", "5", "b7"], semitones: [0, 3, 7, 10] },
    { label: "Sus4 Chord", formula: ["1", "4", "5"], semitones: [0, 5, 7] },
    { label: "Sus2 Chord", formula: ["1", "2", "5"], semitones: [0, 2, 7] },
    { label: "Major 6th", formula: ["1", "3", "5", "6"], semitones: [0, 4, 7, 9] },
    { label: "Minor 6th", formula: ["1", "b3", "5", "6"], semitones: [0, 3, 7, 9] },
    { label: "Add9 Chord", formula: ["1", "3", "5", "9"], semitones: [0, 4, 7, 14] }, 
    { label: "Diminished", formula: ["1", "b3", "b5"], semitones: [0, 3, 6] },
    { label: "Augmented", formula: ["1", "3", "#5"], semitones: [0, 4, 8] }
];
function getUniqueIntervals(formulas) {
    const allIntervals = [];
    formulas.forEach(chord => {
        chord.formula.forEach(interval => {
            if (!allIntervals.includes(interval)) {
                allIntervals.push(interval);
            }
        });
    });

    // Optional: Sort them logically so the palette stays organized
    // We want 1, 2, b3, 3... not a random order.
    const order = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "#5", "b6", "6", "b7", "7", "9", "11", "13"];
    return allIntervals.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

const IntervalVariant = {
    label:"",
    statKey: "W1",
    mode: 0, 

    init(engine) {
        this.rootIdx = Math.floor(Math.random() * 12);
        this.rootNote = NOTES[this.rootIdx];
        
        const type = CHORD_FORMULAS[Math.floor(Math.random() * CHORD_FORMULAS.length)];
        this.chordLabel = type.label;
        this.formula = type.formula;
        this.semitones = type.semitones;

        if (this.mode === 1) {
            KeyboardHelper.initDynamicMasterPalette(engine, this);
        } else {
            KeyboardHelper.initButtons(engine, this);
        }

        const w = engine.canvas.width;
        const h = engine.canvas.height;
        KeyboardHelper.addFunctionButton(engine, this, "1|A",  w/2-25, h-265, "#682",()=> this.switchMode(engine));

        this.targetIdx = Math.floor(Math.random() * (this.formula.length - 1)) + 1;
        this.targetInterval = this.formula[this.targetIdx]; 
        this.targetNoteName = NOTES[(this.rootIdx + this.semitones[this.targetIdx]) % 12];

        const prompt = this.mode === 0 ? 
            `Find the missing note` : 
            `What is the role of ${this.targetNoteName}?`;
        
        engine.addLabel(prompt, { duration: -1, y: 80 });

        this.userAttempt = null;
        this.startTime = Date.now();
    },

    switchMode(engine){
        this.mode = this.mode === 0 ? 1 : 0;
        setTimeout(() => engine.reset(true), 100);
    },

    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);
        if (!btn) return;

        // Logic Check: Mode 0 looks for Note Name, Mode 1 looks for Interval String
        const isCorrect = this.mode === 0 ? 
            btn.note === this.targetNoteName : 
            btn.note === this.targetInterval;
        
        const clickedSlotIdx = this.mode === 1 ? 
            this.formula.indexOf(btn.note) : 
            this.semitones.indexOf((NOTES.indexOf(btn.note) - this.rootIdx + 12) % 12);

        this.userAttempt = { 
            val: btn.note, 
            isCorrect: isCorrect,
            slotIdx: clickedSlotIdx 
        };

        engine.processResult(isCorrect, {
            visualX: x, visualY: y, noteName: btn.note, distance: 0
        });

        engine.addLabel(isCorrect ? "Correct!" : "Try again", { 
            color: isCorrect ? "green" : "red", 
            duration: 1 
        });
    },

    render(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const sqSize = 55, gap = 10;
        const totalW = (this.formula.length * sqSize) + ((this.formula.length - 1) * gap);
        const startX = (w - totalW) / 2;
        const centerY = h / 2 - 40;

        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(`${this.rootNote} ${this.chordLabel}`, w / 2, centerY - 70);
        
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText(this.mode === 0 ? "Find the missing note:" : "Identify the role:", w / 2, centerY - 45);

        this.formula.forEach((interval, i) => {
            const x = startX + i * (sqSize + gap);
            const isTarget = (i === this.targetIdx);
            const noteAtSlot = NOTES[(this.rootIdx + this.semitones[i]) % 12];

            ctx.strokeStyle = isTarget ? "gold" : "#444";
            ctx.lineWidth = isTarget ? 3 : 1;
            KeyboardHelper.roundRect(ctx, x, centerY, sqSize, sqSize, 8, false, true);

            if (i === 0 || !isTarget) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                ctx.font = "14px sans-serif";
                ctx.fillText(interval, x + sqSize/2, centerY + 20);
                ctx.fillStyle = "white";
                ctx.font = "bold 18px sans-serif";
                ctx.fillText(noteAtSlot, x + sqSize/2, centerY + 42);
            } else {
                if (this.userAttempt?.isCorrect) {
                    ctx.fillStyle = "#4CAF50";
                    ctx.font = "bold 20px sans-serif";
                    ctx.fillText(this.mode === 0 ? noteAtSlot : interval, x + sqSize/2, centerY + sqSize/2 + 7);
                } else {
                    ctx.fillStyle = "gold";
                    ctx.font = "bold 22px sans-serif";
                    ctx.fillText(this.mode === 1 ? this.targetNoteName : "?", x + sqSize/2, centerY + sqSize/2 + 7);
                }
            }
        });

        if (this.userAttempt && !this.userAttempt.isCorrect) {
            ctx.fillStyle = "#FF5252";
            ctx.font = "bold 16px sans-serif";
            const msg = this.mode === 0 ? 
                `${this.userAttempt.val} is not in this chord` : 
                `${this.userAttempt.val} is not the role of ${this.targetNoteName}`;
            ctx.fillText(msg, w / 2, centerY + sqSize + 40);
        }

        KeyboardHelper.draw(ctx, this.buttons);
    }
};

const SHAPE_RECTANGLE=1;
const SHAPE_ARROW=2;

const KeyboardHelper = {
    // Generate the two-row layout you provided
    initButtons(engine, variant) {
        variant.buttons = [];
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        
        const bw = 48, bh = 48, gap = 8;
        const totalWhiteKeys = 7;
        const whiteRowWidth = (totalWhiteKeys * bw) + ((totalWhiteKeys - 1) * gap);
        
        // Start X for the white keys (centered)
        const startXWhite = (w - whiteRowWidth) / 2;
        const startYWhite = h - 120; // Bottom row
        const startYBlack = startYWhite - (bh + gap); // Top row
    
        // 1. Define White Keys (C to B)
        const whiteNotes =["C", "D", "E", "F", "G", "A", "B"] ;
        
        whiteNotes.forEach((note, i) => {
            variant.buttons.push({
                x: startXWhite + i * (bw + gap),
                y: startYWhite,
                w: bw, h: bh,
                note: note,
                color: "#bbb"
            });
        });
        
        // 2. Define Black Keys with Mode-aware labels
        const blackKeys = [
            { note: "C#", slot: 0.5 },
            { note: "D#", slot: 1.5 },
            { note: "F#", slot: 3.5 },
            { note: "G#", slot: 4.5 },
            { note: "A#", slot: 5.5 }
        ];

        blackKeys.forEach(bk => {
            variant.buttons.push({
                x: startXWhite + bk.slot * (bw + gap),
                y: startYBlack,
                w: bw, h: bh,
                note: bk.note,
                color: "#333"
            });
        });
    },

    addFunctionButton(engine, variant, label, x=10, y=270, color="#666", callback=null, shape=SHAPE_RECTANGLE, rotation=0) {
        variant.buttons.push({
                x: x,
                y: y,
                w: shape===SHAPE_ARROW ? 40 : 55,
                h: shape===SHAPE_ARROW ? 40 : 40,
                note: label,
                color: color,
                callback,
                shape,
                rotation
            });
    },

    initDynamicMasterPalette(engine, variant) {
        variant.buttons = [];
        const btnW = 50, btnH = 40, gap = 8;
        const cols = 4;
        
        // Get all unique intervals from your specific CHORD_FORMULAS array
        const masterList = getUniqueIntervals(CHORD_FORMULAS);
    
        const totalW = (cols * btnW) + ((cols - 1) * gap);
        const startX = (engine.canvas.width - totalW) / 2;
        const startY = engine.canvas.height - 220; // Move up if list gets long
    
        masterList.forEach((interval, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Visual logic: highlight intervals that are in the CURRENT chord
            const isInCurrentChord = variant.formula.includes(interval);
            
            variant.buttons.push({
                x: startX + col * (btnW + gap),
                y: startY + row * (btnH + gap),
                w: btnW,
                h: btnH,
                note: interval,
                // If it's in the chord, give it a subtle border or different shade
                color: interval === "1" ? "#cc0000" : (isInCurrentChord ? "#666" : "#333"),
                borderColor: isInCurrentChord ? "gold" : "transparent"
            });
        });
    },

    // Hit detection for any variant using this helper
    checkClick(buttons, x, y) {
        //alert(`${x} ${y}`);
        const btn= buttons.find(b => x >= b.x && x <= (b.x + b.w) && y >= b.y && y <= (b.y + b.h));
        if (btn && btn.callback && typeof btn.callback === 'function') {
            btn.callback();
            return null;
        }
        return btn;
    },

    // Standard rendering loop
    draw(ctx, buttons) {
        buttons.forEach(btn => {
            ctx.fillStyle = btn.color;
            ctx.strokeStyle = "#999";
            if (btn.shape===SHAPE_ARROW)
                this.drawArrow(ctx, btn.x, btn.y, 30, btn.rotation)
            else
                this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
            
            ctx.fillStyle = btn.color === "#333" ? "white" : "black";
            ctx.font = "bold 16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(btn.note, btn.x + btn.w/2, btn.y + btn.h/2 + 6);
        });
    },

    roundRect(ctx, x, y, width, height, radius, fill=true, stroke=true) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    },

    drawArrow(ctx, x, y, size, rotation=0, fill=true, stroke=true) {
        ctx.save();
        
        // 1. Move to the center of where the button should be
        ctx.translate(x, y);
        
        // 2. Rotate the entire coordinate system
        ctx.rotate(rotation * Math.PI / 180);
        
        // 3. Define the triangle points relative to (0,0)
        // We offset by half-size so the rotation happens around the center
        const half = size / 2;
        ctx.beginPath();
        ctx.moveTo(0, -half);          // Top point (Tip)
        ctx.lineTo(half, half);        // Bottom right
        ctx.lineTo(-half, half);       // Bottom left
        ctx.closePath();
        
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
        
        ctx.restore(); // Reset translation/rotation for the next draw call
    }
};


const SectionVariant = {
    sectionSeq: 0,
    range: null,
    statKey: "Se",
    init(engine) {
        const sections = [[1,12],[1, 4], [5, 8], [9, 12],[1,7],[5,12]];
        if (!this.range) {
            this.range = sections[this.sectionSeq];
            this.sectionSeq = (this.sectionSeq + 1) % sections.length;
        }
        const candidates = engine.getWorstCombos(5,this.targetNote);
        const selection = candidates[Math.floor(Math.random() * candidates.length)]; 
        this.targetNote = selection.note;
        this.foundCount = 0;
        this.needed = this.calculateNeeded();
        this.startTime = Date.now();
        this.tapTime = Date.now();
        this.noStringStat = true;
        this.cumulScore=0;
        engine.score = 100;
        engine.mistakes=0;
        this.label = `FIND ALL ${this.needed} \"${this.targetNote}\" IN FRET ${this.range[0]} TO ${this.range[1]} `;
        //engine.animate(engine.canvas.width / 2,  engine.getSectionCenterY(this.range[0], this.range[1]), 
        //this.targetNote, "rgba(150,150,150,0.5)");
           
    },

    onTap(engine, s, f, name, x, y) {
        if (f < this.range[0] || f > this.range[1]) return;
        const coords = engine.getFretCoordinates(s, f);

        let stay = true;
        if (name === this.targetNote) {
            this.foundCount++;
            if (this.foundCount >= this.needed){
                stay=false;
                if (engine.mistakes === 0) {
                    engine.triggerPerfect("PERFECT! +25");
                    engine.score += 25;
                }
                
            }
        }
        
        engine.processResult(name === this.targetNote, {
            visualX: coords.x, 
            visualY: coords.y, 
            sIdx: "", // string index not important in this game stats 
            noteName: name,
            distance: Math.abs(f - this.targetFret),
            stayOnChallenge: stay 
        });

        if (name === this.targetNote){
            this.cumulScore += engine.score;
            engine.score = Math.round(this.cumulScore/ this.needed);
        }
    },

    render(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const rangeKey = `${this.range[0]}-${this.range[1]}`;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(0, engine.fretPositions[this.range[0]-1], w, engine.fretPositions[this.range[1]] - engine.fretPositions[this.range[0]-1]);
        engine.drawNode(engine.canvas.width / 2, engine.canvas.height / 2, 
                        this.targetNote,
                        "rgba(129, 79, 189, 0.3)",
                        92,
                        0.3);
    },

    calculateNeeded() {
        let count = 0;
        for (let s = 0; s < 6; s++) {
            for (let f = this.range[0]; f <= this.range[1]; f++) {
                if (NOTES[(STRINGS[s] + f) % 12] === this.targetNote) count++;
            }
        }
        return count || 1;
    }

};


const SingleStringVariant = {
    label: "SINGLE STRING",
    statKey: "St",
    init(engine) {
        const candidates = engine.getWorstCombos(10);
        const selection = candidates[Math.floor(Math.random() * candidates.length)]; 

        this.targetString = selection.sIdx;
        this.targetNote = selection.note;
        engine.mistakes = 0;
        this.foundCount = 0;
        this.needed = 1; 
        
        // Find the correct fret index for distance calculation
        this.targetFret = -1;
        for (let f = 0; f <= 12; f++) {
            if (NOTES[(STRINGS[this.targetString] + f) % 12] === this.targetNote) {
                this.targetFret = f;
                break;
            }
        }

        this.startTime = Date.now();
        this.tapTime = this.startTime;
        engine.score = 100; // Start at 100, drop based on errors
        this.label = `STRING ${this.targetString + 1}: FIND ${this.targetNote}`;
    },

    onTap(engine, s, f, name, x, y) {
        if (s !== this.targetString) return;
    
        // Snap to the center of the touched fret
        const coords = engine.getFretCoordinates(s, f);
    
        engine.processResult(name === this.targetNote, {
            visualX: coords.x, 
            visualY: coords.y, 
            sIdx: s, 
            noteName: name,
            distance: Math.abs(f - this.targetFret)
        });
    },

    render(engine,fbHeight) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const xPos = engine.getStringX(this.targetString);
        
        // String Highlight
        ctx.fillStyle = "rgba(255, 255, 120, 0.35)";
        ctx.fillRect(xPos - 10, engine.fretPositions[0], 20, engine.fretPositions[12] - engine.fretPositions[0]);
        
        // Target Prompt
        engine.drawNode(w / 2, engine.canvas.height / 2, this.targetNote, "rgba(129, 79, 189, 0.3)", 92, 0.3);

    }

};

const ChordCompletionVariant = {
    label: "",
    statKey: "Ch",
    colors: [ "#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#8B00FF","#8B00FF" ],
    clear(engine) {
        // 1. Reset Variant tracking
        this.foundNotes.fill(null);
        this.usedStrings.clear();
        this.rootPitch = null;
        this.completed = false;
    
        // 2. Reset Engine visual tracking
        engine.tappedKeys.clear();
        engine.history = []; // Clears the colored dots on the fretboard
    
        // 3. Optional: Reset start time if you want to reset the speed bonus
        this.startTime = Date.now();
    },

    hints(engine){
        this.showHints = ! this.showHints;
    },

    incrementRoot(engine,inc=1, reset=true,){
        this.rootIdx+=inc;
        if (this.rootIdx<0) this.rootIdx=11;
        if (this.rootIdx>11) this.rootIdx=0
        this.rootNote = NOTES[this.rootIdx];                
        //this.rootIdx = 5;
        if (reset) this.resetGame(engine);
    },

    incrementChord(engine,inc=1, reset=true){
        this.chordIdx += inc;
        if (this.chordIdx <0) this.chordIdx =CHORD_FORMULAS.length-1;
        if (this.chordIdx > CHORD_FORMULAS.length-1) this.chordIdx =0;
        const type = CHORD_FORMULAS[this.chordIdx];
        //const type = CHORD_FORMULAS[9];
        this.chordLabel = type.label;

        this.formula = type.formula;
        this.semitones = type.semitones;
        this.semitones=this.semitones.map(s => s % 12); // to normalize somitones that are > 12 
        
        this.foundNotes = new Array(this.formula.length).fill(null);
        if (reset) this.resetGame(engine);
    },

    resetGame(engine){
        this.usedStrings = new Set(); // Track string indices
        this.historyStack = [];       // For the Undo function
        
        this.completed = false;
        this.startTime = Date.now();
        this.rootPitch = null;        // To store the first note's absolute "height"

        engine.addLabel("Find the root note", { duration: -1 });
        
        this.skipSavingTaps = true; // allow multiple taps on the same note
        this.skipHeatMap=true;

        engine.score = 0;
    },
    
    init(engine) {
        this.showHints = false;
        this.buttons=[];
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        KeyboardHelper.addFunctionButton(engine, this, "Hints", w/2-65, h-65, "#682", () => this.hints(engine)); 
        KeyboardHelper.addFunctionButton(engine, this, "Clear", w/2, h-65, "#A82",  () => this.clear(engine));
        KeyboardHelper.addFunctionButton(engine, this, "^", 25, h-180, "#682",
                                         () => this.incrementRoot(engine,1)); 
        KeyboardHelper.addFunctionButton(engine, this, "v", 25, h-180+50, "#682",
                                         () => this.incrementRoot(engine,-1)); 
        
        KeyboardHelper.addFunctionButton(engine, this, "^", w-25-30, h-180, "#682",
                                         () => this.incrementChord(engine,1));
        KeyboardHelper.addFunctionButton(engine, this, "v", w-25-30, h-180+50, "#682",
                                         () => this.incrementChord(engine,-1));        
        this.rootIdx=-1;
        this.chordIdx=-1;
        this.incrementRoot(engine,1,false);
        this.incrementChord(engine,1,true);
    },

    onTap(engine, sIdx, f, noteName, x, y) {

        const btn = KeyboardHelper.checkClick(this.buttons, x, y);     
        if (!noteName || this.completed) return;
    
        const stringBasePitches = [40, 45, 50, 55, 59, 64]; 
        const currentPitch = stringBasePitches[sIdx] + f;
                
        // 1. Rule: Don't accept multiple notes on the same string
        if (this.usedStrings.has(sIdx)) {
            engine.addLabel("String already used", {color:"red"});
            return;
        }
    
        const tappedIdx = NOTES.indexOf(noteName);
        const tappedSemitones = (tappedIdx - this.rootIdx + 12) % 12;
        const slotIdx = this.semitones.indexOf(tappedSemitones);
    
        // Is this note part of our chord?
        if (slotIdx !== -1) {
            
            // 2. Sophisticated Rule: Root first, but allow lower roots
            if (slotIdx === 0) {
                // If this is the FIRST root found, set the reference floor
                if (this.rootPitch === null) {
                    this.rootPitch = currentPitch;
                } else if (currentPitch < this.rootPitch) {
                    // If this root is lower than our previous root, update the floor
                    this.rootPitch = currentPitch;
                    engine.addLabel("New lower root set!", {color: "cyan", size: 12});
                }
            } else {
                // Not a root note: Must have a root established and cannot be lower
                if (this.rootPitch === null) {
                    engine.addLabel("Must find a root first", {color:"red"});
                    return; 
                } else if (currentPitch < this.rootPitch) {
                    engine.addLabel("Note is lower than root", {color:"red"});
                    return;
                }
            }
    
            // SUCCESS Logic
            // Mark as found in the progress squares if not already filled
            if (this.foundNotes[slotIdx] === null) {
                this.foundNotes[slotIdx] = noteName;
            } else {
                engine.addLabel(`Doubling the ${this.formula[slotIdx]}`, {color: this.colors[slotIdx]});
            }
    
            this.usedStrings.add(sIdx);
            this.historyStack.push({ slotIdx, sIdx });
    
            const isChordComplete = this.foundNotes.every(n => n !== null);
            
            engine.addLabel(isChordComplete ? "Chord Complete!" : "Keep building...", { duration: -1 });
            
            engine.processResult(true, {
                visualX: x, visualY: y, noteName: noteName, sIdx: sIdx,
                color: this.colors[slotIdx],
                stayOnChallenge: true 
            });
    
            if (isChordComplete) {
                if (this.usedStrings.size==6) this.completed = true;
                engine.addLabel("Tap RESET for another chord", {color:"green", size:16, duration:-1});
            }
        } else {
            // WRONG NOTE
            engine.processResult(false, {
                visualX: x, visualY: y, noteName: noteName, sIdx: sIdx,
                color: "red", stayOnChallenge: true, skipHistory: true
            });
        }
    },

    
    render(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const h = engine.canvas.height;

        // 1. Draw Chord Header
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(`${this.rootNote} ${this.chordLabel}`, w / 2, h - 150);

        // 2. Draw Progress Squares
        const sqSize = 50, gap = 10;
        const totalW = (this.formula.length * sqSize) + ((this.formula.length - 1) * gap);
        let startX = (w - totalW) / 2;
        const sqY = h - 120;

        this.formula.forEach((interval, i) => {
            const x = startX + i * (sqSize + gap);
            const foundNote = this.foundNotes[i];

            // Square Border
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 2;
            KeyboardHelper.roundRect(ctx, x, sqY, sqSize, sqSize, 8, false, true);

            if (this.showHints){
                // Interval Label (Hint)
                ctx.fillStyle = "#aaa";
                ctx.font = "12px sans-serif";
                ctx.fillText(interval, x + sqSize/2, sqY - 10);
            }

            // If note found, draw it with its ROYGBIV color
            if (foundNote) {
                ctx.fillStyle = this.colors[i];
                ctx.font = "bold 20px sans-serif";
                ctx.fillText(foundNote, x + sqSize/2, sqY + sqSize/2 + 7);
            }
        });
        KeyboardHelper.draw(ctx, this.buttons);
    }
};

const SlideShowVariant = {
    label: "Fretboard Slideshow",
    skipHeatMap: true, // Don't show heatmap during slideshow
    statKey: null,
    init(engine) {
        this.state = "START"; // START, QUESTION, ANSWER
        // 1. Pick random Fret (1-12) and String (0-5)
        this.currentFret = Math.floor(Math.random() * 11)+1;
        this.currentString = Math.floor(Math.random() * 6);
        
        // 2. Determine Note Name
        const stringBasePitches = [40, 45, 50, 55, 59, 64]; 
        const pitch = stringBasePitches[this.currentString] + this.currentFret;
        this.noteName = NOTES[pitch % 12];

        // 3. Set State
        this.state = "QUESTION";
        this.timer = Date.now();
        this.abortWait=false;

        // Clear engine history/taps so only our "?" shows
        engine.history = [];
        engine.tappedKeys.clear();


    },

    onTap(engine, sIdx, f, noteName, x, y) {
        this.abortWait=true;
    },
    
    render(engine) {
        const ctx = engine.ctx;
        const now = Date.now();
        const elapsed = now - this.timer;
        const pos = engine.getFretCoordinates(this.currentString, this.currentFret);

        if ( this.state === "QUESTION" && (this.abortWait || elapsed >= 3000)) {
            // Reveal the answer after 3 seconds
            this.state = "ANSWER";
                
            engine.totalFound++;
            engine.totalDelay += now - this.timer;
            engine.avg = Math.round((6000 * (engine.totalFound * 1000/ engine.totalDelay))) / 100;
            engine.avgReactionTime = engine.totalDelay / engine.totalFound / 1000;
        } 
        else if (this.state === "ANSWER") {
            engine.addLabel(this.noteName, {x:pos.x, y:pos.y, color:"green", size:55, duration:1});
            // Wait 1 second after answer, then restart
            setTimeout(() => engine.reset(true), 1200);
            this.state = "WAIT";
        }


        // Draw the location marker
        if (this.state === "QUESTION") {
            // Draw a "?" circle at the fret location
            engine.drawNode(pos.x, pos.y, "?", "#555", 20, 1.0);
        } else if (this.state === "ANSWER" || this.state === "WAIT") {
            // Draw the actual note circle
            //engine.drawNode(pos.x, pos.y, this.noteName, "green", 20, 1.0);
        }

    }
};