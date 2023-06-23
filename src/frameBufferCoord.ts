import vertex from './shaders/framebuffer.vert.wgsl?raw';
import frag from './shaders/framebuffer.frag.wgsl?raw';

async function initWebGPU(){
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error();
  if(!navigator.gpu) throw new Error();
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference:"high-performance"
  });
  if(!adapter) throw new Error();
  const device = await adapter.requestDevice();
  const context = (canvas.getContext('webgpu')) as GPUCanvasContext;
  if(!context) throw new Error();
  const format = context.getPreferredFormat(adapter);
  console.log('canvas.clientWidth',canvas.clientWidth,canvas.width,window.devicePixelRatio);
  context.configure({
    device,
    format,
    // size:[canvas.clientWidth * window.devicePixelRatio,canvas.clientHeight * window.devicePixelRatio]
    // size:[600,600]
  });
  const pipeline = await device.createRenderPipelineAsync({
    layout:'auto',
    vertex:{
      module:device.createShaderModule({
        code:vertex
      }),
      entryPoint:'main'
    },
    fragment:{
      module:device.createShaderModule({
        code:frag
      }),
      entryPoint:'main',
      targets:[{format}]
    },
    primitive:{topology:'triangle-strip'}
  });

  function render(){
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments:[{
        view:context.getCurrentTexture().createView(),
        loadOp:'clear',
        clearValue:{r:0,g:0,b:0,a:1},//背景色
        storeOp:"store"
      }]
    });
    renderPass.setPipeline(pipeline);
    renderPass.draw(4,1);
    renderPass.end();
    const buffer = commandEncoder.finish();
    device.queue.submit([buffer]);// GPU开始工作
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);





  // async function initPipeline(device:GPUDevice,format:GPUTextureFormat,size:[number,number]){


  // }

}
initWebGPU();