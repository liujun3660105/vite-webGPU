import vertex from "./shaders/triangle.vert.wgsl?raw";
import frag from "./shaders/red.frag.wgsl?raw";

async function initWebGPU1() {
	if (!navigator.gpu) throw new Error();
	const adapter = await navigator.gpu.requestAdapter({
		powerPreference: "high-performance", // 设置gpu是运行在高电量模式还是低电量模式  期望选项  具体还要看浏览器的具体实际操作
	}); // 相当于浏览器对webGPU的一种具体的实现抽象，可以读取当前浏览器对webGPU实现了哪些功能和参数，不能直接用它来绘制和计算图形
	adapter?.features.forEach((v) => {
		console.log("v", v); // 浏览器对webGPU的一些扩展功能
	});
	console.log(
		"🚀 ~ file: basicTriangle.ts ~ line 5 ~ initWebGPU ~ adapter",
		adapter
	);
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
	const vertexShader = device.createShaderModule({
		code: vertex,
	});
	const fragShader = device.createShaderModule({
		code: frag,
	});
	const pipeline = await device.createRenderPipelineAsync({
		layout:'auto',
		vertex: {
			module: vertexShader,
			entryPoint: "main",
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
			// triangle-list 不共用定点输出三角形 6个定点组成一个正方形
			topology:'triangle-strip'
		}
	});
	return {pipeline}
}

function draw(device:GPUDevice,pipeline:GPURenderPipeline,context:GPUCanvasContext){
	const encoder = device.createCommandEncoder();// 所有的命令都提前写入encoder中，然后再一次性提交native运行
	const renderPass = encoder.beginRenderPass({ // 这个pass最终的结果会对应到相应的canvas上
		colorAttachments:[{
			view: context.getCurrentTexture().createView(),//通道输出在哪里显示  获取一个可以被GPU操作的view buffer
			loadOp:'clear',// 绘制前是否加载当前view的内容  clear清空  load是在原有的内容的基础上添加新的内容
			clearValue:{r:0,g:0,b:0,a:1}, //背景色
			storeOp:'store'// 绘制后对view进行什么操作  store保留  discard丢弃结果
	}]
	})
	renderPass.setPipeline(pipeline);
	renderPass.draw(3); //定点个数 vertexShader会被并行执行三次
	renderPass.end();
	const buffer = encoder.finish();
	device.queue.submit([buffer]);// 这时GPU才开始工作
}

async function run() {
	const { device, format, context } = await initWebGPU1();
	const {pipeline} = await initPipeline(device, format);
	draw(device,pipeline,context);
}


run();
