import triangleVertex from "./shaders/shadowMap.vert.wgsl?raw";
import triangleFrag from "./shaders/shadowMap.frag.wgsl?raw";
import shadowDepth from './shaders/shadowDepth.wgsl?raw';
import * as sphere from "./util/sphere";
import * as box from "./util/box";
import { getModelViewMatrix, getProjectionMatrix } from "./util/math";
import { mat4, vec3 } from "gl-matrix";

const intanceCount = 30; // 几何体数量

async function initWebGPU1(canvas: HTMLCanvasElement) {
	console.log("navigator", navigator);
	if (!navigator.gpu) throw new Error();
	const adapter = await navigator.gpu.requestAdapter({
		powerPreference: "high-performance", // 设置gpu是运行在高电量模式还是低电量模式  期望选项  具体还要看浏览器的具体实际操作
	}); // 相当于浏览器对webGPU的一种具体的实现抽象，可以读取当前浏览器对webGPU实现了哪些功能和参数，不能直接用它来绘制和计算图形
	adapter?.features.forEach((v) => {
		console.log("v", v); // 浏览器对webGPU的一些扩展功能
	});
	if (!adapter) throw new Error();
	const device = await adapter.requestDevice({
		requiredFeatures: ["texture-compression-bc"], // 获取adapter重点额一些扩展功能和参数
		requiredLimits: {
			maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
		},
	}); // webGPU在浏览器的逻辑对象 用于绘图

	const context = canvas.getContext("webgpu");
	if (!context) throw new Error();
	// const format = context.getPreferredFormat(adapter);
	const format = navigator.gpu.getPreferredCanvasFormat();
	canvas.width = canvas.clientWidth * window.devicePixelRatio;
	canvas.height = canvas.clientHeight * window.devicePixelRatio;
	const size = {
		width: canvas.width,
		height: canvas.height,
	};
	context.configure({
		device,
		format,
		//prevent chrome warning after v102
		alphaMode: "opaque",
		// size,
	});
	return { adapter, device, format, context, size };
}

async function initPipeline(
	device: GPUDevice,
	format: GPUTextureFormat,
	size: { width: number; height: number }
) {
	

	const boxBuffer = {
		vertex: device.createBuffer({
			label: "boxGPUBuffer store vertex",
			size: box.vertex.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		}),
		index: device.createBuffer({
			label: "boxGPUBuffer store vertex index",
			size: box.index.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		}),
	};

	const sphereBuffer = {
		vertex: device.createBuffer({
			label: "sphereGPUBuffer store vertex",
			size: sphere.vertex.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		}),
		index: device.createBuffer({
			label: "sphereGPUBuffer store vertex index",
			size: sphere.index.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		}),
	};

	device.queue.writeBuffer(boxBuffer.vertex, 0, box.vertex);
	device.queue.writeBuffer(boxBuffer.index, 0, box.index);
	device.queue.writeBuffer(sphereBuffer.vertex, 0, sphere.vertex);
	device.queue.writeBuffer(sphereBuffer.index, 0, sphere.index);

	const vertexShader = device.createShaderModule({
		code: triangleVertex,
	});
	const fragShader = device.createShaderModule({
		code: triangleFrag,
	});
	// const vertexObj = {
	// 	vertex,
	// 	vertexBuffer,
	// 	vertexCount,
	// };

	const vertexBuffers:Array<GPUVertexBufferLayout> = [{
		arrayStride: 8 * 4, // 3 position 2 uv,
		attributes: [
				{
						// position
						shaderLocation: 0,
						offset: 0,
						format: 'float32x3',
				},
				{
						// normal
						shaderLocation: 1,
						offset: 3 * 4,
						format: 'float32x3',
				},
				{
						// uv
						shaderLocation: 2,
						offset: 6 * 4,
						format: 'float32x2',
				},
		]
}];


const shadowDepthTexture = device.createTexture({
	size:[2048,2048],
	usage:GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	format:'depth32float'
});

const renderDepthTexture = device.createTexture({
	size,
	format:'depth32float',
	usage:GPUTextureUsage.RENDER_ATTACHMENT
});
const shadowDepthView = shadowDepthTexture.createView()
const renderDepthView = renderDepthTexture.createView()



	const shadowPipeline = await device.createRenderPipelineAsync({
		label:'shadow pipeline',
		layout:'auto',
		vertex:{
			module:device.createShaderModule({
				code:shadowDepth
			}),
			entryPoint:'main',
			buffers:vertexBuffers
		},
		primitive: {
			// point-list 每一个点都单做独立的点输出
			// line-list 每两个点组成一条线输出
			// line-strip 12 23 34的组合方式输出线
			// triangle-strip 共用定点输出三角形 4个定点组成一个正方形
			// trangle-list 不共用定点输出三角形 6个定点组成一个正方形
			topology: "triangle-list",
			cullMode: "back", //面剔除
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less",
			format: "depth32float", // 深度存储的精度 24位深度贴图  深度贴图的数据格式
		},
	});

	const renderPipeline = await device.createRenderPipelineAsync({
		label: "dynamicPipeline",
		// layout: dynamicPipelineLayout,
		layout: "auto",
		// 这里整体标识传入的vertex buffer是以每12个字节划分为一个定点数据传入shader，每个节点中从0（shaderLocation）开始
		// 3个flaot32的数字作为一个参数传入shader@location(0)这个位置
		vertex: {
			module: vertexShader,
			entryPoint: "main",
			buffers: vertexBuffers // 标识pipeline可以传入几个定点数据  目前支持一个pipeline最多传入8个定点数据
		},
		fragment: {
			module: fragShader,
			entryPoint: "main", // 入口函数
			targets: [
				{
					format, //告诉webgpushader使用的是哪种颜色格式
				},
			],
		},
		primitive: {
			// point-list 每一个点都单做独立的点输出
			// line-list 每两个点组成一条线输出
			// line-strip 12 23 34的组合方式输出线
			// triangle-strip 共用定点输出三角形 4个定点组成一个正方形
			// trangle-list 不共用定点输出三角形 6个定点组成一个正方形
			topology: "triangle-list",
			cullMode: "back", //面剔除
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less",
			format: 'depth32float', // 深度存储的精度 24位深度贴图  深度贴图的数据格式
		},
	});

	const modelViewBuffer = device.createBuffer({
		label: "modelViewGPUBuffer store 4*4*4 matrix1",
		size: 4 * 4 * 4 * intanceCount, // 按照4*4*4紧密排列
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, //改成storage
	});
	const projectionBuffer = device.createBuffer({
		label: "modelViewGPUBuffer store 4*4*4 matrix1",
		size: 4 * 4 * 4, // 按照4*4*4紧密排列
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, //改成storage
	});

	const colorBuffer = device.createBuffer({
		label: "colorGPUBuffer store 4*4*4 matrix1",
		size: 4 * 4 * intanceCount, // 按照4*4*4紧密排列
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, //改成storage
	});

	const lightProjectionBuffer = device.createBuffer({
		label: 'GPUBuffer for light projection',
		size: 4 * 4 * 4, // 4 x 4 x float32
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});
	const lightBuffer = device.createBuffer({
		label:'lightPosition GPUBuffer',
		size:4*4*4,
		usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
	});

	// webgpu中最多一个group最多绑定8个资源
	const renderVSGroup = device.createBindGroup({
		label: "Uniform Group with matrix1",
		layout:renderPipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
						buffer: modelViewBuffer
				}
		},
		{
				binding: 1,
				resource: {
						buffer: projectionBuffer
				}
		},
		{
				binding: 2,
				resource: {
						buffer: lightProjectionBuffer
				}
		},
		{
				binding: 3,
				resource: {
						buffer: colorBuffer
				}
		}
		],
	});

// create a 4x4 uniform buffer to store projection


	// create a uniform buffer to store pointLight
	const ambientBuffer = device.createBuffer({
		label: "GPUBuffer store 4x4 matrix",
		size: 1 * 4, // 1 x float32: intensity f32
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	// create a uniform buffer to store pointLight
	const pointBuffer = device.createBuffer({
		label: "GPUBuffer store 4x4 matrix",
		size: 8 * 4, // 8 x float32: position vec4 + 4 configs
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	// create a uniform buffer to store dirLight
	const directionalBuffer = device.createBuffer({
		label: "GPUBuffer store 4x4 matrix",
		size: 8 * 4, // 8 x float32: position vec4 + 4 configs
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	// create a uniform group for light Matrix
	const renderFSGroup = device.createBindGroup({
		label: "Uniform Group with matrix",
		layout: renderPipeline.getBindGroupLayout(1),
		entries: [
			{
				binding: 0,
				resource: {
					// size:4*16,
					// offset:0,
					buffer: lightBuffer,
				},
			},
			{
				binding: 1,
				resource: shadowDepthView
			},
			{
				binding: 2,
				resource:device.createSampler({
					compare:'less'
				})
			}
		],
	});

	const shadowGroup = device.createBindGroup({
		label:'shadowMap uniform Group',
		layout:shadowPipeline.getBindGroupLayout(0),
		entries:[
			{
				binding:0,
				resource:{
					buffer:modelViewBuffer
				}
			},
			{
				binding:1,
				resource:{
					buffer:lightProjectionBuffer
				}
			}
		]
	});


	return {
		renderPipeline,
		shadowPipeline,
		// vertexObj,
		// colorObj,
		modelViewBuffer,
		projectionBuffer,
		colorBuffer,
		renderVSGroup,
		renderFSGroup,
		shadowGroup,
		lightProjectionBuffer,
		ambientBuffer,
		pointBuffer,
		directionalBuffer,
		// mvpMatrixBuffer2,
		// depthTexture,
		// shadowDepthTexture,
		// renderDepthTexture,
		shadowDepthView,
		renderDepthView,
		boxBuffer,
		sphereBuffer,
		lightBuffer
	};
}

function draw(
	device: GPUDevice,
	// pipeline: GPURenderPipeline,
	renderPipeline:GPURenderPipeline,
	shadowPipeline:GPURenderPipeline,
	context: GPUCanvasContext,
	// depthTexture: GPUTexture,
	// shadowDepthTexture:GPUTexture,
	// renderDepthTexture:GPUTexture,
	renderDepthView:GPUTextureView,
	shadowDepthView:GPUTextureView,
	renderVSGroup: GPUBindGroup,
	renderFSGroup:GPUBindGroup,
	shadowGroup: GPUBindGroup,
	boxBuffer: { vertex: GPUBuffer; index: GPUBuffer },
	sphereBuffer: { vertex: GPUBuffer; index: GPUBuffer }
) {
	const encoder = device.createCommandEncoder(); // 所有的命令都提前写入encoder中，然后再一次性提交native运行
	const shadowPassDescriptor:GPURenderPassDescriptor = {
		colorAttachments:[],
		depthStencilAttachment:{
			view:shadowDepthView,
			depthClearValue:1.0,
			depthLoadOp:'clear',
			depthStoreOp:'store'
		}
	};
	const shadowPass = encoder.beginRenderPass(shadowPassDescriptor);
	shadowPass.setPipeline(shadowPipeline);
	shadowPass.setBindGroup(0,shadowGroup);

	// set box vertex
	shadowPass.setVertexBuffer(0,boxBuffer.vertex);
	shadowPass.setIndexBuffer(boxBuffer.index,'uint16');
	shadowPass.drawIndexed(box.indexCount,2,0,0,0);

	// set sphere vertex

	shadowPass.setVertexBuffer(0,sphereBuffer.vertex);
	shadowPass.setIndexBuffer(sphereBuffer.index,'uint16');
	shadowPass.drawIndexed(sphere.indexCount,intanceCount-2,0,0,intanceCount/2);

	shadowPass.end();
	
	const renderPassDescriptor:GPURenderPassDescriptor = {
		colorAttachments:[{
			view:context.getCurrentTexture().createView(),
			clearValue:{r:0,g:0,b:0,a:1.0},
			loadOp:'clear',
			storeOp:'store'
		}],
		depthStencilAttachment:{
			view:renderDepthView,
			depthClearValue:1.0,
			depthLoadOp:'clear',
			depthStoreOp:'store'
		}
	};

	const renderPass = encoder.beginRenderPass(renderPassDescriptor);
	renderPass.setPipeline(renderPipeline);
	renderPass.setBindGroup(0,renderVSGroup);
	renderPass.setBindGroup(1,renderFSGroup);

	renderPass.setVertexBuffer(0,boxBuffer.vertex);
	renderPass.setIndexBuffer(boxBuffer.index,'uint16');
	renderPass.drawIndexed(box.indexCount,2,0,0,0);

	renderPass.setVertexBuffer(0,sphereBuffer.vertex);
	renderPass.setIndexBuffer(sphereBuffer.index,'uint16');
	renderPass.drawIndexed(sphere.indexCount,intanceCount-2,0,0,intanceCount/2);
	
	
	renderPass.end();
	const buffer = encoder.finish();
	device.queue.submit([buffer]); // 这时GPU才开始工作
}

async function run() {
	const canvas = document.querySelector("canvas");
	if (!canvas) throw new Error("No Canvas");
	const { device, format, context, size } = await initWebGPU1(canvas);
	const {
		renderPipeline,
		shadowPipeline,
		// vertexObj,
		// colorObj,
		modelViewBuffer,
		projectionBuffer,
		colorBuffer,
		renderFSGroup,
		renderVSGroup,
		shadowGroup,
		// mvpMatrixBuffer2,
		// depthTexture,
		// renderDepthTexture,
		// shadowDepthTexture,
		renderDepthView,
		shadowDepthView,
		boxBuffer,
		sphereBuffer,
		ambientBuffer,
		pointBuffer,
		directionalBuffer,
		lightProjectionBuffer,
		lightBuffer
	} = await initPipeline(device, format, size);

	const sceneList: any[] = [];
	const modelViewArray = new Float32Array(intanceCount * 4 * 4);
	const colorArray = new Float32Array(intanceCount * 4);

	// add a center box
	{
		const position = {x:0,y:0,z:-20};
		const rotation = {x:0,y:Math.PI/4,z:0};
		const scale = {x:2,y:20,z:2};
		const modelView = getModelViewMatrix(position,rotation,scale);
		modelViewArray.set(modelView,0*4*4);
		colorArray.set([0.5,0.5,0.5,1],0);
		sceneList.push({position,rotation,scale});

	}

	// add a floor

	{
		const position = { x: 0, y: -10, z: -20 };
		const rotation = { x: 0, y: 0, z: 0 };
		const scale = { x: 50, y: 0.5, z: 40 };
		const modelView = getModelViewMatrix(position,rotation,scale);
		modelViewArray.set(modelView,1*4*4);
		colorArray.set([1,1,1,1],1*4);
		sceneList.push({position,rotation,scale});
	}

	// add spheres and box
	for(let i=2;i<intanceCount;i++){
		const or = Math.random() > 0.5 ? 1 : -1
		const position = { x: (1 + Math.random() * 12) * or, y: - 8 + Math.random() * 15, z: -20 + (1 + Math.random() * 12) * or }
		const rotation = { x: Math.random(), y: Math.random(), z: Math.random() }
		const s = Math.max(0.5, Math.random())
		const scale = { x: s, y: s, z: s }
		const modelView = getModelViewMatrix(position, rotation, scale)
		modelViewArray.set(modelView,i*4*4);
		colorArray.set([Math.random(), Math.random(), Math.random(), 1], i * 4)
		sceneList.push({ position, rotation, scale, y: position.y, v: Math.max(0.09, Math.random() / 10) * or })
	}

	device.queue.writeBuffer(colorBuffer,0,colorArray);


	const lightViewMatrix = mat4.create();
	const lightProjectionMatrix = mat4.create();
	const lightPosition = vec3.fromValues(0,100,0);
	const up = vec3.fromValues(0,1,0);
	const origin = vec3.fromValues(0,0,0);


	function animation() {
		// const now1 = Date.now() / 1000;
		const now = performance.now();
		lightPosition[0] = Math.sin(now / 1500) * 50
		lightPosition[2] = Math.cos(now / 1500) * 50
		mat4.lookAt(lightViewMatrix,lightPosition,origin,up);
		mat4.ortho(lightProjectionMatrix,-40,40,-40,40,-50,200);
		mat4.multiply(lightProjectionMatrix,lightProjectionMatrix,lightViewMatrix);
		device.queue.writeBuffer(lightProjectionBuffer,0,lightProjectionMatrix as Float32Array);
		device.queue.writeBuffer(lightBuffer,0,lightPosition as Float32Array);

		for (let i = 2; i < intanceCount; i++) {
			const obj = sceneList[i];
			obj.position.y += obj.v;
			if (obj.position.y < -9 || obj.position.y > 9)
			obj.v *= -1
			const modelViewMatrix = getModelViewMatrix(obj.position,obj.rotation,obj.scale);
			modelViewArray.set(modelViewMatrix,i*4*4);

		}
		device.queue.writeBuffer(modelViewBuffer,0,modelViewArray);


		draw(
			device,
			renderPipeline,
			shadowPipeline,
			context,
			renderDepthView,
			shadowDepthView,
			renderVSGroup,
			renderFSGroup,
			shadowGroup,
			boxBuffer,
			sphereBuffer
		);
		requestAnimationFrame(animation);
	}
	animation();
	// document.querySelector("#ambient")?.addEventListener("input", (e: Event) => {
	// 	ambient[0] = +(e.target as HTMLInputElement).value;
	// });
	// document.querySelector("#point")?.addEventListener("input", (e: Event) => {
	// 	console.log((e.target as HTMLInputElement).value);
	// 	pointLight[4] = +(e.target as HTMLInputElement).value;
	// });
	// document.querySelector("#radius")?.addEventListener("input", (e: Event) => {
	// 	pointLight[5] = +(e.target as HTMLInputElement).value;
	// });
	// document.querySelector("#dir")?.addEventListener("input", (e: Event) => {
	// 	directionalLight[4] = +(e.target as HTMLInputElement).value;
	// });
	function updateCamera() {
		const aspect = size.width / size.height;
		const projectionMatrix = getProjectionMatrix(aspect,60/180*Math.PI,0.1,1000,{x:0,y:10,z:20});
		device.queue.writeBuffer(projectionBuffer, 0, projectionMatrix);
	}
	updateCamera();
	// 	document.querySelector('input[type="color"]')?.addEventListener('input', (e:Event) => {
	// 		// get hex color string
	// 		const color = (e.target as HTMLInputElement).value
	// 		console.log(color)
	// 		// parse hex color into rgb
	// 		const r = +('0x' + color.slice(1, 3)) / 255
	// 		const g = +('0x' + color.slice(3, 5)) / 255
	// 		const b = +('0x' + color.slice(5, 7)) / 255
	// 		// write colorBuffer with new color
	// 		device.queue.writeBuffer(colorObj.colorBuffer, 0, new Float32Array([r, g, b, 1]))
	// 		draw(device,pipeline, context,vertexObj, colorObj,depthTexture);
	// })
	// document.querySelector('input[type="range"]')?.addEventListener('input', (e:Event) => {
	// 	// get input value
	// 	const value = +(e.target as HTMLInputElement).value
	// 	console.log(value)
	// 	// chagne vertex 0/3/6
	// 	vertexObj.vertex[0] = 0 + value
	// 	vertexObj.vertex[3] = -0.5 + value
	// 	vertexObj.vertex[6] = 0.5 + value
	// 	// write vertexBuffer with new vertex
	// 	device.queue.writeBuffer(vertexObj.vertexBuffer, 0, vertexObj.vertex)
	// 	draw(device,pipeline, context,vertexObj, colorObj,depthTexture);
	// });
	// window.addEventListener("resize", () => {
	// 	size.width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
	// 	size.height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
	// 	console.log("size", size);
	// 	depthTexture.destroy();
	// 	const newDepthTexture = device.createTexture({
	// 		size,
	// 		format: "depth24plus",
	// 		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	// 	});
	// 	draw(
	// 		device,
	// 		pipeline,
	// 		context,
	// 		vertexObj,
	// 		colorObj,
	// 		newDepthTexture,
	// 		group
	// 	);
	// });
}

run();
