const RES_16K = true;

const GEOMETRY = new Marzipano.CubeGeometry([
    { tileSize: 256, size: 256, fallbackOnly: true },
    { tileSize: 512, size: 512 },
    { tileSize: 512, size: 1024 },
    { tileSize: 512, size: 2048 },
    ...(RES_16K ? [{ tileSize: 512, size: 4096 }] : [])
]);

let _viewer;
let setViewer = (panoElement) => {
    _viewer = new Marzipano.Viewer(panoElement, {
        stage: { progressive: true },
        controls: {
            scrollZoom: true,
        }
    });
}
let getViewer = () => {
    return _viewer;
}

let _angle = 73;
let setAngle = (angle) => {
    _angle = angle;
}
let getAngle = () => {
    return _angle;
}

let _activePano;
let _oldActivePanoId;
let setActivePano = (pano) => {
    _oldActivePanoId = _activePano?.id;
    _activePano = pano;
}
let getActivePano = () => {
    return _activePano;
}
let getOldActivePanoId = () => {
    return _oldActivePanoId;
}




export default {
    RES_16K,
    GEOMETRY,
    setViewer,
    getViewer,
    setAngle,
    getAngle,
    setActivePano,
    getActivePano,
    getOldActivePanoId
};