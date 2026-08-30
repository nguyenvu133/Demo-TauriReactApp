/**
 * PixiJS Drag & Drop Scene Editor Application
 * Full-featured visual scene designer for 2D games and RPG Maker MV / Pixi projects.
 */
(function() {
    'use strict';

    // --- Editor State ---
    const state = {
        app: null,
        sceneLayer: null,
        gizmoLayer: null,
        gridLayer: null,
        playLayer: null,
        objects: [],
        selectedObject: null,
        mode: 'edit', // 'edit' | 'play'
        resolution: { width: 816, height: 624 },
        currentSceneId: 'dog_arena',
        currentSceneName: 'Save The Dog - Arena Vùng Núi',
        currentSceneTag: 'RPG MV',
        isDirty: false,
        scenesCache: [],
        sceneFilter: 'all',
        sceneSearchQuery: '',
        zoom: 1.0,
        pan: { x: 0, y: 0 },
        isPanning: false,
        panStart: { x: 0, y: 0 },
        gridSize: 32,
        gridSnap: true,
        showGrid: true,
        bgColor: 0x101b35,
        history: [],
        historyIndex: -1,
        activeGizmoAction: null, // 'drag' | 'resize' | 'rotate'
        gizmoHandle: null,
        dragStartPos: { x: 0, y: 0 },
        objStartTransform: {},
        idCounter: 1
    };

    // built-in asset list from workspace
    const ASSETS = {
        enemies: [
            'Angel.png', 'Assassin.png', 'Bat.png', 'Behemoth.png', 'Captain.png',
            'Cerberus.png', 'Chimera.png', 'Cockatrice.png', 'Darklord-final.png', 'Darklord.png',
            'Death.png', 'Demon.png', 'Dragon.png', 'Earthspirit.png', 'Evilgod.png',
            'Fairy.png', 'Fanatic.png', 'Firespirit.png', 'Gargoyle.png', 'Garuda.png',
            'Gazer.png', 'Ghost.png', 'God.png', 'Goddess.png', 'Hornet.png',
            'Imp.png', 'Irongiant.png', 'Jellyfish.png', 'Lamia.png', 'Mage.png',
            'Mimic.png', 'Minotaur.png', 'Ogre.png', 'Orc.png', 'Plant.png',
            'Puppet.png', 'Rat.png', 'Rogue.png', 'Sahuagin.png', 'Scorpion.png',
            'Skeleton.png', 'Slime.png', 'Snake.png', 'Soldier.png', 'Spider.png',
            'Succubus.png', 'Swordsman.png', 'Vampire.png', 'Waterspirit.png', 'Werewolf.png',
            'Willowisp.png', 'Windspirit.png'
        ],
        characters: [
            'Actor1.png', 'Actor2.png', 'Damage1.png'
        ],
        animations: [
            'ClawSpecial1.png', 'Curse.png', 'Hit1.png', 'Hit2.png', 'HitFire.png',
            'HitIce.png', 'HitPhoton.png', 'HitSpecial1.png', 'HitSpecial2.png', 'HitThunder.png',
            'Howl.png', 'Ice4.png', 'Mist.png', 'Slash.png', 'SlashFire.png',
            'SlashIce.png', 'SlashPhoton.png', 'SlashSpecial2.png', 'SlashSpecial3.png', 'SlashThunder.png',
            'Song.png', 'Sonic.png', 'Special1.png', 'Special2.png', 'StateDown1.png', 'StickPhoton.png'
        ],
        system: [
            'Balloon.png', 'ButtonSet.png', 'GameOver.png', 'IconSet.png',
            'MadeWithMv.png', 'Shadow1.png', 'Shadow2.png', 'States.png'
        ]
    };

    // --- Application Initialization ---
    async function initEditor() {
        const container = document.getElementById('canvasWrapper');
        if (!container) return;

        try {
            // Support both PixiJS v8 and legacy PixiJS v4/v5/v7
            if (PIXI.Application.prototype.init) {
                state.app = new PIXI.Application();
                await state.app.init({
                    width: state.resolution.width,
                    height: state.resolution.height,
                    backgroundColor: state.bgColor,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            } else {
                state.app = new PIXI.Application({
                    width: state.resolution.width,
                    height: state.resolution.height,
                    backgroundColor: state.bgColor,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            }

            const canvas = state.app.canvas || state.app.view;
            container.appendChild(canvas);

            // Create Layer Containers
            state.gridLayer = new PIXI.Container();
            state.gridLayer.name = '__gridLayer__';
            state.sceneLayer = new PIXI.Container();
            state.sceneLayer.name = '__sceneLayer__';
            state.gizmoLayer = new PIXI.Container();
            state.gizmoLayer.name = '__gizmoLayer__';

            state.app.stage.addChild(state.gridLayer);
            state.app.stage.addChild(state.sceneLayer);
            state.app.stage.addChild(state.gizmoLayer);

            // Enable event mode on stage
            if (state.app.stage.eventMode !== undefined) {
                state.app.stage.eventMode = 'static';
                state.app.stage.hitArea = new PIXI.Rectangle(0, 0, state.resolution.width, state.resolution.height);
            } else {
                state.app.stage.interactive = true;
                state.app.stage.hitArea = new PIXI.Rectangle(0, 0, state.resolution.width, state.resolution.height);
            }

            // Draw initial grid
            renderGrid();

            // Setup viewport listeners (pan, zoom, canvas interactions)
            setupViewportInteractions();

            // Setup UI Components
            setupAssetPalette();
            setupHierarchy();
            setupInspector();
            setupTopBar();
            setupSceneManagerUI();
            setupDragAndDrop();
            setupKeyboardShortcuts();

            // Load initial scene list and default scene
            await fetchScenesList();
            if (state.scenesCache.length > 0) {
                await loadSceneById(state.scenesCache[0].id);
            } else {
                loadTemplate('dog_arena');
            }

            // Start animation loop for Gizmos & Play mode
            state.app.ticker.add(editorUpdateLoop);

            showToast('Bộ công cụ Scene Editor đã sẵn sàng!', 'success');
        } catch (err) {
            console.error('Failed to initialize Pixi Scene Editor:', err);
            showToast('Lỗi khởi tạo Pixi Editor: ' + err.message, 'error');
        }
    }

    // --- Grid Rendering ---
    function renderGrid() {
        if (!state.gridLayer) return;
        state.gridLayer.removeChildren();

        if (!state.showGrid) return;

        const g = new PIXI.Graphics();
        const w = state.resolution.width;
        const h = state.resolution.height;
        const step = state.gridSize;

        // Draw background bounds
        g.lineStyle(1, 0x388bfd, 0.4);
        g.drawRect(0, 0, w, h);

        // Draw sub-grid lines
        g.lineStyle(1, 0xffffff, 0.07);
        for (let x = step; x < w; x += step) {
            g.moveTo(x, 0);
            g.lineTo(x, h);
        }
        for (let y = step; y < h; y += step) {
            g.moveTo(0, y);
            g.lineTo(w, y);
        }

        // Major center axes
        g.lineStyle(1, 0x58a6ff, 0.25);
        g.moveTo(w / 2, 0);
        g.lineTo(w / 2, h);
        g.moveTo(0, h / 2);
        g.lineTo(w, h / 2);

        state.gridLayer.addChild(g);
    }

    // --- Viewport & Coordinate Utilities ---
    function setupViewportInteractions() {
        const viewport = document.getElementById('editorViewport');
        const wrapper = document.getElementById('canvasWrapper');
        if (!viewport || !wrapper) return;

        // Mouse Wheel Zoom
        viewport.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey || !e.altKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoom(state.zoom + delta);
            }
        }, { passive: false });

        // Middle mouse button or Space+Drag Pan
        viewport.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
                e.preventDefault();
                state.isPanning = true;
                state.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
                viewport.classList.add('panning');
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (state.isPanning) {
                state.pan.x = e.clientX - state.panStart.x;
                state.pan.y = e.clientY - state.panStart.y;
                updateViewportTransform();
            }

            // Update status bar mouse position in scene coordinates
            const canvasPos = clientToSceneCoords(e.clientX, e.clientY);
            const mouseCoordEl = document.getElementById('statusCoords');
            if (mouseCoordEl && canvasPos) {
                mouseCoordEl.textContent = `X: ${Math.round(canvasPos.x)}, Y: ${Math.round(canvasPos.y)}`;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (state.isPanning) {
                state.isPanning = false;
                viewport.classList.remove('panning');
            }
        });

        // Stage click for deselecting or selection box
        const canvas = state.app.canvas || state.app.view;
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.targetGizmo) {
                const pos = clientToSceneCoords(e.clientX, e.clientY);
                const clickedObj = getObjectAtScenePos(pos.x, pos.y);
                if (clickedObj) {
                    selectObject(clickedObj);
                } else if (!e.shiftKey) {
                    selectObject(null);
                }
            }
        });
    }

    function setZoom(val) {
        state.zoom = Math.max(0.2, Math.min(3.0, val));
        updateViewportTransform();
        const zoomEl = document.getElementById('statusZoom');
        if (zoomEl) zoomEl.textContent = `${Math.round(state.zoom * 100)}%`;
        const zoomSelect = document.getElementById('zoomSelect');
        if (zoomSelect) zoomSelect.value = state.zoom.toFixed(2);
    }

    function updateViewportTransform() {
        const wrapper = document.getElementById('canvasWrapper');
        if (!wrapper) return;
        wrapper.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    }

    function clientToSceneCoords(clientX, clientY) {
        const canvas = state.app ? (state.app.canvas || state.app.view) : null;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = state.resolution.width / rect.width;
        const scaleY = state.resolution.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function snapValue(val, step) {
        if (!state.gridSnap) return Math.round(val);
        return Math.round(val / step) * step;
    }

    function getObjectAtScenePos(x, y) {
        // Iterate backwards through objects list to hit top-most object first
        for (let i = state.objects.length - 1; i >= 0; i--) {
            const obj = state.objects[i];
            if (!obj.pixiObj || !obj.pixiObj.visible || obj.locked) continue;
            const bounds = obj.pixiObj.getBounds();
            // Convert bounds relative to scene
            if (obj.pixiObj.containsPoint) {
                const p = new PIXI.Point(x, y);
                if (obj.pixiObj.containsPoint(p)) return obj;
            }
            // Bounding box hit test fallback
            const globalBounds = obj.pixiObj.getBounds();
            const canvas = state.app.canvas || state.app.view;
            const rect = canvas.getBoundingClientRect();
            const sx = (x / state.resolution.width) * rect.width + rect.left;
            const sy = (y / state.resolution.height) * rect.height + rect.top;
            if (globalBounds.contains(sx, sy)) return obj;
        }
        return null;
    }

    // --- Scene Object Factory ---
    function createObject(config) {
        const id = 'obj_' + (state.idCounter++);
        const type = config.type || 'sprite';
        const name = config.name || `${type}_${state.idCounter - 1}`;
        let pixiObj = null;

        if (type === 'sprite') {
            try {
                if (config.texture) {
                    pixiObj = new PIXI.Sprite(config.texture);
                } else if (config.src) {
                    pixiObj = PIXI.Sprite.from(config.src);
                } else {
                    // Placeholder box sprite
                    const g = new PIXI.Graphics();
                    g.beginFill(0x58a6ff, 0.8);
                    g.drawRect(0, 0, 64, 64);
                    g.endFill();
                    const tex = state.app.renderer.generateTexture(g);
                    pixiObj = new PIXI.Sprite(tex);
                }
            } catch (e) {
                console.warn('Error loading texture:', e);
                const g = new PIXI.Graphics();
                g.beginFill(0x58a6ff, 0.8);
                g.drawRect(0, 0, 64, 64);
                g.endFill();
                const tex = state.app.renderer.generateTexture(g);
                pixiObj = new PIXI.Sprite(tex);
            }
            pixiObj.anchor.set(config.anchorX !== undefined ? config.anchorX : 0.5, config.anchorY !== undefined ? config.anchorY : 0.5);
        } else if (type === 'text') {
            const style = {
                fontFamily: config.fontFamily || 'Arial',
                fontSize: config.fontSize || 24,
                fill: config.fill || '#ffffff',
                fontWeight: config.fontWeight || 'normal',
                fontStyle: config.fontStyle || 'normal',
                align: config.align || 'center',
                stroke: config.stroke || '#000000',
                strokeThickness: config.strokeThickness || 0,
                dropShadow: config.dropShadow || false,
                dropShadowColor: config.dropShadowColor || '#000000',
                dropShadowBlur: config.dropShadowBlur || 4,
                dropShadowDistance: config.dropShadowDistance || 3
            };
            pixiObj = new PIXI.Text(config.text || 'Nhập văn bản...', style);
            pixiObj.anchor.set(config.anchorX !== undefined ? config.anchorX : 0.5, config.anchorY !== undefined ? config.anchorY : 0.5);
        } else if (type === 'shape') {
            pixiObj = new PIXI.Graphics();
            drawShapeGraphics(pixiObj, config);
        } else if (type === 'container') {
            pixiObj = new PIXI.Container();
        }

        if (!pixiObj) return null;

        // Apply initial transforms
        pixiObj.name = name;
        pixiObj.x = config.x !== undefined ? config.x : state.resolution.width / 2;
        pixiObj.y = config.y !== undefined ? config.y : state.resolution.height / 2;
        pixiObj.scale.set(config.scaleX !== undefined ? config.scaleX : 1, config.scaleY !== undefined ? config.scaleY : 1);
        pixiObj.rotation = config.rotation !== undefined ? config.rotation : 0;
        pixiObj.alpha = config.alpha !== undefined ? config.alpha : 1;
        if (config.tint !== undefined) pixiObj.tint = config.tint;

        // Custom editor metadata wrapper
        const sceneItem = {
            id: id,
            name: name,
            type: type,
            tag: config.tag || 'Default',
            src: config.src || '',
            shapeType: config.shapeType || 'rect',
            shapeWidth: config.shapeWidth || 64,
            shapeHeight: config.shapeHeight || 64,
            fillColor: config.fillColor || '#388bfd',
            fillAlpha: config.fillAlpha !== undefined ? config.fillAlpha : 1,
            strokeColor: config.strokeColor || '#58a6ff',
            strokeWidth: config.strokeWidth || 2,
            radius: config.radius || 32,
            cornerRadius: config.cornerRadius || 8,
            behavior: config.behavior || 'none',
            customData: config.customData || {},
            locked: config.locked || false,
            visible: config.visible !== undefined ? config.visible : true,
            pixiObj: pixiObj
        };

        pixiObj.__sceneItem = sceneItem;

        // Enable interactivity
        enableObjectInteractivity(sceneItem);

        state.sceneLayer.addChild(pixiObj);
        state.objects.push(sceneItem);

        updateHierarchy();
        selectObject(sceneItem);
        recordHistory('Thêm ' + name);

        return sceneItem;
    }

    function drawShapeGraphics(g, config) {
        g.clear();
        const shapeType = config.shapeType || 'rect';
        const w = config.shapeWidth || 64;
        const h = config.shapeHeight || 64;
        const fillCol = parseColor(config.fillColor || '#388bfd');
        const fillAlp = config.fillAlpha !== undefined ? config.fillAlpha : 1;
        const strokeCol = parseColor(config.strokeColor || '#58a6ff');
        const strokeW = config.strokeWidth || 0;
        const r = config.radius || 32;
        const cr = config.cornerRadius || 8;

        if (strokeW > 0) {
            g.lineStyle(strokeW, strokeCol, 1);
        }
        g.beginFill(fillCol, fillAlp);

        if (shapeType === 'rect') {
            g.drawRect(-w / 2, -h / 2, w, h);
        } else if (shapeType === 'rounded_rect') {
            g.drawRoundedRect(-w / 2, -h / 2, w, h, cr);
        } else if (shapeType === 'circle') {
            g.drawCircle(0, 0, r);
        } else if (shapeType === 'star') {
            drawStarPoly(g, 0, 0, 5, r, r / 2);
        } else if (shapeType === 'ellipse') {
            g.drawEllipse(0, 0, w / 2, h / 2);
        }
        g.endFill();
    }

    function drawStarPoly(g, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        g.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            g.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            g.lineTo(x, y);
            rot += step;
        }
        g.lineTo(cx, cy - outerRadius);
    }

    function parseColor(colorVal) {
        if (typeof colorVal === 'number') return colorVal;
        if (typeof colorVal === 'string') {
            if (colorVal.startsWith('#')) return parseInt(colorVal.slice(1), 16);
            if (colorVal.startsWith('0x')) return parseInt(colorVal, 16);
        }
        return 0xffffff;
    }

    // --- Direct Object Interactivity & Gizmos ---
    function enableObjectInteractivity(sceneItem) {
        const p = sceneItem.pixiObj;
        if (p.eventMode !== undefined) {
            p.eventMode = 'static';
            p.cursor = 'move';
        } else {
            p.interactive = true;
            p.buttonMode = true;
        }

        p.on('pointerdown', (e) => {
            if (state.mode === 'play' || sceneItem.locked) return;
            if (e.data && e.data.originalEvent && e.data.originalEvent.button !== 0) return;
            e.stopPropagation();

            selectObject(sceneItem);
            startTransformAction('drag', null, e);
        });
    }

    function selectObject(sceneItem) {
        state.selectedObject = sceneItem;
        updateHierarchySelection();
        updateInspector();
        renderGizmos();

        const badgeEl = document.getElementById('statusSelection');
        if (badgeEl) {
            badgeEl.textContent = sceneItem ? `${sceneItem.name} (${sceneItem.type})` : 'Không có đối tượng';
        }
    }

    function startTransformAction(action, handleType, event) {
        if (!state.selectedObject || state.selectedObject.locked) return;

        state.activeGizmoAction = action;
        state.gizmoHandle = handleType;

        const clientX = event.data ? event.data.global.x : (event.clientX || 0);
        const clientY = event.data ? event.data.global.y : (event.clientY || 0);
        const scenePos = clientToSceneCoords(clientX, clientY);

        state.dragStartPos = { x: scenePos.x, y: scenePos.y };

        const p = state.selectedObject.pixiObj;
        state.objStartTransform = {
            x: p.x,
            y: p.y,
            scaleX: p.scale.x,
            scaleY: p.scale.y,
            rotation: p.rotation,
            width: p.width,
            height: p.height
        };

        window.addEventListener('pointermove', onTransformMove);
        window.addEventListener('pointerup', onTransformEnd);
    }

    function onTransformMove(e) {
        if (!state.activeGizmoAction || !state.selectedObject) return;

        const scenePos = clientToSceneCoords(e.clientX, e.clientY);
        const dx = scenePos.x - state.dragStartPos.x;
        const dy = scenePos.y - state.dragStartPos.y;
        const p = state.selectedObject.pixiObj;
        const start = state.objStartTransform;

        if (state.activeGizmoAction === 'drag') {
            // Drag Position with grid snapping
            let newX = start.x + dx;
            let newY = start.y + dy;
            if (state.gridSnap) {
                newX = snapValue(newX, state.gridSize);
                newY = snapValue(newY, state.gridSize);
            }
            p.x = newX;
            p.y = newY;
        } else if (state.activeGizmoAction === 'resize') {
            const handle = state.gizmoHandle;
            // Handle directional scaling
            let factorX = 1;
            let factorY = 1;
            const baseW = Math.max(1, start.width);
            const baseH = Math.max(1, start.height);

            if (handle.includes('e')) factorX = 1 + (dx / baseW);
            if (handle.includes('w')) factorX = 1 - (dx / baseW);
            if (handle.includes('s')) factorY = 1 + (dy / baseH);
            if (handle.includes('n')) factorY = 1 - (dy / baseH);

            if (e.shiftKey) { // Proportional scale
                const maxFactor = Math.max(Math.abs(factorX), Math.abs(factorY));
                factorX = maxFactor * Math.sign(factorX || 1);
                factorY = maxFactor * Math.sign(factorY || 1);
            }

            p.scale.x = start.scaleX * factorX;
            p.scale.y = start.scaleY * factorY;
        } else if (state.activeGizmoAction === 'rotate') {
            // Calculate angle between object center and mouse position
            const angle = Math.atan2(scenePos.y - start.y, scenePos.x - start.x) - (Math.PI / 2);
            p.rotation = angle;
        }

        renderGizmos();
        updateInspectorFieldsFast();
    }

    function onTransformEnd() {
        if (!state.activeGizmoAction) return;
        state.activeGizmoAction = null;
        state.gizmoHandle = null;

        window.removeEventListener('pointermove', onTransformMove);
        window.removeEventListener('pointerup', onTransformEnd);

        updateInspector();
        renderGizmos();
        recordHistory('Biến đổi ' + (state.selectedObject ? state.selectedObject.name : ''));
    }

    // --- Render Gizmo Overlays ---
    function renderGizmos() {
        if (!state.gizmoLayer) return;
        state.gizmoLayer.removeChildren();

        if (state.mode === 'play' || !state.selectedObject || !state.selectedObject.pixiObj.visible) {
            return;
        }

        const obj = state.selectedObject.pixiObj;
        const g = new PIXI.Graphics();
        state.gizmoLayer.addChild(g);

        // Get unrotated local dimensions
        const bounds = obj.getLocalBounds();
        const w = bounds.width * obj.scale.x;
        const h = bounds.height * obj.scale.y;

        const container = new PIXI.Container();
        container.x = obj.x;
        container.y = obj.y;
        container.rotation = obj.rotation;
        state.gizmoLayer.addChild(container);

        const localG = new PIXI.Graphics();
        container.addChild(localG);

        // Bounding Box
        localG.lineStyle(1.5, 0x58a6ff, 1);
        const anchorX = obj.anchor ? obj.anchor.x : 0.5;
        const anchorY = obj.anchor ? obj.anchor.y : 0.5;
        const left = -w * anchorX;
        const top = -h * anchorY;

        localG.drawRect(left, top, w, h);

        // Rotation stalk line
        localG.lineStyle(1.5, 0x58a6ff, 0.8);
        localG.moveTo(0, top);
        localG.lineTo(0, top - 24);

        // Center Pivot
        localG.lineStyle(1.5, 0x58a6ff, 1);
        localG.beginFill(0xffffff, 0.9);
        localG.drawCircle(0, 0, 4);
        localG.endFill();

        // 8 Resize Handles + 1 Rotation Handle
        const handles = [
            { type: 'nw', x: left, y: top, cursor: 'nwse-resize' },
            { type: 'n',  x: left + w / 2, y: top, cursor: 'ns-resize' },
            { type: 'ne', x: left + w, y: top, cursor: 'nesw-resize' },
            { type: 'e',  x: left + w, y: top + h / 2, cursor: 'ew-resize' },
            { type: 'se', x: left + w, y: top + h, cursor: 'nwse-resize' },
            { type: 's',  x: left + w / 2, y: top + h, cursor: 'ns-resize' },
            { type: 'sw', x: left, y: top + h, cursor: 'nesw-resize' },
            { type: 'w',  x: left, y: top + h / 2, cursor: 'ew-resize' }
        ];

        handles.forEach(hnd => {
            const handleG = new PIXI.Graphics();
            handleG.lineStyle(1.5, 0x1f6feb, 1);
            handleG.beginFill(0xffffff, 1);
            handleG.drawRect(-4, -4, 8, 8);
            handleG.endFill();
            handleG.x = hnd.x;
            handleG.y = hnd.y;

            if (handleG.eventMode !== undefined) {
                handleG.eventMode = 'static';
                handleG.cursor = hnd.cursor;
            } else {
                handleG.interactive = true;
                handleG.buttonMode = true;
            }

            handleG.on('pointerdown', (e) => {
                e.stopPropagation();
                startTransformAction('resize', hnd.type, e);
            });

            container.addChild(handleG);
        });

        // Rotation handle at top of stalk
        const rotHandle = new PIXI.Graphics();
        rotHandle.lineStyle(1.5, 0x58a6ff, 1);
        rotHandle.beginFill(0x58a6ff, 1);
        rotHandle.drawCircle(0, 0, 5);
        rotHandle.endFill();
        rotHandle.x = 0;
        rotHandle.y = top - 24;

        if (rotHandle.eventMode !== undefined) {
            rotHandle.eventMode = 'static';
            rotHandle.cursor = 'grab';
        } else {
            rotHandle.interactive = true;
            rotHandle.buttonMode = true;
        }

        rotHandle.on('pointerdown', (e) => {
            e.stopPropagation();
            startTransformAction('rotate', 'rot', e);
        });

        container.addChild(rotHandle);
    }

    // --- Asset Palette & Drag-and-Drop ---
    function setupAssetPalette() {
        renderAssetCategory('enemies');

        // Category tabs
        document.querySelectorAll('.category-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                renderAssetCategory(chip.dataset.category);
            });
        });

        // Asset search
        const searchInput = document.getElementById('assetSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                document.querySelectorAll('.asset-card').forEach(card => {
                    const name = (card.dataset.name || '').toLowerCase();
                    card.style.display = name.includes(query) ? 'flex' : 'none';
                });
            });
        }
    }

    function renderAssetCategory(category) {
        const grid = document.getElementById('assetGrid');
        if (!grid) return;
        grid.innerHTML = '';

        if (category === 'primitives') {
            const prims = [
                { name: 'Hộp chữ nhật', type: 'shape', shapeType: 'rect', icon: '■' },
                { name: 'Hình bo góc', type: 'shape', shapeType: 'rounded_rect', icon: '▢' },
                { name: 'Hình tròn', type: 'shape', shapeType: 'circle', icon: '●' },
                { name: 'Ngôi sao', type: 'shape', shapeType: 'star', icon: '★' },
                { name: 'Hình Elip', type: 'shape', shapeType: 'ellipse', icon: '⬭' },
                { name: 'Tiêu đề Game', type: 'text', text: 'TIÊU ĐỀ GAME', fontSize: 36, fill: '#ffcc00', fontWeight: 'bold', icon: '🔤' },
                { name: 'Nhãn văn bản', type: 'text', text: 'Nhãn mới...', fontSize: 18, fill: '#ffffff', icon: '📝' },
                { name: 'Container nhóm', type: 'container', name: 'Group_Layer', icon: '📁' }
            ];

            prims.forEach(item => {
                const card = document.createElement('div');
                card.className = 'asset-card';
                card.draggable = true;
                card.dataset.name = item.name;
                card.dataset.payload = JSON.stringify(item);
                card.innerHTML = `
                    <div class="asset-icon-box">${item.icon}</div>
                    <div class="asset-label">${item.name}</div>
                `;
                card.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify(item));
                    e.dataTransfer.effectAllowed = 'copy';
                });
                card.addEventListener('dblclick', () => {
                    createObject(Object.assign({}, item, {
                        x: state.resolution.width / 2,
                        y: state.resolution.height / 2
                    }));
                });
                grid.appendChild(card);
            });
            return;
        }

        const list = ASSETS[category] || [];
        const folder = `img/${category}/`;

        list.forEach(fileName => {
            const cleanName = fileName.replace('.png', '').replace(/_/g, ' ');
            const fullPath = folder + fileName;

            const card = document.createElement('div');
            card.className = 'asset-card';
            card.draggable = true;
            card.dataset.name = cleanName;

            const payload = {
                type: 'sprite',
                name: cleanName,
                src: fullPath,
                tag: category === 'enemies' ? 'Enemy' : (category === 'characters' ? 'Player' : 'VFX')
            };
            card.dataset.payload = JSON.stringify(payload);

            card.innerHTML = `
                <img class="asset-thumb" src="${fullPath}" alt="${cleanName}" loading="lazy" onerror="this.style.display='none'">
                <div class="asset-label" title="${cleanName}">${cleanName}</div>
            `;

            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                e.dataTransfer.effectAllowed = 'copy';
            });

            card.addEventListener('dblclick', () => {
                createObject(Object.assign({}, payload, {
                    x: state.resolution.width / 2,
                    y: state.resolution.height / 2
                }));
            });

            grid.appendChild(card);
        });
    }

    function setupDragAndDrop() {
        const viewport = document.getElementById('editorViewport');
        const wrapper = document.getElementById('canvasWrapper');
        if (!viewport || !wrapper) return;

        // Viewport Drag Over
        viewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            wrapper.style.boxShadow = '0 0 0 2px var(--accent-blue), 0 10px 40px rgba(0,0,0,0.8)';
        });

        viewport.addEventListener('dragleave', (e) => {
            if (e.target === viewport) {
                wrapper.style.boxShadow = '';
            }
        });

        // Viewport Drop
        viewport.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.style.boxShadow = '';

            const scenePos = clientToSceneCoords(e.clientX, e.clientY);
            let dropX = Math.round(scenePos.x);
            let dropY = Math.round(scenePos.y);
            if (state.gridSnap) {
                dropX = snapValue(dropX, state.gridSize);
                dropY = snapValue(dropY, state.gridSize);
            }

            // Check if dropping local image files from computer
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        createObject({
                            type: 'sprite',
                            name: file.name.replace(/\.[^/.]+$/, ''),
                            src: re.target.result,
                            x: dropX,
                            y: dropY
                        });
                        showToast(`Đã thêm ảnh: ${file.name}`, 'success');
                    };
                    reader.readAsDataURL(file);
                    return;
                }
            }

            // Check payload from asset palette
            const rawData = e.dataTransfer.getData('text/plain');
            if (rawData) {
                try {
                    const itemData = JSON.parse(rawData);
                    itemData.x = dropX;
                    itemData.y = dropY;
                    createObject(itemData);
                    showToast(`Đã kéo thả ${itemData.name || 'đối tượng'} vào Scene`, 'success');
                } catch (err) {
                    console.warn('Invalid drop payload', err);
                }
            }
        });

        // Custom image upload input
        const fileInput = document.getElementById('customFileInput');
        const uploadZone = document.getElementById('customUploadZone');
        if (uploadZone && fileInput) {
            uploadZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        createObject({
                            type: 'sprite',
                            name: file.name.replace(/\.[^/.]+$/, ''),
                            src: re.target.result,
                            x: state.resolution.width / 2,
                            y: state.resolution.height / 2
                        });
                        showToast(`Đã tải lên ảnh: ${file.name}`, 'success');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    // --- Hierarchy Tree View ---
    function setupHierarchy() {
        const list = document.getElementById('hierarchyList');
        if (!list) return;

        // Add Quick buttons
        document.getElementById('btnLayerUp')?.addEventListener('click', () => moveSelectedLayer(1));
        document.getElementById('btnLayerDown')?.addEventListener('click', () => moveSelectedLayer(-1));
        document.getElementById('btnDeleteSelected')?.addEventListener('click', deleteSelectedObject);
        document.getElementById('btnDuplicateSelected')?.addEventListener('click', duplicateSelectedObject);
    }

    function updateHierarchy() {
        const list = document.getElementById('hierarchyList');
        if (!list) return;
        list.innerHTML = '';

        // Display in reverse order so top-most scene layer appears at top of tree
        for (let i = state.objects.length - 1; i >= 0; i--) {
            const item = state.objects[i];
            const li = document.createElement('li');
            li.className = 'tree-node' + (state.selectedObject === item ? ' selected' : '');
            li.dataset.id = item.id;

            const iconMap = { sprite: '🖼️', text: '📝', shape: '🔷', container: '📁' };
            const typeIcon = iconMap[item.type] || '📦';

            li.innerHTML = `
                <span class="node-icon">${typeIcon}</span>
                <span class="node-name" title="${item.name}">${item.name}</span>
                <span class="node-badge">${item.tag || item.type}</span>
                <div class="node-actions">
                    <button class="node-btn btn-vis" title="Ẩn/Hiện">${item.visible ? '👁️' : '🕶️'}</button>
                    <button class="node-btn btn-lock" title="Khóa/Mở">${item.locked ? '🔒' : '🔓'}</button>
                </div>
            `;

            li.addEventListener('click', (e) => {
                if (e.target.closest('.node-actions')) return;
                selectObject(item);
            });

            li.querySelector('.btn-vis').addEventListener('click', (e) => {
                e.stopPropagation();
                item.visible = !item.visible;
                item.pixiObj.visible = item.visible;
                updateHierarchy();
                renderGizmos();
                recordHistory(`Đổi ẩn/hiện ${item.name}`);
            });

            li.querySelector('.btn-lock').addEventListener('click', (e) => {
                e.stopPropagation();
                item.locked = !item.locked;
                updateHierarchy();
                renderGizmos();
                showToast(item.locked ? `Đã khóa: ${item.name}` : `Đã mở khóa: ${item.name}`, 'warning');
            });

            list.appendChild(li);
        }

        const countEl = document.getElementById('statusCount');
        if (countEl) countEl.textContent = `${state.objects.length} đối tượng`;
    }

    function updateHierarchySelection() {
        document.querySelectorAll('.tree-node').forEach(node => {
            const isSel = state.selectedObject && node.dataset.id === state.selectedObject.id;
            node.classList.toggle('selected', isSel);
        });
    }

    function moveSelectedLayer(direction) {
        if (!state.selectedObject) return;
        const idx = state.objects.indexOf(state.selectedObject);
        if (idx === -1) return;

        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= state.objects.length) return;

        const [item] = state.objects.splice(idx, 1);
        state.objects.splice(newIdx, 0, item);

        // Re-order in Pixi container
        state.sceneLayer.removeChild(item.pixiObj);
        state.sceneLayer.addChildAt(item.pixiObj, newIdx);

        updateHierarchy();
        renderGizmos();
        recordHistory('Đổi thứ tự layer');
    }

    function deleteSelectedObject() {
        if (!state.selectedObject) return;
        const idx = state.objects.indexOf(state.selectedObject);
        if (idx === -1) return;

        const item = state.selectedObject;
        state.sceneLayer.removeChild(item.pixiObj);
        state.objects.splice(idx, 1);

        state.selectedObject = null;
        updateHierarchy();
        updateInspector();
        renderGizmos();
        recordHistory('Xóa ' + item.name);
        showToast('Đã xóa ' + item.name, 'warning');
    }

    function duplicateSelectedObject() {
        if (!state.selectedObject) return;
        const original = state.selectedObject;
        const p = original.pixiObj;

        const copyConfig = {
            type: original.type,
            name: original.name + '_copy',
            tag: original.tag,
            src: original.src,
            x: p.x + 24,
            y: p.y + 24,
            scaleX: p.scale.x,
            scaleY: p.scale.y,
            rotation: p.rotation,
            alpha: p.alpha,
            tint: p.tint,
            anchorX: p.anchor ? p.anchor.x : 0.5,
            anchorY: p.anchor ? p.anchor.y : 0.5,
            shapeType: original.shapeType,
            shapeWidth: original.shapeWidth,
            shapeHeight: original.shapeHeight,
            fillColor: original.fillColor,
            fillAlpha: original.fillAlpha,
            strokeColor: original.strokeColor,
            strokeWidth: original.strokeWidth,
            radius: original.radius,
            cornerRadius: original.cornerRadius,
            behavior: original.behavior,
            text: original.type === 'text' ? p.text : '',
            fontSize: original.type === 'text' ? p.style.fontSize : 24,
            fill: original.type === 'text' ? p.style.fill : '#ffffff',
            fontFamily: original.type === 'text' ? p.style.fontFamily : 'Arial'
        };

        const newItem = createObject(copyConfig);
        showToast('Đã nhân bản: ' + newItem.name, 'success');
    }

    // --- Inspector Panel & Reactive Binding ---
    function setupInspector() {
        // Tab switching in sidebars
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const parent = tab.closest('.editor-sidebar');
                parent.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                const targetContent = document.getElementById(tab.dataset.target);
                if (targetContent) targetContent.classList.add('active');
            });
        });
    }

    function updateInspector() {
        const body = document.getElementById('inspectorBody');
        if (!body) return;

        if (!state.selectedObject) {
            body.innerHTML = `
                <div class="empty-inspector">
                    <div class="empty-inspector-icon">🎯</div>
                    <div>Chưa chọn đối tượng nào</div>
                    <div style="font-size: 11px; opacity: 0.7;">Nhấp vào đối tượng trong Canvas hoặc Cây đối tượng để chỉnh sửa thuộc tính</div>
                </div>
            `;
            return;
        }

        const item = state.selectedObject;
        const p = item.pixiObj;
        const rotDeg = Math.round((p.rotation * 180 / Math.PI) % 360);

        let typeSpecificHTML = '';

        if (item.type === 'text') {
            typeSpecificHTML = `
                <div class="prop-section">
                    <div class="prop-section-header">Văn Bản (Text)</div>
                    <div class="prop-section-body">
                        <div class="prop-row">
                            <span class="prop-label">Nội dung</span>
                            <textarea id="propTextContent" class="editor-input" rows="2" style="flex:1; resize:vertical;">${p.text || ''}</textarea>
                        </div>
                        <div class="prop-row">
                            <span class="prop-label">Cỡ chữ (px)</span>
                            <input id="propFontSize" type="number" class="editor-input" value="${p.style.fontSize || 24}" style="width:70px;">
                        </div>
                        <div class="prop-row">
                            <span class="prop-label">Màu chữ</span>
                            <input id="propTextColor" type="color" class="prop-color-picker" value="${colorToHex(p.style.fill)}">
                        </div>
                        <div class="prop-row">
                            <span class="prop-label">Viền chữ</span>
                            <input id="propStrokeColor" type="color" class="prop-color-picker" value="${colorToHex(p.style.stroke)}">
                            <input id="propStrokeWidth" type="number" class="editor-input" value="${p.style.strokeThickness || 0}" min="0" style="width:60px;">
                        </div>
                    </div>
                </div>
            `;
        } else if (item.type === 'shape') {
            typeSpecificHTML = `
                <div class="prop-section">
                    <div class="prop-section-header">Hình Học (Shape)</div>
                    <div class="prop-section-body">
                        <div class="prop-row">
                            <span class="prop-label">Loại hình</span>
                            <select id="propShapeType" class="editor-select" style="flex:1;">
                                <option value="rect" ${item.shapeType === 'rect' ? 'selected' : ''}>Hình chữ nhật</option>
                                <option value="rounded_rect" ${item.shapeType === 'rounded_rect' ? 'selected' : ''}>Hình bo góc</option>
                                <option value="circle" ${item.shapeType === 'circle' ? 'selected' : ''}>Hình tròn</option>
                                <option value="star" ${item.shapeType === 'star' ? 'selected' : ''}>Ngôi sao</option>
                                <option value="ellipse" ${item.shapeType === 'ellipse' ? 'selected' : ''}>Hình Elip</option>
                            </select>
                        </div>
                        <div class="prop-row">
                            <span class="prop-label">Màu tô</span>
                            <input id="propShapeFill" type="color" class="prop-color-picker" value="${colorToHex(item.fillColor)}">
                            <input id="propShapeFillAlpha" type="range" class="prop-slider" min="0" max="1" step="0.05" value="${item.fillAlpha}">
                        </div>
                        <div class="prop-row">
                            <span class="prop-label">Đường viền</span>
                            <input id="propShapeStroke" type="color" class="prop-color-picker" value="${colorToHex(item.strokeColor)}">
                            <input id="propShapeStrokeWidth" type="number" class="editor-input" value="${item.strokeWidth}" min="0" style="width:60px;">
                        </div>
                    </div>
                </div>
            `;
        }

        body.innerHTML = `
            <!-- General Info -->
            <div class="prop-section">
                <div class="prop-section-header">Thông Tin Chung</div>
                <div class="prop-section-body">
                    <div class="prop-row">
                        <span class="prop-label">Tên</span>
                        <input id="propName" type="text" class="editor-input" value="${item.name}" style="flex:1;">
                    </div>
                    <div class="prop-row">
                        <span class="prop-label">Tag / Nhóm</span>
                        <select id="propTag" class="editor-select" style="flex:1;">
                            <option value="Player" ${item.tag === 'Player' ? 'selected' : ''}>Player (Người chơi)</option>
                            <option value="Enemy" ${item.tag === 'Enemy' ? 'selected' : ''}>Enemy (Kẻ địch)</option>
                            <option value="Boss" ${item.tag === 'Boss' ? 'selected' : ''}>Boss (Trùm)</option>
                            <option value="Item" ${item.tag === 'Item' ? 'selected' : ''}>Item (Vật phẩm)</option>
                            <option value="Obstacle" ${item.tag === 'Obstacle' ? 'selected' : ''}>Obstacle (Chướng ngại)</option>
                            <option value="UI" ${item.tag === 'UI' ? 'selected' : ''}>UI (Giao diện)</option>
                            <option value="VFX" ${item.tag === 'VFX' ? 'selected' : ''}>VFX (Hiệu ứng)</option>
                            <option value="Default" ${item.tag === 'Default' ? 'selected' : ''}>Default</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Transform -->
            <div class="prop-section">
                <div class="prop-section-header">Vị Trí & Kích Thước (Transform)</div>
                <div class="prop-section-body">
                    <div class="prop-row">
                        <span class="prop-label">Vị trí (X, Y)</span>
                        <div class="prop-controls">
                            <div class="prop-input-group"><span class="prop-input-label">X</span><input id="propPosX" type="number" class="prop-input" value="${Math.round(p.x)}"></div>
                            <div class="prop-input-group"><span class="prop-input-label">Y</span><input id="propPosY" type="number" class="prop-input" value="${Math.round(p.y)}"></div>
                        </div>
                    </div>
                    <div class="prop-row">
                        <span class="prop-label">Tỷ lệ (Scale)</span>
                        <div class="prop-controls">
                            <div class="prop-input-group"><span class="prop-input-label">X</span><input id="propScaleX" type="number" step="0.1" class="prop-input" value="${p.scale.x.toFixed(2)}"></div>
                            <div class="prop-input-group"><span class="prop-input-label">Y</span><input id="propScaleY" type="number" step="0.1" class="prop-input" value="${p.scale.y.toFixed(2)}"></div>
                        </div>
                    </div>
                    <div class="prop-row">
                        <span class="prop-label">Xoay (Góc °)</span>
                        <div class="prop-controls">
                            <input id="propRotSlider" type="range" class="prop-slider" min="0" max="360" value="${rotDeg >= 0 ? rotDeg : rotDeg + 360}">
                            <input id="propRotNum" type="number" class="editor-input" style="width:60px;" value="${rotDeg >= 0 ? rotDeg : rotDeg + 360}">
                        </div>
                    </div>
                    <div class="prop-row">
                        <span class="prop-label">Điểm neo (Anchor)</span>
                        <div class="prop-controls">
                            <select id="propAnchorPreset" class="editor-select" style="flex:1;">
                                <option value="0.5,0.5">Tâm (Center 0.5, 0.5)</option>
                                <option value="0,0">Góc trên trái (0, 0)</option>
                                <option value="0.5,1.0">Chân đáy (0.5, 1.0)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Appearance -->
            <div class="prop-section">
                <div class="prop-section-header">Hiển Thị (Appearance)</div>
                <div class="prop-section-body">
                    <div class="prop-row">
                        <span class="prop-label">Độ mờ (Alpha)</span>
                        <div class="prop-controls">
                            <input id="propAlphaSlider" type="range" class="prop-slider" min="0" max="1" step="0.05" value="${p.alpha}">
                            <span id="propAlphaVal" style="font-size:11px; width:35px; text-align:right;">${Math.round(p.alpha * 100)}%</span>
                        </div>
                    </div>
                    <div class="prop-row">
                        <span class="prop-label">Màu nhuộm (Tint)</span>
                        <div class="prop-controls">
                            <input id="propTintColor" type="color" class="prop-color-picker" value="${colorToHex(p.tint || 0xffffff)}">
                            <button id="btnResetTint" class="btn" style="padding:2px 6px; font-size:10px;">Đặt lại</button>
                        </div>
                    </div>
                </div>
            </div>

            ${typeSpecificHTML}

            <!-- Gameplay Behavior -->
            <div class="prop-section">
                <div class="prop-section-header">Hành Vi Live (Play Mode)</div>
                <div class="prop-section-body">
                    <div class="prop-row">
                        <span class="prop-label">Hành vi</span>
                        <select id="propBehavior" class="editor-select" style="flex:1;">
                            <option value="none" ${item.behavior === 'none' ? 'selected' : ''}>Không có</option>
                            <option value="rotate_slow" ${item.behavior === 'rotate_slow' ? 'selected' : ''}>Tự xoay chậm</option>
                            <option value="patrol_h" ${item.behavior === 'patrol_h' ? 'selected' : ''}>Tuần tra ngang</option>
                            <option value="pulse" ${item.behavior === 'pulse' ? 'selected' : ''}>Hiệu ứng nhấp nháy Pulse</option>
                            <option value="follow_mouse" ${item.behavior === 'follow_mouse' ? 'selected' : ''}>Bám theo chuột</option>
                            <option value="player_controls" ${item.behavior === 'player_controls' ? 'selected' : ''}>Điều khiển WASD / Mũi tên</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        bindInspectorEvents(item);
    }

    function bindInspectorEvents(item) {
        const p = item.pixiObj;

        // Name & Tag
        document.getElementById('propName')?.addEventListener('input', (e) => {
            item.name = e.target.value;
            p.name = e.target.value;
            updateHierarchy();
        });
        document.getElementById('propTag')?.addEventListener('change', (e) => {
            item.tag = e.target.value;
            updateHierarchy();
        });

        // Position
        document.getElementById('propPosX')?.addEventListener('input', (e) => {
            p.x = parseFloat(e.target.value) || 0;
            renderGizmos();
        });
        document.getElementById('propPosY')?.addEventListener('input', (e) => {
            p.y = parseFloat(e.target.value) || 0;
            renderGizmos();
        });

        // Scale
        document.getElementById('propScaleX')?.addEventListener('input', (e) => {
            p.scale.x = parseFloat(e.target.value) || 1;
            renderGizmos();
        });
        document.getElementById('propScaleY')?.addEventListener('input', (e) => {
            p.scale.y = parseFloat(e.target.value) || 1;
            renderGizmos();
        });

        // Rotation
        const rotSlider = document.getElementById('propRotSlider');
        const rotNum = document.getElementById('propRotNum');
        if (rotSlider && rotNum) {
            rotSlider.addEventListener('input', (e) => {
                const deg = parseFloat(e.target.value) || 0;
                rotNum.value = deg;
                p.rotation = deg * Math.PI / 180;
                renderGizmos();
            });
            rotNum.addEventListener('input', (e) => {
                const deg = parseFloat(e.target.value) || 0;
                rotSlider.value = deg;
                p.rotation = deg * Math.PI / 180;
                renderGizmos();
            });
        }

        // Anchor
        document.getElementById('propAnchorPreset')?.addEventListener('change', (e) => {
            const [ax, ay] = e.target.value.split(',').map(parseFloat);
            if (p.anchor) p.anchor.set(ax, ay);
            renderGizmos();
        });

        // Alpha & Tint
        document.getElementById('propAlphaSlider')?.addEventListener('input', (e) => {
            p.alpha = parseFloat(e.target.value);
            const valEl = document.getElementById('propAlphaVal');
            if (valEl) valEl.textContent = `${Math.round(p.alpha * 100)}%`;
        });
        document.getElementById('propTintColor')?.addEventListener('input', (e) => {
            p.tint = parseInt(e.target.value.slice(1), 16);
        });
        document.getElementById('btnResetTint')?.addEventListener('click', () => {
            p.tint = 0xffffff;
            const tintInput = document.getElementById('propTintColor');
            if (tintInput) tintInput.value = '#ffffff';
        });

        // Behavior
        document.getElementById('propBehavior')?.addEventListener('change', (e) => {
            item.behavior = e.target.value;
        });

        // Text Properties
        if (item.type === 'text') {
            document.getElementById('propTextContent')?.addEventListener('input', (e) => {
                p.text = e.target.value;
                renderGizmos();
            });
            document.getElementById('propFontSize')?.addEventListener('input', (e) => {
                p.style.fontSize = parseInt(e.target.value) || 24;
                renderGizmos();
            });
            document.getElementById('propTextColor')?.addEventListener('input', (e) => {
                p.style.fill = e.target.value;
            });
            document.getElementById('propStrokeColor')?.addEventListener('input', (e) => {
                p.style.stroke = e.target.value;
            });
            document.getElementById('propStrokeWidth')?.addEventListener('input', (e) => {
                p.style.strokeThickness = parseInt(e.target.value) || 0;
                renderGizmos();
            });
        }

        // Shape Properties
        if (item.type === 'shape') {
            const redraw = () => {
                drawShapeGraphics(p, item);
                renderGizmos();
            };
            document.getElementById('propShapeType')?.addEventListener('change', (e) => {
                item.shapeType = e.target.value;
                redraw();
            });
            document.getElementById('propShapeFill')?.addEventListener('input', (e) => {
                item.fillColor = e.target.value;
                redraw();
            });
            document.getElementById('propShapeFillAlpha')?.addEventListener('input', (e) => {
                item.fillAlpha = parseFloat(e.target.value);
                redraw();
            });
            document.getElementById('propShapeStroke')?.addEventListener('input', (e) => {
                item.strokeColor = e.target.value;
                redraw();
            });
            document.getElementById('propShapeStrokeWidth')?.addEventListener('input', (e) => {
                item.strokeWidth = parseInt(e.target.value) || 0;
                redraw();
            });
        }
    }

    function updateInspectorFieldsFast() {
        if (!state.selectedObject) return;
        const p = state.selectedObject.pixiObj;

        const posX = document.getElementById('propPosX');
        const posY = document.getElementById('propPosY');
        if (posX) posX.value = Math.round(p.x);
        if (posY) posY.value = Math.round(p.y);

        const scaleX = document.getElementById('propScaleX');
        const scaleY = document.getElementById('propScaleY');
        if (scaleX) scaleX.value = p.scale.x.toFixed(2);
        if (scaleY) scaleY.value = p.scale.y.toFixed(2);

        const rotDeg = Math.round((p.rotation * 180 / Math.PI) % 360);
        const rotSlider = document.getElementById('propRotSlider');
        const rotNum = document.getElementById('propRotNum');
        if (rotSlider) rotSlider.value = rotDeg >= 0 ? rotDeg : rotDeg + 360;
        if (rotNum) rotNum.value = rotDeg >= 0 ? rotDeg : rotDeg + 360;
    }

    function colorToHex(colorVal) {
        if (!colorVal) return '#ffffff';
        if (typeof colorVal === 'string' && colorVal.startsWith('#')) return colorVal;
        if (typeof colorVal === 'number') {
            return '#' + colorVal.toString(16).padStart(6, '0');
        }
        return '#ffffff';
    }

    // --- Top Bar Controls & Resolution & Modes ---
    function setupTopBar() {
        // Edit / Play Mode Toggle
        const btnEditMode = document.getElementById('btnEditMode');
        const btnPlayMode = document.getElementById('btnPlayMode');
        if (btnEditMode && btnPlayMode) {
            btnEditMode.addEventListener('click', () => setEditorMode('edit'));
            btnPlayMode.addEventListener('click', () => setEditorMode('play'));
        }

        // Resolution Select
        const resSelect = document.getElementById('resolutionSelect');
        if (resSelect) {
            resSelect.addEventListener('change', (e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                changeResolution(w, h);
            });
        }

        // Grid Snap & Size
        const gridSnapBtn = document.getElementById('btnGridSnap');
        if (gridSnapBtn) {
            gridSnapBtn.addEventListener('click', () => {
                state.gridSnap = !state.gridSnap;
                gridSnapBtn.classList.toggle('active', state.gridSnap);
                showToast(state.gridSnap ? 'Bật hít lưới (Grid Snap)' : 'Tắt hít lưới', 'info');
            });
        }

        const gridSizeSelect = document.getElementById('gridSizeSelect');
        if (gridSizeSelect) {
            gridSizeSelect.addEventListener('change', (e) => {
                state.gridSize = parseInt(e.target.value) || 32;
                renderGrid();
            });
        }

        const gridToggleBtn = document.getElementById('btnToggleGrid');
        if (gridToggleBtn) {
            gridToggleBtn.addEventListener('click', () => {
                state.showGrid = !state.showGrid;
                gridToggleBtn.classList.toggle('active', state.showGrid);
                renderGrid();
            });
        }

        // Zoom Select
        const zoomSelect = document.getElementById('zoomSelect');
        if (zoomSelect) {
            zoomSelect.addEventListener('change', (e) => {
                if (e.target.value === 'fit') {
                    fitViewport();
                } else {
                    setZoom(parseFloat(e.target.value) || 1.0);
                }
            });
        }

        // History Undo / Redo
        document.getElementById('btnUndo')?.addEventListener('click', undo);
        document.getElementById('btnRedo')?.addEventListener('click', redo);

        // Topbar Scene Buttons
        document.getElementById('btnActiveSceneInfo')?.addEventListener('click', () => {
            openEditSceneModal(state.currentSceneId);
        });

        document.getElementById('btnOpenSceneManager')?.addEventListener('click', () => {
            openSceneManagerModal();
        });

        document.getElementById('btnSaveCurrentScene')?.addEventListener('click', () => {
            saveCurrentScene();
        });

        document.getElementById('btnSaveAsNewScene')?.addEventListener('click', () => {
            openSaveAsModal();
        });

        document.getElementById('btnNewScene')?.addEventListener('click', () => {
            openNewSceneModal();
        });

        // Export / Import JSON & Code Modals
        document.getElementById('btnExportJSON')?.addEventListener('click', showExportJSONModal);
        document.getElementById('btnImportJSON')?.addEventListener('click', showImportJSONModal);
        document.getElementById('btnExportCode')?.addEventListener('click', showExportCodeModal);

        // Template buttons
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                loadTemplate(card.dataset.template);
            });
        });
    }

    // --- Scene Dirty State & Active Scene Label ---
    function markDirty() {
        state.isDirty = true;
        updateActiveScenePill();
    }

    function updateActiveScenePill() {
        const nameLabel = document.getElementById('activeSceneNameLabel');
        const dirtyDot = document.getElementById('sceneDirtyDot');
        if (nameLabel) {
            nameLabel.textContent = state.currentSceneName || 'Scene Chưa Đặt Tên';
        }
        if (dirtyDot) {
            if (state.isDirty) {
                dirtyDot.classList.remove('clean');
                dirtyDot.title = 'Có thay đổi chưa lưu';
            } else {
                dirtyDot.classList.add('clean');
                dirtyDot.title = 'Đã lưu đồng bộ';
            }
        }
    }

    // --- Scene Manager API & CRUD ---
    async function fetchScenesList() {
        try {
            const resp = await fetch('/api/scenes');
            if (resp.ok) {
                const data = await resp.json();
                if (data.success && Array.isArray(data.scenes)) {
                    state.scenesCache = data.scenes;
                }
            }
        } catch (e) {
            console.warn('API fetch scenes failed, using localStorage fallback', e);
            const localSaved = localStorage.getItem('pixi_scenes_cache');
            if (localSaved) {
                try { state.scenesCache = JSON.parse(localSaved); } catch (err) {}
            }
        }

        const badge = document.getElementById('sceneCountBadge');
        if (badge) badge.textContent = state.scenesCache.length;
        renderSceneManagerList();
    }

    function openSceneManagerModal() {
        fetchScenesList();
        const modal = document.getElementById('sceneManagerModal');
        if (modal) modal.classList.add('open');
    }

    function renderSceneManagerList() {
        const listContainer = document.getElementById('sceneManagerList');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        const query = (state.sceneSearchQuery || '').toLowerCase();
        const filter = state.sceneFilter || 'all';

        const filtered = state.scenesCache.filter(scene => {
            const matchQuery = scene.name.toLowerCase().includes(query) || scene.id.toLowerCase().includes(query);
            const matchFilter = filter === 'all' || (scene.tag && scene.tag.toLowerCase() === filter.toLowerCase());
            return matchQuery && matchFilter;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-scene-state">
                    <div style="font-size: 32px; margin-bottom: 8px;">📂</div>
                    <div>Không tìm thấy Scene nào phù hợp</div>
                    <div style="font-size: 11px; margin-top: 4px;">Nhấp <strong>+ Tạo Scene Mới</strong> hoặc chọn bộ lọc khác</div>
                </div>
            `;
            return;
        }

        filtered.forEach(scene => {
            const card = document.createElement('div');
            const isActive = scene.id === state.currentSceneId;
            card.className = 'scene-manager-card' + (isActive ? ' current-active' : '');

            const iconMap = { 'RPG MV': '🏰', 'Tu Tiên': '⚔️', 'Custom': '🎮' };
            const tagIcon = iconMap[scene.tag] || '📁';
            const updatedTime = scene.updatedAt ? new Date(scene.updatedAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong';

            card.innerHTML = `
                <div class="scene-card-top">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                        <span style="font-size: 18px;">${tagIcon}</span>
                        <div style="overflow: hidden;">
                            <div class="scene-card-title" title="${scene.name}">${scene.name}</div>
                            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">${scene.id}</div>
                        </div>
                    </div>
                    ${isActive ? '<span class="scene-card-badge" style="color: var(--accent-green); border-color: var(--accent-green);">ĐANG MỞ</span>' : ''}
                </div>
                <div class="scene-card-meta">
                    <span class="scene-card-badge">📐 ${scene.resolution ? scene.resolution.width + 'x' + scene.resolution.height : '816x624'}</span>
                    <span class="scene-card-badge">📦 ${scene.objectCount || 0} đối tượng</span>
                    <span class="scene-card-badge">🏷️ ${scene.tag || 'Custom'}</span>
                    <span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">${updatedTime}</span>
                </div>
                <div class="scene-card-actions">
                    <button class="btn btn-primary btn-sm btn-open-scene" title="Mở Scene này vào Canvas">📂 Mở</button>
                    <div class="scene-action-btn-group">
                        <button class="node-btn btn-edit-scene" title="Sửa thông tin / Đổi tên">✏️ Sửa</button>
                        <button class="node-btn btn-duplicate-scene" title="Nhân bản Scene">📋 Nhân bản</button>
                        <button class="node-btn btn-export-scene" title="Tải file JSON về máy">📥 Tải về</button>
                        <button class="node-btn btn-delete-scene" style="color: var(--accent-red);" title="Xóa Scene">🗑️ Xóa</button>
                    </div>
                </div>
            `;

            card.querySelector('.btn-open-scene').addEventListener('click', () => {
                loadSceneById(scene.id);
            });

            card.querySelector('.btn-edit-scene').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditSceneModal(scene.id);
            });

            card.querySelector('.btn-duplicate-scene').addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateScene(scene.id);
            });

            card.querySelector('.btn-export-scene').addEventListener('click', (e) => {
                e.stopPropagation();
                exportSceneJSON(scene.id);
            });

            card.querySelector('.btn-delete-scene').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteScene(scene.id);
            });

            listContainer.appendChild(card);
        });
    }

    async function loadSceneById(id) {
        if (state.isDirty) {
            if (!confirm('Scene hiện tại có thay đổi chưa lưu. Bạn có chắc muốn chuyển sang Scene khác?')) {
                return;
            }
        }

        try {
            const resp = await fetch(`/api/scenes/${id}`);
            if (resp.ok) {
                const result = await resp.json();
                if (result.success && result.scene) {
                    deserializeScene(result.scene);
                    state.currentSceneId = id;
                    state.currentSceneName = result.scene.name || id;
                    state.currentSceneTag = result.scene.tag || 'Custom';
                    state.isDirty = false;
                    updateActiveScenePill();
                    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
                    showToast(`Đã mở Scene: ${state.currentSceneName}`, 'success');
                    return;
                }
            }
        } catch (e) {
            console.warn('API load scene failed, checking localStorage fallback', e);
        }

        // LocalStorage fallback
        const localKey = `pixi_scene_${id}`;
        const raw = localStorage.getItem(localKey);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                deserializeScene(data);
                state.currentSceneId = id;
                state.currentSceneName = data.name || id;
                state.currentSceneTag = data.tag || 'Custom';
                state.isDirty = false;
                updateActiveScenePill();
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
                showToast(`Đã mở Scene: ${state.currentSceneName}`, 'success');
            } catch (err) {
                showToast('Lỗi đọc dữ liệu Scene: ' + err.message, 'error');
            }
        }
    }

    async function saveCurrentScene() {
        const payload = serializeScene();
        payload.id = state.currentSceneId || ('scene_' + Date.now());
        payload.name = state.currentSceneName || 'Scene Chưa Đặt Tên';
        payload.tag = state.currentSceneTag || 'Custom';

        // Save to backend API
        try {
            const resp = await fetch('/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                const resData = await resp.json();
                if (resData.success) {
                    state.isDirty = false;
                    updateActiveScenePill();
                    showToast(`Đã lưu Scene: "${payload.name}" lên hệ thống!`, 'success');
                    fetchScenesList();
                    return;
                }
            }
        } catch (e) {
            console.warn('API save failed, saving to localStorage only', e);
        }

        // LocalStorage fallback
        localStorage.setItem(`pixi_scene_${payload.id}`, JSON.stringify(payload));
        state.isDirty = false;
        updateActiveScenePill();
        showToast(`Đã lưu Scene: "${payload.name}" vào trình duyệt!`, 'success');
        fetchScenesList();
    }

    async function saveAsNewScene(name, tag) {
        const cleanName = (name || '').trim() || ('Scene ' + new Date().toLocaleTimeString());
        const newId = 'scene_' + Date.now();

        state.currentSceneId = newId;
        state.currentSceneName = cleanName;
        state.currentSceneTag = tag || 'Custom';

        await saveCurrentScene();
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        showToast(`Đã tạo và lưu thành Scene mới: ${cleanName}`, 'success');
    }

    async function editSceneMetadata(id, newName, newTag, newRes) {
        const cleanName = (newName || '').trim();
        if (!cleanName) return;

        let sceneData = null;
        if (id === state.currentSceneId) {
            sceneData = serializeScene();
            sceneData.id = id;
            sceneData.name = cleanName;
            sceneData.tag = newTag;
            if (newRes) {
                const [w, h] = newRes.split('x').map(Number);
                changeResolution(w, h);
                sceneData.resolution = { width: w, height: h };
            }
            state.currentSceneName = cleanName;
            state.currentSceneTag = newTag;
            updateActiveScenePill();
        } else {
            // Fetch target scene
            try {
                const resp = await fetch(`/api/scenes/${id}`);
                if (resp.ok) {
                    const result = await resp.json();
                    sceneData = result.scene;
                }
            } catch (e) {}
            if (!sceneData) {
                const raw = localStorage.getItem(`pixi_scene_${id}`);
                if (raw) sceneData = JSON.parse(raw);
            }
            if (sceneData) {
                sceneData.name = cleanName;
                sceneData.tag = newTag;
                if (newRes) {
                    const [w, h] = newRes.split('x').map(Number);
                    sceneData.resolution = { width: w, height: h };
                }
            }
        }

        if (sceneData) {
            try {
                await fetch(`/api/scenes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sceneData)
                });
            } catch (e) {}
            localStorage.setItem(`pixi_scene_${id}`, JSON.stringify(sceneData));
        }

        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        showToast(`Đã cập nhật thông tin Scene: ${cleanName}`, 'success');
        fetchScenesList();
    }

    async function duplicateScene(id) {
        let sceneData = null;
        try {
            const resp = await fetch(`/api/scenes/${id}`);
            if (resp.ok) {
                const res = await resp.json();
                sceneData = res.scene;
            }
        } catch (e) {}

        if (!sceneData) {
            const raw = localStorage.getItem(`pixi_scene_${id}`);
            if (raw) sceneData = JSON.parse(raw);
        }

        if (!sceneData && id === state.currentSceneId) {
            sceneData = serializeScene();
        }

        if (!sceneData) {
            showToast('Không thể nhân bản Scene này', 'error');
            return;
        }

        const newId = 'scene_' + Date.now();
        const clone = JSON.parse(JSON.stringify(sceneData));
        clone.id = newId;
        clone.name = (clone.name || id) + ' (Bản sao)';

        try {
            await fetch('/api/scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clone)
            });
        } catch (e) {}

        localStorage.setItem(`pixi_scene_${newId}`, JSON.stringify(clone));
        showToast(`Đã nhân bản thành: ${clone.name}`, 'success');
        fetchScenesList();
    }

    async function deleteScene(id) {
        if (!confirm(`Bạn có chắc chắn muốn XÓA Scene "${id}" này không? Thao tác không thể hoàn tác.`)) {
            return;
        }

        try {
            await fetch(`/api/scenes/${id}`, { method: 'DELETE' });
        } catch (e) {}

        localStorage.removeItem(`pixi_scene_${id}`);
        showToast(`Đã xóa Scene: ${id}`, 'warning');

        await fetchScenesList();

        // If the deleted scene is the active one, load the first remaining scene or clean scene
        if (id === state.currentSceneId) {
            if (state.scenesCache.length > 0) {
                loadSceneById(state.scenesCache[0].id);
            } else {
                createNewBlankScene('Scene Mới 1', '816x624', 'Custom');
            }
        }
    }

    async function exportSceneJSON(id) {
        let data = null;
        if (id === state.currentSceneId) {
            data = serializeScene();
            data.id = id;
            data.name = state.currentSceneName;
        } else {
            try {
                const resp = await fetch(`/api/scenes/${id}`);
                if (resp.ok) {
                    const res = await resp.json();
                    data = res.scene;
                }
            } catch (e) {}
            if (!data) {
                const raw = localStorage.getItem(`pixi_scene_${id}`);
                if (raw) data = JSON.parse(raw);
            }
        }

        if (!data) {
            showToast('Không tìm thấy dữ liệu Scene để tải về', 'error');
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.id || id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Đã tải xuống file: ${id}.json`, 'success');
    }

    function createNewBlankScene(name, resString, tag) {
        clearScene();
        const [w, h] = (resString || '816x624').split('x').map(Number);
        changeResolution(w, h);
        state.currentSceneId = 'scene_' + Date.now();
        state.currentSceneName = name || 'Scene Mới';
        state.currentSceneTag = tag || 'Custom';
        state.isDirty = true;
        updateActiveScenePill();
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        showToast(`Đã tạo Scene trống mới: ${state.currentSceneName}`, 'info');
    }

    // Modal Triggers
    function openSaveAsModal() {
        const modal = document.getElementById('saveAsModal');
        const input = document.getElementById('saveAsNameInput');
        const tagSelect = document.getElementById('saveAsTagSelect');
        if (input) input.value = state.currentSceneName + ' (Bản mới)';
        if (tagSelect) tagSelect.value = state.currentSceneTag || 'Custom';
        if (modal) modal.classList.add('open');
    }

    function openEditSceneModal(id) {
        const modal = document.getElementById('editSceneModal');
        const nameInput = document.getElementById('editSceneNameInput');
        const tagSelect = document.getElementById('editSceneTagSelect');
        const resSelect = document.getElementById('editSceneResSelect');

        modal.dataset.sceneId = id || state.currentSceneId;

        const target = state.scenesCache.find(s => s.id === (id || state.currentSceneId));
        if (nameInput) nameInput.value = target ? target.name : state.currentSceneName;
        if (tagSelect) tagSelect.value = target ? (target.tag || 'Custom') : state.currentSceneTag;
        if (resSelect) {
            if (target && target.resolution) {
                resSelect.value = `${target.resolution.width}x${target.resolution.height}`;
            } else {
                resSelect.value = `${state.resolution.width}x${state.resolution.height}`;
            }
        }
        if (modal) modal.classList.add('open');
    }

    function openNewSceneModal() {
        const modal = document.getElementById('newSceneModal');
        if (modal) modal.classList.add('open');
    }

    function setupSceneManagerUI() {
        // Search
        document.getElementById('sceneSearchInput')?.addEventListener('input', (e) => {
            state.sceneSearchQuery = e.target.value;
            renderSceneManagerList();
        });

        // Filter chips
        document.querySelectorAll('#sceneManagerModal .category-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#sceneManagerModal .category-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.sceneFilter = chip.dataset.filter || 'all';
                renderSceneManagerList();
            });
        });

        // Create New Scene in modal
        document.getElementById('btnModalCreateNewScene')?.addEventListener('click', () => {
            openNewSceneModal();
        });

        // Confirm Save As
        document.getElementById('btnConfirmSaveAs')?.addEventListener('click', () => {
            const name = document.getElementById('saveAsNameInput')?.value;
            const tag = document.getElementById('saveAsTagSelect')?.value;
            saveAsNewScene(name, tag);
        });

        // Confirm Edit Scene
        document.getElementById('btnConfirmEditScene')?.addEventListener('click', () => {
            const modal = document.getElementById('editSceneModal');
            const id = modal.dataset.sceneId || state.currentSceneId;
            const name = document.getElementById('editSceneNameInput')?.value;
            const tag = document.getElementById('editSceneTagSelect')?.value;
            const res = document.getElementById('editSceneResSelect')?.value;
            editSceneMetadata(id, name, tag, res);
        });

        // Confirm Create New Scene
        document.getElementById('btnConfirmCreateNewScene')?.addEventListener('click', () => {
            const name = document.getElementById('newSceneNameInput')?.value;
            const res = document.getElementById('newSceneResRes')?.value || document.getElementById('newSceneResSelect')?.value;
            const tag = document.getElementById('newSceneTagSelect')?.value;
            createNewBlankScene(name, res, tag);
        });
    }

    function setEditorMode(mode) {
        state.mode = mode;
        const btnEditMode = document.getElementById('btnEditMode');
        const btnPlayMode = document.getElementById('btnPlayMode');
        if (btnEditMode && btnPlayMode) {
            btnEditMode.classList.toggle('active', mode === 'edit');
            btnPlayMode.classList.toggle('active', mode === 'play');
        }

        if (mode === 'play') {
            state.selectedObject = null;
            renderGizmos();
            showToast('Chế độ Chơi thử (Play Mode) kích hoạt! Điều khiển WASD / Mũi tên.', 'success');
        } else {
            renderGizmos();
            showToast('Đã chuyển về Chế độ Thiết kế (Edit Mode)', 'info');
        }
    }

    function changeResolution(w, h) {
        state.resolution.width = w;
        state.resolution.height = h;

        const resSelect = document.getElementById('resolutionSelect');
        if (resSelect) {
            resSelect.value = `${w}x${h}`;
        }

        if (state.app && state.app.renderer) {
            state.app.renderer.resize(w, h);
            if (state.app.stage.hitArea) {
                state.app.stage.hitArea = new PIXI.Rectangle(0, 0, w, h);
            }
        }

        const wrapper = document.getElementById('canvasWrapper');
        if (wrapper) {
            wrapper.style.width = w + 'px';
            wrapper.style.height = h + 'px';
        }

        renderGrid();
        renderGizmos();
        fitViewport();
        showToast(`Độ phân giải: ${w} x ${h}`, 'info');
    }

    function fitViewport() {
        const viewport = document.getElementById('editorViewport');
        if (!viewport) return;
        const pad = 60;
        const availW = viewport.clientWidth - pad;
        const availH = viewport.clientHeight - pad;
        const scale = Math.min(availW / state.resolution.width, availH / state.resolution.height);
        state.pan = { x: 0, y: 0 };
        setZoom(scale);
    }

    function clearScene() {
        state.sceneLayer.removeChildren();
        state.objects = [];
        state.selectedObject = null;
        updateHierarchy();
        updateInspector();
        renderGizmos();
        recordHistory('Xóa toàn bộ Scene');
    }

    // --- Templates & Scene Presets ---
    function loadTemplate(name) {
        clearScene();

        if (name === 'dog_arena') {
            changeResolution(816, 624);
            // Background box
            createObject({
                type: 'shape',
                name: 'Arena_Background',
                tag: 'Obstacle',
                shapeType: 'rounded_rect',
                shapeWidth: 780,
                shapeHeight: 580,
                fillColor: '#162238',
                strokeColor: '#388bfd',
                strokeWidth: 3,
                cornerRadius: 16,
                x: 408,
                y: 312
            });

            // Player / Actor
            createObject({
                type: 'sprite',
                name: 'Hero_Doggo',
                tag: 'Player',
                src: 'img/characters/Actor1.png',
                x: 408,
                y: 312,
                behavior: 'player_controls'
            });

            // Enemies
            createObject({
                type: 'sprite',
                name: 'Enemy_Demon_1',
                tag: 'Enemy',
                src: 'img/enemies/Demon.png',
                x: 180,
                y: 180,
                scaleX: 0.8,
                scaleY: 0.8,
                behavior: 'patrol_h'
            });

            createObject({
                type: 'sprite',
                name: 'Enemy_Werewolf_2',
                tag: 'Enemy',
                src: 'img/enemies/Werewolf.png',
                x: 620,
                y: 420,
                scaleX: 0.8,
                scaleY: 0.8,
                behavior: 'pulse'
            });

            // HUD & Title
            createObject({
                type: 'text',
                name: 'HUD_Score_Label',
                tag: 'UI',
                text: 'DOG RESCUE ARENA - SCORE: 1250',
                fontSize: 22,
                fill: '#ffd700',
                stroke: '#000000',
                strokeThickness: 3,
                fontWeight: 'bold',
                x: 408,
                y: 50
            });
        } else if (name === 'tu_tien') {
            changeResolution(540, 960);
            // Tu Tiên mobile vertical arena
            createObject({
                type: 'shape',
                name: 'Cultivation_Domain',
                tag: 'Obstacle',
                shapeType: 'rounded_rect',
                shapeWidth: 500,
                shapeHeight: 900,
                fillColor: '#0b1622',
                strokeColor: '#58a6ff',
                strokeWidth: 4,
                cornerRadius: 20,
                x: 270,
                y: 480
            });

            createObject({
                type: 'sprite',
                name: 'Sword_Immortal',
                tag: 'Player',
                src: 'img/characters/Actor2.png',
                x: 270,
                y: 520,
                behavior: 'player_controls'
            });

            createObject({
                type: 'sprite',
                name: 'Sky_Dragon_Boss',
                tag: 'Boss',
                src: 'img/enemies/Dragon.png',
                x: 270,
                y: 200,
                scaleX: 1.1,
                scaleY: 1.1,
                behavior: 'pulse'
            });

            createObject({
                type: 'sprite',
                name: 'VFX_Slash_Aura',
                tag: 'VFX',
                src: 'img/animations/SlashSpecial3.png',
                x: 270,
                y: 520,
                behavior: 'rotate_slow'
            });

            createObject({
                type: 'text',
                name: 'TuTien_HUD',
                tag: 'UI',
                text: 'TU TIÊN SURVIVOR - WAVE 12',
                fontSize: 24,
                fill: '#7ee787',
                stroke: '#0d1117',
                strokeThickness: 4,
                x: 270,
                y: 60
            });
        } else if (name === 'boss_battle') {
            changeResolution(816, 624);
            createObject({
                type: 'sprite',
                name: 'Darklord_Final_Boss',
                tag: 'Boss',
                src: 'img/enemies/Darklord-final.png',
                x: 408,
                y: 280,
                scaleX: 1.2,
                scaleY: 1.2,
                behavior: 'pulse'
            });

            createObject({
                type: 'sprite',
                name: 'Actor_Hero',
                tag: 'Player',
                src: 'img/characters/Actor1.png',
                x: 200,
                y: 460
            });

            createObject({
                type: 'sprite',
                name: 'Actor_Mage',
                tag: 'Player',
                src: 'img/characters/Actor2.png',
                x: 616,
                y: 460
            });

            createObject({
                type: 'text',
                name: 'Boss_Title',
                tag: 'UI',
                text: 'BOSS BATTLE: CHÚA TỂ BÓNG TỐI',
                fontSize: 26,
                fill: '#f85149',
                stroke: '#000000',
                strokeThickness: 4,
                fontWeight: 'bold',
                x: 408,
                y: 60
            });
        }

        showToast(`Đã tải mẫu: ${name}`, 'success');
    }

    // --- Serialization & JSON Export / Import ---
    function serializeScene() {
        return {
            version: '1.0',
            resolution: { width: state.resolution.width, height: state.resolution.height },
            bgColor: state.bgColor,
            gridSize: state.gridSize,
            objects: state.objects.map(item => {
                const p = item.pixiObj;
                return {
                    name: item.name,
                    type: item.type,
                    tag: item.tag,
                    src: item.src,
                    x: Math.round(p.x),
                    y: Math.round(p.y),
                    scaleX: parseFloat(p.scale.x.toFixed(3)),
                    scaleY: parseFloat(p.scale.y.toFixed(3)),
                    rotation: parseFloat(p.rotation.toFixed(4)),
                    alpha: parseFloat(p.alpha.toFixed(2)),
                    tint: p.tint || 0xffffff,
                    anchorX: p.anchor ? parseFloat(p.anchor.x.toFixed(2)) : 0.5,
                    anchorY: p.anchor ? parseFloat(p.anchor.y.toFixed(2)) : 0.5,
                    visible: item.visible,
                    locked: item.locked,
                    behavior: item.behavior,
                    shapeType: item.shapeType,
                    shapeWidth: item.shapeWidth,
                    shapeHeight: item.shapeHeight,
                    fillColor: item.fillColor,
                    fillAlpha: item.fillAlpha,
                    strokeColor: item.strokeColor,
                    strokeWidth: item.strokeWidth,
                    radius: item.radius,
                    cornerRadius: item.cornerRadius,
                    text: item.type === 'text' ? p.text : undefined,
                    fontSize: item.type === 'text' ? p.style.fontSize : undefined,
                    fill: item.type === 'text' ? p.style.fill : undefined,
                    fontFamily: item.type === 'text' ? p.style.fontFamily : undefined,
                    stroke: item.type === 'text' ? p.style.stroke : undefined,
                    strokeThickness: item.type === 'text' ? p.style.strokeThickness : undefined
                };
            })
        };
    }

    function deserializeScene(data) {
        clearScene();
        if (data.id) state.currentSceneId = data.id;
        if (data.name) state.currentSceneName = data.name;
        if (data.tag) state.currentSceneTag = data.tag;
        if (data.bgColor !== undefined) state.bgColor = data.bgColor;
        if (data.resolution) {
            changeResolution(data.resolution.width, data.resolution.height);
        }
        if (data.objects && Array.isArray(data.objects)) {
            data.objects.forEach(objConfig => {
                createObject(objConfig);
            });
        }
        updateActiveScenePill();
    }

    // --- Code Generation ---
    function generatePixiCode() {
        const sceneData = serializeScene();
        let code = `/**\n * Scene generated with Pixi Scene Editor\n * Target: PixiJS v8 / v7\n */\n\n`;
        code += `async function createGeneratedScene(app) {\n`;
        code += `    const sceneContainer = new PIXI.Container();\n`;
        code += `    sceneContainer.name = 'GeneratedScene';\n`;
        code += `    app.stage.addChild(sceneContainer);\n\n`;

        sceneData.objects.forEach((obj, idx) => {
            const varName = `obj_${obj.name.replace(/[^a-zA-Z0-9_]/g, '_')}_${idx}`;
            if (obj.type === 'sprite') {
                code += `    // Sprite: ${obj.name}\n`;
                code += `    const ${varName} = PIXI.Sprite.from('${obj.src || 'img/characters/Actor1.png'}');\n`;
                code += `    ${varName}.anchor.set(${obj.anchorX}, ${obj.anchorY});\n`;
            } else if (obj.type === 'text') {
                code += `    // Text: ${obj.name}\n`;
                code += `    const ${varName} = new PIXI.Text('${(obj.text || '').replace(/'/g, "\\'")}', {\n`;
                code += `        fontFamily: '${obj.fontFamily || 'Arial'}',\n`;
                code += `        fontSize: ${obj.fontSize || 24},\n`;
                code += `        fill: '${obj.fill || '#ffffff'}',\n`;
                code += `        stroke: '${obj.stroke || '#000000'}',\n`;
                code += `        strokeThickness: ${obj.strokeThickness || 0}\n`;
                code += `    });\n`;
                code += `    ${varName}.anchor.set(${obj.anchorX}, ${obj.anchorY});\n`;
            } else if (obj.type === 'shape') {
                code += `    // Shape: ${obj.name}\n`;
                code += `    const ${varName} = new PIXI.Graphics();\n`;
                if (obj.strokeWidth > 0) {
                    code += `    ${varName}.lineStyle(${obj.strokeWidth}, 0x${obj.strokeColor.replace('#', '')});\n`;
                }
                code += `    ${varName}.beginFill(0x${obj.fillColor.replace('#', '')}, ${obj.fillAlpha});\n`;
                if (obj.shapeType === 'rect') {
                    code += `    ${varName}.drawRect(-${obj.shapeWidth/2}, -${obj.shapeHeight/2}, ${obj.shapeWidth}, ${obj.shapeHeight});\n`;
                } else if (obj.shapeType === 'rounded_rect') {
                    code += `    ${varName}.drawRoundedRect(-${obj.shapeWidth/2}, -${obj.shapeHeight/2}, ${obj.shapeWidth}, ${obj.shapeHeight}, ${obj.cornerRadius});\n`;
                } else if (obj.shapeType === 'circle') {
                    code += `    ${varName}.drawCircle(0, 0, ${obj.radius});\n`;
                }
                code += `    ${varName}.endFill();\n`;
            }

            code += `    ${varName}.position.set(${obj.x}, ${obj.y});\n`;
            code += `    ${varName}.scale.set(${obj.scaleX}, ${obj.scaleY});\n`;
            code += `    ${varName}.rotation = ${obj.rotation};\n`;
            code += `    ${varName}.alpha = ${obj.alpha};\n`;
            if (obj.tint && obj.tint !== 0xffffff) {
                code += `    ${varName}.tint = 0x${obj.tint.toString(16)};\n`;
            }
            code += `    sceneContainer.addChild(${varName});\n\n`;
        });

        code += `    return sceneContainer;\n`;
        code += `}\n`;
        return code;
    }

    // --- Modals UI ---
    function showExportJSONModal() {
        const modal = document.getElementById('exportModal');
        const textarea = document.getElementById('exportCodeArea');
        const title = document.getElementById('modalTitle');
        if (!modal || !textarea) return;

        title.textContent = 'Xuất Dữ Liệu Scene (JSON)';
        textarea.value = JSON.stringify(serializeScene(), null, 2);
        modal.classList.add('open');
    }

    function showImportJSONModal() {
        const modal = document.getElementById('exportModal');
        const textarea = document.getElementById('exportCodeArea');
        const title = document.getElementById('modalTitle');
        if (!modal || !textarea) return;

        title.textContent = 'Nhập Dữ Liệu Scene (Dán JSON vào đây và ấn Tải)';
        textarea.value = '';
        modal.classList.add('open');
    }

    function showExportCodeModal() {
        const modal = document.getElementById('exportModal');
        const textarea = document.getElementById('exportCodeArea');
        const title = document.getElementById('modalTitle');
        if (!modal || !textarea) return;

        title.textContent = 'Mã Nguồn JavaScript PixiJS Khởi Tạo Scene';
        textarea.value = generatePixiCode();
        modal.classList.add('open');
    }

    // --- Keyboard Shortcuts & History (Undo / Redo) ---
    function setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            // Save Scene (Ctrl + S)
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                saveCurrentScene();
            }

            // Delete object
            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelectedObject();
            }

            // Duplicate (Ctrl + D)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                duplicateSelectedObject();
            }

            // Undo (Ctrl + Z)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
                e.preventDefault();
                undo();
            }

            // Redo (Ctrl + Y or Ctrl + Shift + Z)
            if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
                e.preventDefault();
                redo();
            }

            // Nudge selection with arrow keys
            if (state.selectedObject && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const p = state.selectedObject.pixiObj;
                if (e.key === 'ArrowLeft') p.x -= step;
                if (e.key === 'ArrowRight') p.x += step;
                if (e.key === 'ArrowUp') p.y -= step;
                if (e.key === 'ArrowDown') p.y += step;
                renderGizmos();
                updateInspectorFieldsFast();
            }
        });

        // Close modal buttons
        document.querySelectorAll('.modal-close, #btnModalClose').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
            });
        });

        // Copy button
        document.getElementById('btnCopyCode')?.addEventListener('click', () => {
            const textarea = document.getElementById('exportCodeArea');
            if (textarea) {
                textarea.select();
                navigator.clipboard.writeText(textarea.value);
                showToast('Đã sao chép vào Clipboard!', 'success');
            }
        });

        // Load JSON button in modal
        document.getElementById('btnApplyJSON')?.addEventListener('click', () => {
            const textarea = document.getElementById('exportCodeArea');
            if (textarea && textarea.value.trim()) {
                try {
                    const data = JSON.parse(textarea.value);
                    deserializeScene(data);
                    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
                    showToast('Đã nạp Scene thành công!', 'success');
                } catch (err) {
                    showToast('JSON không hợp lệ: ' + err.message, 'error');
                }
            }
        });
    }

    function recordHistory(actionName) {
        markDirty();
        // Truncate redo stack
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }

        const snapshot = serializeScene();
        state.history.push({ name: actionName, data: snapshot });
        state.historyIndex = state.history.length - 1;

        if (state.history.length > 50) {
            state.history.shift();
            state.historyIndex--;
        }
    }

    function undo() {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            const item = state.history[state.historyIndex];
            deserializeScene(item.data);
            showToast('Hoàn tác: ' + item.name, 'info');
        } else {
            showToast('Không còn thao tác để hoàn tác', 'warning');
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const item = state.history[state.historyIndex];
            deserializeScene(item.data);
            showToast('Làm lại: ' + item.name, 'info');
        } else {
            showToast('Không còn thao tác để làm lại', 'warning');
        }
    }

    // --- Simulation / Animation Loop ---
    let simTime = 0;
    const keysDown = {};
    window.addEventListener('keydown', (e) => { keysDown[e.key] = true; });
    window.addEventListener('keyup', (e) => { keysDown[e.key] = false; });

    function editorUpdateLoop(ticker) {
        simTime += 0.02;

        if (state.mode === 'play') {
            // Live simulation of behaviors
            state.objects.forEach(item => {
                if (!item.pixiObj || !item.visible) return;
                const p = item.pixiObj;

                if (item.behavior === 'rotate_slow') {
                    p.rotation += 0.03;
                } else if (item.behavior === 'pulse') {
                    const scaleBase = 1.0;
                    const factor = 1.0 + Math.sin(simTime * 4) * 0.08;
                    p.scale.set(factor, factor);
                } else if (item.behavior === 'patrol_h') {
                    p.x += Math.sin(simTime * 2) * 2.5;
                } else if (item.behavior === 'player_controls') {
                    const speed = 4;
                    if (keysDown['ArrowLeft'] || keysDown['a'] || keysDown['A']) p.x -= speed;
                    if (keysDown['ArrowRight'] || keysDown['d'] || keysDown['D']) p.x += speed;
                    if (keysDown['ArrowUp'] || keysDown['w'] || keysDown['W']) p.y -= speed;
                    if (keysDown['ArrowDown'] || keysDown['s'] || keysDown['S']) p.y += speed;
                }
            });
        }
    }

    // --- Toast Notifications ---
    function showToast(message, type = 'info') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Global export
    window.PixiSceneEditor = {
        init: initEditor,
        state: state,
        createObject: createObject,
        serializeScene: serializeScene,
        deserializeScene: deserializeScene,
        loadTemplate: loadTemplate
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initEditor, 10);
    } else {
        window.addEventListener('DOMContentLoaded', initEditor);
    }
})();
