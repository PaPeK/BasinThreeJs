// public/main.js

// Updated import paths to use the JSM versions and lil-gui package
import * as THREE from "three";
// CHANGED: use examples/jsm path instead of addons
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// CHANGED: use lil-gui package instead of three/addons/libs
import { GUI } from "lil-gui";

function main() {
  const canvas = document.querySelector("#c");
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

  // parameter to magnify the depth-related z values
  const depthMagnification = 10;
  console.warn(
    "Using depthMagnification =",
    depthMagnification,
    "to scale z values for better visibility."
  );

  //selection buttons to switch from trianges to heatmap
  const btnTri = document.getElementById("viewTriangles");
  const btnHeat = document.getElementById("viewHeatmap");
  const btnLoadTriangles = document.getElementById("loadTriangles");
  const btnLoadTrack = document.getElementById("loadTrack");
  const btnLoadPoints = document.getElementById("loadPoints");

  // Variables to store current meshes so we can remove them when loading new ones
  let triMesh = null;
  let heatMesh = null;
  let trackGroup = null; // Group to hold spheres and lines for 3D track
  let pointsGroup = null; // Group to hold individual points without lines

  // helper to toggle the “active” class
  function setActive(btn) {
    btnTri.classList.remove("active");
    btnHeat.classList.remove("active");
    btn.classList.add("active");
  }

  // set initial state
  setActive(btnTri);

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

  async function loadAndAddTriangles(csvContent = null) {
    // Remove existing meshes if they exist
    if (triMesh) {
      scene.remove(triMesh);
      triMesh.geometry.dispose();
      triMesh.material.dispose();
    }
    if (heatMesh) {
      scene.remove(heatMesh);
      heatMesh.geometry.dispose();
      heatMesh.material.dispose();
    }

    let csvText;
    if (csvContent) {
      csvText = csvContent;
    } else {
      // Fetch CSV file from default location
      const response = await fetch("./triangles.csv");
      csvText = await response.text();
    }

    // Parse CSV
    const lines = csvText.trim().split("\n");
    const triangles = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(Number);
      // Each triangle has 3 points, each with x, y, z
      const p1 = new THREE.Vector3(values[1], values[2], depthMagnification* values[3]);
      const p2 = new THREE.Vector3(values[4], values[5], depthMagnification* values[6]);
      const p3 = new THREE.Vector3(values[7], values[8], depthMagnification* values[9]);
      triangles.push([p1, p2, p3]);
    }
    console.log("Triangles loaded:", triangles);
    console.log("triangles length:", triangles.length);

    // Create BufferGeometry from triangles
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    triangles.forEach((tri) => {
      tri.forEach((pt) => {
        positions.push(pt.x, pt.y, pt.z);
      });
    });
    console.log("Positions length, L_p = ", positions.length, "L_p / 3 = ", positions.length / 3, "L_p / 9 = ", positions.length / 9);
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setDrawRange(0, positions.length / 3);

    // ===== CHANGED/ADDED: center geometry =====
    geometry.computeBoundingBox();
    // Center geometry and save the shift applied
    // short version: geometry.center(); // but this does not save the shift
    const boundingBox = geometry.boundingBox;
    const center = boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    window.meshCenterShift = { x: center.x, y: center.y, z: center.z }; // global variable
    console.log("window.meshCenterShift:", window.meshCenterShift);

    // ===== ADDED: compute per-vertex heatmap colors =====
    const posAttr = geometry.getAttribute("position");
    const count = posAttr.count;
    let minZ = Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
      const z = posAttr.getZ(i);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    const colors = [];
    for (let i = 0; i < count; i++) {
      const z = posAttr.getZ(i);
      const t = (z - minZ) / (maxZ - minZ);
      // map blue (0.66 hue) → red (0.0)
      const c = new THREE.Color().setHSL(0.66 * (1 - t), 1, 0.5);
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    // ===== ADDED: create two materials & meshes =====
    const triMat = new THREE.MeshBasicMaterial({
      color: "#CA8",
      wireframe: true,
      side: THREE.DoubleSide,
    });
    const heatMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    triMesh = new THREE.Mesh(geometry, triMat);
    heatMesh = new THREE.Mesh(geometry, heatMat);
    heatMesh.visible = false; // start on triangles view

    scene.add(triMesh, heatMesh);

    // ===== CHANGED/ADDED: fit camera to the combined geometry =====
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const distance = sphere.radius / Math.sin(fovRad / 2);
    camera.position.set(0, 0, distance * 1.2);
    camera.near = 0.1;
    camera.far = distance + sphere.radius * 1.2;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();

    // Update mesh bounding box for collision detection
    // meshBoundingBox = geometry.boundingBox.clone();
  }
  loadAndAddTriangles();

  async function loadAndAddTrack(csvContent = null) {
    // Remove existing track group if it exists
    if (trackGroup) {
      scene.remove(trackGroup);
      // Dispose of all geometries and materials in the group
      trackGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
        if (child.isLine) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
    }

    let csvText;
    if (csvContent) {
      csvText = csvContent;
    } else {
      // Fetch CSV file from default location (you can change this path)
      const response = await fetch("./track.csv");
      csvText = await response.text();
    }

    // Parse CSV
    const lines = csvText.trim().split("\n");
    const trackPoints = [];
    const color_by_sign = [];

    // Skip header row and parse points: the csv has the columns=[Fish ID,X,Y,Z,Timestamp]
    //    * the Timestamp encodes debugging info, if it is negative, something is wrong
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(Number);
      if (values.length >= 3) {
        // Apply depth magnification to z-coordinate
        const point = new THREE.Vector3(values[1], values[2], values[3] * depthMagnification);
        trackPoints.push(point);
        color_by_sign.push(Math.sign(values[4]));
      }
    }
    console.log("Track points loaded:", trackPoints);
    console.log("track points length:", trackPoints.length);

    // Create a group to hold all spheres and lines
    trackGroup = new THREE.Group();

    // Create sphere geometry and materials
    const sphereRadius = 0.5;
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 8, 6);
    const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const sphereMaterialDebug = new THREE.MeshPhongMaterial({ color: 0xff00ff });

    // Create spheres for each track point
    trackPoints.forEach((point, index) => {
      const material = color_by_sign[index] < 0 ? sphereMaterialDebug.clone() : sphereMaterial.clone();
      const sphere = new THREE.Mesh(sphereGeometry, material);
      sphere.position.copy(point);
      trackGroup.add(sphere);
    });

    // Create lines connecting consecutive track points
    if (trackPoints.length > 1) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(trackPoints);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        linewidth: 2 
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      trackGroup.add(line);
    }

    // Add the group to the scene
    scene.add(trackGroup);

    // Center and fit camera to the track points
    if (trackPoints.length > 0) {
      // Calculate bounding box
      const center = window.meshCenterShift || new THREE.Vector3(0, 0, 0);

      // Center the group
      trackGroup.position.sub(center);
    }
  }

  async function loadAndAddPoints(csvContent = null) {
    // Remove existing points group if it exists
    if (pointsGroup) {
      scene.remove(pointsGroup);
      // Dispose of all geometries and materials in the group
      pointsGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
    }

    let csvText;
    if (csvContent) {
      csvText = csvContent;
    } else {
      // Fetch CSV file from default location (you can change this path)
      const response = await fetch("./points.csv");
      csvText = await response.text();
    }

    // Parse CSV
    const lines = csvText.trim().split("\n");
    const points = [];
    const color_by_sign = [];

    // skip header row and parse points: the csv has the columns=[X,Y,Z,debugFlag]
    //    * the bug_type encodes debugging info, -1 is a different bug than 1
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(Number);
      if (values.length >= 3) {
        // Apply depth magnification to z-coordinate
        const point = new THREE.Vector3(values[0], values[1], values[2] * depthMagnification);
        points.push(point);
        color_by_sign.push(Math.sign(values[3]));
      }
    }
    console.log("Points loaded:", points);
    console.log("points length:", points.length);

    // Create a group to hold all spheres (no lines)
    pointsGroup = new THREE.Group();

    // Create sphere geometry and materials with different colors
    const sphereRadius = 0.3;
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 8, 6);
    const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0x0080ff }); // Blue
    const sphereMaterialDebug = new THREE.MeshPhongMaterial({ color: 0xffa500 }); // Orange

    // Create spheres for each point (no connecting lines)
    points.forEach((point, index) => {
      const material = color_by_sign[index] < 0 ? sphereMaterialDebug.clone() : sphereMaterial.clone();
      const sphere = new THREE.Mesh(sphereGeometry, material);
      sphere.position.copy(point);
      pointsGroup.add(sphere);
    });

    // Add the group to the scene
    scene.add(pointsGroup);

    // Center the points group
    if (points.length > 0) {
      // Calculate bounding box
      const center = window.meshCenterShift || new THREE.Vector3(0, 0, 0);

      // Center the group
      pointsGroup.position.sub(center);
    }
  }

  // // Example usage:
  // loadTrianglesTexture('triangles.csv')…  // left as-is

  // Box
  {
    const cubeSize = 4;
    const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMat = new THREE.MeshPhongMaterial({ color: "#8AC" });
    const mesh = new THREE.Mesh(cubeGeo, cubeMat);
    mesh.position.set(cubeSize + 1, cubeSize / 2, 0);
    scene.add(mesh);
  }

  // Sphere
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

  // Ambient light + GUI
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

  // ====== TOP-DOWN VIEW LOCK BUTTON ======
  const btnLockTopDown = document.getElementById("lockTopDown");
  let isTopDownLocked = false;
  let savedCameraState = null;
  let savedControlsState = null;
  let savedMouseButtons = null;

  if (btnLockTopDown) {
    btnLockTopDown.addEventListener("click", () => {
      if (!isTopDownLocked) {
        // Save current camera, controls, and mouse button state
        savedCameraState = {
          position: camera.position.clone(),
          up: camera.up.clone(),
          target: controls.target.clone(),
        };
        savedControlsState = {
          enableRotate: controls.enableRotate,
          enablePan: controls.enablePan,
        };
        savedMouseButtons = { ...controls.mouseButtons };
        // Set camera above, looking down
        camera.position.set(0, 0, 50);
        camera.up.set(0, 0, -1); // so +z is up in view
        controls.target.set(0, 0, 0);
        controls.enableRotate = false;
        controls.enablePan = true;
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        controls.update();
        camera.lookAt(controls.target);
        isTopDownLocked = true;
        btnLockTopDown.textContent = "Unlock Top-Down View";
      } else {
        // Restore previous state
        if (savedCameraState && savedControlsState && savedMouseButtons) {
          camera.position.copy(savedCameraState.position);
          camera.up.copy(savedCameraState.up);
          controls.target.copy(savedCameraState.target);
          controls.enableRotate = savedControlsState.enableRotate;
          controls.enablePan = savedControlsState.enablePan;
          Object.assign(controls.mouseButtons, savedMouseButtons);
          controls.update();
          camera.lookAt(controls.target);
        }
        isTopDownLocked = false;
        btnLockTopDown.textContent = "Lock Top-Down View";
      }
    });
  }

  // ===== ADDED: File input handler for loading triangles =====
  function handleTriangleFileLoad() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            loadAndAddTriangles(e.target.result);
            console.log('New triangles loaded from file:', file.name);
          } catch (error) {
            console.error('Error loading triangle file:', error);
            alert('Error loading triangle file. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  // Add event listener for loadTriangles button
  if (btnLoadTriangles) {
    btnLoadTriangles.addEventListener("click", handleTriangleFileLoad);
  }

  // ===== ADDED: File input handler for loading 3D track =====
  function handleTrackFileLoad() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            loadAndAddTrack(e.target.result);
            console.log('New track loaded from file:', file.name);
          } catch (error) {
            console.error('Error loading track file:', error);
            alert('Error loading track file. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  // Add event listener for loadTrack button
  if (btnLoadTrack) {
    btnLoadTrack.addEventListener("click", handleTrackFileLoad);
  }

  // ===== ADDED: File input handler for loading 3D points =====
  function handlePointsFileLoad() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            loadAndAddPoints(e.target.result);
            console.log('New points loaded from file:', file.name);
          } catch (error) {
            console.error('Error loading points file:', error);
            alert('Error loading points file. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  // Add event listener for loadPoints button
  if (btnLoadPoints) {
    btnLoadPoints.addEventListener("click", handlePointsFileLoad);
  }

  // ===== ADDED: hook up HTML buttons to toggle views =====
  document.getElementById("viewTriangles").addEventListener("click", () => {
    if (triMesh && heatMesh) {
      triMesh.visible = true;
      heatMesh.visible = false;
      setActive(btnTri);
    }
  });
  document.getElementById("viewHeatmap").addEventListener("click", () => {
    if (triMesh && heatMesh) {
      triMesh.visible = false;
      heatMesh.visible = true;
      setActive(btnHeat);
    }
  });
}

main();
