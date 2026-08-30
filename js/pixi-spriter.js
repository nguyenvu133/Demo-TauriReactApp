/**
 * PixiJS Spriter Runtime Engine
 * Pure JavaScript Spriter (.scon / .json) Player & Skeletal Animation Renderer for PixiJS v5 - v8.
 * Supports hierarchical bones, angle interpolation with spin, texture atlas parsing, and debug visualization.
 */
(function(global) {
    'use strict';

    // Helper functions
    function sanitizeJson(input) {
        if (typeof input === 'object' && input !== null) return input;
        if (typeof input === 'string') {
            let str = input.trim();
            if (str.charCodeAt(0) === 0xFEFF) {
                str = str.slice(1);
            }
            return JSON.parse(str);
        }
        throw new Error('Invalid JSON input for Spriter data');
    }

    function lerp(a, b, t) {
        return (a !== undefined ? a : 0) + (((b !== undefined ? b : a) - (a !== undefined ? a : 0)) * t);
    }

    function interpolateAngle(a, b, t, spin) {
        a = a || 0;
        b = b !== undefined ? b : a;
        if (spin === 0) return a;
        if (spin === 1) {
            if (b - a < 0) b += 360;
        } else if (spin === -1) {
            if (b - a > 0) b -= 360;
        }
        return a + (b - a) * t;
    }

    function applyEasing(factor, curveType, c1, c2, c3, c4) {
        if (curveType === 'instant') return 0;
        if (curveType === 'quadratic') return factor * factor;
        if (curveType === 'cubic') return factor * factor * factor;
        if (curveType === 'quartic') return Math.pow(factor, 4);
        if (curveType === 'quintic') return Math.pow(factor, 5);
        if (curveType === 'bezier' && c1 !== undefined && c2 !== undefined) {
            // Cubic bezier 1D approximation
            const t = factor;
            const cx = 3 * c1;
            const bx = 3 * (c3 - c1) - cx;
            const ax = 1 - cx - bx;
            const cy = 3 * c2;
            const by = 3 * (c4 - c2) - cy;
            const ay = 1 - cy - by;
            return ((ay * t + by) * t + cy) * t;
        }
        return factor; // default 'linear'
    }

    global.PixiSpriterMath = {
        lerp,
        interpolateAngle,
        applyEasing,
        sanitizeJson
    };

})(typeof window !== 'undefined' ? window : globalThis);

(function(global) {
    'use strict';

    const { lerp, interpolateAngle, applyEasing, sanitizeJson } = global.PixiSpriterMath;

    /**
     * SpriterAtlas - Handles TexturePacker / Spriter JSON Atlas parsing & subtextures
     */
    class SpriterAtlas {
        constructor() {
            this.textures = new Map(); // filename -> PIXI.Texture
            this.fileTextures = new Map(); // "folderId:fileId" -> PIXI.Texture
            this.canvases = new Map(); // filename -> HTMLCanvasElement
            this.dataUrls = new Map(); // filename -> DataURL
            this.sourceImage = null;
            this.rawFrames = [];
            this.atlasData = null;
        }

        async load(atlasJsonOrUrl, imageOrUrl) {
            let json = atlasJsonOrUrl;
            if (typeof atlasJsonOrUrl === 'string') {
                if (atlasJsonOrUrl.startsWith('{')) {
                    json = sanitizeJson(atlasJsonOrUrl);
                } else {
                    try {
                        const res = await fetch(atlasJsonOrUrl);
                        const text = await res.text();
                        json = sanitizeJson(text);
                    } catch (e) {
                        // Check presets fallback
                        const lower = atlasJsonOrUrl.toLowerCase();
                        if (global.SPRITER_PRESETS) {
                            if (lower.includes('boy') && global.SPRITER_PRESETS.boy) {
                                json = global.SPRITER_PRESETS.boy.atlas;
                            } else if (lower.includes('viking') && global.SPRITER_PRESETS.viking) {
                                json = global.SPRITER_PRESETS.viking.atlas;
                            }
                        }
                        if (!json) throw e;
                    }
                }
            }
            this.atlasData = json;

            let img = imageOrUrl;
            if (typeof imageOrUrl === 'string') {
                img = await new Promise((resolve, reject) => {
                    const imageEl = new Image();
                    if (imageOrUrl.startsWith('http://') || imageOrUrl.startsWith('https://')) {
                        imageEl.crossOrigin = 'anonymous';
                    }
                    imageEl.onload = () => resolve(imageEl);
                    imageEl.onerror = () => {
                        const fallbackEl = new Image();
                        fallbackEl.onload = () => resolve(fallbackEl);
                        fallbackEl.onerror = (err) => reject(new Error('Failed to load atlas image: ' + imageOrUrl));
                        if (imageOrUrl.startsWith('assets/')) {
                            fallbackEl.src = 'spriter-phaser-example-main/public/' + imageOrUrl;
                        } else {
                            fallbackEl.src = 'assets/' + imageOrUrl.replace(/^.*assets\//, '');
                        }
                    };
                    imageEl.src = imageOrUrl;
                });
            }
            this.sourceImage = img;

            this._parseAtlas(json, img);
            return this;
        }

        _parseAtlas(atlasJson, img) {
            const frames = Array.isArray(atlasJson.frames)
                ? atlasJson.frames
                : Object.entries(atlasJson.frames || {}).map(([filename, data]) => ({ filename, ...data }));

            this.rawFrames = frames;

            frames.forEach(item => {
                const filename = item.filename;
                const rect = item.frame;
                const rotated = item.rotated === true || item.rotated === 'true';
                const trimmed = item.trimmed === true || item.trimmed === 'true';
                const sourceSize = item.sourceSize || { w: rect.w, h: rect.h };
                const spriteSourceSize = item.spriteSourceSize || { x: 0, y: 0, w: rect.w, h: rect.h };

                // Create clean sub-texture using canvas slice
                const canvas = document.createElement('canvas');
                canvas.width = sourceSize.w;
                canvas.height = sourceSize.h;
                const ctx = canvas.getContext('2d');

                if (rotated) {
                    ctx.save();
                    ctx.translate(spriteSourceSize.x, spriteSourceSize.y + rect.h);
                    ctx.rotate(-Math.PI / 2);
                    ctx.drawImage(
                        img,
                        rect.x, rect.y, rect.h, rect.w,
                        0, 0, rect.h, rect.w
                    );
                    ctx.restore();
                } else {
                    ctx.drawImage(
                        img,
                        rect.x, rect.y, rect.w, rect.h,
                        spriteSourceSize.x, spriteSourceSize.y, rect.w, rect.h
                    );
                }

                let pixiTexture;
                if (typeof PIXI.Texture.from === 'function') {
                    pixiTexture = PIXI.Texture.from(canvas);
                } else {
                    pixiTexture = new PIXI.Texture(new PIXI.BaseTexture(canvas));
                }

                // Store texture & canvas
                this.textures.set(filename, pixiTexture);
                this.canvases.set(filename, canvas);
                // Also store normalized key (e.g. without leading slashes or directories)
                const baseName = filename.split('/').pop();
                this.textures.set(baseName, pixiTexture);
                this.canvases.set(baseName, canvas);
            });
        }

        getCanvas(name) {
            if (!name) return null;
            if (this.canvases.has(name)) return this.canvases.get(name);
            const baseName = name.split('/').pop();
            return this.canvases.get(baseName) || null;
        }

        getDataUrl(name) {
            if (!name) return null;
            if (this.dataUrls.has(name)) return this.dataUrls.get(name);
            const canvas = this.getCanvas(name);
            if (canvas) {
                try {
                    const url = canvas.toDataURL();
                    this.dataUrls.set(name, url);
                    return url;
                } catch (e) {
                    return null;
                }
            }
            return null;
        }

        getTexture(name) {
            if (!name) return null;
            if (this.textures.has(name)) return this.textures.get(name);
            const baseName = name.split('/').pop();
            if (this.textures.has(baseName)) return this.textures.get(baseName);
            return null;
        }

        getTextureByFile(folderId, fileId) {
            return this.fileTextures.get(`${folderId}:${fileId}`) || null;
        }

        linkSpriterFiles(spriterData) {
            if (!spriterData) return;
            // Hỗ trợ cả 2 định dạng: spriterData.folders (parse xong) hoặc raw.folder (gốc)
            const folders = spriterData.folders || spriterData.folder || [];
            folders.forEach(folder => {
                const files = folder.files || folder.file || [];
                files.forEach(file => {
                    const tex = this.getTexture(file.name);
                    if (tex) {
                        this.fileTextures.set(`${folder.id}:${file.id}`, tex);
                    }
                });
            });
        }
    }

    global.SpriterAtlas = SpriterAtlas;

})(typeof window !== 'undefined' ? window : globalThis);

(function(global) {
    'use strict';

    const { sanitizeJson } = global.PixiSpriterMath;

    /**
     * SpriterData - Manages parsed SCON / SCML JSON data
     */
    class SpriterData {
        constructor(rawJson) {
            this.raw = null;
            this.entities = new Map(); // name/id -> entity
            this.folders = [];
            this.folderFileMap = new Map(); // "folderId:fileId" -> file object
            if (rawJson) {
                this.parse(rawJson);
            }
        }

        static async fromUrl(url) {
            try {
                const res = await fetch(url);
                const text = await res.text();
                const json = sanitizeJson(text);
                return new SpriterData(json);
            } catch (err) {
                const lower = String(url).toLowerCase();
                if (global.SPRITER_PRESETS) {
                    if (lower.includes('boy') && global.SPRITER_PRESETS.boy) {
                        return new SpriterData(global.SPRITER_PRESETS.boy.scon);
                    } else if (lower.includes('viking') && global.SPRITER_PRESETS.viking) {
                        return new SpriterData(global.SPRITER_PRESETS.viking.scon);
                    }
                }
                throw err;
            }
        }

        parse(rawJson) {
            this.raw = sanitizeJson(rawJson);
            this.folders = this.raw.folder || [];

            // Index folders and files
            this.folders.forEach(f => {
                if (f.file) {
                    f.file.forEach(file => {
                        this.folderFileMap.set(`${f.id}:${file.id}`, file);
                    });
                }
            });

            // Index entities & animations
            const entities = this.raw.entity || [];
            entities.forEach(ent => {
                const animMap = new Map();
                if (ent.animation) {
                    ent.animation.forEach(anim => {
                        animMap.set(anim.name, anim);
                        animMap.set(String(anim.id), anim);
                    });
                }
                ent._animMap = animMap;
                this.entities.set(ent.name, ent);
                this.entities.set(String(ent.id), ent);
            });
        }

        getEntity(nameOrId) {
            if (nameOrId === undefined || nameOrId === null) {
                const first = (this.raw.entity && this.raw.entity[0]) || null;
                return first;
            }
            return this.entities.get(String(nameOrId)) || (this.raw.entity && this.raw.entity[0]) || null;
        }

        getAnimation(entityNameOrId, animNameOrId) {
            const ent = this.getEntity(entityNameOrId);
            if (!ent || !ent._animMap) return null;
            if (animNameOrId === undefined || animNameOrId === null) {
                return (ent.animation && ent.animation[0]) || null;
            }
            return ent._animMap.get(String(animNameOrId)) || (ent.animation && ent.animation[0]) || null;
        }

        getFile(folderId, fileId) {
            return this.folderFileMap.get(`${folderId}:${fileId}`) || null;
        }

        getEntityNames() {
            return (this.raw.entity || []).map(e => e.name);
        }

        getAnimationNames(entityNameOrId) {
            const ent = this.getEntity(entityNameOrId);
            if (!ent || !ent.animation) return [];
            return ent.animation.map(a => a.name);
        }
    }

    global.SpriterData = SpriterData;

})(typeof window !== 'undefined' ? window : globalThis);

(function(global) {
    'use strict';

    const { lerp, interpolateAngle, applyEasing } = global.PixiSpriterMath;

    /**
     * SpriterObject - PixiJS Container for playing Spriter animations
     */
    class SpriterObject extends PIXI.Container {
        constructor(spriterData, atlas, options = {}) {
            super();

            this.spriterData = spriterData;
            this.atlas = atlas;
            if (atlas && spriterData) {
                this.atlas.linkSpriterFiles(spriterData);
            }

            // Options
            this.speed = options.speed !== undefined ? options.speed : 1.0;
            this.loop = options.loop !== undefined ? options.loop : true;
            this.paused = options.autoplay === false;
            this.showBones = options.showBones || false;
            this.showBoxes = options.showBoxes || false;
            this._flipX = options.flipX || false;
            this._flipY = options.flipY || false;

            // Runtime state
            this.currentEntity = null;
            this.currentEntityName = '';
            this.currentAnimation = null;
            this.currentAnimationName = '';
            this.animLength = 1000;
            this.time = 0;
            this.activeBones = {}; // id -> { name, x, y, angle, scale_x, scale_y, parent }
            this.activeBoneList = []; // ordered list

            // Display containers
            this.spritesContainer = new PIXI.Container();
            this.debugContainer = new PIXI.Container();
            this.debugGraphics = new PIXI.Graphics();
            this.debugContainer.addChild(this.debugGraphics);

            this.addChild(this.spritesContainer);
            this.addChild(this.debugContainer);

            // Sprite Pool
            this.spritePool = [];
            this.activeSprites = [];

            // Callbacks
            this.onAnimationChange = null;
            this.onLoop = null;
            this.onComplete = null;

            // Setup entity & animation
            this.setEntity(options.entity || options.entityName);
            if (options.animation) {
                this.play(options.animation, { loop: this.loop, speed: this.speed });
            } else {
                const anims = this.getAnimationNames();
                if (anims.length > 0) {
                    this.play(anims[0], { loop: this.loop, speed: this.speed });
                }
            }

            this._applyFlip();
        }

        get flipX() { return this._flipX; }
        set flipX(val) {
            this._flipX = !!val;
            this._applyFlip();
        }

        get flipY() { return this._flipY; }
        set flipY(val) {
            this._flipY = !!val;
            this._applyFlip();
        }

        _applyFlip() {
            this.spritesContainer.scale.x = this._flipX ? -1 : 1;
            this.spritesContainer.scale.y = this._flipY ? -1 : 1;
            this.debugContainer.scale.x = this._flipX ? -1 : 1;
            this.debugContainer.scale.y = this._flipY ? -1 : 1;
        }

        faceLeft() {
            this.flipX = true;
        }

        faceRight() {
            this.flipX = false;
        }

        toggleFlip() {
            this.flipX = !this.flipX;
        }

        setEntity(entityNameOrId) {
            const ent = this.spriterData.getEntity(entityNameOrId);
            if (!ent) return false;
            this.currentEntity = ent;
            this.currentEntityName = ent.name || String(ent.id);
            if (this.currentAnimation) {
                // Try to keep same animation name if available
                const animName = this.currentAnimation.name;
                const anims = this.getAnimationNames();
                if (anims.includes(animName)) {
                    this.play(animName);
                } else if (anims.length > 0) {
                    this.play(anims[0]);
                }
            }
            return true;
        }

        play(animationName, options = {}) {
            if (!this.currentEntity) {
                this.setEntity();
            }
            const anim = this.spriterData.getAnimation(this.currentEntityName, animationName);
            if (!anim) return false;

            this.currentAnimation = anim;
            this.currentAnimationName = anim.name;
            this.animLength = anim.length || 1000;

            if (options.loop !== undefined) this.loop = options.loop;
            if (options.speed !== undefined) this.speed = options.speed;
            if (options.reset !== false) {
                this.time = 0;
            }
            this.paused = false;

            if (typeof this.onAnimationChange === 'function') {
                this.onAnimationChange(this.currentAnimationName, this);
            }

            this.update(0);
            return true;
        }

        pause() {
            this.paused = true;
        }

        resume() {
            this.paused = false;
        }

        togglePause() {
            this.paused = !this.paused;
        }

        stop() {
            this.paused = true;
            this.time = 0;
            this.update(0);
        }

        setTime(ms) {
            this.time = Math.max(0, Math.min(this.animLength, ms));
            this.update(0);
        }

        seek(factor) {
            this.setTime((this.animLength || 1000) * Math.max(0, Math.min(1, factor)));
        }

        setSpeed(speed) {
            this.speed = Math.max(0.01, speed);
        }

        setLoop(loop) {
            this.loop = !!loop;
        }

        setShowBones(val) {
            this.showBones = !!val;
            this.debugContainer.visible = this.showBones || this.showBoxes;
            this.update(0);
        }

        setShowBoxes(val) {
            this.showBoxes = !!val;
            this.debugContainer.visible = this.showBones || this.showBoxes;
            this.update(0);
        }

        getDuration() {
            return this.animLength || 1000;
        }

        getTime() {
            return this.time;
        }

        getProgress() {
            return this.animLength > 0 ? (this.time / this.animLength) : 0;
        }

        getEntityNames() {
            return this.spriterData.getEntityNames();
        }

        getAnimationNames() {
            return this.spriterData.getAnimationNames(this.currentEntityName);
        }

        nextAnimation(step = 1) {
            const list = this.getAnimationNames();
            if (!list.length) return;
            const idx = list.indexOf(this.currentAnimationName);
            const nextIdx = (idx + step + list.length) % list.length;
            this.play(list[nextIdx], { loop: this.loop });
        }

        prevAnimation() {
            this.nextAnimation(-1);
        }

        _getSprite(index) {
            while (this.spritePool.length <= index) {
                const sp = new PIXI.Sprite();
                this.spritePool.push(sp);
                this.spritesContainer.addChild(sp);
            }
            const sprite = this.spritePool[index];
            sprite.visible = true;
            return sprite;
        }

        update(deltaMs = 0) {
            if (!this.currentAnimation) return;

            // Advance time if not paused
            if (!this.paused && deltaMs > 0) {
                this.time += deltaMs * this.speed;
                if (this.time >= this.animLength) {
                    if (this.loop) {
                        this.time = this.time % this.animLength;
                        if (typeof this.onLoop === 'function') {
                            this.onLoop(this.currentAnimationName, this);
                        }
                    } else {
                        this.time = this.animLength;
                        this.paused = true;
                        if (typeof this.onComplete === 'function') {
                            this.onComplete(this.currentAnimationName, this);
                        }
                    }
                }
            }

            const anim = this.currentAnimation;
            const t = this.time;
            const mainlineKeys = (anim.mainline && anim.mainline.key) || [];
            if (!mainlineKeys.length) return;

            // 1. Find active mainline key
            let mainKey = mainlineKeys[0];
            for (let i = 0; i < mainlineKeys.length; i++) {
                if ((mainlineKeys[i].time || 0) <= t) {
                    mainKey = mainlineKeys[i];
                } else {
                    break;
                }
            }

            // 2. Compute Bone Transforms
            this.activeBones = {};
            this.activeBoneList = [];
            const boneTransforms = {};

            if (mainKey.bone_ref) {
                for (let b = 0; b < mainKey.bone_ref.length; b++) {
                    const bRef = mainKey.bone_ref[b];
                    const timeline = anim.timeline && anim.timeline[bRef.timeline];
                    if (!timeline || !timeline.key || !timeline.key.length) continue;

                    const k1 = timeline.key[bRef.key];
                    if (!k1) continue;

                    let k2 = null;
                    if (bRef.key + 1 < timeline.key.length) {
                        k2 = timeline.key[bRef.key + 1];
                    } else if (this.loop && timeline.key.length > 1) {
                        k2 = timeline.key[0];
                    }

                    let t1 = k1.time || 0;
                    let t2 = k2 ? (k2.time || 0) : t1;
                    if (t2 < t1) t2 += this.animLength;

                    let f = (t2 === t1) ? 0 : (t - t1) / (t2 - t1);
                    f = Math.max(0, Math.min(1, f));
                    f = applyEasing(f, k1.curve_type, k1.c1, k1.c2, k1.c3, k1.c4);

                    const b1 = k1.bone || {};
                    const b2 = (k2 && k2.bone) ? k2.bone : b1;

                    const lx = lerp(b1.x || 0, b2.x || 0, f);
                    const ly = lerp(b1.y || 0, b2.y || 0, f);
                    const lang = interpolateAngle(b1.angle || 0, b2.angle || 0, f, k1.spin !== undefined ? k1.spin : 1);
                    const lsx = lerp(b1.scale_x !== undefined ? b1.scale_x : 1, b2.scale_x !== undefined ? b2.scale_x : 1, f);
                    const lsy = lerp(b1.scale_y !== undefined ? b1.scale_y : 1, b2.scale_y !== undefined ? b2.scale_y : 1, f);

                    let wx = lx, wy = ly, wAng = lang, wsx = lsx, wsy = lsy;
                    if (bRef.parent !== undefined && boneTransforms[bRef.parent]) {
                        const parent = boneTransforms[bRef.parent];
                        const rad = parent.angle * (Math.PI / 180);
                        const px = lx * parent.scale_x;
                        const py = ly * parent.scale_y;

                        wx = parent.x + px * Math.cos(rad) - py * Math.sin(rad);
                        wy = parent.y + px * Math.sin(rad) + py * Math.cos(rad);
                        wAng = parent.angle + lang * Math.sign(parent.scale_x * parent.scale_y);
                        wsx = parent.scale_x * lsx;
                        wsy = parent.scale_y * lsy;
                    }

                    const boneInfo = {
                        id: bRef.id !== undefined ? bRef.id : b,
                        name: timeline.name || ('bone_' + b),
                        parent: bRef.parent,
                        x: wx,
                        y: wy,
                        angle: wAng,
                        scale_x: wsx,
                        scale_y: wsy
                    };
                    boneTransforms[boneInfo.id] = boneInfo;
                    this.activeBones[boneInfo.id] = boneInfo;
                    this.activeBoneList.push(boneInfo);
                }
            }

            // 3. Render Object Sprites
            let spriteIndex = 0;
            if (mainKey.object_ref) {
                for (let o = 0; o < mainKey.object_ref.length; o++) {
                    const oRef = mainKey.object_ref[o];
                    const timeline = anim.timeline && anim.timeline[oRef.timeline];
                    if (!timeline || !timeline.key || !timeline.key.length) continue;

                    const k1 = timeline.key[oRef.key];
                    if (!k1 || !k1.object) continue;

                    let k2 = null;
                    if (oRef.key + 1 < timeline.key.length) {
                        k2 = timeline.key[oRef.key + 1];
                    } else if (this.loop && timeline.key.length > 1) {
                        k2 = timeline.key[0];
                    }

                    const obj1 = k1.object;
                    const folderId = obj1.folder !== undefined ? obj1.folder : 0;
                    const fileId = obj1.file !== undefined ? obj1.file : 0;
                    const fileMeta = this.spriterData.getFile(folderId, fileId);

                    let lx = obj1.x || 0;
                    let ly = obj1.y || 0;
                    let lang = obj1.angle || 0;
                    let lsx = obj1.scale_x !== undefined ? obj1.scale_x : 1;
                    let lsy = obj1.scale_y !== undefined ? obj1.scale_y : 1;
                    let lpx = obj1.pivot_x !== undefined ? obj1.pivot_x : (fileMeta ? fileMeta.pivot_x : 0);
                    let lpy = obj1.pivot_y !== undefined ? obj1.pivot_y : (fileMeta ? fileMeta.pivot_y : 1);
                    let la = obj1.a !== undefined ? obj1.a : 1;

                    // Interpolate with k2 if same image file
                    if (k2 && k2.object && k2.object.folder === folderId && k2.object.file === fileId) {
                        const obj2 = k2.object;
                        let t1 = k1.time || 0;
                        let t2 = k2.time || 0;
                        if (t2 < t1) t2 += this.animLength;
                        let f = (t2 === t1) ? 0 : (t - t1) / (t2 - t1);
                        f = Math.max(0, Math.min(1, f));
                        f = applyEasing(f, k1.curve_type, k1.c1, k1.c2, k1.c3, k1.c4);

                        lx = lerp(lx, obj2.x || 0, f);
                        ly = lerp(ly, obj2.y || 0, f);
                        lang = interpolateAngle(lang, obj2.angle || 0, f, k1.spin !== undefined ? k1.spin : 1);
                        lsx = lerp(lsx, obj2.scale_x !== undefined ? obj2.scale_x : 1, f);
                        lsy = lerp(lsy, obj2.scale_y !== undefined ? obj2.scale_y : 1, f);
                        if (obj2.pivot_x !== undefined) lpx = lerp(lpx, obj2.pivot_x, f);
                        if (obj2.pivot_y !== undefined) lpy = lerp(lpy, obj2.pivot_y, f);
                        if (obj2.a !== undefined) la = lerp(la, obj2.a, f);
                    }

                    // Apply Parent Bone transform
                    let wx = lx, wy = ly, wAng = lang, wsx = lsx, wsy = lsy;
                    if (oRef.parent !== undefined && boneTransforms[oRef.parent]) {
                        const parent = boneTransforms[oRef.parent];
                        const rad = parent.angle * (Math.PI / 180);
                        const px = lx * parent.scale_x;
                        const py = ly * parent.scale_y;

                        wx = parent.x + px * Math.cos(rad) - py * Math.sin(rad);
                        wy = parent.y + px * Math.sin(rad) + py * Math.cos(rad);
                        wAng = parent.angle + lang * Math.sign(parent.scale_x * parent.scale_y);
                        wsx = parent.scale_x * lsx;
                        wsy = parent.scale_y * lsy;
                    }

                    // Get Texture
                    let texture = this.atlas.getTextureByFile(folderId, fileId);
                    if (!texture && fileMeta) {
                        texture = this.atlas.getTexture(fileMeta.name);
                    }

                    if (texture) {
                        const sprite = this._getSprite(spriteIndex++);
                        sprite.texture = texture;
                        sprite.x = wx;
                        sprite.y = -wy; // Spriter Y is UP, Pixi Y is DOWN
                        sprite.rotation = -wAng * (Math.PI / 180);
                        sprite.scale.set(wsx, wsy);
                        sprite.anchor.set(lpx !== undefined ? lpx : 0, 1 - (lpy !== undefined ? lpy : 1));
                        sprite.alpha = la;
                    }
                }
            }

            // Hide unused sprites in pool
            for (let i = spriteIndex; i < this.spritePool.length; i++) {
                this.spritePool[i].visible = false;
            }

            // 4. Debug Visualization (Bones / Skeleton / Boxes)
            this._renderDebug(boneTransforms);
        }

        _renderDebug(boneTransforms) {
            const g = this.debugGraphics;
            if (typeof g.clear === 'function') g.clear();

            if (!this.showBones && !this.showBoxes) {
                this.debugContainer.visible = false;
                return;
            }
            this.debugContainer.visible = true;

            if (this.showBones) {
                // Draw bone connections
                Object.values(boneTransforms).forEach(bone => {
                    const bx = bone.x;
                    const by = -bone.y;

                    // If has parent, draw connection line
                    if (bone.parent !== undefined && boneTransforms[bone.parent]) {
                        const parent = boneTransforms[bone.parent];
                        const px = parent.x;
                        const py = -parent.y;

                        if (typeof g.setStrokeStyle === 'function') {
                            g.setStrokeStyle({ width: 2, color: 0x38bdf8, alpha: 0.85 });
                            g.beginPath();
                            g.moveTo(px, py);
                            g.lineTo(bx, by);
                            g.stroke();
                        } else if (typeof g.lineStyle === 'function') {
                            g.lineStyle(2, 0x38bdf8, 0.85);
                            g.moveTo(px, py);
                            g.lineTo(bx, by);
                        }
                    }

                    // Draw joint circle
                    if (typeof g.circle === 'function') {
                        g.setFillStyle({ color: 0xf43f5e, alpha: 0.9 });
                        g.circle(bx, by, 4);
                        g.fill();
                    } else if (typeof g.drawCircle === 'function') {
                        g.beginFill(0xf43f5e, 0.9);
                        g.drawCircle(bx, by, 4);
                        g.endFill();
                    }
                });
            }

            if (this.showBoxes) {
                const b = this.spritesContainer.getLocalBounds ? this.spritesContainer.getLocalBounds() : this.spritesContainer.getBounds();
                if (b) {
                    if (typeof g.rect === 'function') {
                        g.setStrokeStyle({ width: 1.5, color: 0x10b981, alpha: 0.9 });
                        g.rect(b.x, b.y, b.width, b.height);
                        g.stroke();
                    } else if (typeof g.drawRect === 'function') {
                        g.lineStyle(1.5, 0x10b981, 0.9);
                        g.drawRect(b.x, b.y, b.width, b.height);
                    }
                }
            }
        }
    }

    /**
     * SpriterLoader - High-level manager for preloading & creating Spriter characters
     */
    class SpriterLoader {
        constructor() {
            this.cache = new Map(); // key -> { data, atlas }
        }

        async load(key, sconUrl, atlasJsonUrl, imgUrl) {
            if (global.SPRITER_PRESETS && global.SPRITER_PRESETS[key]) {
                const p = global.SPRITER_PRESETS[key];
                return await this.loadFromData(key, p.scon, p.atlas, imgUrl || p.png);
            }
            const spriterData = await SpriterData.fromUrl(sconUrl);
            const atlas = new SpriterAtlas();
            await atlas.load(atlasJsonUrl, imgUrl);
            atlas.linkSpriterFiles(spriterData);

            this.cache.set(key, { spriterData, atlas });
            return { spriterData, atlas };
        }

        async loadFromData(key, sconJson, atlasJson, imageSource) {
            const spriterData = new SpriterData(sconJson);
            const atlas = new SpriterAtlas();
            await atlas.load(atlasJson, imageSource);
            atlas.linkSpriterFiles(spriterData);

            this.cache.set(key, { spriterData, atlas });
            return { spriterData, atlas };
        }

        create(key, options = {}) {
            const entry = this.cache.get(key);
            if (!entry) {
                throw new Error('Spriter asset not loaded: ' + key);
            }
            return new SpriterObject(entry.spriterData, entry.atlas, options);
        }

        has(key) {
            return this.cache.has(key);
        }

        get(key) {
            return this.cache.get(key) || null;
        }
    }

    // Export to global
    global.SpriterObject = SpriterObject;
    global.SpriterLoader = SpriterLoader;
    global.pixiSpriterLoader = new SpriterLoader();

})(typeof window !== 'undefined' ? window : globalThis);