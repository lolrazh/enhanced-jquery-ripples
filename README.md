# jQuery Ripples - Enhanced Edition 🌊✨

A massively improved, visually stunning WebGL-powered water ripple effect for jQuery, pushing the boundaries of real-time shader magic. Originally based on [sirxemic's jQuery Ripples](https://github.com/sirxemic/jquery.ripples), this version takes things to a whole new level with:

- **Screen Space Reflections (SSR)** for true dynamic reflections
- **Iridescent thin-film interference** (yes, real-time oil-slick shimmer!)
- **Physically based lighting** using GGX microfacet shading
- **Adaptive Fresnel effects** that pop based on viewing angles
- **Mouse-based dynamic distortion** for a more interactive feel
- **Improved damping & decay for ultra-smooth ripples**
- **Real-time film grain for cinematic texture**

## 🚀 Demo
_coming soon_

## 🎨 Features Breakdown

### 🌊 Original Shader vs. Our Upgrades

#### What the Original Shader Did:
- Created a simple WebGL-based ripple simulation.
- Used a heightmap to distort the background texture.
- Basic reflection simulation by offsetting UV coordinates.
- Simple perturbance effect to make ripples look wavy.

#### What We Improved On (Flex Mode On 🔥):
✅ **Screen Space Reflections (SSR):**
- Instead of a simple UV distortion, we now **calculate reflection vectors** dynamically.
- Multi-step **ray marching** ensures reflections adapt naturally to the rippling surface.
- Edge-aware blending prevents artifacts at screen borders.

✅ **Physically Based Lighting (PBR) with GGX Microfacet Shading:**
- Replaced old-school specular with **physically accurate light scattering**.
- **GGX Distribution Function** sharpens specular highlights while maintaining realism.
- **Adaptive roughness** ensures sharper reflections near ripple peaks.

✅ **Iridescent Thin-Film Interference (Real-time Rainbow Effects! 🌈):**
- Uses **Fresnel equations** to simulate light interaction on thin layers (like oil on water).
- Time-dependent shifts in hue create **animated color effects.**
- Dynamically **reacts to ripple intensity & surface normals.**

✅ **Mouse-Based Dynamic Distortion:**
- Instead of just creating ripples, the shader **warps reflections dynamically** based on the cursor position.
- Stronger distortion when the mouse is closer, fades naturally over time.

✅ **Improved Damping & Decay:**
- The original ripples decayed too fast or too slow depending on settings.
- We fine-tuned the damping function for **ultra-smooth natural wave dissipation.**

✅ **Real-Time Film Grain:**
- **Procedural noise shader** adds subtle grain to the entire effect.
- Enhances realism, especially in darker backgrounds.
- Tweaks grain pattern dynamically based on elapsed time.

## 🛠️ Installation

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
<script src="jquery.ripples.js"></script>
```

## 🚀 Usage

```javascript
$(document).ready(function() {
    $('body').ripples({
        resolution: 512,
        dropRadius: 35, // Smaller = more detailed ripples
        perturbance: 0.12, // Adjusts ripple intensity
        interactive: true, // Enables cursor-based distortions
        crossOrigin: ''
    });
});
```

## 🎛️ Configuration Options
| Option        | Default  | Description |
|--------------|---------|-------------|
| `resolution` | `512` | The resolution of the simulation grid. Higher = more details but more GPU usage. |
| `dropRadius` | `35` | The size of ripple drops in pixels. |
| `perturbance` | `0.12` | The intensity of background distortion. |
| `interactive` | `true` | Enables or disables cursor-based ripple creation. |
| `crossOrigin` | `''` | Handles CORS for external images. |

## 💡 Behind the Scenes - How It Works

### 1️⃣ **Texture-Based Simulation**
- A floating-point framebuffer stores the **ripple heightmap**.
- Every frame, we apply a **wave propagation function** to the texture.
- The heightmap is then used to distort the background texture.

### 2️⃣ **Dynamic Reflection Calculation (SSR)**
- Instead of static UV distortion, we calculate reflection vectors **based on surface normals.**
- Multi-step raymarching samples the background texture at calculated reflection points.

### 3️⃣ **Iridescent Shader Magic**
- We simulate thin-film interference using **sinusoidal color shifts**.
- Fresnel equations determine the **intensity of reflections** at different angles.
- A time-based offset makes the colors shift dynamically for extra realism.

## 🤝 Credits
- Original concept by [sirxemic](https://github.com/sirxemic/jquery.ripples)
- Shader modifications & improvements by **you** ✨
- Inspired by research in **water rendering & physically based reflections.**

## ⚡ Contributing
PRs are welcome! If you have ideas for even crazier shader effects, let's push WebGL to its limits together.

## 📜 License
MIT License. Use it, modify it, flex it. 🚀

