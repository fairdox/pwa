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

    addFunctionButton(engine, variant, label, x=10, y=270, color="#666",
                      callback=null, width=55, height=40,
                      shape=SHAPE_RECTANGLE, 
                      rotation=0) {
        variant.buttons.push({
                x: x,
                y: y,
                w: width,
                h: height,
                note: label,
                color: color,
                callback,
                shape,
                rotation
            });
    },

    addFunctionKeys(engine, variant){
        const h = engine.canvas.height;
        const w = engine.canvas.width;
        const btnw = 24;
        const btnh = 40;
        const pos = engine.getFretCoordinates(0,11);
        KeyboardHelper.addFunctionButton(engine, variant, "Hints", 5, pos.y+30, "#682",
                                         () => variant.hints(engine),45,30,); 
        KeyboardHelper.addFunctionButton(engine, variant, "Clear", w-5-45, pos.y+30, "#A82",
                                         () => variant.initGame(engine),45,30);

        this.addFunctionButton(engine, variant, "^", 15, h-280, "#682", 
                                         () => variant.incrementRoot(engine,-1), btnw, btnh); 
        this.addFunctionButton(engine, variant, "v", 15, h-280+50, "#682", 
                                         () => variant.incrementRoot(engine,1), btnw, btnh); 
        
        this.addFunctionButton(engine, variant, "^", w-btnw-15, h-280, "#682", 
                                         () => variant.incrementChord(engine,-1), btnw, btnh);
        this.addFunctionButton(engine, variant, "v", w-btnw-15, h-280+50, "#682", 
                                         () => variant.incrementChord(engine,1), btnw, btnh);  
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
                this.drawArrow(ctx, btn.x, btn.y, btn.w, btn.rotation)
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

