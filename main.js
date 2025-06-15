import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

function main() {
  const canvas = document.querySelector("#c");
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

  const fov = 45;
  const aspect = 2; // the canvas default
  const near = 0.1;
  const far = 100;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 10, 20);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5, 0);
  controls.update();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("black");

  // {

  // 	const planeSize = 40;

  // 	const loader = new THREE.TextureLoader();
  // 	const texture = loader.load( 'https://threejs.org/manual/examples/resources/images/checker.png' );
  // 	texture.wrapS = THREE.RepeatWrapping;
  // 	texture.wrapT = THREE.RepeatWrapping;
  // 	texture.magFilter = THREE.NearestFilter;
  // 	texture.colorSpace = THREE.SRGBColorSpace;
  // 	const repeats = planeSize / 2;
  // 	texture.repeat.set( repeats, repeats );

  // 	const planeGeo = new THREE.PlaneGeometry( planeSize, planeSize );
  // 	const planeMat = new THREE.MeshPhongMaterial( {
  // 		map: texture,
  // 		side: THREE.DoubleSide,
  // 	} );
  // 	const mesh = new THREE.Mesh( planeGeo, planeMat );
  // 	mesh.rotation.x = Math.PI * - .5;
  // 	scene.add( mesh );

  // }

  async function loadAndAddTriangles() {
    // Fetch CSV file
    const response = await fetch("./public/triangles.csv");
    const csvText = await response.text();

    // Parse CSV
    const lines = csvText.trim().split("\n");
    const header = lines[0].split(",");
    const triangles = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(Number);
      // Each triangle has 3 points, each with x, y, z
      const p1 = new THREE.Vector3(values[1], values[2], values[3]);
      const p2 = new THREE.Vector3(values[4], values[5], values[6]);
      const p3 = new THREE.Vector3(values[7], values[8], values[9]);
      triangles.push([p1, p2, p3]);
    }
    console.log("Triangles loaded:", triangles);

    // Create geometry from triangles
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    triangles.forEach((tri) => {
      tri.forEach((pt) => {
        positions.push(pt.x, pt.y, pt.z);
      });
    });
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setDrawRange(0, positions.length / 3); // Ensure all triangles are drawn

    // Optionally, add a wireframe for debugging
    const material = new THREE.MeshBasicMaterial({
      color: "#CA8",
      side: THREE.DoubleSide,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Optionally, print bounding box to check location
    geometry.computeBoundingBox();
    console.log("Triangles bounding box:", geometry.boundingBox);
  }
  loadAndAddTriangles();

  // // Example usage:
  // loadTrianglesTexture('triangles.csv').then(texture => {
  //     // Use the texture as needed, e.g., apply to a material
  //     // const mat = new THREE.MeshBasicMaterial({ map: texture });
  // });

  {
    const cubeSize = 4;
    const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMat = new THREE.MeshPhongMaterial({ color: "#8AC" });
    const mesh = new THREE.Mesh(cubeGeo, cubeMat);
    mesh.position.set(cubeSize + 1, cubeSize / 2, 0);
    scene.add(mesh);
  }

  {
    const sphereRadius = 3;
    const sphereWidthDivisions = 32;
    const sphereHeightDivisions = 16;
    const sphereGeo = new THREE.SphereGeometry(
      sphereRadius,
      sphereWidthDivisions,
      sphereHeightDivisions
    );
    const sphereMat = new THREE.MeshPhongMaterial({ color: "#CA8" });
    const mesh = new THREE.Mesh(sphereGeo, sphereMat);
    mesh.position.set(-sphereRadius - 1, sphereRadius + 2, 0);
    scene.add(mesh);
  }

  class ColorGUIHelper {
    constructor(object, prop) {
      this.object = object;
      this.prop = prop;
    }
    get value() {
      return `#${this.object[this.prop].getHexString()}`;
    }
    set value(hexString) {
      this.object[this.prop].set(hexString);
    }
  }

  {
    const color = 0xffffff;
    const intensity = 1;
    const light = new THREE.AmbientLight(color, intensity);
    scene.add(light);

    const gui = new GUI();
    gui.addColor(new ColorGUIHelper(light, "color"), "value").name("color");
    gui.add(light, "intensity", 0, 5, 0.01);
  }

  const cameraHelper = new THREE.CameraHelper(camera);
  cameraHelper.visible = true; // Set to false to hide the helper
  cameraHelper.setColors(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff);
  scene.add(cameraHelper);

  console.log("Camera position:", camera.position);
  console.log("Camera target:", controls.target);
  console.log("Camera parameters:", {
    fov: camera.fov,
    aspect: camera.aspect,
    near: camera.near,
    far: camera.far,
  });

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }

    return needResize;
  }

  function render() {
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
