/*
 * Tu Tiên Demo - Auto-attack survival game
 * Version 9: Integrated Items.json, Skills.json, and Weapons.json parsers
 */
'use strict';

window.startGame = startGame;

const GameState = {
    LOADING: 'LOADING',
    MAIN_MENU: 'MAIN_MENU',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER'
};

// Thay đổi độ phân giải thành tỷ lệ 9:16 chuẩn (Ví dụ: 540 x 960)
const WIDTH = 540;
const HEIGHT = 960;
const PLAYER_ATTACK_RANGE = 300;
const BASE_ATTACK_COOLDOWN = 100;
const BASE_PROJECTILE_SPEED = 4;
const ENEMY_SPAWN_INTERVAL = 90;
const SCORE_PER_KILL = 10;
const PLAYER_MOVE_SPEED = 0.1;

let app;
let gameState;
let rpgData = {
    animations: null,
    enemies: null,
    items: null,
    skills: null,
    weapons: null,
    armors: null,
    classes: null,
    commonEvents: null,
    map001: null,
    mapInfos: null,
    states: null,
    system: null,
    tilesets: null,
    troops: null
};

let animationTextures = {};
let enemyTextures = {};
let mousePosition = { x: WIDTH / 2, y: HEIGHT / 2 };

let loadingLayer, menuLayer, gameLayer, hudLayer;
let player;
let enemies = [];
let projectiles = [];
let activeAnimations = [];

let level, score, experienceToNextLevel;
let attackCooldownTimer, playerAttackCooldown, projectileSpeed, enemySpawnTimer;
let nameText, levelText, scoreText;

let playerTexture;
let playerSprite;
let playerAnimData = {
    currentFrame: 0,
    frameTimer: 0,
    frameSpeed: 6,
    totalCols: 3,
    totalRows: 4,
    directionRow: 0,
    frameWidth: 0,
    frameHeight: 0
};

function startGame() {
    // Sửa lỗi khởi tạo PIXI.Application với resizeTo để tự động điều chỉnh kích thước
    app = new PIXI.Application({
        resizeTo: window,
        backgroundColor: 0x0a0a1a,
        antialias: true
    });
    document.body.appendChild(app.view);

    app.stage.interactive = true;
    app.stage.on('pointermove', onPointerMove);

    loadingLayer = new PIXI.Container();
    menuLayer = new PIXI.Container();
    gameLayer = new PIXI.Container();
    hudLayer = new PIXI.Container();
    
    app.stage.addChild(loadingLayer, menuLayer, gameLayer, hudLayer);

    createLoadingScreen();
    changeState(GameState.LOADING);
    
    loadGameData();

    app.ticker.add(update);
}

function changeState(newState) {
    gameState = newState;
    loadingLayer.visible = (gameState === GameState.LOADING);
    menuLayer.visible = (gameState === GameState.MAIN_MENU);
    gameLayer.visible = (gameState === GameState.PLAYING);
    hudLayer.visible = (gameState === GameState.PLAYING);
}

async function loadGameData() {
    try {
        const [
            animRes, enemyRes, itemRes, skillRes, weaponRes,
            armorRes, classRes, commonEventRes, mapRes, mapInfoRes,
            stateRes, systemRes, tilesetRes, troopRes
        ] = await Promise.all([
            fetch('/data/Animations.json'),
            fetch('/data/Enemies.json'),
            fetch('/data/Items.json'),
            fetch('/data/Skills.json'),
            fetch('/data/Weapons.json'),
            fetch('/data/Armors.json'),
            fetch('/data/Classes.json'),
            fetch('/data/CommonEvents.json'),
            fetch('/data/Map001.json'),
            fetch('/data/MapInfos.json'),
            fetch('/data/States.json'),
            fetch('/data/System.json'),
            fetch('/data/Tilesets.json'),
            fetch('/data/Troops.json')
        ]);

        if (!animRes.ok || !enemyRes.ok || !itemRes.ok || !skillRes.ok || !weaponRes.ok ||
            !armorRes.ok || !classRes.ok || !commonEventRes.ok || !mapRes.ok || !mapInfoRes.ok ||
            !stateRes.ok || !systemRes.ok || !tilesetRes.ok || !troopRes.ok) {
            throw new Error(`Một hoặc nhiều file JSON trong thư mục data/ không thể tải được!`);
        }

        rpgData.animations = await animRes.json();
        rpgData.enemies = await enemyRes.json();
        rpgData.items = await itemRes.json();
        rpgData.skills = await skillRes.json();
        rpgData.weapons = await weaponRes.json();
        rpgData.armors = await armorRes.json();
        rpgData.classes = await classRes.json();
        rpgData.commonEvents = await commonEventRes.json();
        rpgData.map001 = await mapRes.json();
        rpgData.mapInfos = await mapInfoRes.json();
        rpgData.states = await stateRes.json();
        rpgData.system = await systemRes.json();
        rpgData.tilesets = await tilesetRes.json();
        rpgData.troops = await troopRes.json();
        
        parseLoadedRpgData();

        createMainMenu();
        createHud();
        changeState(GameState.MAIN_MENU);

    } catch (e) {
        console.error("Lỗi tải dữ liệu game:", e);
        const errorText = loadingLayer.getChildAt(0);
        errorText.text = 'Lỗi: Không thể tải đầy đủ các file JSON.\nHãy kiểm tra lại thư mục data/';
    }
}

function parseLoadedRpgData() {
    const validItems = rpgData.items.filter(i => i && i.name);
    const validSkills = rpgData.skills.filter(s => s && s.name);
    const validWeapons = rpgData.weapons.filter(w => w && w.name);
    const validArmors = rpgData.armors.filter(a => a && a.name);
    const validStates = rpgData.states.filter(st => st && st.name);

    console.log(`- Tổng số Items: ${validItems.length}`);
    console.log(`- Tổng số Skills: ${validSkills.length}`);
    console.log(`- Tổng số Weapons: ${validWeapons.length}`);
    console.log(`- Tổng số Armors: ${validArmors.length}`);
    console.log(`- Tổng số States (Hiệu ứng): ${validStates.length}`);
    console.log(`- Tên Game (từ System.json): ${rpgData.system ? rpgData.system.gameTitle : 'N/A'}`);
}

function createLoadingScreen() {
    const loadingText = new PIXI.Text('Đang tải dữ liệu RPG Maker (Items, Skills, Weapons)...', {
        fontFamily: 'Arial', fontSize: 18, fill: 0xffffff, align: 'center'
    });
    loadingText.anchor.set(0.5);
    loadingText.x = WIDTH / 2;
    loadingText.y = HEIGHT / 2;
    loadingLayer.addChild(loadingText);
}

function createMainMenu() {
    const title = new PIXI.Text('Tu Tiên Demo', {
        fontFamily: 'Arial', fontSize: 44, fill: 0xffffff, fontWeight: 'bold'
    });
    title.anchor.set(0.5);
    title.x = WIDTH / 2;
    title.y = HEIGHT / 3;
    menuLayer.addChild(title);

    const newGameBtn = createButton('Bắt Đầu Game', HEIGHT / 2, () => startNewGame());
    menuLayer.addChild(newGameBtn);
}

function createButton(text, y, onClick) {
    const button = new PIXI.Text(`[ ${text} ]`, {
        fontFamily: 'Arial', fontSize: 28, fill: 0xcccccc
    });
    button.anchor.set(0.5);
    button.x = WIDTH / 2;
    button.y = y;
    button.interactive = true;
    button.buttonMode = true;
    button.on('pointerover', () => button.style.fill = 0xffffff);
    button.on('pointerout', () => button.style.fill = 0xcccccc);
    button.on('pointerdown', onClick);
    return button;
}

function createHud() {
    nameText = new PIXI.Text('', { fontFamily: 'Arial', fontSize: 20, fill: 0x3498db });
    nameText.x = 20; nameText.y = 20;
    levelText = new PIXI.Text('', { fontFamily: 'Arial', fontSize: 20, fill: 0xffffff });
    levelText.x = 20; levelText.y = 48;
    scoreText = new PIXI.Text('', { fontFamily: 'Arial', fontSize: 20, fill: 0xffffff });
    scoreText.anchor.set(1, 0); scoreText.x = WIDTH - 20; scoreText.y = 20;
    hudLayer.addChild(nameText, levelText, scoreText);
}

function startNewGame() {
    let baseAtk = 30;
    if (rpgData.weapons && rpgData.weapons[1]) {
        baseAtk += rpgData.weapons[1].params[2] || 0;
    }

    const mockActor = { name: "Hàn Lập", params: [1000, 500, baseAtk, 20, 20, 20, 25, 20] };
    playerAttackCooldown = Math.max(20, BASE_ATTACK_COOLDOWN - (mockActor.params[6] * 0.5));
    projectileSpeed = BASE_PROJECTILE_SPEED + (mockActor.params[2] * 0.05);

    level = 1; score = 0; experienceToNextLevel = 100;
    attackCooldownTimer = 0; enemySpawnTimer = 0;

    gameLayer.removeChildren();
    enemies = []; projectiles = []; activeAnimations = [];

    createPlayer();
    updateHud(mockActor.name);
    changeState(GameState.PLAYING);
}

function onPointerMove(event) {
    mousePosition = event.data.global;
}

function createPlayer() {
    player = new PIXI.Graphics();
    player.beginFill(0x3498db);
    player.drawCircle(0, 0, 15);
    player.endFill();
    // Đặt vị trí nhân vật nằm thấp xuống dưới một chút cho phù hợp khung dọc điện thoại
    player.x = WIDTH / 2;
    player.y = HEIGHT * 0.75;
    gameLayer.addChild(player);
}

function updatePlayerAnimation(delta, moveX, moveY) {
    if (!playerTexture || !playerTexture.baseTexture.valid) return;

    if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
        playerAnimData.frameTimer += delta;

        if (Math.abs(moveX) > Math.abs(moveY)) {
            playerAnimData.directionRow = (moveX > 0) ? 2 : 1;
        } else {
            playerAnimData.directionRow = (moveY > 0) ? 0 : 3;
        }

        if (playerAnimData.frameTimer >= playerAnimData.frameSpeed) {
            playerAnimData.frameTimer = 0;
            playerAnimData.currentFrame = (playerAnimData.currentFrame + 1) % playerAnimData.totalCols;
            updatePlayerFrame();
        }
    } else {
        playerAnimData.currentFrame = 1;
        updatePlayerFrame();
    }
}

function updatePlayerFrame() {
    if (!playerAnimData.frameWidth || !playerAnimData.frameHeight) return;

    const fx = playerAnimData.currentFrame * playerAnimData.frameWidth;
    const fy = playerAnimData.directionRow * playerAnimData.frameHeight;

    playerSprite.texture = new PIXI.Texture(
        playerTexture.baseTexture,
        new PIXI.Rectangle(fx, fy, playerAnimData.frameWidth, playerAnimData.frameHeight)
    );
}

function createEnemy() {
    const validEnemies = rpgData.enemies.filter(e => e && e.name);
    if (validEnemies.length === 0) return;

    const enemyTemplate = validEnemies[Math.floor(Math.random() * validEnemies.length)];
    const enemyName = enemyTemplate.name;
    const battlerName = enemyTemplate.battlerName;
    const enemyAgi = enemyTemplate.params[6] || 20;
    const enemySpeed = Math.max(0.5, enemyAgi * 0.05);

    let enemyContainer;
    if (battlerName) {
        const imageUrl = `img/enemies/${battlerName}.png`;
        if (!enemyTextures[imageUrl]) {
            enemyTextures[imageUrl] = PIXI.Texture.from(imageUrl);
        }
        enemyContainer = new PIXI.Sprite(enemyTextures[imageUrl]);
        enemyContainer.anchor.set(0.5);
        enemyContainer.scale.set(0.6);
    } else {
        enemyContainer = new PIXI.Graphics();
        enemyContainer.beginFill(0xe74c3c);
        enemyContainer.drawCircle(0, 0, 12);
        enemyContainer.endFill();
    }

    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
        case 0: enemyContainer.x = Math.random() * WIDTH; enemyContainer.y = -20; break;
        case 1: enemyContainer.x = WIDTH + 20; enemyContainer.y = Math.random() * HEIGHT; break;
        case 2: enemyContainer.x = Math.random() * WIDTH; enemyContainer.y = HEIGHT + 20; break;
        case 3: enemyContainer.x = -20; enemyContainer.y = Math.random() * HEIGHT; break;
    }

    enemyContainer.enemyData = { name: enemyName, speed: enemySpeed };
    enemies.push(enemyContainer);
    gameLayer.addChild(enemyContainer);
}

function createProjectile(target) {
    const projectile = new PIXI.Graphics();
    projectile.beginFill(0xffffff);
    projectile.drawRect(0, 0, 10, 3);
    projectile.endFill();
    projectile.x = player.x;
    projectile.y = player.y;

    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const angle = Math.atan2(dy, dx);
    projectile.rotation = angle;
    projectile.vx = Math.cos(angle) * projectileSpeed;
    projectile.vy = Math.sin(angle) * projectileSpeed;

    projectiles.push(projectile);
    gameLayer.addChild(projectile);
}

function playRpgAnimation(animId, x, y) {
    if (!rpgData.animations || !rpgData.animations[animId]) return;
    
    const animData = rpgData.animations[animId];
    const imageName = animData.animation1Name;
    if (!imageName) return;

    const imageUrl = `img/animations/${imageName}.png`;
    if (!animationTextures[imageUrl]) {
        animationTextures[imageUrl] = PIXI.Texture.from(imageUrl);
    }

    const baseTexture = animationTextures[imageUrl];
    const frameWidth = 192;
    const frameHeight = 192;
    const totalFrames = animData.frames ? animData.frames.length : 1;

    const animSprite = new PIXI.Sprite();
    animSprite.anchor.set(0.5);
    animSprite.x = x;
    animSprite.y = y;

    gameLayer.addChild(animSprite);

    activeAnimations.push({
        sprite: animSprite,
        baseTexture: baseTexture,
        frames: animData.frames,
        currentFrameIndex: 0,
        frameTimer: 0,
        frameSpeed: 4,
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        totalFrames: totalFrames
    });
}

function update(delta) {
    if (gameState === GameState.PLAYING) {
        updatePlaying(delta);
    }
}

function updatePlaying(delta) {
    player.x += (mousePosition.x - player.x) * PLAYER_MOVE_SPEED * delta;
    player.y += (mousePosition.y - player.y) * PLAYER_MOVE_SPEED * delta;

    attackCooldownTimer -= delta;
    enemySpawnTimer -= delta;

    if (attackCooldownTimer <= 0) {
        const target = findClosestEnemy();
        if (target) {
            createProjectile(target);
            attackCooldownTimer = playerAttackCooldown;
        }
    }

    if (enemySpawnTimer <= 0) {
        createEnemy();
        enemySpawnTimer = ENEMY_SPAWN_INTERVAL;
    }

    enemies.forEach(enemy => {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const angle = Math.atan2(dy, dx);
        enemy.x += Math.cos(angle) * enemy.enemyData.speed * delta;
        enemy.y += Math.sin(angle) * enemy.enemyData.speed * delta;
    });

    projectiles.forEach(p => {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
    });

    for (let i = activeAnimations.length - 1; i >= 0; i--) {
        const anim = activeAnimations[i];
        anim.frameTimer += delta;

        if (anim.frameTimer >= anim.frameSpeed) {
            anim.frameTimer = 0;
            anim.currentFrameIndex++;

            if (anim.currentFrameIndex >= anim.totalFrames) {
                gameLayer.removeChild(anim.sprite);
                activeAnimations.splice(i, 1);
                continue;
            }
        }

        const frameData = anim.frames[anim.currentFrameIndex];
        if (frameData && frameData[0]) {
            const cellPattern = frameData[0][0];
            if (cellPattern >= 0) {
                const cols = 5;
                const patternX = Math.floor(cellPattern % cols) * anim.frameWidth;
                const patternY = Math.floor(cellPattern / cols) * anim.frameHeight;

                anim.sprite.texture = new PIXI.Texture(
                    anim.baseTexture.baseTexture, 
                    new PIXI.Rectangle(patternX, patternY, anim.frameWidth, anim.frameHeight)
                );
            }
        }
    }

    checkCollisions();
    cleanupProjectiles();
}

function updateHud(name) {
    if (name) nameText.text = name;
    levelText.text = `Level: ${level}`;
    scoreText.text = `Score: ${score}`;
}

function onEnemyKilled(enemy) {
    playRpgAnimation(1, enemy.x, enemy.y);

    gameLayer.removeChild(enemy);
    score += SCORE_PER_KILL;
    if (score >= experienceToNextLevel) {
        levelUp();
    }
    updateHud();
}

function levelUp() {
    level++;
    experienceToNextLevel *= 2;
    playerAttackCooldown *= 0.95;
}

function findClosestEnemy() {
    let closestEnemy = null;
    let minDistance = PLAYER_ATTACK_RANGE;
    enemies.forEach(enemy => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
            minDistance = distance;
            closestEnemy = enemy;
        }
    });
    return closestEnemy;
}

function checkCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = p.x - enemy.x;
            const dy = p.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 15) {
                onEnemyKilled(enemy);
                enemies.splice(j, 1);
                gameLayer.removeChild(p);
                projectiles.splice(i, 1);
                break;
            }
        }
    }
}

function cleanupProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (p.x < -10 || p.x > WIDTH + 10 || p.y < -10 || p.y > HEIGHT + 10) {
            gameLayer.removeChild(p);
            projectiles.splice(i, 1);
        }
    }
}