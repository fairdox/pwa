const SCALES = [
    { label: "Maj Pentatonic", formula: ["1", "2", "3", "5", "6"], st: [0, 2, 4, 7, 9] },
    { label: "Min Pentatonic", formula: ["1", "b3", "4", "5", "b7"], st: [0, 3, 5, 7, 10] },
    { label: "Major Scale", formula: ["1", "2", "3", "4", "5", "6", "7"], st: [0, 2, 4, 5, 7, 9, 11] },
    { label: "Natural Minor", formula: ["1", "2", "b3", "4", "5", "b6", "b7"], st: [0, 2, 3, 5, 7, 8, 10] }
];

const ScalePathVariant = {
    label: "Scale Box Trainer",
    statKey: "SB1",
    
    init(engine) {
        this.buttons=[];
        KeyboardHelper.addFunctionKeys(engine,this);
        this.rootIdx=0;
        this.startFret=5;
        this.showHints=0;
        this.initGame(engine);        
    },
    incrementRoot(engine,inc=1, reset=true,){
        const len = NOTES.length;
        this.rootIdx = (this.rootIdx + inc + len) % len;
        if (reset) this.initGame(engine);
    },

    incrementChord(engine,inc=1, reset=true){
        const len = 10; // starting fret for the box from 0 to 8
        this.startFret = (this.startFret + inc + len) % len;
        if (reset) this.initGame(engine);
    },
    initGame(engine){
        const h = engine.canvas.height;
        const w = engine.canvas.width;
        //const scale = SCALES[Math.floor(Math.random() * SCALES.length)];
        const scale = SCALES[0];

        this.endFret = this.startFret + 3;         
        this.scaleLabel = scale.label;
        this.scaleST = scale.st;
        this.scaleFormula = scale.formula;
        this.rootNote = NOTES[this.rootIdx];
        
        this.foundNotes = [];
        this.totalInBox = this.calculateTotalInBox();
        this.startTime = Date.now();
        this.skipSavingTaps = true; // allow multiple taps on the same note
        this.skipHeatMap=true;
        engine.history=[];
        engine.tappedKeys.clear();
        engine.score = 0;
        engine.highlightFretRange(this.startFret, this.endFret, true);
        engine.addLabel(`${this.rootNote} ${this.scaleLabel} (Frets ${this.startFret}-${this.endFret})`, { 
            y: h-60, color: "gold", duration: -1 ,sizeStart:24.5
        });
    },

    hints(engine){
        this.showHints = ++this.showHints % 3;
    },

    calculateTotalInBox() {
        let count = 0;
        const rootPitchBase = NOTES.indexOf(this.rootNote);

        // s=0 is now index 0 of StringBasePitches (40)
        for (let s = 0; s < 6; s++) {
            for (let f = this.startFret; f <= this.endFret; f++) {
                const currentPitch = StringBasePitches[s] + f;
                const dist = (currentPitch - rootPitchBase + 120) % 12;
                if (this.scaleST.includes(dist)) count++;
            }
        }
        return count;
    },

    onTap(engine, s, f, name, x, y) {
        const btn = KeyboardHelper.checkClick(this.buttons, x, y);     
        if (!name) return;
        if (f < this.startFret || f > this.endFret) {
            engine.addLabel("Stay in the box!", { color: "orange" });
            return;
        }
        const pitch = StringBasePitches[s] + f;
        engine.audio.playNote(pitch);

        const rootPitchBase = NOTES.indexOf(this.rootNote);
        const currentPitch = StringBasePitches[s] + f;
        const dist = (currentPitch - rootPitchBase + 120) % 12;
        const isCorrect = this.scaleST.includes(dist);
        const stay =  this.foundNotes.length !== this.totalInBox;

        if (isCorrect) {
            const noteKey = `${s}-${f}`;
            if (!this.foundNotes.includes(noteKey)) {
                this.foundNotes.push(noteKey);
                const formulaIdx = this.scaleST.indexOf(dist);
                const intervalLabel = this.scaleFormula[formulaIdx];
                
                engine.processResult(true, { visualX: x, visualY: y, noteName: intervalLabel, 
                                             stayOnChallenge: stay });
            }
        } else {
            engine.processResult(false, { visualX: x, visualY: y, noteName: name, skipHistory: true });
        }
    },

    preRender(engine) {
        const ctx = engine.ctx;

        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(`${this.foundNotes.length} / ${this.totalInBox} Notes Found`,
                     engine.canvas.width/2, engine.canvas.height-30);
        if (this.showHints>0){
            if (this.showHints==1)
                engine.drawChordMap(this.rootNote, this.scaleST, this.scaleFormula ,
                                    this.startFret , this.endFret);
            else // show hints on the complete fretboard
                engine.drawChordMap(this.rootNote, this.scaleST, this.scaleFormula);
                
        }
        KeyboardHelper.draw(engine.ctx, this.buttons);
    }
};
