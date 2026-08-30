/*
 * Tu Tiên Demo - Auto-attack survival game
 * Version 8: RPG Maker MV Map Parser & Layer Renderer
 */

// --- Biến lưu trữ dữ liệu Map ---
let currentMapData = null;
let mapContainer = new PIXI.Container(); // Container chứa toàn bộ tile của map

// Kích thước chuẩn của 1 ô Tile trong RPG Maker MV
const TILE_SIZE = 48; 

// --- Hàm tải và đọc file bản đồ RPG Maker MV ---
async function loadRPGMap(mapId) {
    try {
        // Ví dụ tải file Map001.json
        const paddedId = String(mapId).padStart(3, '0');
        const response = await fetch(`data/Map${paddedId}.json`);
        
        if (!response.ok) {
            throw new Error(`Không thể tải file bản đồ Map${paddedId}.json`);
        }

        currentMapData = await response.json();
        console.log(`Đã tải bản đồ: ${currentMapData.displayName} (${currentMapData.width}x${currentMapData.height})`);

        // Tiến hành phân tích và render map lên layer game
        await renderRPGMap(currentMapData);

    } catch (e) {
        console.error("Lỗi khi đọc file Tiled Map RPG Maker:", e);
    }
}

// --- Hàm xử lý và vẽ bản đồ lên PixiJS ---
async function renderRPGMap(mapData) {
    // Xóa bản đồ cũ nếu có
    mapContainer.removeChildren();
    
    const mapWidth = mapData.width;   // Số ô theo chiều ngang
    const mapHeight = mapData.height; // Số ô theo chiều dọc
    const dataArray = mapData.data;   // Mảng chứa ID các tile (gồm nhiều layer gộp lại)

    // RPG Maker MV chia bản đồ thành các tầng (thường là 6 tầng, mỗi tầng có kích thước width * height)
    const layerSize = mapWidth * mapHeight;
    const totalLayers = dataArray.length / layerSize;

    // Lấy danh sách tên tileset được cấu hình cho map này (ví dụ: Outside, Dungeon...)
    const tilesetNames = mapData.tilesetId ? getTilesetNames(mapData.tilesetId) : ["Outside"];

    // Tải trước các hình ảnh tileset trong thư mục img/tilesets/
    let tilesetTextures = {};
    for (let tName of tilesetNames) {
        const url = `img/tilesets/${tName}.png`;
        tilesetTextures[tName] = PIXI.Texture.from(url);
    }

    // Duyệt qua từng tầng (layer) để vẽ
    for (let z = 0; z < totalLayers; z++) {
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const index = z * layerSize + y * mapWidth + x;
                const tileId = dataArray[index];

                // Nếu tileId == 0 nghĩa là ô trống, bỏ qua
                if (tileId <= 0) continue; 

                // Giải mã TileID sang tọa độ cắt trên ảnh Tileset của RPG Maker MV
                const tileSprite = decodeAndCreateTileSprite(tileId, tilesetTextures);
                
                if (tileSprite) {
                    tileSprite.x = x * TILE_SIZE;
                    tileSprite.y = y * TILE_SIZE;
                    mapContainer.addChild(tileSprite);
                }
            }
        }
    }

    // Đưa mapContainer xuống dưới cùng của gameLayer để nhân vật/quái hiển thị đè lên trên
    gameLayer.addChildAt(mapContainer, 0);
}

// --- Thuật toán giải mã TileID chuẩn của RPG Maker MV ---
function decodeAndCreateTileSprite(tileId, textures) {
    // Cấu trúc phân vùng TileID trong RPG Maker MV:
    // - Tile A5 (thường là đất/sàn): từ 2048 đến 2815
    // - Tile B, C, D, E (vật thể, nhà cửa, cây cối): từ 8192 trở lên
    let baseTextureKey = "Outside"; // Mặc định
    let setIndex = 0;
    let localId = tileId;

    if (tileId >= 8192) {
        // Vùng Tile B -> E
        setIndex = Math.floor(tileId / 256) - 32;
        localId = tileId % 256;
        // Map với tên tileset thực tế của bạn tại đây nếu có nhiều tileset
    } else if (tileId >= 2048 && tileId < 2815) {
        // Vùng Tile A5 (Tileset đất phẳng 48x48)
        localId = tileId - 2048;
        // Tính toán tọa độ x, y trên bảng A5 (mỗi hàng có 8 ô = 384px)
        const col = localId % 8;
        const row = Math.floor(localId / 8);
        
        if (textures["Outside"]) {
            const baseTex = textures["Outside"].baseTexture;
            // Tile A5 trong MV thường nằm ở phần dưới của file Outside hoặc file riêng biệt
            const rect = new PIXI.Rectangle(col * TILE_SIZE, (row + 64) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            return new PIXI.Sprite(new PIXI.Texture(baseTex, rect));
        }
    }

    // Trả về Sprite mặc định hoặc null nếu chưa khớp hoàn toàn cấu trúc file ảnh
    return null;
}

// Hàm phụ trợ lấy tên Tileset dựa vào ID cấu hình trong System.json của MV
function getTilesetNames(tilesetId) {
    // RPG Maker MV mặc định cấu hình tileset qua Database -> System hoặc Tilesets.json
    // Trả về mảng tên file png tương ứng trong img/tilesets/
    return ["Outside"]; 
}