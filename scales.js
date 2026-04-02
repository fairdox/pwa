const SCALES = [
    { label: "Maj Pentatonic", formula: ["1", "2", "3", "5", "6"], st: [0, 2, 4, 7, 9] },
    { label: "Min Pentatonic", formula: ["1", "b3", "4", "5", "b7"], st: [0, 3, 5, 7, 10] },
    { label: "Major Scale", formula: ["1", "2", "3", "4", "5", "6", "7"], st: [0, 2, 4, 5, 7, 9, 11] },
    { label: "Natural Minor", formula: ["1", "2", "b3", "4", "5", "b6", "b7"], st: [0, 2, 3, 5, 7, 8, 10] }
];

const ScalePathVariant = {
    label: "Scale Box Trainer",
    statKey: "SB1",
    singleStatKey: true,
    init(engine) {
        const h = engine.canvas.height;
        const w = engine.canvas.width;
        this.buttons=[];
        const objects = KeyboardHelper.addFunctionKeys(engine,this);
        const uiprop = engine.uiprop;
        const scale = uiprop.scale;
        const pad = uiprop.sidePadding;

        // horizontal arrows in bottom of the screen for changing the scale 
        const kobj=KeyboardHelper.addArrowKeys(engine,this,
                                    {x:w/2, y: h*0.9, horizontal: true,
                                     btnh: scale*25, btnw: scale*40,
                                     fct1: ()=>  this.incrementScale(engine,+1),
                                     fct2: ()=>  this.incrementScale(engine,-1),
                                    });
        this.scaleLabel = kobj.label;

        this.btnopt = objects.btnopt;
        this.btnopt.hidden=true;
        this.rootNoteLabel = objects.arrowsL.label;
        this.fretBoxLabel = objects.arrowsR.label;
        this.showShapeBtn = KeyboardHelper.addFunctionButton(engine, this, "🧩",  pad, h*1/3,
                                                             "#484",null, false,scale*30,scale*25,18);
        
        this.playBtn = KeyboardHelper.addFunctionButton(engine, this, "🔊",
                                                             pad, h*1/3-this.showShapeBtn.h-pad*2,
                                                             "#484",null, false,scale*30,scale*25,18);
        
        this.rootIdx=0;
        this.selectedTopFret=0;
        this.startFret=0;
        this.scaleIdx=0;
        restoreVariantState(this);
        this.showHints=0;
        this.initGame(engine);        
    },
    incrementRoot(engine,inc=1, reset=true,){
        const len = NOTES.length;
        this.rootIdx = (this.rootIdx + inc + len) % len;
        if (reset) this.initGame(engine);
    },

    incrementChord(engine,inc=1, reset=true){
        const len = 11; // starting fret for the box from 0 to 10, (10 means all fretboard)
        this.selectedTopFret = (this.selectedTopFret + inc + len) % len ;
        if (reset) this.initGame(engine);
    },
    incrementScale(engine,inc=1, reset=true){
        const len = SCALES.length;
        this.scaleIdx = (this.scaleIdx + inc + len) % len;
        this.initGame(engine);
    },
    initGame(engine){
        const h = engine.canvas.height;
        const w = engine.canvas.width;
        //const scale = SCALES[Math.floor(Math.random() * SCALES.length)];
        const scale = SCALES[this.scaleIdx];
        if (this.selectedTopFret==10){
            this.startFret = 0;
            this.endFret = 12;
        }else{
            this.startFret = this.selectedTopFret;
            this.endFret = this.selectedTopFret + 3;
        }

        this.scaleST = scale.st;
        this.scaleFormula = scale.formula;
        this.rootNote = NOTES[this.rootIdx];
        this.rootNoteLabel.text= this.rootNote;
        this.fretBoxLabel.text=`[${this.startFret}-${this.endFret}]`;
        this.scaleLabel.text= scale.label;
        
        this.foundNotes = [];
        this.totalInBox = this.calculateTotalInBox();
        this.startTime = Date.now();
        this.skipSavingTaps = true; // allow multiple taps on the same note
        this.skipHeatMap=true;
        engine.history=[];
        engine.tappedKeys.clear();
        engine.score = 0;
        engine.highlightFretRange(this.startFret, this.endFret, true);
    },

    hints(engine){
        this.showHints = ++this.showHints % 3;
        if (this.showHints===0){
            this.btnopt.hidden=true;
        } else{
            this.btnopt.hidden=false;
        }
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
        if (this.playBtn.toggleState){
            engine.audio.playNote(pitch);
        }

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
                const label = this.btnopt.toggleState ? name: intervalLabel; 
                
                engine.processResult(true, { visualX: x, visualY: y, noteName: label, 
                                             stayOnChallenge: stay , skipHistory: true});
            }
        } else {
            engine.processResult(false, { visualX: x, visualY: y, noteName: name, skipHistory: true });
        }
    },

    preRender(engine) {
        const ctx = engine.ctx;
        this.label=`${this.foundNotes.length} / ${this.totalInBox} Notes Found`;
        const drawNoteNames= this.btnopt.toggleState;
        if (this.showShapeBtn.toggleState){
            engine.drawFullFretboardMap(this.rootNote, this.scaleST);
        }
        if (this.showHints>0){
            if (this.showHints==1)
                engine.drawChordMap(this.rootNote, this.scaleST, this.scaleFormula ,
                                    this.startFret , this.endFret, false, drawNoteNames,this.foundNotes);
            else // show hints on the complete fretboard
                engine.drawChordMap(this.rootNote, this.scaleST, this.scaleFormula,
                                    0,12, false, drawNoteNames,this.foundNotes);
                
        }else{
            engine.drawChordMap(this.rootNote, this.scaleST, this.scaleFormula,
                                0,12, true, drawNoteNames,this.foundNotes);
        }

        KeyboardHelper.draw(engine, this.buttons);
    }
};
