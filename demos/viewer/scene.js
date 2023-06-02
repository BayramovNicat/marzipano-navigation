import Viewer from './viewer.js';

const IMG_HOST = 'https://img.gothru.org/';

let scenes = [];

let tileUrl = (f, z, x, y, url, end, multiplier) => {
    let image_width = 6144 * multiplier;
    let face_width = image_width / 3;
    let face_coor;
    switch (f) {
        case 'f':
            face_coor = {
                x1: face_width * 0, y1: face_width * 0,
                x2: face_width * 1, y2: face_width * 1
            }
            break;
        case 'b':
            face_coor = {
                x1: face_width * 1, y1: face_width * 0,
                x2: face_width * 2, y2: face_width * 1
            }
            break;
        case 'u':
            face_coor = {
                x1: face_width * 2, y1: face_width * 0,
                x2: face_width * 3, y2: face_width * 1
            }
            break;
        case 'd':
            face_coor = {
                x1: face_width * 0, y1: face_width * 1,
                x2: face_width * 1, y2: face_width * 2
            }
            break;
        case 'l':
            face_coor = {
                x1: face_width * 1, y1: face_width * 1,
                x2: face_width * 2, y2: face_width * 2
            }
            break;
        case 'r':
            face_coor = {
                x1: face_width * 2, y1: face_width * 1,
                x2: face_width * 3, y2: face_width * 2
            }
            break;
    }
    let tile = Math.pow(2, z - 1);
    let tile_width = face_width / tile;
    let tile_coor = {
        x1: face_coor.x1 + tile_width * (x - 1), y1: face_coor.y1 + tile_width * (y - 1),
        x2: face_coor.x1 + tile_width * (x), y2: face_coor.y1 + tile_width * (y),
    }
    let resize = `&resize=512x512`;

    if (Viewer.RES_16K)
        end += '&pad=bg:000016';


    return `${url}?crop=${tile_coor.x1}x${tile_coor.y1}x${tile_coor.x2}x${tile_coor.y2}${resize}&${end}`;
}

let source = (pano) => {
    let urlArr = pano.url.split('?');
    let image = urlArr[0];
    let version = parseInt(urlArr[1].split(':')[1]);
    let multiplier = Viewer.RES_16K ? 2 : 1;
    let quality = `save=optimize,progressive,qual:70`;

    return new Marzipano.ImageUrlSource(tile => {
        if (tile.z === 0) {
            var mapY = 'lfrbud'.indexOf(tile.face) / 6;
            return {
                url: `${IMG_HOST}cube/${image.replace('.jpg', `_thumb_${version}.jpg`)}?${quality}`,
                rect: { x: 0, y: mapY, width: 1, height: 1 / 6 }
            };
        } else {
            return {
                url: tileUrl(
                    tile.face,
                    tile.z,
                    tile.x + 1,
                    tile.y + 1,
                    `${IMG_HOST}cube/${image.replace('.jpg', `_${version}.jpg`)}`,
                    quality,
                    multiplier
                )
            };
        }
    }, { concurrency: 10 });
}

let loadScene = (pano) => {
    let scene = scenes.find(i => i.id == pano.id)?.scene;
    if (!scene) {
        scene = Viewer.getViewer().createScene({
            source: source(pano),
            geometry: Viewer.GEOMETRY,
            view: Viewer.VIEW,
            pinFirstLevel: true
        });
        scenes.push({
            id: pano.id,
            scene: scene
        });
    }
    return scene;
}

export default {
    loadScene
};
