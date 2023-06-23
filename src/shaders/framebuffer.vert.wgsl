@stage(vertex)
fn main(@builtin(vertex_index) index:u32) -> @builtin(position) vec4<f32>{
  var pos = array<vec2<f32>,4>(
    vec2<f32>(-0.5,0.5),
        vec2<f32>(-0.5,-0.5),
            vec2<f32>(0.5,-0.5),
    vec2<f32>(0.5,0.5),


  );
  return vec4<f32>(pos[index],0.0,1.0);
}