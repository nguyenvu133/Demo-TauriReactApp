/**
 * PixiJS Spriter Studio & Scene Editor Application
 * Full-featured visual character & skeletal animation editor based on spriter-phaser
 */
(function() {
    'use strict';

    // Application State
    const state = {
        app: null,
        stageContainer: null,
        backgroundLayer: null,
        characterLayer: null,
        gizmoLayer: null,
        gridGraphics: null,
        groundGraphics: null,

        // Characters & Selection
        slots: [], // Array of CharacterSlot { id, name, key, hero, animations, index }
        selected: 0, // Selected slot index
        draggingChar: null,
        dragOffset: { x: 0, y: 0 },
        isDragging: false,

        // Viewport
        resolution: { width: 1280, height: 720 },
        zoom: 1.0,
        pan: { x: 0, y: 0 },
        isPanning: false,
        panStart: { x: 0, y: 0 },

        // Visuals
        groundY: 630,
        showGrid: true,
        showBones: false,
        showBoxes: false,
        bgPreset: 'cyber_grid',

        // Timeline
        isScrubbing: false,
        fps: 60,
        lastTime: performance.now(),
        frameCount: 0,
        lastFpsUpdate: performance.now(),

        // Next ID
        idCounter: 1
    };

    window.editorState = state;

    // Default character paths
    const ASSET_PATHS = {
        boy: {
            scon: 'assets/boy/boy.scon',
            json: 'assets/boy/boy.json',
            png: 'assets/boy/boy.png',
            fallbackScon: 'spriter-phaser-example-main/public/assets/boy/boy.scon',
            fallbackJson: 'spriter-phaser-example-main/public/assets/boy/boy.json',
            fallbackPng: 'spriter-phaser-example-main/public/assets/boy/boy.png'
        },
        viking: {
            scon: 'assets/viking/viking.scon',
            json: 'assets/viking/viking.json',
            png: 'assets/viking/viking.png',
            fallbackScon: 'spriter-phaser-example-main/public/assets/viking/viking.scon',
            fallbackJson: 'spriter-phaser-example-main/public/assets/viking/viking.json',
            fallbackPng: 'spriter-phaser-example-main/public/assets/viking/viking.png'
        },
        chicken: {
            scon: 'assets/chicken/chicken.scon',
            json: 'assets/chicken/chicken.json',
            png: 'assets/chicken/animal_chicken_t1.png',
            fallbackScon: 'assets/chicken/chicken.scon',
            fallbackJson: 'assets/chicken/chicken.json',
            fallbackPng: 'assets/chicken/animal_chicken_t1.png'
        }
    };

    // Helper: format time ms to mm:ss.ms
    function formatTime(ms) {
        ms = Math.max(0, ms);
        const totalSeconds = ms / 1000;
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        const hundredths = Math.floor((ms % 1000) / 10);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
    }

    // Helper: fetch with fallback
    async function loadWithFallback(key, primary, fallback) {
        try {
            return await pixiSpriterLoader.load(key, primary.scon, primary.json, primary.png);
        } catch (e) {
            console.warn(`Primary path for ${key} failed, trying fallback...`, e);
            return await pixiSpriterLoader.load(key, fallback.scon, fallback.json, fallback.png);
        }
    }

    // Initialize application when DOM is ready
    function startApp() {
        initApp().catch(err => {
            console.error('Failed to initialize Spriter Editor:', err);
            alert('Lỗi khởi động Spriter Editor: ' + err.message);
        });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', startApp);
    } else {
        // DOM already loaded
        setTimeout(startApp, 0);
    }

    window.editorApp = {
        state,
        formatTime
    };

    async function initApp() {
        const container = document.getElementById('canvasWrapper');
        if (!container) return;

        // 1. Create PixiJS Application
        if (PIXI.Application.prototype.init) {
            state.app = new PIXI.Application();
            await state.app.init({
                width: state.resolution.width,
                height: state.resolution.height,
                backgroundColor: 0x0d111d,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
        } else {
            state.app = new PIXI.Application({
                width: state.resolution.width,
                height: state.resolution.height,
                backgroundColor: 0x0d111d,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
        }

        const canvas = state.app.canvas || state.app.view;
        container.appendChild(canvas);

        // 2. Setup Container Layers
        state.stageContainer = new PIXI.Container();
        state.app.stage.addChild(state.stageContainer);

        state.backgroundLayer = new PIXI.Container();
        state.gridGraphics = new PIXI.Graphics();
        state.groundGraphics = new PIXI.Graphics();
        state.backgroundLayer.addChild(state.gridGraphics);
        state.backgroundLayer.addChild(state.groundGraphics);

        state.characterLayer = new PIXI.Container();
        state.gizmoLayer = new PIXI.Graphics();

        state.stageContainer.addChild(state.backgroundLayer);
        state.stageContainer.addChild(state.characterLayer);
        state.stageContainer.addChild(state.gizmoLayer);

        // 3. Preload Spriter Character Assets (Boy, Viking & Chicken)
        for (const key of ['boy', 'viking', 'chicken']) {
            if (window.SPRITER_PRESETS && window.SPRITER_PRESETS[key]) {
                const p = window.SPRITER_PRESETS[key];
                await pixiSpriterLoader.loadFromData(key, p.scon, p.atlas, p.png);
            } else {
                await loadWithFallback(key, ASSET_PATHS[key], {
                    scon: ASSET_PATHS[key].fallbackScon,
                    json: ASSET_PATHS[key].fallbackJson,
                    png: ASSET_PATHS[key].fallbackPng
                });
            }
        }

        // 4. Create Initial Characters on Stage (Matching spriter-phaser-example)
        addCharacterSlot('boy', 'Boy (Player)', 380, state.groundY);
        addCharacterSlot('viking', 'Viking (Hero)', 820, state.groundY);

        // 5. Draw Background & Stage
        redrawStageBackdrop();

        // Track keyboard state for movement
        state.keys = {};
        window.addEventListener('keydown', (e) => {
            state.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            state.keys[e.code] = false;
        });

        // 6. Setup Interaction & Event Listeners
        setupCanvasInteraction();
        setupUIEventListeners();
        setupHotkeys();

        // 7. Render Loop (Ticker)
        state.app.ticker.add(onTickerUpdate);

        // 8. Update UI
        updateSlotListUI();
        updateAnimationListUI();
        updateAtlasGridUI();
        updateInspectorUI();
        updateTimelineUI();

        // 9. Check for auto-import character from external tools (e.g. atlas.html)
        try {
            const autoImport = localStorage.getItem('autoImportCharacter');
            if (autoImport) {
                const data = JSON.parse(autoImport);
                if (data.key && data.sconText && data.atlasText && data.pngDataUrl) {
                    await pixiSpriterLoader.loadFromData(data.key, data.sconText, data.atlasText, data.pngDataUrl);
                    addCharacterSlot(data.key, data.key.toUpperCase(), state.resolution.width / 2, state.groundY);
                    selectSlot(state.slots.length - 1);
                    localStorage.removeItem('autoImportCharacter');
                    showToast(`Tự động nhập nhân vật ${data.key} thành công!`, 'success');
                }
            }
        } catch (e) {
            console.error('Error auto importing from localStorage:', e);
        }
    }

    function addCharacterSlot(key, displayName, x, y) {
        if (!pixiSpriterLoader.has(key)) return null;

        const hero = pixiSpriterLoader.create(key, {
            loop: true,
            autoplay: true,
            showBones: state.showBones,
            showBoxes: state.showBoxes
        });

        hero.x = x !== undefined ? x : state.resolution.width / 2;
        hero.y = y !== undefined ? y : state.groundY;

        state.characterLayer.addChild(hero);

        const slot = {
            id: 'char_' + (state.idCounter++),
            name: displayName || (key.toUpperCase()),
            key: key,
            hero: hero,
            animations: hero.getAnimationNames(),
            index: 0
        };

        state.slots.push(slot);
        state.selected = state.slots.length - 1;

        updateSlotListUI();
        updateAnimationListUI();
        updateAtlasGridUI();
        updateInspectorUI();
        return slot;
    }

    // Handle keyboard input for chicken movement
    function handleKeyboardMovement(deltaMs) {
        const active = getActiveSlot();
        if (!active || active.key !== 'chicken') return;

        const moveSpeed = 0.15;
        let isMoving = false;

        // Di chuyển sang trái
        if (state.keys['ArrowLeft'] || state.keys['KeyA']) {
            active.hero.x -= moveSpeed * deltaMs;
            active.hero.scale.x = -1; // Lật ngang nhân vật
            isMoving = true;
        }
        // Di chuyển sang phải
        if (state.keys['ArrowRight'] || state.keys['KeyD']) {
            active.hero.x += moveSpeed * deltaMs;
            active.hero.scale.x = 1;
            isMoving = true;
        }

        // Chuyển đổi animation
        if (isMoving && active.hero.currentAnimationName !== 'walk') {
            active.hero.play('walk', { loop: true });
        } else if (!isMoving && active.hero.currentAnimationName !== 'idle') {
            active.hero.play('idle', { loop: true });
        }
    }

    function onTickerUpdate(ticker) {
        const deltaMs = ticker.deltaMS || (1000 / 60);

        // Xử lý di chuyển bằng bàn phím
        handleKeyboardMovement(deltaMs);

        // Update all character objects on stage
        state.slots.forEach(slot => {
            if (slot.hero) {
                slot.hero.update(deltaMs);
            }
        });

        // Update HUD FPS
        state.frameCount++;
        const now = performance.now();
        if (now - state.lastFpsUpdate >= 500) {
            state.fps = Math.round((state.frameCount * 1000) / (now - state.lastFpsUpdate));
            state.frameCount = 0;
            state.lastFpsUpdate = now;
            const hudFps = document.getElementById('hudFps');
            if (hudFps) hudFps.textContent = `FPS: ${state.fps}`;
        }

        // Update HUD Status & Timeline
        const active = getActiveSlot();
        if (active && active.hero) {
            const hudChar = document.getElementById('hudActiveChar');
            const hudAnim = document.getElementById('hudActiveAnim');
            if (hudChar) hudChar.innerHTML = `Nhân vật: <strong>${active.name}</strong>`;
            if (hudAnim) hudAnim.innerHTML = `Animation: <strong>${active.hero.currentAnimationName || 'none'}</strong>`;

            // Update timeline scrubber handle if not actively dragging
            if (!state.isScrubbing) {
                updateTimelineScrubberProgress();
            }

            // Update live bone hierarchy tree if inspector tab is visible
            updateLiveBonesInspector();
        }

        // Draw selection gizmo around active character
        drawSelectionGizmo();
    }

    // Helper: Toast Notifications
    function showToast(message, type = 'info') {
        let container = document.querySelector('.editor-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'editor-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `editor-toast ${type}`;
        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'warn' ? '⚠️' : '⚡'));
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    function renderTimelineRuler() {
        const ruler = document.getElementById('timelineRuler');
        if (!ruler) return;
        ruler.innerHTML = '';

        const active = getActiveSlot();
        const duration = (active && active.hero) ? active.hero.getDuration() : 1000;
        const totalSeconds = duration / 1000;

        const steps = [0, 0.25, 0.5, 0.75, 1.0];
        steps.forEach(frac => {
            const tick = document.createElement('div');
            tick.className = 'timeline-ruler-tick major';
            tick.style.left = `${frac * 100}%`;
            ruler.appendChild(tick);

            const label = document.createElement('div');
            label.className = 'timeline-ruler-label';
            label.style.left = `${frac * 100}%`;
            label.textContent = (totalSeconds * frac).toFixed(1) + 's';
            ruler.appendChild(label);
        });
    }

    function getActiveSlot() {
        if (state.selected >= 0 && state.selected < state.slots.length) {
            return state.slots[state.selected];
        }
        return null;
    }

    function selectSlot(index) {
        if (index < 0 || index >= state.slots.length) return;
        state.selected = index;
        const active = getActiveSlot();
        if (active) {
            const pillName = document.getElementById('activeSlotName');
            if (pillName) pillName.textContent = `${active.name} (${active.hero.currentEntityName || active.key})`;
        }
        updateSlotListUI();
        updateAnimationListUI();
        updateAtlasGridUI();
        updateInspectorUI();
        updateTimelineUI();
        renderTimelineRuler();
    }

    function switchAnimation(direction) {
        const slot = getActiveSlot();
        if (!slot || !slot.animations.length) return;

        slot.index = (slot.index + direction + slot.animations.length) % slot.animations.length;
        const animName = slot.animations[slot.index];
        slot.hero.play(animName, { loop: slot.hero.loop });

        updateAnimationListUI();
        updateTimelineUI();
        updateInspectorUI();
        renderTimelineRuler();
    }

    function playAnimation(animName) {
        const slot = getActiveSlot();
        if (!slot) return;
        const idx = slot.animations.indexOf(animName);
        if (idx !== -1) slot.index = idx;
        slot.hero.play(animName, { loop: slot.hero.loop });

        updateAnimationListUI();
        updateTimelineUI();
        updateInspectorUI();
        renderTimelineRuler();
    }

    function duplicateActiveSlot() {
        const active = getActiveSlot();
        if (!active) return;
        const newSlot = addCharacterSlot(active.key, active.name + ' (Bản sao)', active.hero.x + 80, active.hero.y);
        if (newSlot && active.hero.currentAnimationName) {
            newSlot.hero.play(active.hero.currentAnimationName);
            newSlot.hero.flipX = active.hero.flipX;
            newSlot.hero.scale.set(active.hero.scale.x, active.hero.scale.y);
        }
        showToast(`Đã nhân bản nhân vật "${active.name}"!`, 'success');
    }

    function deleteActiveSlot() {
        if (state.slots.length <= 1) {
            showToast('Cần giữ lại ít nhất 1 nhân vật trên sân khấu!', 'warn');
            return;
        }
        const active = getActiveSlot();
        if (!active) return;

        const deletedName = active.name;
        state.characterLayer.removeChild(active.hero);
        state.slots.splice(state.selected, 1);
        state.selected = Math.max(0, state.selected - 1);

        selectSlot(state.selected);
        showToast(`Đã xóa nhân vật "${deletedName}"!`, 'info');
    }

    function redrawStageBackdrop() {
        const bg = state.gridGraphics;
        const ground = state.groundGraphics;
        if (typeof bg.clear === 'function') bg.clear();
        if (typeof ground.clear === 'function') ground.clear();

        const w = state.resolution.width;
        const h = state.resolution.height;
        const gy = state.groundY;

        // Background color & atmosphere
        if (state.bgPreset === 'cyber_grid') {
            if (typeof bg.rect === 'function') {
                bg.setFillStyle({ color: 0x0a0f1d, alpha: 1 });
                bg.rect(0, 0, w, h);
                bg.fill();
            } else {
                bg.beginFill(0x0a0f1d, 1);
                bg.drawRect(0, 0, w, h);
                bg.endFill();
            }
        } else if (state.bgPreset === 'dark_dungeon') {
            if (typeof bg.rect === 'function') {
                bg.setFillStyle({ color: 0x181014, alpha: 1 });
                bg.rect(0, 0, w, h);
                bg.fill();
            } else {
                bg.beginFill(0x181014, 1);
                bg.drawRect(0, 0, w, h);
                bg.endFill();
            }
        } else if (state.bgPreset === 'sunset_forest') {
            if (typeof bg.rect === 'function') {
                bg.setFillStyle({ color: 0x1f1624, alpha: 1 });
                bg.rect(0, 0, w, h);
                bg.fill();
            } else {
                bg.beginFill(0x1f1624, 1);
                bg.drawRect(0, 0, w, h);
                bg.endFill();
            }
        } else if (state.bgPreset === 'solid_dark') {
            if (typeof bg.rect === 'function') {
                bg.setFillStyle({ color: 0x0f172a, alpha: 1 });
                bg.rect(0, 0, w, h);
                bg.fill();
            } else {
                bg.beginFill(0x0f172a, 1);
                bg.drawRect(0, 0, w, h);
                bg.endFill();
            }
        } else {
            if (typeof bg.rect === 'function') {
                bg.setFillStyle({ color: 0x000000, alpha: 1 });
                bg.rect(0, 0, w, h);
                bg.fill();
            } else {
                bg.beginFill(0x000000, 1);
                bg.drawRect(0, 0, w, h);
                bg.endFill();
            }
        }

        // Draw Grid
        if (state.showGrid) {
            const gridSize = 40;
            if (typeof bg.setStrokeStyle === 'function') {
                bg.setStrokeStyle({ width: 1, color: 0x26334a, alpha: 0.35 });
                bg.beginPath();
                for (let x = 0; x <= w; x += gridSize) {
                    bg.moveTo(x, 0);
                    bg.lineTo(x, h);
                }
                for (let y = 0; y <= h; y += gridSize) {
                    bg.moveTo(0, y);
                    bg.lineTo(w, y);
                }
                bg.stroke();
            } else if (typeof bg.lineStyle === 'function') {
                bg.lineStyle(1, 0x26334a, 0.35);
                for (let x = 0; x <= w; x += gridSize) {
                    bg.moveTo(x, 0);
                    bg.lineTo(x, h);
                }
                for (let y = 0; y <= h; y += gridSize) {
                    bg.moveTo(0, y);
                    bg.lineTo(w, y);
                }
            }
        }

        // Ground Platform & Line
        if (typeof ground.rect === 'function') {
            // Ground fill
            ground.setFillStyle({ color: 0x131a2c, alpha: 0.8 });
            ground.rect(0, gy, w, h - gy);
            ground.fill();
            // Ground neon top line
            ground.setStrokeStyle({ width: 2, color: 0x38bdf8, alpha: 0.85 });
            ground.beginPath();
            ground.moveTo(0, gy);
            ground.lineTo(w, gy);
            ground.stroke();
        } else {
            ground.beginFill(0x131a2c, 0.8);
            ground.drawRect(0, gy, w, h - gy);
            ground.endFill();
            ground.lineStyle(2, 0x38bdf8, 0.85);
            ground.moveTo(0, gy);
            ground.lineTo(w, gy);
        }
    }

    function drawSelectionGizmo() {
        const g = state.gizmoLayer;
        if (typeof g.clear === 'function') g.clear();

        const active = getActiveSlot();
        if (!active || !active.hero) return;

        const hero = active.hero;
        const bounds = hero.getBounds();

        // Convert world bounds to local stage coordinates
        const tl = state.stageContainer.toLocal({ x: bounds.x, y: bounds.y });
        const br = state.stageContainer.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
        const bw = br.x - tl.x;
        const bh = br.y - tl.y;

        // Draw bounding box
        if (typeof g.rect === 'function') {
            g.setStrokeStyle({ width: 1.5, color: 0x6366f1, alpha: 0.85 });
            g.rect(tl.x - 4, tl.y - 4, bw + 8, bh + 8);
            g.stroke();

            // Origin / Pivot indicator
            g.setFillStyle({ color: 0xf59e0b, alpha: 1 });
            g.circle(hero.x, hero.y, 4);
            g.fill();
        } else {
            g.lineStyle(1.5, 0x6366f1, 0.85);
            g.drawRect(tl.x - 4, tl.y - 4, bw + 8, bh + 8);
            g.beginFill(0xf59e0b, 1);
            g.drawCircle(hero.x, hero.y, 4);
            g.endFill();
        }
    }

    function setupCanvasInteraction() {
        const canvas = state.app.canvas || state.app.view;
        const wrapper = document.getElementById('canvasWrapper');
        if (!canvas || !wrapper) return;

        // Pointer down
        canvas.addEventListener('pointerdown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = state.resolution.width / rect.width;
            const scaleY = state.resolution.height / rect.height;
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;

            // Pan mode (middle click or space key or shift)
            if (e.button === 1 || e.shiftKey) {
                state.isPanning = true;
                state.panStart = { x: e.clientX, y: e.clientY };
                return;
            }

            // Check if clicking on an existing character
            let clickedSlot = null;
            for (let i = state.slots.length - 1; i >= 0; i--) {
                const slot = state.slots[i];
                const dx = Math.abs(slot.hero.x - canvasX);
                const dy = Math.abs(slot.hero.y - 100 - canvasY);
                if (dx < 120 && dy < 160) {
                    clickedSlot = i;
                    break;
                }
            }

            if (clickedSlot !== null) {
                selectSlot(clickedSlot);
                state.isDragging = true;
                state.draggingChar = state.slots[clickedSlot].hero;
                state.dragOffset = {
                    x: state.draggingChar.x - canvasX,
                    y: state.draggingChar.y - canvasY
                };
            }
        });

        // Pointer move
        window.addEventListener('pointermove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = state.resolution.width / rect.width;
            const scaleY = state.resolution.height / rect.height;
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;

            // Handle panning
            if (state.isPanning) {
                const dx = e.clientX - state.panStart.x;
                const dy = e.clientY - state.panStart.y;
                state.pan.x += dx;
                state.pan.y += dy;
                state.panStart = { x: e.clientX, y: e.clientY };
                applyViewportTransform();
                return;
            }

            // Update HUD Coords
            const hudCoords = document.getElementById('hudCoords');
            if (hudCoords) {
                hudCoords.textContent = `X: ${Math.round(canvasX)}, Y: ${Math.round(canvasY)}`;
            }

            if (state.isDragging && state.draggingChar) {
                state.draggingChar.x = Math.round(canvasX + state.dragOffset.x);
                state.draggingChar.y = Math.round(canvasY + state.dragOffset.y);
                updateInspectorTransformInputs();
            }
        });

        // Pointer up
        window.addEventListener('pointerup', () => {
            state.isDragging = false;
            state.draggingChar = null;
            state.isPanning = false;
        });

        // Wheel Zoom
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.max(0.3, Math.min(3.0, state.zoom + delta));
            setZoom(Number(newZoom.toFixed(2)));
        }, { passive: false });
    }

    function applyViewportTransform() {
        const wrapper = document.getElementById('canvasWrapper');
        if (wrapper) {
            wrapper.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
        }
    }

    function setZoom(val) {
        state.zoom = val;
        applyViewportTransform();
        const zoomSelect = document.getElementById('zoomSelect');
        if (zoomSelect) {
            const match = Array.from(zoomSelect.options).find(o => parseFloat(o.value) === val);
            if (match) {
                zoomSelect.value = match.value;
            }
        }
    }

    function setupHotkeys() {
        window.addEventListener('keydown', (e) => {
            // Ignore if typing in text input or modal
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                return;
            }

            if (e.key === 'Tab') {
                e.preventDefault();
                const next = (state.selected + 1) % state.slots.length;
                selectSlot(next);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                switchAnimation(1);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                switchAnimation(-1);
            } else if (e.code === 'Space') {
                e.preventDefault();
                const active = getActiveSlot();
                if (active && active.hero) {
                    active.hero.togglePause();
                    updateTimelinePlayButton();
                }
            } else if (e.key === 'a' || e.key === 'A') {
                const active = getActiveSlot();
                if (active && active.hero) {
                    active.hero.faceLeft();
                    updateInspectorTransformInputs();
                }
            } else if (e.key === 'd' || e.key === 'D') {
                const active = getActiveSlot();
                if (active && active.hero) {
                    active.hero.faceRight();
                    updateInspectorTransformInputs();
                }
            } else if (e.key === 'b' || e.key === 'B') {
                toggleBones();
            } else if (e.key === 'g' || e.key === 'G') {
                toggleGrid();
            } else if (e.key === 'f' || e.key === 'F') {
                centerCameraOnActive();
            } else if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                duplicateActiveSlot();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteActiveSlot();
            }
        });
    }

    function toggleBones() {
        state.showBones = !state.showBones;
        state.slots.forEach(s => {
            if (s.hero) s.hero.setShowBones(state.showBones);
        });
        const btn = document.getElementById('btnToggleBones');
        if (btn) btn.classList.toggle('active', state.showBones);
    }

    function toggleGrid() {
        state.showGrid = !state.showGrid;
        redrawStageBackdrop();
        const btn = document.getElementById('btnToggleGrid');
        if (btn) btn.classList.toggle('active', state.showGrid);
    }

    function centerCameraOnActive() {
        state.pan = { x: 0, y: 0 };
        applyViewportTransform();
        const active = getActiveSlot();
        if (active && active.hero) {
            active.hero.x = state.resolution.width / 2;
            active.hero.y = state.groundY;
            updateInspectorTransformInputs();
        }
    }

    function updateSlotListUI() {
        const container = document.getElementById('characterSlotList');
        if (!container) return;
        container.innerHTML = '';

        state.slots.forEach((slot, index) => {
            const card = document.createElement('div');
            card.className = `slot-card ${index === state.selected ? 'active' : ''}`;
            card.innerHTML = `
                <div class="slot-info">
                    <span class="slot-name">
                        <span style="font-size: 14px;">${slot.key === 'boy' ? '👦' : (slot.key === 'viking' ? '🛡️' : '👾')}</span>
                        ${slot.name}
                    </span>
                    <span class="slot-sub">Entity: ${slot.hero.currentEntityName || slot.key} • Anim: ${slot.hero.currentAnimationName || 'idle'}</span>
                </div>
                <div class="slot-actions">
                    <button class="btn" style="padding: 2px 6px; font-size: 10px;" title="Quay hướng">${slot.hero.flipX ? '⬅' : '➡'}</button>
                </div>
            `;
            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    slot.hero.toggleFlip();
                    updateSlotListUI();
                    return;
                }
                selectSlot(index);
            });
            container.appendChild(card);
        });
    }

    function updateAnimationListUI() {
        const container = document.getElementById('animListContainer');
        const searchInput = document.getElementById('animSearchInput');
        if (!container) return;

        const active = getActiveSlot();
        if (!active || !active.hero) {
            container.innerHTML = '<div style="color:var(--text-muted); padding:10px;">Chưa chọn nhân vật</div>';
            return;
        }

        const filter = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';
        const anims = active.hero.getAnimationNames();
        container.innerHTML = '';

        anims.forEach((animName) => {
            if (filter && !animName.toLowerCase().includes(filter)) return;

            const isCurrent = (animName === active.hero.currentAnimationName);
            const animData = active.hero.spriterData.getAnimation(active.hero.currentEntityName, animName);
            const durationSec = animData ? (animData.length / 1000).toFixed(2) + 's' : '1.0s';
            const keyframeCount = (animData && animData.mainline && animData.mainline.key) ? animData.mainline.key.length : 1;

            const item = document.createElement('div');
            item.className = `anim-item ${isCurrent ? 'active' : ''}`;
            item.innerHTML = `
                <div class="anim-item-left">
                    <span style="font-size: 12px;">${isCurrent ? '▶' : '🎬'}</span>
                    <span>${animName}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="anim-badge">${durationSec}</span>
                    <span class="anim-badge" title="Số lượng keyframes">${keyframeCount}k</span>
                </div>
            `;
            item.addEventListener('click', () => {
                playAnimation(animName);
            });
            container.appendChild(item);
        });
    }

    function updateAtlasGridUI() {
        const container = document.getElementById('atlasGridContainer');
        if (!container) return;

        const active = getActiveSlot();
        if (!active || !active.hero || !active.hero.atlas) {
            container.innerHTML = '<div style="color:var(--text-muted); padding:10px;">Không có dữ liệu Atlas</div>';
            return;
        }

        const rawFrames = active.hero.atlas.rawFrames || [];
        container.innerHTML = '';

        rawFrames.forEach(f => {
            const card = document.createElement('div');
            card.className = 'atlas-card';
            card.title = `${f.filename} (${f.frame.w}x${f.frame.h}px) - Nhấp để xem chi tiết`;

            const dataUrl = active.hero.atlas.getDataUrl ? active.hero.atlas.getDataUrl(f.filename) : null;
            const thumbHtml = dataUrl
                ? `<img class="atlas-thumb" src="${dataUrl}" alt="${f.filename}" loading="lazy">`
                : `<div class="atlas-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;">🧩</div>`;

            card.innerHTML = `
                ${thumbHtml}
                <div class="atlas-name" title="${f.filename}">${f.filename.split('/').pop()}</div>
            `;
            card.addEventListener('click', () => {
                showToast(`Sprite: ${f.filename} (${f.frame.w}x${f.frame.h}px)`, 'info');
            });
            container.appendChild(card);
        });
    }

    function updateInspectorUI() {
        const active = getActiveSlot();
        if (!active || !active.hero) return;

        const hero = active.hero;

        // Slot Name
        const propName = document.getElementById('propSlotName');
        if (propName) propName.value = active.name;

        // Entities Dropdown
        const entSelect = document.getElementById('propEntitySelect');
        if (entSelect) {
            const entities = hero.getEntityNames();
            entSelect.innerHTML = '';
            entities.forEach(ent => {
                const opt = document.createElement('option');
                opt.value = ent;
                opt.textContent = ent;
                if (ent === hero.currentEntityName) opt.selected = true;
                entSelect.appendChild(opt);
            });
        }

        updateInspectorTransformInputs();
    }

    function updateInspectorTransformInputs() {
        const active = getActiveSlot();
        if (!active || !active.hero) return;
        const hero = active.hero;

        const posX = document.getElementById('propPosX');
        const posY = document.getElementById('propPosY');
        const scaleX = document.getElementById('propScaleX');
        const scaleY = document.getElementById('propScaleY');
        const rot = document.getElementById('propRotation');
        const alpha = document.getElementById('propAlphaSlider');
        const alphaVal = document.getElementById('propAlphaValue');

        if (posX && document.activeElement !== posX) posX.value = Math.round(hero.x);
        if (posY && document.activeElement !== posY) posY.value = Math.round(hero.y);
        if (scaleX && document.activeElement !== scaleX) scaleX.value = (hero.scale.x * (hero.flipX ? -1 : 1)).toFixed(2);
        if (scaleY && document.activeElement !== scaleY) scaleY.value = hero.scale.y.toFixed(2);
        if (rot && document.activeElement !== rot) rot.value = Math.round(hero.rotation * (180 / Math.PI));
        if (alpha) alpha.value = hero.alpha;
        if (alphaVal) alphaVal.textContent = hero.alpha.toFixed(1);
    }

    let lastRenderedSlotId = null;

    function updateLiveBonesInspector() {
        const container = document.getElementById('bonesTreeList');
        const badge = document.getElementById('boneCountBadge');
        if (!container) return;

        const active = getActiveSlot();
        if (!active || !active.hero) {
            container.innerHTML = '';
            if (badge) badge.textContent = '0 bones';
            lastRenderedSlotId = null;
            return;
        }

        const bones = active.hero.activeBoneList || [];
        if (badge) badge.textContent = `${bones.length} bones`;

        // Rebuild if slot changed or count changed
        if (lastRenderedSlotId !== active.id || container.children.length !== bones.length) {
            lastRenderedSlotId = active.id;
            container.innerHTML = '';
            bones.forEach(b => {
                const node = document.createElement('div');
                node.className = `bone-node ${b.parent === undefined ? 'root' : ''}`;
                node.id = `bone_node_${b.id}`;
                node.title = `Bone: ${b.name} (ID: ${b.id}, Parent: ${b.parent !== undefined ? b.parent : 'None'})`;
                node.innerHTML = `
                    <span>${b.parent === undefined ? '🦴' : '↳'} ${b.name}</span>
                    <span style="opacity:0.7;">${Math.round(b.angle)}°</span>
                `;
                container.appendChild(node);
            });
        } else {
            bones.forEach(b => {
                const el = document.getElementById(`bone_node_${b.id}`);
                if (el) {
                    const span = el.children[1];
                    if (span) span.textContent = `${Math.round(b.angle)}°`;
                }
            });
        }
    }

    function updateTimelineUI() {
        const active = getActiveSlot();
        if (!active || !active.hero) return;

        const timeDisplay = document.getElementById('timelineTimeDisplay');
        if (timeDisplay) {
            const currentMs = active.hero.getTime();
            const durationMs = active.hero.getDuration();
            timeDisplay.textContent = `${formatTime(currentMs)} / ${formatTime(durationMs)}`;
        }

        const loopBtn = document.getElementById('btnLoopToggle');
        if (loopBtn) {
            loopBtn.classList.toggle('active', active.hero.loop);
        }

        const speedSelect = document.getElementById('playbackSpeedSelect');
        if (speedSelect) {
            speedSelect.value = String(active.hero.speed);
        }

        updateTimelinePlayButton();
        updateTimelineScrubberProgress();
    }

    function updateTimelinePlayButton() {
        const active = getActiveSlot();
        const playBtn = document.getElementById('btnPlayPause');
        if (!playBtn) return;

        if (active && active.hero && !active.hero.paused) {
            playBtn.innerHTML = '⏸ Pause';
            playBtn.classList.remove('btn-primary');
            playBtn.classList.add('btn-cyan');
        } else {
            playBtn.innerHTML = '▶ Play';
            playBtn.classList.remove('btn-cyan');
            playBtn.classList.add('btn-primary');
        }
    }

    function updateTimelineScrubberProgress() {
        const active = getActiveSlot();
        if (!active || !active.hero) return;

        const progress = active.hero.getProgress();
        const percent = Math.min(100, Math.max(0, progress * 100));

        const bar = document.getElementById('timelineProgressBar');
        const handle = document.getElementById('timelineScrubberHandle');
        const timeDisplay = document.getElementById('timelineTimeDisplay');

        if (bar) bar.style.width = `${percent}%`;
        if (handle) handle.style.left = `${percent}%`;
        if (timeDisplay) {
            timeDisplay.textContent = `${formatTime(active.hero.getTime())} / ${formatTime(active.hero.getDuration())}`;
        }
    }

    function setupUIEventListeners() {
        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.target;
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.editor-sidebar .tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                const content = document.getElementById(target);
                if (content) content.classList.add('active');
            });
        });

        // Add Boy / Viking
        document.getElementById('btnAddBoy')?.addEventListener('click', () => {
            addCharacterSlot('boy', 'Boy (Player)', state.resolution.width / 2, state.groundY);
            showToast('Đã thêm nhân vật Boy!', 'success');
        });
        document.getElementById('btnAddViking')?.addEventListener('click', () => {
            addCharacterSlot('viking', 'Viking (Hero)', state.resolution.width / 2, state.groundY);
            showToast('Đã thêm nhân vật Viking!', 'success');
        });
        document.getElementById('btnAddChicken')?.addEventListener('click', () => {
            addCharacterSlot('chicken', 'Chicken (Animal)', state.resolution.width / 2, state.groundY);
            showToast('Đã thêm con gà lên sân khấu!', 'success');
        });

        // Duplicate / Delete character buttons
        document.getElementById('btnDuplicateChar')?.addEventListener('click', duplicateActiveSlot);
        document.getElementById('btnDeleteChar')?.addEventListener('click', deleteActiveSlot);

        // Active slot pill quick focus
        document.getElementById('activeSlotPill')?.addEventListener('click', () => {
            const next = (state.selected + 1) % state.slots.length;
            selectSlot(next);
        });

        // Animation search
        document.getElementById('animSearchInput')?.addEventListener('input', () => {
            updateAnimationListUI();
        });

        // Resolution select
        document.getElementById('resolutionSelect')?.addEventListener('change', (e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            if (w && h) {
                state.resolution = { width: w, height: h };
                state.app.renderer.resize(w, h);
                redrawStageBackdrop();
                showToast(`Độ phân giải: ${w} x ${h}`, 'info');
            }
        });

        // Zoom select
        document.getElementById('zoomSelect')?.addEventListener('change', (e) => {
            if (e.target.value === 'fit') {
                const viewport = document.getElementById('editorViewport');
                const vW = viewport.clientWidth - 40;
                const vH = viewport.clientHeight - 40;
                const fitScale = Math.min(vW / state.resolution.width, vH / state.resolution.height);
                setZoom(Math.max(0.2, fitScale));
            } else {
                setZoom(parseFloat(e.target.value));
            }
        });

        // Visualizer Toggles
        document.getElementById('btnToggleGrid')?.addEventListener('click', toggleGrid);
        document.getElementById('btnToggleBones')?.addEventListener('click', toggleBones);
        document.getElementById('btnToggleBoxes')?.addEventListener('click', () => {
            state.showBoxes = !state.showBoxes;
            state.slots.forEach(s => {
                if (s.hero) s.hero.setShowBoxes(state.showBoxes);
            });
            document.getElementById('btnToggleBoxes')?.classList.toggle('active', state.showBoxes);
        });

        // Quick Viewport Tools
        document.getElementById('btnQuickFaceLeft')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) active.hero.faceLeft();
        });
        document.getElementById('btnQuickFaceRight')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) active.hero.faceRight();
        });
        document.getElementById('btnQuickCenter')?.addEventListener('click', centerCameraOnActive);

        // Timeline controls
        document.getElementById('btnPlayPause')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.togglePause();
                updateTimelinePlayButton();
            }
        });

        document.getElementById('btnFirstFrame')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.pause();
                active.hero.setTime(0);
                updateTimelinePlayButton();
                updateTimelineScrubberProgress();
            }
        });

        document.getElementById('btnPrevFrame')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.pause();
                active.hero.setTime(active.hero.getTime() - 50);
                updateTimelinePlayButton();
                updateTimelineScrubberProgress();
            }
        });

        document.getElementById('btnNextFrame')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.pause();
                active.hero.setTime(active.hero.getTime() + 50);
                updateTimelinePlayButton();
                updateTimelineScrubberProgress();
            }
        });

        document.getElementById('btnLastFrame')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.pause();
                active.hero.setTime(active.hero.getDuration());
                updateTimelinePlayButton();
                updateTimelineScrubberProgress();
            }
        });

        document.getElementById('btnLoopToggle')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.setLoop(!active.hero.loop);
                updateTimelineUI();
            }
        });

        document.getElementById('playbackSpeedSelect')?.addEventListener('change', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.setSpeed(parseFloat(e.target.value));
            }
        });

        document.getElementById('btnTimelineFaceLeft')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) active.hero.faceLeft();
        });
        document.getElementById('btnTimelineFaceRight')?.addEventListener('click', () => {
            const active = getActiveSlot();
            if (active && active.hero) active.hero.faceRight();
        });

        // Timeline Scrubbing Drag / Click
        const timelineTrack = document.getElementById('timelineTrack');
        if (timelineTrack) {
            const handleScrub = (e) => {
                const rect = timelineTrack.getBoundingClientRect();
                const factor = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const active = getActiveSlot();
                if (active && active.hero) {
                    active.hero.seek(factor);
                    updateTimelineScrubberProgress();
                }
            };

            timelineTrack.addEventListener('pointerdown', (e) => {
                state.isScrubbing = true;
                handleScrub(e);
            });

            window.addEventListener('pointermove', (e) => {
                if (state.isScrubbing) {
                    handleScrub(e);
                }
            });

            window.addEventListener('pointerup', () => {
                state.isScrubbing = false;
            });
        }

        // Stage Backdrop & Ground
        document.getElementById('stageBgPresetSelect')?.addEventListener('change', (e) => {
            state.bgPreset = e.target.value;
            redrawStageBackdrop();
        });

        document.getElementById('groundHeightSlider')?.addEventListener('input', (e) => {
            state.groundY = parseInt(e.target.value, 10);
            const valLabel = document.getElementById('groundHeightValue');
            if (valLabel) valLabel.textContent = `${state.groundY}px`;
            redrawStageBackdrop();
        });

        // Inspector Inputs
        document.getElementById('propSlotName')?.addEventListener('input', (e) => {
            const active = getActiveSlot();
            if (active) {
                active.name = e.target.value;
                updateSlotListUI();
            }
        });

        document.getElementById('propEntitySelect')?.addEventListener('change', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.setEntity(e.target.value);
                active.animations = active.hero.getAnimationNames();
                updateAnimationListUI();
            }
        });

        document.getElementById('propPosX')?.addEventListener('input', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) active.hero.x = parseFloat(e.target.value) || 0;
        });

        document.getElementById('propPosY')?.addEventListener('input', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) active.hero.y = parseFloat(e.target.value) || 0;
        });

        document.getElementById('propScaleX')?.addEventListener('input', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val !== 0) {
                    active.hero.flipX = val < 0;
                    active.hero.scale.x = Math.abs(val);
                }
            }
        });

        document.getElementById('propScaleY')?.addEventListener('input', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                    active.hero.scale.y = val;
                }
            }
        });

        document.getElementById('propRotation')?.addEventListener('input', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) active.hero.rotation = (parseFloat(e.target.value) || 0) * (Math.PI / 180);
        });

        document.getElementById('propAlphaSlider')?.addEventListener('input', (e) => {
            const active = getActiveSlot();
            if (active && active.hero) {
                active.hero.alpha = parseFloat(e.target.value);
                document.getElementById('propAlphaValue').textContent = active.hero.alpha.toFixed(1);
            }
        });

        // Modals
        setupModals();
    }

    function setupModals() {
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            });
        });

        // PixiJS Code Modal
        document.getElementById('btnExportCode')?.addEventListener('click', () => {
            const active = getActiveSlot() || state.slots[0];
            const charKey = active ? active.key : 'boy';
            const animName = (active && active.hero.currentAnimationName) || 'idle';

            const code = `// ==========================================
// PixiJS Spriter Runtime Integration Code
// ==========================================

import * as PIXI from 'pixi.js';
// Or include 'js/pixi-spriter.js' via script tag

async function createGame() {
    // 1. Initialize PixiJS Application
    const app = new PIXI.Application();
    await app.init({
        width: ${state.resolution.width},
        height: ${state.resolution.height},
        backgroundColor: 0x1a1a2e,
        antialias: true
    });
    document.body.appendChild(app.canvas);

    // 2. Preload Spriter Character Asset (.scon + Atlas .json + Texture .png)
    await pixiSpriterLoader.load(
        '${charKey}',
        'assets/${charKey}/${charKey}.scon',
        'assets/${charKey}/${charKey}.json',
        'assets/${charKey}/${charKey}.png'
    );

    // 3. Instantiate SpriterObject
    const hero = pixiSpriterLoader.create('${charKey}', {
        entity: '${active ? active.hero.currentEntityName : 'Player'}',
        animation: '${animName}',
        loop: true,
        autoplay: true,
        speed: 1.0,
        showBones: false
    });

    // 4. Position & Scale on Stage
    hero.x = ${active ? Math.round(active.hero.x) : 400};
    hero.y = ${active ? Math.round(active.hero.y) : 600};
    app.stage.addChild(hero);

    // 5. Playback & Animation Controls
    // hero.play('walk', { loop: true });
    // hero.faceLeft();
    // hero.faceRight();
    // hero.pause();
    // hero.resume();

    // 6. Hook into Pixi Ticker Loop
    app.ticker.add((ticker) => {
        hero.update(ticker.deltaMS);
    });
}

createGame();
`;
            const area = document.getElementById('codeExportArea');
            if (area) area.value = code;
            document.getElementById('codeModal')?.classList.add('active');
        });

        document.getElementById('btnCopyCode')?.addEventListener('click', () => {
            const area = document.getElementById('codeExportArea');
            if (area) {
                area.select();
                navigator.clipboard.writeText(area.value);
                showToast('Đã sao chép mã nguồn PixiJS vào Clipboard!', 'success');
            }
        });

        // Scene JSON Modal
        document.getElementById('btnExportJson')?.addEventListener('click', () => {
            const data = {
                resolution: state.resolution,
                groundY: state.groundY,
                bgPreset: state.bgPreset,
                characters: state.slots.map(s => ({
                    id: s.id,
                    name: s.name,
                    key: s.key,
                    entity: s.hero.currentEntityName,
                    animation: s.hero.currentAnimationName,
                    x: Math.round(s.hero.x),
                    y: Math.round(s.hero.y),
                    scaleX: Number((s.hero.scale.x * (s.hero.flipX ? -1 : 1)).toFixed(2)),
                    scaleY: Number(s.hero.scale.y.toFixed(2)),
                    rotation: Number(s.hero.rotation.toFixed(3)),
                    alpha: Number(s.hero.alpha.toFixed(2)),
                    loop: s.hero.loop,
                    speed: s.hero.speed
                }))
            };
            const area = document.getElementById('jsonExportArea');
            if (area) area.value = JSON.stringify(data, null, 2);
            document.getElementById('jsonModal')?.classList.add('active');
        });

        document.getElementById('btnCopyJson')?.addEventListener('click', () => {
            const area = document.getElementById('jsonExportArea');
            if (area) {
                area.select();
                navigator.clipboard.writeText(area.value);
                showToast('Đã sao chép Scene JSON vào Clipboard!', 'success');
            }
        });

        document.getElementById('btnApplyJson')?.addEventListener('click', () => {
            const area = document.getElementById('jsonExportArea');
            if (area && area.value.trim()) {
                applySceneJson(area.value.trim());
            } else {
                showToast('Vui lòng nhập dữ liệu JSON hợp lệ!', 'warn');
            }
        });

        // Hotkeys modal
        document.getElementById('btnHotkeysModal')?.addEventListener('click', () => {
            document.getElementById('hotkeysModal')?.classList.add('active');
        });

        // Custom SCON Import Modal & Drag-Drop
        const dropZone = document.getElementById('importDropZone');
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('dragover');
                });
            });

            dropZone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files);
                let sconFile = null, atlasFile = null;
                const imageFiles = [];

                files.forEach(f => {
                    const name = f.name.toLowerCase();
                    if (name.endsWith('.scon')) sconFile = f;
                    else if (name.endsWith('.json')) atlasFile = f;
                    else if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.webp')) imageFiles.push(f);
                });

                if (sconFile) {
                    const dt1 = new DataTransfer(); dt1.items.add(sconFile);
                    const el1 = document.getElementById('fileInputScon'); if (el1) el1.files = dt1.files;
                    const baseName = sconFile.name.replace(/\.scon$/i, '');
                    const keyInput = document.getElementById('importCharKey');
                    if (keyInput) keyInput.value = baseName;
                }
                if (atlasFile) {
                    const dt2 = new DataTransfer(); dt2.items.add(atlasFile);
                    const el2 = document.getElementById('fileInputAtlas'); if (el2) el2.files = dt2.files;
                }
                if (imageFiles.length > 0) {
                    const dt3 = new DataTransfer();
                    imageFiles.forEach(f => dt3.items.add(f));
                    const el3 = document.getElementById('fileInputPng'); if (el3) el3.files = dt3.files;
                }

                if (sconFile && (atlasFile || imageFiles.length > 0)) {
                    showToast('Đã nhận diện các file Spriter!', 'success');
                } else {
                    showToast('Đã nhận một số file. Vui lòng chọn thêm các file còn thiếu.', 'info');
                }
            });

            dropZone.addEventListener('click', () => {
                document.getElementById('fileInputScon')?.click();
            });
        }

        document.getElementById('btnOpenImportModal')?.addEventListener('click', () => {
            document.getElementById('importModal')?.classList.add('active');
        });

        // Spine Import Modal open/close hooks
        document.getElementById('btnOpenSpineModal')?.addEventListener('click', () => {
            document.getElementById('spineModal')?.classList.add('active');
        });

        document.getElementById('btnConfirmSpineImport')?.addEventListener('click', () => {
            showToast('Chức năng Spine đang được phát triển, vui lòng sử dụng Spriter SCON!', 'info');
            document.getElementById('spineModal')?.classList.remove('active');
        });

        document.getElementById('btnConfirmImport')?.addEventListener('click', async () => {
            const sconInput = document.getElementById('fileInputScon');
            const atlasInput = document.getElementById('fileInputAtlas');
            const pngInput = document.getElementById('fileInputPng');
            const keyInput = document.getElementById('importCharKey');
            const key = (keyInput && keyInput.value.trim()) || ('custom_' + Date.now());

            if (!sconInput?.files[0]) {
                showToast('Vui lòng chọn file .scon!', 'warn');
                return;
            }

            let atlasText = '';
            let pngDataUrl = '';
            const hasAtlasJson = atlasInput && atlasInput.files[0];
            const hasAnyPngFiles = pngInput && pngInput.files.length > 0;

            try {
                if (hasAtlasJson) {
                    // Manual mode: User provided pre-packed atlas.json + atlas.png
                    if (!hasAnyPngFiles) {
                        showToast('Vui lòng chọn file hình ảnh Atlas Texture (.png)!', 'warn');
                        return;
                    }
                    atlasText = await atlasInput.files[0].text();
                    pngDataUrl = await new Promise((res) => {
                        const r = new FileReader();
                        r.onload = () => res(r.result);
                        r.readAsDataURL(pngInput.files[0]);
                    });
                } else {
                    // Auto mode: Pack individual images into a single atlas dynamically
                    if (!pngInput || pngInput.files.length === 0) {
                        showToast('Vui lòng chọn một hoặc nhiều ảnh lẻ (.png, .jpg) để tự động tạo atlas!', 'warn');
                        return;
                    }

                    showToast('Đang tự động tạo atlas từ các ảnh lẻ...', 'info');
                    const sconText = await sconInput.files[0].text();
                    const scon = JSON.parse(sconText);

                    // Extract list of required files from the SCON structure
                    const sconFiles = [];
                    if (scon.folder) {
                        scon.folder.forEach(folder => {
                            if (folder.file) {
                                folder.file.forEach(file => {
                                    sconFiles.push(file);
                                });
                            }
                        });
                    }

                    const uploadedFiles = Array.from(pngInput.files);
                    const uploadedMap = new Map();
                    uploadedFiles.forEach(file => {
                        const base = file.name.toLowerCase().split('/').pop();
                        uploadedMap.set(base, file);
                    });

                    const matchedFiles = [];
                    const missingFiles = [];
                    sconFiles.forEach(sconFile => {
                        const base = sconFile.name.toLowerCase().split('/').pop();
                        const file = uploadedMap.get(base);
                        if (file) {
                            matchedFiles.push({ sconName: sconFile.name, file: file });
                        } else {
                            missingFiles.push(sconFile.name);
                        }
                    });

                    if (missingFiles.length > 0) {
                        console.warn('Một số hình ảnh định nghĩa trong SCON không tìm thấy:', missingFiles);
                    }

                    if (matchedFiles.length === 0) {
                        showToast('Không tìm thấy hình ảnh nào khớp với dữ liệu trong file SCON!', 'error');
                        return;
                    }

                    // Load each image asynchronously
                    const loadedImages = await Promise.all(matchedFiles.map(async (item) => {
                        const dUrl = await new Promise((res) => {
                            const r = new FileReader();
                            r.onload = () => res(r.result);
                            r.readAsDataURL(item.file);
                        });
                        const img = await new Promise((res, rej) => {
                            const image = new Image();
                            image.onload = () => res(image);
                            image.onerror = rej;
                            image.src = dUrl;
                        });
                        return {
                            sconName: item.sconName,
                            img: img,
                            width: img.width,
                            height: img.height
                        };
                    }));

                    // Simple layout packer: Sort by height descending
                    loadedImages.sort((a, b) => b.height - a.height);

                    const maxAtlasWidth = 2048;
                    let atlasWidth = 0;
                    let atlasHeight = 0;
                    let currentX = 0;
                    let currentY = 0;
                    let rowHeight = 0;
                    const placements = [];

                    loadedImages.forEach(item => {
                        if (currentX + item.width > maxAtlasWidth) {
                            currentX = 0;
                            currentY += rowHeight;
                            rowHeight = 0;
                        }
                        placements.push({
                            image: item,
                            x: currentX,
                            y: currentY
                        });
                        rowHeight = Math.max(rowHeight, item.height);
                        currentX += item.width;
                        atlasWidth = Math.max(atlasWidth, currentX);
                        atlasHeight = Math.max(atlasHeight, currentY + rowHeight);
                    });

                    // Draw images on canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = atlasWidth;
                    canvas.height = atlasHeight;
                    const ctx = canvas.getContext('2d');

                    const frames = [];
                    placements.forEach(p => {
                        ctx.drawImage(p.image.img, p.x, p.y);
                        frames.push({
                            filename: p.image.sconName,
                            frame: { x: p.x, y: p.y, w: p.image.width, h: p.image.height },
                            rotated: false,
                            trimmed: false,
                            spriteSourceSize: { x: 0, y: 0, w: p.image.width, h: p.image.height },
                            sourceSize: { w: p.image.width, h: p.image.height }
                        });
                    });

                    const generatedAtlas = {
                        frames: frames,
                        meta: {
                            app: "Antigravity Atlas Generator",
                            format: "RGBA8888",
                            image: "atlas.png",
                            scale: 1,
                            size: { w: atlasWidth, h: atlasHeight }
                        }
                    };

                    atlasText = JSON.stringify(generatedAtlas);
                    pngDataUrl = canvas.toDataURL();
                    showToast('Đã tự động tạo texture atlas thành công!', 'success');
                }

                const sconText = await sconInput.files[0].text();
                await pixiSpriterLoader.loadFromData(key, sconText, atlasText, pngDataUrl);
                addCharacterSlot(key, key.toUpperCase(), state.resolution.width / 2, state.groundY);
                document.getElementById('importModal')?.classList.remove('active');
                // Reset các input file để người dùng có thể nhập lại
                if (sconInput) sconInput.value = '';
                if (atlasInput) atlasInput.value = '';
                if (pngInput) pngInput.value = '';
                if (keyInput) keyInput.value = '';
                showToast(`Đã nhập nhân vật ${key} thành công!`, 'success');
            } catch (err) {
                console.error(err);
                showToast('Lỗi khi nạp nhân vật: ' + err.message, 'error');
            }
        });
    }

    async function applySceneJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data) throw new Error('Dữ liệu JSON rỗng');

            // 1. Resolution
            if (data.resolution && data.resolution.width && data.resolution.height) {
                state.resolution = { width: data.resolution.width, height: data.resolution.height };
                state.app.renderer.resize(state.resolution.width, state.resolution.height);
                const resSelect = document.getElementById('resolutionSelect');
                if (resSelect) resSelect.value = `${state.resolution.width}x${state.resolution.height}`;
            }

            // 2. Ground Y
            if (data.groundY !== undefined) {
                state.groundY = data.groundY;
                const slider = document.getElementById('groundHeightSlider');
                const valLabel = document.getElementById('groundHeightValue');
                if (slider) slider.value = state.groundY;
                if (valLabel) valLabel.textContent = `${state.groundY}px`;
            }

            // 3. Background Preset
            if (data.bgPreset) {
                state.bgPreset = data.bgPreset;
                const bgSelect = document.getElementById('stageBgPresetSelect');
                if (bgSelect) bgSelect.value = state.bgPreset;
            }
            redrawStageBackdrop();

            // 4. Characters
            if (Array.isArray(data.characters) && data.characters.length > 0) {
                // Remove existing
                state.slots.forEach(s => {
                    if (s.hero) state.characterLayer.removeChild(s.hero);
                });
                state.slots = [];

                for (const charData of data.characters) {
                    const key = charData.key || 'boy';
                    const name = charData.name || key.toUpperCase();
                    const slot = addCharacterSlot(key, name, charData.x, charData.y);
                    if (slot && slot.hero) {
                        if (charData.entity) slot.hero.setEntity(charData.entity);
                        if (charData.animation) slot.hero.play(charData.animation);
                        if (charData.scaleX !== undefined && charData.scaleY !== undefined) {
                            slot.hero.flipX = charData.scaleX < 0;
                            slot.hero.scale.set(Math.abs(charData.scaleX), charData.scaleY);
                        }
                        if (charData.rotation !== undefined) slot.hero.rotation = charData.rotation;
                        if (charData.alpha !== undefined) slot.hero.alpha = charData.alpha;
                        if (charData.loop !== undefined) slot.hero.loop = charData.loop;
                        if (charData.speed !== undefined) slot.hero.speed = charData.speed;
                    }
                }
                selectSlot(0);
            }

            document.getElementById('jsonModal')?.classList.remove('active');
            showToast('Đã áp dụng dữ liệu Scene JSON thành công!', 'success');
        } catch (err) {
            console.error('Error applying Scene JSON:', err);
            showToast('Lỗi áp dụng Scene JSON: ' + err.message, 'error');
        }
    }

})();