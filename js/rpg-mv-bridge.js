'use strict';

(function(global) {
    const dataPaths = {
        actors: 'data/Actors.json',
        classes: 'data/Classes.json',
        skills: 'data/Skills.json',
        items: 'data/Items.json',
        weapons: 'data/Weapons.json',
        armors: 'data/Armors.json',
        enemies: 'data/Enemies.json',
        animations: 'data/Animations.json',
        mapInfos: 'data/MapInfos.json'
    };

    const bridge = {
        data: {
            actors: [],
            classes: [],
            skills: [],
            items: [],
            weapons: [],
            armors: [],
            enemies: [],
            animations: [],
            maps: {}
        },
        ready: null,

        async loadAll() {
            const entries = Object.entries(dataPaths);
            const loaded = await Promise.all(entries.map(async ([name, path]) => {
                const response = await fetch(path);
                if (!response.ok) throw new Error('Unable to load ' + path);
                return [name, await response.json()];
            }));

            loaded.forEach(([name, value]) => {
                if (name === 'mapInfos') {
                    value.filter(Boolean).forEach(map => {
                        this.data.maps[map.id] = map;
                    });
                } else {
                    this.data[name] = value;
                }
            });
            return this.data;
        },

        get(collection, id) {
            const list = this.data[collection];
            return Array.isArray(list) ? (list[id] || null) : null;
        },

        getActor(id) {
            return this.get('actors', id);
        },

        getSkill(id) {
            return this.get('skills', id);
        },

        getItem(id) {
            return this.get('items', id);
        },

        getWeapon(id) {
            return this.get('weapons', id);
        },

        getClass(id) {
            return this.get('classes', id);
        },

        getEnemy(id) {
            return this.get('enemies', id);
        },

        getAnimation(id) {
            return this.get('animations', id);
        },

        getSkills(limit = 8) {
            return this.data.skills.filter(Boolean).slice(0, limit);
        },

        getEnemyRoster(normalCount = 6, bossCount = 3) {
            const source = this.data.enemies.filter(Boolean).filter(enemy => enemy.name);
            const normal = Array.from({ length: normalCount }, (_, index) => {
                const enemy = Object.assign({}, source[index % source.length]);
                enemy.id = index + 1;
                enemy.isBoss = false;
                return enemy;
            });
            const bosses = Array.from({ length: bossCount }, (_, index) => {
                const enemy = Object.assign({}, source[(index + 1) % source.length]);
                enemy.id = normalCount + index + 1;
                enemy.name = 'Boss ' + enemy.name;
                enemy.isBoss = true;
                enemy.params = (enemy.params || []).map((value, statIndex) => statIndex === 0 ? value * 4 : value * 1.5);
                return enemy;
            });
            return normal.concat(bosses);
        },

        getShopCatalog() {
            return this.data.items.filter(Boolean).filter(item => item.name)
                .concat(this.data.weapons.filter(Boolean).filter(item => item.name));
        },

        async getMap(id) {
            const paddedId = String(id).padStart(3, '0');
            const response = await fetch('data/Map' + paddedId + '.json');
            if (!response.ok) throw new Error('Unable to load data/Map' + paddedId + '.json');
            const map = await response.json();
            this.data.maps[id] = map;
            return map;
        },

        asset(type, name) {
            const folders = {
                actor: 'img/characters/',
                enemy: 'img/enemies/',
                animation: 'img/animations/',
                face: 'img/faces/',
                tileset: 'img/tilesets/'
            };
            if (!folders[type]) throw new Error('Unknown RPG Maker asset type: ' + type);
            return folders[type] + name + '.png';
        },

        createRuntimeActor(id) {
            if (typeof Game_Actor !== 'function') return null;
            const actor = new Game_Actor(id);
            actor.setup(id);
            return actor;
        }
    };

    bridge.ready = bridge.loadAll();
    global.RpgMvBridge = bridge;
})(window);
