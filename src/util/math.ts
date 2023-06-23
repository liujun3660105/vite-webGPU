
import { mat4, vec3 } from "gl-matrix";

interface ModelView {
	x: number;
	y: number;
	z: number;
}

export function getModelViewMatrix(
	// size: { width: number; height: number },
	position: ModelView,
	rotation: ModelView,
	scale: ModelView
) {
	// const position = {x:0,y:0,z:-8};
	// const rotation = {x:0.5,y:0,z:0};
	// const scale = {x:1,y:1,z:1};

	const modelViewMatrix = mat4.create();
	mat4.translate(
		modelViewMatrix,
		modelViewMatrix,
		vec3.fromValues(position.x, position.y, position.z)
	);

	mat4.rotateX(modelViewMatrix, modelViewMatrix, rotation.x);
	mat4.rotateY(modelViewMatrix, modelViewMatrix, rotation.y);
	mat4.rotateZ(modelViewMatrix, modelViewMatrix, rotation.z);

	mat4.scale(
		modelViewMatrix,
		modelViewMatrix,
		vec3.fromValues(scale.x, scale.y, scale.z)
	);
	return modelViewMatrix;
}

const center = vec3.fromValues(0,0,0);
const up = vec3.fromValues(0,1,0);


export function getProjectionMatrix(aspect:number,fov:number = 60/180*Math.PI,near:number=0.1,far:number=100,position:ModelView = {x:0,y:0,z:0}){
  const cameraView = mat4.create();
  const eye = vec3.fromValues(position.x,position.y,position.z);
  mat4.translate(cameraView,cameraView,eye);
  mat4.lookAt(cameraView,eye,center,up);

  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix,fov,aspect,near,far);
  mat4.multiply(projectionMatrix,projectionMatrix,cameraView);
  return projectionMatrix as Float32Array;
}






export function getMvpMatrix(
	size: { width: number; height: number },
	position: ModelView,
	rotation: ModelView,
	scale: ModelView
) {
	// const position = {x:0,y:0,z:-8};
	// const rotation = {x:0.5,y:0,z:0};
	// const scale = {x:1,y:1,z:1};

	const modelViewMatrix = mat4.create();
	mat4.translate(
		modelViewMatrix,
		modelViewMatrix,
		vec3.fromValues(position.x, position.y, position.z)
	);

	mat4.rotateX(modelViewMatrix, modelViewMatrix, rotation.x);
	mat4.rotateY(modelViewMatrix, modelViewMatrix, rotation.y);
	mat4.rotateZ(modelViewMatrix, modelViewMatrix, rotation.z);

	mat4.scale(
		modelViewMatrix,
		modelViewMatrix,
		vec3.fromValues(scale.x, scale.y, scale.z)
	);

	const projectionMatrix = mat4.create();
	mat4.perspective(
		projectionMatrix,
		Math.PI / 4,
		size.width / size.height,
		0.1,
		100
	);
	const mvpMatrix = mat4.create();
	mat4.multiply(mvpMatrix, projectionMatrix, modelViewMatrix);
	return mvpMatrix;
}