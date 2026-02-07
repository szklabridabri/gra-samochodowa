/* global THREE, io */
const socket = io();

const overlay = document.getElementById("overlay");
const panels = document.querySelectorAll(".panel");
const carSelect = document.getElementById("car-select");
const joinButton = document.getElementById("join-game");
const playerNameInput = document.getElementById("player-name");
const carColorInput = document.getElementById("car-color");
const cameraModeSelect = document.getElementById("camera-mode");
const controlModeSelect = document.getElementById("control-mode");
const garageList = document.getElementById("garage-list");
const speedValue = document.getElementById("speed-value");
const gearValue = document.getElementById("gear-value");
const speedometerDial = document.querySelector("#speedometer .dial");
const nitroBar = document.querySelector("#nitro .nitro-bar");
const minimap = document.getElementById("minimap");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

const minimapCtx = minimap.getContext("2d");
minimap.width = 256;
minimap.height = 256;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.2);
sunLight.position.set(120, 200, 80);
scene.add(sunLight);

const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 32, 32);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1a3b2d, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.6 });
const track = new THREE.Mesh(new THREE.RingGeometry(120, 220, 64), trackMaterial);
track.rotation.x = -Math.PI / 2;
track.position.y = 0.01;
scene.add(track);

const obstacles = [];
for (let i = 0; i < 40; i += 1) {
  const obstacle = new THREE.Mesh(
    new THREE.BoxGeometry(8, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x2f4858 })
  );
  obstacle.position.set(
    (Math.random() - 0.5) * 700,
    5,
    (Math.random() - 0.5) * 700
  );
  obstacles.push(obstacle);
  scene.add(obstacle);
}

const carModels = {};
const remoteCars = new Map();
let carConfigs = [];
let localCar = null;
let localState = null;
let joined = false;

const controlsState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  drift: false,
  nitro: false
};

const maxBounds = 900;

const createCar = (color) => {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 1.2, 9),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 1.4;

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.3, 3.5),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  cabin.position.set(0, 2.1, -0.5);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.6, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  hood.position.set(0, 1.8, 2.5);

  group.add(body, cabin, hood);
  return group;
};

const showPanel = (id) => {
  panels.forEach((panel) => panel.classList.remove("active"));
  document.getElementById(id).classList.add("active");
};

document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", () => showPanel(button.dataset.target));
});

const updateGarage = () => {
  garageList.innerHTML = "";
  carConfigs.forEach((car) => {
    const card = document.createElement("div");
    card.className = "garage-card";
    card.innerHTML = `
      <h4>${car.name}</h4>
      <p>Prędkość maks.: ${car.maxSpeed} m/s</p>
      <p>Przyspieszenie: ${car.acceleration}</p>
      <p>Kontrola: ${car.handling.toFixed(2)}</p>
    `;
    garageList.appendChild(card);
  });
};

const updateHud = (speed, nitro) => {
  const displaySpeed = Math.round(speed * 3.6);
  speedValue.textContent = `${displaySpeed} km/h`;
  const gear = Math.max(1, Math.ceil(displaySpeed / 40));
  gearValue.textContent = `Bieg ${gear}`;
  speedometerDial.style.setProperty("--speed-fill", `${Math.min(displaySpeed / 260, 1) * 100}%`);
  nitroBar.style.setProperty("--nitro-fill", `${nitro * 100}%`);
};

const updateMinimap = (position, otherCars) => {
  minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
  minimapCtx.fillStyle = "#0b1d29";
  minimapCtx.fillRect(0, 0, minimap.width, minimap.height);

  const scale = 0.12;
  const center = minimap.width / 2;

  minimapCtx.strokeStyle = "#3ad2ff";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.arc(center, center, 50, 0, Math.PI * 2);
  minimapCtx.stroke();

  minimapCtx.fillStyle = "#ff5b5b";
  minimapCtx.beginPath();
  minimapCtx.arc(center + position.x * scale, center + position.z * scale, 4, 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.fillStyle = "#a3e635";
  otherCars.forEach((car) => {
    minimapCtx.beginPath();
    minimapCtx.arc(center + car.position.x * scale, center + car.position.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  });
};

const applyPhysics = (delta) => {
  if (!localCar || !localState) return;

  const config = carConfigs.find((car) => car.id === localState.carId) || carConfigs[0];
  const acceleration = config.acceleration;
  const maxSpeed = config.maxSpeed;
  const handling = config.handling;

  if (controlsState.forward) {
    localState.speed += acceleration * delta;
  }
  if (controlsState.backward) {
    localState.speed -= acceleration * 0.6 * delta;
  }

  if (!controlsState.forward && !controlsState.backward) {
    localState.speed *= 0.98;
  }

  if (controlsState.nitro && localState.nitro > 0) {
    localState.speed += acceleration * 1.6 * delta;
    localState.nitro = Math.max(0, localState.nitro - delta * 0.35);
  } else {
    localState.nitro = Math.min(1, localState.nitro + delta * 0.1);
  }

  localState.speed = Math.max(-maxSpeed * 0.3, Math.min(maxSpeed, localState.speed));

  const turnSpeed = (controlsState.left ? 1 : 0) - (controlsState.right ? 1 : 0);
  const driftFactor = controlsState.drift || controlModeSelect.value === "drift" ? 0.65 : 1.0;
  localState.rotation.y += turnSpeed * handling * driftFactor * delta * (localState.speed / maxSpeed + 0.4);

  const forwardVector = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), localState.rotation.y);
  const movement = forwardVector.multiplyScalar(localState.speed * delta * 2.2);
  localState.position.x += movement.x;
  localState.position.z += movement.z;

  localState.position.x = THREE.MathUtils.clamp(localState.position.x, -maxBounds, maxBounds);
  localState.position.z = THREE.MathUtils.clamp(localState.position.z, -maxBounds, maxBounds);

  obstacles.forEach((obstacle) => {
    const distance = obstacle.position.distanceTo(localCar.position);
    if (distance < 8) {
      const push = localCar.position.clone().sub(obstacle.position).normalize();
      localState.position.x += push.x * 2.5;
      localState.position.z += push.z * 2.5;
      localState.speed *= 0.4;
    }
  });

  localCar.position.set(localState.position.x, localState.position.y, localState.position.z);
  localCar.rotation.y = localState.rotation.y;

  updateHud(Math.abs(localState.speed), localState.nitro);
};

const updateCamera = () => {
  if (!localCar) return;
  if (cameraModeSelect.value === "hood") {
    const hoodOffset = new THREE.Vector3(0, 2.2, 3.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), localCar.rotation.y);
    camera.position.copy(localCar.position.clone().add(hoodOffset));
    camera.lookAt(localCar.position.clone().add(new THREE.Vector3(0, 1.5, 10).applyAxisAngle(new THREE.Vector3(0, 1, 0), localCar.rotation.y)));
  } else {
    const chaseOffset = new THREE.Vector3(0, 8, -16).applyAxisAngle(new THREE.Vector3(0, 1, 0), localCar.rotation.y);
    camera.position.copy(localCar.position.clone().add(chaseOffset));
    camera.lookAt(localCar.position.clone().add(new THREE.Vector3(0, 2, 6).applyAxisAngle(new THREE.Vector3(0, 1, 0), localCar.rotation.y)));
  }
};

const animate = () => {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  applyPhysics(delta);
  updateCamera();

  const otherCars = Array.from(remoteCars.values());
  updateMinimap(localState?.position || { x: 0, z: 0 }, otherCars);

  renderer.render(scene, camera);

  if (joined && localState) {
    socket.emit("state:update", {
      position: localState.position,
      rotation: localState.rotation,
      speed: localState.speed
    });
  }
};

const clock = new THREE.Clock();

const handleResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener("resize", handleResize);

const keyMap = {
  KeyW: "forward",
  KeyS: "backward",
  KeyA: "left",
  KeyD: "right",
  Space: "drift",
  ShiftLeft: "nitro",
  ShiftRight: "nitro"
};

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyC") {
    cameraModeSelect.value = cameraModeSelect.value === "third" ? "hood" : "third";
  }
  const mapped = keyMap[event.code];
  if (mapped) {
    controlsState[mapped] = true;
  }
});

window.addEventListener("keyup", (event) => {
  const mapped = keyMap[event.code];
  if (mapped) {
    controlsState[mapped] = false;
  }
});

joinButton.addEventListener("click", () => {
  const name = playerNameInput.value.trim() || "Gracz";
  const carId = carSelect.value;
  const color = carColorInput.value;
  socket.emit("join", { name, carId, color });
  overlay.classList.add("hidden");
  joined = true;
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat:message", { text });
  chatInput.value = "";
});

socket.on("init", (payload) => {
  carConfigs = payload.cars;
  carSelect.innerHTML = carConfigs.map((car) => `<option value="${car.id}">${car.name}</option>`).join("");
  updateGarage();

  payload.players.forEach((player) => {
    if (player.id !== socket.id) {
      const remote = createCar(player.color);
      remote.position.set(player.position.x, player.position.y, player.position.z);
      scene.add(remote);
      remoteCars.set(player.id, remote);
    }
  });
});

socket.on("player:joined", (player) => {
  if (player.id === socket.id) {
    localCar = createCar(player.color);
    localCar.position.set(player.position.x, player.position.y, player.position.z);
    scene.add(localCar);
    localState = {
      carId: player.carId,
      position: { ...player.position },
      rotation: { ...player.rotation },
      speed: player.speed,
      nitro: 0.6
    };
    return;
  }

  if (!remoteCars.has(player.id)) {
    const remote = createCar(player.color);
    remote.position.set(player.position.x, player.position.y, player.position.z);
    scene.add(remote);
    remoteCars.set(player.id, remote);
  }
});

socket.on("state:sync", (player) => {
  if (player.id === socket.id) return;
  const remote = remoteCars.get(player.id);
  if (!remote) return;
  remote.position.set(player.position.x, player.position.y, player.position.z);
  remote.rotation.y = player.rotation.y;
});

socket.on("player:left", (playerId) => {
  const remote = remoteCars.get(playerId);
  if (remote) {
    scene.remove(remote);
    remoteCars.delete(playerId);
  }
});

socket.on("chat:message", (message) => {
  const entry = document.createElement("p");
  const time = new Date(message.ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  entry.textContent = `[${time}] ${message.name}: ${message.text}`;
  chatMessages.appendChild(entry);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

animate();
