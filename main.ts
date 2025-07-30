// Import WebGPU types (they're automatically available when @webgpu/types is installed)
// No explicit import needed - types are globally available

// Make this file a module
export {};

const WORKGROUP_SIZE: number = 8;
const GRID_SIZE: number = 32;
const UPDATE_INTERVAL: number = 1000; // Update every 200ms (5 times/sec)
let step = 0; // Track how many simulation steps have been run


const canvas: HTMLCanvasElement = document.querySelector('canvas')!;

if (!navigator.gpu) {
    throw new Error('WebGPU not supported on this browser.');
    // Ideally, it would be interesting to inform the user if WebGPU is unavailable by having the page fall back to a mode
    // that doesn't use WebGPU. It could use WebGL instead, for example.
}

// Most of the time it's OK to simply let the browser pick a default adapter, as it's done just down here, but for more adavanced needs
// there are arguments that can be passed to requestAdapter() that specify whether you want to use low-power or high-performance hardware
// on devices with multiple GPUs.
const adapter: GPUAdapter | null = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error('No appropiate GPUAdapter found.');
    // It might happen if user's browser supports WebGPU but their GPU hardware doesn't have all features necessary to use WebGPU.
}

const device: GPUDevice = await adapter.requestDevice();

const context: GPUCanvasContext = canvas.getContext('webgpu')!;
const format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device,
    format
});

const simulatorShader = await fetch('./shaders/simulator.wgsl');
let simulatorShaderCode = await simulatorShader.text();
simulatorShaderCode = simulatorShaderCode.replaceAll('${WORKGROUP_SIZE}', WORKGROUP_SIZE.toString());
const simulatorShaderModule = device.createShaderModule({
    label: 'Game of Life simulator shader',
    code: simulatorShaderCode
});

const vertices: Float32Array = new Float32Array([
    // X, Y
    // Triangle 1
    -0.8, -0.8, // corner 1
    0.8, -0.8, // corner 2
    0.8, 0.8, // corner 3
    // Triangle 2
    -0.8, -0.8, // corner 1
    0.8, 0.8, // corner 2
    -0.8, 0.8 // corner 4
]);
// Note: There's something called Index Buffers, which you can feed with a separate list of values to the GPU 
// that tells it what vertices to connect together into triangles so that they don't need to be duplicated.

// Create storage buffer to store cells state.
const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);
const cellStateStorage = [
    device.createBuffer({
        label: 'Cell State A',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    }),
    device.createBuffer({
        label: 'Cell State B',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
];
// Set each cell with a random state (40% chances to end active, 60% inactive)
for (let i = 0; i < cellStateArray.length; i += 3) {
    cellStateArray[i] = Math.random() > 0.6 ? 1 : 0;
}
device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);
// Mark every other cell of the second grid as active
for (let i = 0; i < cellStateArray.length; i++) {
    cellStateArray[i] = i % 2;
}
device.queue.writeBuffer(cellStateStorage[1], 0, cellStateArray);

// A uniform is a value from a buffer that is the same for every invocation.
// They're useful for communicating values that are common for a piece of geometry (like its position).
const uniformArray: Float32Array = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = device.createBuffer({
    label: 'Grid Uniforms',
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});
// Copy uniform buffer into the buffer's memory
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

// GPUs frequently have their own memory that is highly optimized for rendering, and so any data you want GPU
// to use while it draws needs to be placed in that memory.
const vertexBuffer = device.createBuffer({
    label: 'Cell vertices',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
});
// Copy the vertex buffer into the buffer's memory
device.queue.writeBuffer(vertexBuffer, 0, vertices);

const vertexBufferLayout: GPUVertexBufferLayout= {
    arrayStride: 8,
    attributes: [{
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0
    }]
};
// arrayStride: This refers to the number of bytes the GPU needs to skip forward in the buffer when it's looking for the next vertex.
//              In our case, each vertex of your squeare is made up of two 32-bit floating numbers (32 bits = 4 bytes, 2x32 bits = 8 bytes).
// attributes: They're individual pieces of information encoded into each vertex. In our case, the vertices only contain one attribute (the vertex position).
// attributes.0.format: This comes from a list of GPUVertexFormat.
// attributes.0.offset: It describes how many bytes into the vertex this particular attribute starts. You only have yo worry about this
//                  if your buffer has more than one attribute in it.
// attributes.0.shaderLocation: This is an arbitrary number between 0 and 15 and must be unique for every attribute that you define.
const shader = await fetch('./shaders/cell.wgsl');
const shaderCode = await shader.text();
const cellShaderModule = device.createShaderModule({
    label: 'Cell shader',
    code: shaderCode
});

const bindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout({
    label: 'Cell Bind Group Layout',
    entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
        buffer: {} // Grid uniform buffer, default type is 'uniform'
    }, {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' } // Cell state input buffer
    }, {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' } // Cell state output buffer
    }]
});

const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({
    label: 'Cell Pipeline Layout',
    bindGroupLayouts: [ bindGroupLayout ]
});

const cellPipeline = device.createRenderPipeline({
  label: "Cell pipeline",
  layout: pipelineLayout,
  vertex: {
    module: cellShaderModule,
    entryPoint: "vertexMain",
    buffers: [vertexBufferLayout]
  },
  fragment: {
    module: cellShaderModule,
    entryPoint: "fragmentMain",
    targets: [{
      format: format
    }]
  }
});

const simulationPipeline = device.createComputePipeline({
    label: 'Simulation pipeline',
    layout: pipelineLayout,
    compute: {
        module: simulatorShaderModule,
        entryPoint: 'computeMain'
    }
});

const bindGroups = [
    device.createBindGroup({
        label: 'Cell renderer bind group A',
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: { buffer: uniformBuffer }
            },
            {
                binding: 1,
                resource: { buffer: cellStateStorage[0] }
            },
            {
                binding: 2,
                resource: { buffer: cellStateStorage[1] }
            }
        ]
    }),
    device.createBindGroup({
        label: 'Cell renderer bind group B',
        layout: cellPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: uniformBuffer }
            },
            {
                binding: 1,
                resource: { buffer: cellStateStorage[1] }
            },
            {
                binding: 2,
                resource: { buffer: cellStateStorage[0] }
            }
        ]
    })
];

function updateGrid(): void {
    // The commands you want to send to the GPU are related to rendering, so the next step is to use the
    // encoder to begin a Render Pass (it's when all drawing operations in WebGPU happen).
    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(simulationPipeline);
    computePass.setBindGroup(0, bindGroups[step % 2]);

    // If you want the shader to execute 32x32 times in order to cover your entire grid,
    // and your workgroup size is 8x8, you need to dispatch 4x4 workgroups (4*8=32).
    // That's why you divide the grid size by the workgroup size and pass that value into
    // dispatchWorkgroups().
    const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCount, workgroupCount);
    computePass.end();

    step++;

    const pass: GPURenderPassEncoder = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0.4, a: 1 }
        }]
    });

    pass.setPipeline(cellPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroups[step % 2]);
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices
    pass.end();

    // Schedule GPU commands to be executed in order and well-synchronized.
    device.queue.submit([encoder.finish()]);
}

setInterval(updateGrid, UPDATE_INTERVAL);

