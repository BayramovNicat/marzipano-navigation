'use strict';

module.exports = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',

  'uniform sampler2D uSampler;',
  'uniform float uOpacity;',
  'uniform vec4 uColorOffset;',
  'uniform mat4 uColorMatrix;',

  'varying vec2 vTextureCoord;',

  `
  void main(void) {
    //if (!gl_FrontFacing) {
    //  discard; // Discard the front-facing triangles
    //} else {
      vec4 color = texture2D(uSampler, vTextureCoord) * uColorMatrix + uColorOffset;
      gl_FragColor = vec4(color.rgba * uOpacity);
    //}
  }
  `
].join('\n');