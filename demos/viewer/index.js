// panoramas
import Pano from './pano.js';
import Viewer from './viewer.js';
import Scene from './scene.js';
import Arrows from './arrows.js';

// Viewer
Viewer.setViewer(document.querySelector('#pano'));
let viewer = Viewer.getViewer();



// Listeners
let panoListener = () => {
    Arrows.removeArrows();
    Viewer.getActivePano().links.forEach(i => {
        Arrows.createArrow(i);
        Scene.loadScene(Pano.findPano(i.id));
    });
    cameraReset();
}
let angleListener = () => {
    let yaw = viewer.scene().view().yaw() * 180 / Math.PI;
    Viewer.setAngle(yaw + Viewer.getActivePano().north_angle);
    Arrows.rotateArrows();
}
setTimeout(() => {
    viewer.__events.viewChange.push(angleListener);
    viewer.__events.sceneChange.push(panoListener);
});

let goToPano = (panoId) => {
    Viewer.setActivePano(Pano.findPano(panoId));
    Scene.loadScene(Viewer.getActivePano()).switchTo({ transitionDuration: DURATION });
}

Arrows.setArrowClick((link) => {
    cameraForward(link);
    goToPano(link.id);
})

// init first pano
let fov = 180;
setTimeout(() => {
    goToPano(Pano.panoramas[0].id);
    viewer.scene().view().setFov(fov * Math.PI / 180);
}, 10);



///////////////////////////////////////////////////////////


const DISTANCE = 0.3;
const DURATION = 500;
let _getPositionByAngle = (angle, radius) => {
    const angleInRadians = (angle * Math.PI) / 180;
    const x = Number((radius * Math.cos(angleInRadians)).toFixed(2));
    const y = Number((radius * Math.sin(angleInRadians)).toFixed(2));
    return { x, y };
};

let cameraForward = (link) => {
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle;
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle - 90;
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle - 90 + Viewer.getViewer().view().yaw() * 180 / Math.PI;
    // let arrowAngle = link.angle - (Viewer.getViewer().view().yaw() * 180 / Math.PI + Viewer.getActivePano().north_angle) + Viewer.getActivePano().north_angle - 90 + Viewer.getViewer().view().yaw() * 180 / Math.PI;
    // let arrowAngle = link.angle - Viewer.getActivePano().north_angle;
    let arrowAngle = link.angle - 90;
    let pos = _getPositionByAngle(arrowAngle, DISTANCE);
    console.log(pos);
    goto(DURATION, pos.x, 0, pos.y);
}
let cameraReset = () => {
    setTimeout(() => {
        goto(0, 0, 0, 0);
    }, DURATION);
}


function goto(duration, x, y, z) {
    let view = Viewer.VIEW;
    var tx = 0;
    var ty = 0;
    var tz = 0;
    var dx = x - tx;
    var dy = y - ty;
    var dz = z - tz;
    Marzipano.util.tween(duration, function (tweenVal) {
        view.setTx(tx + dx * tweenVal);
        view.setTy(ty + dy * tweenVal);
        view.setTz(tz + dz * tweenVal);
    }, function () { });
}

function addto(duration, x, y, z) {
    let view = Viewer.VIEW;
    var ox = view.ox();
    var oy = view.oy();
    var oz = view.oz();
    var dx = x - ox;
    var dy = y - oy;
    var dz = z - oz;
    Marzipano.util.tween(duration, function (tweenVal) {
        view.setOx(ox + dx * tweenVal);
        view.setOy(oy + dy * tweenVal);
        view.setOz(oz + dz * tweenVal);
    }, function () { });
}