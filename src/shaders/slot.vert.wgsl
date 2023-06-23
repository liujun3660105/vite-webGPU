// @group(0) @binding(1) var <uniform> mvp:mat4x4<f32>;

// struct VertexOutput {
//   @builtin(position) Position: vec4<f32>,
//   @location(0) fragPosition: vec4<f32>
// }
// struct VertexOutput {
//     @builtin(position) Position : vec4<f32>,
//     // @location(0) fragUV : vec2<f32>,
//     @location(0) fragPosition: vec4<f32>
// };

// @vertex
// fn main(@location(0) xy : vec2<f32>, 
//         @location(1) z : f32) -> @builtin(position) : vec4<f32> {
//   // var out:VertexOutput;
//   // out.position = mvp * position;
//   // out.fragPosition = position;
//   // return out;
//   return vec4<f32>(xy, z, 1.0);
// }

// @vertex
// fn main(@location(0) position:vec3<f32>) -> @builtin(position) vec4<f32> {
//   return vec4<f32>(position, 1.0);
// }

@vertex
fn main(@location(0) xy:vec2<f32>,@location(1) z:f32) -> @builtin(position) vec4<f32> {
  return vec4<f32>(xy,z, 1.0);
}

// @vertex
// fn main(@location(0) xy:vec2<f32>) -> @builtin(position) vec4<f32> {
//   return vec4<f32>(xy,0.0, 1.0);
// }

// @vertex
// fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
//     var pos = array<vec2<f32>, 3>(
// 	    vec2<f32>(0.0, 0.5),
// 	    vec2<f32>(-0.5, -0.5),
// 	    vec2<f32>(0.5, -0.5)
//     );
//     return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
// }

// fn main(@location(0) position:vec4<f32>) -> @builtin(position) vec4<f32> {
//   return mvp * position;
// }