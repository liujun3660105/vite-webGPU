// check webgpu support
async function initWebGPU() {
    try{
        if(!navigator.gpu)
            throw new Error('Not support WebGPU')
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance'
            // powerPreference: 'low-power'
        })
        if(!adapter)
            throw new Error('No adapter found')
        console.log(adapter)
        document.body.innerHTML = '<h1>Hello WebGPU</h1>'
        let i:keyof GPUSupportedLimits
        for(i in adapter.limits)
            document.body.innerHTML += `<p>${i}:${adapter.limits[i]}</p>`
    }catch(error:any){
        document.body.innerHTML = `<h1>${error.message}</h1>`
    }
}
initWebGPU()