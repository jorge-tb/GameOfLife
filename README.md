# WebGPU Game of Life

A high-performance implementation of Conway's Game of Life using WebGPU for GPU-accelerated computation and rendering.

## Overview

This project demonstrates the power of WebGPU by implementing Conway's Game of Life entirely on the GPU. The simulation uses compute shaders for game logic and vertex/fragment shaders for rendering, providing smooth real-time visualization of cellular automata.

## Features

- **GPU-Accelerated**: Both simulation and rendering run on the GPU using WebGPU
- **Real-time Visualization**: Smooth animation with configurable update intervals
- **Efficient Memory Management**: Double-buffered cell state storage for optimal performance
- **Configurable Grid**: Easy to modify grid size and workgroup dimensions
- **Modern Web Standards**: Built with TypeScript and modern WebGPU APIs

## Prerequisites

- A modern web browser with WebGPU support (Chrome 113+, Edge 113+, or Firefox with experimental features enabled)
- Node.js (for development dependencies)

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd webgpu-game-of-life
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:3000` (or the port shown in terminal)

## Project Structure

```
├── main.ts          # Main application logic and WebGPU setup
├── main.js          # Compiled JavaScript output
├── cell.wgsl        # Vertex and fragment shaders for rendering
├── simulator.wgsl   # Compute shader for Game of Life simulation
├── index.html       # HTML entry point
├── package.json     # Project dependencies and scripts
├── tsconfig.json    # TypeScript configuration
└── .gitignore       # Git ignore rules
```

## Technical Details

### Architecture

The application uses a double-buffered approach where:
- **Buffer A** contains the current cell state
- **Buffer B** stores the computed next state
- Buffers alternate each frame for efficient GPU memory management

### Shaders

- **[cell.wgsl](cell.wgsl)**: Handles vertex positioning and fragment coloring for cell visualization
- **[simulator.wgsl](simulator.wgsl)**: Implements Conway's Game of Life rules using compute shaders

### Configuration

Key constants in [main.ts](main.ts):
- `GRID_SIZE`: Dimensions of the cellular automata grid (32x32)
- `WORKGROUP_SIZE`: GPU workgroup size for compute shaders (8x8)
- `UPDATE_INTERVAL`: Animation speed in milliseconds (1000ms = 1 second)

## Conway's Game of Life Rules

The simulation follows the classic rules:
1. **Survival**: Live cells with 2 or 3 neighbors survive
2. **Birth**: Dead cells with exactly 3 neighbors become alive  
3. **Death**: All other cells die or remain dead

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 113+    | ✅ Full Support |
| Edge    | 113+    | ✅ Full Support |
| Firefox | 110+    | ⚠️ Experimental |
| Safari  | 18+     | ⚠️ Limited Support |

## Development

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Start development server

### Modifying the Simulation

To change grid size or update speed, modify the constants at the top of [main.ts](main.ts):

```typescript
const WORKGROUP_SIZE: number = 8;    // GPU workgroup dimensions
const GRID_SIZE: number = 32;        // Grid size (32x32 cells)
const UPDATE_INTERVAL: number = 200; // Update every 200ms
```

## Performance

The GPU implementation provides significant performance benefits:
- Parallel computation of all cells simultaneously
- Efficient memory bandwidth utilization
- Smooth 60fps rendering for grids up to 512x512 cells

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## WebGPU Resources

- [WebGPU Specification](https://gpuweb.github.io/gpuweb/)
- [WebGPU Samples](https://webgpu.github.io/webgpu-samples/)
- [MDN WebGPU Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.