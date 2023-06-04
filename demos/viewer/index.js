// panoramas
import Pano from './pano.js';
import Viewer from './viewer.js';
import Scene from './scene.js';
import Arrows from './arrows.js';

// Viewer
Viewer.setViewer(document.querySelector('#pano'));
let viewer = Viewer.getViewer();

// Options
let distanceInput = document.querySelector('#distance');
let durationInput = document.querySelector('#duration');


// Listeners
let panoListener = () => {

    viewer.scene().view().setYaw(yaw * Math.PI / 180);
    viewer.scene().view().setPitch(pitch * Math.PI / 180);
    viewer.scene().view().setFov(fov * Math.PI / 180);

    Arrows.removeArrows();
    Viewer.getActivePano().links.forEach(i => {
        Arrows.createArrow(i);
        Scene.loadScene(Pano.findPano(i.id));
    });
    // cameraReset();
}
let yaw = 0, pitch = 0, fov = 180;
let angleListener = () => {
    yaw = viewer.scene().view().yaw() * 180 / Math.PI;
    pitch = viewer.scene().view().pitch() * 180 / Math.PI;
    fov = viewer.scene().view().fov() * 180 / Math.PI;
    Viewer.setAngle(yaw + Viewer.getActivePano().north_angle);
    Arrows.rotateArrows();
}
setTimeout(() => {
    viewer.__events.viewChange.push(angleListener);
    viewer.__events.sceneChange.push(panoListener);
});

let goToPano = (panoId) => {
    Viewer.setActivePano(Pano.findPano(panoId));
    Scene.loadScene(Viewer.getActivePano()).switchTo({ transitionDuration: Number(durationInput.value) });
}

Arrows.setArrowClick((link) => {
    goToPano(link.id);
    // Viewer.setActivePano(Pano.findPano(link.id));
    cameraForward(link);
})

// init first pano
setTimeout(() => {
    goToPano(Pano.panoramas[0].id);
}, 10);



///////////////////////////////////////////////////////////
// pano change transition

let _getPositionByAngle = (angle, radius) => {
    const angleInRadians = (angle * Math.PI) / 180;
    const x = Number((radius * Math.cos(angleInRadians)).toFixed(2));
    const y = 0;
    const z = Number((radius * Math.sin(angleInRadians)).toFixed(2));
    return { x, y, z };
};
let _changeViewPoint = (view, { tx, ty, tz }) => {
    if (!view) return;
    view._resetParams();
    view._params.tx = tx;
    view._params.ty = ty;
    view._params.tz = tz;
    view._update();
};
let _goTo = (view, duration, { x, y, z }, reverse) => {
    // calc values
    let start = {
        tx: 0,
        ty: 0,
        tz: 0
    }
    let end = {
        tx: x,
        ty: y,
        tz: z
    }

    if (reverse) {
        end.tx = -end.tx;
        end.tz = -end.tz;
        end.ty = -end.ty;
        [start, end] = [end, start]; // Swap values using destructuring assignment
    }

    // start
    view._resetParams();
    view._params.tx = start.tx;
    view._params.ty = start.ty;
    view._params.tz = start.tz;
    view._update();



    var tx = view.tx();
    var ty = view.ty();
    var tz = view.tz();

    var dx = end.tx - tx;
    var dy = end.ty - ty;
    var dz = end.tz - tz;

    console.log(end, {
        tx: tx + dx,
        ty: ty + dy,
        tz: tz + dz
    });

    // end
    Marzipano.util.tween(
        duration,
        tweenVal => {   // func
            _changeViewPoint(view, {
                tx: tx + dx * tweenVal,
                ty: ty + dy * tweenVal,
                tz: tz + dz * tweenVal
            });
        }, () => {      // done
            // reset camera
            _changeViewPoint(view, { tx: 0, ty: 0, tz: 0 });
        });
}

let cameraForward = (link) => {
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle;
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle - 90;
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle - 90 + Viewer.getViewer().view().yaw() * 180 / Math.PI;
    // let arrowAngle = link.angle - (Viewer.getViewer().view().yaw() * 180 / Math.PI + Viewer.getActivePano().north_angle) + Viewer.getActivePano().north_angle - 90 + Viewer.getViewer().view().yaw() * 180 / Math.PI;
    // let arrowAngle = link.angle - Viewer.getActivePano().north_angle;
    let arrowAngle = link.angle - 90;
    let pos = _getPositionByAngle(arrowAngle, Number(distanceInput.value) / 10);

    // console.log(pos);

    // console.log(Viewer.getOldActivePanoId(), Viewer.getActivePano().id);
    let viewOld = Scene.getSceneById(Viewer.getOldActivePanoId())?.scene.view();
    _goTo(viewOld, Number(durationInput.value), pos);
    let viewCurrent = Scene.getSceneById(Viewer.getActivePano().id).scene.view();
    _goTo(viewCurrent, Number(durationInput.value), pos, true);

    // old
    // let sceneOld = Scene.getSceneById(Viewer.getOldActivePanoId());
    // let viewOld = Scene.getSceneById(Viewer.getOldActivePano()?.id)?.scene.view();
    // console.log(sceneOld);
    // // _goTo(viewOld, DURATION, pos);
    // // current
    // let sceneCurrent = Scene.getSceneById(Viewer.getOldActivePano()?.id);
    // let viewCurrent = Scene.getSceneById(Viewer.getActivePano()?.id)?.scene.view();
    // console.log(sceneCurrent);
    // _goTo(viewCurrent, DURATION, pos, true);
}
// let cameraReset = () => {
//     setTimeout(() => {
//         goto(0, 0, 0, 0);
//     }, DURATION);
// }


///////////////////////////////////////////////////////////
// depthmap transition

///////////////////////////////////////////////////////////

// function goto(duration, x, y, z) {
//     let view = Viewer.VIEW;
//     var tx = view.tx;
//     var ty = view.ty;
//     var tz = view.tz;
//     var dx = x - tx;
//     var dy = y - ty;
//     var dz = z - tz;
//     Marzipano.util.tween(duration, function (tweenVal) {
//         view.setTx(tx + dx * tweenVal);
//         view.setTy(ty + dy * tweenVal);
//         view.setTz(tz + dz * tweenVal);
//     }, function () { });
// }

// function addto(duration, x, y, z) {
//     let view = Viewer.VIEW;
//     var ox = view.ox();
//     var oy = view.oy();
//     var oz = view.oz();
//     var dx = x - ox;
//     var dy = y - oy;
//     var dz = z - oz;
//     Marzipano.util.tween(duration, function (tweenVal) {
//         view.setOx(ox + dx * tweenVal);
//         view.setOy(oy + dy * tweenVal);
//         view.setOz(oz + dz * tweenVal);
//     }, function () { });
// }