const ChordGridVariant = {
    label: "Chord Grid",
    skipHeatMap: true,
    
    song: {
        bpm: 78,
        rows: 5,
        cols: 4,
        grid: [
        [
            { chords: [{ n: "Am", b: 2 }, { n: "Dm6", b: 1 }, { n: "E7b9", b: 1 }] },
            { chords: [{ n: "Am", b: 2 }, { n: "Dm6", b: 1 }, { n: "E7b9", b: 1 }] },
            { chords: [{ n: "Am", b: 2 }, { n: "Dm7", b: 1, v: 1 }, { n: "G7", b: 1 }] },
            { chords: [{ n: "Cmaj7", b: 2 }, { n: "C#dim", b: 1 }, { n: "A7b9", b: 1 }] }
        ],
        [
            { chords: [{ n: "Dm7", b: 2 }, { n: "G7", b: 2 }] },
            { chords: [{ n: "C6", b: 2 }, { n: "Fmaj7", b: 2 }] },
            { chords: [{ n: "Dm6", b: 2 }, { n: "E7b9", b: 2}] },
            { chords: [{ n: "Am", b: 2 }, { n: "Dm6", b: 1 }, { n: "E7b9", b: 1 }] }
        ],
        [
            { chords: [{ n: "Am", b: 2 }, { n: "Dm6", b: 1 }, { n: "E7b9", b: 1 }] },
            { chords: [{ n: "Am", b: 2 }, { n: "Dm6", b: 1 }, { n: "E7b9", b: 1 }] },
            { chords: [{ n: "Em7b5", b: 2 }, { n: "A7b9", b: 2}] },
            { chords: [{ n: "Dm", b: 4 }]}
        ],
        [
            { chords: [{ n: "Dm", b: 1 }, { n: "Dm7/C", b: 1 }, { n: "Dm6", b: 1 }, { n: "E7b9", b: 1 } ] },
            { chords: [{ n: "Am", b: 2 }, { n: "Am7/G", b: 1 } , { n: "Fmaj7", b: 1 }] },
            { chords: [{ n: "Dm6", b: 2 }, { n: "E7b9", b: 2}] },
            { chords: [{ n: "Am", b: 2 }, { n: "Dm6", b: 1 }, { n: "E7b9", b: 1 }] }
        ],
        [
            { chords: [{ n: "Am", b: 4 }] },
            { chords: [{ n: "Am", b: 4 }] },
            { chords: [{ n: "Am", b: 4 }] },
            { chords: [{ n: "Am", b: 4 }] }
        ]
    ],
    chordDB: {
        "Dm7/C": {
            "frets": [-1, 3, 0, 2, 1, 1], // Corrected example frets for Dm7/C
            "barres": [1], 
            "baseFret": 1,
            "fingers": [0, 3, 0, 2, 3, 1] // Optional but helpful for future-proofing
        },
        "Dm6": {
            "frets": [-1, 2, 0, 2, 3, 1],
            "barres": [],
            "baseFret": 1
        },
        "Cmaj7": {
            "frets": [-1, 3, 2, 0, 0, 0],
            "barres": [],
            "baseFret": 1
        },
        "Am7/G": {
            "frets": [3, 0, 2, 2, 1, 0],
            "barres": [],
            "baseFret": 1
        },
        "C#dim": {
            "frets": [-1, 1, 2, 0, 2, 0],
            "barres": [],
            "baseFret": 1
        },


    }
    },

    init(engine) {
        this.startTime = Date.now();
        this.lastTapTime=0;
        this.chordsLoaded = false;
        this.chordsToRender = null
        this.hold = false;
        this.countDown = true;
        this.loadChords(this.song);
    },

    loadChords(song) {
        // 1. Flatten the grid to find every chord entry
        const allChords = song.grid.flat().flatMap(cell => cell.chords);
        
        // 2. Identify unique chords based on their name ('n')
        // Using a Map to store { name: positions }
        const uniqueChordNames = [...new Set(allChords.map(c => c.n))];

        // 3. Start the async loading process
        Promise.all(uniqueChordNames.map(async (chordName) => {
            // 1. Check local song-specific DB first
            if (song.chordDB && song.chordDB[chordName]) {
                return { 
                    chordName: chordName, 
                    positions: [song.chordDB[chordName]] // Wrap in array to match format
                };
            }
            // You'll need a way to split "Bm7" into "B" and "m7" 
            // Assuming a helper like parseChordName(chordName) exists
            const { note, suffix } = this.parseChordName(chordName); 
            
            const positions = await dbService.getChordVoicings(note, suffix);
            return { chordName, positions };
        })).then(results => {
            // 4. Create a lookup registry
            const registry = new Map();
            results.forEach(res => registry.set(res.chordName, res.positions));

            // 5. Attach the loaded data back to the original song structure
            // This modifies the song object in place so render() can access it
            song.grid.forEach(row => {
                row.forEach(cell => {
                    cell.chords.forEach(chordEntry => {
                        const posArray = registry.get(chordEntry.n) || [];
                        // Assign the full array and the first variant as default
                        chordEntry.positions = posArray;
                    });
                });
            });

            // 6. Signal that data is ready
            this.chordsLoaded = true;
        }).catch(err => {
            console.error("Error loading chords:", err);
        });
    },
    /**
     * Generates an ordered list of unique chord objects for rendering.
     * 
     * @param {Object} song - The song object containing the grid.
     * @param {number|null} activeRow - The index of the row to process, or null for all rows.
     * @returns {Array} Array of objects { note, chord, position }
     */
    getChordsToRender(song, activeRow = null) {
        const renderedChords = [];
        const seenNames = new Set();

        // 1. Determine which rows to process
        const rowsToProcess = (activeRow !== null) 
            ? [song.grid[activeRow]] 
            : song.grid;

        // 2. Traverse the grid structure
        rowsToProcess.forEach(row => {
            if (!row) return;

            row.forEach(cell => {
                if (!cell.chords) return;

                cell.chords.forEach(chordEntry => {
                    const chordName = chordEntry.n;

                    // 3. Only add if we haven't seen this chord name yet
                    if (!seenNames.has(chordName) && chordName !== "-") {
                        seenNames.add(chordName);

                        // Parse the name for rendering labels
                        const { note, suffix } = this.parseChordName(chordName);

                        const variant = chordEntry.v || 0; // Default to first variant
                        const position = chordEntry.positions ? chordEntry.positions[variant] : null;
                        // 4. Push the item in the required format
                        renderedChords.push({
                            note: note,
                            chord: suffix,
                            position: position
                        });
                    }
                });
            });
        });

        return renderedChords;
    },
    // Simple parser example (adjust based on your specific naming logic)
    parseChordName(name) {
        // Splits "F#m7" into "F#" and "m7"
        const match = name.match(/^([A-G][#b]?)(.*)/);
        //if (match[2]==="m") match[2] = "minor";
        return {
            note: match ? match[1] : name,
            suffix: match ? match[2] : ""
        };
    },

    setActiveRow(rowIndex) {
        if (this.activeRow !== rowIndex) {
            if (this.chordsLoaded) {
                this.activeRow = rowIndex;
                this.chordsToRender = this.getChordsToRender(this.song, rowIndex);
            }
        }
    },
    onTap(engine, s, f, name, x, y) {
        const delay=Date.now() - this.lastTapTime;
        if (delay<300){ // Double tap detected, reset the song
            setTimeout(() => this.init(), 100);
            return;
        }
        this.lastTapTime=Date.now();
        this.hold = !this.hold;
        if (this.hold) {
            this.holdStartTime = Date.now();
        }else {
            this.startTime += (Date.now() - this.holdStartTime);
             // Adjust start time to account for hold duration
        }
    },

render(engine) {
    if (!this.chordsLoaded) return;

    const ctx = engine.ctx;
    const w = engine.canvas.width;
    const h = engine.canvas.height;
    const msPerBeat = 60000 / this.song.bpm;
    
    // --- COUNT-IN CONFIGURATION ---
    const countInBeats = 4;
    const countInMS = countInBeats * msPerBeat;
    
    let now = this.hold ? this.holdStartTime : Date.now();
    
    // The "songTime" is 0 exactly when the countdown ends.
    // Before that, it is negative.
    const songElapsed = now - (this.startTime + countInMS);
    const totalBeatsElapsed = songElapsed / msPerBeat;

    const gridHeight = h * 0.3;
    const sheetHeight = h - gridHeight;
    const beatsPerRow = this.song.cols * 4;

    // --- GRID CALCULATIONS ---
    // We clamp currentBarIndex to 0 during countdown so the grid shows the start
    const currentBarIndex = totalBeatsElapsed < 0 
        ? 0 
        : Math.floor(totalBeatsElapsed / 4) % (this.song.rows * this.song.cols);
    
    const activeRow = Math.floor(currentBarIndex / this.song.cols);
    const beatInBar = totalBeatsElapsed < 0 ? 0 : totalBeatsElapsed % 4;

    // Layout
    const windowSize = 2; 
    const cellW = w / this.song.cols;
    const cellH = gridHeight / windowSize; 

    ctx.save();
    
    // 1. Draw Grid (Sliding logic)
    ctx.beginPath();
    ctx.rect(0, 0, w, gridHeight);
    ctx.clip();

    let activeChord = null;
    const maxRowToRender = Math.min(this.song.rows, windowSize);
    
    // vScroll is 0 during countdown, then starts moving
    const vScroll = (this.song.rows <= windowSize || totalBeatsElapsed < 0) 
        ? 0.0 
        : totalBeatsElapsed / beatsPerRow;
   
    for (let i = -1; i <= maxRowToRender; i++) {
        const virtualRow = Math.floor(vScroll) + i;
        const actualRow = ((virtualRow % this.song.rows) + this.song.rows) % this.song.rows;
        const drawY = (i - (vScroll % 1)) * cellH + cellH;

        for (let c = 0; c < this.song.cols; c++) {
            if (actualRow < 0 || actualRow >= this.song.rows) continue;
            
            const barData = this.song.grid[actualRow][c];
            const barGlobalIdx = (actualRow * this.song.cols) + c;
            
            let activeIdx = null;
            // Only highlight bars if we have actually started the song
            if (totalBeatsElapsed >= 0 && barGlobalIdx === currentBarIndex) {
                let accum = 0;
                for (let j = 0; j < barData.chords.length; j++) {
                    if (!barData.chords[j]) continue;
                    accum += barData.chords[j].b;
                    if (beatInBar < accum) {
                        activeIdx = j;
                        activeChord = barData.chords[j].n;
                        break;
                    }
                }

                if (this.lastActiveRow !== actualRow) {
                    this.setActiveRow(actualRow);
                    this.lastActiveRow = actualRow;
                }
            }

            this.drawBar(ctx, c * cellW, drawY, cellW, cellH, barData, activeIdx);
            
            // Row Labels
            ctx.fillStyle = "rgba(120, 120, 255, 0.7)";
            ctx.font = "35px monospace";
            ctx.fillText(`${actualRow + 1}`, 15, drawY + 35);
        }
    }
    
    this.drawBeatIndicator(ctx, 15, 15, (totalBeatsElapsed % 1 + 1) % 1);
    ctx.restore();

    // 2. Draw Chord Sheet
    if (this.chordsToRender) {
        drawSongSheet(ctx, 0, gridHeight, w, sheetHeight, 
            this.chordsToRender, 3, 3, activeChord);
    }

    // 3. --- COUNTDOWN OVERLAY ---
    if (totalBeatsElapsed < 0) {
        const count = Math.ceil(Math.abs(totalBeatsElapsed)); // 4, 3, 2, 1
        const progressInBeat = 1 - (Math.abs(totalBeatsElapsed) % 1);
        
        ctx.save();
        ctx.fillStyle = `rgba(0, 255, 0, ${0.8 * progressInBeat})`; // Pulse green
        ctx.font = "bold 120px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Center of the screen
        ctx.fillText(count, w / 2, h / 2);
        ctx.restore();
    }
},

    drawBeatIndicator(ctx, x, y, opacity) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 0, ${opacity})`;
        ctx.shadowBlur = 15 * opacity;
        ctx.shadowColor = "#00FF00";
        ctx.fill();
        ctx.restore();
    },

drawBar(ctx, x, y, w, h, bar, activeIdx) {
    // 1. Draw solid black background for the whole bar
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);

    bar.chords.forEach((chord, i) => {
        const geo = this.getChordGeometry(x, y, w, h, bar.chords, i);
        if (!geo || !geo.polygon || geo.polygon.length < 3) return;
        // 2. Draw the Quadrant Shape
        ctx.beginPath();
        ctx.moveTo(geo.polygon[0].x, geo.polygon[0].y);
        for (let p = 1; p < geo.polygon.length; p++) {
            ctx.lineTo(geo.polygon[p].x, geo.polygon[p].y);
        }
        ctx.closePath();

        // 3. Fill only if active (using green highlight)
        if (i === activeIdx) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
            ctx.fill();
        }

        // 4. Draw the borders (This creates the diagonals/subdivisions)
        ctx.strokeStyle = "#444"; // Dark gray for the internal lines
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw Chord Name
        ctx.fillStyle = "#00FF00";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(chord.n, geo.text.x, geo.text.y);
    });

    // 6. Draw a clean outer border for the bar
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
},

getChordGeometry(x, y, w, h, barChords, index) {
    const tl = { x, y }, tr = { x: x + w, y };
    const br = { x: x + w, y: y + h }, bl = { x, y: y + h };
    const mid = { x: x + w / 2, y: y + h / 2 };
    
    const duration = barChords[index].b;
    let poly = [];

    if (barChords.length === 1) {
        poly = [tl, tr, br, bl];
    } 
    else if (barChords.length === 2) {
        // Your specific diagonal (BL to TR)
        poly = (index === 0) ? [tl, tr, bl] : [tr, br, bl];
    } 
    else {
        // Hardcoded for 3 and 4 chords
        // Position 0: Top/Left, 1: Right, 2: Bottom, 3: Left
        if (index === 0) {
            poly = (duration === 2) ? [bl, tl, tr, mid] : [tl, tr, mid];
        } 
        else if (index === 1) {
            // If the first chord took 2 beats, this one starts at the Right
            poly = [tr, br, mid];
        } 
        else if (index === 2) {
            poly = [br, bl, mid];
        } 
        else if (index === 3) {
            poly = [bl, tl, mid];
        }
    }

    // Centroid for text alignment
    const cX = poly.reduce((sum, p) => sum + p.x, 0) / poly.length;
    const cY = poly.reduce((sum, p) => sum + p.y, 0) / poly.length;

    return { polygon: poly, text: { x: cX, y: cY } };
}
};