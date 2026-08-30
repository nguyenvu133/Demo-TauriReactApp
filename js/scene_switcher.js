// =============================================================================
// scene_switcher.js
// =============================================================================

/*:
 * @plugindesc Provides a developer window to quickly switch between scenes.
 * @author Gemini
 *
 * @help
 * This plugin provides a scene switcher for development purposes.
 *
 * Press F7 to open the Scene Switcher window.
 *
 * From the switcher, you can:
 * - Go to a specific map by ID.
 * - Start a battle with a specific troop by ID.
 * - Go to other scenes like the Title Screen or Game Over screen.
 *
 * @param Switcher Key
 * @desc The key to open the Scene Switcher window.
 * @default F7
 */

(function() {

    var parameters = PluginManager.parameters('scene_switcher');
    var switcherKey = parameters['Switcher Key'] || 'F7';

    // --- Global Key Listener ---

    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        document.addEventListener('keydown', function(event) {
            if (event.key === switcherKey) {
                SceneManager.push(Scene_SceneSwitcher);
            }
        });
    };

    // ============================================================================
    // Scene_SceneSwitcher
    // ============================================================================

    function Scene_SceneSwitcher() {
        this.initialize.apply(this, arguments);
    }

    Scene_SceneSwitcher.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_SceneSwitcher.prototype.constructor = Scene_SceneSwitcher;

    Scene_SceneSwitcher.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_SceneSwitcher.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.createCommandWindow();
        this.createNumberInputWindow();
    };

    Scene_SceneSwitcher.prototype.createCommandWindow = function() {
        this._commandWindow = new Window_SwitcherCommand();
        this._commandWindow.setHandler('cancel', this.popScene.bind(this));
        this._commandWindow.setHandler('map', this.onMapCommand.bind(this));
        this._commandWindow.setHandler('battle', this.onBattleCommand.bind(this));
        this._commandWindow.setHandler('title', this.onTitleCommand.bind(this));
        this._commandWindow.setHandler('menu', this.onMenuCommand.bind(this));
        this._commandWindow.setHandler('gameover', this.onGameOverCommand.bind(this));
        this.addWindow(this._commandWindow);
    };

    Scene_SceneSwitcher.prototype.createNumberInputWindow = function() {
        this._numberInputWindow = new Window_NumberInput(this._commandWindow);
        this._numberInputWindow.setHandler('ok', this.onNumberInputOk.bind(this));
        this._numberInputWindow.setHandler('cancel', this.onNumberInputCancel.bind(this));
        this._numberInputWindow.hide();
        this.addWindow(this._numberInputWindow);
    };

    Scene_SceneSwitcher.prototype.onMapCommand = function() {
        this._numberInputWindow.start('Map ID:', 999, 1, 3);
        this._numberInputWindow.show();
        this._numberInputWindow.activate();
        this._commandWindow.deactivate();
    };

    Scene_SceneSwitcher.prototype.onBattleCommand = function() {
        this._numberInputWindow.start('Troop ID:', 999, 1, 3);
        this._numberInputWindow.show();
        this._numberInputWindow.activate();
        this._commandWindow.deactivate();
    };

    Scene_SceneSwitcher.prototype.onTitleCommand = function() {
        SceneManager.goto(Scene_Title);
    };

    Scene_SceneSwitcher.prototype.onMenuCommand = function() {
        SceneManager.goto(Scene_Menu);
    };

    Scene_SceneSwitcher.prototype.onGameOverCommand = function() {
        SceneManager.goto(Scene_GameEnd);
    };

    Scene_SceneSwitcher.prototype.onNumberInputOk = function() {
        var number = this._numberInputWindow._number;
        var command = this._commandWindow.currentSymbol();
        this._numberInputWindow.hide();
        this._commandWindow.activate();

        if (command === 'map') {
            SceneManager.goto(Scene_Map);
            $gamePlayer.reserveTransfer(number, 0, 0, 2);
        } else if (command === 'battle') {
            BattleManager.setup(number, false, false);
            SceneManager.push(Scene_Battle);
        }
    };

    Scene_SceneSwitcher.prototype.onNumberInputCancel = function() {
        this._numberInputWindow.hide();
        this._commandWindow.activate();
    };


    // ============================================================================
    // Window_SwitcherCommand
    // ============================================================================

    function Window_SwitcherCommand() {
        this.initialize.apply(this, arguments);
    }

    Window_SwitcherCommand.prototype = Object.create(Window_Command.prototype);
    Window_SwitcherCommand.prototype.constructor = Window_SwitcherCommand;

    Window_SwitcherCommand.prototype.initialize = function() {
        Window_Command.prototype.initialize.call(this, 0, 0);
        this.updatePlacement();
    };

    Window_SwitcherCommand.prototype.windowWidth = function() {
        return 240;
    };

    Window_SwitcherCommand.prototype.updatePlacement = function() {
        this.x = (Graphics.boxWidth - this.width) / 2;
        this.y = (Graphics.boxHeight - this.height) / 2;
    };

    Window_SwitcherCommand.prototype.makeCommandList = function() {
        this.addCommand('Go to Map', 'map');
        this.addCommand('Test Battle', 'battle');
        this.addCommand('Go to Title', 'title');
        this.addCommand('Open Menu', 'menu');
        this.addCommand('Game Over', 'gameover');
    };

    // ============================================================================
    // Window_NumberInput (Simplified from Scene_Name)
    // ============================================================================

    function Window_NumberInput() {
        this.initialize.apply(this, arguments);
    }

    Window_NumberInput.prototype = Object.create(Window_Base.prototype);
    Window_NumberInput.prototype.constructor = Window_NumberInput;

    Window_NumberInput.prototype.initialize = function(editWindow) {
        var width = 480;
        var height = this.fittingHeight(3);
        var x = (Graphics.boxWidth - width) / 2;
        var y = editWindow.y + editWindow.height + 8;
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._message = '';
        this._number = 0;
        this._maxLength = 1;
        this.deactivate();
    };

    Window_NumberInput.prototype.start = function(message, max, min, maxLength) {
        this._message = message;
        this._max = max;
        this._min = min;
        this._maxLength = maxLength;
        this._number = 0;
        this.refresh();
    };

    Window_NumberInput.prototype.refresh = function() {
        this.contents.clear();
        this.drawText(this._message, this.textPadding(), 0, this.contentsWidth() - this.textPadding() * 2);
        var numberText = this._number.padZero(this._maxLength);
        var width = this.textWidth(numberText);
        this.drawText(numberText, (this.contentsWidth() - width) / 2, this.lineHeight(), width);
    };

    Window_NumberInput.prototype.processHandling = function() {
        if (this.isOpen() && this.active) {
            if (Input.isTriggered('ok')) this.processOk();
            if (Input.isTriggered('cancel')) this.callHandler('cancel');
            if (Input.isRepeated('up')) this.changeNumber(1);
            if (Input.isRepeated('down')) this.changeNumber(-1);
            if (Input.isRepeated('pageup')) this.changeNumber(10);
            if (Input.isRepeated('pagedown')) this.changeNumber(-10);
        }
    };

    Window_NumberInput.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        this.processHandling();
    };

    Window_NumberInput.prototype.changeNumber = function(amount) {
        var lastNumber = this._number;
        this._number = (this._number + amount).clamp(this._min, this._max);
        if (this._number !== lastNumber) {
            SoundManager.playCursor();
            this.refresh();
        }
    };

    Window_NumberInput.prototype.processOk = function() {
        SoundManager.playOk();
        this.callHandler('ok');
    };

})();