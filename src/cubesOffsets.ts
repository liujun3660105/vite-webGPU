import triangleVertex from "./shaders/cubesOffset.vert.wgsl?raw";
import triangleFrag from "./shaders/cubesOffset.frag.wgsl?raw";
import { mat4, vec3 } from "gl-matrix";
import * as triangle from "./util/cube";

interface ModelView {
	x: number;
	y: number;
	z: number;
}

async function initWebGPU1() {
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
	const canvas = document.querySelector("canvas");
	if (!canvas) throw new Error();
	const context = canvas.getContext("webgpu");
	if (!context) throw new Error();
	// const format = context.getPreferredFormat(adapter);
	const format = navigator.gpu.getPreferredCanvasFormat();
	const devicePixelRatio = window.devicePixelRatio || 1;

	console.log(
		canvas.clientWidth,
		canvas.clientWidth * window.devicePixelRatio,
		canvas.width
	);
	canvas.width = canvas.clientWidth * devicePixelRatio;
	canvas.height = canvas.clientHeight * devicePixelRatio;
	const size = [
		canvas.clientWidth * window.devicePixelRatio,
		canvas.clientHeight * window.devicePixelRatio,
	];
	context.configure({
		device,
		format,
		size,
	});
	return { adapter, device, format, context, size };
}

async function initPipeline(
	device: GPUDevice,
	format: GPUTextureFormat,
	size: number[]
) {
	const vertexBuffer = device.createBuffer({
		size: triangle.vertex.byteLength,
		// size:36,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});
	// const vertexBuffer1 = device.createBuffer({
	// 	size:vertex.byteLength,
	// 	usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST
	// });
	device.queue.writeBuffer(vertexBuffer, 0, triangle.vertex); // GPUBUffer ,offset ,typedArray
	// device.queue.writeBuffer(vertexBuffer1,0,vertex); // GPUBUffer ,offset ,typedArray
	const vertexShader = device.createShaderModule({
		code: triangleVertex,
	});
	const fragShader = device.createShaderModule({
		code: triangleFrag,
	});
	// const vertexObj = {
	// 	vertex,vertexBuffer,vertexCount:3
	// }
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
						// {
						// 	shaderLocation:0,
						// 	offset:0,
						// 	format:'float32x2'  //标识参数的长度大小
						// },
						// {
						// 	shaderLocation:1,
						// 	offset:2*4,
						// 	format:'float32'  //标识参数的长度大小
						// },
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
			cullMode:'back'
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less", // 深度小的片元会被保留，深度大的会被抛弃
			format: "depth24plus", // 现代图形学中一般使用贴图来去存储深度数据，深度贴图的数据格式
		},
	});
	const depthTexture = device.createTexture({
		size: { width: size[0], height: size[1] },
		format: "depth24plus",
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	});





	// const color = new Float32Array([1, 1, 0, 1]);
	// const colorBuffer = device.createBuffer({
	// 	size: color.byteLength,
	// 	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	// });
	// device.queue.writeBuffer(colorBuffer, 0, color);
	const mvpMatrixBuffer = device.createBuffer({
		label: "GPUBuffer store 4*4*4 matrix1",
		// size: 4 * 4 * 4 * 2,
		size:256*2,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});



	const uniformGroup1 = device.createBindGroup({
		label: "Uniform Group with colorBuffer",
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					offset:0,
					buffer: mvpMatrixBuffer,
					size:4*16
				},
			},
		],
	});

	// const mvpMatrixBuffer2 = device.createBuffer({
	// 	label: "GPUBuffer store 4*4*4 matrix1",
	// 	size: 4 * 4 * 4,
	// 	usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	// });



	const uniformGroup2 = device.createBindGroup({
		label: "Uniform Group with colorBuffer",
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					// offset:4*4*4,
					offset:256,
					buffer: mvpMatrixBuffer,
					size:4*16
				},
			},
		],
	});
	// webgpu中最多一个group最多绑定8个资源
	// const colorObj = {
	// 	color,colorBuffer
	// }
	return {
		pipeline,
		// colorBuffer,
		uniformGroup1,
		uniformGroup2,
		vertexBuffer,
		depthTexture,
		mvpMatrixBuffer,
		// mvpMatrixBuffer2,

	};
}

function draw(device: GPUDevice, context: GPUCanvasContext, pipelineObj: any) {
	const { colorBuffer, pipeline, vertexBuffer, uniformGroup, depthTexture } =
		pipelineObj;
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
			depthClearValue: 1.0,
			depthLoadOp: "clear",
			depthStoreOp: "store",
		},
	});
	renderPass.setPipeline(pipeline);
	renderPass.setVertexBuffer(0, vertexBuffer);
	renderPass.setBindGroup(0, pipelineObj.uniformGroup1);
	renderPass.draw(triangle.vertexCount); //定点个数 vertexShader会被并行执行三次
	renderPass.setBindGroup(0, pipelineObj.uniformGroup2);
	renderPass.draw(triangle.vertexCount); //定点个数 vertexShader会被并行执行三次


	// renderPass.setVertexBuffer(1,vertexBuffer);

	// renderPass.setBindGroup(0,colorObj.group);
	// console.log(111,vertexObj.vertexCount);
	renderPass.end();
	const buffer = encoder.finish();
	device.queue.submit([buffer]); // 这时GPU才开始工作
}

async function run() {
	const { device, format, context, size } = await initWebGPU1();
	const pipelineObj = await initPipeline(device, format, size);
	const position1 = {x:2, y:0, z: -8}
	const rotation1 = {x: 0, y: 0, z:0}
	const scale1 = {x:1, y:1, z: 1}
	const position2 = {x:-2, y:0, z: -8}
	const rotation2 = {x: 0, y: 0, z:0}
	const scale2 = {x:1, y:1, z: 1}
	function frame() {
		const now = Date.now() / 1000
		{
				// first cube
				rotation1.x = Math.sin(now)
				rotation1.y = Math.cos(now)
				const mvpMatrix1 = getMvpMatrix(size, position1, rotation1, scale1)
				device.queue.writeBuffer(
						pipelineObj.mvpMatrixBuffer,
						0,
						mvpMatrix1 as Float32Array
				)
		}
		{
				// second cube
				rotation2.x = Math.cos(now)
				rotation2.y = Math.sin(now)
				const mvpMatrix2 = getMvpMatrix(size, position2, rotation2, scale2)
				device.queue.writeBuffer(
						pipelineObj.mvpMatrixBuffer,
						// 4*4*4,
						256,
						mvpMatrix2 as Float32Array
				)
		}
		draw(device, context, pipelineObj);
		requestAnimationFrame(frame);
	}

	frame();
	// document
	// 	.querySelector('input[type="color"]')
	// 	?.addEventListener("input", (e: Event) => {
	// 		// get hex color string
	// 		const color = (e.target as HTMLInputElement).value;
	// 		console.log(color);
	// 		// parse hex color into rgb
	// 		const r = +("0x" + color.slice(1, 3)) / 255;
	// 		const g = +("0x" + color.slice(3, 5)) / 255;
	// 		const b = +("0x" + color.slice(5, 7)) / 255;
	// 		// write colorBuffer with new color
	// 		device.queue.writeBuffer(
	// 			pipelineObj.colorBuffer,
	// 			0,
	// 			new Float32Array([r, g, b, 1])
	// 		);
	// 		draw(device, context, pipelineObj);
	// 	});
	// update vertexBuffer
	document
		.querySelector('input[type="range"]')
		?.addEventListener("input", (e: Event) => {
			// get input value
			const value = +(e.target as HTMLInputElement).value;
			console.log(value);
			// chagne vertex 0/3/6
			triangle.vertex[0] = 0 + value;
			triangle.vertex[3] = -0.5 + value;
			triangle.vertex[6] = 0.5 + value;
			// write vertexBuffer with new vertex
			device.queue.writeBuffer(pipelineObj.vertexBuffer, 0, triangle.vertex);
			draw(device, context, pipelineObj);
		});
	window.addEventListener("resize", () => {});
}

run();

function getMvpMatrix(
	size: number[],
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
	mat4.perspective(projectionMatrix, Math.PI / 4, size[0] / size[1], 0.1, 100);
	const mvpMatrix = mat4.create();
	mat4.multiply(mvpMatrix, projectionMatrix, modelViewMatrix);
	return mvpMatrix;
}
