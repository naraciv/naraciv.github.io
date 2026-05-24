// /components/map-engine.js
const CLAIMS_IMAGE_URL = 'https://civmc-map.github.io/CivMCMap44Transparent.png';
const TILE_URL = 'https://civmc-map.duckdns.org/tiles/terrain/z{z}/{x},{y}.png';
const MAX_GRID_POINTS = 1200;
const MAP_ALIGNMENT_OFFSET = { x: 12, z: 10 };
const BORDER_SELECTION_MODES = {
    strict: 'strict',
    center: 'center'
};

const PRESETS = {
    city: {
        label: 'City Bastion (101x101)',
        spacing: 101,
        radius: 50,
        type: 'rect',
        stroke: 'rgba(168, 85, 247, 0.85)',
        fill: 'rgba(168, 85, 247, 0.12)',
        rangeMinZoom: -1
    },
    vault: {
        label: 'Vault Bastion (21x21)',
        spacing: 21,
        radius: 10,
        type: 'rect',
        stroke: 'rgba(239, 68, 68, 0.85)',
        fill: 'rgba(239, 68, 68, 0.13)',
        rangeMinZoom: 0
    },
    snitch: {
        label: 'Snitch (23x23)',
        spacing: 23,
        radius: 11,
        type: 'rect',
        stroke: 'rgba(34, 197, 94, 0.85)',
        fill: 'rgba(34, 197, 94, 0.12)',
        rangeMinZoom: 0
    },
    repellator: {
        label: 'Mob Repellator (96 Radius)',
        spacing: 166,
        rowSpacing: 144,
        radius: 96,
        type: 'circle',
        stroke: 'rgba(6, 182, 212, 0.9)',
        fill: 'rgba(6, 182, 212, 0.13)',
        rangeMinZoom: -1
    }
};

function toLatLng(x, z) {
    return L.latLng(-z, x);
}

function fromLatLng(latlng) {
    return { x: latlng.lng, z: -latlng.lat };
}

function createCanvasOverlay(engine) {
    return L.Layer.extend({
        onAdd(map) {
            this._map = map;
            this._canvas = L.DomUtil.create('canvas', 'planner-overlay-canvas');
            this._canvas.style.position = 'absolute';
            this._canvas.style.pointerEvents = 'none';
            this._ctx = this._canvas.getContext('2d');
            map.getPanes().overlayPane.appendChild(this._canvas);

            map.on('move zoom resize zoomend moveend', this._reset, this);
            this._reset();
        },

        onRemove(map) {
            map.off('move zoom resize zoomend moveend', this._reset, this);
            this._canvas.remove();
        },

        _reset() {
            const size = this._map.getSize();
            const topLeft = this._map.containerPointToLayerPoint([0, 0]);

            L.DomUtil.setPosition(this._canvas, topLeft);
            this._canvas.width = size.x;
            this._canvas.height = size.y;
            this._canvas.style.width = `${size.x}px`;
            this._canvas.style.height = `${size.y}px`;
            engine.renderOverlay();
        }
    });
}

export const MapEngine = {
    map: null,
    overlay: null,
    tileLayer: null,
    claimsOverlay: null,
    visibleCoordinates: [],
    config: {
        centerX: 0,
        centerZ: 0,
        option: 'city',
        spacing: PRESETS.city.spacing,
        drawLabels: false,
        showGridRanges: true,
        rangeMinZoom: PRESETS.city.rangeMinZoom,
        containWithinBorder: false,
        showClaimsOverlay: true,
        gridFrozen: false,
        isDrawingBorder: false,
        borderPoints: [],
        claimsBounds: {
            minX: -10832,
            maxX: 10832,
            minZ: -10832,
            maxZ: 10832
        }
    },
    onUpdate: null,
    onMouseMove: null,

    get presets() {
        return PRESETS;
    },

    init(containerId, options = {}) {
        this.onUpdate = options.onUpdate || null;
        this.onMouseMove = options.onMouseMove || null;
        this.map = L.map(containerId, {
            crs: L.CRS.Simple,
            minZoom: -6,
            maxZoom: 2,
            zoomControl: false,
            attributionControl: false,
            preferCanvas: true
        });

        this.tileLayer = L.tileLayer(TILE_URL, {
            tileSize: 256,
            minZoom: -6,
            maxZoom: 2,
            maxNativeZoom: 0,
            noWrap: true,
            bounds: [[-25600, -25600], [25600, 25600]]
        }).addTo(this.map);

        this.claimsOverlay = L.imageOverlay(
            CLAIMS_IMAGE_URL,
            this.getClaimsLeafletBounds(),
            { opacity: 0.85, interactive: false }
        ).addTo(this.map);

        const Overlay = createCanvasOverlay(this);
        this.overlay = new Overlay().addTo(this.map);

        this.map.setView(toLatLng(120, 350), -4);
        this.map.on('click', (event) => this.handleClick(event));
        this.map.on('mousemove', (event) => this.updateMousePosition(event.latlng));
        this.map.on('move zoom zoomend moveend resize', () => {
            this.applyMapAlignmentOffset();
            this.renderOverlay();
        });

        this.applyMapAlignmentOffset();
        this.renderOverlay();
    },

    getClaimsLeafletBounds() {
        const bounds = this.config.claimsBounds;
        return [
            [-bounds.maxZ, bounds.minX],
            [-bounds.minZ, bounds.maxX]
        ];
    },

    applyMapAlignmentOffset() {
        if (!this.claimsOverlay) return;
        const container = this.claimsOverlay.getElement();
        if (!container) return;

        const scale = this.map.options.crs.scale(this.map.getZoom());
        container.style.marginLeft = `${MAP_ALIGNMENT_OFFSET.x * scale}px`;
        container.style.marginTop = `${MAP_ALIGNMENT_OFFSET.z * scale}px`;
    },

    handleClick(event) {
        const point = fromLatLng(event.latlng);

        if (this.config.isDrawingBorder) {
            this.config.borderPoints.push({
                x: Math.round(point.x),
                z: Math.round(point.z)
            });
            this.renderOverlay();
            this.notifyUpdate();
            return;
        }

        if (this.config.gridFrozen) return;

        this.setCenter(Math.round(point.x), Math.round(point.z), false);
        this.notifyUpdate();
    },

    updateMousePosition(latlng) {
        const point = fromLatLng(latlng);
        if (typeof this.onMouseMove === 'function') {
            this.onMouseMove(point, this.map.getZoom());
        }
    },

    notifyUpdate() {
        if (typeof this.onUpdate === 'function') {
            this.onUpdate(this);
        }
    },

    setOption(option) {
        if (!PRESETS[option]) return;
        this.config.option = option;
        this.config.spacing = PRESETS[option].spacing;
        this.config.rangeMinZoom = PRESETS[option].rangeMinZoom;
        this.renderOverlay();
    },

    setCenter(x, z, pan = false) {
        this.config.centerX = x;
        this.config.centerZ = z;
        if (pan && this.map) {
            this.map.panTo(toLatLng(x, z));
        }
        this.renderOverlay();
    },

    setSpacing(spacing) {
        this.config.spacing = Math.max(1, Number.parseInt(spacing, 10) || 1);
        this.renderOverlay();
    },

    setDrawLabels(value) {
        this.config.drawLabels = Boolean(value);
        this.renderOverlay();
    },

    setShowRanges(value) {
        this.config.showGridRanges = Boolean(value);
        this.renderOverlay();
    },

    setRangeMinZoom(value) {
        this.config.rangeMinZoom = Number.parseInt(value, 10);
        this.renderOverlay();
    },

    setContainWithinBorder(value) {
        this.config.containWithinBorder = Boolean(value);
        this.renderOverlay();
    },

    setClaimsVisible(value) {
        this.config.showClaimsOverlay = Boolean(value);
        if (this.claimsOverlay) {
            if (this.config.showClaimsOverlay) {
                this.claimsOverlay.addTo(this.map);
            } else {
                this.claimsOverlay.remove();
            }
        }
        this.renderOverlay();
    },

    setGridFrozen(value) {
        this.config.gridFrozen = Boolean(value);
    },

    setDrawingBorder(value) {
        this.config.isDrawingBorder = Boolean(value);
        this.renderOverlay();
    },

    clearBorder() {
        this.config.borderPoints = [];
        this.renderOverlay();
    },

    setBorderPoints(points) {
        this.config.borderPoints = points;
        this.renderOverlay();
        this.notifyUpdate();
    },

    zoomIn() {
        this.map.zoomIn();
    },

    zoomOut() {
        this.map.zoomOut();
    },

    resetView() {
        this.map.setView(toLatLng(this.config.centerX, this.config.centerZ), -4);
        this.renderOverlay();
    },

    invalidateSize() {
        this.map.invalidateSize();
        this.renderOverlay();
    },

    worldToContainer(x, z) {
        return this.map.latLngToContainerPoint(toLatLng(x, z));
    },

    getVisibleWorldBounds(padding = 0) {
        const bounds = this.map.getBounds();
        return {
            minX: bounds.getWest() - padding,
            maxX: bounds.getEast() + padding,
            minZ: -bounds.getNorth() - padding,
            maxZ: -bounds.getSouth() + padding
        };
    },

    getActivePreset() {
        return PRESETS[this.config.option] || PRESETS.city;
    },

    getActiveRadius() {
        return this.getActivePreset().radius;
    },

    getBorderSelectionCounts() {
        return {
            strict: this.getBorderSelection(BORDER_SELECTION_MODES.strict).length,
            center: this.getBorderSelection(BORDER_SELECTION_MODES.center).length
        };
    },

    getBorderSelection(mode) {
        const polygon = this.config.borderPoints;
        if (polygon.length < 3) return [];

        const radius = this.getActiveRadius();
        const bounds = this.getExpandedBounds(polygon, radius);
        return this.generateGridPoints(bounds)
            .filter((point) => this.gridZoneMatchesBorder(point, radius, mode));
    },

    getExpandedBounds(points, padding) {
        const xs = points.map((point) => point.x);
        const zs = points.map((point) => point.z);
        return {
            minX: Math.min(...xs) - padding,
            maxX: Math.max(...xs) + padding,
            minZ: Math.min(...zs) - padding,
            maxZ: Math.max(...zs) + padding
        };
    },

    gridZoneMatchesBorder(center, radius, mode) {
        if (mode === BORDER_SELECTION_MODES.center) {
            return this.isPointInPolygon(center, this.config.borderPoints);
        }

        return this.getZoneSamplePoints(center, radius)
            .every((point) => this.isPointInPolygon(point, this.config.borderPoints));
    },

    getZoneSamplePoints(center, radius) {
        if (this.getActivePreset().type !== 'circle') {
            return [
                center,
                { x: center.x - radius, z: center.z - radius },
                { x: center.x + radius, z: center.z - radius },
                { x: center.x - radius, z: center.z + radius },
                { x: center.x + radius, z: center.z + radius }
            ];
        }

        const diagonal = Math.floor(radius / Math.SQRT2);
        return [
            center,
            { x: center.x - radius + 1, z: center.z },
            { x: center.x + radius - 1, z: center.z },
            { x: center.x, z: center.z - radius + 1 },
            { x: center.x, z: center.z + radius - 1 },
            { x: center.x - diagonal, z: center.z - diagonal },
            { x: center.x + diagonal, z: center.z - diagonal },
            { x: center.x - diagonal, z: center.z + diagonal },
            { x: center.x + diagonal, z: center.z + diagonal }
        ];
    },

    generateGridPoints(bounds = this.getVisibleWorldBounds(this.getActiveRadius())) {
        const preset = this.getActivePreset();
        const points = [];

        if (preset.type === 'circle') {
            const radius = preset.radius;
            const dx = Math.floor(Math.sqrt(3) * radius);
            const dz = Math.floor(1.5 * radius);
            const rowShift = Math.floor(dx / 2);
            const rowMin = Math.floor((bounds.minZ - this.config.centerZ) / dz) - 1;
            const rowMax = Math.ceil((bounds.maxZ - this.config.centerZ) / dz) + 1;

            for (let row = rowMin; row <= rowMax; row++) {
                const gz = this.config.centerZ + row * dz;
                const shift = Math.abs(row % 2) === 1 ? rowShift : 0;
                const colMin = Math.floor((bounds.minX - this.config.centerX - shift) / dx) - 1;
                const colMax = Math.ceil((bounds.maxX - this.config.centerX - shift) / dx) + 1;

                for (let col = colMin; col <= colMax; col++) {
                    points.push({
                        x: this.config.centerX + col * dx + shift,
                        z: gz
                    });
                }
            }
            return points;
        }

        const spacing = this.config.spacing > 0 ? this.config.spacing : preset.spacing;
        const iMin = Math.floor((bounds.minX - this.config.centerX) / spacing) - 1;
        const iMax = Math.ceil((bounds.maxX - this.config.centerX) / spacing) + 1;
        const jMin = Math.floor((bounds.minZ - this.config.centerZ) / spacing) - 1;
        const jMax = Math.ceil((bounds.maxZ - this.config.centerZ) / spacing) + 1;

        for (let i = iMin; i <= iMax; i++) {
            for (let j = jMin; j <= jMax; j++) {
                points.push({
                    x: this.config.centerX + i * spacing,
                    z: this.config.centerZ + j * spacing
                });
            }
        }

        return points;
    },

    renderOverlay() {
        if (!this.overlay || !this.overlay._ctx || !this.map) return;

        const ctx = this.overlay._ctx;
        const canvas = this.overlay._canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.drawBorder(ctx);
        this.drawGrid(ctx);
    },

    drawGrid(ctx) {
        const preset = this.getActivePreset();
        const radius = preset.radius;
        const bounds = this.getVisibleWorldBounds(radius + 2);
        let points = this.generateGridPoints(bounds);
        if (this.config.containWithinBorder && this.config.borderPoints.length >= 3) {
            points = points.filter((point) => this.isPointInPolygon(point, this.config.borderPoints));
        }
        const canDrawRanges = this.config.showGridRanges && this.map.getZoom() >= this.config.rangeMinZoom;

        this.visibleCoordinates = [];
        this.drawCenterMarker(ctx);

        if (points.length > MAX_GRID_POINTS) {
            this.drawOverflowMessage(ctx, points.length);
            this.notifyUpdate();
            return;
        }

        for (const point of points) {
            if (canDrawRanges) {
                if (preset.type === 'circle') {
                    this.drawMinecraftBlockCircle(ctx, point.x, point.z, radius, preset.fill, preset.stroke);
                } else {
                    this.drawBlockRect(ctx, point.x, point.z, radius, preset.fill, preset.stroke);
                }
            }

            this.drawPointMarker(ctx, point.x, point.z, preset.stroke);

            if (
                point.x >= bounds.minX + radius &&
                point.x <= bounds.maxX - radius &&
                point.z >= bounds.minZ + radius &&
                point.z <= bounds.maxZ - radius
            ) {
                this.visibleCoordinates.push({
                    x: Math.round(point.x),
                    z: Math.round(point.z)
                });
            }

            const isCenterPoint = point.x === this.config.centerX && point.z === this.config.centerZ;
            if ((this.config.drawLabels || isCenterPoint) && this.map.getZoom() >= -3) {
                this.drawLabel(ctx, point.x, point.z);
            }
        }

        this.notifyUpdate();
    },

    isPointInPolygon(point, polygon) {
        if (polygon.length < 3) return false;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const zi = polygon[i].z;
            const xj = polygon[j].x;
            const zj = polygon[j].z;
            const intersect = ((zi > point.z) !== (zj > point.z))
                && (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    drawBlockRect(ctx, x, z, radius, fillColor, strokeColor) {
        const topLeft = this.worldToContainer(x - radius, z - radius);
        const bottomRight = this.worldToContainer(x + radius + 1, z + radius + 1);

        ctx.fillStyle = fillColor;
        ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    },

    drawMinecraftBlockCircle(ctx, x, z, radius, fillColor, strokeColor) {
        const r2 = radius * radius;
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(1, this.map.getZoomScale(this.map.getZoom(), 0) * 0.7);

        for (let dz = -radius + 1; dz < radius; dz++) {
            const target = r2 - dz * dz;
            if (target <= 0) continue;

            const maxDx = Math.floor(Math.sqrt(target - 0.0001));
            const topLeft = this.worldToContainer(x - maxDx, z + dz);
            const bottomRight = this.worldToContainer(x + maxDx + 1, z + dz + 1);
            ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
        }

        ctx.beginPath();
        for (let dz = -radius + 1; dz < radius; dz++) {
            const target = r2 - dz * dz;
            if (target <= 0) continue;

            const maxDx = Math.floor(Math.sqrt(target - 0.0001));
            const leftTop = this.worldToContainer(x - maxDx, z + dz);
            const leftBottom = this.worldToContainer(x - maxDx + 1, z + dz + 1);
            const rightTop = this.worldToContainer(x + maxDx, z + dz);
            const rightBottom = this.worldToContainer(x + maxDx + 1, z + dz + 1);

            ctx.rect(leftTop.x, leftTop.y, leftBottom.x - leftTop.x, leftBottom.y - leftTop.y);
            ctx.rect(rightTop.x, rightTop.y, rightBottom.x - rightTop.x, rightBottom.y - rightTop.y);
        }
        ctx.stroke();
    },

    drawPointMarker(ctx, x, z, color) {
        const point = this.worldToContainer(x, z);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    },

    drawCenterMarker(ctx) {
        const point = this.worldToContainer(this.config.centerX, this.config.centerZ);

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#e040fb';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#e040fb';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = 'rgba(224, 64, 251, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(point.x - 20, point.y);
        ctx.lineTo(point.x + 20, point.y);
        ctx.moveTo(point.x, point.y - 20);
        ctx.lineTo(point.x, point.y + 20);
        ctx.stroke();
    },

    drawLabel(ctx, x, z) {
        const point = this.worldToContainer(x, z);
        const text = `${Math.round(x)}, ${Math.round(z)}`;

        ctx.font = 'bold 10px monospace';
        const width = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(point.x - width / 2 - 4, point.y - 18, width + 8, 14);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(point.x - width / 2 - 4, point.y - 18, width + 8, 14);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(text, point.x, point.y - 8);
        ctx.textAlign = 'start';
    },

    drawBorder(ctx) {
        const points = this.config.borderPoints;
        if (points.length === 0) return;

        ctx.beginPath();
        const first = this.worldToContainer(points[0].x, points[0].z);
        ctx.moveTo(first.x, first.y);

        for (let i = 1; i < points.length; i++) {
            const next = this.worldToContainer(points[i].x, points[i].z);
            ctx.lineTo(next.x, next.y);
        }

        if (points.length > 2) ctx.closePath();

        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        points.forEach((borderPoint) => {
            const point = this.worldToContainer(borderPoint.x, borderPoint.z);
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#15803d';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    },

    drawOverflowMessage(ctx, count) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(10, 10, 290, 38);
        ctx.strokeStyle = 'rgba(224, 64, 251, 0.5)';
        ctx.strokeRect(10, 10, 290, 38);
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Zoom in to render ${count.toLocaleString()} grid zones.`, 20, 34);
    }
};
