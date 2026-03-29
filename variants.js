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
        scaleIdx: variant.scaleIdx,
        targetIdx: variant.targetIdx, // This covers stIdx or whatever 'target' you use
        startFret: variant.startFret  // Added this since you're practicing Box 5!
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(master));
}

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
    if (saved.scaleIdx !== undefined) variant.scaleIdx = saved.scaleIdx;  
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
            visualX: x, visualY: y, noteName: btn.note, distance: 0
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

        KeyboardHelper.draw(ctx, this.buttons);
    }
};

const KeyboardVariant = {
    label: "What's that note?",
    statKey: "K",
    countdown: 0,
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
    { label: "9th ", formula: ["1", "3", "5", "b7", "9"], semitones: [0, 4, 7, 10, 14] }, 
    { label: "Add9 (Maj 9th)", formula: ["1", "3", "5", "9"], semitones: [0, 4, 7, 14] }, 
    { label: "+9 (aug 9th)", formula: ["1", "3", "5", "b7", "#9"], semitones: [0, 4, 7, 10, 15] }, 
    { label: "Diminished", formula: ["1", "b3", "b5"], semitones: [0, 3, 6] },
    { label: "Augmented", formula: ["1", "3", "#5"], semitones: [0, 4, 8] },
    // JAZZ ESSENTIALS
    { label: "m7b5 (Half-Diminished, ø7)", formula: ["1", "b3", "b5", "b7"], semitones: [0, 3, 6, 10] },
    { label: "dim7 (Fully Diminished, °7)", formula: ["1", "b3", "b5", "bb7"], semitones: [0, 3, 6, 9] },
    { label: "m(maj7) (Minor-Major 7th)", formula: ["1", "b3", "5", "7"], semitones: [0, 3, 7, 11] },
    
    // EXTENSIONS (DOMINANT)
    { label: "13th (Dom 13)", formula: ["1", "3", "5", "b7", "9", "13"], semitones: [0, 4, 7, 10, 14, 21] },
    { label: "7b9 (Dom 7 Flat 9)", formula: ["1", "3", "5", "b7", "b9"], semitones: [0, 4, 7, 10, 13] },
    { label: "7#11 (Lydian Dominant)", formula: ["1", "3", "5", "b7", "#11"], semitones: [0, 4, 7, 10, 18] },

    // ROCK & POP FAVORITES
    { label: "5 (Power Chord)", formula: ["1", "5"], semitones: [0, 7] },
    { label: "6/9 (Major 6/9)", formula: ["1", "3", "5", "6", "9"], semitones: [0, 4, 7, 9, 14] },
    { label: "7sus4 (Dominant 7th Sus 4)", formula: ["1", "4", "5", "b7"], semitones: [0, 5, 7, 10] }
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


const SectionVariant = {
    sectionSeq: 0,
    range: null,
    statKey: "Se",
    sections: [[1,12],[1, 4], [5, 8], [9, 12],[1,7],[5,12]],
    init(engine) {
        this.buttons=[];
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const btnw = 75;
        const btnh = 33;
        KeyboardHelper.addFunctionButton(engine, this, "Section", w-btnw-5, h-btnh-10, "#682",
                                         () => this.incrementSection(engine,1),btnw, btnh);

        this.incrementSection(engine,0);
    },
    
    incrementSection(engine,inc=1, reset=true){
        this.sectionSeq+=inc;
        if (this.sectionSeq<0) this.sectionSeq=this.sections.length-1;
        if (this.sectionSeq>this.sections.length-1) this.sectionSeq=0
        this.range = this.sections[this.sectionSeq];
        if (reset) this.initGame(engine);
    },
    initGame(engine){
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
   
    },
    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);  
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
        const rangeKey = `${this.range[0]}-${this.range[1]}`;
        const {  firstStringX, spacingX, offsetX , activeW} = engine.getFretboardLayout();
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(offsetX, engine.fretPositions[this.range[0]-1], activeW, engine.fretPositions[this.range[1]] - engine.fretPositions[this.range[0]-1]);
        engine.drawNode(engine.canvas.width / 2, engine.canvas.height / 2, 
                        this.targetNote,
                        "rgba(149, 59, 159, 0.3)",
                        92,
                        0.3);
        KeyboardHelper.draw(ctx, this.buttons);
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
        const len = NOTES.length;
        this.rootIdx = (this.rootIdx + inc + len) % len;
        this.rootNote = NOTES[this.rootIdx];                
        //this.rootIdx = 5;
        if (reset) this.initGame(engine);
    },

    incrementChord(engine,inc=1, reset=true){
        const len = CHORD_FORMULAS.length;
        this.chordIdx = (this.chordIdx + inc + len) % len;
        const type = CHORD_FORMULAS[this.chordIdx];
        this.chordLabel = type.label;

        this.formula = type.formula;
        this.semitones = type.semitones;
        this.semitones=this.semitones.map(s => s % 12); // to normalize somitones that are > 12 
        
        if (reset) this.initGame(engine);
    },

    initGame(engine){
        this.usedStrings = new Set(); // Track string indices
        
        this.completed = false;
        this.startTime = Date.now();
        this.rootPitch = null;        // To store the first note's absolute "height"

        engine.addLabel("Find the root note", { duration: -1 });
        
        this.skipSavingTaps = true; // allow multiple taps on the same note
        this.skipHeatMap=true;
        this.foundNotes = new Array(this.formula.length).fill(null);
        engine.history=[];
        engine.score = 0;
    },
    
    init(engine) {
        this.rootIdx=0;
        this.chordIdx=0;
        restoreVariantState(this);
        this.showHints = false;
        this.buttons=[];
        KeyboardHelper.addFunctionKeys(engine,this);
        this.incrementRoot(engine,0,false);
        this.incrementChord(engine,0,true);
        engine.addLabel("Use arrows to change chords", {color:"green", size:16, duration:-1});
    },

    onTap(engine, sIdx, f, noteName, x, y) {

        const btn = KeyboardHelper.checkClick(this.buttons, x, y);     
        if (!noteName) return;
           
        const currentPitch = StringBasePitches[sIdx] + f;
                
        const tappedIdx = NOTES.indexOf(noteName);
        const tappedSemitones = (tappedIdx - this.rootIdx + 12) % 12;
        const slotIdx = this.semitones.indexOf(tappedSemitones);

        // Is this note part of our chord?
        if (slotIdx !== -1) {

            const notesOnString = engine.tappedNoteSet(sIdx)     
            engine.removeHistoryItems( sIdx); // remove all existing notes on this string

            if (! notesOnString.has(noteName)) { // another correct note was tapped on this string
                
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
                    visualX: x, visualY: y, noteName: noteName, sIdx: sIdx,
                    color: ROYGBIV[slotIdx],
                    stayOnChallenge: true 
                });
                this.foundNotes[slotIdx] = noteName;
            }

            const tappedNotes = engine.tappedNoteSet(); 
            this.foundNotes = this.foundNotes.map(note => 
                (tappedNotes.has(note)) ? note : null
            );
            
            const isChordComplete = this.foundNotes.every(n => n !== null);          
            engine.addLabel(isChordComplete ? "Chord Complete!" : "Keep building...", { duration: -1 });
 
            
        } else {
            // WRONG NOTE
            engine.processResult(false, {
                visualX: x, visualY: y, noteName: noteName, sIdx: sIdx,
                color: "red", stayOnChallenge: true, skipHistory: true
            });
        }
    },

    
    preRender(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const h = engine.canvas.height;

        const bottom =engine.getFretCoordinates(0,12);
        // 1. Draw Chord Header
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(`${this.rootNote} ${this.chordLabel}`, w / 2, bottom.y+40);

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
                engine.drawChordMap(this.rootNote, this.semitones, this.formula)
            }

            // If note found, draw it with its ROYGBIV color
            if (foundNote) {
                ctx.fillStyle = ROYGBIV[i];
                ctx.font = "bold 20px sans-serif";
                ctx.fillText(foundNote, x + sqSize/2, sqY + sqSize/2 + 7);
            }
        });
        KeyboardHelper.draw(ctx, this.buttons);
    }
};


const IntervalSearchVariant = {
    label:"",
    statKey: "IS1",
    init(engine) {
        this.labels = ["2", "b3", "3", "4", "b5", "5", "#5", "6", "b7", "7", "9", "#9", "11", "#11",  "13"];
        this.st =     [  2,    3,   4,   5,    6,   7,    8,   9,   10,  11,  14,   15,   17,    18,   21 ];
        this.buttons=[];
        KeyboardHelper.addFunctionKeys(engine,this);
        this.targetIdx=0;
        this.rootIdx=0;
        restoreVariantState(this);
        this.initGame(engine);
    },
    incrementRoot(engine,inc=1, reset=true,){
        const len = NOTES.length;
        this.rootIdx = (this.rootIdx + inc + len) % len;
        if (reset) this.initGame(engine);
    },

    incrementChord(engine,inc=1, reset=true){
        const len = this.labels.length;
        this.targetIdx  = (this.targetIdx + inc + len) % len;
        if (reset) this.initGame(engine);
    },

    initGame(engine){
        const h = engine.canvas.height;
        const w = engine.canvas.width;

        this.rootNote = NOTES[this.rootIdx];
        this.targetLabel = this.labels[this.targetIdx];
        this.targetST = this.st[this.targetIdx];

        this.startTime = Date.now();
        this.showHints=false;
        engine.history=[];
        engine.tappedKeys.clear();
        engine.score = 0;
        engine.addLabel(`${this.rootNote} ➔ ${this.targetLabel}`,
                        { color:"#666", duration: -1, size:25, x:w/2, y:h-50});

    },

    hints(engine){
        this.showHints = !this.showHints;
    },

    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);     
        if (!name) return;
        // Calculate the semitone distance from the root
        const tappedPitch = StringBasePitches[s] + f;
        const rootPitchBase = NOTES.indexOf(this.rootNote); 
        
        // Find distance and normalize to the target (handling octaves)
        const rawDist = tappedPitch - rootPitchBase;
        const isCorrect = (rawDist % 12 === this.targetST % 12);

        if (isCorrect) {
            engine.processResult(true, { visualX: x, visualY: y, noteName: name,
                                         stayOnChallenge: true, skipHistory: false});
        } else {
            engine.processResult(false, { visualX: x, visualY: y, noteName: name,
                                          stayOnChallenge: true, skipHistory: true});
        }
    },

    render(engine) {
        engine.drawChordMap(this.rootNote, [0], ["1"]);
        if (this.showHints){
            engine.drawChordMap(this.rootNote, [0,this.targetST], ["1", this.targetLabel]);
        }
        KeyboardHelper.draw(engine.ctx, this.buttons);
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