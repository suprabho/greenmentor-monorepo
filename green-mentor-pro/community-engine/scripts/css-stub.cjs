/**
 * Make `require('…​.css')` a no-op.
 *
 * viz-engine's barrel imports mapbox-gl's stylesheet, which a bundler handles and
 * plain Node cannot parse. tsx compiles this project to CJS, so the stylesheet
 * arrives through the CommonJS loader — hence patching `Module._extensions`
 * rather than an ESM `load` hook.
 *
 * Lets a Node script exercise the viz REGISTRY, which is what the story-pipeline's
 * outline/visual prompts are built from.
 */
const Module = require("node:module");
Module._extensions[".css"] = function (module) {
  module.exports = {};
};
