// @stage(fragment)
// fn main(@location(0) fragUV:vec2<f32>,
//         @location(1) fragPosition:vec4<f32>
// ) -> @location(0) vec4<f32>{
//   return fragPosition;
// }
// @group(0) @binding(0) var<uniform> color:vec4<f32>;
@stage(fragment)
fn main(@location(0) fragPosition:vec4<f32>) -> @location(0) vec4<f32> {
    // var a = color;
    return fragPosition;
}
