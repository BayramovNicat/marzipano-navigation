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
let durationFadeInput = document.querySelector('#duration-fade');


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
    const oldPano = Viewer.getActivePano();
    Viewer.setActivePano(Pano.findPano(panoId));
    const currentPano = Viewer.getActivePano();
    const duration = Number(durationFadeInput.value);

    Scene.loadScene(currentPano).switchTo({ transitionDuration: duration, transitionUpdate: () => { } });
    blurEffect(duration);
    moveCameraForward(oldPano, currentPano);
}

Arrows.setArrowClick((link) => {
    goToPano(link.id);
});

// init first pano
setTimeout(() => {
    goToPano(Pano.panoramas[0].id);
}, 10);

document.querySelectorAll('.hotspot').forEach(elm => {
    elm.addEventListener('click', (e) => {
        goToPano(Number(e.target.dataset.id));
    });
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

    const tx = view.tx(), ty = view.ty(), tz = view.tz();
    const delta = Object.fromEntries(
        Object.entries(endPosition).map(([key, val]) => [key, val - view[key]()])
    );
    Marzipano.util.tween(
        duration,
        tweenValue => {
            changeViewPosition(view, {
                tx: tx + delta.tx * tweenValue,
                ty: ty + delta.ty * tweenValue,
                tz: tz + delta.tz * tweenValue
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

const getAngleBetweenPoints = (point1, point2) => {
    const dx = point2.lat - point1.lat;
    const dy = point2.lng - point1.lng;
    const angleInRadians = Math.atan2(dy, dx);
    const angleInDegrees = angleInRadians * (180 / Math.PI);
    return angleInDegrees;
};

const getDistanceBetweenPoints = (point1, point2) => {
    const dx = point2.lat - point1.lat;
    const dy = point2.lng - point1.lng;
    return Math.sqrt(dx * dx + dy * dy);
};

const moveCameraForward = (panoOld, panoCurrent) => {
    if (!panoOld || !panoCurrent || panoOld.id == panoCurrent.id) return;
    const distance = Number(distanceInput.value);
    const duration = Number(durationInput.value);
    const angle = getAngleBetweenPoints(panoOld.latlong, panoCurrent.latlong) - 90;
    const angleOld = angle - panoOld.north_angle;
    const angleCurrent = angle - panoCurrent.north_angle;
    const positionOld = getPositionFromAngle(angleOld, distance / 10);
    const positionCurrent = getPositionFromAngle(angleCurrent, distance / 10);
    const viewOld = Scene.getSceneById(panoOld.id).scene.view();
    const viewCurrent = Scene.getSceneById(panoCurrent.id).scene.view();

    animateViewPosition(viewOld, positionOld, duration);
    animateViewPosition(viewCurrent, positionCurrent, duration, true);
};

const blurEffect = (duration) => {
    const blurDepth = document.getElementById('blur-depth').value;
    const blur = 5 * blurDepth;
    requestAnimation(duration / 2, (prog) => {
        let b = prog * blur / 100;
        Viewer.getViewer()._controlContainer.style.backdropFilter = `blur(${b}px)`;
    });
    setTimeout(() => {
        requestAnimation(duration / 2, (prog) => {
            let b = prog * blur / 100;
            Viewer.getViewer()._controlContainer.style.backdropFilter = `blur(${blur - b}px)`;
        });
    }, duration / 2);
    console.log(Viewer.getViewer()._controlContainer.style.backdropFilter);
}


const requestAnimation = (duration, func) => {
    let startTime = null;
    const animate = (timestamp) => {
        if (!startTime)
            startTime = timestamp;
        const elapsedTime = Math.min(duration, timestamp - startTime);
        func(elapsedTime / duration * 100);
        if (elapsedTime < duration)
            requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}


