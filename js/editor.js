(function() {

    if (typeof Window_Base === 'undefined') {
        var enabled = false;
        var scene = null;
        var sprites = [];
        var indicator = null;
        var activeSprite = null;

        function setInteractive(sprite, value) {
            sprite.interactive = value;
            sprite.eventMode = value ? 'static' : 'none';
            sprite.buttonMode = value;
            if (value) {
                sprite.on('pointerdown', function(event) {
                    activeSprite = sprite;
                    sprite.data = event;
                    sprite.dragging = true;
                    sprite.alpha = 0.5;
                });
                sprite.on('pointerup', function() {
                    sprite.dragging = false;
                    sprite.data = null;
                    sprite.alpha = 1;
                });
                sprite.on('pointerupoutside', function() {
                    sprite.dragging = false;
                    sprite.data = null;
                    sprite.alpha = 1;
                });
                sprite.on('pointermove', function() {
                    if (sprite.dragging) {
                        var position = sprite.parent.toLocal(sprite.data.global);
                        sprite.position.set(position.x, position.y);
                    }
                });
            }
        }

        function toggle() {
            enabled = !enabled;
            sprites.forEach(function(sprite) { setInteractive(sprite, enabled); });
            if (enabled && scene) {
                indicator = new PIXI.Text('Editor Mode', {fontFamily: 'Arial', fontSize: 24, fill: 0xffffff});
                indicator.name = 'editorIndicator';
                indicator.position.set(10, 10);
                scene.addChild(indicator);
            } else if (indicator && indicator.parent) {
                indicator.parent.removeChild(indicator);
                indicator = null;
            }
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === 'F8') toggle();
        });

        window.EditorTool = {
            registerScene: function(root, registeredSprites) {
                scene = root;
                sprites = registeredSprites || [];
                sprites.forEach(function(sprite) { setInteractive(sprite, enabled); });
            },
            setSprites: function(registeredSprites) {
                sprites = registeredSprites || [];
                sprites.forEach(function(sprite) { setInteractive(sprite, enabled); });
            },
            isEnabled: function() { return enabled; }
        };
        return;
    }

    var parameters = PluginManager.parameters('editor');
    var triggerKey = parameters['Trigger Key'] || 'F8';
    var saveKey = parameters['Save Key'] || 'F9';

    var editorMode = false;
    var selectedSprite = null;
    var propertyWindow = null;
    var registeredScene = null;
    var registeredSprites = [];

    function editorScene() {
        return registeredScene || SceneManager._scene;
    }

    function updateRegisteredSprites() {
        registeredSprites.forEach(function(sprite) {
            if (editorMode) makeSpriteInteractive(sprite);
            else removeSpriteInteractivity(sprite);
        });
    }

    function toggleEditorMode() {
        editorMode = !editorMode;
        var scene = editorScene();
        if (editorMode) {
            console.log('Editor mode enabled.');
            if (scene) {
                var editorIndicator = new PIXI.Text('Editor Mode', {fontFamily : 'Arial', fontSize: 24, fill : 0xffffff, align : 'center'});
                editorIndicator.x = 10;
                editorIndicator.y = 10;
                editorIndicator.name = 'editorIndicator';
                scene.addChild(editorIndicator);
            }
        } else {
            console.log('Editor mode disabled.');
            if (scene) {
                var editorIndicator = scene.getChildByName('editorIndicator');
                if (editorIndicator) {
                    scene.removeChild(editorIndicator);
                }
            }
            if (propertyWindow) {
                propertyWindow.hide();
            }
        }
        // This will trigger the spriteset updates to add/remove interactivity
        if (scene && scene._spriteset) {
            scene._spriteset.update();
        }
        updateRegisteredSprites();
    }

    document.addEventListener('keydown', function(event) {
        if (event.key === triggerKey) {
            toggleEditorMode();
        }
        if (event.key === saveKey && editorMode && Utils.isNwjs() && SceneManager._scene instanceof Scene_Map) {
            saveLayout();
        }
    });

    // --- Layout Save/Load (Map Specific) ---

    function saveLayout() {
        var mapId = $gameMap.mapId();
        var layout = { events: {} };
        $gameMap.events().forEach(function(event) {
            layout.events[event.eventId()] = { x: event.x, y: event.y };
        });

        var fs = require('fs');
        var path = require('path');
        var dirPath = path.join(path.dirname(process.mainModule.filename), 'data/layouts/');
        var filePath = path.join(dirPath, 'Map%1.json'.format(mapId.padZero(3)));

        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
        fs.writeFileSync(filePath, JSON.stringify(layout, null, 2));
        console.log('Layout for Map ' + mapId + ' saved to ' + filePath);
    }

    function loadLayout() {
        var mapId = $gameMap.mapId();
        var fs = require('fs');
        var path = require('path');
        var filePath = path.join(path.dirname(process.mainModule.filename), 'data/layouts/', 'Map%1.json'.format(mapId.padZero(3)));

        if (fs.existsSync(filePath)) {
            var data = fs.readFileSync(filePath, 'utf8');
            var layout = JSON.parse(data);
            console.log('Layout for Map ' + mapId + ' loaded.');
            for (var eventId in layout.events) {
                var event = $gameMap.event(eventId);
                if (event) {
                    var posData = layout.events[eventId];
                    event.locate(posData.x, posData.y);
                }
            }
        } else {
            console.log('No layout file found for Map ' + mapId);
        }
    }

    var _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded.call(this);
        if (Utils.isNwjs()) {
            loadLayout();
        }
    };

    // --- Generic Interactivity ---

    function makeSpriteInteractive(sprite) {
        if (!sprite.interactive) {
            sprite.interactive = true;
            sprite.buttonMode = true;
            sprite.on('pointerdown', onDragStart)
                  .on('pointerup', onDragEnd)
                  .on('pointerupoutside', onDragEnd)
                  .on('pointermove', onDragMove)
                  .on('rightclick', onRightClick);
        }
    }

    function registerScene(scene, sprites) {
        registeredScene = scene;
        registeredSprites = sprites || [];
        updateRegisteredSprites();
    }

    function removeSpriteInteractivity(sprite) {
        if (sprite.interactive) {
            sprite.interactive = false;
            sprite.buttonMode = false;
            sprite.off('pointerdown', onDragStart)
                  .off('pointerup', onDragEnd)
                  .off('pointerupoutside', onDragEnd)
                  .off('pointermove', onDragMove)
                  .off('rightclick', onRightClick);
        }
    }

    // --- Spriteset Hooks ---

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        var self = this;
        this._characterSprites.forEach(function(sprite) {
            if (editorMode) makeSpriteInteractive(sprite);
            else removeSpriteInteractivity(sprite);
        });
    };

    var _Spriteset_Battle_update = Spriteset_Battle.prototype.update;
    Spriteset_Battle.prototype.update = function() {
        _Spriteset_Battle_update.call(this);
        var self = this;
        this._enemySprites.forEach(function(sprite) {
            if (editorMode) makeSpriteInteractive(sprite);
            else removeSpriteInteractivity(sprite);
        });
        this._actorSprites.forEach(function(sprite) {
            if (editorMode) makeSpriteInteractive(sprite);
            else removeSpriteInteractivity(sprite);
        });
    };

    // --- Drag and Drop Handlers ---

    function onDragStart(event) {
        if (editorMode && event.data.button === 0) {
            this.data = event.data;
            this.alpha = 0.5;
            this.dragging = true;
            selectedSprite = this;
        }
    }

    function onDragEnd() {
        if (editorMode && this.dragging) {
            this.alpha = 1;
            this.dragging = false;
            this.data = null;

            if (this._character) { // Map Character
                var newX = Math.round(this.x / $gameMap.tileWidth());
                var newY = Math.round(this.y / $gameMap.tileHeight());
                this._character.locate(newX, newY);
                console.log((this._character.event && this._character.event().name || 'Player') + ' new map position: (' + newX + ', ' + newY + ')');
            } else if (this._battler) { // Battle Battler
                this.setHome(this.x, this.y);
                console.log(this._battler.name() + ' new battle position: (' + Math.round(this.x) + ', ' + Math.round(this.y) + ')');
            }
            if (this.editorMoved) this.editorMoved(this.x, this.y);
        }
    }

    function onDragMove() {
        if (editorMode && this.dragging) {
            var newPosition = this.data.getLocalPosition(this.parent);
            this.x = newPosition.x;
            this.y = newPosition.y;
        }
    }

    function onRightClick(event) {
        if (editorMode) {
            var scene = SceneManager._scene;
            if (!propertyWindow) {
                propertyWindow = new Window_PropertyViewer();
                scene.addWindow(propertyWindow);
            }
            propertyWindow.setSprite(this);
            propertyWindow.show();
            propertyWindow.activate();
        }
    }

    // --- Window_PropertyViewer (Generalized) ---

    function Window_PropertyViewer() {
        this.initialize.apply(this, arguments);
    }

    Window_PropertyViewer.prototype = Object.create(Window_Base.prototype);
    Window_PropertyViewer.prototype.constructor = Window_PropertyViewer;

    Window_PropertyViewer.prototype.initialize = function() {
        var width = 480;
        var height = 360;
        var x = (Graphics.boxWidth - width) / 2;
        var y = (Graphics.boxHeight - height) / 2;
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._sprite = null;
        this.hide();
    };

    Window_PropertyViewer.prototype.setSprite = function(sprite) {
        this._sprite = sprite;
        this.refresh();
    };

    Window_PropertyViewer.prototype.refresh = function() {
        this.contents.clear();
        if (!this._sprite) return;

        var lineHeight = this.lineHeight();
        var x = this.textPadding();
        var y = 0;
        var width = this.contents.width - this.textPadding() * 2;

        this.changeTextColor(this.systemColor());
        this.drawText('Object Properties', 0, y, this.contentsWidth(), 'center');
        y += lineHeight;
        this.resetTextColor();

        if (this._sprite._character) { // Map Character
            var character = this._sprite._character;
            var name = "Unknown";
            if (character instanceof Game_Event) {
                name = character.event().name;
                this.drawText('Type: Event', x, y, width); y += lineHeight;
                this.drawText('ID: ' + character.eventId(), x, y, width); y += lineHeight;
            } else if (character instanceof Game_Player) {
                name = $gameParty.leader().name();
                this.drawText('Type: Player', x, y, width); y += lineHeight;
            } else if (character instanceof Game_Follower) {
                name = character.actor().name();
                this.drawText('Type: Follower', x, y, width); y += lineHeight;
            }
            this.drawText('Name: ' + name, x, y, width); y += lineHeight;
            this.drawText('Map Pos: (' + character.x + ', ' + character.y + ')', x, y, width); y += lineHeight;
        } else if (this._sprite._battler) { // Battle Battler
            var battler = this._sprite._battler;
            var type = battler.isActor() ? 'Actor' : 'Enemy';
            this.drawText('Type: ' + type, x, y, width); y += lineHeight;
            this.drawText('Name: ' + battler.name(), x, y, width); y += lineHeight;
            if (battler.isEnemy()) {
                this.drawText('Enemy ID: ' + battler.enemyId(), x, y, width); y += lineHeight;
            } else {
                this.drawText('Actor ID: ' + battler.actorId(), x, y, width); y += lineHeight;
            }
            this.drawText('HP: ' + battler.hp + ' / ' + battler.mhp, x, y, width); y += lineHeight;
            this.drawText('MP: ' + battler.mp + ' / ' + battler.mmp, x, y, width); y += lineHeight;
        }

        y = this.contents.height - lineHeight * 2;
        this.drawText('Screen: (' + Math.round(this._sprite.x) + ', ' + Math.round(this._sprite.y) + ')', x, y, width);
        y += lineHeight;

        this.changeTextColor(this.systemColor());
        this.drawText('Press ESC to close', 0, y, this.contentsWidth(), 'center');
        this.resetTextColor();
    };

    Window_PropertyViewer.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        if (this.active) {
            if (Input.isTriggered('cancel')) {
                this.hide();
                this.deactivate();
            }
            // Auto-refresh while dragging
            if (this._sprite && this._sprite.dragging) {
                this.refresh();
            }
        }
    };

    Window_PropertyViewer.prototype.open = function() {
        this.refresh();
        Window_Base.prototype.open.call(this);
    };

    window.EditorTool = {
        registerScene: registerScene,
        setSprites: function(sprites) {
            registeredSprites = sprites || [];
            updateRegisteredSprites();
        },
        isEnabled: function() {
            return editorMode;
        }
    };

})();