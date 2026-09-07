const ChordGridVariant = {
    label: "Chord Grid",
    skipHeatMap: true,
    wideCanvas: true,
    init(engine) {
        engine.resize();
        this.chordsLoaded = false;
        this.chordsToRender = null;
        this.sequentialChords = null;
        this.hold = false;
        this.tapTimestamps = [];
        this.maxTapHistory = 8;
        this.newBpm=null;
        const pad = engine.uiprop.sidePadding;
        const scale = engine.uiprop.scale;
        let pos = engine.getFretCoordinates(5, 1);

        const h = engine.canvas.height;
        this.gridHeight = h * 0.3;
        this.sheetHeight = h - this.gridHeight;
        this.buttons = [];
        this.editBtn = KeyboardHelper.addFunctionButton(
            engine,
            this,
            "✎",
            pos.x+20,
            20,
            "#484",
            () => this.openEditor(),
            null,
            scale * 35,
            scale * 35,
            19
        );

        this.loadSong("Hold on");
        this.initGame(engine);
    },
    initGame(engine) {
        this.startTime = Date.now();
        this.lastTapTime=0;
        this.fixedRow=null;
        if (!this.hold)
            setTimeout(() => {engine.requestWakeLock();}, 100);// prevent screen saver
    },
    loadSong(songName) {
        this.label = `Loading "${songName}"...`;

        return dbService.getSongByName(songName).then(data => {
            if (!data) {
                this.label = `"${songName}" not found.`;
                return;
            }

            if (data.text !== ""){
                this.song = this.textToSong(data.text, data.id);
            } else {
                this.song = {
                    id: data.id,
                    name: data.name,
                    bpm: data.bpm,
                    rows: data.rows,
                    cols: data.cols,
                    grid: data.grid,
                    rowNames: data.rowNames || [],
                    chordDB: data.chordDB || data.chord_db || {}
                };
            }

            return this.loadChords(this.song);
        });
    },
    loadChords(song) {
        this.label = `Loading chords...`;
        this.chordsLoaded = false;
        this.chordsToRender = null;
        this.sequentialChords = null;
        this.lastRow = null;
        this.lastChordIndx = -1;

        const allChords = song.grid.flat().flatMap(cell => cell.chords || []);
        const uniqueNames = [...new Set(
            allChords.map(chord => chord.n).filter(name => name !== '-')
        )];

        return Promise.all(uniqueNames.map(async chordName => {
            if (song.chordDB?.[chordName]) {
                return {
                    chordName,
                    positions: [song.chordDB[chordName]]
                };
            }

            const { note, suffix } = this.parseChordName(chordName);
            const positions = await dbService.getChordVoicings(note, suffix);

            return { chordName, positions };
        })).then(results => {
            const registry = new Map(
                results.map(result => [result.chordName, result.positions])
            );

            let cumulChords = 0;

            song.grid.forEach(row => {
                row.cumulChords = cumulChords;

                row.forEach(cell => {
                    (cell.chords || []).forEach(chord => {
                        cumulChords++;

                        chord.positions = registry.get(chord.n) || [];
                    });
                });
            });

            this.chordsLoaded = true;
            this.label = song.name;

            return song;
        }).catch(err => {
            this.label = `Error loading chords "${song.name}"`;
            console.error('Error loading chords:', err);
            throw err;
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
                const variant = chordEntry.v ?? 0;
                const position = chordEntry.positions?.[variant] || null;

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
        const w=engine.layoutWidth;
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
        const { btn, processed } = KeyboardHelper.checkClick(this.buttons, x, y);
        if (btn && processed) return;

        const w = engine.layoutWidth;
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

        if (!this.chordsToRender) {
            const data = this.getChordsToRender(this.song);
            this.chordsToRender = data.unique;
            this.sequentialChords = data.sequence;
        }

        const ctx = engine.ctx;
        const w = engine.layoutWidth;
        const h = engine.canvas.height;
        const msPerBeat = 60000 / (this.newBpm ? this.newBpm : this.song.bpm);

        // --- COUNT-IN CONFIGURATION ---
        const countInBeats = 4;
        const countInMS = countInBeats * msPerBeat;

        let now = this.hold ? this.holdStartTime : Date.now();

        // Actual number of beats in each parsed row
        const rowBeats = this.song.grid.map(row => row.length * 4);
        const totalSongBeats = rowBeats.reduce((sum, beats) => sum + beats, 0);

        // The "songTime" is 0 exactly when the countdown ends.
        // Before that, it is negative.
        const songElapsed = now - (this.startTime + countInMS);
        let totalBeatsElapsed = songElapsed / msPerBeat;

        // --- RESTART AT END OF SONG ---
        if (this.fixedRow === null &&
            totalBeatsElapsed >= totalSongBeats) {
            this.initGame(engine);
            return;
        }

        // --- FIX: Wrap beats if we are restricting playback to a single row ---
        if (this.fixedRow !== null && totalBeatsElapsed >= 0) {
            const rowDuration = rowBeats[this.fixedRow] || 4;
            totalBeatsElapsed = totalBeatsElapsed % rowDuration;
        }

        // --- FIND CURRENT ROW AND BEAT WITHIN ROW ---
        let currentBarIndex = 0;
        let activeRow = 0;
        let beatInBar = 0;
        let beatInRow = totalBeatsElapsed;

        if (totalBeatsElapsed >= 0) {
            for (let r = 0; r < rowBeats.length; r++) {
                if (beatInRow < rowBeats[r]) {
                    activeRow = r;
                    break;
                }

                beatInRow -= rowBeats[r];
                activeRow = r + 1;
            }

            currentBarIndex =
                this.song.grid
                    .slice(0, activeRow)
                    .reduce((sum, row) => sum + row.length, 0)
                + Math.floor(beatInRow / 4);

            beatInBar = beatInRow % 4;
        }

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

        let maxRowToRender = Math.min(this.song.grid.length, windowSize);

        // vScroll is 0 during countdown, then starts moving
        let vScroll = (this.song.grid.length <= windowSize ||
                    totalBeatsElapsed < 0)
            ? 0.0
            : activeRow +
            (rowBeats[activeRow] > 0
                ? beatInRow / rowBeats[activeRow]
                : 0);

        let startingRow = 0;

        if (this.fixedRow !== null) {
            maxRowToRender = 2;
            vScroll = 0.0;
            activeRow = this.fixedRow;
        }

        for (let i = startingRow; i <= maxRowToRender; i++) {
            const virtualRow = Math.floor(vScroll) + i;

            const actualRow = this.fixedRow === null
                ? ((virtualRow % this.song.grid.length) +
                this.song.grid.length) % this.song.grid.length
                : this.fixedRow;

            const drawY = (i - (vScroll % 1)) * cellH + cellH;

            if (actualRow != this.lastRow) {
                const data = this.getChordsToRender(this.song, actualRow);

                // Keep the whole-song chord list intact.
                // Only update the row tracking.
                this.lastRow = actualRow;
            }

            const row = this.song.grid[actualRow];

            if (!row) continue;

            // Global sequential chord index at start of this row
            seqChordIndx = row.cumulChords - 1;

            for (let c = 0; c < this.song.cols; c++) {
                if (actualRow < 0 || actualRow >= this.song.grid.length) continue;

                const barData = row[c];

                // Empty display cell
                if (!barData) continue;

                // Global bar index is based on actual parsed row lengths
                let barGlobalIdx = 0;

                for (let r = 0; r < actualRow; r++) {
                    barGlobalIdx += this.song.grid[r].length;
                }

                barGlobalIdx += c;

                let activeIdx = null;

                // Only highlight bars if we have actually started the song
                if (totalBeatsElapsed >= 0 &&
                    barGlobalIdx === currentBarIndex) {

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

                this.drawBar(
                    ctx,
                    c * cellW,
                    drawY,
                    cellW,
                    cellH,
                    barData,
                    activeIdx
                );

                // --- ROW NAME ---
                const rowName = this.song.rowNames?.[actualRow] || '';
                if (rowName) {
                    ctx.fillStyle = "rgba(120, 120, 255, 0.7)";
                    ctx.font = "20px monospace";
                    ctx.fillText(rowName, 25, drawY + 35);
                }
            }
        }

        if (activeChordSeqIndx != this.lastChordIndx) {
            this.lastChordIndx = activeChordSeqIndx;
            //engine.playChord(this.sequentialChords[activeChordSeqIndx].position);
        }

        ctx.restore();

        // 2. Draw Chord Sheet
        if (this.chordsToRender) {
            if (this.hold) {
                drawSongSheet(
                    ctx,
                    0,
                    this.gridHeight,
                    w,
                    this.sheetHeight,
                    this.chordsToRender,
                    3,
                    3,
                    null
                );
            } else {
                drawSongSheet(
                    ctx,
                    0,
                    this.gridHeight,
                    w,
                    this.sheetHeight,
                    this.sequentialChords,
                    2,
                    2,
                    activeChordSeqIndx,
                    startingChordIndx,
                    chordsInBarCount
                );
            }
        }

        this.drawBeatIndicator(
            ctx,
            w - 18,
            h - 18,
            (totalBeatsElapsed % 1 + 1) % 1
        );

        // 3. --- COUNTDOWN OVERLAY ---
        if (totalBeatsElapsed < 0 && !this.hold) {
            const count = Math.ceil(Math.abs(totalBeatsElapsed));
            const progressInBeat =
                1 - (Math.abs(totalBeatsElapsed) % 1);

            ctx.save();

            ctx.fillStyle =
                `rgba(0, 255, 0, ${0.8 * progressInBeat})`;

            ctx.font = "bold 120px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.fillText(
                count,
                w / 2,
                h / 2
            );

            ctx.restore();
        }

        if (this.hold) {
            KeyboardHelper.draw(engine, this.buttons);
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

            // 2. Draw the Sector Shape
            ctx.beginPath();
            ctx.moveTo(geo.polygon[0].x, geo.polygon[0].y);
            for (let p = 1; p < geo.polygon.length; p++) {
                ctx.lineTo(geo.polygon[p].x, geo.polygon[p].y);
            }
            ctx.closePath();

            // 4. Draw the borders (This creates the internal lines)
            ctx.strokeStyle = "#444"; 
            ctx.lineWidth = 1;
            ctx.stroke();

            if (chord.n === "r") return; // Skip rests
            // 3. Fill only if active (using green highlight)
            if (i === activeIdx) {
                ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
                ctx.fill();
            }


            // Draw Chord Name
            ctx.fillStyle = "#00FF00";
            ctx.font = "bold 18px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(chord.n, geo.text.x, geo.text.y);
        });

        // 6. Draw a clean outer border for the square bar
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    },

    getChordGeometry(x, y, w, h, barChords, index) {
        const midX = x + w / 2;
        const midY = y + h / 2;
        
        // Fit the pie circle neatly inside the bounding box
        const radius = Math.min(w, h) / 2 * 0.95; 

        // --- BASE ANGLE FIX ---
        // Forces the first sector to start visually at 1:30 (Up and Right)
        const baseAngle = -Math.PI / 2 - Math.PI / 4;
        
        // Calculate this chord's starting position in beats
        let startBeats = 0;
        for (let i = 0; i < index; i++) {
            startBeats += barChords[i].b;
        }
        const durationBeats = barChords[index].b;

        // Convert beats to radians (4 beats = a full 2*PI circle)
        const startAngle = baseAngle + (startBeats / 4) * (Math.PI * 2);
        const endAngle = startAngle + (durationBeats / 4) * (Math.PI * 2);

        // --- POLYGON PATH CONSTRUCTION ---
        const poly = [{ x: midX, y: midY }];

        // Approximate the curved edge using straight segments (every 5 degrees)
        const step = (5 * Math.PI) / 180; 
        for (let a = startAngle; a < endAngle; a += step) {
            poly.push({
                x: midX + Math.cos(a) * radius,
                y: midY + Math.sin(a) * radius
            });
        }
        
        // Seal any rounding gaps with the exact end coordinates
        poly.push({
            x: midX + Math.cos(endAngle) * radius,
            y: midY + Math.sin(endAngle) * radius
        });

        // --- GEOMETRIC TEXT POSITIONING ---
        const halfSliceAngle = (endAngle - startAngle) / 2;
        const centerSliceAngle = startAngle + halfSliceAngle;
        
        // Center of gravity scaling factor for a perfect sector placement
        const factor = halfSliceAngle === 0 ? 0.6 : (2 / 3) * (Math.sin(halfSliceAngle) / halfSliceAngle);
        const textRadius = radius * factor * 0.85; 

        const textX = midX + Math.cos(centerSliceAngle) * textRadius;
        const textY = midY + Math.sin(centerSliceAngle) * textRadius;

        return { 
            polygon: poly, 
            text: { x: textX, y: textY } 
        };
    },
    textToSong(text, id = null) {
        const song = {
            id,
            name: '',
            bpm: 120,
            rows: 0,
            cols: 0,
            grid: [],
            rowNames: [],
            chordDB: {}
        };

        let section = '';

        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();

            if (!line || line.startsWith('//'))
                continue;

            const meta = line.match(/^(name|bpm|gridsize)\s*:\s*(.*)$/i);

            if (meta) {
                const key = meta[1].toLowerCase();
                const value = meta[2].trim();

                if (key === 'name') {
                    song.name = value;
                } else if (key === 'bpm') {
                    song.bpm = Number(value);
                } else if (key === 'gridsize') {
                    const match = value.match(/^(\d+)\s*x\s*(\d+)$/i);
                    if (!match)
                        throw new Error(`Invalid gridsize: ${value}`);

                    song.rows = Number(match[1]);
                    song.cols = Number(match[2]);
                }

                continue;
            }

            if (/^grid\s*:/i.test(line)) {
                section = 'grid';
                continue;
            }

            if (/^chords\s*:/i.test(line)) {
                section = 'chords';
                continue;
            }

            if (section === 'grid') {
                const firstBar = line.indexOf('|');

                if (firstBar < 0)
                    throw new Error(`Grid row has no "|": ${line}`);

                song.rowNames.push(line.slice(0, firstBar).trim());
                song.grid.push(
                    this.parseChordGridRow(line.slice(firstBar))
                );
            } else if (section === 'chords') {
                this.parseChordOverride(line, song.chordDB);
            }
        }

        if (!song.rows)
            song.rows = song.grid.length;

        if (!song.cols && song.grid.length)
            song.cols = Math.max(...song.grid.map(row => row.length));

        if (song.grid.length !== song.rows)
            console.warn(
                `ChordGrid: gridsize specifies ${song.rows} rows, ` +
                `but ${song.grid.length} rows were found.`
            );

        song.grid.forEach((row, i) => {
            if (row.length !== song.cols)
                console.warn(
                    `ChordGrid: row ${i + 1} has ${row.length} columns, ` +
                    `expected ${song.cols}.`
                );
        });

        return song;
    },

    resolveChordDurations(chords) {
        if (!chords.length) return;

        const unspecified = chords.filter(chord => chord.b == null);

        const explicitDuration = chords
            .filter(chord => chord.b != null)
            .reduce((sum, chord) => sum + chord.b, 0);

        let remaining = 4 - explicitDuration;

        if (unspecified.length === 0) {
            if (explicitDuration !== 4) {
                console.warn(
                    `Measure duration is ${explicitDuration}, expected 4 beats`
                );
            }
            return;
        }

        const duration = remaining / unspecified.length;

        if (duration <= 0) {
            throw new Error(
                'Chord durations exceed 4 beats in a measure'
            );
        }

        unspecified.forEach(chord => {
            chord.b = duration;
        });
    },
    parseChordGridRow(line) {
        return line
            .split('|')
            .map(s => s.trim())
            .filter(Boolean)
            .map(measureText => {

                const chords = [];

                for (const token of measureText.split(/\s+/)) {
                    let s = token;
                    let beats = null;
                    let variant;

                    // Explicit duration: *2, *1.5, etc.
                    const beatMatch = s.match(/\*(\d+(?:\.\d+)?)$/);

                    if (beatMatch) {
                        beats = Number(beatMatch[1]);
                        s = s.slice(0, beatMatch.index);
                    }

                    // Variant: @1, @2, etc.
                    const variantMatch = s.match(/@(\d+)$/);

                    if (variantMatch) {
                        variant = Number(variantMatch[1]);
                        s = s.slice(0, variantMatch.index);
                    }

                    if (!s) {
                        throw new Error(`Invalid chord: ${token}`);
                    }

                    const chord = { b: beats, n: s };

                    if (variant !== undefined) {
                        chord.v = variant;
                    }

                    chords.push(chord);
                }

                // Resolve missing durations.
                const unspecified = chords.filter(chord => chord.b == null);

                const explicitDuration = chords
                    .filter(chord => chord.b != null)
                    .reduce((sum, chord) => sum + chord.b, 0);

                if (unspecified.length) {
                    const remaining = 4 - explicitDuration;

                    if (remaining <= 0) {
                        throw new Error(
                            `Chord durations exceed 4 beats: ${measureText}`
                        );
                    }

                    const duration = remaining / unspecified.length;

                    unspecified.forEach(chord => {
                        chord.b = duration;
                    });
                } else if (explicitDuration !== 4) {
                    console.warn(
                        `Measure has ${explicitDuration} beats instead of 4: ${measureText}`
                    );
                }

                return { chords };
            });
    },
    parseChordOverride(line, chordDB) {
        const match = line.match(
            /^(.+?)\s*=\s*([^;]+?)(?:\s*;\s*(.*))?$/
        );

        if (!match)
            throw new Error(`Invalid chord definition: ${line}`);

        const name = match[1].trim();
        const frets = match[2].trim().split(',').map(Number);

        if (frets.some(f => !Number.isInteger(f)))
            throw new Error(`Invalid frets for chord "${name}"`);

        const chord = {
            frets,
            barres: [],
            baseFret: 1
        };

        if (match[3]) {
            for (const option of match[3].split(';')) {
                const [key, value] = option.split('=').map(s => s.trim());

                if (key === 'baseFret') {
                    chord.baseFret = Number(value);
                } else if (key === 'numFrets') {
                    chord.numFrets = Number(value);
                } else if (key === 'barres') {
                    chord.barres = value.split(',').map(barre => {
                        const m = barre.match(/^(\d+):(\d+)-(\d+)$/);

                        if (!m)
                            throw new Error(`Invalid barre: ${barre}`);

                        return {
                            fret: Number(m[1]),
                            fromString: Number(m[2]),
                            toString: Number(m[3])
                        };
                    });
                }
            }
        }

        chordDB[name] = chord;
    },

    songToText(song) {
        const lines = [
            `name: ${song.name || ''}`,
            `bpm: ${song.bpm ?? 120}`,
            `gridsize: ${song.rows}x${song.cols}`,
            '',
            'grid:'
        ];

        song.grid.forEach((row, rowIndex) => {
            const rowName = song.rowNames?.[rowIndex] || '';

            const measures = row.map(measure => {
                const chords = (measure.chords || []).map(chord => {
                    let token = chord.n;

                    if (chord.v !== undefined)
                        token += `@${chord.v}`;

                    if (chord.b !== 1)
                        token += `*${chord.b}`;

                    return token;
                });

                return `| ${chords.join(' ')} `;
            });

            lines.push(
                `${rowName.padEnd(8)}${measures.join('|')}|`
            );
        });

        lines.push('', 'chords:');

        for (const [name, chord] of Object.entries(song.chordDB || {})) {
            const options = [];

            if (chord.baseFret !== undefined && chord.baseFret !== 1)
                options.push(`baseFret=${chord.baseFret}`);

            if (chord.numFrets !== undefined)
                options.push(`numFrets=${chord.numFrets}`);

            if (chord.barres?.length) {
                options.push(
                    `barres=${chord.barres.map(b =>
                        `${b.fret}:${b.fromString}-${b.toString}`
                    ).join(',')}`
                );
            }

            lines.push(
                `${name} = ${chord.frets.join(',')}` +
                (options.length ? ` ; ${options.join(' ; ')}` : '')
            );
        }

        return lines.join('\n');
    },

    openEditor() {
        const editor = document.getElementById('tabEditorPanel');
        const textarea = document.getElementById('tabEditorText');

        textarea.value = this.songToText(this.song);
        document.getElementById('tabEditorTitle').textContent =
            `Edit: ${this.song.name || ''}`;

        editor.classList.remove('hidden');
        textarea.focus();
    },

    async applyEditor() {
        const textarea = document.getElementById('tabEditorText');

        try {
            const song = this.textToSong(textarea.value, this.song.id);

            // Replace only after the text has parsed successfully.
            this.song = song;

            // Load all chord diagrams for the new grid.
            await this.loadChords(song);

            this.initGame(this.engine);
            this.hold=false;

        } catch (err) {
            console.error('Error applying ChordGrid:', err);
            this.label = `Error: ${err.message}`;
        }
    },
    cancelEditor() {
        document
            .getElementById("tabEditorPanel")
            .classList.add("hidden");
    }

};
