
const TabPlayerVariant = {
    label: "",
    statKey: "Ta",
    wideCanvas: true,    

    DEFAULTS: {
        previewMode: "slide", // "slide", "falling", "ghost", "none"
        leadBeats: 1.5,
        fallDistanceFrets: 0.5,
        slideDistanceFrets: 4,
        lookAheadCount: 3,
        strumDelay: 0.018
    },

    init(engine) {
        engine.resize();
        this.initSettings(engine);
        this.initButtons(engine);

        this.currentSectionIdx = 0;
        this.currentMeasureIdx = 0;
        this.showAllMeasures = true;
        this.loadTab(engine, "Do it again (sitar)").catch(err => {
            console.error("Error loading tab:", err);
            this.label = "Error loading tab.";
        })
    },

    initSettings(engine) {
        this.fallLeadBeats = this.DEFAULTS.leadBeats;
        this.slideLeadBeats = this.DEFAULTS.leadBeats;
        this.fallDistanceFrets = this.DEFAULTS.fallDistanceFrets;
        this.slideDistanceFrets = this.DEFAULTS.slideDistanceFrets;
        this.previewMode = this.DEFAULTS.previewMode;
        this.playbackPreRoll = true;
        this.buttons = [];

        restoreVariantState(this);
        KeyboardHelper.addFunctionKeys(engine, this, false);
    },

    async loadTab(engine, tabName) {
        this.label=`Loading "${tabName}"...`;
        const tab = await dbService.getTabByName(tabName);
        if (!tab) {
            this.label = `"${tabName}" not found.`;
        } else {
            this.song = this.parseVTab(tab.tabs);
            this.playRange = this.createDefaultPlayRange(this.song);
            this.label = `Loaded "${tabName}".`;
            this.tabName = tabName;
            if (this.state.tabName !== tabName) 
                this.state=null;
            else{
                this.playRange = this.state.playRangeOverride || this.playRange;
                this.song.bpm = this.state.bpmOverride || this.song.bpm;
            }
            this.initGame(engine);}
    },

    initButtons(engine) {
        const pad = engine.uiprop.sidePadding;
        const scale = engine.uiprop.scale;
        let pos = engine.getFretCoordinates(0, 3);
        const w = engine.layoutWidth;

        let kobj=KeyboardHelper.addArrowKeys(engine,this,
                                    {x:pad, y: pos.y+40,
                                     btnh: scale*40, btnw: scale*40, vgap: 60,
                                     fct1: ()=>  this.incrementSectionStart(engine,-1),
                                     fct2: ()=>  this.incrementSectionStart(engine,+1),
                                    });
        this.sectionStartLabel = kobj.label;

        kobj=KeyboardHelper.addArrowKeys(engine,this,
                                    {x:pad, y: pos.y+80,
                                     btnh: scale*40, btnw: scale*20, vgap: 10,
                                     fct1: ()=>  this.incrementBarStart(engine,-1),
                                     fct2: ()=>  this.incrementBarStart(engine,+1),
                                    });
        this.barStartLabel = kobj.label;

        kobj=KeyboardHelper.addArrowKeys(engine,this,
                                    {x:w-pad-40, y: pos.y+40,
                                     btnh: scale*40, btnw: scale*40, vgap: 60,
                                     fct1: ()=>  this.incrementSectionEnd(engine,-1),
                                     fct2: ()=>  this.incrementSectionEnd(engine,+1),
                                    });
        this.sectionEndLabel = kobj.label;
        kobj=KeyboardHelper.addArrowKeys(engine,this,
                                    {x:w-pad-40, y: pos.y+80,
                                     btnh: scale*40, btnw: scale*20, vgap: 10,
                                     fct1: ()=>  this.incrementBarEnd(engine,-1),
                                     fct2: ()=>  this.incrementBarEnd(engine,+1),
                                    });
        this.barEndLabel = kobj.label;
        this.playBtn = KeyboardHelper.addFunctionButton(
            engine,
            this,
            "🔊",
            pad,
            pos.y,
            "#484",
            () => this.unlockAudio(engine),
            null,
            scale * 35,
            scale * 35,
            19
        );

        pos = engine.getFretCoordinates(0, 10);
        kobj=KeyboardHelper.addArrowKeys(engine,this,
                                    {x:pad, y: pos.y,
                                     btnh: scale*30, btnw: scale*30, vgap: 10,
                                     fct1: ()=>  this.incrementSpeed(engine,-0.1),
                                     fct2: ()=>  this.incrementSpeed(engine,+0.1),
                                    });
        this.bpmLabel = kobj.label;                                    
    },

    createDefaultPlayRange(song) {
        return {
            startSection: 0,
            startBar: 0,
            endSection: 0,
            endBar: song.sections[0]?.measures.length - 1 ?? 0
        };
    },

    unlockAudio(engine) {
        if (engine.audioUnlocked) return;
        engine.audio.resume();
        engine.audioUnlocked = true;
    },

    playFretboard(engine) {
        this.unlockAudio(engine);
    },

    playTabs(engine) {
        this.unlockAudio(engine);
    },

    initGame(engine) {
        this.skipSavingTaps = true;
        this.skipHeatMap = true;
        this.isPlaying = true;
        this.pauseElapsedTime = 0;
        this.sectionStartTime = null;
        this.lastPlayedSequence = -1;

        engine.history = [];
        engine.tappedKeys.clear();
        engine.score = 0;

        this.preparePlayback(engine);
        this.bpmLabel.text = `BPM:${Math.round(this.song.bpm)}`;
        this.state = {
            tabName: this.tabName,
            playRangeOverride: this.playRange,
            bpmOverride: this.song.bpm,
        }
    },

    incrementSectionStart(engine, inc) { // used for sections
        if (!inc) return;

        const sectionCount = this.song.sections.length;
        const startSection = this.clamp(this.playRange.startSection + inc, 0, sectionCount - 1);
        this.playRange.startSection = startSection;
        this.playRange.startBar = this.clamp(
            this.playRange.startBar,
            0,
            this.getLastBarIndex(startSection)
        );
        this.normalizePlayRange();
        this.initGame(engine);
    },

    incrementSectionEnd(engine, inc) { // used for sections
        if (!inc) return;

        const sectionCount = this.song.sections.length;
        const endSection = this.clamp(this.playRange.endSection + inc, this.playRange.startSection, sectionCount - 1);
        this.playRange.endSection = endSection;
        this.playRange.endBar = this.getLastBarIndex(endSection)
        this.normalizePlayRange();
        this.initGame(engine);
    },

    incrementBarStart(engine, inc) { // used for measures
        if (!inc) return;
        this.moveRangeStart(inc);
        this.normalizePlayRange();
        this.initGame(engine);
    },
    incrementBarEnd(engine, inc) { // used for measures
        if (!inc) return;
        this.moveRangeEnd(inc);
        this.normalizePlayRange();
        this.initGame(engine);
    },

    incrementSpeed(engine, inc) {
        if (!inc) return;
        const newBpm = this.clamp(this.song.bpm * (1+inc), 20, 300);
        this.song.bpm = newBpm;
        this.initGame(engine);
    },

    moveRangeStart(delta) {
        let sectionIndex = this.playRange.startSection;
        let barIndex = this.playRange.startBar + delta;
        this.playRange.startBar = this.clamp(barIndex, 0, this.getLastBarIndex(sectionIndex));
    },

    moveRangeEnd(delta) {
        let sectionIndex = this.playRange.endSection;
        let barIndex = this.playRange.endBar + delta;
        this.playRange.endBar = this.clamp(barIndex, 0, this.getLastBarIndex(sectionIndex));
    },

    normalizePlayRange() {
        const start = this.getAbsoluteBarIndex(this.playRange.startSection, this.playRange.startBar);
        const end = this.getAbsoluteBarIndex(this.playRange.endSection, this.playRange.endBar);

        if (start <= end) return;

        this.playRange.endSection = this.playRange.startSection;
        this.playRange.endBar = this.playRange.startBar;
    },

    getLastBarIndex(sectionIndex) {
        return Math.max(0, (this.song.sections[sectionIndex]?.measures.length ?? 1) - 1);
    },

    getAbsoluteBarIndex(sectionIndex, barIndex) {
        let absoluteIndex = 0;

        for (let i = 0; i < sectionIndex; i++) {
            absoluteIndex += this.song.sections[i].measures.length;
        }

        return absoluteIndex + barIndex;
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    preparePlayback(engine) {
        const secondsPerBeat = 60 / this.song.bpm;
        const range = this.getPlaybackRange(this.song);

        this.playbackSteps = [];
        this.playbackDuration = 0;

        let sequence = 1;
        let time = 0;

        this.song.sections.forEach((section, sectionIndex) => {
            section.measures.forEach((measure, barIndex) => {
                if (!this.isMeasureInPlaybackRange(sectionIndex, barIndex, range)) return;

                const barStartTime = time;
                const barNumber = measure.barNumber ?? barIndex + 1;

                measure.forEach(stepNotes => {
                    const duration = this.getStepDurationSeconds(stepNotes, secondsPerBeat);
                    const notes = this.prepareStepNotes(
                        engine,
                        stepNotes,
                        sequence,
                        time,
                        duration,
                        sectionIndex,
                        barIndex,
                        barNumber,
                        barStartTime
                    );

                    if (notes.length) {
                        this.playbackSteps.push({
                            sequence,
                            startTime: time,
                            endTime: time + duration,
                            sectionIndex,
                            barIndex,
                            barNumber,
                            barStartTime,
                            notes
                        });
                        sequence++;
                    }

                    time += duration;
                });
            });
        });

        this.playbackDuration = time;
    },

    prepareStepNotes(engine, stepNotes, sequence, startTime, duration, sectionIndex, barIndex, barNumber, barStartTime) {
        return stepNotes
            .filter(note => !note.isRest)
            .map(note => {
                const coords = engine.getFretCoordinates(
                    note.stringIdx,
                    note.fret === "X" ? 0 : note.fret
                );

                return {
                    ...note,
                    x: coords.x,
                    y: coords.y,
                    sequence,
                    startTime,
                    endTime: startTime + duration,
                    visibleEndTime: startTime + duration,
                    sectionIndex,
                    barIndex,
                    barNumber,
                    barStartTime
                };
            });
    },

    getPlaybackRange(song) {
        const r = this.playRange || {};
        const startSection = this.clamp(r.startSection ?? 0, 0, song.sections.length - 1);
        const endSection = this.clamp(r.endSection ?? startSection, startSection, song.sections.length - 1);
        const startBar = this.clamp(r.startBar ?? 0, 0, this.getLastBarIndex(startSection));
        const endBar = this.clamp(r.endBar ?? this.getLastBarIndex(endSection), 0, this.getLastBarIndex(endSection));

        return { startSection, startBar, endSection, endBar };
    },

    isMeasureInPlaybackRange(sectionIndex, barIndex, range) {
        if (sectionIndex < range.startSection || sectionIndex > range.endSection) return false;
        if (sectionIndex === range.startSection && barIndex < range.startBar) return false;
        if (sectionIndex === range.endSection && barIndex > range.endBar) return false;
        return true;
    },

    getStepDurationSeconds(stepNotes, secondsPerBeat) {
        return this.getDurationBeats(stepNotes[0]?.durationObj) * secondsPerBeat;
    },

    getDurationBeats(durationObj) {
        if (!durationObj) return 1;

        let beats = 4 / durationObj.baseNum;

        if (durationObj.isDotted) beats *= 1.5;
        if (durationObj.doubleDotted) beats *= 1.75;
        if (durationObj.isTriplet) beats *= 2 / 3;

        return beats;
    },

    validateSectionTiming(section, meter) {
        const expectedBeats = this.getMeterBeats(meter);

        section.measures.forEach(measure => {
            const totalBeats = measure.reduce((sum, stepNotes) => {
                return sum + this.getDurationBeats(stepNotes[0]?.durationObj);
            }, 0);

            if (Math.abs(totalBeats - expectedBeats) > 0.01) {
                console.warn(
                    `[Tab Validation Error] Bar ${measure.barNumber ?? "?"} has incorrect duration: ` +
                    `expected ${expectedBeats}, found ${totalBeats.toFixed(2)}`
                );
            }
        });
    },

    getMeterBeats(meter) {
        const [top] = String(meter || "4/4").split("/").map(Number);
        return Number.isFinite(top) && top > 0 ? top : 4;
    },

    onTap(engine, sIdx, f, name, x, y) {
        const { btn, processed } = KeyboardHelper.checkClick(this.buttons, x, y);
        if (btn && processed) return;

        this.isPlaying = !this.isPlaying;

        if (!this.isPlaying) {
            const now = performance.now() / 1000;
            this.pauseElapsedTime = now - this.sectionStartTime;
        } else {
            const now = performance.now() / 1000;
            this.sectionStartTime = now - this.pauseElapsedTime;
        }
    },

    render(engine) {
        KeyboardHelper.draw(engine, this.buttons);

        if (!this.playbackSteps?.length || !this.song?.sections?.length) return;

        const now = performance.now() / 1000;
        const nodeSize = engine.uiprop?.drawNodeSize || 10;
        const leadSeconds = this.getLeadSeconds();
        let elapsedTime = this.updatePlaybackClock(now, leadSeconds);
        const playbackState = this.getPlaybackState(this.playbackSteps, elapsedTime);

        if (elapsedTime >= 0) {
            this.playCurrentStepIfNeeded(engine, playbackState.currentSequence);
        }
        this.drawNotes(engine, this.playbackSteps, elapsedTime, playbackState, nodeSize);
        this.drawMetronome(engine, elapsedTime, playbackState);
        this.drawBarLabel(engine, playbackState.activeSectionIndex, playbackState.activeBarNumber);
    },

    getLeadSeconds() {
        if (!["falling", "slide"].includes(this.previewMode)) return 0;
        return (this.fallLeadBeats || this.DEFAULTS.leadBeats) * (60 / this.song.bpm);
    },

    updatePlaybackClock(now, leadSeconds) {
        if (this.sectionStartTime == null) {
            this.sectionStartTime = now + leadSeconds;
        }

        if (!this.isPlaying) return this.pauseElapsedTime || 0;

        let elapsedTime = now - this.sectionStartTime;

        if (elapsedTime >= this.playbackDuration) {
            this.sectionStartTime = now + leadSeconds;
            this.lastPlayedSequence = -1;
            elapsedTime = now - this.sectionStartTime;
        }

        return elapsedTime;
    },

    getPlaybackState(playbackSteps, elapsedTime) {
        const firstStep = playbackSteps[0];
        let activeStep = firstStep;

        for (let i = 0; i < playbackSteps.length; i++) {
            const step = playbackSteps[i];
            const nextStep = playbackSteps[i + 1];

            if (elapsedTime >= step.startTime && (!nextStep || elapsedTime < nextStep.startTime)) {
                activeStep = step;
                break;
            }
        }

        return {
            currentSequence: activeStep?.sequence ?? 0,
            activeSectionIndex: activeStep?.sectionIndex ?? 0,
            activeBarIndex: activeStep?.barIndex ?? 0,
            activeBarNumber: activeStep?.barNumber ?? 1,
            activeBarStartTime: activeStep?.barStartTime ?? 0
        };
    },

    playCurrentStepIfNeeded(engine, currentSequence) {
        if (!this.isPlaying || currentSequence === this.lastPlayedSequence) return;

        this.lastPlayedSequence = currentSequence;
        const step = this.playbackSteps.find(s => s.sequence === currentSequence);
        if (!step) return;

        step.notes
            .filter(note => !note.isMuted && !note.isRest && !note.isGhostNote)
            .sort((a, b) => b.stringIdx - a.stringIdx)
            .forEach((note, i) => {
                engine.playString(note.stringIdx, note.fret, i * this.DEFAULTS.strumDelay);
            });
    },

    drawNotes(engine, playbackSteps, elapsedTime, playbackState, nodeSize) {
        const ctx = engine.ctx;
        const previewWindow = (this.slideLeadBeats || this.fallLeadBeats || this.DEFAULTS.leadBeats) * (60 / this.song.bpm);

        playbackSteps.forEach(step => {
            step.notes.forEach(note => {
                if (note.isTieContinuation) return;

                const state = this.getNoteDisplayState(
                    note,
                    elapsedTime,
                    playbackState.currentSequence,
                    this.DEFAULTS.lookAheadCount,
                    this.previewMode,
                    previewWindow
                );

                if (state.alpha <= 0) return;

                this.drawNote(engine, note, state, elapsedTime, previewWindow, nodeSize);
            });
        });

        ctx.globalAlpha = 1;
    },

    getNoteDisplayState(note, elapsedTime, currentSequence, lookAheadCount, previewMode = "ghost", previewWindow = 3.0) {
        if (!this.isPlaying) return { alpha: 1, preview: false, mode: "active" };

        if (elapsedTime >= note.startTime && elapsedTime < note.visibleEndTime) {
            return { alpha: 1, preview: false, mode: "active" };
        }

        if (elapsedTime >= note.endTime) return { alpha: 0, preview: false, mode: "hidden" };

        const timeToNote = note.startTime - elapsedTime;
        if (timeToNote <= 0 || previewMode === "none") return { alpha: 0, preview: false, mode: "hidden" };

        if (previewMode === "ghost") {
            const isGhost = note.sequence > currentSequence && note.sequence <= currentSequence + lookAheadCount;
            return { alpha: isGhost ? 0.25 : 0, preview: isGhost, mode: isGhost ? "ghost" : "hidden" };
        }

        if (previewMode === "falling") {
            const isFalling = timeToNote <= previewWindow;
            return { alpha: isFalling ? 0.85 : 0, preview: isFalling, mode: isFalling ? "falling" : "hidden" };
        }

        if (previewMode === "slide") {
            const isSliding = timeToNote <= previewWindow;
            return { alpha: isSliding ? 0.9 : 0, preview: isSliding, mode: isSliding ? "slide" : "hidden" };
        }

        return { alpha: 0, preview: false, mode: "hidden" };
    },

    drawNote(engine, note, state, elapsedTime, previewWindow, nodeSize) {
        if (state.mode === "slide") {
            this.drawSlidingNote(engine, note, state.alpha, elapsedTime, previewWindow, nodeSize);
            return;
        }

        if (state.mode === "falling") {
            this.drawFallingNote(engine, note, state.alpha, elapsedTime, previewWindow, nodeSize);
            return;
        }

        this.drawCircleNote(engine, note, state, nodeSize*1.25);
    },

    getNoteLabel(note) {
        if (note.isMuted) return "X";

        const label = this.isPlaying
            ? String(note.fret)
            : String(note.sequence);

        return note.isGhostNote
            ? `(${label})`
            : label;
    },

    drawSlidingNote(engine, note, alpha, elapsedTime, previewWindow, nodeSize) {
        if (note.isGhostNote) return;
        const ctx = engine.ctx;

        const target = engine.getFretCoordinates(
            note.stringIdx,
            note.fret === "X" ? 0 : note.fret
        );

        const startX = this.clamp(
            this.slideStartX ?? engine.canvas.width * 0.7,
            engine.layoutWidth,
            engine.canvas.width
        );

        const progress =
            this.getPreviewProgress(
                note,
                elapsedTime,
                previewWindow
            );

        const x =
            startX +
            (target.x - startX) * progress;

        this.drawFilledNote(
            ctx, 
            x,
            target.y,
            nodeSize,
            engine.getStringColor(note.stringIdx),
            this.getNoteLabel(note),
            alpha
        );
    },

    drawFallingNote(engine, note, alpha, elapsedTime, previewWindow, nodeSize) {
        if (note.isGhostNote) return;
        const ctx = engine.ctx;
        const fretSpacing = Math.abs(engine.fretPositions[1] - engine.fretPositions[0]);
        const startY = note.y - (this.fallDistanceFrets || this.DEFAULTS.fallDistanceFrets) * fretSpacing;
        const progress = 1 - Math.pow(1 - this.getPreviewProgress(note, elapsedTime, previewWindow), 3);
        const y = startY + (note.y - startY) * progress;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#dddddd";
        ctx.font = `bold ${Math.max(16, nodeSize)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.getNoteLabel(note), note.x, y);
    },

    drawCircleNote(engine, note, state, nodeSize) {
        const color = state.preview
            ? "#777777"
            : note.isMuted
                ? "#d32f2f"
                : note.isGhostNote
                    ? "#444477"
                    : engine.getStringColor(note.stringIdx);

        this.drawFilledNote(engine.ctx, note.x, note.y, nodeSize, color, this.getNoteLabel(note), state.alpha);
    },

    drawFilledNote(ctx, x, y, radius, fillStyle, label, alpha = 1) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "black";
        ctx.font = `bold ${Math.max(12, radius * 0.7)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, y);
    },

    getPreviewProgress(note, elapsedTime, previewWindow) {
        const timeToNote = note.startTime - elapsedTime;
        return 1 - this.clamp(timeToNote / previewWindow, 0, 1);
    },

    drawMetronome(engine, elapsedTime, playbackState) {
        const ctx = engine.ctx;
        const secondsPerBeat = 60 / this.song.bpm;
        const subdivisions = ["1", "and", "2", "and", "3", "and", "4", "and"];
        const printX = engine.getStringX(0);
        const countY = engine.fretPositions[0] - 55;

        ctx.globalAlpha = 1;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        if (!this.isPlaying) {
            ctx.fillStyle = "#888888";
            ctx.fillText(`Count: ${subdivisions.join(" ")}`, printX, countY);
            return;
        }

        const timeInCurrentBar = Math.max(0, elapsedTime - playbackState.activeBarStartTime);
        const subdivisionIdx = Math.floor((timeInCurrentBar / secondsPerBeat) / 0.5) % subdivisions.length;
        const countOutput = subdivisions
            .map((sub, idx) => idx === subdivisionIdx ? `[${sub.toUpperCase()}]` : sub)
            .join(" ");

        ctx.fillStyle = "#FF9800";
        ctx.fillText(`Count: ${countOutput}`, printX, countY);
    },

    drawBarLabel(engine, activeSectionIndex, activeBarNumber) {
        const ctx = engine.ctx;
        const printX = engine.getStringX(0);
        const barY = engine.fretPositions[0] - 35;
        const range = this.getPlaybackRange(this.song);

        ctx.fillStyle = "#888888";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        const startName = this.song.sections[range.startSection]?.name || "Unknown";
        const endName = this.song.sections[range.endSection]?.name || "Unknown";
        this.sectionStartLabel.text = `${startName}`;
        this.sectionEndLabel.text = `${endName}`;
        this.barStartLabel.text = `${range.startBar + 1}`;
        this.barEndLabel.text = `${range.endBar + 1}`;
        ctx.fillText(
            `section ${this.song.sections[activeSectionIndex]?.name || "Unknown"} Bar: ${activeBarNumber}`,
            printX,
            barY
        );
    },


    parseVTab(text) {
        const song = {
            name: "",
            bpm: 120,
            tuning: [],
            meter: "4/4",
            sections: []
        };

        let currentSection = null;

        text.split("\n").forEach(rawLine => {
            const { content, barNumber } = this.stripCommentAndReadBarNumber(rawLine);
            const line = content.trim();

            if (!line) return;

            if (line.includes(":")) {
                this.parseMetadataLine(song, line);
                return;
            }

            if (line.startsWith("[") && line.endsWith("]")) {
                currentSection = { name: line.slice(1, -1), measures: [] };
                song.sections.push(currentSection);
                return;
            }

            if (!currentSection || line === "--" || !line.startsWith("|")) return;

            const measure = this.parseMeasureLine(line);
            measure.barNumber = barNumber ?? currentSection.measures.length + 1;
            currentSection.measures.push(measure);
            this.validateSectionTiming(currentSection, song.meter);
        });

        song.sections = song.sections.filter(section => section.measures.length > 0);
        return song;
    },

    stripCommentAndReadBarNumber(rawLine) {
        const hashIndex = rawLine.indexOf("#");
        if (hashIndex < 0) return { content: rawLine, barNumber: null };

        const content = rawLine.slice(0, hashIndex);
        const comment = rawLine.slice(hashIndex + 1).trim();
        const match = comment.match(/^(\d+)/);

        return {
            content,
            barNumber: match ? parseInt(match[1], 10) : null
        };
    },

    parseMetadataLine(song, line) {
        const [rawKey, ...valueParts] = line.split(":");
        const key = rawKey.trim().toLowerCase();
        const value = valueParts.join(":").trim();

        if (key === "name") song.name = value;
        if (key === "bpm") song.bpm = parseInt(value, 10) || song.bpm;
        if (key === "meter") song.meter = value;
        if (key === "tuning") song.tuning = value.split(/\s+/);
    },

    parseMeasureLine(line) {
        return line
            .split("|")
            .map(token => token.trim())
            .filter(Boolean)
            .map(token => this.parseStepToken(token));
    },

    parseStepToken(token) {
        const cleanToken = token.trim().replaceAll("~", "");
        const tieContinues = token.includes("~");
        const noteTokens = cleanToken.split(",").map(s => s.trim()).filter(Boolean);
        const sharedDuration = this.extractSharedDuration(noteTokens);

        return noteTokens.map(noteToken => this.parseNoteToken(noteToken, sharedDuration, tieContinues));
    },

    extractSharedDuration(noteTokens) {
        const lastIndex = noteTokens.length - 1;
        const parts = noteTokens[lastIndex]?.split(".") ?? [];

        if (parts.length < 3) return null;

        const duration = this.parseDurationToken(parts.pop());
        noteTokens[lastIndex] = parts.join(".");
        return duration;
    },

    parseNoteToken(noteToken, sharedDuration, tieContinues) {
        const parts = noteToken.split(".");
        const stringPart = parts[0];
        const fretPart = parts[1] || "";
        const durationObj = sharedDuration || this.parseDurationToken(parts[2]);

        if (stringPart === "0" || (fretPart === "" && stringPart !== "0")) {
            return {
                isRest: true,
                stringIdx: stringPart === "0" ? null : 6 - parseInt(stringPart, 10),
                durationObj
            };
        }

        const cleanFret = fretPart.replace(/[()]/g, "");
        const isMuted = cleanFret.toUpperCase() === "X";

        return {
            stringIdx: 6 - parseInt(stringPart, 10),
            fret: isMuted ? "X" : parseInt(cleanFret, 10),
            isMuted,
            durationObj,
            tieContinues,
            isGhostNote: /\(.+\)/.test(fretPart)
        };
    },

    parseDurationToken(rawDuration) {
        let s = String(rawDuration || "4")
            .toLowerCase()
            .trim();

        const isTriplet = s.endsWith("t");

        if (isTriplet) {
            s = s.slice(0, -1);
        }

        const doubleDotted = s.endsWith("dd");
        const isDotted = !doubleDotted && s.endsWith("d");

        const base = doubleDotted
            ? s.slice(0, -2)
            : isDotted
                ? s.slice(0, -1)
                : s;

        return {
            baseNum: parseFloat(base) || 4,
            isDotted,
            doubleDotted,
            isTriplet
        };
    }

};
