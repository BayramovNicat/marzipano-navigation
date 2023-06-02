import Viewer from './viewer.js';

let _arrows = [];
const SVNGS = "http://www.w3.org/2000/svg";
const ARROW_SHAPES = [
    {
        class: 'shadow',
        d: 'M 0 -100 L 40 -60 L 30 -50 L 0 -82 L -30 -50 L -40 -60',
    },
    {
        class: 'arrow',
        d: 'M 0 -100 L 40 -60 L 30 -50 L 0 -82 L -30 -50 L -40 -60',
    },
    {
        class: 'placeholder',
        d: 'M 0 -120 L 60 -60 L 40 -30 L -40 -30 L -60 -60 L 0 -120'
    }
];

let _createShape = (shape, linkAngle) => {
    const path = document.createElementNS(SVNGS, 'path');
    path.setAttribute('d', shape.d);
    path.setAttribute('class', shape.class);
    path.setAttribute('transform', _transformShape(linkAngle, shape.class));
    return path;
}
let _transformShape = (linkAngle, shapeClass) => {
    let pitch = (-1) * Viewer.getViewer().scene().view().pitch() * 180 / Math.PI;
    let translateX = _toFloat(Viewer.getViewer()._size.width / 2);
    let translateY = _toFloat(Viewer.getViewer()._size.height * (78 + pitch) / 100);
    if (shapeClass == 'shadow')
        translateY += 3;
    let scaleY = _toFloat(1 - (0.667 + (0.262 * pitch / 90)));
    if (pitch <= 0)
        scaleY = _toFloat(0.333 + (0.667 * pitch / -90));
    let rotate = _toFloat(linkAngle - Viewer.getAngle() + Viewer.getActivePano().north_angle);
    return `translate(${translateX}, ${translateY}) scale(1, ${scaleY}) rotate(${rotate})`;
}
let _toFloat = (int) => {
    return parseFloat((int).toFixed(2));
}



let removeArrows = () => {
    let svgContainer = document.getElementById('arrows');
    if (svgContainer)
        svgContainer.remove();
    _arrows = [];
}

let createArrow = (link) => {
    let svgContainer = document.getElementById('arrows');
    if (!svgContainer) {
        svgContainer = document.createElementNS(SVNGS, 'svg');
        svgContainer.setAttribute('id', 'arrows');
        Viewer.getViewer().domElement().appendChild(svgContainer);
    }
    const group = document.createElementNS(SVNGS, 'g');

    group.addEventListener('click', (event) => {
        _arrowClick(link);
    });

    let shapes = ARROW_SHAPES.map(i => _createShape(i, link.angle));
    shapes.forEach(i => group.appendChild(i));

    _arrows.push({
        id: link.id,
        angle: link.angle,
        shapes: shapes
    });

    svgContainer.appendChild(group);
}

let rotateArrows = () => {
    _arrows.forEach(i => {
        i.shapes.forEach(shape => {
            shape.setAttribute('transform', _transformShape(i.angle, shape.className.baseVal));
        });
    });
}
/**
 * Handle click event for arrows.
 * Navigates to the panorama associated with the clicked arrow link.
 * @param {Object} link - The arrow link object containing `id` and `angle` properties.
 *                       - `id`: A unique identifier for the link.
 *                       - `angle`: The angle associated with the link.
 */
let _arrowClick = (link) => {

    // _goToPano(link.id);
}
// let _goToPano = () => { };
// let setGoToPano = (goToPano) => {
//     _goToPano = goToPano;
// }
let setArrowClick = (arrowClick) => {
    _arrowClick = arrowClick;
}

export default {
    removeArrows,
    createArrow,
    rotateArrows,
    setArrowClick
};