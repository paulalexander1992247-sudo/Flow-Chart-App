
const canvas = document.getElementById("canvas");
const emptyState = document.getElementById("empty-state");
const shapeCount = document.getElementById("shape-count");
const clearButton = document.getElementById("clear-button");
const shapeButtons = document.querySelectorAll(".shape-button");

const connectButton = document.getElementById("connect-button");
const deleteConnectionButton = document.getElementById(
  "delete-connection-button"
);
const connectionStatus = document.getElementById("connection-status");

let nextId = 1;
let selectedNode = null;
let selectedConnection = null;
let connectMode = false;
let connectionSource = null;

const connections = [];

// Create the SVG drawing layer.
const svgNS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(svgNS, "svg");

svg.classList.add("connections-layer");
svg.setAttribute("aria-label", "Flowchart connections");
svg.setAttribute("role", "group");

const defs = document.createElementNS(svgNS, "defs");
const marker = document.createElementNS(svgNS, "marker");

marker.setAttribute("id", "arrowhead");
marker.setAttribute("markerWidth", "10");
marker.setAttribute("markerHeight", "10");
marker.setAttribute("refX", "8");
marker.setAttribute("refY", "4");
marker.setAttribute("orient", "auto");
marker.setAttribute("markerUnits", "strokeWidth");

const arrowTip = document.createElementNS(svgNS, "path");
arrowTip.setAttribute("d", "M0,0 L8,4 L0,8 Z");
arrowTip.setAttribute("fill", "#5078b8");

marker.appendChild(arrowTip);
defs.appendChild(marker);
svg.appendChild(defs);

// Keep the arrow layer behind the shapes.
canvas.insertBefore(svg, canvas.firstChild);

function getNodes() {
  return canvas.querySelectorAll(".flow-node");
}

function updateCanvas() {
  const count = getNodes().length;

  shapeCount.textContent =
    count + (count === 1 ? " shape" : " shapes");

  emptyState.hidden = count > 0;
}

function selectNode(node) {
  if (selectedNode) {
    selectedNode.classList.remove("selected");
  }

  selectedNode = node;

  if (selectedNode) {
    selectedNode.classList.add("selected");
  }
}

function setStatus(message) {
  connectionStatus.textContent = message;
}

function addShape(type) {
  const node = document.createElement("div");
  const label = document.createElement("span");

  const names = {
    start: "Start / End",
    process: "New Step",
    decision: "Decision?"
  };

  node.className = "flow-node " + type;
  node.dataset.id = String(nextId++);

  label.className = "node-label";
  label.textContent = names[type];

  node.appendChild(label);
  node.tabIndex = 0;
  node.setAttribute("role", "button");
  node.setAttribute("aria-label", names[type]);

  canvas.appendChild(node);

  const offset = ((getNodes().length - 1) * 22) % 180;

  node.style.left =
    Math.min(30 + offset, Math.max(0,
      canvas.clientWidth - node.offsetWidth)) + "px";

  node.style.top =
    Math.min(30 + offset, Math.max(0,
      canvas.clientHeight - node.offsetHeight)) + "px";

  enableDragging(node);
  enableRenaming(node);

  node.addEventListener("click", function () {
    if (connectMode) {
      handleConnectionClick(node);
    } else {
      selectNode(node);
    }
  });

  selectNode(node);
  updateCanvas();
}

function handleConnectionClick(node) {
  if (!connectionSource) {
    connectionSource = node;
    node.classList.add("connection-source");

    setStatus(
      "Start selected. Now click the shape you want to connect to."
    );
    return;
  }

  if (connectionSource === node) {
    setStatus("Choose a different shape to complete the arrow.");
    return;
  }

  const source = connectionSource;
  const target = node;

  // Prevent duplicate arrows in the same direction.
  const duplicate = connections.some(function (connection) {
    return connection.source === source &&
      connection.target === target;
  });

  if (duplicate) {
    setStatus("These shapes are already connected in that direction.");
    cancelConnectionSource();
    return;
  }

  let label = "";

  if (source.classList.contains("decision")) {
    const existingBranches = connections.filter(function (connection) {
      return connection.source === source;
    }).length;

    const suggestedLabel = existingBranches === 0
      ? "Yes"
      : existingBranches === 1
        ? "No"
        : "";

    const answer = prompt(
      "Label this decision branch (for example, Yes or No):",
      suggestedLabel
    );

    if (answer === null) {
      cancelConnectionSource();
      setStatus("Connection cancelled.");
      return;
    }

    label = answer.trim();

    if (!label) {
      setStatus("Enter a branch label to create this connection.");
      return;
    }
  }

  connections.push({
    id: "connection-" + Date.now() + "-" + nextId++,
    source: source,
    target: target,
    label: label
  });

  cancelConnectionSource();
  selectNode(target);
  drawConnections();

  setStatus(
    label
      ? "Arrow created with the label: " + label
      : "Arrow created successfully."
  );
}

function cancelConnectionSource() {
  if (connectionSource) {
    connectionSource.classList.remove("connection-source");
  }

  connectionSource = null;
}

function getCenter(node) {
  return {
    x: node.offsetLeft + node.offsetWidth / 2,
    y: node.offsetTop + node.offsetHeight / 2
  };
}

function drawConnections() {
  // Keep the arrowhead definition, but redraw all visible connections.
  while (svg.childNodes.length > 1) {
    svg.removeChild(svg.lastChild);
  }

  connections.forEach(function (connection) {
    const source = connection.source;
    const target = connection.target;

    if (!source.isConnected || !target.isConnected) return;

    const start = getCenter(source);
    const end = getCenter(target);

    // Draw a gently curved line between the shape centers.
    const middleX = (start.x + end.x) / 2;
    const middleY = (start.y + end.y) / 2;

    const path = document.createElementNS(svgNS, "path");

    path.setAttribute(
      "d",
      "M " + start.x + " " + start.y +
      " Q " + middleX + " " + middleY +
      " " + end.x + " " + end.y
    );

    path.setAttribute("marker-end", "url(#arrowhead)");
    path.classList.add("connection-line");

    if (selectedConnection === connection) {
      path.classList.add("connection-selected");
    }

    path.addEventListener("click", function (event) {
      event.stopPropagation();

      selectedConnection = connection;
      deleteConnectionButton.disabled = false;
      drawConnections();

      setStatus(
        "Arrow selected. Use Delete selected arrow to remove it."
      );
    });

    svg.appendChild(path);

    if (connection.label) {
      const text = document.createElementNS(svgNS, "text");

      // Place the branch label slightly above the middle of the arrow.
      text.setAttribute("x", middleX);
      text.setAttribute("y", middleY - 12);
      text.classList.add("connection-label");
      text.textContent = connection.label;

      svg.appendChild(text);
    }
  });

  deleteConnectionButton.disabled = !selectedConnection;
}

function enableDragging(node) {
  let startX = 0;
  let startY = 0;
  let originalLeft = 0;
  let originalTop = 0;
  let dragging = false;
  let moved = false;

  node.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;

    event.preventDefault();

    startX = event.clientX;
    startY = event.clientY;
    originalLeft = node.offsetLeft;
    originalTop = node.offsetTop;
    dragging = true;
    moved = false;

    node.setPointerCapture(event.pointerId);
  });

  node.addEventListener("pointermove", function (event) {
    if (!dragging) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      moved = true;
    }

    const maxLeft = Math.max(0,
      canvas.clientWidth - node.offsetWidth);

    const maxTop = Math.max(0,
      canvas.clientHeight - node.offsetHeight);

    node.style.left =
      Math.min(maxLeft, Math.max(0, originalLeft + dx)) + "px";

    node.style.top =
      Math.min(maxTop, Math.max(0, originalTop + dy)) + "px";

    drawConnections();
  });

  node.addEventListener("click", function (event) {
    if (moved) {
      event.stopImmediatePropagation();
      moved = false;
    }
  }, true);

  function stopDragging() {
    dragging = false;
    drawConnections();
  }

  node.addEventListener("pointerup", stopDragging);
  node.addEventListener("pointercancel", stopDragging);
}

function enableRenaming(node) {
  node.addEventListener("dblclick", function (event) {
    event.stopPropagation();

    const label = node.querySelector(".node-label");

    const newText = prompt(
      "Enter a name for this shape:",
      label.textContent
    );

    if (newText !== null && newText.trim() !== "") {
      label.textContent = newText.trim();
      node.setAttribute("aria-label", newText.trim());
    }
  });
}

shapeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    addShape(button.dataset.shape);
  });
});

connectButton.addEventListener("click", function () {
  connectMode = !connectMode;
  cancelConnectionSource();

  connectButton.textContent = connectMode
    ? "Cancel connecting"
    : "Connect two shapes";

  connectButton.setAttribute("aria-pressed", String(connectMode));

  setStatus(
    connectMode
      ? "Connection mode on. Click the starting shape."
      : "Connection mode off."
  );
});

deleteConnectionButton.addEventListener("click", function () {
  if (!selectedConnection) return;

  const index = connections.indexOf(selectedConnection);

  if (index !== -1) {
    connections.splice(index, 1);
  }

  selectedConnection = null;
  drawConnections();
  setStatus("Arrow deleted.");
});

canvas.addEventListener("pointerdown", function (event) {
  if (event.target === canvas || event.target === emptyState) {
    selectNode(null);
  }
});

clearButton.addEventListener("click", function () {
  if (getNodes().length === 0) return;

  const confirmed = confirm(
    "Remove every shape and arrow from the canvas?"
  );

  if (!confirmed) return;

  getNodes().forEach(function (node) {
    node.remove();
  });

  connections.length = 0;
  selectedConnection = null;
  cancelConnectionSource();
  selectNode(null);
  drawConnections();
  updateCanvas();

  setStatus("Canvas cleared.");
});

window.addEventListener("resize", drawConnections);

updateCanvas();
drawConnections();
