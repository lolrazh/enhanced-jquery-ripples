/**
 * jQuery Ripples plugin v0.6.3 / https://github.com/sirxemic/jquery.ripples
 * MIT License
 * @author sirxemic / https://sirxemic.com/
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('jquery')) :
	typeof define === 'function' && define.amd ? define(['jquery'], factory) :
	(factory(global.$));
}(this, (function ($) { 'use strict';

$ = $ && 'default' in $ ? $['default'] : $;

var gl;
var $window = $(window); // There is only one window, so why not cache the jQuery-wrapped window?

function isPercentage(str) {
	return str[str.length - 1] == '%';
}

/**
 *  Load a configuration of GL settings which the browser supports.
 *  For example:
 *  - not all browsers support WebGL
 *  - not all browsers support floating point textures
 *  - not all browsers support linear filtering for floating point textures
 *  - not all browsers support rendering to floating point textures
 *  - some browsers *do* support rendering to half-floating point textures instead.
 */
function loadConfig() {
	var canvas = document.createElement('canvas');
	gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

	if (!gl) return null;

	// Load extensions
	var extensions = {};
	[
		'OES_texture_float',
		'OES_texture_half_float',
		'OES_texture_float_linear',
		'OES_texture_half_float_linear'
	].forEach(function(name) {
		var extension = gl.getExtension(name);
		if (extension) extensions[name] = extension;
	});

	if (!extensions.OES_texture_float) return null;

	function createConfig(type, glType, arrayType) {
		var name = 'OES_texture_' + type,
			nameLinear = name + '_linear',
			linearSupport = nameLinear in extensions;

		return {
			type: glType,
			arrayType: arrayType,
			linearSupport: linearSupport,
			extensions: linearSupport ? [name, nameLinear] : [name]
		};
	}

	var configs = [
		createConfig('float', gl.FLOAT, Float32Array)
	];

	if (extensions.OES_texture_half_float) {
		configs.push(createConfig('half_float', extensions.OES_texture_half_float.HALF_FLOAT_OES, null));
	}

	// Setup the texture and framebuffer
	var texture = gl.createTexture();
	var framebuffer = gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// Find first supported configuration
	for (var i = 0; i < configs.length; i++) {
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, configs[i].type, null);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
			return configs[i];
		}
	}

	return null;
}

function createImageData(width, height) {
	try {
		return new ImageData(width, height);
	}
	catch (e) {
		// Fallback for IE
		var canvas = document.createElement('canvas');
		return canvas.getContext('2d').createImageData(width, height);
	}
}

function translateBackgroundPosition(value) {
	var parts = value.split(' ');

	if (parts.length === 1) {
		switch (value) {
			case 'center':
				return ['50%', '50%'];
			case 'top':
				return ['50%', '0'];
			case 'bottom':
				return ['50%', '100%'];
			case 'left':
				return ['0', '50%'];
			case 'right':
				return ['100%', '50%'];
			default:
				return [value, '50%'];
		}
	}
	else {
		return parts.map(function(part) {
			switch (value) {
				case 'center':
					return '50%';
				case 'top':
				case 'left':
					return '0';
				case 'right':
				case 'bottom':
					return '100%';
				default:
					return part;
			}
		});
	}
}

function createProgram(vertexSource, fragmentSource, uniformValues) {
	function compileSource(type, source) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Shader compile error:', gl.getShaderInfoLog(shader));
			throw new Error('compile error: ' + gl.getShaderInfoLog(shader));
		}
		return shader;
	}

	var program = {};

	program.id = gl.createProgram();
	gl.attachShader(program.id, compileSource(gl.VERTEX_SHADER, vertexSource));
	gl.attachShader(program.id, compileSource(gl.FRAGMENT_SHADER, fragmentSource));
	gl.linkProgram(program.id);
	if (!gl.getProgramParameter(program.id, gl.LINK_STATUS)) {
		console.error('Program link error:', gl.getProgramInfoLog(program.id));
		throw new Error('link error: ' + gl.getProgramInfoLog(program.id));
	}

	// Fetch the uniform and attribute locations
	program.uniforms = {};
	program.locations = {};
	gl.useProgram(program.id);
	gl.enableVertexAttribArray(0);
	var match, name, regex = /uniform (\w+) (\w+)/g, shaderCode = vertexSource + fragmentSource;
	while ((match = regex.exec(shaderCode)) != null) {
		name = match[2];
		program.locations[name] = gl.getUniformLocation(program.id, name);
	}

	return program;
}

function bindTexture(texture, unit) {
	gl.activeTexture(gl.TEXTURE0 + (unit || 0));
	gl.bindTexture(gl.TEXTURE_2D, texture);
}

function extractUrl(value) {
	var urlMatch = /url\(["']?([^"']*)["']?\)/.exec(value);
	if (urlMatch == null) {
		return null;
	}

	return urlMatch[1];
}

function isDataUri(url) {
	return url.match(/^data:/);
}

var config = loadConfig();
var transparentPixels = createImageData(32, 32);

// Extend the css
$('head').prepend('<style>.jquery-ripples { position: relative; z-index: 0; }</style>');

// RIPPLES CLASS DEFINITION
// =========================

var Ripples = function (el, options) {
	var that = this;

	this.$el = $(el);

	// Init properties from options
	this.interactive = options.interactive;
	this.resolution = options.resolution;
	this.textureDelta = new Float32Array([1 / this.resolution, 1 / this.resolution]);

	// Add spring physics properties
	this.currentTilt = { x: 0, y: 0 };
	this.targetTilt = { x: 0, y: 0 };
	this.velocity = { x: 0, y: 0 };
	this.lastTime = Date.now();
	
	this.perturbance = options.perturbance;
	this.dropRadius = options.dropRadius;
	
	// Add raindrop properties
	this.lastMouseMove = Date.now();
	this.isRaining = false;
	this.rainInterval = null;
	
	this.crossOrigin = options.crossOrigin;
	this.imageUrl = options.imageUrl;

	// Add time tracking for iridescence
	this.startTime = Date.now() / 1000;

	// Add mouse position tracking
	this.mousePosition = new Float32Array([0.5, 0.5]);  // Default to center
	
	// Init WebGL canvas
	var canvas = document.createElement('canvas');
	canvas.width = this.$el.innerWidth();
	canvas.height = this.$el.innerHeight();
	this.canvas = canvas;
	this.$canvas = $(canvas);
	this.$canvas.css({
		position: 'absolute',
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		zIndex: -1,
		transform: 'scale(1.15)',  // Keep the 110% zoom
		transformOrigin: 'center center'
	});

	// Create wrapper for tilt effect
	this.$wrapper = $('<div>').css({
		position: 'absolute',
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		zIndex: -1,
		perspective: '2000px',  // Increased from 1000px for more subtle depth
		transformStyle: 'preserve-3d'
	});

	this.$el.addClass('jquery-ripples')
		.css('position', 'relative')
		.append(this.$wrapper.append(canvas));
	
	// Track mouse movement - MOVED after wrapper creation
	if (this.interactive) {
		this.$el.on('mousemove.ripples', function(e) {
			var rect = e.currentTarget.getBoundingClientRect();
			that.mousePosition[0] = (e.clientX - rect.left) / rect.width;
			that.mousePosition[1] = 1.0 - (e.clientY - rect.top) / rect.height;
			
			// Update target tilt based on mouse position
			that.targetTilt.x = (that.mousePosition[0] - 0.5) * 30;
			that.targetTilt.y = (that.mousePosition[1] - 0.5) * -30;
			
			// Reset rain timer on mouse move
			that.lastMouseMove = Date.now();
			if (that.isRaining) {
				that.stopRain();
			}
		}).on('mouseleave.ripples', function() {
			// Set target to zero when mouse leaves
			that.targetTilt.x = 0;
			that.targetTilt.y = 0;
		});

		// Start animation loop for spring physics
		function updateSpringPhysics() {
			if (that.destroyed) return;

			var currentTime = Date.now();
			var deltaTime = (currentTime - that.lastTime) / 1000; // Convert to seconds
			that.lastTime = currentTime;

			// Spring constants
			var springStrength = 11.0;  // How quickly it moves to target
			var friction = 0.9;      // How quickly it slows down
			
			// Calculate spring physics for X and Y
			var dx = that.targetTilt.x - that.currentTilt.x;
			var dy = that.targetTilt.y - that.currentTilt.y;
			
			// Add spring acceleration
			that.velocity.x += dx * springStrength * deltaTime;
			that.velocity.y += dy * springStrength * deltaTime;
			
			// Apply friction
			that.velocity.x *= Math.pow(friction, deltaTime * 60);
			that.velocity.y *= Math.pow(friction, deltaTime * 60);
			
			// Update position
			that.currentTilt.x += that.velocity.x * deltaTime;
			that.currentTilt.y += that.velocity.y * deltaTime;
			
			// Apply the calculated tilt
			that.$wrapper.css({
				transform: `rotateX(${that.currentTilt.y}deg) rotateY(${that.currentTilt.x}deg)`
			});

			requestAnimationFrame(updateSpringPhysics);
		}

		updateSpringPhysics();
	}

	this.context = gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

	// Load extensions
	config.extensions.forEach(function(name) {
		gl.getExtension(name);
	});

	// Auto-resize when window size changes.
	this.updateSize = this.updateSize.bind(this);
	$(window).on('resize', this.updateSize);

	// Init rendertargets for ripple data.
	this.textures = [];
	this.framebuffers = [];
	this.bufferWriteIndex = 0;
	this.bufferReadIndex = 1;

	var arrayType = config.arrayType;
	var textureData = arrayType ? new arrayType(this.resolution * this.resolution * 4) : null;

	for (var i = 0; i < 2; i++) {
		var texture = gl.createTexture();
		var framebuffer = gl.createFramebuffer();

		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, config.linearSupport ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, config.linearSupport ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.resolution, this.resolution, 0, gl.RGBA, config.type, textureData);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		this.textures.push(texture);
		this.framebuffers.push(framebuffer);
	}

	// Init GL stuff
	this.quad = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		-1, -1,
		+1, -1,
		+1, +1,
		-1, +1
	]), gl.STATIC_DRAW);

	this.initShaders();
	this.initTexture();
	this.setTransparentTexture();

	// Load the image either from the options or CSS rules
	this.loadImage();

	// Set correct clear color and blend mode (regular alpha blending)
	gl.clearColor(0, 0, 0, 0);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	// Plugin is successfully initialized!
	this.visible = true;
	this.running = true;
	this.inited = true;
	this.destroyed = false;

	this.setupPointerEvents();

	// Init animation
	function step() {
		if (!that.destroyed) {
			that.step();

			requestAnimationFrame(step);
		}
	}

	requestAnimationFrame(step);
};

Ripples.DEFAULTS = {
	imageUrl: null,
	resolution: 512,
	dropRadius: 37,
	perturbance: 0.12,
	interactive: true,
	crossOrigin: ''
};

Ripples.prototype = {

	// Set up pointer (mouse + touch) events
	setupPointerEvents: function() {
		var that = this;

		function pointerEventsEnabled() {
			return that.visible && that.running && that.interactive;
		}

		function dropAtPointer(pointer, big) {
			if (pointerEventsEnabled()) {
				that.dropAtPointer(
					pointer,
					that.dropRadius * (big ? 1.5 : 1),
					(big ? 0.14 : 0.01)
				);
			}
		}

		// Start listening to pointer events
		this.$el

			// Create regular, small ripples for mouse move and touch events...
			.on('mousemove.ripples', function(e) {
				dropAtPointer(e);
			})
			.on('touchmove.ripples touchstart.ripples', function(e) {
				var touches = e.originalEvent.changedTouches;
				for (var i = 0; i < touches.length; i++) {
					dropAtPointer(touches[i]);
				}
			})

			// ...and only a big ripple on mouse down events.
			.on('mousedown.ripples', function(e) {
				dropAtPointer(e, true);
			});
	},

	// Load the image either from the options or the element's CSS rules.
	loadImage: function() {
		var that = this;

		gl = this.context;

		var newImageSource = this.imageUrl ||
			extractUrl(this.originalCssBackgroundImage) ||
			extractUrl(this.$el.css('backgroundImage'));

		// If image source is unchanged, don't reload it.
		if (newImageSource == this.imageSource) {
			return;
		}

		this.imageSource = newImageSource;

		// Falsy source means no background.
		if (!this.imageSource) {
			this.setTransparentTexture();
			return;
		}

		// Load the texture from a new image.
		var image = new Image;
		image.onload = function() {
			gl = that.context;

			// Only textures with dimensions of powers of two can have repeat wrapping.
			function isPowerOfTwo(x) {
				return (x & (x - 1)) == 0;
			}

			var wrapping = (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) ? gl.REPEAT : gl.CLAMP_TO_EDGE;

			gl.bindTexture(gl.TEXTURE_2D, that.backgroundTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapping);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapping);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

			that.backgroundWidth = image.width;
			that.backgroundHeight = image.height;

			// Hide the background that we're replacing.
			that.hideCssBackground();
		};

		// Fall back to a transparent texture when loading the image failed.
		image.onerror = function() {
			gl = that.context;

			that.setTransparentTexture();
		};

		// Disable CORS when the image source is a data URI.
		image.crossOrigin = isDataUri(this.imageSource) ? null : this.crossOrigin;

		image.src = this.imageSource;
	},

	step: function() {
		gl = this.context;

		if (!this.visible) {
			return;
		}

		this.computeTextureBoundaries();

		if (this.running) {
			this.update();
			
			// Check if we should start rain
			if (!this.isRaining && Date.now() - this.lastMouseMove > 1000) {
				this.startRain();
			}
		}

		// Update time uniform for iridescence
		var currentTime = Date.now() / 1000;
		var elapsedTime = currentTime - this.startTime;
		gl.useProgram(this.renderProgram.id);
		gl.uniform1f(this.renderProgram.locations.time, elapsedTime);

		this.render();
	},

	drawQuad: function() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	},

	render: function() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		gl.viewport(0, 0, this.canvas.width, this.canvas.height);

		gl.enable(gl.BLEND);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(this.renderProgram.id);

		bindTexture(this.backgroundTexture, 0);
		bindTexture(this.textures[0], 1);

		gl.uniform1f(this.renderProgram.locations.perturbance, this.perturbance);
		gl.uniform2fv(this.renderProgram.locations.topLeft, this.renderProgram.uniforms.topLeft);
		gl.uniform2fv(this.renderProgram.locations.bottomRight, this.renderProgram.uniforms.bottomRight);
		gl.uniform2fv(this.renderProgram.locations.containerRatio, this.renderProgram.uniforms.containerRatio);
		gl.uniform1i(this.renderProgram.locations.samplerBackground, 0);
		gl.uniform1i(this.renderProgram.locations.samplerRipples, 1);
		gl.uniform2fv(this.renderProgram.locations.u_mouse, this.mousePosition);
		gl.uniform2fv(this.renderProgram.locations.textureSize, new Float32Array([this.canvas.width, this.canvas.height]));

		this.drawQuad();
		gl.disable(gl.BLEND);
	},

	update: function() {
		gl.viewport(0, 0, this.resolution, this.resolution);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.bufferWriteIndex]);
		bindTexture(this.textures[this.bufferReadIndex]);
		gl.useProgram(this.updateProgram.id);

		this.drawQuad();

		this.swapBufferIndices();
	},

	swapBufferIndices: function() {
		this.bufferWriteIndex = 1 - this.bufferWriteIndex;
		this.bufferReadIndex = 1 - this.bufferReadIndex;
	},

	computeTextureBoundaries: function() {
		var backgroundSize = this.$el.css('background-size');
		var backgroundAttachment = this.$el.css('background-attachment');
		var backgroundPosition = translateBackgroundPosition(this.$el.css('background-position'));

		// Here the 'container' is the element which the background adapts to
		// (either the chrome window or some element, depending on attachment)
		var container;
		if (backgroundAttachment == 'fixed') {
			container = { left: window.pageXOffset, top: window.pageYOffset };
			container.width = $window.width();
			container.height = $window.height();
		}
		else {
			container = this.$el.offset();
			container.width = this.$el.innerWidth();
			container.height = this.$el.innerHeight();
		}

		// TODO: background-clip
		if (backgroundSize == 'cover') {
			var scale = Math.max(container.width / this.backgroundWidth, container.height / this.backgroundHeight);

			var backgroundWidth = this.backgroundWidth * scale;
			var backgroundHeight = this.backgroundHeight * scale;
		}
		else if (backgroundSize == 'contain') {
			var scale = Math.min(container.width / this.backgroundWidth, container.height / this.backgroundHeight);

			var backgroundWidth = this.backgroundWidth * scale;
			var backgroundHeight = this.backgroundHeight * scale;
		}
		else {
			backgroundSize = backgroundSize.split(' ');
			var backgroundWidth = backgroundSize[0] || '';
			var backgroundHeight = backgroundSize[1] || backgroundWidth;

			if (isPercentage(backgroundWidth)) {
				backgroundWidth = container.width * parseFloat(backgroundWidth) / 100;
			}
			else if (backgroundWidth != 'auto') {
				backgroundWidth = parseFloat(backgroundWidth);
			}

			if (isPercentage(backgroundHeight)) {
				backgroundHeight = container.height * parseFloat(backgroundHeight) / 100;
			}
			else if (backgroundHeight != 'auto') {
				backgroundHeight = parseFloat(backgroundHeight);
			}

			if (backgroundWidth == 'auto' && backgroundHeight == 'auto') {
				backgroundWidth = this.backgroundWidth;
				backgroundHeight = this.backgroundHeight;
			}
			else {
				if (backgroundWidth == 'auto') {
					backgroundWidth = this.backgroundWidth * (backgroundHeight / this.backgroundHeight);
				}

				if (backgroundHeight == 'auto') {
					backgroundHeight = this.backgroundHeight * (backgroundWidth / this.backgroundWidth);
				}
			}
		}

		// Compute backgroundX and backgroundY in page coordinates
		var backgroundX = backgroundPosition[0];
		var backgroundY = backgroundPosition[1];

		if (isPercentage(backgroundX)) {
			backgroundX = container.left + (container.width - backgroundWidth) * parseFloat(backgroundX) / 100;
		}
		else {
			backgroundX = container.left + parseFloat(backgroundX);
		}

		if (isPercentage(backgroundY)) {
			backgroundY = container.top + (container.height - backgroundHeight) * parseFloat(backgroundY) / 100;
		}
		else {
			backgroundY = container.top + parseFloat(backgroundY);
		}

		var elementOffset = this.$el.offset();

		this.renderProgram.uniforms.topLeft = new Float32Array([
			(elementOffset.left - backgroundX) / backgroundWidth,
			(elementOffset.top - backgroundY) / backgroundHeight
		]);
		this.renderProgram.uniforms.bottomRight = new Float32Array([
			this.renderProgram.uniforms.topLeft[0] + this.$el.innerWidth() / backgroundWidth,
			this.renderProgram.uniforms.topLeft[1] + this.$el.innerHeight() / backgroundHeight
		]);

		var maxSide = Math.max(this.canvas.width, this.canvas.height);

		this.renderProgram.uniforms.containerRatio = new Float32Array([
			this.canvas.width / maxSide,
			this.canvas.height / maxSide
		]);
	},

	initShaders: function() {
		var vertexShader = [
			'attribute vec2 vertex;',
			'varying vec2 coord;',
			'void main() {',
				'coord = vertex * 0.5 + 0.5;',
				'gl_Position = vec4(vertex, 0.0, 1.0);',
			'}'
		].join('\n');

		this.dropProgram = createProgram(vertexShader, [
			'precision highp float;',

			'const float PI = 3.141592653589793;',
			'uniform sampler2D texture;',
			'uniform vec2 center;',
			'uniform float radius;',
			'uniform float strength;',

			'varying vec2 coord;',

			'void main() {',
				'vec4 info = texture2D(texture, coord);',

				'float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);',
				'drop = pow(drop, 1.5);',
				'drop = 0.5 - cos(drop * PI) * 0.5;',

				'info.r += drop * strength;',

				'gl_FragColor = info;',
			'}'
		].join('\n'));

		this.updateProgram = createProgram(vertexShader, [
			'precision highp float;',

			'uniform sampler2D texture;',
			'uniform vec2 delta;',

			'varying vec2 coord;',

			'void main() {',
				'vec4 info = texture2D(texture, coord);',

				'vec2 dx = vec2(delta.x, 0.0);',
				'vec2 dy = vec2(0.0, delta.y);',

				'float average = (',
					'texture2D(texture, coord - dx).r +',
					'texture2D(texture, coord - dy).r +',
					'texture2D(texture, coord + dx).r +',
					'texture2D(texture, coord + dy).r',
				') * 0.25;',

				'info.g += (average - info.r) * 1.8;',
				'info.g *= 0.993;',  // Increased damping for faster die-off
				'info.r += info.g;',
				'info.r *= 0.97;',    // Reduce ripple height

				'gl_FragColor = info;',
			'}'
		].join('\n'));
		gl.uniform2fv(this.updateProgram.locations.delta, this.textureDelta);

		this.renderProgram = createProgram([
			'precision highp float;',

			'attribute vec2 vertex;',
			'uniform vec2 topLeft;',
			'uniform vec2 bottomRight;',
			'uniform vec2 containerRatio;',
			'varying vec2 ripplesCoord;',
			'varying vec2 backgroundCoord;',
			'void main() {',
				'backgroundCoord = mix(topLeft, bottomRight, vertex * 0.5 + 0.5);',
				'backgroundCoord.y = 1.0 - backgroundCoord.y;',
				'ripplesCoord = vec2(vertex.x, -vertex.y) * containerRatio * 0.5 + 0.5;',
				'gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);',
			'}'
		].join('\n'), [
			'precision highp float;',

			'uniform sampler2D samplerBackground;',
			'uniform sampler2D samplerRipples;',
			'uniform vec2 delta;',
			'uniform float perturbance;',
			'uniform float lightElevation;',
			'uniform float time;',
			'uniform vec2 u_mouse;',
			'uniform vec2 textureSize;',

			'varying vec2 ripplesCoord;',
			'varying vec2 backgroundCoord;',

			'const float PI = 3.141592653589793;',
			'const float BLUR_SIZE = 0.4;',

			// Modified noise function for larger grain
			'float rand(vec2 co) {',
				'return fract(sin(dot(co.xy * 0.7 ,vec2(12.9898,78.233))) * 43758.5453);',  // Reduced frequency for larger grain
			'}',

			'vec4 addFilmGrain(vec4 color, vec2 uv) {',
				'float noise = rand(uv + time * 0.1) * 0.20 - 0.075;',  // Increased noise range
				'vec3 grainColor = color.rgb + noise * 0.60;',  // Increased grain intensity
				'return vec4(grainColor, color.a);',
			'}',

			'vec4 blur13(sampler2D image, vec2 uv, vec2 resolution) {',
				'vec4 color = vec4(0.0);',
				'vec2 off1 = vec2(1.411764705882353) * BLUR_SIZE / resolution;',
				'vec2 off2 = vec2(3.2941176470588234) * BLUR_SIZE / resolution;',
				'vec2 off3 = vec2(5.176470588235294) * BLUR_SIZE / resolution;',
				
				'color += texture2D(image, uv) * 0.1964825501511404;',
				'color += texture2D(image, uv + off1) * 0.2969069646728344;',
				'color += texture2D(image, uv - off1) * 0.2969069646728344;',
				'color += texture2D(image, uv + off2) * 0.09447039785044732;',
				'color += texture2D(image, uv - off2) * 0.09447039785044732;',
				'color += texture2D(image, uv + off3) * 0.010381362401148057;',
				'color += texture2D(image, uv - off3) * 0.010381362401148057;',
				
				'return color;',
			'}',

			'vec3 getLightDir() {',
				'float elevationRad = lightElevation * 3.14159 / 180.0;',
				'return normalize(vec3(0.8, -2.4, tan(elevationRad)));',  // Moved to bottom right and increased intensity
			'}',

			'void main() {',
				// Sample ripple height map with smoothing
				'float height = texture2D(samplerRipples, ripplesCoord).r;',
				
				// Sample additional points for smoother normal calculation
				'float heightX1 = texture2D(samplerRipples, vec2(ripplesCoord.x + delta.x, ripplesCoord.y)).r;',
				'float heightX2 = texture2D(samplerRipples, vec2(ripplesCoord.x - delta.x, ripplesCoord.y)).r;',
				'float heightY1 = texture2D(samplerRipples, vec2(ripplesCoord.x, ripplesCoord.y + delta.y)).r;',
				'float heightY2 = texture2D(samplerRipples, vec2(ripplesCoord.x, ripplesCoord.y - delta.y)).r;',
				
				// Smoother gradient calculation using multiple samples
				'float gradX = ((heightX1 - height) + (height - heightX2)) * 0.5;',
				'float gradY = ((heightY1 - height) + (height - heightY2)) * 0.5;',
				
				// Calculate surface normal in 3D space with smoother transitions
				'vec3 dx = vec3(delta.x * 2.0, gradX * 0.8, 0.0);',
				'vec3 dy = vec3(0.0, gradY * 0.8, delta.y * 2.0);',
				'vec3 normal = normalize(cross(dx, dy));',
				
				// Sample base color first for luminance calculation
				'vec4 baseColor = texture2D(samplerBackground, backgroundCoord);',
				'float luminance = dot(baseColor.rgb, vec3(0.2126, 0.7152, 0.0722));',
				
				// Add mouse-based dynamic distortion with reduced influence
				'vec2 mouseOffset = (ripplesCoord - u_mouse) * 0.015;',
				'float mouseDistance = length(ripplesCoord - u_mouse);',
				'mouseOffset *= pow(max(0.0, 1.0 - mouseDistance * 3.0), 2.0);',
				
				// Blend mouse offset with our existing offset calculation
				'vec2 offset = -normal.xz * 0.7 * (1.0 - luminance * 0.3) + mouseOffset * 0.7;',  // Reduced luminance influence
				
				'vec3 lightDir = getLightDir();',
				'vec2 viewDir = normalize(vec2(-0.6, 1.0));',
				
				// Replace old specular with GGX microfacet BRDF
				'float roughness = 0.08;',  // Even sharper specular
				'vec3 halfwayDir = normalize(vec3(viewDir.x, 1.0, viewDir.y) + lightDir);',
				'float NdotH = max(dot(normal, halfwayDir), 0.0);',
				'float D = (roughness * roughness) / max(PI * pow(NdotH * NdotH * (roughness * roughness - 1.0) + 1.0, 2.0), 0.001);',
				'float specular = D * 0.85;',  // Increased specular intensity
				'vec3 specularColor = vec3(0.85, 0.95, 1.15) * specular;',
				
				// Stronger diffuse lighting
				'float diffuse = max(0.0, dot(normal, lightDir)) * 0.45;',  // Increased diffuse intensity
				'diffuse *= (1.0 - luminance * 0.2);',  // Even less attenuation for stronger effect
				
				// Apply perturbance after luminance calculation
				'vec2 blurCoord = backgroundCoord + offset * perturbance * 0.8;',
				'baseColor = blur13(samplerBackground, blurCoord, textureSize);',
				
				// Edge detection for SSR with improved contrast handling
				'float edgeX = abs(texture2D(samplerBackground, backgroundCoord + vec2(delta.x, 0.0)).r - ',
				'                  texture2D(samplerBackground, backgroundCoord - vec2(delta.x, 0.0)).r);',
				'float edgeY = abs(texture2D(samplerBackground, backgroundCoord + vec2(0.0, delta.y)).r - ',
				'                  texture2D(samplerBackground, backgroundCoord - vec2(0.0, delta.y)).r);',
				'float edge = (edgeX + edgeY) * 0.35;',
				
				// Calculate base color brightness for adaptive reflection
				'float brightness = max(max(baseColor.r, baseColor.g), baseColor.b);',
				'float adaptiveReflectionStrength = 0.05 * (brightness * 0.7) * (1.0 - edge * 1.8);',  // Reduced from 0.12 to 0.05
				
				// Calculate reflection vector with adaptive strength
				'vec2 reflectionVec = reflect(normalize(vec2(offset.x, -offset.y)), normalize(normal.xz));',
				'vec2 ssrOffset = reflectionVec * adaptiveReflectionStrength + offset * 0.008;',
				
				// Progressive sampling for reflections with improved edge preservation
				'vec2 reflectionCoord = backgroundCoord;',
				'vec4 reflectedColor = vec4(0.0);',
				'float sampleWeight = 1.0;',
				'float totalWeight = 0.0;',
				
				// Multi-step sampling with distance and edge attenuation
				'for(int i = 0; i < 4; i++) {',
				'    reflectionCoord += ssrOffset * (float(i) * 0.2 + 0.2);',
				'    float edgePreserve = smoothstep(0.0, 0.01, reflectionCoord.x) * ',
				'                         smoothstep(1.0, 0.99, reflectionCoord.x) * ',
				'                         smoothstep(0.0, 0.01, reflectionCoord.y) * ',
				'                         smoothstep(1.0, 0.99, reflectionCoord.y);',
				'    if(edgePreserve <= 0.0) break;',
				'    vec4 sampledColor = texture2D(samplerBackground, reflectionCoord);',
				'    float sampleBrightness = max(max(sampledColor.r, sampledColor.g), sampledColor.b);',
				'    sampleWeight = (sampleBrightness * 0.4 + (1.0 - float(i) * 0.15)) * edgePreserve;',
				'    sampleWeight = max(0.0, sampleWeight);',
				'    reflectedColor += sampledColor * sampleWeight;',
				'    totalWeight += sampleWeight;',
				'}',
				'reflectedColor = totalWeight > 0.0 ? reflectedColor / totalWeight : baseColor;',
				
				// Edge-aware reflection blending with enhanced contrast
				'float edgeFade = smoothstep(0.0, 0.01, backgroundCoord.x) * ',
				'                 smoothstep(1.0, 0.99, backgroundCoord.x) * ',
				'                 smoothstep(0.0, 0.01, backgroundCoord.y) * ',
				'                 smoothstep(1.0, 0.99, backgroundCoord.y);',
				'reflectedColor = mix(baseColor, reflectedColor, edgeFade);',
				
				// Enhanced Fresnel calculation with brightness adaptation
				'float fresnel = pow(1.0 - max(0.0, dot(offset, viewDir)), 50.0);',  // Adjusted power for poppier fresnel
				'float fresnelIntensity = clamp(fresnel * 0.35 * (brightness * 0.5) * (1.0 - edge), 0.02, 0.55);',  // Increased intensity
				
				// Add time-based iridescent thin-film interference
				'float timeShift = time * 0.2;',  // Slowed down the shift speed for subtlety
				'vec3 interferenceColor = vec3(',
				'    sin(2.0 * fresnel * PI + 1.0 + timeShift),',
				'    sin(2.0 * fresnel * PI + 2.0 + timeShift),',
				'    sin(2.0 * fresnel * PI + 4.0 + timeShift)',  // Keep our adjusted phase
				') * 0.05;',  // Keeping the subtle intensity
				
				// Blend interference into reflections with edge and brightness awareness
				'reflectedColor.rgb += interferenceColor * (1.0 - brightness * 0.7) * edgeFade;',
				
				// Add cool tint to reflections
				'reflectedColor.rgb *= vec3(0.9, 0.95, 1.1);',  // Cooler reflection tint
				
				// Final color composition with enhanced reflection clarity
				'vec4 finalColor = mix(baseColor, reflectedColor, fresnelIntensity * edgeFade * 1.0);',  // Increased blend factor
				'finalColor.rgb = mix(finalColor.rgb, finalColor.rgb * (1.0 + diffuse), 0.8);',
				'finalColor.rgb += specularColor * (1.0 - brightness * 0.25) * edgeFade;',  // Reduced brightness attenuation
				'finalColor.rgb = clamp(finalColor.rgb, 0.0, 1.0);',
				'finalColor.a = 1.0;',
				
				// Only add grain, remove sepia
				'finalColor = addFilmGrain(finalColor, gl_FragCoord.xy / textureSize);',
				
				'gl_FragColor = finalColor;',
			'}'
		].join('\n'));
		gl.uniform2fv(this.renderProgram.locations.delta, this.textureDelta);
		gl.uniform1f(this.renderProgram.locations.lightElevation, 65.0);
	},

	initTexture: function() {
		this.backgroundTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	},

	setTransparentTexture: function() {
		gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, transparentPixels);
	},

	hideCssBackground: function() {

		// Check whether we're changing inline CSS or overriding a global CSS rule.
		var inlineCss = this.$el[0].style.backgroundImage;

		if (inlineCss == 'none') {
			return;
		}

		this.originalInlineCss = inlineCss;

		this.originalCssBackgroundImage = this.$el.css('backgroundImage');
		this.$el.css('backgroundImage', 'none');
	},

	restoreCssBackground: function() {

		// Restore background by either changing the inline CSS rule to what it was, or
		// simply remove the inline CSS rule if it never was inlined.
		this.$el.css('backgroundImage', this.originalInlineCss || '');
	},

	dropAtPointer: function(pointer, radius, strength) {
		var borderOffset = {
			left: parseInt(this.$el.css('border-left-width')) || 0,
			top: parseInt(this.$el.css('border-top-width')) || 0
		};

		this.drop(
			pointer.pageX - this.$el.offset().left - borderOffset.left,
			pointer.pageY - this.$el.offset().top - borderOffset.top,
			radius,
			strength
		);
	},

	/**
	 *  Public methods
	 */
	drop: function(x, y, radius, strength) {
		gl = this.context;

		var elWidth = this.$el.innerWidth();
		var elHeight = this.$el.innerHeight();
		var longestSide = Math.max(elWidth, elHeight);

		var dropPosition = new Float32Array([
			(2 * x - elWidth) / longestSide,
			(elHeight - 2 * y) / longestSide
		]);

		gl.viewport(0, 0, this.resolution, this.resolution);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.bufferWriteIndex]);
		bindTexture(this.textures[this.bufferReadIndex]);
		gl.useProgram(this.dropProgram.id);

		gl.uniform2fv(this.dropProgram.locations.center, dropPosition);
		gl.uniform1f(this.dropProgram.locations.radius, radius / longestSide);
		gl.uniform1f(this.dropProgram.locations.strength, strength);

		this.drawQuad();
		this.swapBufferIndices();
	},

	updateSize: function() {
		var newWidth = this.$el.innerWidth(),
				newHeight = this.$el.innerHeight();

		if (newWidth != this.canvas.width || newHeight != this.canvas.height) {
			this.canvas.width = newWidth;
			this.canvas.height = newHeight;
		}
	},

	destroy: function() {
		this.stopRain();  // Clean up rain interval
		this.$el
			.off('.ripples')
			.removeClass('jquery-ripples')
			.removeData('ripples')
			.css('position', '');

		this.$wrapper.remove();  // Remove wrapper
		gl = null;

		$(window).off('resize', this.updateSize);

		this.$canvas.remove();
		this.restoreCssBackground();

		this.destroyed = true;
	},

	show: function() {
		this.visible = true;

		this.$canvas.show();
		this.hideCssBackground();
	},

	hide: function() {
		this.visible = false;

		this.$canvas.hide();
		this.restoreCssBackground();
	},

	pause: function() {
		this.running = false;
	},

	play: function() {
		this.running = true;
	},

	set: function(property, value) {
		switch (property) {
			case 'dropRadius':
			case 'perturbance':
			case 'interactive':
			case 'crossOrigin':
				this[property] = value;
				break;
			case 'imageUrl':
				this.imageUrl = value;
				this.loadImage();
				break;
		}
	},

	startRain: function() {
		if (this.isRaining) return;
		
		var that = this;
		this.isRaining = true;
		
		this.rainInterval = setInterval(function() {
			var x = Math.random() * that.$el.innerWidth();
			var y = Math.random() * that.$el.innerHeight();
			that.drop(x, y, that.dropRadius * 0.4, 0.008);
		}, 300);
	},

	stopRain: function() {
		this.isRaining = false;
		if (this.rainInterval) {
			clearInterval(this.rainInterval);
			this.rainInterval = null;
		}
	}
};

// RIPPLES PLUGIN DEFINITION
// ==========================

var old = $.fn.ripples;

$.fn.ripples = function(option) {
	if (!config) {
		throw new Error('Your browser does not support WebGL, the OES_texture_float extension or rendering to floating point textures.');
	}

	var args = (arguments.length > 1) ? Array.prototype.slice.call(arguments, 1) : undefined;

	return this.each(function() {
		var $this = $(this),
				data = $this.data('ripples'),
				options = $.extend({}, Ripples.DEFAULTS, $this.data(), typeof option == 'object' && option);

		if (!data && typeof option == 'string') {
			return;
		}
		if (!data) {
			$this.data('ripples', (data = new Ripples(this, options)));
		}
		else if (typeof option == 'string') {
			Ripples.prototype[option].apply(data, args);
		}
	});
};

$.fn.ripples.Constructor = Ripples;


// RIPPLES NO CONFLICT
// ====================

$.fn.ripples.noConflict = function() {
	$.fn.ripples = old;
	return this;
};

})));
