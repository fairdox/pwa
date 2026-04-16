const STORAGE_KEY = "fretboard_variant_settings";

/**
 * Saves specific attributes for the active variant.
 */
function saveVariantState(variant) {
    if (!variant || !variant.statKey) return;

    const master = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    
    // Use the variant's label or statKey as the unique ID
    master[variant.statKey] = {
        rootIdx: variant.rootIdx,
        chordIdx: variant.chordIdx,
        selectedTopFret: variant.selectedTopFret,
        targetIdx: variant.targetIdx, // This covers stIdx or whatever 'target' you use
        startFret: variant.startFret  // Added this since you're practicing Box 5!
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(master));
}3

/**
 * Restores saved data into the variant before init() runs.
 */
function restoreVariantState(variant) {
    if (!variant || !variant.statKey) return;

    const master = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!master || !master[variant.statKey]) return;

    const saved = master[variant.statKey];
    
    // Silently apply saved values if they exist
    if (saved.rootIdx !== undefined) variant.rootIdx = saved.rootIdx;
    if (saved.chordIdx !== undefined) variant.chordIdx = saved.chordIdx;
    if (saved.selectedTopFret !== undefined) variant.selectedTopFret = saved.selectedTopFret;  
    if (saved.targetIdx !== undefined) variant.targetIdx = saved.targetIdx;
    if (saved.startFret !== undefined) variant.startFret = saved.startFret;
}

const ExtremeAccidentalVariant = {
    label: "EXTREME DRILL",
    statKey: "Ex",
    // Define configuration here or inside init
    availableShifts: [-2, -1, 1, 2, 3, 4], 
    shiftLabels: {
        "-2": "bb",
        "-1": "b",
        "0": "REF",
        "1": "#",
        "2": "##",
        "3": "+3",
        "4": "+4"
    },

    init(engine) {
        KeyboardHelper.initButtons(engine, this);

        this.anchorIdx = Math.floor(Math.random() * 12);
        this.anchorNote = NOTES[this.anchorIdx];

        // Pick a random shift from our available list
        this.currentShift = this.availableShifts[Math.floor(Math.random() * this.availableShifts.length)];
        
        // Dynamic instruction using the shiftLabels
        const label = this.shiftLabels[this.currentShift];
        this.instruction = `${this.anchorNote} ${label}`;

        const targetIdx = (this.anchorIdx + this.currentShift + 12) % 12;
        this.targetNote = NOTES[targetIdx];

        // Determine the range for the UI loop
        this.minShift = Math.min(...this.availableShifts, 0);
        this.maxShift = Math.max(...this.availableShifts, 0);
        this.totalSquares = (this.maxShift - this.minShift) + 1;

        this.userAttempt = null;
        this.startTime = Date.now();
        this.skipHeatMap = true;
        engine.score = 100;
    },

    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);
        if (!btn) return;

        const isCorrect = btn.note === this.targetNote;
        const tappedIdx = NOTES.indexOf(btn.note);
        
        let diff = tappedIdx - this.anchorIdx;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;

        this.userAttempt = { 
            note: btn.note, 
            isCorrect: isCorrect,
            relPos: diff 
        };
        

        engine.processResult(isCorrect, {
            visualX: x, visualY: y, noteName: btn.note, distance: 0,
            stayOnChallenge: !isCorrect               // continue if not correct
        });
    },

    render(engine) {
        const { ctx, canvas } = engine;
        const w = canvas.width, h = canvas.height;
        const sqSize = 46, gap = 8;
        
        // Calculate dynamic width based on the shift range
        const totalWidth = (this.totalSquares * sqSize) + ((this.totalSquares - 1) * gap);
        const startX = (w - totalWidth) / 2;
        const centerY = h / 2 - 40;

        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText(this.instruction, w / 2, centerY - 60);

        // Loop from the lowest shift to the highest shift
        for (let i = this.minShift; i <= this.maxShift; i++) {
            // Offset the X position based on the minimum shift value
            const visualIdx = i - this.minShift;
            const x = startX + visualIdx * (sqSize + gap);
            
            const isAnchor = (i === 0);
            const isTarget = (i === this.currentShift);

            // Square Styling
            ctx.strokeStyle = isTarget ? "#FFD700" : "#444";
            ctx.lineWidth = isTarget ? 3 : 1;
            KeyboardHelper.roundRect(ctx, x, centerY, sqSize, sqSize, 6, false, true);

            // Square Label (Reference from our Dictionary)
            ctx.fillStyle = "#666";
            ctx.font = "10px sans-serif";
            const topLabel = this.shiftLabels[i] || "";
            ctx.fillText(topLabel, x + sqSize/2, centerY - 10);

            // Content Logic
            ctx.font = "bold 18px sans-serif";
            if (isAnchor) {
                ctx.fillStyle = "white";
                ctx.fillText(this.anchorNote, x + sqSize/2, centerY + sqSize/2 + 7);
            } else if (isTarget && !this.userAttempt) {
                ctx.fillStyle = "rgba(255, 215, 0, 0.4)";
                ctx.fillText("?", x + sqSize/2, centerY + sqSize/2 + 7);
            }

            // Visual feedback of your tap
            if (this.userAttempt && this.userAttempt.relPos === i) {
                ctx.fillStyle = this.userAttempt.isCorrect ? "#4CAF50" : "#FF5252";
                ctx.fillText(this.userAttempt.note, x + sqSize/2, centerY + sqSize/2 + 7);
            }
        }

        KeyboardHelper.draw(engine, this.buttons);
    }
};

const KeyboardVariant = {
    label: "What's that note?",
    statKey: "K",
    countdown: 0,
    init(engine) {
        KeyboardHelper.initButtons(engine, this);
        engine.gameActive = true;
        engine.livesLeft=3;
        this.newChallenge(engine);
    },

    newChallenge(engine){
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
        engine.score=100;
        engine.mistakes=0;
        engine.history = [];
        engine.tappedKeys.clear();
        this.lastPenaltyTime=0;
        this.startTime = Date.now();
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
            stayOnChallenge: true
        });
        if (isCorrect){
            if (engine.score>=178 && engine.livesLeft<3) {
                engine.incrementLives(1);
                engine.addLabel("❤",
                        { duration: .75, size:25, x:coords.x, y:coords.y,
                          speed:210, acceleration : 90, direction: -15
                        });
            }
            this.newChallenge(engine);
        }else if (engine.incrementLives(-1)===0 ){
            engine.gameOver();            
        }
        
    },
    
    render(engine) {
        KeyboardHelper.draw(engine, this.buttons);
        const delay = Date.now() - Math.max(this.startTime,this.lastPenaltyTime);
        if (!engine.gameActive) return;
        if (delay>5000){
            if (engine.incrementLives(-1)===0)
                engine.gameOver();// no life left game over
            else{
                this.lastPenaltyTime=Date.now();
            }
        }

        const coords = engine.getFretCoordinates(this.targetString, this.targetFret);
        engine.drawNode(coords.x, coords.y, "?", "gold", 12, 1);

    }
};

const CHORD_FORMULAS = [
    { label: "Major Chord", short: "Maj", formula: ["1", "3", "5"], semitones: [0, 4, 7] },
    { label: "Minor Chord", short: "m", formula: ["1", "b3", "5"], semitones: [0, 3, 7] },
    { label: "Dominant 7th", short: "7", formula: ["1", "3", "5", "b7"], semitones: [0, 4, 7, 10] },
    { label: "Major 7th", short: "Maj7", formula: ["1", "3", "5", "7"], semitones: [0, 4, 7, 11] },
    { label: "Minor 7th", short: "m7", formula: ["1", "b3", "5", "b7"], semitones: [0, 3, 7, 10] },
    { label: "Sus4 Chord", short: "sus4", formula: ["1", "4", "5"], semitones: [0, 5, 7] },
    { label: "Sus2 Chord", short: "sus2", formula: ["1", "2", "5"], semitones: [0, 2, 7] },
    { label: "Major 6th", short: "6", formula: ["1", "3", "5", "6"], semitones: [0, 4, 7, 9] },
    { label: "Minor 6th", short: "m6", formula: ["1", "b3", "5", "6"], semitones: [0, 3, 7, 9] },
    { label: "9th ", short: "9", formula: ["1", "3", "5", "b7", "9"], semitones: [0, 4, 7, 10, 14] }, 
    { label: "11th ", short: "11", formula: ["1", "3", "5", "b7", "9", "11"], semitones: [0, 4, 7, 10, 14, 17] }, 
    { label: "Add9 (Maj 9th)", short: "add9", formula: ["1", "3", "5", "9"], semitones: [0, 4, 7, 14] }, 
    { label: "Diminished", short: "dim", formula: ["1", "b3", "b5"], semitones: [0, 3, 6] },
    { label: "Augmented", short: "aug", formula: ["1", "3", "#5"], semitones: [0, 4, 8] },
    
    // EXTENSIONS (DOMINANT)
    { label: "13th (Dom 13)", short: "13", formula: ["1", "3", "5", "b7", "9", "13"], semitones: [0, 4, 7, 10, 14, 21] },
    { label: "7b9 (Dom 7 Flat 9)", short: "7b9", formula: ["1", "3", "5", "b7", "b9"], semitones: [0, 4, 7, 10, 13] },
    { label: "7#11 (Lydian Dominant)", short: "7#11", formula: ["1", "3", "5", "b7", "#11"], semitones: [0, 4, 7, 10, 18] },

    // ROCK & POP FAVORITES
    { label: "5 (Power Chord)", short: "5", formula: ["1", "5"], semitones: [0, 7] },
    { label: "6/9 (Major 6/9)", short: "6/9", formula: ["1", "3", "5", "6", "9"], semitones: [0, 4, 7, 9, 14] },
    { label: "7sus4 (Dominant 7th Sus 4)", short: "7sus4", formula: ["1", "4", "5", "b7"], semitones: [0, 5, 7, 10] },
    // JAZZ ESSENTIALS
    { label: "m7b5 (Half-Diminished, o7)", short: "m7b5", formula: ["1", "b3", "b5", "b7"], semitones: [0, 3, 6, 10] },
    { label: "dim7 (Fully Diminished, o7)", short: "dim7", formula: ["1", "b3", "b5", "bb7"], semitones: [0, 3, 6, 9] },
    { label: "m(maj7) (Minor-Major 7th)", short: "mMaj7", formula: ["1", "b3", "5", "7"], semitones: [0, 3, 7, 11] },
    { label: "m9 (Minor 9th)",  short: "m7(9)",   formula: ["1", "b3", "5", "b7", "9"],   semitones: [0, 3, 7, 10, 14] },
    { label: "m(maj9) (Minor-Major 9th)", short: "m7+(9)",  formula: ["1", "b3", "5", "7", "9"],  semitones: [0, 3, 7, 11, 14] },
    { label: "+9 (aug 9th) 7 sharp 9", short: "7+(9)", formula: ["1", "3", "5", "b7", "#9"], semitones: [0, 4, 7, 10, 15] }, 
    { label: "7+ (aug 7th)", short: "7+", formula: ["1", "3", "#5", "b7"], semitones: [0, 4, 8, 10] }, 
    { label: "Chromatic Union", short: "Union",  formula: ["1", "2", "b3", "3", "4", "b5", "5", "#5", "6", "bb7", "b7", "7", "b9", "9", "#9", "#11", "11", "13"], 
    semitones: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 21] },
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
    init(engine) {
        this.buttons = [];
        this.btnOptMode = KeyboardHelper.addOptionKey(engine, this, 6, "1|A");
        KeyboardHelper.initButtons(engine, this, 101);
        KeyboardHelper.initDynamicMasterPalette(engine, this,202);
        const objects = KeyboardHelper.addFunctionKeys(engine, this, false);
        objects.btnClear.hidden = true;
        this.initGame(engine);

    },
    
    hints(engine){
        this.showHints = ! this.showHints;
    },
    
    initGame(engine) {
        this.mode = this.btnOptMode.toggleState ? 1 : 0;
        if (this.mode === 1) {
            KeyboardHelper.showButtons(this,202);
            KeyboardHelper.hideButtons(this,101);
        } else {
            KeyboardHelper.hideButtons(this,202);
            KeyboardHelper.showButtons(this,101);
        }
            
        this.rootIdx = Math.floor(Math.random() * 12);
        this.rootNote = NOTES[this.rootIdx];

        const type = CHORD_FORMULAS[Math.floor(Math.random() * CHORD_FORMULAS.length)];
        this.chordLabel = type.label;
        this.formula = type.formula;
        this.semitones = type.semitones;

        this.targetIdx = Math.floor(Math.random() * (this.formula.length - 1)) + 1;
        this.targetInterval = this.formula[this.targetIdx];
        this.targetNoteName = NOTES[(this.rootIdx + this.semitones[this.targetIdx]) % 12];

        const prompt = this.btnOptMode.toggleState ?
            `What is the role of ${this.targetNoteName}?` :
            `Find the missing note`;
        engine.addLabel(prompt, { duration: -1, y: 80 });
        this.showHints = false;
        this.userAttempt = null;
        this.startTime = Date.now();
    },

    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);
        if (!btn) return;
        if (btn === this.btnOptMode) {
            setTimeout(() => this.initGame(engine), 100);
            return;
        }

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
            visualX: x, visualY: y, noteName: btn.note, distance: 0,
            stayOnChallenge: true
        });

        engine.addLabel(isCorrect ? "Correct!" : "Try again", { 
            color: isCorrect ? "green" : "red", 
            duration: 1 
        });
        if (isCorrect) {
            setTimeout(() => this.initGame(engine), 500);
            return;
        }

    },

    render(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const uiprop = engine.uiprop;
        const sqSize = uiprop.scale*55, gap = uiprop.scale*10;
        const totalW = (this.formula.length * sqSize) + ((this.formula.length - 1) * gap);
        const startX = (w - totalW) / 2;
        const centerY = h * 1/3;

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
                if (this.showHints){
                    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.font = "14px sans-serif";
                    ctx.fillText(interval, x + sqSize/2, centerY + 20);
                    ctx.fillStyle = "white";
                    ctx.font = "bold 18px sans-serif";
                    ctx.fillText(noteAtSlot, x + sqSize/2, centerY + 42);
                }
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

        KeyboardHelper.draw(engine, this.buttons);
    }
};


const SectionVariant = {
    sectionSeq: 0,
    range: null,
    statKey: "Se",
    sections: [[1,4], [5, 8], [8, 12],[1,6],[6,9]],
    init(engine) {
        this.buttons=[];
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const scale = engine.uiprop.scale;
        const btnw = scale * 75;
        const btnh = scale * 33;
        KeyboardHelper.addFunctionButton(engine, this, "Section", w-btnw-5, h-btnh-10, "#682",
                                         () => this.incrementSection(engine,1),null,btnw, btnh);


        this.btnOptRandom = KeyboardHelper.addOptionKey(engine, this, 6, "🎲");
        this.incrementSection(engine, 0);
    },
    
    incrementSection(engine, inc = 1, reset = true) {
        this.btnOptRandom.toggleState = false; // now we are not doing random mode anymore
        this.sectionSeq+=inc;
        if (this.sectionSeq<0) this.sectionSeq=this.sections.length-1;
        if (this.sectionSeq>this.sections.length-1) this.sectionSeq=0
        if (reset) this.initGame(engine);
    },
    initGame(engine){
        if (this.btnOptRandom.toggleState) { // select random section
            this.sectionSeq = Math.floor(Math.random() * this.sections.length);
        }
        this.range = this.sections[this.sectionSeq];
        const candidates = engine.getWorstCombos(5, this.targetNote, this.sectionSeq);
        const selection = candidates[Math.floor(Math.random() * candidates.length)];
        this.targetNote = selection.note;

        this.foundCount = 0;
        this.needed = this.calculateNeeded();
        this.startTime = Date.now();
        this.tapTime = Date.now();
        this.cumulScore = 0;
        engine.score = 100;
        engine.mistakes = 0;
        engine.tappedKeys.clear();
        engine.history = []; // Clears the colored dots on the fretboard
        this.label = `FIND ALL ${this.needed} \"${this.targetNote}\" IN FRET ${this.range[0]} TO ${this.range[1]} `;
        engine.gameActive = true;  
    },
    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);  
        if (f < this.range[0] || f > this.range[1]) return;
        const coords = engine.getFretCoordinates(s, f);

        const isCorrect = (name === this.targetNote);

        engine.processResult(isCorrect, {
            visualX: coords.x, 
            visualY: coords.y, 
            sIdx: this.sectionSeq, // Section Id used instead of string number in this game stats 
            noteName: name,
            stayOnChallenge: true
        });

        if (isCorrect) {
            this.foundCount++;
            if (this.foundCount >= this.needed) {
                if (engine.mistakes === 0) {
                    //engine.triggerPerfect("PERFECT! +25");
                    engine.score += 25;
                }
            }
            this.cumulScore += engine.score;
            engine.score = Math.round(this.cumulScore / this.needed);
            if (this.foundCount >= this.needed) {
                engine.gameActive = false;
                setTimeout(() => this.initGame(engine), 1000);
            }

        }
    },

    render(engine) {
        const ctx = engine.ctx;
        const rangeKey = `${this.range[0]}-${this.range[1]}`;
        const {  firstStringX, spacingX, offsetX , activeW} = engine.getFretboardLayout();
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(offsetX, engine.fretPositions[this.range[0]-1], activeW, engine.fretPositions[this.range[1]] - engine.fretPositions[this.range[0]-1]);
        engine.drawNode(engine.canvas.width / 2, engine.canvas.height / 2, 
                        this.targetNote,
                        "rgba(149, 59, 159, 0.3)",
                        92,
                        0.3);
        KeyboardHelper.draw(engine, this.buttons);
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
    init(engine) {
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const uiprop = engine.uiprop;
        const scale = uiprop.scale;
        const pad = uiprop.sidePadding;
        restoreVariantState(this);
        this.showHints = false;
        this.buttons=[];
        const objects = KeyboardHelper.addFunctionKeys(engine,this, arrows=false);
        this.lastBtn=KeyboardHelper.initChordSelectorPalette(engine, this);
        this.lastBtn.isSelected=true;
        this.labeltext=CHORD_FORMULAS[this.lastBtn.chordIdx].short;
        let pos = engine.getFretCoordinates(0,3);
        this.playBtn = KeyboardHelper.addFunctionButton(engine, this, "🔊", pad, pos.y,
                                                             "#484",
                                                              () => this.playChord(engine)
                                                              , null,scale*30,scale*25,18);

        this.setChord(engine,this.chordIdx);
        this.initGame(engine);
    },

    hints(engine){
        this.showHints = ! this.showHints;
    },

    initGame(engine, root=true) {
        
        if (root) {
            this.rootIdx=0;
            this.rootNote = null;
            this.rootPitch = null;        // To store the first note's absolute "height"
            this.firstNotedata=null;
        }

        this.completed = false;
        this.usedStrings = new Set(); // Track string indices

        this.skipSavingTaps = true; // allow multiple taps on the same note
        this.skipHeatMap=true;
        this.foundNotes = new Array(this.formula.length).fill(null);
        this.usedStrings.clear();
        this.completed = false;

        engine.history=[];
        engine.tappedKeys.clear();
        this.startTime = Date.now();
        engine.score = 0;

    },

    playChord(engine){
        if (!engine.audioUnlocked) {
            engine.audio.resume(); // Unlocks audio on first click
            engine.audioUnlocked = true;
        }
        engine.playChord();// plays all notes on history (which are the chord notes in this game) together as a chord sound
    },

    setChord(engine,chordIdx){
        this.chordIdx = chordIdx;
        const type = CHORD_FORMULAS[this.chordIdx];
        this.chordLabel = type.short;
        this.formula = type.formula;
        this.semitones = type.semitones;
        this.semitones=this.semitones.map(s => s % 12); // to normalize somitones that are > 12 
        this.foundNotes = new Array(this.formula.length).fill(null);
        if (this.firstNotedata){ // if avaiable from previous game
            const {sIdx,f,name,x,y,tappedIdx} = this.firstNotedata;
            this.setRoot(engine, name, tappedIdx);
            const tapped = engine.tappedNoteSet(); 
            // remove all invalid notes (for the new chord) and mark the valide ones as found
            tapped.forEach((tappedIdx, i) => {
                    const tappedSemitone = (tappedIdx - this.rootIdx + 12) % 12;
                    const slotIdx = this.semitones.indexOf(tappedSemitone);
                    if (slotIdx === -1) { // not part of the chord
                        engine.removeHistoryItems(null,tappedIdx); // remove all existing notes with this noteIdx
                    }else{
                        this.foundNotes[slotIdx]=tappedIdx;
                    }
                });
                
        }
    },

    setRoot(engine, name, tappedIdx) {
        this.chordSpelling = engine.getChordSpelling(name, this.semitones, this.formula);
        const normName= this.chordSpelling[0];
        this.labeltext = `${normName || "?"}${this.chordLabel || "?"}`;
        this.rootNote = name;
        this.rootIdx = tappedIdx;        
        return normName;
    },
    
    onTap(engine, sIdx, f, name, x, y) {

        const btn = KeyboardHelper.checkClick(this.buttons, x, y); 
        if (btn) {
            if (btn.id === 203){
                if (this.lastBtn) this.lastBtn.isSelected = false;
                btn.isSelected = true;
                this.lastBtn = btn;
                this.setChord(engine, btn.chordIdx);
            }
            if (this.rootNote){
                this.chordSpelling = engine.getChordSpelling(this.rootNote, this.semitones, this.formula);
                this.labeltext = `${this.chordSpelling[0] || "?"}${this.chordLabel || "?"}`;
            }
            return;
        }

        if (!name) return;
        const tappedIdx = NOTES.indexOf(name);
        if (this.rootNote==null) {
            this.firstNotedata={sIdx,f,name,x,y, tappedIdx};
            name=this.setRoot(engine, name, tappedIdx);
        }

        const currentPitch = StringBasePitches[sIdx] + f;
        const tappedSemitone = (tappedIdx - this.rootIdx + 12) % 12;
        const slotIdx = this.semitones.indexOf(tappedSemitone);

        // Is this note part of our chord?
        if (slotIdx !== -1) {

            const notesIdxOnString = engine.tappedNoteSet(sIdx)     
            engine.removeHistoryItems( sIdx); // remove all existing notes on this string

            if (! notesIdxOnString.has(tappedIdx)) { // another correct note was tapped on this string
                
                // Sophisticated Rule: Root first, but allow lower roots
                if (slotIdx === 0) {
                    // If this is the FIRST root found, set the reference floor
                    if (this.rootPitch === null) {
                        this.rootPitch = currentPitch;
                    } else if (currentPitch < this.rootPitch) {
                        // If this root is lower than our previous root, update the floor
                        this.rootPitch = currentPitch;
                        engine.addLabel("New lower root set!", {color: "cyan", size: 12});
                    }
                } 
                engine.processResult(true, {
                    visualX: x, visualY: y, noteName: name, noteIdx: tappedIdx, sIdx: sIdx, fret: f,
                    color: engine.getIntervalColor(this.semitones[slotIdx]),
                    stayOnChallenge: true 
                });
                this.foundNotes[slotIdx] = tappedIdx;
            }

            const tappedNotesIdx = engine.tappedNoteSet(); 
            this.foundNotes = this.foundNotes.map(noteIdx => 
                (tappedNotesIdx.has(noteIdx)) ? noteIdx : null
            );
            
            const isChordComplete = this.foundNotes.every(n => n !== null);          
            engine.addLabel(isChordComplete ? "Chord Complete!" : "Keep building...", { duration: -1 });
            
        } else {
            // WRONG NOTE
            engine.processResult(false, {
                visualX: x, visualY: y, noteName: name, noteIdx: tappedIdx, sIdx: sIdx, fret: f,
                color: "red", stayOnChallenge: true, skipHistory: true
            });
        }
    },

    
    preRender(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        KeyboardHelper.draw(engine, this.buttons);

        let pos =engine.getFretCoordinates(0,12);
        ctx.fillStyle = "#ddd";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(this.labeltext, pos.x , pos.y + 35*engine.uiprop.scale);

        if (!this.formula) return; // Wait until formula is set
        pos =engine.getFretCoordinates(1,12);

        this.formula.forEach((interval, i) => {
            let x = pos.x + (i * 30);
            const foundNoteIdx = this.foundNotes[i];
            if (this.showHints){
                ctx.fillStyle = "#aaa";
                ctx.font = "14px sans-serif";
                if (interval.length>1) x=x+5; // nudge the longer intervals for better centering
                ctx.fillText(interval, x , pos.y + 50*engine.uiprop.scale);

            }
            // If note found, draw it with its ROYGBIV color
            if (foundNoteIdx !== null) {
                x = pos.x + (i * 30);
                ctx.fillStyle = engine.getIntervalColor(this.semitones[i]);
                ctx.font = "bold 20px sans-serif";
                const noteName = i===0 ? this.rootNote : NOTES[foundNoteIdx];
                if (noteName.length>1) x=x+10; 
                ctx.fillText(noteName, x , pos.y+35*engine.uiprop.scale);
            }
        });
        if (this.showHints && this.rootNote){
            engine.drawChordMap(this.rootNote, this.semitones, this.formula, {})
        }
    }
};

const LINE2_f=0.96; // used to compute y of line2 label in percentage of total cancas height

const IntervalSearchVariant = {
    label:"",
    statKey: "IS1",
    init(engine) {
        this.labels = ["2", "b3", "3", "4", "b5", "5", "#5", "6", "b7", "7", "9", "#9", "11", "#11",  "13"];
        this.st =     [  2,    3,   4,   5,    6,   7,    8,   9,   10,  11,  14,   15,   17,    18,   21 ];
        this.buttons=[];
        KeyboardHelper.initChordSelectorPalette(engine, this);
        this.rootNoteLabel = null;
        this.chordLabel = null;
        this.semitones = null;
        this.formula = null;
        this.lastBtn=null
        this.rootPos={x:0,y:0};
        restoreVariantState(this);
        this.initGame(engine);
    },

    initGame(engine){
        const h = engine.canvas.height;
        const w = engine.canvas.width;

        this.startTime = Date.now();
        this.showHints=false;

        engine.history=[];
        engine.score = 0;
        this.chordNotesPos= engine.getFretCoordinates(2, 12);
        const pos = engine.getFretCoordinates(0, 12);

        this.engLabel=engine.addLabel(`Select root and chord type`,
                        { color:"#666", duration: -1, size:20, x:pos.x, y:pos.y+40});

    },

    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);
        if (btn) {
            if (btn.id === 203){
                if (this.lastBtn) this.lastBtn.isSelected = false;
                this.chordLabel = btn.note;
                this.semitones = btn.semitones;
                this.formula = btn.formula;
                btn.isSelected = true;
                this.lastBtn = btn;
            }
            this.chordSpelling = engine.getChordSpelling(this.rootNote, this.semitones, this.formula);
            this.engLabel.text = `${this.chordSpelling[0] || "?"}${this.chordLabel || "?"}`;
            return;
        }
        if (!name) return;
        engine.tappedKeys.clear();
        this.rootPos.x=x;
        this.rootPos.y=y;
        this.rootNote = name;
        this.rootIdx = NOTES.indexOf(name);
        this.fret = f;
        this.string = s
        let noteName = name;
        if (this.semitones) {
            this.chordSpelling = engine.getChordSpelling(this.rootNote, this.semitones, this.formula);
            this.engLabel.text = `${this.chordSpelling[0] || "?"}${this.chordLabel || "?"}`;
            noteName= this.chordSpelling[0];
        }
        engine.processResult(true, { visualX: x, visualY: y, noteName: noteName,
                                         stayOnChallenge: true, skipHistory: true, skipScore:true});
    },

    render(engine) {
        KeyboardHelper.draw(engine, this.buttons);
        if (!this.rootNote && !this.semitones) return; // Wait until root note and semitones are set
        if (this.rootNote && !this.semitones){
            engine.drawNode(this.rootPos.x, this.rootPos.y, this.rootNote, engine.getIntervalColor(0), 12, 1);    
            return;
        }
        engine.drawChordMap(this.rootNote, this.semitones, this.formula,
                             {drawNoteNames:false, 
                                focus: {string: this.string, fret: this.fret},
                                drawNoteNames: true , drawFormula : true,
                                fntSize: 18
                             });
        engine.drawNode(this.rootPos.x, this.rootPos.y, this.chordSpelling[0], engine.getIntervalColor(0), 12, 1);
        this.formula.forEach((interval, i) => {
            const x = 30;
            const ctx =engine.ctx;
            const semitoneOffset = this.semitones[i];
            ctx.fillStyle = engine.getIntervalColor(semitoneOffset);
            ctx.font = "bold 18px sans-serif";
            ctx.fillText(this.chordSpelling[i], this.chordNotesPos.x + (x * i), this.chordNotesPos.y+40);
            ctx.fillStyle = "#666";
            ctx.fillText(this.formula[i], this.chordNotesPos.x + (x * i), this.chordNotesPos.y+60);
        }); 
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
        const pitch = StringBasePitches[this.currentString] + this.currentFret;
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