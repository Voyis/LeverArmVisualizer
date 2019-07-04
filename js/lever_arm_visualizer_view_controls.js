"use strict";

//Internal units are in mm.

//imports
import * as THREE from './three.modules.js';
import { GLTFLoader } from './GLTFLoader.js';
import { TrackballControls } from './TrackballControl.js';
import Stats from './stats.module.js';

// Variables
let scene;
let camera;
let renderer;
let controls;
let current_vehicle;

const required_elements = [
    "webgl_div",
    "controls_div"
];
const vehicles = {
    pontoon: {
        file: "models/PontoonBoat.glb",
        name: "Pontoon Boat",
        scale: 10,
    },
    submarine: {
        file: "./models/submarine.glb",
        name: "Submarine",
        scale: 10,
    },
    getCurrentSelection: function () {
        return "pontoon";
    },
    selection_element_id: "vehicle_selection_list",
};

//initialize and start rendering
export function renderView(page_elements) {

    let required_keys = Object.keys(page_elements);
    for (let i = 0; i < required_elements.length; i++) {
        if (!required_keys.includes(required_elements[i])) {
            console.log("Can't render page, missing required element " + required_elements[i]);
            return;
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        initControls(page_elements);
        init3D(page_elements);
        animate();
    })

}

/**
 * Generate the DOM controls for the page.
 */
function initControls(page_elements) {
    let controls_div = document.getElementById(page_elements.controls_div);

    /**
     * Vehicle Controls and selection.
     */
    {
        let vehicle_div = document.createElement("div");
        vehicle_div.id = "vehicle_controls"

    }
}

/**
 * Generate the 3d parts of the page.
 * @param {object} page_elements 
 */
function init3D(page_elements) {
    let container_3d = document.getElementById(page_elements.webgl_div);
    container_3d.id = "webGL_container";

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, container_3d.clientWidth / container_3d.clientHeight, 0.1, 50000);

    renderer = new THREE.WebGLRenderer()
    renderer.setSize(container_3d.clientWidth, container_3d.clientHeight);
    container_3d.appendChild(renderer.domElement);

    controls = new TrackballControls(camera, renderer.domElement);

    // Load Light
    let ambientLight = new THREE.AmbientLight(0x333333);
    let pointLight = new THREE.PointLight(0xFFFFFF, 1, 4000);
    pointLight.position.set(500, 500, 500);
    scene.add(ambientLight, pointLight);

    //load default selected object.
    loadObjectIntoScene(vehicles.getCurrentSelection());

    camera.position.z = 5000;

    //let axis = new THREE.AxesHelper(500);
    //scene.add(axis);

    function drawAxis(direction, color = 0xFFFFFF, extents = 50000, tab_length = 20) {
        const step = 1000;

        let material = new THREE.LineBasicMaterial({
            color: color
        });

        let direction_vec = new THREE.Vector3(direction[0], direction[1], direction[2]);

        let main_line = new THREE.Geometry();
        main_line.vertices.push(
            (new THREE.Vector3(1, 1, 1)).multiply(direction_vec).multiplyScalar(extents),
            (new THREE.Vector3(1, 1, 1)).multiply(direction_vec).multiplyScalar(-1.0 * extents),
        );

        var line = new THREE.Line(main_line, material);
        scene.add(line);

        let tab_material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: false
        });
        for (let i = 0; i < extents / step; i++) {
            let pos_tab = new THREE.SphereGeometry(tab_length, 10, 10);
            let neg_tab = new THREE.SphereGeometry(tab_length);

            let tab_pos = (new THREE.Vector3(1, 1, 1)).multiply(direction_vec).multiplyScalar(i * step);
            pos_tab.translate(tab_pos.x, tab_pos.y, tab_pos.z);
            tab_pos.multiplyScalar(-1);
            neg_tab.translate(tab_pos.x, tab_pos.y, tab_pos.z);

            let pos_line = new THREE.Mesh(pos_tab, tab_material);
            let neg_line = new THREE.Mesh(neg_tab, tab_material);

            scene.add(pos_line);
            scene.add(neg_line);
        }
    }

    drawAxis([1, 0, 0]);
    drawAxis([0, 1, 0]);
    drawAxis([0, 0, 1]);
}


/**
 * Animate the scene.
 */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}


function loadObjectIntoScene(selected_object) {
    if (!vehicles[selected_object]) {
        console.log("Could not load requested model " + selected_object + ". Does not exist.");
        return;
    }

    let loader = new GLTFLoader();
    loader.load(vehicles[selected_object].file, function (gltf) {
        let scale = vehicles[selected_object].scale;
        gltf.scene.scale.set(scale, scale, scale);
        gltf.scene.position.x = 0;				    //Position (x = right+ left-) 
        gltf.scene.position.y = 0;				    //Position (y = up+, down-)
        gltf.scene.position.z = 0;

        gltf.scene.traverse((o) => {
            if (o.isMesh) {
                o.material = new THREE.MeshPhongMaterial({
                    color: 0x00ff00,
                    flatShading: true,
                    transparent: true,
                    opacity: 0.6,
                });
                //o.material.wireframe = true;
            }
        });

        if (current_vehicle) {
            scene.remove(current_vehicle);
        }
        current_vehicle = gltf.scene;
        scene.add(gltf.scene);
    }, undefined, function (error) {
        console.error(error);
    });

}