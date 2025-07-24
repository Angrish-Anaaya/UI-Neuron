NeuroUI: Microcircuit Workbench
NeuroUI is a web-based graphical user interface (GUI) for visually creating, configuring, and simulating small neural circuits. It provides an intuitive workbench for building a circuit and immediately observing its behavior.


System Architecture
The application uses a client-server model:
Frontend (Client): A React application that manages the user interface and the state of the neural circuit. It packages the circuit design into a JSON object and sends it to the backend for simulation.
Backend (Server): A Python server using Flask and the NEURON simulation environment. It receives the JSON object, dynamically builds the neural model, runs the simulation, and returns the results.


Features
Visual Circuit Building: Interactively add and configure neurons, connections, and stimulators.


Two Creation Modes:
Individual Mode: Manually place individual neurons and define specific connections between them.
Probabilistic Mode: Define large-scale networks using rules for neuron populations and connectivity.
Dynamic Simulation: Send the circuit design to the NEURON backend for accurate biophysical simulation.
Results Visualization: View simulation outputs, such as neuron membrane potentials, as interactive graphs using Chart.js.


Technology Stack
Frontend: React, Vite, Chart.js
Backend: Python, Flask, NEURON


Getting Started

Prerequisites
Node.js and npm
Python and pip
NEURON Simulation Environment

Installation and Running
- Clone the repository 
git clone <your-repository-url>
cd <your-project-directory>
- Setup and run the backend server
pip install Flask neuron
python server.py
The backend will be running on http://127.0.0.1:5000
- Setup and run frontend application
npm install
npm run dev
The frontend will be available at the URL provided by Vite (usually http://localhost:5173).


Usage
Once both the backend and frontend are running, open the frontend URL in your web browser. You can then use the interface to build a circuit and click "Run Simulation" to see the results.
