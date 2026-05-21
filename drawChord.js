/**
 * Draws a chord diagram on a Canvas context.
 * 
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {string} note - Root note name (e.g., "A").
 * @param {string} chord - Chord quality (e.g., "maj7").
 * @param {Object} position - A single object from the positions array.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Total width.
 * @param {number} h - Total height.
 * @param {number} [startFretArg] - Explicit starting fret.
 * @param {number} [numFretsArg] - Explicit number of frets to display.
 */
function drawChordDiagram(ctx, note, chord, position, highlight, x, y, w, h,
     startFretArg, numFretsArg) {
     // Layout Constants
    const topMargin = h * 0.2;
    const sideMargin = w * 0.12;
    const chartW = w - (sideMargin * 2);
    const chartH = h - topMargin - (h * 0.1);
    const color1 = highlight ? '#A90' : '#888';
    // 1. Draw Title
    ctx.fillStyle = color1;
    ctx.font = `bold ${h * 0.09}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${note} ${chord}`, x + w / 2, y + topMargin * 0.3);

    if (!position) return;
    const numStrings = position.frets.length;
    const displayFrets = numFretsArg || 3;
    const startingFret = startFretArg || position.baseFret;

    const stringGap = chartW / (numStrings - 1);
    const fretGap = chartH / displayFrets;

    // 2. Draw Fretboard Grid
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;

    // Strings
    for (let i = 0; i < numStrings; i++) {
        const currX = x + sideMargin + (i * stringGap);
        ctx.beginPath();
        ctx.moveTo(currX, y + topMargin);
        ctx.lineTo(currX, y + topMargin + chartH);
        ctx.stroke();
    }

    // Frets
    for (let i = 0; i <= displayFrets; i++) {
        const currY = y + topMargin + (i * fretGap);
        ctx.lineWidth = (i === 0 && startingFret === 1) ? 4 : 1; // Nut thickness
        ctx.beginPath();
        ctx.moveTo(x + sideMargin, currY);
        ctx.lineTo(x + sideMargin + chartW, currY);
        ctx.stroke();
    }

    // 3. Draw Starting Fret Number
    if (startingFret > 1) {
        ctx.fillStyle = '#AAA';
        ctx.font = `${fretGap * 0.5}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(startingFret, x + sideMargin - 5, y + topMargin + (fretGap * 0.75));
    }

    // 4. Draw Positions (Fingers)
    position.frets.forEach((fret, stringIdx) => {
        const currX = x + sideMargin + (stringIdx * stringGap);
        
        if (fret === -1) {
            // Muted string (X)
            drawMarker(ctx, currX, y + topMargin - 10, 'X', fretGap * 0.4, color1);
        } else if (fret === 0) {
            // Open string (O)
            drawMarker(ctx, currX, y + topMargin - 10, 'O', fretGap * 0.4, color1);
        } else {
            // Pressed note
            const relativeFret = fret - startingFret;
            if (relativeFret >= 0 && relativeFret < displayFrets) {
                const dotY = y + topMargin + (relativeFret * fretGap) + (fretGap / 2);
                ctx.beginPath();
                ctx.arc(currX, dotY, stringGap * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = color1;
                ctx.fill();
            }
        }
    });

    // 5. Draw Barres
    if (position.barres && position.barres.length > 0) {
        position.barres.forEach(barreFret => {
            const relativeFret = barreFret - startingFret;
            if (relativeFret >= 0 && relativeFret < displayFrets) {
                const barY = y + topMargin + (relativeFret * fretGap) + (fretGap / 2);
                // Find first and last string for the barre
                const barreStrings = position.frets.map((f, i) => f === barreFret ? i : -1).filter(i => i !== -1);
                const startX = x + sideMargin + (Math.min(...barreStrings) * stringGap);
                const endX = x + sideMargin + (Math.max(...barreStrings) * stringGap);

                ctx.beginPath();
                ctx.lineWidth = stringGap * 0.6;
                ctx.lineCap = 'round';
                ctx.moveTo(startX, barY);
                ctx.lineTo(endX, barY);
                ctx.stroke();
            }
        });
    }
}

function drawMarker(ctx, x, y, type, size, color = '#AAA') {
    ctx.fillStyle = color;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(type, x, y);
}

/**
 * Draws a grid of chord diagrams on the canvas.
 * 
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} x - Start X of the sheet area.
 * @param {number} y - Start Y of the sheet area.
 * @param {number} w - Total width of the sheet area.
 * @param {number} h - Total height of the sheet area.
 * @param {Array} chords - Array of objects: { note, chord, position, variant, startFret, numFrets }.
 * @param {number} columns - Number of diagrams per row.
 * @param {number} rows - Number of rows.
 */
function drawSongSheet(ctx, x, y, w, h, chords, columns, rows, activeChordIndx,
        startIndx, maxChordsToShow) {
    // Calculate dimensions for each individual diagram slot
    const cellW = w / columns;
    const cellH = h / rows;
    const chordsToShow = maxChordsToShow || chords.length;
    // Determine how many diagrams we can actually fit
    const maxChords = columns * rows;
    const count = Math.min(chordsToShow, maxChords);
    startIndx = startIndx === undefined ? 0 : startIndx;
    for (let indx = startIndx; indx < startIndx+count; indx++) {
        const item = chords[indx];
        const highlight = indx === activeChordIndx;
        
        // Calculate grid position
        const i=indx - startIndx; // Relative index for grid placement
        const col = i % columns;
        const row = Math.floor(i / columns);
        
        // Calculate the bounding box for this specific diagram
        const posX = x + (col * cellW);
        const posY = y + (row * cellH);
        
        // Add a small internal padding so diagrams don't touch
        const padding = cellW * 0.00; 
        const drawX = posX + padding;
        const drawY = posY + padding;
        const drawW = cellW - (padding * 2);
        const drawH = cellH - (padding * 2);

        // Call the previously defined helper
        // Passing arguments based on the chord object structure
        drawChordDiagram(
            ctx,
            item.note,
            item.chord,
            item.position, // The specific position object from your MIDI/Fret data
            highlight,
            drawX,
            drawY,
            drawW,
            drawH,
            item.startFret, // Optional: starting fret override
            item.numFrets   // Optional: number of frets override
        );
    }
}

