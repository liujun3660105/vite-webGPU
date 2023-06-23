@stage(fragment)
fn main(@builtin(position) frameBufferCoord:vec4<f32>) -> @location(0) vec4<f32>{
  var color = vec4<f32>(1.0,0.5,0.0,0.5);
  let x:f32 = (frameBufferCoord.x - 300.0) / 300.0;
  let y:f32 = (-frameBufferCoord.y + 300.0) / 300.0;
  let r: f32 = sqrt(x*x + y*y);
  // if (x > -0.1 && x < 0.1) {
    // return vec4<f32>(1.0, 0.0, 0.5, -1.0);
  // } else if (y > -0.1 && y < 0.1) {
    // return vec4<f32>(0.0, 0.5, 1.0, 1.0);
  // } else 
  if (r < 0.4) {
    return vec4<f32>(frameBufferCoord.rgb / 600.0, 0.5);
  } else {
    discard;
  }
  // return vec4<f32>(frameBufferCoord.rgb/600.0,0.5);
  // return color;
}