import basicInstanced from "./shaders/basic.instanced.vert.wgsl?raw";
import triangleFrag from "./shaders/basic.instanced.frag.wgsl?raw";
import { vertex, vertexCount } from "./util/trangle";
import { mat4, vec3 } from "gl-matrix";

interface ModelView {
	x: number;
	y: number;
	z: number;
}

async function initWebGPU1(canvas: HTMLCanvasElement) {
	console.log('navigator',navigator);
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
	const format = context.getPreferredFormat(adapter);
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
	console.log(
		"🚀 ~ file: rotatingCube.ts ~ line 41 ~ initPipeline ~ size",
		size
	);
	// const vertex = new Float32Array([
	// 	0,0.5,0,
	// 	-0.5,-0.5,0,
	// 	0.5,-0.5,0
	// ]);
	const vertexBuffer = device.createBuffer({
		size: vertex.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(vertexBuffer, 0, vertex); // GPUBUffer ,offset ,typedArray
	// const color = new Float32Array([1, 1, 0, 1]);
	// const colorBuffer = device.createBuffer({
	// 	size: color.byteLength,
	// 	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	// });

	// device.queue.writeBuffer(colorBuffer, 0, color);
	const vertexShader = device.createShaderModule({
		code: basicInstanced,
	});
	const fragShader = device.createShaderModule({
		code: triangleFrag,
	});
	const vertexObj = {
		vertex,
		vertexBuffer,
		vertexCount,
	};
	const pipeline = await device.createRenderPipelineAsync({
		layout: "auto",
		// 这里整体标识传入的vertex buffer是以每12个字节划分为一个定点数据传入shader，每个节点中从0（shaderLocation）开始
		// 3个flaot32的数字作为一个参数传入shader@location(0)这个位置
		vertex: {
			module: vertexShader,
			entryPoint: "main",
			buffers: [
				{
					arrayStride: 3 * 4, //每个定点占用的空间大小
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3", //标识参数的长度大小
						},
					], // 切分出来的array如何对应shader里的参数
				},
			], // 标识pipeline可以传入几个定点数据  目前支持一个pipeline最多传入8个定点数据
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
			format: "depth24plus", // 深度存储的精度 24位深度贴图  深度贴图的数据格式
		},
	});

	const mvpMatrixBuffer = device.createBuffer({
		label: "GPUBuffer store 4*4*4 matrix1",
		size: 4*4*4*NUM,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});


	// webgpu中最多一个group最多绑定8个资源
	const group = device.createBindGroup({
		label: 'Uniform Group with matrix1',
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: mvpMatrixBuffer,
				},
			},
		],
	});
	// const group2 = device.createBindGroup({
	// 	label: 'Uniform Group with matrix2',
	// 	layout: pipeline.getBindGroupLayout(0),
	// 	entries: [
	// 		{
	// 			binding: 0,
	// 			resource: {
	// 				size:4*16,
	// 				offset:256,
	// 				buffer: mvpMatrixBuffer,
	// 			},
	// 		},
	// 	],
	// });

	const depthTexture = device.createTexture({
		size,
		format: "depth24plus",
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	});

	const colorObj = {
		// color,
		// colorBuffer,
		group,
		// group2,
	};
	return {
		pipeline,
		vertexObj,
		colorObj,
		mvpMatrixBuffer,
		// mvpMatrixBuffer2,
		depthTexture,
	};
}

function getMvpMatrix(
	size: { width: number; height: number },
	position: ModelView,
	rotation: ModelView,
	scale: ModelView
) {
	// const position = {x:0,y:0,z:-8};
	// const rotation = {x:0.5,y:0,z:0};
	// const scale = {x:1,y:1,z:1};

	const modelViewMatrix = mat4.create();
	mat4.translate(
		modelViewMatrix,
		modelViewMatrix,
		vec3.fromValues(position.x, position.y, position.z)
	);

	mat4.rotateX(modelViewMatrix, modelViewMatrix, rotation.x);
	mat4.rotateY(modelViewMatrix, modelViewMatrix, rotation.y);
	mat4.rotateZ(modelViewMatrix, modelViewMatrix, rotation.z);

	mat4.scale(
		modelViewMatrix,
		modelViewMatrix,
		vec3.fromValues(scale.x, scale.y, scale.z)
	);

	const projectionMatrix = mat4.create();
	mat4.perspective(
		projectionMatrix,
		Math.PI / 4,
		size.width / size.height,
		0.1,
		100
	);
	const mvpMatrix = mat4.create();
	mat4.multiply(mvpMatrix, projectionMatrix, modelViewMatrix);
	return mvpMatrix;
}

function draw(
	device: GPUDevice,
	pipeline: GPURenderPipeline,
	context: GPUCanvasContext,
	vertexObj: any,
	colorObj: any,
	depthTexture: GPUTexture
) {
	const encoder = device.createCommandEncoder(); // 所有的命令都提前写入encoder中，然后再一次性提交native运行
	const renderPass = encoder.beginRenderPass({
		// 这个pass最终的结果会对应到相应的canvas上
		colorAttachments: [
			{
				view: context.getCurrentTexture().createView(), //通道输出在哪里显示  获取一个可以被GPU操作的view buffer
				loadOp: "clear", // 绘制前是否加载当前view的内容  clear清空  load是在原有的内容的基础上添加新的内容
				clearValue: { r: 0, g: 0, b: 0, a: 1 }, //背景色
				storeOp: "store", // 绘制后对view进行什么操作  store保留  discard丢弃结果
			},
		],
		depthStencilAttachment: {
			view: depthTexture.createView(),
			depthLoadOp: "clear",
			depthClearValue: 1.0, //z取值范围是0-1.0
			depthStoreOp: "store", // 最后的结果是否要保留
		},
	});
	renderPass.setPipeline(pipeline);
	renderPass.setVertexBuffer(0, vertexObj.vertexBuffer);
	// for(let i=0;i<20000;i++)
	{
		renderPass.setBindGroup(0, colorObj.group);
		renderPass.draw(vertexObj.vertexCount, NUM); //定点个数 vertexShader会被并行执行三次
		// renderPass.setBindGroup(0, colorObj.group2);
		// renderPass.draw(vertexObj.vertexCount); //定点个数 vertexShader会被并行执行三次
	}
	// renderPass.draw(vertexObj.vertexCount);
	renderPass.end();
	const buffer = encoder.finish();
	device.queue.submit([buffer]); // 这时GPU才开始工作
}
const NUM = 500;
async function run() {
	const canvas = document.querySelector("canvas");
	if (!canvas) throw new Error("No Canvas");
	const { device, format, context, size } = await initWebGPU1(canvas);
	const {
		pipeline,
		vertexObj,
		colorObj,
		mvpMatrixBuffer,
		// mvpMatrixBuffer2,
		depthTexture,
	} = await initPipeline(device, format, size);
	const scene:any[] = []
	const mvpBuffer = new Float32Array(NUM * 4 * 4)
	for(let i = 0; i < NUM; i++){
		// craete simple object
		const position = {x: Math.random() * 40 - 20, y: Math.random() * 40 - 20, z:  - 50 - Math.random() * 50}
		const rotation = {x: 0, y: 0, z: 0}
		const scale = {x:1, y:1, z:1}
		scene.push({position, rotation, scale})
}
	// const position1 = { x: 2, y: 0, z: -8 };
	// const rotation1 = { x: 0.5, y: 0, z: 0 };
	// const scale1 = { x: 1, y: 1, z: 1 };
	// const position2 = { x: -2, y: 0, z: -8 };
	// const rotation2 = { x: 0.5, y: 0, z: 0 };
	// const scale2 = { x: 1, y: 1, z: 1 };
	// const mvpMatrix1 = getMvpMatrix(size, position1, rotation1, scale1);
	// device.queue.writeBuffer(mvpMatrixBuffer, 0, mvpMatrix1 as Float32Array);
	// const mvpMatrix2 = getMvpMatrix(size, position2, rotation2, scale2);
	// device.queue.writeBuffer(mvpMatrixBuffer, 0, mvpMatrix2 as Float32Array);
	// draw(device, pipeline, context, vertexObj, colorObj, depthTexture);

	function animation() {
		for(let i = 0; i < scene.length - 1; i++){
			const obj = scene[i]
			const now = Date.now() / 1000
			obj.rotation.x = Math.sin(now + i)
			obj.rotation.y = Math.cos(now + i)
			const mvpMatrix = getMvpMatrix(size, obj.position, obj.rotation, obj.scale)
			// update buffer based on offset
			// device.queue.writeBuffer(
			//     pipelineObj.mvpBuffer,
			//     i * 4 * 4 * 4, // offset for each object, no need to 256-byte aligned
			//     mvpMatrix
			// )
			// or save to mvpBuffer first
			mvpBuffer.set(mvpMatrix, i * 4 * 4)
	}
	device.queue.writeBuffer(mvpMatrixBuffer, 0, mvpBuffer)

		
		
		draw(device, pipeline, context, vertexObj, colorObj, depthTexture);
		requestAnimationFrame(animation);
	}
	animation();
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
	window.addEventListener("resize", () => {
		size.width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
		size.height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
		console.log("size", size);
		depthTexture.destroy();
		const newDepthTexture = device.createTexture({
			size,
			format: "depth24plus",
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
		draw(device, pipeline, context, vertexObj, colorObj, newDepthTexture);
	});
}

run();
