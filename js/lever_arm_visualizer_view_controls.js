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
        scale: 5,
        default_size: 4.0, //m at 10 scale
        rotation: [0, 0, 0], //roll pitch yaw, degrees
    },
    submarine: {
        file: "./models/submarine.glb",
        name: "Submarine",
        scale: 0.5,
        default_size: 4.0, //m at 0.5scale
        rotation: [0, 0, -90], //roll pitch yaw, degrees
    },
};
let vehicle_adjust = {
    scale_element: document.createElement("INPUT"),
    get scale() {
        let current_selected_vehicle = getVehicleSelection();
        let default_scale = vehicles[current_selected_vehicle].scale;
        let default_size = vehicles[current_selected_vehicle].default_size;
        return default_scale * this.scale_element.value / default_size;
    },
    x1_element: document.createElement("input"),
    x2_element: document.createElement("input"),
    x3_element: document.createElement("input"),
    get translation() {
        return [x1_element.value, x2_element.value, x3_element.value];
    }, //user specified offsets
    roll_element: document.createElement("input"),
    pitch_element: document.createElement("input"),
    yaw_element: document.createElement("input"),
    get rotation() {
        return [roll_element.value, pitch_element.value, yaw_element.value];
    }, //user specified offsets
    base_rotation: [0, 0, 0], //basic rotation to align co-ordinates of vehicle
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
     * Vehicle Controls and Selection.
     */
    {
        let vehicle_div = document.createElement("div");
        vehicle_div.id = "vehicle_div";
        let button = document.createElement("button");
        button.className = "collapsible";
        button.innerHTML = "Vehicle Controls";
        let content_veh = document.createElement("div");
        content_veh.id = "vehicle_controls";
        content_veh.classList.add("content");
        content_veh.style.display = "none";
        button.addEventListener("click", clickCollapsible);
        vehicle_div.appendChild(button);
        let vehicle_select_div = document.createElement("div");
        vehicle_select_div.id = "vehicle_selection";
        let vehicle_select_title = document.createElement("h2");
        vehicle_select_title.innerHTML = "Vehicle Selection";
        vehicle_select_div.appendChild(vehicle_select_title);

        let keys = Object.keys(vehicles);
        for (let i = 0; i < keys.length; i++) {
            let radio_button = document.createElement("input");
            radio_button.type = "radio";
            radio_button.name = "vehicles";
            radio_button.value = keys[i];
            if (i === 0) {
                radio_button.checked = true;
            }
            radio_button.addEventListener("change", function () {
                loadObjectIntoScene(keys[i]);
            });
            let radio_label = document.createTextNode(vehicles[keys[i]].name);
            vehicle_select_div.appendChild(radio_button);
            vehicle_select_div.appendChild(radio_label);
            vehicle_select_div.appendChild(document.createElement("BR"));
        }

        //Vehicle Scale
        let vehicle_adjust_label = document.createElement("h2");
        vehicle_adjust_label.innerHTML = "Vehicle Length (approx)"
        vehicle_adjust.scale_element.type = "number";
        vehicle_adjust.scale_element.step = 0.1
        vehicle_adjust.scale_element.min = 2;
        vehicle_adjust.scale_element.max = 20.;
        vehicle_adjust.scale_element.value = vehicles[keys[0]].default_size;
        vehicle_adjust.scale_element.addEventListener("change", redrawScene);
        vehicle_select_div.appendChild(vehicle_adjust_label);
        vehicle_select_div.appendChild(vehicle_adjust.scale_element);
        vehicle_select_div.appendChild(document.createTextNode(" m"));

        content_veh.appendChild(vehicle_select_div);

        //Vehicle Orientation
        let vehicle_orient_div = document.createElement("div");
        vehicle_orient_div.id = "vehicle_orientation";
        let vehicle_orient_label = document.createElement("h2");
        vehicle_orient_label.innerHTML = "Orientation";
        vehicle_orient_div.appendChild(vehicle_orient_label);
        let vehicle_forward_label = document.createElement("h3");
        vehicle_forward_label.innerHTML = "Forward Direction";
        vehicle_orient_div.appendChild(vehicle_forward_label);
        let vehicle_up_label = document.createElement("h3");
        vehicle_up_label.innerHTML = "Up Direction";
        vehicle_orient_div.appendChild(vehicle_up_label);

        content_veh.appendChild(vehicle_orient_div);

        //Vehicle Offsets
        let vehicle_offset_div = document.createElement("div");
        vehicle_offset_div.id = "vehicle_offsets";
        let vehicle_offset_label = document.createElement("h2");
        vehicle_offset_label.innerHTML = "CRP Offset";

        let tran_offset_label = document.createElement("h3");

        let rot_offset_label = document.createElement("h3");


        vehicle_div.appendChild(content_veh);

        controls_div.appendChild(vehicle_div);
    }

    /**
     * Sensor Controls and Selection.
     */
    {
        let sensor_div = document.createElement("div");
        sensor_div.id = "sensor_div";
        let button = document.createElement("button");
        button.className = "collapsible";
        button.innerHTML = "Sensor Controls";
        let content_sense = document.createElement("div");
        content_sense.id = "sensor_controls";
        content_sense.classList.add("content");
        content_sense.style.display = "none";
        button.addEventListener("click", clickCollapsible);
        sensor_div.appendChild(button);
        sensor_div.appendChild(content_sense);
        controls_div.appendChild(sensor_div);
    }


    function clickCollapsible() {
        this.classList.toggle("active");
        let content = this.nextSibling;
        if (content.style.display === "block") {
            content.style.display = "none";
        } else {
            content.style.display = "block";
        }
    };
}

function getVehicleSelection() {
    let radios = document.getElementsByName("vehicles");
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            return radios[i].value;
        }
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
    loadObjectIntoScene("pontoon");

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

    drawAxis([1, 0, 0], 0xFF0000);
    drawAxis([0, 1, 0], 0x00FF00);
    drawAxis([0, 0, 1], 0x0000FF);
}


/**
 * Animate the scene.
 */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

/**
 * Updates scene elements and calls for a render.
 */
function redrawScene() {
    //adjust vehicle
    if (current_vehicle) {
        let scale = vehicle_adjust.scale;
        current_vehicle.scale.set(scale, scale, scale);
    }
}

function loadObjectIntoScene(selected_object) {
    if (!vehicles[selected_object]) {
        console.log("Could not load requested model " + selected_object + ". Does not exist.");
        return;
    }

    let loader = new GLTFLoader();
    loader.load(vehicles[selected_object].file, function (gltf) {
        let scale = vehicle_adjust.scale;
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