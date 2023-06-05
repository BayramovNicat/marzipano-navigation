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
let yaw = 0, pitch = 0, fov = 180;
let panoListener = () => {
    viewer.scene().view().setYaw(yaw * Math.PI / 180);
    viewer.scene().view().setPitch(pitch * Math.PI / 180);
    viewer.scene().view().setFov(fov * Math.PI / 180);

    Arrows.removeArrows();
    Viewer.getActivePano().links.forEach(i => {
        Arrows.createArrow(i);
        Scene.loadScene(Pano.findPano(i.id));
    });
}
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
    // console.log(Viewer.getActivePano());
    Scene.loadScene(Viewer.getActivePano()).switchTo({ transitionDuration: Number(durationInput.value) });
    console.log(panoId);
}

Arrows.setArrowClick((link) => {
    goToPano(link.id);
    // Viewer.setActivePano(Pano.findPano(link.id));
    moveCameraForward(link);
})

// init first pano
setTimeout(() => {
    goToPano(Pano.panoramas[0].id);
}, 10);

document.querySelector('.hotspot').addEventListener('click', (e) => {
    goToPano(Number(e.target.dataset.id));
});



///////////////////////////////////////////////////////////
// pano change transition
const changeViewPosition = (view, { tx, ty, tz }) => {
    view._resetParams();
    view._params.tx = tx;
    view._params.ty = ty;
    view._params.tz = tz;
    view._update();
};

const animateViewPosition = (view, { x, y, z }, duration, reverse = false) => {
    const defaultPosition = { tx: 0, ty: 0, tz: 0 };
    let startPosition = { ...defaultPosition };
    let endPosition = { tx: x, ty: y, tz: z };

    if (reverse) {
        Object.keys(endPosition).forEach(key => (endPosition[key] = -endPosition[key]));
        [startPosition, endPosition] = [endPosition, startPosition];
    }

    changeViewPosition(view, startPosition);

    Marzipano.util.tween(
        duration,
        tweenValue => {
            changeViewPosition(view, {
                tx: view.tx() * (1 - tweenValue) + endPosition.tx * tweenValue,
                ty: view.ty() * (1 - tweenValue) + endPosition.ty * tweenValue,
                tz: view.tz() * (1 - tweenValue) + endPosition.tz * tweenValue
            });
        },
        () => {
            changeViewPosition(view, defaultPosition);
        }
    );
};

const getPositionFromAngle = (angle, radius) => {
    const angleInRadians = angle * Math.PI / 180;
    const x = radius * Math.cos(angleInRadians);
    const z = radius * Math.sin(angleInRadians);
    return { x, y: 0, z };
};

const moveCameraForward = (link) => {
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle;
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle - 90;
    // let arrowAngle = link.angle - Viewer.getAngle() + Viewer.getActivePano().north_angle - 90 + Viewer.getViewer().view().yaw() * 180 / Math.PI;
    // let arrowAngle = link.angle - (Viewer.getViewer().view().yaw() * 180 / Math.PI + Viewer.getActivePano().north_angle) + Viewer.getActivePano().north_angle - 90 + Viewer.getViewer().view().yaw() * 180 / Math.PI;
    // let arrowAngle = link.angle - Viewer.getActivePano().north_angle;
    const arrowAngle = link.angle - 90;
    const position = getPositionFromAngle(arrowAngle, Number(distanceInput.value) / 10);
    const duration = Number(durationInput.value);

    const oldView = Scene.getSceneById(Viewer.getOldActivePanoId()).scene.view();
    animateViewPosition(oldView, position, duration);
    const currentView = Scene.getSceneById(Viewer.getActivePano().id).scene.view();
    animateViewPosition(currentView, position, duration, true);
};