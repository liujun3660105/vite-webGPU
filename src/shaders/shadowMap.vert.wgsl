@group(0) @binding(0) var <storage> modelViews:array<mat4x4<f32>>;
@group(0) @binding(1) var <uniform> projectionView:mat4x4<f32>;
@group(0) @binding(2) var <uniform> lightProjectionView:mat4x4<f32>;
@group(0) @binding(3) var <storage> color:array<vec4<f32>>;



// struct VertexOutput {
//   @builtin(position) Position: vec4<f32>,
//   @location(0) fragPosition: vec4<f32>
// }
struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    // @location(0) fragUV : vec2<f32>,
    @location(0) fragPosition: vec3<f32>,
    @location(1) fragColor: vec4<f32>,
    @location(2) fragUV: vec2<f32>,
    @location(3) fragNormal : vec3<f32>,
    @location(4) shadowPos : vec3<f32>,


};

@vertex
fn main(
  @location(0) position:vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) uv : vec2<f32>,
  @builtin(instance_index) index:u32
  ) -> VertexOutput {
  let modelview = modelViews[index];
  let pos = vec4<f32>(position,1.0);
  let mvp = projectionView * modelview;
  var out:VertexOutput;
  out.Position = mvp * pos;
  out.fragPosition = 0.5 * (modelview * pos).xyz;
  out.fragNormal = (modelview * vec4<f32>(normal, 0.0)).xyz;
  out.fragUV = uv;
  out.fragColor = color[index];
  let posFromLight = lightProjectionView * modelview * pos;

  out.shadowPos =vec3<f32> (posFromLight.xy * vec2<f32>(0.5,-0.5)+vec2<f32>(0.5,0.5), posFromLight.z);
  return out;
}

// fn main(@location(0) position:vec4<f32>) -> @builtin(position) vec4<f32> {
//   return mvp * position;
// }