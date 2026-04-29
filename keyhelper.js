const KeyboardHelper = {
    getNoteLabel(idx, mode = "SHARP") {
        const naming = {
            SHARP:   NOTES,
            FLAT:    FLAT_NAMES,
        };
        return naming[mode] ? naming[mode][idx % 12] : naming["SHARP"][idx % 12];
    },
    // Generate the two-row layout
    initButtons(engine, variant, id = 101, namingMode = "SHARP") {
        if (!variant.buttons) variant.buttons = [];
        const { width: w, height: h } = engine.canvas;
        const { btnW: bw, btnH: bh, btnGap: gap, scale, keybfntsize } = engine.uiprop;

        const totalWhiteKeys = 7;
        const whiteRowWidth = (totalWhiteKeys * bw) + ((totalWhiteKeys - 1) * gap);
        const startXWhite = (w - whiteRowWidth) / 2;
        const startYWhite = h - (scale * 70) - bh;
        const startYBlack = startYWhite - (bh + gap);

        // White Keys: [Index, NoteLabel]
        const whiteKeysData = [
            { idx: 0, label: "C" }, { idx: 2, label: "D" }, { idx: 4, label: "E" },
            { idx: 5, label: "F" }, { idx: 7, label: "G" }, { idx: 9, label: "A" }, { idx: 11, label: "B" }
        ];

        whiteKeysData.forEach((key, i) => {
            variant.buttons.push({
                x: startXWhite + i * (bw + gap),
                y: startYWhite,
                w: bw, h: bh,
                noteIdx: key.idx,
                note: this.getNoteLabel(key.idx, namingMode),
                color: "#aaa",
                fntSize: keybfntsize,
                hidden: false,
                id: id
            });
        });

        // Black Keys: [Index, SlotPosition]
        const blackKeysData = [
            { idx: 1, slot: 0.5 }, { idx: 3, slot: 1.5 }, { idx: 6, slot: 3.5 },
            { idx: 8, slot: 4.5 }, { idx: 10, slot: 5.5 }
        ];

        blackKeysData.forEach(bk => {
            variant.buttons.push({
                x: startXWhite + bk.slot * (bw + gap),
                y: startYBlack,
                w: bw, h: bh,
                noteIdx: bk.idx,
                note: this.getNoteLabel(bk.idx, namingMode),
                color: "#333",
                fntSize: keybfntsize,
                hidden: false,
                id: id
            });
        });
    },

    updateButtonLabels(variant, mode) {
        variant.buttons.forEach(btn => {
            if (btn.noteIdx !== undefined) {
                btn.note = this.getNoteLabel(btn.noteIdx, mode);
            }
        });
    },

    addFunctionButton(engine, variant, label, x = 0, y = 0, color = "#666",
        callback = null, toggleState = null, width, height, fntSize) {
        const uiprop = engine.uiprop;
        const newButton = {
            x: x,
            y: y,
            w: width === undefined ? uiprop.fctbtnW : width,
            h: height === undefined ? uiprop.fctbtnH : height,
            note: label,
            color: color,
            callback,
            toggleState,
            clickTime: null,
            hidden: false,
            fntSize: fntSize === undefined ? engine.uiprop.fctfntsize : fntSize,
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
        const uiprop = engine.uiprop;
        const {
            x = engine.canvas.width / 2,
            y = 18,
            color = "green",
            size = 24,
            horizontal = false,    // arrows on the same y with label in between
            btnw = uiprop.arrowbtnw,
            btnh = uiprop.arrowbtnh,
            vgap = uiprop.arrowvgap,
            hgap = uiprop.arrowhgap,
            labelWidth = 200,
            labelHeight = 30,
            fct1 = null,
            fct2 = null,
        } = options;

        const h = engine.canvas.height;
        const w = engine.canvas.width;
        let x1 = 0, x2 = 0; xlbl = 0;
        let y1 = 0, y2 = 0; ylbl = 0;
        if (horizontal) {
            x1 = x - hgap - (labelWidth / 2) - btnw;
            x2 = x + hgap + (labelWidth / 2) + hgap;
            y1 = y;
            y2 = y;
            xlbl = x;
            ylbl = y1 + (labelHeight / 2);
        } else {
            x1 = x;
            x2 = x1;
            y1 = y;
            y2 = y + btnh + vgap + labelHeight + vgap;
            xlbl = x + (btnw / 2);
            ylbl = y1 + btnh + vgap + (labelHeight / 2);
        }

        const up = this.addFunctionButton(engine, variant, "^", x1, y1, "#555", fct1, null, btnw, btnh);
        const label = engine.addLabel("xxxxxx",
            { color: "#999", duration: -1, size: uiprop.arrowfntsize, x: xlbl, y: ylbl });

        const down = this.addFunctionButton(engine, variant, "v", x2, y2, "#555", fct2, null, btnw, btnh);

        return { up, label, down };
    },

    addOptionKey(engine, variant, fretnum, text, leftSide = false) {
        const w = engine.canvas.width;
        const pos = engine.getFretCoordinates(0, fretnum);
        const pad = engine.uiprop.sidePadding;
        const btnw = engine.uiprop.arrowbtnw;
        const optbtnw = engine.uiprop.optbtnW;
        const optbtnh = engine.uiprop.optbtnH;
        const lpad = pad;
        const rpad = pad + optbtnw;
        const btn = KeyboardHelper.addFunctionButton(engine, variant, text,
            leftSide ? lpad : w - rpad,
            pos.y, "#682",
            null, false, optbtnw, optbtnh);
        return btn;
    },


    addFunctionKeys(engine, variant, arrows=true){
        const h = engine.canvas.height;
        const w = engine.canvas.width;
 
        const labelWidth = 60;
        const pad = engine.uiprop.sidePadding;
        const btnw = engine.uiprop.arrowbtnw;
        const optbtnw = engine.uiprop.optbtnW;
        const optbtnh = engine.uiprop.optbtnH;
        const lpad = pad ;
        const rpad = pad + optbtnw;
      
        let pos = engine.getFretCoordinates(0,1);
        const btnHint=KeyboardHelper.addFunctionButton(engine, variant, "✨", lpad, pos.y, "#682",
                                         () => variant.hints(engine),false,optbtnw,optbtnh); // hint button
        const btnClear=KeyboardHelper.addFunctionButton(engine, variant, "✕", w-rpad, pos.y, "#A82",
                                         () => variant.initGame(engine),null,optbtnw,optbtnh); // clear button

        pos = engine.getFretCoordinates(0,2);
        const btnopt=KeyboardHelper.addFunctionButton(engine, variant, "1|A", lpad, pos.y, "#682",
                                         null,false);
        btnopt.hidden=true;

        if (arrows){
            pos = engine.getFretCoordinates(0,6);
            const arrowsL=KeyboardHelper.addArrowKeys(engine,variant,
                                        {x:pad, y:pos.y, 
                                         fct1: ()=>  variant.incrementRoot(engine,+1),
                                         fct2: ()=>  variant.incrementRoot(engine,-1),
                                        });
                
            const arrowsR=KeyboardHelper.addArrowKeys(engine,variant,
                                        {x:w-pad-btnw, y:pos.y, 
                                         fct1: ()=>  variant.incrementChord(engine,-1),
                                         fct2: ()=>  variant.incrementChord(engine,+1),
                                        });
            return {btnopt,btnHint,btnClear,arrowsL, arrowsR};
        }
        return {btnopt,btnHint,btnClear};
    },

    initDynamicMasterPalette(engine, variant, id=202) {
        if (!variant.buttons) variant.buttons = [];
        const uiprop = engine.uiprop;
        const btnW = uiprop.btnW,
            btnH = uiprop.btnH,
            gap = uiprop.btnGap;

        const cols = 5;
        
        // Get all unique intervals from your specific CHORD_FORMULAS array
        const masterList = getUniqueIntervals(CHORD_FORMULAS);
        const rows=Math.ceil(masterList.length/cols) ;
        const totalW = (cols * btnW) + ((cols - 1) * gap);
        const totalH = (rows * btnH) + (rows*gap)  ; 
        const startX = (engine.canvas.width - totalW) / 2;
        const startY = engine.canvas.height - totalH ; // Move up if list gets long
    
        masterList.forEach((interval, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Visual logic: highlight intervals that are in the CURRENT chord
            const isInCurrentChord = variant.formula ? variant.formula.includes(interval): false;
            
            variant.buttons.push({
                x: startX + col * (btnW + gap),
                y: startY + row * (btnH + gap),
                w: btnW,
                h: btnH,
                note: interval,
                // If it's in the chord, give it a subtle border or different shade
                color: interval === "1" ? "#cc0000" : (isInCurrentChord ? "#666" : "#333"),
                borderColor: isInCurrentChord ? "gold" : "transparent",
                hidden: false,
                id: id

            });
        });
    },

    showGroupedChordSelector(variant, grpid){
        variant.buttons.forEach(btn => {
            if (btn.group ){
                if (btn.group.startsWith(grpid)){
                    btn.hidden=false;
                } else {
                    if (!btn.callback) btn.hidden=true;
                }
            } 
        });
    },

    updateChordVariantButtons(variant, curChordVariant, maxChordVariants=5){
        variant.buttons.forEach(btn => {
            if (btn.chordVariant !== undefined){
                if (btn.chordVariant>maxChordVariants-1){
                    btn.hidden=true;
                } else {
                    btn.hidden=false;
                }
                if (btn.chordVariant===curChordVariant){
                    btn.toggleState=true;
                } else {
                    btn.toggleState=false;
                }
            }
        });
    },

    initChordSelectorPalette(engine, variant, id = 203) {
        if (!variant.buttons) variant.buttons = [];
        const h = engine.canvas.height;
        const w = engine.canvas.width;
        const pad = engine.uiprop.sidePadding;
        const scale = engine.uiprop.scale;
        const optbtnw = engine.uiprop.optbtnW;
        const optbtnh = engine.uiprop.optbtnH;
        const lpad = pad ;
        const rpad = pad ;
        const uiprop = engine.uiprop;
        const btnW = 40*scale,
              btnH = 20*scale,
              chordBtnW = 50*scale,
              chordBtnH = 20*scale,
              gap = uiprop.btnGap;

        const maxcols = 6;
        const maxrows = 3;
        
        const totalW = (maxcols * chordBtnW) + ((maxcols-1) * gap);
        const totalH = (maxrows * chordBtnH) + ((maxrows - 1) * gap);
                
        const startX = (w - totalW) / 2;
        const startY = (h - totalH - 15*scale);
        const pos = engine.getFretCoordinates(0,5);


        // Right column: Voicing Variants buttons (v0, v1, v2...)
        for ( let i=0; i<=4; i++){
            variant.buttons.push({
                x: w-optbtnw-rpad,
                y: pos.y + i * (optbtnh + gap),
                w: optbtnw,
                h: optbtnh,
                toggleState: false,
                toggleGroup: "chordVariant", // identify this toggle group, only one can be active at a time
                note: `v${i+1}`,
                chordVariant: i,
                color: "#380",
                hidden: false,
                selected: false,
                toggleTrueCallback: () => engine.setVoicingVariant(i),
                toggleFalseCallback: () => engine.setVoicingVariant(null), 
                id: id
            });
        };

        const chordGroups = ["Min", "Maj", "Dom", "Other", "Recent"]; 
        chordGroups.forEach((group,i)    => {
            variant.buttons.push({
                x: lpad ,
                y: pos.y + i * (btnH + gap),
                w: btnW,
                h: btnH,
                toggleState: false,
                toggleGroup: "chordGroup",
                note: group,
                group: `${i}`,
                color: "#380",
                hidden: false,
                callback: () => this.showGroupedChordSelector(variant, `${i+1}`),
                id: id
            });
        });

        let firstBtn = null;
        let ci = 0;
        CHORD_FORMULAS.forEach((chord, i) => {
            const col = ci % maxcols;
            const row = Math.floor(ci / maxcols);
            ci++;
            variant.buttons.push({
                x: startX + col * (chordBtnW + gap),
                y: startY + row * (chordBtnH + gap),
                w: chordBtnW,
                h: chordBtnH,
                note: chord.suffix,
                group: chord.group,
                suffix: chord.suffix,
                toggleState: null,
                color: "#888",
                formula: chord.formula,
                semitones: chord.semitones,
                fullLabel: chord.label,
                chordIdx: i,
                hidden: false,
                fntSize: engine.uiprop.keybfntsize*.9,
                isSelected: false,
                id: id
            });
            if (i===0) {
                firstBtn=variant.buttons[variant.buttons.length-1];
                lastGroupe=chord.group.charAt(0);
            }
            if (chord.group.charAt(0) !== lastGroupe){
                ci=0;
                lastGroupe=chord.group.charAt(0);
            }
            
        });
        return firstBtn;
    },
    
    hideButtons(variant, id) {
        const btns = variant.buttons.filter(b => b.id === id);
        btns.forEach(btn => {
            btn.hidden = true;
        });
    },
    showButtons(variant, id) {
        const btns = variant.buttons.filter(b => b.id === id);
        btns.forEach(btn => {
            btn.hidden = false;
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
                if (btn.toggleGroup!==undefined && btn.toggleState===true){
                    // If this button is part of a toggle group, we need to turn off all other buttons in the same group
                    buttons.forEach(b => {
                        if (b.toggleGroup === btn.toggleGroup && b !== btn) {
                            b.toggleState = false;
                        }
                    });
                }
                if (btn.toggleState && btn.toggleTrueCallback && typeof btn.toggleTrueCallback === 'function') {
                    btn.toggleTrueCallback();
                    return null;
                }
                if (!btn.toggleState && btn.toggleFalseCallback && typeof btn.toggleFalseCallback === 'function') {
                    btn.toggleFalseCallback();
                    return null;
                }
            }
            if (btn.callback && typeof btn.callback === 'function') {
                btn.callback();
                return null;
            }
        }
        return btn;
    },

    // Standard rendering loop
    draw(engine, buttons) {
        const ctx=engine.ctx; 
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
            //ctx.fillStyle = isPressed ? "#222" : btn.color; // Darken slightly if pressed
            if (isPressed){
                ctx.fillStyle = "#222";
            }else{
                if (btn?.isSelected){
                    ctx.fillStyle = "#8444bb";
                } else{
                    ctx.fillStyle = btn.color;
                }
            }
            if (btn.toggleState!==null){
                ctx.fillStyle = btn.toggleState ? btn.color : "#555";
            }
            ctx.strokeStyle = isPressed ? "#444" : "#999";
            this.roundRect(ctx, bx, by, btn.w, btn.h, 8);
    

            // 4. Draw Text with Offset
            ctx.fillStyle = isPressed ? "white" : (btn.color === "#333" ? "white" : "black");

            ctx.textAlign = "center";
            ctx.font = `bold ${btn.fntSize}px sans-serif`;
            
            // Center the text + the offset so the label "sinks" with the button
            ctx.fillText(btn.note, bx + btn.w/2, by + btn.h/2 );
    
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

