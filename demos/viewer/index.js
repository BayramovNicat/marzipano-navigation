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
    Scene.loadScene(Viewer.getActivePano()).switchTo();
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


const DISTANCE = 0.2;
let cameraForward = (link) => {
    // console.log(delta.x, delta.z);
    let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle - 90 + Viewer.getViewer().view().yaw() * 180 / Math.PI;
    // console.log(Viewer.getViewer().view().yaw() * 180 / Math.PI);
    console.log(arrowAngle);
    deltaByAngle(arrowAngle, DISTANCE);
    goto(500, delta.x, delta.y, delta.z);
}

let cameraReset = () => {
    setTimeout(() => {
        goto(0, 0, 0, 0);
        delta = {
            x: 0,
            y: 0,
            z: 0
        }
    }, 501);
}


let delta = {
    x: 0,
    y: 0,
    z: 0
}

const deltaByAngle = (angle, radius) => {
    const angleInRadians = (angle * Math.PI) / 180;
    const x = Number((radius * Math.cos(angleInRadians)).toFixed(2));
    const y = Number((radius * Math.sin(angleInRadians)).toFixed(2));

    delta = {
        x: x,
        y: 0,
        z: y
    }
};

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