function Map() {
    this.mapData = null; // Placeholder for map data

    this.canvas = document.getElementById("game-layer");
    this.context = this.canvas.getContext("2d");

    this.tilesetImage = new Image();
    this.currentLevelIndex = 0;

    this.loaded = false;

    this.offsetX = 0;
    this.offsetY = 0;

    // Add these properties:
    this.transitioning = false;
    this.transitionOldLevel = null;
    this.transitionNewLevel = null;
    this.transitionOffsetX = 0;
    this.transitionOffsetY = 0;
}

Map.prototype.loadMapData = function () {
    // Directly assign the mapData object from map.js
    this.mapData = mapData;

    if (this.mapData) {
        this.renderLevel(0); // Render the level after loading the map data
    } else {
        console.error('Error: Map data is not available.');
    }
};

Map.prototype.renderLevel = function (levelIndex) {
    if (!this.mapData) {
        console.warn('Map data not loaded yet.');
        return;
    }

    const level = this.mapData.levels[levelIndex];

    if (!level) {
        console.warn('No levels found in map data.');
        return;
    }

    this.levelWidth = level.pxWid / this.mapData.defaultGridSize;
    this.levelHeight = level.pxHei / this.mapData.defaultGridSize;
    this.gridSize = this.mapData.defaultGridSize;
    this.collisionGridSize = this.mapData.defaultGridSize / 2;

    this.tileData = {};
    this.collisionData = []; // Array to store wall collision tiles
    this.entityData = []; // Array to store entity data
    this.enemyData = [];

    level.layerInstances.forEach(layer => {
        if (layer.__type === "Tiles") {
            this.tileData[layer.__identifier] = layer.gridTiles;
        } else if (layer.__type === "IntGrid" && layer.__identifier == "Collisions") {
            // Extract collision data from IntGrid layers
            layer.intGridCsv.forEach((value, index) => {
                if (value === 1) { // Assuming 1 represents a wall
                    const x = index % layer.__cWid;
                    const y = Math.floor(index / layer.__cWid);
                    this.collisionData.push({ x: x * this.collisionGridSize, y: y * this.collisionGridSize });
                }
            });
        } else if (layer.__type === "Entities" && layer.__identifier == "Entities") {
            // Extract entity data from Entities layers
            layer.entityInstances.forEach(entity => {
                this.entityData.push({
                    id: entity.__identifier, // Entity ID
                    x: entity.px[0], // X position in pixels
                    y: entity.px[1]  // Y position in pixels
                });
            });
        } else if (layer.__type === "Entities" && layer.__identifier == "Enemies") {
            // Extract enemy data from Enemies layers
            layer.entityInstances.forEach(enemy => {
                this.enemyData.push({
                    id: enemy.__identifier, // enemy ID
                    x: enemy.px[0], // X position in pixels
                    y: enemy.px[1]  // Y position in pixels
                });
            });
        }
    });

    const tileset = this.mapData.defs.tilesets[0];
    const imagePath = tileset.relPath.startsWith("../") ? tileset.relPath.substring(3) : tileset.relPath;

    this.tilesetImage.src = imagePath;
    this.tilesetImage.onload = () => {
        console.log('Tileset image loaded.');
    };

    this.loaded = true;

    // if (this.collisionData.length > 0) {
    //     console.log("Collision data:", this.collisionData); // Debugging log
    // }

    // if (this.entityData.length > 0) {
    //     console.log("Entity data:", this.entityData); // Debugging log
    // }

    // if (this.enemyData.length > 0) {
    //    console.log("Enemy data:", this.enemyData); // Debugging log
    //}
};

Map.prototype.renderTiles = function () {
    if (!this.tileData || !this.tilesetImage.complete) return;

    const tileset = this.mapData.defs.tilesets[0];
    const tileWidth = this.gridSize;
    const tileHeight = this.gridSize;

    // If not transitioning, draw normally
    if (!this.transitioning) {
        for (const layerName in this.tileData) {
            this.tileData[layerName].forEach(tile => {
                const sourceX = tile.src[0];
                const sourceY = tile.src[1];
                const destX = tile.px[0];
                const destY = tile.px[1];

                this.context.drawImage(
                    this.tilesetImage,
                    sourceX,
                    sourceY,
                    tileWidth,
                    tileHeight,
                    destX,
                    destY,
                    tileWidth,
                    tileHeight
                );
            });
        }
        return;
    }

    // --- Dual rendering for transition ---
    // 1. Draw old level at current offset
    const oldLevel = this.mapData.levels[this.transitionOldLevel];
    for (const layer of oldLevel.layerInstances) {
        if (layer.__type === "Tiles") {
            layer.gridTiles.forEach(tile => {
                const sourceX = tile.src[0];
                const sourceY = tile.src[1];
                const destX = tile.px[0] + this.transitionOffsetX;
                const destY = tile.px[1] + this.transitionOffsetY;
                this.context.drawImage(
                    this.tilesetImage,
                    sourceX,
                    sourceY,
                    tileWidth,
                    tileHeight,
                    destX,
                    destY,
                    tileWidth,
                    tileHeight
                );
            });
        }
    }

    // 2. Draw new level at offset + full screen in direction
    let nx = 0, ny = 0;
    if (this.transitionOffsetX !== 0) nx = (this.transitionOffsetX > 0 ? -160 : 160);
    if (this.transitionOffsetY !== 0) ny = (this.transitionOffsetY > 0 ? -128 : 128);

    const newLevel = this.mapData.levels[this.transitionNewLevel];
    for (const layer of newLevel.layerInstances) {
        if (layer.__type === "Tiles") {
            layer.gridTiles.forEach(tile => {
                const sourceX = tile.src[0];
                const sourceY = tile.src[1];
                const destX = tile.px[0] + this.transitionOffsetX + nx;
                const destY = tile.px[1] + this.transitionOffsetY + ny;
                this.context.drawImage(
                    this.tilesetImage,
                    sourceX,
                    sourceY,
                    tileWidth,
                    tileHeight,
                    destX,
                    destY,
                    tileWidth,
                    tileHeight
                );
            });
        }
    }
};

Map.prototype.isBlocked = function (pixelX, pixelY, pixelWidth, pixelHeight) {
    if (!this.loaded) return true; // No collision data available

    const minX = pixelX;
    const minY = pixelY;
    const maxX = pixelX + pixelWidth;
    const maxY = pixelY + pixelHeight;

    for (let i = 0; i < this.collisionData.length; i++) {
        const tile = this.collisionData[i];
        if (minX < tile.x + this.collisionGridSize && maxX > tile.x && minY < tile.y + this.collisionGridSize && maxY > tile.y) {
            // Collision detected
            return true;
        }
    }

    return false;
};





