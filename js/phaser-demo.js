'use strict';

const DEMO_WIDTH = 960;
const DEMO_HEIGHT = 540;
let phaserScene;
let pixiApp;
let ui;
let hero;
let paused = false;
let playerHp = 100;
let kills = 0;
let qi = 72;
let enemies = [];
let killText;
let inventory = { 1: 3, 2: 2, 3: 1, 4: 0 };
let gold = 500;
let panel;
let enemyRoster = [];
let spawnIndex = 0;
let characterLevel = 1;
let pixiAnimationLayer;
let playerState = 'idle';

window.addEventListener('load', () => {
    createPixiUi();
    RpgMvBridge.ready.then(createPhaserDemo).catch(error => {
        console.warn('RPG Maker MV data bridge failed:', error);
        createPhaserDemo();
    });
});

function createPixiUi() {
    pixiApp = new PIXI.Application({ width: DEMO_WIDTH, height: DEMO_HEIGHT, transparent: true, antialias: true });
    document.getElementById('pixi-ui').appendChild(pixiApp.view);
    ui = new PIXI.Container();
    pixiAnimationLayer = new PIXI.Container();
    pixiApp.stage.addChild(pixiAnimationLayer);
    pixiApp.stage.addChild(ui);
    const gameRoot = document.getElementById('game-root');
    gameRoot.addEventListener('pointermove', event => setHeroTarget(event.clientX, event.clientY));
    gameRoot.addEventListener('pointerdown', event => setHeroTarget(event.clientX, event.clientY));

    const top = new PIXI.Graphics();
    top.beginFill(0x07101a, 0.86);
    top.drawRect(0, 0, DEMO_WIDTH, 82);
    top.endFill();
    ui.addChild(top);

    //addText('QUỶ CỐC BÁT HOANG', 28, 18, 25, 0xf3d28b, true);
    //addText('TU TIÊN DEMO  /  CẢNH GIỚI LUYỆN KHÍ', 30, 51, 12, 0x8da7a8);
    //addText('HÀN LẬP', 305, 18, 15, 0xe8f0df, true);
    //addText('HP', 305, 46, 11, 0x9eb3ae);
    //addText('TẦNG 1', 770, 18, 14, 0xf3d28b, true);
    //killText = addText('DIỆT 0', 770, 47, 12, 0x9eb3ae);
    //drawBar(335, 48, 210, 12, () => playerHp / 100, 0xb84c4b);

    //const pause = makeButton('Ⅱ', 887, 19, 42, 42, togglePause);
    //pause.interactive = true;
    //pause.buttonMode = true;
    //ui.addChild(pause);
    pixiApp.ticker.add(() => refreshUi());
}

function addText(value, x, y, size, color, bold) {
    const text = new PIXI.Text(value, { fontFamily: 'Georgia', fontSize: size, fill: color, fontWeight: bold ? 'bold' : 'normal' });
    text.x = x;
    text.y = y;
    ui.addChild(text);
    return text;
}

function drawBar(x, y, width, height, amount, color) {
    const bar = new PIXI.Graphics();
    bar.beginFill(0x17232c);
    bar.drawRect(x, y, width, height);
    bar.beginFill(color);
    bar.drawRect(x, y, width * amount(), height);
    bar.endFill();
    ui.addChild(bar);
}

function makeButton(label, x, y, width, height, action, fontSize = 20) {
    const button = new PIXI.Container();
    const plate = new PIXI.Graphics();
    plate.lineStyle(1, 0xf3d28b, 0.8);
    plate.beginFill(0x182c31, 0.92);
    plate.drawRect(0, 0, width, height);
    plate.endFill();
    button.addChild(plate);
    const text = new PIXI.Text(label, { fontFamily: 'Georgia', fontSize, fill: 0xf3d28b, fontWeight: 'bold' });
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    button.addChild(text);
    button.x = x;
    button.y = y;
    button.on('pointerdown', action);
    return button;
}

function refreshUi() {
    if (!ui || !phaserScene) return;
    killText.text = 'DIỆT ' + kills;
    const hint = ui.getChildByName('hint');
    if (!hint) {
        RpgMvBridge.getSkills(8).forEach((skillData, index) => {
            const label = (index + 1) + ' ' + skillData.name.slice(0, 12);
            const skill = makeButton(label, 30 + (index % 4) * 160, 415 + Math.floor(index / 4) * 48, 150, 38, () => castSkillById(skillData.id), 14);
            skill.interactive = true;
            skill.buttonMode = true;
            ui.addChild(skill);
        });
        const bag = makeButton('TÚI ĐỒ', 30, 513, 125, 30, () => openPanel('inventory'));
        bag.interactive = true;
        bag.buttonMode = true;
        ui.addChild(bag);
        const shop = makeButton('CỬA HÀNG', 165, 513, 125, 30, () => openPanel('shop'));
        shop.interactive = true;
        shop.buttonMode = true;
        ui.addChild(shop);
        const info = makeButton('NHÂN VẬT', 300, 513, 125, 30, () => openPanel('info'));
        info.interactive = true;
        info.buttonMode = true;
        ui.addChild(info);
        const label = addText('Chạm skill để thi triển', 445, 522, 13, 0xa7bcb4);
        label.name = 'hint';
    }
}

function openPanel(type) {
    if (panel) {
        ui.removeChild(panel);
        panel.destroy({ children: true });
        panel = null;
    }
    if (!type) return;
    panel = new PIXI.Container();
    const background = new PIXI.Graphics();
    background.lineStyle(2, 0xf3d28b, 0.9);
    background.beginFill(0x07131d, 0.97);
    background.drawRect(0, 0, 700, 330);
    background.endFill();
    panel.addChild(background);
    panel.x = 130;
    panel.y = 105;
    ui.addChild(panel);
    const titles = { skills: 'BÁT MẠCH KỸ NĂNG', inventory: 'TÚI CÀN KHÔN', shop: 'PHƯỜNG THỊ TU TIÊN', info: 'HỒ SƠ NHÂN VẬT' };
    const title = new PIXI.Text(titles[type], { fontFamily: 'Georgia', fontSize: 22, fill: 0xf3d28b, fontWeight: 'bold' });
    title.x = 24;
    title.y = 18;
    panel.addChild(title);
    const close = makeButton('X', 640, 14, 38, 32, () => openPanel(null));
    close.interactive = true;
    close.buttonMode = true;
    panel.addChild(close);
    if (type === 'skills') drawSkillPanel();
    if (type === 'inventory') drawInventoryPanel();
    if (type === 'shop') drawShopPanel();
    if (type === 'info') drawInfoPanel();
}

function panelText(value, x, y, size = 15, color = 0xdcece4) {
    const text = new PIXI.Text(value, { fontFamily: 'Georgia', fontSize: size, fill: color });
    text.x = x;
    text.y = y;
    panel.addChild(text);
    return text;
}

function drawSkillPanel() {
    RpgMvBridge.getSkills(8).forEach((skill, index) => {
        const button = makeButton((index + 1) + '. ' + skill.name, 24 + (index % 2) * 330, 70 + Math.floor(index / 2) * 54, 300, 40, () => castSkillById(skill.id));
        button.interactive = true;
        button.buttonMode = true;
        panel.addChild(button);
    });
}

function drawInventoryPanel() {
    panelText('Vàng: ' + gold, 24, 58, 16, 0xf3d28b);
    RpgMvBridge.data.items.filter(Boolean).filter(item => item.name).forEach((item, index) => {
        panelText(item.name + '  x' + (inventory[item.id] || 0), 30, 96 + index * 42, 16);
    });
    panelText('Vũ khí: Sword  |  ATK +10', 30, 280, 15, 0xa7bcb4);
}

function drawShopPanel() {
    panelText('Vàng hiện có: ' + gold, 24, 58, 16, 0xf3d28b);
    RpgMvBridge.getShopCatalog().slice(0, 8).forEach((item, index) => {
        const button = makeButton(item.name + '  ' + item.price + 'G', 24 + (index % 2) * 330, 90 + Math.floor(index / 2) * 48, 300, 36, () => buyItem(item));
        button.interactive = true;
        button.buttonMode = true;
        panel.addChild(button);
    });
}

function drawInfoPanel() {
    const actor = RpgMvBridge.getActor(1) || {};
    const actorClass = RpgMvBridge.getClass(actor.classId || 1) || {};
    panelText('Tên: ' + (actor.name || 'Hàn Lập'), 30, 72, 18, 0xf3d28b);
    panelText('Cấp độ: ' + characterLevel + '    Cảnh giới: Luyện Khí', 30, 112);
    panelText('HP: ' + Math.round(playerHp) + ' / 100    Linh lực: ' + qi + ' / 100', 30, 148);
    panelText('Công: ' + ((actor.params && actor.params[2]) || 30) + '    Phòng: ' + ((actor.params && actor.params[3]) || 20), 30, 184);
    panelText('Class MV: ' + (actorClass.name || 'Warrior'), 30, 220);
    panelText('Diệt yêu: ' + kills + '    Vàng: ' + gold, 30, 256);
}

function buyItem(item) {
    if (gold < (item.price || 0)) return;
    gold -= item.price || 0;
    inventory[item.id] = (inventory[item.id] || 0) + 1;
    openPanel('shop');
}

function castSkillById(skillId) {
    const skill = RpgMvBridge.getSkill(skillId);
    if (!skill || !phaserScene || qi < (skill.mpCost || 0) + 10) return;
    qi -= (skill.mpCost || 0) + 10;
    const radius = skill.scope > 1 ? 190 : 130;
    phaserScene.createBurst(hero.x, hero.y);
    enemies.slice().forEach(enemy => {
        if (Phaser.Math.Distance.Between(hero.x, hero.y, enemy.x, enemy.y) < radius) phaserScene.defeat(enemy);
    });
    openPanel(null);
}

function togglePause() {
    paused = !paused;
    if (phaserScene) phaserScene.scene[paused ? 'pause' : 'resume']();
}

function setHeroTarget(x, y) {
    if (!hero || !phaserScene) return;
    const bounds = document.getElementById('game-root').getBoundingClientRect();
    const gameX = (x - bounds.left) * DEMO_WIDTH / bounds.width;
    const gameY = (y - bounds.top) * DEMO_HEIGHT / bounds.height;
    hero.targetX = Phaser.Math.Clamp(gameX, 28, DEMO_WIDTH - 28);
    hero.targetY = Phaser.Math.Clamp(gameY, 128, DEMO_HEIGHT - 78);
}

function castSkill() {
    castSkillById(1);
}

function createPhaserDemo() {
    const config = {
        type: Phaser.AUTO,
        parent: 'phaser-game',
        width: DEMO_WIDTH,
        height: DEMO_HEIGHT,
        backgroundColor: '#101d25',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: { create, update }
    };
    new Phaser.Game(config);
}

function create() {
    phaserScene = this;
    enemyRoster = RpgMvBridge.getEnemyRoster(6, 3);
    const actor = RpgMvBridge.getActor(1);
    if (actor && actor.characterName) {
        this.load.spritesheet('player-mv', RpgMvBridge.asset('actor', actor.characterName), {
            frameWidth: 48,
            frameHeight: 48
        });
        this.load.once('complete', () => createPlayerSprite(this, actor.characterIndex || 0));
    }
    [...new Set(enemyRoster.map(enemy => enemy.battlerName).filter(Boolean))].forEach(name => {
        this.load.image('enemy-mv-' + name, RpgMvBridge.asset('enemy', name));
    });
	
	// --- BƯỚC THÊM NHẠC NỀN (BGM) ---
    // Giả sử file nhạc của bạn nằm ở thư mục audio/bgm.mp3 (hoặc .ogg)
    this.load.audio('game-bgm', 'audio/bgm/Beyond_the_Cloud_Gate.mp3');

    this.load.once('complete', () => {
        // Phát nhạc nền lặp vô hạn ngay sau khi tải xong toàn bộ tài nguyên
        if (!this.sound.get('game-bgm')) {
            const bgm = this.sound.add('game-bgm', {
                loop: true,   // Lặp lại liên tục
                volume: 0.5   // Điều chỉnh âm lượng từ 0.0 đến 1.0 tùy ý
            });
            bgm.play();
        }
    });
    // ---------------------------------
	
    this.load.start();
    this.cameras.main.setBackgroundColor('#101d25');
    this.add.rectangle(480, 310, 960, 460, 0x183b3d);
    for (let i = 0; i < 22; i++) {
        const x = Phaser.Math.Between(20, 940);
        const y = Phaser.Math.Between(100, 515);
        this.add.circle(x, y, Phaser.Math.Between(2, 7), 0x4f8874, 0.45);
    }
    hero = this.add.circle(480, 350, 23, 0xd9b46c).setStrokeStyle(5, 0xffedb1).setDepth(5);
    hero.targetX = 480;
    hero.targetY = 350;
    this.spawnTimer = 0;
    this.attackTimer = 0;
    this.createBurst = (x, y) => {
        const ring = this.add.circle(x, y, 25, 0xf3d28b, 0.25).setStrokeStyle(3, 0xffedb1);
        this.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    };
    this.defeat = enemy => {
        if (!enemy.active) return;
        enemy.active = false;
        enemies = enemies.filter(item => item !== enemy);
        playMvAnimation01(enemy.x, enemy.y);
        this.tweens.add({ targets: enemy, alpha: 0, duration: 90, onComplete: () => enemy.destroy() });
        kills++;
        gold += enemy.enemyData.reward;
        qi = Math.min(100, qi + (enemy.enemyData.isBoss ? 24 : 8));
    };
}

function createPlayerSprite(scene, characterIndex) {
    if (!hero || !scene.textures.exists('player-mv')) return;
    const blockX = (characterIndex % 4) * 3;
    const sprite = scene.add.sprite(hero.x, hero.y, 'player-mv', blockX + 1).setScale(1.45).setDepth(5);
    sprite.targetX = hero.targetX;
    sprite.targetY = hero.targetY;
    sprite.setOrigin(0.5, 0.72);
    scene.anims.create({ key: 'player-idle', frames: [{ key: 'player-mv', frame: blockX + 1 }], frameRate: 1, repeat: -1 });
    scene.anims.create({ key: 'player-run', frames: scene.anims.generateFrameNumbers('player-mv', { start: blockX, end: blockX + 2 }), frameRate: 9, repeat: -1 });
    scene.anims.create({ key: 'player-attack', frames: scene.anims.generateFrameNumbers('player-mv', { start: blockX + 6, end: blockX + 8 }), frameRate: 14, repeat: 0 });
    hero.destroy();
    hero = sprite;
    hero.anims.play('player-idle');
}

function setPlayerAnimation(state) {
    if (!hero || !hero.anims || playerState === state) return;
    playerState = state;
    hero.anims.play('player-' + state, true);
}

function playMvAnimation01(x, y) {
    const animation = RpgMvBridge.getAnimation(1);
    if (!animation || !animation.frames || !pixiAnimationLayer) return;
    const texture = PIXI.Texture.from(RpgMvBridge.asset('animation', animation.animation1Name));
    if (!texture.baseTexture.hasLoaded) {
        texture.baseTexture.once('loaded', () => playMvAnimation01(x, y));
        return;
    }

    const cells = animation.frames
        .map(frame => frame && frame[0])
        .filter(cell => cell && cell[0] >= 0);
    if (!cells.length) return;

    const effect = new PIXI.Sprite();
    effect.anchor.set(0.5);
    effect.x = x;
    effect.y = y;
    pixiAnimationLayer.addChild(effect);

    const renderCell = cell => {
        effect.texture = new PIXI.Texture(
            texture.baseTexture,
            new PIXI.Rectangle(cell[0] * 192, 0, 192, 192)
        );
        effect.rotation = (cell[4] || 0) * Math.PI / 180;
        effect.alpha = Math.max(0, Math.min(1, (cell[6] || 255) / 255));
        effect.scale.set(Math.max(0.45, (cell[3] || 180) / 240));
    };
    renderCell(cells[0]);
    let frameIndex = 0;
    let elapsed = 0;
    const tick = delta => {
        elapsed += pixiApp.ticker.deltaMS || delta * 16.67;
        if (elapsed < 150) return;
        elapsed = 0;
        frameIndex++;
        if (frameIndex >= cells.length) {
            pixiApp.ticker.remove(tick);
            pixiAnimationLayer.removeChild(effect);
            effect.destroy();
            return;
        }
        renderCell(cells[frameIndex]);
    };
    pixiApp.ticker.add(tick);
}

function update(time, delta) {
    if (paused) return;
    const speed = 0.004 * delta;
    hero.x = Phaser.Math.Linear(hero.x, hero.targetX, speed);
    hero.y = Phaser.Math.Linear(hero.y, hero.targetY, speed);
    hero.x = Phaser.Math.Clamp(hero.x, 28, DEMO_WIDTH - 28);
    hero.y = Phaser.Math.Clamp(hero.y, 128, DEMO_HEIGHT - 78);
    if (hero.anims) {
        const moving = Phaser.Math.Distance.Between(hero.x, hero.y, hero.targetX, hero.targetY) > 3;
        if (moving && playerState !== 'attack') setPlayerAnimation('run');
        if (!moving && playerState === 'run') setPlayerAnimation('idle');
    }
    this.spawnTimer -= delta;
    this.attackTimer -= delta;
    if (this.spawnTimer <= 0) { spawnEnemy(this); this.spawnTimer = 1100; }
    enemies.forEach(enemy => {
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, hero.x, hero.y);
        enemy.x += Math.cos(angle) * enemy.enemyData.speed * delta;
        enemy.y += Math.sin(angle) * enemy.enemyData.speed * delta;
        const distance = Phaser.Math.Distance.Between(hero.x, hero.y, enemy.x, enemy.y);
        if (distance < 28) {
            setEnemyAnimation(enemy, 'attack');
            playerHp = Math.max(0, playerHp - 0.035 * delta);
        } else if (distance > 42) {
            setEnemyAnimation(enemy, 'run');
        } else {
            setEnemyAnimation(enemy, 'idle');
        }
    });
    if (this.attackTimer <= 0 && enemies.length) {
        const target = Phaser.Utils.Array.GetRandom(enemies);
        const bolt = this.add.line(0, 0, hero.x, hero.y, target.x, target.y, 0xf3d28b).setLineWidth(3).setOrigin(0);
        if (hero.anims) {
            playerState = 'attack';
            hero.anims.play('player-attack', true);
            hero.once('animationcomplete-player-attack', () => {
                playerState = 'idle';
                setPlayerAnimation('idle');
            });
        }
        this.tweens.add({ targets: bolt, alpha: 0, duration: 120, onComplete: () => { bolt.destroy(); this.defeat(target); } });
        this.attackTimer = 800;
    }
}

function spawnEnemy(scene) {
    const template = enemyRoster[spawnIndex % enemyRoster.length];
    spawnIndex++;
    const side = Phaser.Math.Between(0, 3);
    const x = side % 2 ? (side === 1 ? 930 : 30) : Phaser.Math.Between(30, 930);
    const y = side % 2 ? Phaser.Math.Between(100, 510) : (side === 0 ? 100 : 510);
    const isBoss = template.isBoss;
    const textureKey = template.battlerName ? 'enemy-mv-' + template.battlerName : '';
    const enemy = textureKey && scene.textures.exists(textureKey)
        ? scene.add.image(x, y, textureKey).setDisplaySize(isBoss ? 72 : 44, isBoss ? 72 : 44)
        : scene.add.circle(x, y, isBoss ? 25 : 14, isBoss ? 0x7e3048 : 0x9b5362)
            .setStrokeStyle(isBoss ? 4 : 2, isBoss ? 0xffc36b : 0xe98b80);
    enemy.setDepth(3);
    if (enemy.type === 'Image') enemy.setOrigin(0.5, 0.8);
    enemy.enemyData = {
        name: template.name,
        isBoss,
        speed: isBoss ? 0.028 : 0.045,
        reward: isBoss ? 100 : 20,
        hp: template.params && template.params[0] ? template.params[0] : 200,
        baseScaleX: enemy.scaleX,
        baseScaleY: enemy.scaleY
    };
    if (enemy.type === 'Image') setEnemyAnimation(enemy, 'idle');
    enemies.push(enemy);
}

function setEnemyAnimation(enemy, state) {
    if (!enemy || !enemy.enemyData || enemy.enemyData.state === state) return;
    enemy.enemyData.state = state;
    const strength = enemy.enemyData.isBoss ? 1.12 : 1.08;
    const baseScaleX = enemy.enemyData.baseScaleX || enemy.scaleX;
    const baseScaleY = enemy.enemyData.baseScaleY || enemy.scaleY;
    if (enemy.enemyData.motion) enemy.scene.tweens.killTweensOf(enemy);
    if (!enemy.scene || enemy.type !== 'Image') return;
    enemy.setScale(baseScaleX, baseScaleY);
    if (state === 'idle') {
        enemy.scene.tweens.add({ targets: enemy, scaleX: baseScaleX * 1.04, scaleY: baseScaleY * 0.96, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else if (state === 'run') {
        enemy.scene.tweens.add({ targets: enemy, angle: { from: -3, to: 3 }, scaleY: baseScaleY * 1.04, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else {
        enemy.scene.tweens.add({ targets: enemy, scaleX: baseScaleX * strength, scaleY: baseScaleY * (2 - strength), duration: 100, yoyo: true, repeat: 1, ease: 'Back.Out' });
    }
    enemy.enemyData.motion = true;
}