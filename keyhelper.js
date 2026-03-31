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
                color: "#bbb",
                toggleState: null,
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
                color: "#333",
                toggleState: null,
            });
        });
    },

    addFunctionButton(engine, variant, label, x=10, y=270, color="#666",
                      callback=null, width=55, height=40, toggleState=null) {
        const newButton = {
            x: x,
            y: y,
            w: width,
            h: height,
            note: label,
            color: color,
            callback,
            toggleState,
            clickTime: null,
            hidden: false,
        };
    
        variant.buttons.push(newButton);
        return newButton;
    },
    
    updateButtonAttribute(button, attributes) {
        if (button && typeof attributes === 'object') {
            Object.assign(button, attributes);
        }
    },

    addArrowKeys(engine, variant, options = {}) {
        const { 
            x = engine.canvas.width / 2, 
            y = 18, 
            color = "green", 
            size = 24, 
            horizontal = false,    // arrows on the same y with label in between
            btnw = 25,
            btnh = 43,
            vgap = 5,
            hgap = 10,
            labelWidth = 200,
            labelHeight = 30,
            fct1 = null,
            fct2 = null,
        } = options;
        
        const h = engine.canvas.height;
        const w = engine.canvas.width;
        let x1=0,x2=0;xlbl=0;
        let y1=0,y2=0;ylbl=0;
        if (horizontal){
            x1=x-hgap-(labelWidth/2)-btnw;
            x2=x+hgap+(labelWidth/2)+hgap;
            y1=y;
            y2=y;
            xlbl=x;
            ylbl=y1+(labelHeight/2);
        }else{
            x1=x;
            x2=x1;
            y1=y;
            y2=y+btnh+vgap+labelHeight+vgap;
            xlbl=x+(btnw/2);
            ylbl=y1+btnh+vgap+(labelHeight/2);
        }

        this.addFunctionButton(engine, variant, "^", x1, y1, "#555", fct1, btnw, btnh); 
        const label=engine.addLabel("xxxxxx",
                    { color:"#999", duration: -1, size:20, x:xlbl, y:ylbl});
        
        this.addFunctionButton(engine, variant, "v", x2, y2, "#555", fct2, btnw, btnh); 

        return {label};
    },

    addFunctionKeys(engine, variant){
        const btnw = 25;
        const h = engine.canvas.height;
        const w = engine.canvas.width;
 
        const labelWidth = 60;
        let pos = engine.getFretCoordinates(0,11);

        const btnopt1=KeyboardHelper.addFunctionButton(engine, variant, "1|A", 5, pos.y+30, "#682",
                                         null,45,30,false);
        btnopt1.hidden=true;
        
        pos = engine.getFretCoordinates(0,9);
        const btnopt2=KeyboardHelper.addFunctionButton(engine, variant, "Hints", 5, pos.y+30, "#682",
                                         () => variant.hints(engine),45,30,false); 
        pos = engine.getFretCoordinates(0,9);
        const btnopt3=KeyboardHelper.addFunctionButton(engine, variant, "Clear", w-5-45, pos.y+30, "#A82",
                                         () => variant.initGame(engine),45,30);

        pos = engine.getFretCoordinates(0,5);
        const arrowsA=KeyboardHelper.addArrowKeys(engine,variant,
                                    {x:15, y:pos.y, btnw: btnw,
                                     fct1: ()=>  variant.incrementRoot(engine,+1),
                                     fct2: ()=>  variant.incrementRoot(engine,-1),
                                    });
        const label1 = arrowsA.label;
            
        const arrowsB=KeyboardHelper.addArrowKeys(engine,variant,
                                    {x:w-btnw-15, y:pos.y, btnw: btnw,
                                     fct1: ()=>  variant.incrementChord(engine,-1),
                                     fct2: ()=>  variant.incrementChord(engine,+1),
                                    });
        const label2 = arrowsB.label;
        return {btnopt1,btnopt2,label1 ,label2};
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
        const btn= buttons.find(b => x >= b.x && x <= (b.x + b.w) && y >= b.y && y <= (b.y + b.h) && !b.hidden);
        if (btn){
            btn.clickTime=Date.now();
            if (btn.toggleState!==null){
                btn.toggleState = !btn.toggleState;
            }
            if (btn.callback && typeof btn.callback === 'function') {
                btn.callback();
                return null;
            }
        }
        return btn;
    },

    // Standard rendering loop
    draw(ctx, buttons) {
        buttons.forEach(btn => {
            if (btn.hidden) return; 
            const isPressed = btn.clickTime && (Date.now() - btn.clickTime) < 100;
            
            // 1. Calculate displacement
            const offset = isPressed ? 3 : 0; // Moves the button 3px down when clicked
            const bx = btn.x;
            const by = btn.y + offset;
    
            // 2. Draw Shadow (only when NOT pressed)
            if (!isPressed) {
                ctx.fillStyle = "rgba(0,0,0,0.4)";
                this.roundRect(ctx, bx, by + 4, btn.w, btn.h, 8); // Subtle drop shadow
            }
    
            // 3. Draw Main Button Body
            ctx.fillStyle = isPressed ? "#222" : btn.color; // Darken slightly if pressed
            if (btn.toggleState!==null){
                ctx.fillStyle = btn.toggleState ? btn.color : "#555";
            }
            ctx.strokeStyle = isPressed ? "#444" : "#999";
            this.roundRect(ctx, bx, by, btn.w, btn.h, 8);
    
            // 4. Draw Text with Offset
            ctx.fillStyle = isPressed ? "white" : (btn.color === "#333" ? "white" : "black");
            ctx.font = "bold 16px sans-serif";
            ctx.textAlign = "center";
            
            // Center the text + the offset so the label "sinks" with the button
            ctx.fillText(btn.note, bx + btn.w/2, by + btn.h/2 + 6);
    
            // 5. Cleanup click state
            if (btn.clickTime && (Date.now() - btn.clickTime) >= 100) {
                btn.clickTime = null;
            }
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

};

