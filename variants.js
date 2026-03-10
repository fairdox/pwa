const ExtremeAccidentalVariant = {
    label: "EXTREME DRILL",
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
    label: "KEYBOARD MODE",
    init(engine) {
        // ... selection logic remains same ...
        KeyboardHelper.initButtons(engine, this);
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
            sIdx: this.targetString, noteName: btn.note, distance: 0
        });
    },
    render(engine) {
        const coords = engine.getFretCoordinates(this.targetString, this.targetFret);
        engine.drawNode(coords.x, coords.y, "X", "gold", 12, 1);
        KeyboardHelper.draw(engine.ctx, this.buttons);
    }
};

const CHORD_FORMULAS = [
    { label: "Major Chord", formula: ["1", "3", "5"], semitones: [0, 4, 7] },
    { label: "Minor Chord", formula: ["1", "b3", "5"], semitones: [0, 3, 7] },
    { label: "Dominant 7th", formula: ["1", "3", "5", "b7"], semitones: [0, 4, 7, 10] },
    { label: "Major 7th", formula: ["1", "3", "5", "7"], semitones: [0, 4, 7, 11] },
    { label: "Sus4 Chord", formula: ["1", "4", "5"], semitones: [0, 5, 7] }
];
const IntervalVariant = {
    label: "CHORD BUILDER",
    init(engine) {
        KeyboardHelper.initButtons(engine, this);
        
        // 1. Pick a random Root and Chord Type
        this.rootIdx = Math.floor(Math.random() * 12);
        this.rootNote = NOTES[this.rootIdx];
        
        const type = CHORD_FORMULAS[Math.floor(Math.random() * CHORD_FORMULAS.length)];
        this.chordLabel = type.label;
        this.formula = type.formula;     // ["1", "3", "5"]
        this.semitones = type.semitones; // [0, 4, 7]
        
        // 2. Pick the 'Question' (anything except the Root)
        this.targetIdx = Math.floor(Math.random() * (this.formula.length - 1)) + 1;
        this.targetNote = NOTES[(this.rootIdx + this.semitones[this.targetIdx]) % 12];
        this.label =   this.targetNote ;

        this.userAttempt = null;
        this.startTime = Date.now();
    },

    onTap(engine, s, f, name, x, y) {

        const btn = KeyboardHelper.checkClick(this.buttons, x, y);
        if (!btn) {
            //this.label="no button";
            return;
        }
        //this.label=`${x} ${y} ${btn.note}`;

        const isCorrect = btn.note === this.targetNote;
        const tappedSemitones = (NOTES.indexOf(btn.note) - this.rootIdx + 12) % 12;
        
        // Find if the tapped note belongs to ANY slot in the current chord formula
        const slotIdx = this.semitones.indexOf(tappedSemitones);

        this.userAttempt = { 
            note: btn.note, 
            isCorrect: isCorrect,
            slotIdx: slotIdx // -1 if not in the chord
        };
        //alert(btn.note);

        engine.processResult(isCorrect, {
            visualX: x, visualY: y, noteName: btn.note, distance: 0
        });
    },

    render(engine) {
        const ctx = engine.ctx;
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const sqSize = 50, gap = 10;
        const totalW = (this.formula.length * sqSize) + ((this.formula.length - 1) * gap);
        const startX = (w - totalW) / 2;
        const centerY = h / 2 - 40;

        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(`${this.chordLabel}: ${this.rootNote}`, w / 2, centerY - 50);

        // Draw the squares based on the chord formula (e.g., 3 squares for Major)
        this.formula.forEach((interval, i) => {
            const x = startX + i * (sqSize + gap);
            const isTarget = (i === this.targetIdx);
            const noteAtSlot = NOTES[(this.rootIdx + this.semitones[i]) % 12];

            // 1. Draw Square
            ctx.strokeStyle = isTarget ? "gold" : "#444";
            ctx.lineWidth = isTarget ? 3 : 1;
            KeyboardHelper.roundRect(ctx, x, centerY, sqSize, sqSize, 8, false, true);

            // 2. Draw Interval Hint (1, 3, 5, etc.)
            ctx.fillStyle = "#888";
            ctx.font = "12px sans-serif";
            ctx.fillText(interval, x + sqSize/2, centerY - 10);

            // 3. Logic for what note to display in the square
            if (i === 0) {
                // Root is always visible
                ctx.fillStyle = "white";
                ctx.fillText(noteAtSlot, x + sqSize/2, centerY + sqSize/2 + 6);
            } else if (this.userAttempt && this.userAttempt.isCorrect && isTarget) {
                // Correct answer turns green
                ctx.fillStyle = "#4CAF50";
                ctx.font = "bold 18px sans-serif";
                ctx.fillText(noteAtSlot, x + sqSize/2, centerY + sqSize/2 + 6);
            } else if (this.userAttempt && !this.userAttempt.isCorrect && this.userAttempt.slotIdx === i) {
                // If you tapped the WRONG chord member (e.g., tapped the 5th instead of 3rd)
                ctx.fillStyle = "#FF5252";
                ctx.font = "bold 18px sans-serif";
                ctx.fillText(noteAtSlot, x + sqSize/2, centerY + sqSize/2 + 6);
            } else {
                // Placeholder/Hint: Show chord members in faint grey
                ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
                ctx.font = "16px sans-serif";
                ctx.fillText(isTarget ? "?" : noteAtSlot, x + sqSize/2, centerY + sqSize/2 + 6);
            }
        });

        // 4. Handle "Completely Off" notes (not in the chord at all)
        if (this.userAttempt && !this.userAttempt.isCorrect && this.userAttempt.slotIdx === -1) {
            ctx.fillStyle = "#FF5252";
            ctx.font = "bold 18px sans-serif";
            ctx.fillText(`No! ${this.userAttempt.note} is not in this chord.`, w / 2, centerY + sqSize + 40);
        }

        KeyboardHelper.draw(ctx, this.buttons);
    }
};

const KeyboardHelper = {
    // Generate the two-row layout you provided
    initButtons(engine, variant) {
        variant.buttons = [];
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const bw = 48, bh = 48, gap = 8;
        
        const rows = [
            ["A#", "C#", "D#", "F#", "G#"], 
            ["A", "B", "C", "D", "E", "F", "G"]
        ];

        rows.forEach((row, rowIndex) => {
            const rowWidth = (row.length * bw) + ((row.length - 1) * gap);
            let startX = (w - rowWidth) / 2;
            // Positioning rows at the bottom
            let startY = h - 180 + (rowIndex * (bh + gap));

            row.forEach(note => {
                variant.buttons.push({ 
                    x: startX, y: startY, w: bw, h: bh, note: note,
                    color: rowIndex === 0 ? "#333" : "#eee" 
                });
                startX += bw + gap;
            });
        });
    },

    // Hit detection for any variant using this helper
    checkClick(buttons, x, y) {
        //alert(`${x} ${y}`);
        return buttons.find(b => x >= b.x && x <= (b.x + b.w) && y >= b.y && y <= (b.y + b.h));
    },

    // Standard rendering loop
    draw(ctx, buttons) {
        buttons.forEach(btn => {
            ctx.fillStyle = btn.color;
            ctx.strokeStyle = "#999";
            this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8, true, true);
            
            ctx.fillStyle = btn.color === "#333" ? "white" : "black";
            ctx.font = "bold 16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(btn.note, btn.x + btn.w/2, btn.y + btn.h/2 + 6);
        });
    },

    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
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
    }
};

const ClassicVariant = {
    label: "SEQUENCE",
    init(engine) { this.target = null; this.count = 0; },
    onTap(engine, s, f, name, x, y) {
        this.count++;
        let color = "#4CAF50";
        if (this.count === 1) {
            this.target = name; color = "white";
            this.label = `FIND ALL ${this.target}`;
        } else {
            if (name === this.target) engine.score += 10;
            else { engine.score -= 5; color = "#FF5252"; }
        }
        engine.history.push({x, y, name, color});
        engine.animate(x, y, name, color);
        if (this.count >= 6) { engine.gameActive = false; engine.reset(); }
    }
};

const SectionVariant = {
    sectionSeq: 0,
    range: null,
    init(engine) {
        const sections = [[1,12],[1, 4], [5, 8], [9, 12],[1,7],[5,12]];
        if (!this.range) {
            this.range = sections[this.sectionSeq];
            this.sectionSeq = (this.sectionSeq + 1) % sections.length;
        }
        this.targetNote = this.getWeightedRandomNote(engine, this.targetNote);
        this.foundCount = 0;
        this.needed = this.calculateNeeded();
        this.startTime = Date.now();
        this.tapTime = Date.now();
        engine.score = 0;
        engine.mistakes=0;
        this.label = `FIND ${this.targetNote} (FRET ${this.range[0]}-${this.range[1]})`;
        //engine.animate(engine.canvas.width / 2,  engine.getSectionCenterY(this.range[0], this.range[1]), 
        //this.targetNote, "rgba(150,150,150,0.5)");
           
    },

    getWeightedRandomNote(engine, exclude) {
        const rangeKey = `${this.range[0]}-${this.range[1]}`;
        let notes = NOTES.filter(n => n !== exclude).map(n => ({
            name: n, score: engine.stats[`${rangeKey}-${n}`] ?? -1
        })).sort((a, b) => a.score - b.score);
        return notes.slice(0, 5)[Math.floor(Math.random() * Math.min(5, notes.length))].name;
    },

    onTap(engine, s, f, name, x, y) {
        if (f < this.range[0] || f > this.range[1]) return;
        this.tapTime = Date.now();
        let color = (name === this.targetNote) ? "#4CAF50" : "#FF5252";
        if (name === this.targetNote) {
            this.foundCount++;
            engine.score += (100 / this.needed);
        } else {
            engine.score -= 10;
            engine.mistakes++; 
        }
        
        engine.history.push({ x, y, name, color });
        engine.animate(x, y, name, color);

        if (this.foundCount >= this.needed) {
            engine.gameActive = false;
            
            if (engine.mistakes === 0) {
               engine.triggerPerfect("PERFECT!");
                
            }
            const bonus = Math.max(0, 100 - ((Date.now() - this.startTime)/200));
            const final = Math.round(engine.score + bonus);
            const key = `${this.range[0]}-${this.range[1]}-${this.targetNote}`;
            engine.stats[key] = engine.stats[key] === undefined ? final : Math.round((final + engine.stats[key])/2);
            localStorage.setItem('fretStats', JSON.stringify(engine.stats));
            setTimeout(() => engine.reset(true), 1000);
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
        
        if (engine.showDebug) {
            ctx.textAlign = "right"; ctx.font = "14px monospace";
            const sorted = NOTES.map(n => ({
                name: n, score: engine.stats[`${rangeKey}-${n}`] ?? -1
            })).sort((a, b) => a.score - b.score);
            sorted.forEach((obj, i) => {
                ctx.fillStyle = (obj.name === this.targetNote) ? "#4CAF50" : "#666";
                ctx.fillText(`${obj.name}: ${obj.score === -1 ? "--" : obj.score}`, w - 10, 60 + (i * 18));
            });
        }
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
        const spacingX = (w - engine.marginX * 2) / 5;
        const xPos = engine.marginX + (this.targetString * spacingX);
        
        // String Highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(xPos - 10, engine.fretPositions[0], 20, engine.fretPositions[12] - engine.fretPositions[0]);
        
        // Target Prompt
        engine.drawNode(w / 2, engine.canvas.height / 2, this.targetNote, "rgba(129, 79, 189, 0.3)", 92, 0.3);

    }

};