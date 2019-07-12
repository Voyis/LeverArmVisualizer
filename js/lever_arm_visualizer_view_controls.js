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
let scene_inset;
let camera_inset;
let renderer_inset;
let axes_inset;
let controls;
let current_vehicle;


const required_elements = [
    "webgl_div",
    "controls_div",
];

function LoadableModel(file, name, scale, default_size, rotation, offset) {
    if (this instanceof LoadableModel === false) {
        return new LoadableModel(file, name, scale, default_size, rotation, offset);
    }
    this.file = file;
    this.name = name;
    this.scale = scale;
    this.default_size = default_size;
    this.rotation = rotation;
    this.offset = offset;
}

const vehicles = {
    pontoon: new LoadableModel(
        "models/PontoonBoat.glb",
        "Pontoon Boat",
        5,
        4.0,
        [0, 0, Math.PI], //roll pitch yaw, radians
        [0, 0, 0]),
    submarine: new LoadableModel(
        "./models/submarine.glb",
        "Submarine",
        0.5,
        5,
        [0, 0, -Math.PI / 2], //roll pitch yaw, radians
        [0, 0, 0]),
};

const sensors = {
    //single_gps: new LoadableModel(),
    //dual_gps: new LoadableModel(),
    //dvl: new LoadableModel(),
    pro: new LoadableModel(
        "./models/ULS500Pro.glb",
        "ULS500 Pro",
        1,
        1, //m at 0.5scale
        [0, Math.PI / 2, -Math.PI / 2],//roll pitch yaw, radians
        [60, 634, 231.5]),
    //ULS500Micro: new LoadableModel("./models/ULS500Micro.glb", "ULS500 Micro", 1.0, 1.0, [0, 0, 0]),
}

function ModelAdjustments(default_scale, default_size) {
    if (this instanceof ModelAdjustments === false) {
        return new ModelAdjustments(default_scale, default_size);
    }

    this.default_scale = default_scale;
    this.default_size = default_size;
    this.scale_element = document.createElement("INPUT");
    this.scale_element.type = "number";
    this.scale_element.step = 0.1
    this.scale_element.min = 0.5;
    this.scale_element.max = 20.;
    this.scale_element.value = this.default_size;
    this.scale_element.addEventListener("change", redrawScene);

    this.x1_element = document.createElement("input");
    this.x2_element = document.createElement("input");
    this.x3_element = document.createElement("input");

    this.x1_element.type = "number";
    this.x1_element.min = -10;
    this.x1_element.max = 10;
    this.x1_element.step = 0.001;
    this.x1_element.value = 0.0;
    this.x1_element.addEventListener("change", redrawScene);
    this.x2_element.type = "number";
    this.x2_element.min = -10;
    this.x2_element.max = 10;
    this.x2_element.step = 0.001;
    this.x2_element.value = 0.0;
    this.x2_element.addEventListener("change", redrawScene);
    this.x3_element.type = "number";
    this.x3_element.min = -10;
    this.x3_element.max = 10;
    this.x3_element.step = 0.001;
    this.x3_element.value = 0.0;
    this.x3_element.addEventListener("change", redrawScene);

    this.roll_element = document.createElement("input");
    this.pitch_element = document.createElement("input");
    this.yaw_element = document.createElement("input");

    this.roll_element.type = "number";
    this.roll_element.min = -90;
    this.roll_element.max = 90;
    this.roll_element.step = 0.1;
    this.roll_element.value = 0.0;
    this.roll_element.addEventListener("change", redrawScene);
    this.pitch_element.type = "number";
    this.pitch_element.min = -180;
    this.pitch_element.max = 180;
    this.pitch_element.step = 0.1;
    this.pitch_element.value = 0.0;
    this.pitch_element.addEventListener("change", redrawScene);
    this.yaw_element.type = "number";
    this.yaw_element.min = -180;
    this.yaw_element.max = 180;
    this.yaw_element.step = 0.1;
    this.yaw_element.value = 0.0;
    this.yaw_element.addEventListener("change", redrawScene);

    this.base_rotation = [0, 0, 0]; //basic rotation to align co-ordinates of vehicle
}

ModelAdjustments.prototype.scale = function () {
    return this.default_scale * this.scale_element.value / this.default_size;
}

ModelAdjustments.prototype.translation = function () {
    return new THREE.Vector3(Number(this.x1_element.value), Number(this.x2_element.value), Number(this.x3_element.value)).multiplyScalar(1000.0);
}

ModelAdjustments.prototype.euler_angles = function () {
    return new THREE.Euler(Number(this.roll_element.value) * Math.PI / 180, Number(this.pitch_element.value) * Math.PI / 180, Number(this.yaw_element.value) * Math.PI / 180);
}

ModelAdjustments.prototype.quaternion = function () {
    return new THREE.Quaternion().setFromEuler(this.euler_angles());
}

let vehicle_adjust = new ModelAdjustments(vehicles["pontoon"].scale, vehicles["pontoon"].default_size);
let sensors_adjust = {};

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
        let content_veh_over = document.createElement("div");
        let content_veh = document.createElement("div");
        content_veh.id = "vehicle_controls";
        content_veh_over.classList.add("content");
        content_veh_over.style.display = "none";
        content_veh_over.appendChild(content_veh);
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
                loadVehicleIntoScene(keys[i]);
            });
            let radio_label = document.createTextNode(vehicles[keys[i]].name);
            vehicle_select_div.appendChild(radio_button);
            vehicle_select_div.appendChild(radio_label);
            vehicle_select_div.appendChild(document.createElement("BR"));
        }

        //Vehicle Scale
        let vehicle_adjust_label = document.createElement("h2");
        vehicle_adjust_label.innerHTML = "Vehicle Length (approx)"

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

        //X1 or X2 forward
        let x1_forward = document.createElement("input");
        x1_forward.type = "radio";
        x1_forward.name = "forward"
        x1_forward.value = "x1_forward";
        x1_forward.checked = true;
        x1_forward.addEventListener("change", setForwardDirection);
        let x2_forward = document.createElement("input");
        x2_forward.type = "radio";
        x2_forward.name = "forward"
        x2_forward.value = "x2_forward";
        x2_forward.addEventListener("change", setForwardDirection);
        vehicle_orient_div.appendChild(x1_forward);
        vehicle_orient_div.appendChild(document.createTextNode("X1 Forward"));
        vehicle_orient_div.appendChild(x2_forward);
        vehicle_orient_div.appendChild(document.createTextNode("X2 Forward"));

        function setForwardDirection() {
            if (x1_forward.checked) {
                vehicle_adjust.base_rotation[2] = 0;
            } else {
                vehicle_adjust.base_rotation[2] = Math.PI / 2;
            }
            redrawScene();
        }

        let vehicle_up_label = document.createElement("h3");
        vehicle_up_label.innerHTML = "Up Direction";
        vehicle_orient_div.appendChild(vehicle_up_label);

        //x3 up or down?
        let x3_up = document.createElement("input");
        x3_up.type = "radio";
        x3_up.name = "updown"
        x3_up.value = "x3_up";
        x3_up.checked = true;
        x3_up.addEventListener("change", setUpDirection);
        let x3_down = document.createElement("input");
        x3_down.type = "radio";
        x3_down.name = "updown"
        x3_down.value = "x3_down";
        x3_down.addEventListener("change", setUpDirection);
        vehicle_orient_div.appendChild(x3_up);
        vehicle_orient_div.appendChild(document.createTextNode("X3 Up Positive"));
        vehicle_orient_div.appendChild(x3_down);
        vehicle_orient_div.appendChild(document.createTextNode("X3 Down Positive"));

        function setUpDirection() {
            if (x3_up.checked) {
                vehicle_adjust.base_rotation[0] = 0;
            } else {
                vehicle_adjust.base_rotation[0] = Math.PI;
            }
            redrawScene();
        }

        content_veh.appendChild(vehicle_orient_div);

        //Vehicle Offsets
        let vehicle_offset_div = document.createElement("div");
        vehicle_offset_div.id = "vehicle_offsets";
        let vehicle_offset_label = document.createElement("h2");
        vehicle_offset_label.innerHTML = "CRP Offset";
        vehicle_offset_div.appendChild(vehicle_offset_label);

        let tran_offset_label = document.createElement("h3");
        tran_offset_label.innerHTML = "Translation (X1, X2, X3)(m)";
        vehicle_offset_div.appendChild(tran_offset_label);
        vehicle_offset_div.appendChild(vehicle_adjust.x1_element);
        vehicle_offset_div.appendChild(vehicle_adjust.x2_element);
        vehicle_offset_div.appendChild(vehicle_adjust.x3_element);

        let rot_offset_label = document.createElement("h3");
        rot_offset_label.innerHTML = "Rotation (Roll, Pitch, Yaw)(degrees)";
        vehicle_offset_div.appendChild(rot_offset_label);
        vehicle_offset_div.appendChild(vehicle_adjust.roll_element);
        vehicle_offset_div.appendChild(vehicle_adjust.pitch_element);
        vehicle_offset_div.appendChild(vehicle_adjust.yaw_element);

        content_veh.appendChild(vehicle_offset_div);

        vehicle_div.appendChild(content_veh_over);

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

        let sensor_content_div = document.createElement("div");
        content_sense.appendChild(sensor_content_div);

        let sensor_select = document.createElement("div");
        let sensor_select_header = document.createElement("h2");
        sensor_select_header.innerHTML = "Sensor Selection";
        sensor_select.appendChild(sensor_select_header);

        let keys = Object.keys(sensors);
        for (let i = 0; i < keys.length; i++) {
            let radio_button = document.createElement("input");
            radio_button.type = "radio";
            radio_button.name = "sensors";
            radio_button.value = keys[i];
            if (i === 0) {
                radio_button.checked = true;
            }
            let radio_label = document.createTextNode(sensors[keys[i]].name);
            sensor_select.appendChild(radio_button);
            sensor_select.appendChild(radio_label);
        }
        sensor_select.appendChild(document.createElement("br"));
        let add_sensor_button = document.createElement("button");
        add_sensor_button.innerHTML = "Add Sensor";
        add_sensor_button.addEventListener("click", () => { loadSensorIntoScene(getSensorSelection()) });
        sensor_select.appendChild(add_sensor_button);

        sensor_content_div.appendChild(sensor_select);
        let added_sensor_div = document.createElement("div");
        added_sensor_div.id = "added_sensor_div";
        sensor_content_div.appendChild(added_sensor_div);
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

function getSensorSelection() {
    let radios = document.getElementsByName("sensors");
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
    let container = document.getElementById(page_elements.webgl_div);
    let container_3d = document.createElement('div');
    container_3d.id = "webGL_container";
    let inset_div = document.createElement("div");
    inset_div.id = "inset";
    container.appendChild(container_3d);
    container.appendChild(inset_div);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, container_3d.clientWidth / container_3d.clientHeight, 0.1, 50000);

    renderer = new THREE.WebGLRenderer()
    renderer.setSize(container_3d.clientWidth, container_3d.clientHeight);
    renderer.setClearColor(0xf0f0f0, 1);
    container_3d.appendChild(renderer.domElement);
    renderer_inset = new THREE.WebGLRenderer({ alpha: true });
    renderer_inset.setClearColor(0x000000, 0);
    renderer_inset.setSize(inset_div.clientWidth, inset_div.clientHeight);
    inset_div.appendChild(renderer_inset.domElement);

    // scene_inset
    scene_inset = new THREE.Scene();

    // camera
    camera_inset = new THREE.PerspectiveCamera(75, inset_div.clientWidth / inset_div.clientHeight, 0.1, 50000);
    camera_inset.up = camera.up; // important!

    // axes
    axes_inset = new THREE.AxesHelper(100);
    scene_inset.add(axes_inset);

    controls = new TrackballControls(camera, renderer.domElement);

    // Load Light
    let ambientLight = new THREE.AmbientLight(0x333333);
    let pointLight = new THREE.PointLight(0xFFFFFF, 1, 4000);
    pointLight.position.set(500, 500, 500);
    scene.add(ambientLight, pointLight);

    //load default selected object.
    loadVehicleIntoScene("pontoon");

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

    camera_inset.position.copy(camera.position);
    camera_inset.position.sub(controls.target);
    camera_inset.position.setLength(200);

    camera_inset.lookAt(scene_inset.position);

    renderer.render(scene, camera);
    renderer_inset.render(scene_inset, camera_inset)
}

/**
 * Updates scene elements and calls for a render.
 */
function redrawScene() {
    //adjust vehicle
    if (current_vehicle) {
        current_vehicle.matrixAutoUpdate = false;

        let scale = vehicle_adjust.scale();
        let vehicle_scale = new THREE.Vector3(scale, scale, scale);

        //correct for model (align forward with x and up with z).
        let model_offset = new THREE.Vector3(...vehicles[getVehicleSelection()].offset);
        let model_rot = new THREE.Euler(...vehicles[getVehicleSelection()].rotation);
        let model_quat = new THREE.Quaternion().setFromEuler(model_rot);
        let model_matrix = new THREE.Matrix4().compose(model_offset, model_quat, vehicle_scale);

        //Adjust vehicle_co-ords.
        let base_rot = new THREE.Euler(...vehicle_adjust.base_rotation);
        let base_quat = new THREE.Quaternion().setFromEuler(base_rot);
        let base_matrix = new THREE.Matrix4().makeRotationFromQuaternion(base_quat);

        //Move vehicle reference point.
        let crp_pos = vehicle_adjust.translation();
        let crp_quat = vehicle_adjust.quaternion();
        let crp_matrix = new THREE.Matrix4().compose(crp_pos, crp_quat, new THREE.Vector3(1, 1, 1));

        //Set the vehicle pose
        current_vehicle.matrix = crp_matrix.multiply(base_matrix.multiply(model_matrix));

        //loop through the loaded sensor and get their positions relative the the vehicle
        let sensors_list = document.getElementById("added_sensor_div");
        [].forEach.call(sensors_list.childNodes, (sensor_div) => {
            let sensor_id = sensor_div.id;

            if (!sensors_adjust[sensor_id]) {
                console.log("No sensor id matching " + sensor_id);
                return;
            }

            let sensor_name = sensors_adjust[sensor_id].model_id;
            if (!sensors[sensor_name]) {
                console.log("No sensor name matching " + sensor_name);
                return;
            }

            sensors_adjust[sensor_id].scene.matrixAutoUpdate = false;

            let sensor_scale = sensors_adjust[sensor_id].scale();
            let sensor_scale_vec = new THREE.Vector3(sensor_scale, sensor_scale, sensor_scale);

            //sensor base transform
            let sensor_offset = new THREE.Vector3(...sensors[sensor_name].offset);
            let sensor_rot = new THREE.Euler(...sensors[sensor_name].rotation);
            let sensor_quat = new THREE.Quaternion().setFromEuler(sensor_rot);
            let sensor_matrix = new THREE.Matrix4().compose(sensor_offset, sensor_quat, sensor_scale_vec);

            //lever arm transform
            let lever_pos = sensors_adjust[sensor_id].translation();
            let lever_quat = sensors_adjust[sensor_id].quaternion();
            let lever_matrix = new THREE.Matrix4().compose(lever_pos, lever_quat, new THREE.Vector3(1, 1, 1));

            let final_sensor_transform = lever_matrix.multiply(sensor_matrix);

            sensors_adjust[sensor_id].scene.matrix = final_sensor_transform;
        })



    }
}

function loadSensorIntoScene(selected_sensor) {
    if (!sensors[selected_sensor]) {
        console.log("Could not load requested model " + selected_sensor + ". Does not exist.");
        return;
    }

    loadObjectIntoScene(sensors[selected_sensor].file, sensorLoadCallback);

    function sensorLoadCallback(gltf) {

        //create new adjust element for the sensor
        let new_sensor_id = selected_sensor + "_" + String(Date.now());
        sensors_adjust[new_sensor_id] = new ModelAdjustments(sensors[selected_sensor].scale, sensors[selected_sensor].default_size);
        sensors_adjust[new_sensor_id].scale_element.value = sensors[selected_sensor].default_size;
        sensors_adjust[new_sensor_id].model_id = selected_sensor;

        //add appropriate elements to the display
        let sensor_list_div = document.getElementById("added_sensor_div");
        let sensor_div = document.createElement("div");
        sensor_div.id = new_sensor_id;
        let sensor_header = document.createElement("h2");
        sensor_header.innerHTML = sensors[selected_sensor].name;
        sensor_div.appendChild(sensor_header);

        let sensor_lever = document.createElement("div");
        sensor_lever.class = "levers";
        let sensor_translation = document.createElement("div");
        sensor_translation.class = "lever_translation";
        let sensor_rotation = document.createElement("div");
        sensor_rotation.class = "lever_rotation";

        let trans_header = document.createElement("h3");
        trans_header.innerHTML = "Translation (X1, X2, X3)(m)";
        sensor_translation.appendChild(trans_header);
        sensor_translation.appendChild(sensors_adjust[new_sensor_id].x1_element);
        sensor_translation.appendChild(sensors_adjust[new_sensor_id].x2_element);
        sensor_translation.appendChild(sensors_adjust[new_sensor_id].x3_element);

        let rot_header = document.createElement("h3");
        rot_header.innerHTML = "Rotation (Roll, Pitch, Yaw)(degrees)";
        sensor_rotation.appendChild(rot_header);
        sensor_rotation.appendChild(sensors_adjust[new_sensor_id].roll_element);
        sensor_rotation.appendChild(sensors_adjust[new_sensor_id].pitch_element);
        sensor_rotation.appendChild(sensors_adjust[new_sensor_id].yaw_element);

        sensor_lever.appendChild(sensor_translation);
        sensor_lever.appendChild(sensor_rotation);
        sensor_div.appendChild(sensor_lever);

        sensor_list_div.appendChild(sensor_div);

        //set the model colour to red.
        gltf.scene.traverse((o) => {
            if (o.isMesh) {
                o.material = new THREE.MeshPhongMaterial({
                    color: 0xff0000,
                    flatShading: true,
                    transparent: false,
                });
                //o.material.wireframe = true;
            }
        });

        sensors_adjust[new_sensor_id].scene = gltf.scene;
    }
}

function loadVehicleIntoScene(selected_vehicle) {
    if (!vehicles[selected_vehicle]) {
        console.log("Could not load requested model " + selected_vehicle + ". Does not exist.");
        return;
    }

    loadObjectIntoScene(vehicles[selected_vehicle].file, vehicleLoadCallback);

    function vehicleLoadCallback(gltf) {
        vehicle_adjust.scale_element.value = vehicles[selected_vehicle].default_size;
        vehicle_adjust.default_scale = vehicles[selected_vehicle].scale;
        vehicle_adjust.default_size = vehicles[selected_vehicle].default_size;
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
    }
}

function loadObjectIntoScene(filename, loadCallback) {

    let loader = new GLTFLoader();
    loader.load(filename, function (gltf) {
        loadCallback(gltf);
        redrawScene();
        scene.add(gltf.scene);
    }, undefined, function (error) {
        console.error(error);
    });
}