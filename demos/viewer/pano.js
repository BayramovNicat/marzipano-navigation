import panoramas from './data.js';

const findPano = (panoId) => {
    return panoramas.find(i => i.id === panoId);
};

export default {
    panoramas,
    findPano
};