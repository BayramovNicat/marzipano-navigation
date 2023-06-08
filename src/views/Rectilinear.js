/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var eventEmitter = require('minimal-event-emitter');
var mat4 = require('gl-matrix').mat4;
var vec4 = require('gl-matrix').vec4;
var vec3 = require('gl-matrix').vec3;
var pixelRatio = require('../util/pixelRatio');
var convertFov = require('../util/convertFov');
var mod = require('../util/mod');
var real = require('../util/real');
var clamp = require('../util/clamp');
var decimal = require('../util/decimal');
var compose = require('../util/compose');
var clearOwnProperties = require('../util/clearOwnProperties');

// Default viewport dimensions.
// Start with zero to ensure that those values are handled correctly.
var defaultWidth = 0;
var defaultHeight = 0;

// Default view parameters.
var defaultYaw = 0;
var defaultPitch = 0;
var defaultRoll = 0;
var defaultFov = Math.PI/4;
var defaultProjectionCenterX = 0;
var defaultProjectionCenterY = 0;
var defaultTx = 0;
var defaultTy = 0;
var defaultTz = 0;
var defaultOx = 0;
var defaultOy = 0;
var defaultOz = 0;

// A fov of exactly 0 or π breaks some computations, so we constrain it to the
// [fovLimitEpsilon, π - fovLimitEpsilon] interval. We use 6 decimal places for
// the epsilon value to avoid broken rendering due to loss of precision in
// floating point computations.
var fovLimitEpsilon = 0.000001;


/**
 * @interface RectilinearViewParams
 *
 * A camera configuration for a {@link RectilinearView}.
 *
 * @property {number} yaw The yaw angle, in the [-π, π] range.
 *     When `yaw < 0`, the view rotates to the left.
 *     When `yaw > 0`, the view rotates to the right.
 *
 * @property {number} pitch The pitch angle, in the [-π, π] range.
 *     When `pitch < 0`, the view rotates downwards.
 *     When `pitch > 0`, the view rotates upwards.
 *
 * @property {number} roll The roll angle, in the [-π, π] range.
 *     When `roll < 0`, the view rotates clockwise.
 *     When `roll > 0`, the view rotates counter-clockwise.
 *
 * @property {fov} fov The vertical field of view, in the [0, π] range.
 */


/**
 * @interface RectilinearViewCoords
 *
 * The position of a point in a 360° image.
 *
 * @property {number} yaw The yaw angle, in the [-π, π] range.
 * @property {number} pitch The pitch angle, in the [-π, π] range.
 */


/**
 * @typedef {function} RectilinearViewLimiter
 *
 * View limiter for a {@link RectilinearView}.
 *
 * A view limiter is a function that receives a {@link RectilinearViewParams}
 * object, optionally modifies it in place, and returns it. It can be used to
 * enforce constraints on the view parameters.
 *
 * See {@link RectilinearView.limit} for commonly used limiters. They may be
 * composed together or with user-defined limiters with {@link util.compose}.
 *
 * @param {RectilinearViewParams} params
 * @return {RectilinearViewParams}
 */

/**
 * @class RectilinearView
 * @implements View
 * @classdesc
 *
 * A {@link View} implementing a rectilinear projection for 360° images.
 *
 * @param {RectilinearViewParams=} params The initial view parameters. If
 *     unspecified, defaults to `{yaw: 0, pitch: 0, roll: 0, fov: Math.PI/4 }`.
 * @param {RectilinearViewLimiter=} limiter The view limiter. If unspecified,
 *     no view limiting is applied. See {@link RectilinearView.limit} for
 *     commonly used limiters.
 */
function RectilinearView(params, limiter) {
  // The initial values for the view parameters.
  this._yaw = params && params.yaw != null ? params.yaw : defaultYaw;
  this._pitch = params && params.pitch != null ? params.pitch : defaultPitch;
  this._roll = params && params.roll != null ? params.roll : defaultRoll;
  this._fov = params && params.fov != null ? params.fov : defaultFov;
  this._width = params && params.width != null ?
    params.width : defaultWidth;
  this._height = params && params.height != null ?
    params.height : defaultHeight;
  this._projectionCenterX = params && params.projectionCenterX != null ?
    params.projectionCenterX : defaultProjectionCenterX;
  this._projectionCenterY = params && params.projectionCenterY != null ?
    params.projectionCenterY : defaultProjectionCenterY;

  // A 3D translation of the viewpoint.
  this._tx = params && params.tx != null ? params.tx : defaultTx;
  this._ty = params && params.ty != null ? params.ty : defaultTy;
  this._tz = params && params.tz != null ? params.tz : defaultTz;

  // An additional 3D translation offset of the viewpoint. 
  // But the viewing rotation will be still from the non-offset point.
  this._ox = params && params.ox != null ? params.ox : defaultOx;
  this._oy = params && params.oy != null ? params.oy : defaultOy;
  this._oz = params && params.oz != null ? params.oz : defaultOz;

  // Invert control.
  this._invertControl = params && params.invertControl != null ? params.invertControl : false;

  // The initial value for the view limiter.
  this._limiter = limiter || null;

  // The last calculated projection matrix and its inverse.
  this._projMatrix = mat4.create();
  this._invProjMatrix = mat4.create();

  // The last calculated view matrix and its inverse.
  this._viewMatrix = mat4.create();
  this._invViewMatrix = mat4.create();

  // The last calculated view frustum.
  this._frustum = [
    vec4.create(), // left
    vec4.create(), // right
    vec4.create(), // bottom
    vec4.create(), // top
    vec4.create()  // camera
  ];

  // Whether the projection matrices and the view frustum need to be updated.
  this._matrixChanged = true;

  // Temporary variables used for calculations.
  this._params = {};
  this._fovs = {};
  this._tmpVec = vec4.create();

  // Force view limiting on initial parameters.
  this._update();
}

eventEmitter(RectilinearView);


/**
 * Destructor.
 */
RectilinearView.prototype.destroy = function() {
  clearOwnProperties(this);
};


/**
 * Get the yaw angle.
 * @return {number}
 */
RectilinearView.prototype.yaw = function() {
  return this._yaw;
};


/**
 * Get the pitch angle.
 * @return {number}
 */
RectilinearView.prototype.pitch = function() {
  return this._pitch;
};


/**
 * Get the roll angle.
 * @return {number}
 */
RectilinearView.prototype.roll = function() {
  return this._roll;
};


RectilinearView.prototype.projectionCenterX = function() {
  return this._projectionCenterX;
};


RectilinearView.prototype.projectionCenterY = function() {
  return this._projectionCenterY;
};

/**
 * Get the fov value.
 * @return {number}
 */
RectilinearView.prototype.fov = function() {
  return this._fov;
};


/**
 * Get the viewport width.
 * @return {number}
 */
RectilinearView.prototype.width = function() {
  return this._width;
};


/**
 * Get the viewport height.
 * @return {number}
 */
RectilinearView.prototype.height = function() {
  return this._height;
};

/**
 * Get the viewpoint's tx.
 * @return {number}
 */
RectilinearView.prototype.tx = function() {
  return this._tx;
};

/**
 * Get the viewpoint's ty.
 * @return {number}
 */
RectilinearView.prototype.ty = function() {
  return this._ty;
};

/**
 * Get the viewpoint's tz.
 * @return {number}
 */
RectilinearView.prototype.tz = function() {
  return this._tz;
};

/**
 * Get the viewpoint's ox.
 * @return {number}
 */
RectilinearView.prototype.ox = function() {
  return this._ox;
};

/**
 * Get the viewpoint's oy.
 * @return {number}
 */
RectilinearView.prototype.oy = function() {
  return this._oy;
};

/**
 * Get the viewpoint's tz.
 * @return {number}
 */
RectilinearView.prototype.oz = function() {
  return this._oz;
};

/**
 * Get the invert control flag.
 * @return {boolean}
 */
RectilinearView.prototype.invertControl = function() {
  return this._invertControl;
};

/**
 * Get the viewport dimensions. If an argument is supplied, it is filled in with
 * the result and returned. Otherwise, a fresh object is filled in and returned.
 * @param {Size=} size
 * @return {Size}
 */
RectilinearView.prototype.size = function(size) {
  size = size || {};
  size.width = this._width;
  size.height = this._height;
  return size;
};


/**
 * Get the view parameters. If an argument is supplied, it is filled in with the
 * result and returned. Otherwise, a fresh object is filled in and returned.
 * @param {RectilinearViewParams=} obj
 * @return {RectilinearViewParams}
 */
RectilinearView.prototype.parameters = function(params) {
  params = params || {};
  params.yaw = this._yaw;
  params.pitch = this._pitch;
  params.roll = this._roll;
  params.fov = this._fov;
  return params;
};


/**
 * Get the view limiter, or null if unset.
 * @return {?RectilinearViewLimiter}
 */
RectilinearView.prototype.limiter = function() {
  return this._limiter;
};


/**
 * Set the yaw angle.
 * @param {number} yaw
 */
RectilinearView.prototype.setYaw = function(yaw) {
  this._resetParams();
  this._params.yaw = yaw;
  this._update(this._params);
};


/**
 * Set the pitch angle.
 * @param {number} pitch
 */
RectilinearView.prototype.setPitch = function(pitch) {
  this._resetParams();
  this._params.pitch = pitch;
  this._update(this._params);
};


/**
 * Set the roll angle.
 * @param {number} roll
 */
RectilinearView.prototype.setRoll = function(roll) {
  this._resetParams();
  this._params.roll = roll;
  this._update(this._params);
};


/**
 * Set the fov value.
 * @param {number} fov
 */
RectilinearView.prototype.setFov = function(fov) {
  this._resetParams();
  this._params.fov = fov;
  this._update(this._params);
};


RectilinearView.prototype.setProjectionCenterX = function(projectionCenterX) {
  this._resetParams();
  this._params.projectionCenterX = projectionCenterX;
  this._update(this._params);
};


RectilinearView.prototype.setProjectionCenterY = function(projectionCenterY) {
  this._resetParams();
  this._params.projectionCenterY = projectionCenterY;
  this._update(this._params);
};


/**
 * Add yawOffset to the current yaw value.
 * @param {number} yawOffset
 */
RectilinearView.prototype.offsetYaw = function(yawOffset) {
  this.setYaw(this._yaw + yawOffset);
};


/**
 * Add pitchOffset to the current pitch value.
 * @param {number} pitchOffset
 */
RectilinearView.prototype.offsetPitch = function(pitchOffset) {
  this.setPitch(this._pitch + pitchOffset);
};


/**
 * Add rollOffset to the current roll value.
 * @param {number} rollOffset
 */
RectilinearView.prototype.offsetRoll = function(rollOffset) {
  this.setRoll(this._roll + rollOffset);
};


/**
 * Add fovOffset to the current fov value.
 * @param {number} fovOffset
 */
RectilinearView.prototype.offsetFov = function(fovOffset) {
  this.setFov(this._fov + fovOffset);
};


/**
 * Set the viewport dimensions.
 * @param {Size} size
 */
RectilinearView.prototype.setSize = function(size) {
  this._resetParams();
  this._params.width = size.width;
  this._params.height = size.height;
  this._update(this._params);
};

/**
 * Set the viewpoint's tx.
 * @param {number} tx
 */
RectilinearView.prototype.setTx = function(tx) {
  this._resetParams();
  this._params.tx = tx;
  this._update(this._params);
}

/**
 * Set the viewpoint's ty.
 * @param {number} ty
 */
RectilinearView.prototype.setTy = function(ty) {
  this._resetParams();
  this._params.ty = ty;
  this._update(this._params);
}

/**
 * Set the viewpoint's tz.
 * @param {number} tz
 */
RectilinearView.prototype.setTz = function(tz) {
  this._resetParams();
  this._params.tz = tz;
  this._update(this._params);
}

/**
 * Set the viewpoint's ox.
 * @param {number} tx
 */
RectilinearView.prototype.setOx = function(ox) {
  this._resetParams();
  this._params.ox = ox;
  this._update(this._params);
}

/**
 * Set the viewpoint's oy.
 * @param {number} oy
 */
RectilinearView.prototype.setOy = function(oy) {
  this._resetParams();
  this._params.oy = oy;
  this._update(this._params);
}

/**
 * Set the viewpoint's oz.
 * @param {number} oz
 */
RectilinearView.prototype.setOz = function(oz) {
  this._resetParams();
  this._params.oz = oz;
  this._update(this._params);
}

/**
 * Get the invert control flag.
 * @return {boolean}
 */
RectilinearView.prototype.setInvertControl = function(invertControl) {
  this._invertControl = invertControl;
};

/**
 * Set the view parameters. Unspecified parameters are left unchanged.
 * @param {RectilinearViewParameters} params
 */
RectilinearView.prototype.setParameters = function(params) {
  this._resetParams();
  this._params.yaw = params.yaw;
  this._params.pitch = params.pitch;
  this._params.roll = params.roll;
  this._params.fov = params.fov;
  this._params.projectionCenterX = params.projectionCenterX;
  this._params.projectionCenterY = params.projectionCenterY;
  this._update(this._params);
};


/**
 * Set the view limiter.
 * @param {?RectilinearViewLimiter} limiter The new limiter, or null to unset.
 */
RectilinearView.prototype.setLimiter = function(limiter) {
  this._limiter = limiter || null;
  this._update();
};


RectilinearView.prototype._resetParams = function() {
  var params = this._params;
  params.yaw = null;
  params.pitch = null;
  params.roll = null;
  params.fov = null;
  params.width = null;
  params.height = null;
  params.position = null;
};


RectilinearView.prototype._update = function(params) {

  // Avoid object allocation when no parameters are supplied.
  if (params == null) {
    this._resetParams();
    params = this._params;
  }

  // Save old parameters for later comparison.
  var oldYaw = this._yaw;
  var oldPitch = this._pitch;
  var oldRoll = this._roll;
  var oldFov = this._fov;
  var oldProjectionCenterX = this._projectionCenterX;
  var oldProjectionCenterY = this._projectionCenterY;
  var oldWidth = this._width;
  var oldHeight = this._height;
  
  var oldTx = this._tx;
  var oldTy = this._ty;
  var oldTz = this._tz;
  var oldOx = this._ox;
  var oldOy = this._oy;
  var oldOz = this._oz;

  // Fill in object with the new set of parameters to pass into the limiter.
  params.yaw = params.yaw != null ? params.yaw : oldYaw;
  params.pitch = params.pitch != null ? params.pitch : oldPitch;
  params.roll = params.roll != null ? params.roll : oldRoll;
  params.fov = params.fov != null ? params.fov : oldFov;
  params.width = params.width != null ? params.width : oldWidth;
  params.height = params.height != null ? params.height : oldHeight;
  params.projectionCenterX = params.projectionCenterX != null ?
    params.projectionCenterX : oldProjectionCenterX;
  params.projectionCenterY = params.projectionCenterY != null ?
    params.projectionCenterY : oldProjectionCenterY;

  params.tx = params.tx != null ? params.tx : oldTx;
  params.ty = params.ty != null ? params.ty : oldTy;
  params.tz = params.tz != null ? params.tz : oldTz;
  params.ox = params.ox != null ? params.ox : oldOx;
  params.oy = params.oy != null ? params.oy : oldOy;
  params.oz = params.oz != null ? params.oz : oldOz;

  // Apply view limiting when defined.
  if (this._limiter) {
    params = this._limiter(params);
    if (!params) {
      throw new Error('Bad view limiter');
    }
  }

  // Normalize parameters.
  params = this._normalize(params);

  // Grab the limited parameters.
  var newYaw = params.yaw;
  var newPitch = params.pitch;
  var newRoll = params.roll;
  var newFov = params.fov;
  var newWidth = params.width;
  var newHeight = params.height;
  var newProjectionCenterX = params.projectionCenterX;
  var newProjectionCenterY = params.projectionCenterY;

  var newTx = params.tx;
  var newTy = params.ty;
  var newTz = params.tz;
  var newOx = params.ox;
  var newOy = params.oy;
  var newOz = params.oz;

  // Consistency check.
  if (!real(newYaw) || !real(newPitch) || !real(newRoll) ||
      !real(newFov) || !real(newWidth) || !real(newHeight) ||
      !real(newProjectionCenterX) || !real(newProjectionCenterY)) {
    throw new Error('Bad view - suspect a broken limiter');
  }

  // Update parameters.
  this._yaw = newYaw;
  this._pitch = newPitch;
  this._roll = newRoll;
  this._fov = newFov;
  this._width = newWidth;
  this._height = newHeight;
  this._projectionCenterX = newProjectionCenterX;
  this._projectionCenterY = newProjectionCenterY;
  
  this._tx = newTx;
  this._ty = newTy;
  this._tz = newTz;
  this._ox = newOx;
  this._oy = newOy;
  this._oz = newOz;

  // Check whether the parameters changed and emit the corresponding events.
  if (newYaw !== oldYaw || newPitch !== oldPitch || newRoll !== oldRoll ||
      newFov !== oldFov || newWidth !== oldWidth || newHeight !== oldHeight ||
      newProjectionCenterX !== oldProjectionCenterX ||
      newProjectionCenterY !== oldProjectionCenterY ||
      newTx !== oldTx || newTy !== oldTy || newTz !== oldTz ||
      newOx !== oldOx || newOy !== oldOy || newOz !== oldOz) {
    this._matrixChanged = true;
    this.emit('change');
  }
  if (newWidth !== oldWidth || newHeight !== oldHeight) {
    this.emit('resize');
  }
};


RectilinearView.prototype._normalize = function(params) {

  this._normalizeCoordinates(params);

  // Make sure that neither the horizontal nor the vertical fields of view
  // exceed π - fovLimitEpsilon.
  var hfovPi = convertFov.htov(Math.PI, params.width, params.height);
  var maxFov = isNaN(hfovPi) ? Math.PI : Math.min(Math.PI, hfovPi);
  params.fov = clamp(params.fov, fovLimitEpsilon, maxFov - fovLimitEpsilon);

  return params;
};


RectilinearView.prototype._normalizeCoordinates = function(params) {
  // Constrain yaw, pitch and roll to the [-π, π] interval.
  if ('yaw' in params) {
    params.yaw = mod(params.yaw - Math.PI, -2*Math.PI) + Math.PI;
  }
  if ('pitch' in params) {
    params.pitch = mod(params.pitch - Math.PI, -2*Math.PI) + Math.PI;
  }
  if ('roll' in params) {
    params.roll = mod(params.roll - Math.PI, -2*Math.PI) + Math.PI;
  }
  return params;
};


/**
 * Normalize view coordinates so that they are the closest to the current view.
 * Useful for tweening the view through the shortest path. If a result argument
 * is supplied, it is filled in with the result and returned. Otherwise, a fresh
 * object is filled in and returned.
 *
 * @param {RectilinearViewCoords} coords The view coordinates.
 * @param {RectilinearViewCoords} result The result argument for the normalized
 *     view coordinates.
 */
RectilinearView.prototype.normalizeToClosest = function(coords, result) {

  var viewYaw = this._yaw;
  var viewPitch = this._pitch;

  var coordYaw = coords.yaw;
  var coordPitch = coords.pitch;

  // Check if the yaw is closer after subtracting or adding a full circle.
  var prevYaw = coordYaw - 2*Math.PI;
  var nextYaw = coordYaw + 2*Math.PI;
  if (Math.abs(prevYaw - viewYaw) < Math.abs(coordYaw - viewYaw)) {
    coordYaw = prevYaw;
  }
  else if (Math.abs(nextYaw - viewYaw) < Math.abs(coordYaw - viewYaw)) {
    coordYaw = nextYaw;
  }

  // Check if the pitch is closer after subtracting or adding a full circle.
  var prevPitch = coordPitch - 2*Math.PI;
  var nextPitch = coordPitch + 2*Math.PI;
  if (Math.abs(prevPitch - viewPitch) < Math.abs(coordPitch - viewPitch)) {
    coordPitch = prevPitch;
  }
  else if (Math.abs(prevPitch - viewPitch) < Math.abs(coordPitch - viewPitch)) {
    coordPitch = nextPitch;
  }

  result = result || {};
  result.yaw = coordYaw;
  result.pitch = coordPitch;
  return result;

};


RectilinearView.prototype.updateWithControlParameters = function(parameters) {
  // axisScaledX and axisScaledY are scaled according to their own axis
  // x and y are scaled by the same value

  // If the viewport dimensions are zero, assume a square viewport
  // when converting from hfov to vfov.
  var vfov = this._fov;
  var hfov = convertFov.vtoh(vfov, this._width, this._height);
  if (isNaN(hfov)) {
    hfov = vfov;
  }

  // TODO: revisit this after we rethink the control parameters.
  this.offsetYaw(parameters.axisScaledX * hfov + parameters.x * 2 * hfov + parameters.yaw);
  this.offsetPitch(parameters.axisScaledY * vfov + parameters.y * 2 * hfov + parameters.pitch);
  this.offsetRoll(-parameters.roll);
  this.offsetFov(parameters.zoom * vfov);
};


RectilinearView.prototype._updateMatrix = function() {
  var projMatrix = this._projMatrix;
  var invProjMatrix = this._invProjMatrix;
  var viewMatrix = this._viewMatrix;
  var invViewMatrix = this._invViewMatrix;
  var frustum = this._frustum;

  if (this._matrixChanged) {
    var width = this._width;
    var height = this._height;

    var vfov = this._fov;
    var hfov = convertFov.vtoh(vfov, width, height);
    var aspect = width / height;

    var projectionCenterX = this._projectionCenterX;
    var projectionCenterY = this._projectionCenterY;

    // Projection Matrix.
    if (projectionCenterX !== 0 || projectionCenterY !== 0) {
      var offsetAngleX = Math.atan(projectionCenterX * 2 * Math.tan(hfov/2));
      var offsetAngleY = Math.atan(projectionCenterY * 2 * Math.tan(vfov/2));
      var fovs = this._fovs;
      fovs.leftDegrees = (hfov/2 + offsetAngleX) * 180/Math.PI;
      fovs.rightDegrees = (hfov/2 - offsetAngleX) * 180/Math.PI;
      fovs.upDegrees = (vfov/2 + offsetAngleY) * 180/Math.PI;
      fovs.downDegrees = (vfov/2 - offsetAngleY) * 180/Math.PI;
      mat4.perspectiveFromFieldOfView(projMatrix, fovs, -1, 1);
    } else {
      mat4.perspective(projMatrix, vfov, aspect, -1, 1);
    }

    // mat4.invert(invProjMatrix, projMatrix);

    // // View Matrix.
    // mat4.identity(viewMatrix);
    // mat4.translate(viewMatrix, viewMatrix, vec3.negate(vec3.create(), [this._ox, this._oy, this._oz]));

    // // Invert control.
    // var roll = this._invertControl ? -this._roll : this._roll;
    // var pitch = this._invertControl ? -this._pitch :this._pitch;
    // var yaw = this._invertControl ? -this._yaw : this._yaw;
    // mat4.rotateZ(viewMatrix, viewMatrix, roll);
    // mat4.rotateX(viewMatrix, viewMatrix, pitch);
    // mat4.rotateY(viewMatrix, viewMatrix, yaw);

    // mat4.translate(viewMatrix, viewMatrix, vec3.negate(vec3.create(), [this._tx, this._ty, this._tz]));

    // mat4.invert(invViewMatrix, viewMatrix);

    // // Get the frustum planes.
    // var matrix = mat4.create();
    // mat4.multiply(matrix, projMatrix, viewMatrix);
    // this._matrixToFrustum(matrix, frustum);

    mat4.rotateZ(projMatrix, projMatrix, this._roll);
    mat4.rotateX(projMatrix, projMatrix, this._pitch);
    mat4.rotateY(projMatrix, projMatrix, this._yaw);
    mat4.translate(projMatrix, projMatrix, vec3.negate(vec3.create(), [this._tx, this._ty, this._tz]));
    mat4.invert(invProjMatrix, projMatrix);
    this._matrixToFrustum(projMatrix, frustum);

    this._matrixChanged = false;
  }
};

RectilinearView.prototype._matrixToFrustum = function(p, f) {
  // Extract frustum planes from projection matrix.
  // http://www8.cs.umu.se/kurser/5DV051/HT12/lab/plane_extraction.pdf
  vec4.set(f[0], p[3] + p[0], p[7] + p[4], p[11] + p[8], p[15] + p[12]); // left
  vec4.set(f[1], p[3] - p[0], p[7] - p[4], p[11] - p[8], p[15] - p[12]); // right
  vec4.set(f[2], p[3] + p[1], p[7] + p[5], p[11] + p[9], p[15] + p[13]); // top
  vec4.set(f[3], p[3] - p[1], p[7] - p[5], p[11] - p[9], p[15] - p[13]); // bottom
  vec4.set(f[4], p[3] + p[2], p[7] + p[6], p[11] + p[10], p[15] + p[14]); // camera
};

/**
 * Returns the projection matrix for the current view.
 * @returns {mat4}
 */
RectilinearView.prototype.projection = function() {
  this._updateMatrix();
  return this._projMatrix;
};

/**
 * Returns the inverse projection matrix for the current view.
 * @returns {mat4}
 */
RectilinearView.prototype.inverseProjection = function() {
  this._updateMatrix();
  return this._invProjMatrix;
};

/**
 * Returns the view matrix for the current view.
 * @returns {mat4}
 */
RectilinearView.prototype.viewMatrix = function() {
  this._updateMatrix();
  return this._viewMatrix;
}

/**
 * Returns the inverse view matrix for the current view.
 * @returns {mat4}
 */
RectilinearView.prototype.inverseViewMatrix = function() {
  this._updateMatrix();
  return this._invViewMatrix;
}

/**
 * Return whether the view frustum intersects the given rectangle.
 *
 * This function may return false positives, but never false negatives.
 * It is used for frustum culling, i.e., excluding invisible tiles from the
 * rendering process.
 *
 * @param {vec2[]} rectangle The vertices of the rectangle.
 */
RectilinearView.prototype.intersects = function(rectangle) {
  this._updateMatrix();

  var frustum = this._frustum;
  var vertex = this._tmpVec;

  // Check whether the rectangle is on the outer side of any of the frustum
  // planes. This is a sufficient condition, though not necessary, for the
  // rectangle to be completely outside the frustum.
  for (var i = 0; i < frustum.length; i++) {
    var plane = frustum[i];
    var inside = false;
    for (var j = 0; j < rectangle.length; j++) {
      var corner = rectangle[j];
      vec4.set(vertex, corner[0], corner[1], corner[2], 1.0);
      if (vec4.dot(plane, vertex) >= 0) {
        inside = true;
      }
    }
    if (!inside) {
      return false;
    }
  }
  return true;
};


/**
 * Select the level that should be used to render the view.
 * @param {Level[]} levelList the list of levels from which to select.
 * @return {Level} the selected level.
 */
RectilinearView.prototype.selectLevel = function(levelList) {

  // Multiply the viewport width by the device pixel ratio to get the required
  // horizontal resolution in pixels.
  //
  // Calculate the fraction of a cube face that would be visible given the
  // current vertical field of view. Then, for each level, multiply by the
  // level height to get the height in pixels of the portion that would be
  // visible.
  //
  // Search for the smallest level that satifies the the required height,
  // falling back on the largest level if none do.

  var requiredPixels = pixelRatio() * this._height;
  var coverFactor = Math.tan(0.5 * this._fov);

  for (var i = 0; i < levelList.length; i++) {
    var level = levelList[i];
    if (coverFactor * level.height() >= requiredPixels) {
      return level;
    }
  }

  return levelList[levelList.length - 1];

};


/**
 * Convert view parameters into screen position. If a result argument is
 * provided, it is filled in and returned. Otherwise, a fresh object is filled
 * in and returned.
 *
 * @param {RectilinearViewCoords} coords The view coordinates.
 * @param {Coords=} result The result argument for the screen coordinates.
 * @return {Coords}
 */
RectilinearView.prototype.coordinatesToScreen = function(coords, result) {
  var ray = this._tmpVec;

  if (!result) {
    result = {};
  }

  var width = this._width;
  var height = this._height;

  // Undefined on a null viewport.
  if (width <= 0 || height <= 0) {
    result.x = null;
    result.y = null;
    return null;
  }

  // Compute view ray pointing into the (yaw, pitch) direction.
  var yaw = coords.yaw;
  var pitch = coords.pitch;
  var x = Math.sin(yaw) * Math.cos(pitch);
  var y = -Math.sin(pitch);
  var z = -Math.cos(yaw) * Math.cos(pitch);
  vec4.set(ray, x, y, z, 1);

  // Project view ray onto clip space.
  vec4.transformMat4(ray, ray, this.projection());

  // w in clip space equals -z in camera space.
  if (ray[3] >= 0) {
    // Point is in front of camera.
    // Convert to viewport coordinates.
    result.x = width * (ray[0] / ray[3] + 1) / 2;
    result.y = height * (1 - ray[1] / ray[3]) / 2;
  } else {
    // Point is behind camera.
    result.x = null;
    result.y = null;
    return null;
  }

  return result;
};


/**
 * Convert screen coordinates into view coordinates. If a result argument is
 * provided, it is filled in with the result and returned. Otherwise, a fresh
 * object is filled in and returned.
 *
 * @param {Coords} coords The screen coordinates.
 * @param {RectilinearViewCoords=} result The view coordinates.
 * @return {RectilinearViewCoords}
 */
RectilinearView.prototype.screenToCoordinates = function(coords, result) {
  var ray = this._tmpVec;

  if (!result) {
    result = {};
  }

  var width = this._width;
  var height = this._height;

  // Convert viewport coordinates to clip space.
  var vecx = 2 * coords.x / width - 1;
  var vecy = 1 - 2 * coords.y / height;
  vec4.set(ray, vecx, vecy, 1, 1);

  // Project back to world space.
  vec4.transformMat4(ray, ray, this.inverseProjection());

  // Convert to spherical coordinates.
  var r = Math.sqrt(ray[0] * ray[0] + ray[1] * ray[1] + ray[2] * ray[2]);
  result.yaw = Math.atan2(ray[0], -ray[2]);
  result.pitch = Math.acos(ray[1] / r) - Math.PI/2;

  this._normalizeCoordinates(result);

  return result;
};


/**
 * Calculate the perspective transform required to position an element with
 * perspective.
 *
 * @param {RectilinearViewCoords} coords The view coordinates.
 * @param {number} radius Radius of the sphere embedding the element.
 * @param {string} extraTransforms Extra transformations to be applied after
 *     the element is positioned. This may be used to rotate the element.
 * @return {string} The CSS 3D transform to be applied to the element.
 */
RectilinearView.prototype.coordinatesToPerspectiveTransform = function(
    coords, radius, extraTransforms) {
  extraTransforms = extraTransforms || "";

  var height = this._height;
  var width = this._width;
  var fov = this._fov;
  var perspective = 0.5 * height / Math.tan(fov / 2);

  var transform = '';

  // Center hotspot in screen.
  transform += 'translateX(' + decimal(width/2) + 'px) ';
  transform += 'translateY(' + decimal(height/2) + 'px) ';
  transform += 'translateX(-50%) translateY(-50%) ';

  // Set the perspective depth.
  transform += 'perspective(' + decimal(perspective) + 'px) ';
  transform += 'translateZ(' + decimal(perspective) + 'px) ';

  // Set the camera rotation.
  transform += 'rotateZ(' + decimal(-this._roll) + 'rad) ';
  transform += 'rotateX(' + decimal(-this._pitch) + 'rad) ';
  transform += 'rotateY(' + decimal(this._yaw) + 'rad) ';

  // Set the hotspot rotation.
  transform += 'rotateY(' + decimal(-coords.yaw) + 'rad) ';
  transform += 'rotateX(' + decimal(coords.pitch) + 'rad) ';

  // Move back to sphere.
  transform += 'translateZ(' + decimal(-radius) + 'px) ';

  // Apply the extra transformations
  transform += extraTransforms + ' ';

  return transform;
};


/**
 * Factory functions for view limiters. See {@link RectilinearViewLimiter}.
 * @namespace
 */
RectilinearView.limit = {

  /**
   * Returns a view limiter that constrains the yaw angle.
   * @param {number} min The minimum yaw value.
   * @param {number} max The maximum yaw value.
   * @return {RectilinearViewLimiter}
   */
  yaw: function(min, max) {
    return function limitYaw(params) {
      params.yaw = clamp(params.yaw, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the pitch angle.
   * @param {number} min The minimum pitch value.
   * @param {number} max The maximum pitch value.
   * @return {RectilinearViewLimiter}
   */
  pitch: function(min, max) {
    return function limitPitch(params) {
      params.pitch = clamp(params.pitch, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the roll angle.
   * @param {number} min The minimum roll value.
   * @param {number} max The maximum roll value.
   * @return {RectilinearViewLimiter}
   */
  roll: function(min, max) {
    return function limitRoll(params) {
      params.roll = clamp(params.roll, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the horizontal field of view.
   * @param {number} min The minimum horizontal field of view.
   * @param {number} max The maximum horizontal field of view.
   * @return {RectilinearViewLimiter}
   */
  hfov: function(min, max) {
    return function limitHfov(params) {
      var width = params.width;
      var height = params.height;
      if (width > 0 && height > 0) {
        var vmin = convertFov.htov(min, width, height);
        var vmax = convertFov.htov(max, width, height);
        params.fov = clamp(params.fov, vmin, vmax);
      }
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the vertical field of view.
   * @param {number} min The minimum vertical field of view.
   * @param {number} max The maximum vertical field of view.
   * @return {RectilinearViewLimiter}
   */
  vfov: function(min, max) {
    return function limitVfov(params) {
      params.fov = clamp(params.fov, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that prevents zooming in beyond the given
   * resolution.
   * @param {number} size The cube face width in pixels or, equivalently, one
   *     fourth of the equirectangular width in pixels.
   * @return {RectilinearViewLimiter}
   */
  resolution: function(size) {
    return function limitResolution(params) {
      var height = params.height;
      if (height) {
        var requiredPixels = pixelRatio() * height;
        var minFov = 2 * Math.atan(requiredPixels / size);
        params.fov = clamp(params.fov, minFov, Infinity);
      }
      return params;
    };
  },

  /**
   * Returns a view limiter that limits the horizontal and vertical field of
   * view, prevents zooming in past the image resolution, and limits the pitch
   * range to prevent the camera wrapping around at the poles. These are the
   * most common view constraints for a 360° panorama.
   * @param {number} maxResolution The cube face width in pixels or,
   *     equivalently, one fourth of the equirectangular width in pixels.
   * @param {number} maxVFov The maximum vertical field of view.
   * @param {number} [maxHFov=maxVFov] The maximum horizontal field of view.
   * @return {RectilinearViewLimiter}
   */
  traditional: function(maxResolution, maxVFov, maxHFov) {
    maxHFov = maxHFov != null ? maxHFov : maxVFov;

    return compose(
      RectilinearView.limit.resolution(maxResolution),
      RectilinearView.limit.vfov(0, maxVFov),
      RectilinearView.limit.hfov(0, maxHFov),
      RectilinearView.limit.pitch(-Math.PI/2, Math.PI/2));
  }

};


RectilinearView.type = RectilinearView.prototype.type = 'rectilinear';


module.exports = RectilinearView;
