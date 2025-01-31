# Enhanced jQuery Ripples

A modernized and improved version of the original [jQuery Ripples Plugin](https://github.com/sirxemic/jquery.ripples) by [Sirxemic](https://sirxemic.com/). This project brings realistic, interactive water ripple effects to any element using WebGL, while incorporating advanced shader techniques and performance optimizations. 

Inspired by the amazing [gentlerain.ai](https://gentlerain.ai) site.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration Options](#configuration-options)
- [Shader Improvements](#shader-improvements)
- [Performance Optimizations](#performance-optimizations)
- [Browser Compatibility](#browser-compatibility)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Overview

The jQuery Ripples Plugin enhances the visual aesthetics of websites by simulating realistic water ripple effects on elements using WebGL. This implementation extends the original plugin by introducing enhanced shading techniques, dynamic reflection mapping, and improved physics-based interactions.

## Features

### **New Enhancements:**
✅ **Advanced Screen Space Reflections (SSR)** - Ripples now reflect underlying content more realistically.
✅ **Physically-Based Specular Highlights** - Added GGX microfacet BRDF for sharper and more physically accurate reflections.
✅ **Dynamic Light Direction** - Light sources are now adjustable, providing more immersive shading effects.
✅ **Improved Mouse Interaction** - Ripples dynamically respond to cursor movement and pressure.
✅ **Enhanced Iridescent Film Effect** - Subtle chromatic shifts add realism to thin-film interference.
✅ **Optimized Noise and Grain** - Introduced procedural noise functions to simulate water texture irregularities.
✅ **Smoother Surface Normals** - Normal calculations now use multiple samples for more fluid reflections.
✅ **Refined Edge Detection** - Prevents unnatural distortion at ripple boundaries.
✅ **Performance Optimizations** - Optimized framebuffer switching and shader computations for smoother animations.

### **Core Features (Retained from Original Plugin):**
✅ **Pure WebGL Implementation** - No dependencies on Canvas 2D rendering.
✅ **Interactive Mouse & Touch Effects** - Create ripples on click, hover, or touch.
✅ **Auto Rain Mode** - Generates random water drops dynamically.
✅ **Customizable Water Physics** - Configure drop radius, perturbance, and more.
✅ **Supports Background Images** - Works seamlessly over images and background textures.

## Installation

Include the script in your project via CDN or manually:

```html
<script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>
<script src="path/to/jquery.ripples.js"></script>
```

Alternatively, install via npm:

```sh
npm install jquery-ripples
```

## Usage

Initialize the plugin on any element:

```js
$(document).ready(function() {
    $('body').ripples({
        resolution: 512,
        dropRadius: 30,
        perturbance: 0.1,
        interactive: true
    });
});
```

## Configuration Options

| Option         | Type    | Default | Description |
|---------------|--------|---------|-------------|
| `resolution`  | Number | `512`   | Defines the resolution of the ripple simulation. Higher values result in smoother ripples but require more processing power. |
| `dropRadius`  | Number | `35`    | Radius of the ripples created by interactions (in pixels). |
| `perturbance` | Number | `0.7`   | Amount of distortion applied to the background texture. Lower values produce subtler ripples. |
| `interactive` | Boolean | `true`  | Enables or disables user interactions with the ripples. |
| `imageUrl`    | String | `null`  | Optionally set a background image for the ripple effect. |
| `crossOrigin` | String | `""`    | Cross-origin attribute for image loading. |

## Shader Improvements

This implementation pushes WebGL to its limits by introducing several enhancements over the original fragment and vertex shaders.

### **Original Shader Functionality:**
The base implementation handled basic water refraction using:
- Simple normal mapping for wave simulation.
- Basic height map propagation.
- Naïve reflection approximation with static offsets.

### **Enhancements in This Version:**
✅ **Screen Space Reflections (SSR):**
- Implemented iterative sampling for physically accurate reflections.
- Adjusts reflection based on surface curvature and brightness.
- Dynamically adapts to underlying content for realistic rippling.

✅ **Physically Based Rendering (PBR) Techniques:**
- Implemented GGX microfacet BRDF for specular highlights.
- Dynamic light calculations for realistic reflections.
- Enhanced Fresnel calculations for realistic water reflectivity.

✅ **Improved Normal Calculation:**
- More samples are taken for precise water surface shading.
- Smoother transitions between wave peaks and troughs.
- Reduced visual artifacts at high perturbance values.

✅ **Adaptive Luminance-Based Reflections:**
- Brighter areas of the background contribute more to reflections.
- Shadows and dark regions appear more diffuse, simulating real water behavior.

✅ **Iridescent Film Effect:**
- Uses procedural noise and thin-film interference calculations.
- Dynamically shifts colors based on viewing angles and time.

✅ **Edge Detection & Reflection Preservation:**
- Prevents excessive distortion at ripple boundaries.
- Adjusts reflection contribution based on depth changes.

## Performance Optimizations

This version ensures that the plugin remains highly performant across devices by:
- Using optimized framebuffer switching for efficient rendering.
- Reducing overdraw and unnecessary recalculations per frame.
- Implementing LOD (Level of Detail) scaling to balance quality and performance.
- Efficiently handling multiple ripple sources simultaneously.

## Browser Compatibility

| Browser  | Supported |
|----------|-----------|
| Chrome   | ✅ Yes |
| Firefox  | ✅ Yes |
| Safari   | ✅ Yes |
| Edge     | ✅ Yes |
| Opera    | ✅ Yes |
| IE 11    | ❌ No  |

## Acknowledgments

This project is based on the incredible work of [Sirxemic](https://github.com/sirxemic/jquery.ripples).

Significant improvements have been made in shading, physics, and interactivity to enhance realism and performance.

## License

This project is licensed under the **MIT License**.

Feel free to contribute, improve, or customize this plugin for your projects!

