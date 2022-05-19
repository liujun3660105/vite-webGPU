@group(0) @binding(0) var<storage> modelView : array<mat4x4<f32>>;
@group(0) @binding(1) var<uniform> projection : mat4x4<f32>;
@group(0) @binding(2) var<storage> colors : array<vec4<f32>>;

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) fragPosition : vec3<f32>,
    @location(1) fragNormal : vec3<f32>,
    @location(2) fragUV: vec2<f32>,
    @location(3) color: vec4<f32>
};

@stage(vertex)
fn main(
    @builtin(instance_index) index : u32,
    @location(0) position : vec4<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) uv : vec2<f32>,
) -> VertexOutput {
    let worldMatrix = modelView[index];
    let mvp = projection * worldMatrix;

    var output : VertexOutput;
    output.Position = mvp * position;
    output.fragPosition = (worldMatrix * position).xyz;
    output.fragNormal =  mat3x3<f32>(worldMatrix[0].xyz, worldMatrix[1].xyz, worldMatrix[2].xyz) * normal;
    output.fragUV = uv;
    output.color = colors[index];
    return output;
}