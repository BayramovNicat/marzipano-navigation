const RES_16K = true;

const VIEW = new Marzipano.RectilinearView(null,
    Marzipano.RectilinearView.limit.traditional(8192, 120 * Math.PI / 180));

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
let setActivePano = (pano) => {
    _activePano = pano;
}
let getActivePano = () => {
    return _activePano;
}




export default {
    RES_16K,
    GEOMETRY,
    VIEW,
    setViewer,
    getViewer,
    setAngle,
    getAngle,
    setActivePano,
    getActivePano
};