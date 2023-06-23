// @stage(fragment)
// fn main(@location(0) fragUV:vec2<f32>,
//         @location(1) fragPosition:vec4<f32>
// ) -> @location(0) vec4<f32>{
//   return fragPosition;
// }
// @group(0) @binding(0) var<uniform> color:vec4<f32>;

@group(1) @binding(0) var<uniform> ambientIntensity : f32;
@group(1) @binding(1) var<uniform> pointLight : array<vec4<f32>, 2>;
@group(1) @binding(2) var<uniform> directionLight : array<vec4<f32>, 2>;

@fragment
fn main(@location(0) fragPosition:vec3<f32>,
        @location(1) fragColor:vec4<f32>,
        @location(2) fragUV:vec2<f32>,
        @location(3) fragNormal:vec3<f32>
) -> @location(0) vec4<f32> {

    let objectColor = fragColor.rgb;
    let ambitLightColor = vec3(1.0,1.0,1.0);
    let pointLightColor = vec3(1.0,1.0,1.0);
    let dirLightColor = vec3(1.0,1.0,1.0);
    var lightResult = vec3(0.0,0.0,0.0);

    // ambient
    lightResult+=ambitLightColor * ambientIntensity;

    // Directional Light
    var directionPosition = directionLight[0].xyz;
    var directionIntensity:f32 = directionLight[1][0];
    var diffuse: f32 = max(dot(normalize(directionPosition), fragNormal), 0.0);
    lightResult += dirLightColor * directionIntensity * diffuse;
    // PointLight
    let pointPosition = pointLight[0].xyz;
    let pointIntensity:f32 = pointLight[1][0];
    let pointRadius:f32 = pointLight[1][1];
    let L = pointPosition - fragPosition;
    let distance = length(L);
    if(distance<pointRadius){
        let diffuse:f32 = max(dot(normalize(L),fragNormal),0.0);
        let distanceFactor:f32 = pow(1.0 - distance/pointRadius,2.0);
        lightResult += pointLightColor * pointIntensity * diffuse * distanceFactor;
    }
    return vec4<f32>(objectColor * lightResult,1.0);

}


// @fragment
// fn main(@location(0) fragPosition:vec4<f32>) -> @location(0) vec4<f32> {
//     // var a = fragPosition;
//     // var a = color;
//     // return vec4<f32>(1.0, 0.0, 0.0, 1.0);
//     // return color;
//     // var a = color;
//     // return fragColor;
//     return fragPosition;

// }
