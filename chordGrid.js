const ChordGridVariant = {
    label: "Chord Grid",
    skipHeatMap: true,
    init(engine) {
        this.chordsLoaded = false;
        this.chordsToRender = null;
        this.sequentialChords = null;
        this.hold = false;
        this.tapTimestamps = [];
        this.maxTapHistory = 8;
        this.newBpm=null;
        const h = engine.canvas.height;
        this.gridHeight = h * 0.3;
        this.sheetHeight = h - this.gridHeight;

        this.loadSong("Je pardonne");
        this.initGame(engine);
    },
    initGame(engine) {
        this.startTime = Date.now();
        this.lastTapTime=0;
        this.fixedRow=null;
        if (!this.hold)
            setTimeout(() => {engine.requestWakeLock();}, 100);// prevent screen saver
    },
    loadSong(songName="Manha de Carnaval") {
        this.label=`Loading "${songName}"...`;
        return dbService.getSongByName(songName).then(song => {
            if (!song) {
                this.label=`"${songName}" not found.`;
            }else{
                this.song = song;
                this.loadChords(song);
            }
        });
    },
    loadChords(song) {
        this.label = `Loading chords...`;
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
            let cumulChords = 0;
            song.grid.forEach(row => {
                row.cumulChords = cumulChords; // Store cumulative count
                row.forEach(cell => {
                    cell.chords.forEach(chordEntry => {
                        cumulChords++;
                        const posArray = registry.get(chordEntry.n) || [];
                        // Assign the full array and the first variant as default
                        chordEntry.positions = posArray;
                    });
                });
            });

            // 6. Signal that data is ready
            this.chordsLoaded = true;
            this.label = `${song.name}`;
        }).catch(err => {
            this.label = `Error loading chords "${song.name}"`;
            console.error("Error loading chords:", err);
        });
    },
/**
 * Generates an ordered list of unique chords AND a sequential timeline array.
 * 
 * @param {Object} song - The song object containing the grid.
 * @param {number|null} activeRow - The index of the row to process, or null for all rows.
 * @returns {Object} { unique: Array, sequence: Array }
 */
getChordsToRender(song, activeRow = null) {
    const uniqueChords = [];
    const sequentialChords = [];
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
                if (chordName === "-") return; // Skip empty markers

                // Parse components and find the specific position variant
                const { note, suffix } = this.parseChordName(chordName);
                const variant = chordEntry.v || 0;
                const position = chordEntry.positions ? chordEntry.positions[variant] : null;

                // Create the base item structure
                const chordItem = {
                    note: note,
                    chord: suffix,
                    name: chordName, // Helpful tracking key for the ribbon
                    duration: chordEntry.b, // Number of beats this chord lasts
                    position: position
                };

                // A. Add to the Sequential Ribbon Array (Keep everything)
                sequentialChords.push(chordItem);

                // B. Add to the Unique Grid Array (Filter duplicates)
                if (!seenNames.has(chordName)) {
                    seenNames.add(chordName);
                    uniqueChords.push(chordItem);
                }
            });
        });
    });

    return {
        unique: uniqueChords,
        sequence: sequentialChords
    };
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

    bpmAverage(engine,now,x,y) {
        // If the gap since the last tap is longer than 2.5 seconds, clear history to start fresh
        if (this.tapTimestamps.length > 0 &&
          (now - this.tapTimestamps[this.tapTimestamps.length - 1] > 2500)) {
            this.tapTimestamps = [];
        }

        this.tapTimestamps.push(now);

        if (this.tapTimestamps.length > this.maxTapHistory) {
            this.tapTimestamps.shift();
        }

        // Need at least 2 taps to calculate an interval
        if (this.tapTimestamps.length < 2) {
            return null;
        }

        let totalDelay = 0;
        const intervalsCount = this.tapTimestamps.length - 1;

        for (let i = 0; i < intervalsCount; i++) {
            totalDelay += (this.tapTimestamps[i + 1] - this.tapTimestamps[i]);
        }

        const averageDelayMS = totalDelay / intervalsCount;
        this.newBpm = Math.max(30, Math.min(150, Math.round(60000 / averageDelayMS)));
        engine.addLabel(`${this.newBpm}`,
                         { duration: .75, size:25, x:x, y:y,
                          speed:210, acceleration : 90, direction: -15
                        });

    },

    getClickedRectangleTopPart(engine, cx, cy, topSectionRatio = 1.0) {
        const x=0; 
        const y=this.gridHeight;
        const w=engine.canvas.width;
        const h=this.sheetHeight;
        const columns=3;
        const rows=3;

        // Check if the click is outside the bounding box of the entire canvas area
        if (cx < x || cx > x + w || cy < y || cy > y + h) {
            return null;
        }

        // Calculate the dimensions of a single rectangle
        const rectW = w / columns;
        const rectH = h / rows;

        // Determine the column and row index (0-based) of the click
        const colIndex = Math.floor((cx - x) / rectW);
        const rowIndex = Math.floor((cy - y) / rectH);

        // Handle edge cases where the click is exactly on the outer boundaries
        const safeCol = Math.min(colIndex, columns - 1);
        const safeRow = Math.min(rowIndex, rows - 1);

        // Calculate the local Y coordinate within the target rectangle
        const localY = (cy - y) - (safeRow * rectH);

        // Check if the click is within the top section of this rectangle
        // If topSectionRatio is 1.0, the entire rectangle is active. If it's 0.5, only the top half is active, etc.
        if (localY <= rectH * topSectionRatio) {
            // Calculate the sequential index (row-by-row, left-to-right)
            return (safeRow * columns) + safeCol;
        }

        return null;
    },

    onTap(engine, s, f, name, x, y) {
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const coords = {x: w-40, y: h-40}; // bottom right corner for BPM tap
        const now = Date.now();

        if (x>coords.x && y>coords.y){//bottom right  corner
            this.bpmAverage(engine,now,coords.x,coords.y);
            return;
        }
        const delay=now- this.lastTapTime;
        const dblTap = delay<300;
        this.lastTapTime=now;
        if (x<w/4 && y<h/4){//top left corner
            if (this.fixedRow===null) 
                this.fixedRow=0;
            else {
                this.fixedRow++;
                if (this.fixedRow>=this.song.grid.length)
                    this.fixedRow=0;
            }
            this.startTime = now-4000; // to prevent countdown
            this.holdStartTime = this.startTime;
        }else{
            const rectIndex = this.getClickedRectangleTopPart(engine,x, y);
            if (rectIndex !== null && this.hold) {
            if (!engine.audioUnlocked) {
                engine.audio.resume(); // Unlocks audio on first click
                engine.audioUnlocked = true;
            }
                engine.playChord(this.chordsToRender[rectIndex].position);
            }else if (y<h/4){ // top fourth for hold toggle
                this.hold = !this.hold;
                if (this.hold) {
                    this.holdStartTime = now;
                    setTimeout(() => {engine.releaseWakeLock();}, 100);// allow screen saver
                }else {
                    this.startTime += (now - this.holdStartTime);
                    setTimeout(() => {engine.requestWakeLock();}, 100);
                    // Adjust start time to account for hold duration
                }
                if (dblTap){ // Double tap detected, reset the song
                    setTimeout(() => this.initGame(engine), 100);
                    return;
                }
            }
        }
    },

render(engine) {
    if (!this.chordsLoaded) return;
    if (!this.chordsToRender ){
        const data = this.getChordsToRender(this.song);
        this.chordsToRender = data.unique;
        this.sequentialChords = data.sequence;
    }
    const ctx = engine.ctx;
    const w = engine.canvas.width;
    const h = engine.canvas.height;
    const msPerBeat = 60000 / (this.newBpm ? this.newBpm : this.song.bpm);
    
    // --- COUNT-IN CONFIGURATION ---
    const countInBeats = 4;
    const countInMS = countInBeats * msPerBeat;
    
    let now = this.hold ? this.holdStartTime : Date.now();
    const beatsPerRow = this.song.cols * 4;
    // The "songTime" is 0 exactly when the countdown ends.
    // Before that, it is negative.
    const songElapsed = now - (this.startTime + countInMS);
    let totalBeatsElapsed = songElapsed / msPerBeat;

    // --- FIX: Wrap beats if we are restricting playback to a single row ---
    if (this.fixedRow !== null && totalBeatsElapsed >= 0) {
        totalBeatsElapsed = totalBeatsElapsed % beatsPerRow;
    }

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
    const cellH = this.gridHeight / windowSize; 

    ctx.save();
    
    // 1. Draw Grid (Sliding logic)
    ctx.beginPath();
    ctx.rect(0, 0, w, this.gridHeight);
    ctx.clip();

    let activeChord = null;
    let seqChordIndx = -1;
    let activeChordSeqIndx = 0;
    let chordsInBarCount = 0;
    let startingChordIndx = 0;
    let maxRowToRender = Math.min(this.song.rows, windowSize);
    // vScroll is 0 during countdown, then starts moving
    let vScroll = (this.song.rows <= windowSize || totalBeatsElapsed < 0) 
        ? 0.0 
        : totalBeatsElapsed / beatsPerRow;

    let startingRow = 0;
    if (this.fixedRow !== null) {
        maxRowToRender = 2;
        vScroll = 0.0;
    }
   
    for (let i = startingRow; i <= maxRowToRender; i++) {
        const virtualRow = Math.floor(vScroll) + i;
        
        // When fixedRow is active, actualRow always points to it, ignoring layout shifting
        const actualRow = this.fixedRow === null 
            ? ((virtualRow % this.song.rows) + this.song.rows) % this.song.rows
            : this.fixedRow;

        const drawY = (i - (vScroll % 1)) * cellH + cellH;
        if (actualRow != this.lastRow ){
            const data = this.getChordsToRender(this.song, actualRow);
            this.chordsToRender = data.unique;
            this.lastRow = actualRow;
        } 
        
        seqChordIndx = this.song.grid[actualRow].cumulChords - 1;
        for (let c = 0; c < this.song.cols; c++) {
            if (actualRow < 0 || actualRow >= this.song.rows) continue;
            
            const barData = this.song.grid[actualRow][c];
            
            // --- FIX HERE: Use trackingRow (or virtualRow) for the timeline index mapping ---
            const targetRow = this.fixedRow === null ? actualRow : (virtualRow % this.song.rows);
            const barGlobalIdx = (targetRow * this.song.cols) + c;
            
            let activeIdx = null;
            // Only highlight bars if we have actually started the song
            if (totalBeatsElapsed >= 0 && barGlobalIdx === currentBarIndex) {
                let accum = 0;
                chordsInBarCount = barData.chords.length;
                startingChordIndx = seqChordIndx + 1;
                for (let j = 0; j < barData.chords.length; j++) {
                    seqChordIndx++;
                    if (!barData.chords[j]) continue;
                    accum += barData.chords[j].b;
                    if (beatInBar < accum) {
                        activeIdx = j;
                        activeChordSeqIndx = seqChordIndx;
                        break;
                    }
                }
            } else {
                seqChordIndx += barData.chords.length;
            }

            this.drawBar(ctx, c * cellW, drawY, cellW, cellH, barData, activeIdx);
            
            // Row Labels (Keep actualRow if you want to see the frozen loop number)
            ctx.fillStyle = "rgba(120, 120, 255, 0.7)";
            ctx.font = "35px monospace";
            ctx.fillText(`${actualRow + 1}`, 15, drawY + 35);
        }
    }
    
    if (activeChordSeqIndx!=this.lastChordIndx){
        this.lastChordIndx=activeChordSeqIndx;
        //engine.playChord(this.sequentialChords[activeChordSeqIndx].position);
    }

    ctx.restore();

    // 2. Draw Chord Sheet
    if (this.chordsToRender) {
        if (this.hold) {
            drawSongSheet(ctx, 0, this.gridHeight, w, this.sheetHeight,
                          this.chordsToRender, 3, 3, null);
        } else {
            drawSongSheet(ctx, 0, this.gridHeight, w, this.sheetHeight,
                          this.sequentialChords, 2, 2, activeChordSeqIndx,
                          startingChordIndx, chordsInBarCount); 
        }
    }
    this.drawBeatIndicator(ctx, w-18, h-18, (totalBeatsElapsed % 1 + 1) % 1);
    // 3. --- COUNTDOWN OVERLAY ---
    if (totalBeatsElapsed < 0 && !this.hold) {
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
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${opacity})`;
        ctx.shadowBlur = 15 * opacity;
        ctx.shadowColor = "#00FFFF";
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