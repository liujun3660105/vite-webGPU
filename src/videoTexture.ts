import triangleVertex from "./shaders/videoTexture.vert.wgsl?raw";
import triangleFrag from "./shaders/videoTexture.frag.wgsl?raw";
import { vertex, vertexCount } from './util/cubeWithUV';
import { mat4, vec3} from 'gl-matrix';
import videoUrl from '/video.mp4';

interface ModelView{
	x:number,
	y:number,
	z:number
}

const video = document.createElement('video');
video.loop = true;
video.autoplay = true;
video.muted = true;
video.src = videoUrl;
await video.play();

async function initWebGPU1(canvas:HTMLCanvasElement) {
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
		width:canvas.width,
		height:canvas.height,
	};
	context.configure({
		device,
		format,
		//prevent chrome warning after v102
		alphaMode:'opaque'
		// size,
	});
	return { adapter, device, format, context,size };
}

async function initPipeline(device: GPUDevice, format: GPUTextureFormat,size:{width:number,height:number}) {
  console.log("🚀 ~ file: rotatingCube.ts ~ line 41 ~ initPipeline ~ size", size)
	// const vertex = new Float32Array([
	// 	0,0.5,0,
	// 	-0.5,-0.5,0,
	// 	0.5,-0.5,0
	// ]);
	const vertexBuffer = device.createBuffer({
		size:vertex.byteLength,
		usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(vertexBuffer,0,vertex); // GPUBUffer ,offset ,typedArray
	const color = new Float32Array([1,1,0,1]);
	const colorBuffer = device.createBuffer({
		size:color.byteLength,
		usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
	});
	const mvpMatrixBuffer = device.createBuffer({
		size:4*4*4,
		usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST
	});


	device.queue.writeBuffer(colorBuffer,0,color);
	const vertexShader = device.createShaderModule({
		code: triangleVertex,
	});
	const fragShader = device.createShaderModule({
		code: triangleFrag,
	});
	const vertexObj = {
		vertex,vertexBuffer,vertexCount
	}
	const pipeline = await device.createRenderPipelineAsync({
		layout:'auto',
		// 这里整体标识传入的vertex buffer是以每12个字节划分为一个定点数据传入shader，每个节点中从0（shaderLocation）开始
		// 3个flaot32的数字作为一个参数传入shader@location(0)这个位置
		vertex: {
			module: vertexShader,
			entryPoint: "main",
			buffers:[{
				arrayStride: 5*4, //每个定点占用的空间大小
				attributes:[
					{
						shaderLocation:0,
						offset:0,
						format:'float32x3'  //标识参数的长度大小
					},
					{
						shaderLocation:1,
						offset:3*4,
						format:'float32x2'  //标识参数的长度大小
					},
				] // 切分出来的array如何对应shader里的参数
			}] // 标识pipeline可以传入几个定点数据  目前支持一个pipeline最多传入8个定点数据
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
			topology:'triangle-list',
			cullMode:'back',//面剔除,
			frontFace: 'ccw'
		},
		depthStencil:{
			depthWriteEnabled:true,
			depthCompare:'less',
			format:'depth24plus'// 深度存储的精度 24位深度贴图  深度贴图的数据格式
		},
	});

	const depthTexture = device.createTexture({
		size,format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT
	})

	// webgpu中最多一个group最多绑定8个资源
	const group = device.createBindGroup({
		layout:pipeline.getBindGroupLayout(0),
		entries:[
		// 	{
		// 	binding:0,
		// 	resource:{
		// 		buffer:colorBuffer
		// 	}
		// },
		{
			binding:0,
			resource:{
				buffer:mvpMatrixBuffer
			}
		}
	]
	});
	const colorObj = {
		color,colorBuffer,group
	}
	return {pipeline,vertexObj,colorObj,mvpMatrixBuffer,depthTexture}
}

function getMvpMatrix(size:{width:number,height:number},position:ModelView,rotation:ModelView,scale:ModelView){
	// const position = {x:0,y:0,z:-8};
	// const rotation = {x:0.5,y:0,z:0};
	// const scale = {x:1,y:1,z:1};

	const modelViewMatrix = mat4.create();
	mat4.translate(modelViewMatrix, modelViewMatrix,vec3.fromValues(position.x,position.y,position.z));

	mat4.rotateX(modelViewMatrix,modelViewMatrix,rotation.x);
	mat4.rotateY(modelViewMatrix,modelViewMatrix,rotation.y);
	mat4.rotateZ(modelViewMatrix,modelViewMatrix,rotation.z);
	
	mat4.scale(modelViewMatrix,modelViewMatrix,vec3.fromValues(scale.x,scale.y,scale.z));
	
	const projectionMatrix = mat4.create();
	mat4.perspective(projectionMatrix, Math.PI/4, size.width/size.height,0.1,100);
	const mvpMatrix = mat4.create();
	mat4.multiply(mvpMatrix, projectionMatrix, modelViewMatrix);
	return mvpMatrix;
}

function draw(device:GPUDevice,pipeline:GPURenderPipeline,context:GPUCanvasContext,vertexObj:any,colorObj:any,depthTexture:GPUTexture,textureGroup:GPUBindGroup){
	const encoder = device.createCommandEncoder();// 所有的命令都提前写入encoder中，然后再一次性提交native运行
	const renderPass = encoder.beginRenderPass({ // 这个pass最终的结果会对应到相应的canvas上
		colorAttachments:[{
			view: context.getCurrentTexture().createView(),//通道输出在哪里显示  获取一个可以被GPU操作的view buffer
			loadOp:'clear',// 绘制前是否加载当前view的内容  clear清空  load是在原有的内容的基础上添加新的内容
			clearValue:{r:0,g:0,b:0,a:1}, //背景色
			storeOp:'store'// 绘制后对view进行什么操作  store保留  discard丢弃结果
	}],
	depthStencilAttachment:{
		view:depthTexture.createView(),
		depthLoadOp:'clear',
		depthClearValue:1.0, //z取值范围是0-1.0
		depthStoreOp:'store'// 最后的结果是否要保留
	}
	});
	renderPass.setPipeline(pipeline);
	renderPass.setVertexBuffer(0,vertexObj.vertexBuffer);
	renderPass.setBindGroup(0,colorObj.group);
	renderPass.setBindGroup(1,textureGroup);
	renderPass.draw(vertexObj.vertexCount); //定点个数 vertexShader会被并行执行三次
	renderPass.end();
	const buffer = encoder.finish();
	device.queue.submit([buffer]);// 这时GPU才开始工作
}

async function run() {
	const canvas = document.querySelector('canvas')
	if (!canvas)
			throw new Error('No Canvas')
	const { device, format, context, size } = await initWebGPU1(canvas);
	const {pipeline, vertexObj, colorObj,mvpMatrixBuffer,depthTexture} = await initPipeline(device, format,size);

	// device.queue.copyExternalImageToTexture({source:bitmap},{texture},textureSize);
	const sampler = device.createSampler({
		magFilter:'linear',
		minFilter:'linear',
	});

	const position = {x:0,y:0,z:-8};
	const rotation = {x:0.5,y:0,z:0};
	const scale = {x:1,y:1,z:1};
	// const mvpMatrix = getMvpMatrix(size,position,rotation,scale);
	// device.queue.writeBuffer(mvpMatrixBuffer,0, mvpMatrix as Float32Array);
	// draw(device,pipeline,context,vertexObj, colorObj,depthTexture,videoGroup);

	function animation(){
		const now = Date.now()/1000;
		rotation.x = Math.sin(now)
		rotation.y = Math.cos(now)
		const mvpMatrix = getMvpMatrix(size,position,rotation,scale);

		        // video frame rate may not different with page render rate
        // we can use VideoFrame to force video decoding current frame
        const videoFrame = new VideoFrame(video)
        // it can be imported to webgpu as texture source with the `webgpu-developer-features` flag enabled
        // const texture = device.importExternalTexture({
        //     source: videoFrame // need `webgpu-developer-features`
        // })
        // but in this demo, we don't acctully use it, just close it
        videoFrame.close()
		const texture = device.importExternalTexture({
			source:video
		});
		const videoGroup = device.createBindGroup({
			label:'Texture Group with Texture/Sampler',
			layout:pipeline.getBindGroupLayout(1),
			entries:[{
				binding:0,
				resource:sampler
			},{
				binding:1,
				resource:texture
			}]
		})
		device.queue.writeBuffer(mvpMatrixBuffer,0,mvpMatrix as Float32Array);
		draw(device,pipeline,context,vertexObj, colorObj,depthTexture,videoGroup);
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
window.addEventListener('resize',()=>{
	size.width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
	size.height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
	console.log('size',size);
	depthTexture.destroy();
	const newDepthTexture = device.createTexture({
		size,format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT
	});
	draw(device,pipeline, context,vertexObj, colorObj,newDepthTexture,videoGroup);
})
}


run();
