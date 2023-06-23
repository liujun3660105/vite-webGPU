@group(0) @binding(0) var <uniform> mvp:mat4x4<f32>;
// @group(0) @binding(1) var <uniform> color:vec3<f32>;

// struct VertexOutput {
//   @builtin(position) Position: vec4<f32>,
//   @location(0) fragPosition: vec4<f32>
// }
struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) fragUV : vec2<f32>,
    @location(1) fragPosition: vec4<f32>
};

@vertex
fn main(@location(0) position:vec4<f32>,@location(1) uv:vec2<f32>) -> VertexOutput {
  var out:VertexOutput;
  // var a = color;
  out.Position = mvp * position;
  out.fragUV = uv;
  out.fragPosition = 0.5 * (position+vec4<f32>(1.0,1.0,1.0,1.0));
  return out;
}

// fn main(@location(0) position:vec4<f32>) -> @builtin(position) vec4<f32> {
//   return mvp * position;
// }