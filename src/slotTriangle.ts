import triangleVertex from "./shaders/slot.vert.wgsl?raw";
import triangleFrag from "./shaders/slot.frag.wgsl?raw";

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
	const size = [
		canvas.clientWidth * window.devicePixelRatio,
		canvas.clientHeight * window.devicePixelRatio,
	];
	context.configure({
		device,
		format,
		size,
	});
	return { adapter, device, format, context };
}

async function initPipeline(device: GPUDevice, format: GPUTextureFormat) {
	const vertex = new Float32Array([
		5.0,
		0,0.5,0,
		-0.5,-0.5,0,
		0.5,-0.5,0
	]);
	const vertexBuffer = device.createBuffer({
		// size:vertex.byteLength,
		size:36,
		usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST
	});
	// const vertexBuffer1 = device.createBuffer({
	// 	size:vertex.byteLength,
	// 	usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST
	// });
	device.queue.writeBuffer(vertexBuffer,0,vertex,1); // GPUBUffer ,offset ,typedArray
	// device.queue.writeBuffer(vertexBuffer1,0,vertex); // GPUBUffer ,offset ,typedArray

	// const color = new Float32Array([1,1,0,1]);
	// const colorBuffer = device.createBuffer({
	// 	size:color.byteLength,
	// 	usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
	// });
	// device.queue.writeBuffer(colorBuffer,0,color);
	const vertexShader = device.createShaderModule({
		code: triangleVertex,
	});
	const fragShader = device.createShaderModule({
		code: triangleFrag,
	});
	const vertexObj = {
		vertex,vertexBuffer,vertexCount:3
	}
	const pipeline = await device.createRenderPipelineAsync({
		layout:'auto',
		// 这里整体标识传入的vertex buffer是以每12个字节划分为一个定点数据传入shader，每个节点中从0（shaderLocation）开始
		// 3个flaot32的数字作为一个参数传入shader@location(0)这个位置
		vertex: {
			module: vertexShader,
			entryPoint: "main",
			buffers:[
			// 	{
			// 	arrayStride: 3*4, //每个定点占用的空间大小
			// 	attributes:[
			// 		{
			// 			shaderLocation:0,
			// 			offset:0,
			// 			format:'float32x2'  //标识参数的长度大小
			// 		},
			// 		{
			// 			shaderLocation:1,
			// 			offset:2*4,
			// 			format:'float32'  //标识参数的长度大小
			// 		},
			// 	] // 切分出来的array如何对应shader里的参数
			// },
			{
				arrayStride: 3*4, //每个定点占用的空间大小
				
				attributes:[
					{
						shaderLocation:0,
						offset:0,
						format:'float32x2'  //标识参数的长度大小
					},
				] // 切分出来的array如何对应shader里的参数
			},
			{
				arrayStride: 3*4, //每个定点占用的空间大小
				attributes:[
					{
						shaderLocation:1,
						offset:2*4,
						format:'float32'  //标识参数的长度大小
					},
				] // 切分出来的array如何对应shader里的参数
			}
		] // 标识pipeline可以传入几个定点数据  目前支持一个pipeline最多传入8个定点数据
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
		primitive:{
			// point-list 每一个点都单做独立的点输出
			// line-list 每两个点组成一条线输出
			// line-strip 12 23 34的组合方式输出线
			// triangle-strip 共用定点输出三角形 4个定点组成一个正方形
			// trangle-list 不共用定点输出三角形 6个定点组成一个正方形
			topology:'triangle-list'
		}
	});
	// webgpu中最多一个group最多绑定8个资源
	// const colorObj = {
	// 	color,colorBuffer
	// }
	return {pipeline,vertexObj}
}

function draw(device:GPUDevice,pipeline:GPURenderPipeline,context:GPUCanvasContext,vertexObj:any){
	const encoder = device.createCommandEncoder();// 所有的命令都提前写入encoder中，然后再一次性提交native运行
	const renderPass = encoder.beginRenderPass({ // 这个pass最终的结果会对应到相应的canvas上
		colorAttachments:[{
			view: context.getCurrentTexture().createView(),//通道输出在哪里显示  获取一个可以被GPU操作的view buffer
			loadOp:'clear',// 绘制前是否加载当前view的内容  clear清空  load是在原有的内容的基础上添加新的内容
			clearValue:{r:0,g:0,b:0,a:1}, //背景色
			storeOp:'store'// 绘制后对view进行什么操作  store保留  discard丢弃结果
	}]
	});
	renderPass.setPipeline(pipeline);
	renderPass.setVertexBuffer(0,vertexObj.vertexBuffer);
	renderPass.setVertexBuffer(1,vertexObj.vertexBuffer);

	// renderPass.setBindGroup(0,colorObj.group);
	console.log(111,vertexObj.vertexCount);
	renderPass.draw(3); //定点个数 vertexShader会被并行执行三次
	renderPass.end();
	const buffer = encoder.finish();
	device.queue.submit([buffer]);// 这时GPU才开始工作
}

async function run() {
	const { device, format, context } = await initWebGPU1();
	const {pipeline, vertexObj} = await initPipeline(device, format);

	draw(device,pipeline,context,vertexObj);
window.addEventListener('resize',()=>{
	
})
}


run();
