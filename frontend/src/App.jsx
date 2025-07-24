import { useState, useEffect, useRef } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';

// Chart.js setup
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    scales: {
        x: {
            title: { display: true, text: 'Time (ms)' },
            ticks: { precision: 0 }
        },
        y: { title: { display: true, text: 'Voltage (mV)' } }
    }
};
const rasterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    scales: {
        x: {
            type: 'linear',
            position: 'bottom',
            title: { display: true, text: 'Time (ms)' },
            min: 0,
        },
        y: {
            title: { display: true, text: 'Neuron Index' },
            beginAtZero: true,
        }
    },
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: function(context) {
                    return `Neuron ${context.raw.y} fired at ${context.raw.x.toFixed(2)} ms`;
                }
            }
        }
    }
};

// HELPER FUNCTIONS
const uuid = () => `id-${new Date().getTime()}-${Math.random().toString(36).substr(2, 9)}`;
const DISTINCT_COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#000000'];
const getDistinctColor = (index) => DISTINCT_COLORS[index % DISTINCT_COLORS.length];


// --- NEW: Chat Panel Component ---
function ChatPanel({ history, input, onInputChange, onSend, isLoading }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {history.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role}`}>
            {/* A simple way to format the AI's response for better readability */}
            {msg.content.split('\n').map((line, i) => (
              <span key={i}>{line}<br/></span>
            ))}
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <em>Thinking...</em>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question..."
          disabled={isLoading}
        />
        <button onClick={onSend} disabled={isLoading || input.trim() === ''}>
          Send
        </button>
      </div>
    </div>
  );
}


// --- Main Application Component ---
function App() {
  const [mode, setMode] = useState('individual');

  const [neurons, setNeurons] = useState([{ id: uuid(), name: 'Principal Cell', morphology: { somaDiam: 20, includeApical: true, apicalL: 400, apicalDiam: 2, includeBasal: true, basalL: 200, basalDiam: 2 } }]);
  const [connections, setConnections] = useState([]);
  const [stimulators, setStimulators] = useState([]);
  const [probes, setProbes] = useState([]);
  const [selectedNeuronId, setSelectedNeuronId] = useState(neurons[0]?.id);
  
  const defaultMorphology = { somaDiam: 20, includeApical: true, apicalL: 400, apicalDiam: 2, includeBasal: true, basalL: 200, basalDiam: 2 };
  const [populations, setPopulations] = useState([{ id: uuid(), name: 'Excitatory Pop', quantity: 80, morphology: defaultMorphology }, { id: uuid(), name: 'Inhibitory Pop', quantity: 20, morphology: defaultMorphology }]);
  const [selectedPopulationId, setSelectedPopulationId] = useState(populations[0]?.id);
  const [connectionStrategies, setConnectionStrategies] = useState([]);
  const [stimulationStrategies, setStimulationStrategies] = useState([]);
  const [probabilisticProbes, setProbabilisticProbes] = useState([]);
  
  const [simulationOutput, setSimulationOutput] = useState([]);
  const [spikeData, setSpikeData] = useState([]);
  const [draggedProbeId, setDraggedProbeId] = useState(null);
  const [draggedConnectionId, setDraggedConnectionId] = useState(null);
  const [editingProbe, setEditingProbe] = useState(null);
  const [connectionDrawMode, setConnectionDrawMode] = useState(null); 
  const [connectionStartPoint, setConnectionStartPoint] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); 

  // --- NEW: State for the chat component ---
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Hello! I am your NeuroUI assistant. How can I help you design or understand your circuit today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  // --- END OF NEW CHAT STATE ---

  const circuitSchematicRef = useRef(null);
  const wasDraggedRef = useRef(false);

  const selectedNeuron = neurons.find(n => n.id === selectedNeuronId);
  const selectedPopulation = populations.find(p => p.id === selectedPopulationId);

  // --- Handlers ---
  const addNeuron = () => {
    const newId = uuid();
    const newNeuron = { id: newId, name: `Neuron ${neurons.length + 1}`, morphology: { somaDiam: 20, includeApical: true, apicalL: 400, apicalDiam: 2, includeBasal: true, basalL: 200, basalDiam: 2 } };
    setNeurons([...neurons, newNeuron]);
    setSelectedNeuronId(newId);
  };
  const removeNeuron = (idToRemove) => {
    setNeurons(neurons.filter(n => n.id !== idToRemove));
    setConnections(connections.filter(c => c.sourceId !== idToRemove && c.targetId !== idToRemove));
    setStimulators(stimulators.filter(s => s.targetId !== idToRemove));
    setProbes(probes.filter(p => p.targetId !== idToRemove));
    if (selectedNeuronId === idToRemove) {
        const remainingNeurons = neurons.filter(n => n.id !== idToRemove);
        setSelectedNeuronId(remainingNeurons[0]?.id || null);
    }
  };
  const updateNeuron = (id, field, value) => setNeurons(neurons.map(n => n.id === id ? { ...n, [field]: value } : n));
  const updateMorphology = (field, value) => setNeurons(neurons.map(n => n.id === selectedNeuronId ? { ...n, morphology: { ...n.morphology, [field]: value } } : n));
  
  const addPopulation = () => {
    const newId = uuid();
    const newPopulation = { id: newId, name: `Population ${populations.length + 1}`, quantity: 100, morphology: defaultMorphology };
    setPopulations([...populations, newPopulation]);
    setSelectedPopulationId(newId);
  };
  const removePopulation = (idToRemove) => {
    const newPopulations = populations.filter(p => p.id !== idToRemove);
    setPopulations(newPopulations);
    if (selectedPopulationId === idToRemove) {
      setSelectedPopulationId(newPopulations[0]?.id || null);
    }
    setConnectionStrategies(connectionStrategies.filter(cs => cs.sourcePopId !== idToRemove && cs.targetPopId !== idToRemove));
    setStimulationStrategies(stimulationStrategies.filter(ss => ss.targetPopId !== idToRemove));
    setProbabilisticProbes(probabilisticProbes.filter(pp => pp.targetPopId !== idToRemove));
  };
  const updatePopulation = (id, field, value) => {
    setPopulations(populations.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const updatePopulationMorphology = (field, value) => {
    setPopulations(populations.map(p => p.id === selectedPopulationId ? { ...p, morphology: { ...p.morphology, [field]: value } } : p));
  };

  const addConnectionStrategy = () => {
    if (populations.length < 1) return;
    const newStrategy = {
      id: uuid(), sourcePopId: populations[0].id, targetPopId: populations[0].id,
      synapseType: 'AMPA', probability: 0.1, weight: 0.04, delay: 1, targetSection: 'Apical Dendrite',
    };
    setConnectionStrategies([...connectionStrategies, newStrategy]);
  };
  const removeConnectionStrategy = (id) => {
    setConnectionStrategies(connectionStrategies.filter(cs => cs.id !== id));
  };
  const updateConnectionStrategy = (id, field, value) => {
    setConnectionStrategies(connectionStrategies.map(cs => cs.id === id ? { ...cs, [field]: value } : cs));
  };

  const addStimulationStrategy = () => {
    if (populations.length < 1) return;
    const newStrategy = {
      id: uuid(), targetPopId: populations[0].id, stimType: 'AMPA', targetSection: 'Soma',
      percentage: 10, weight: 0.1, delay: 20, isNoisy: false,
    };
    setStimulationStrategies([...stimulationStrategies, newStrategy]);
  };
  const removeStimulationStrategy = (id) => {
    setStimulationStrategies(stimulationStrategies.filter(ss => ss.id !== id));
  };
  const updateStimulationStrategy = (id, field, value) => {
    setStimulationStrategies(stimulationStrategies.map(ss => ss.id === id ? { ...ss, [field]: value } : ss));
  };

  const addProbabilisticProbe = () => {
    if (populations.length < 1) return;
    const newProbe = {
      id: uuid(),
      targetPopId: populations[0].id,
      count: 1,
      section: 'Soma',
      position: 0.5,
      color: getDistinctColor(probabilisticProbes.length),
    };
    setProbabilisticProbes([...probabilisticProbes, newProbe]);
  };
  const removeProbabilisticProbe = (id) => {
    setProbabilisticProbes(probabilisticProbes.filter(pp => pp.id !== id));
  };
  const updateProbabilisticProbe = (id, field, value) => {
    setProbabilisticProbes(probabilisticProbes.map(pp => (pp.id === id ? { ...pp, [field]: value } : pp)));
  };

  const addConnection = (sourceId, targetId, synapseType, targetSection, position) => {
    const newConnection = { id: uuid(), sourceId, targetId, synapseType, targetSection, position, weight: 0.04, delay: 1 };
    setConnections([...connections, newConnection]);
  };
  const removeConnection = (id) => setConnections(connections.filter(c => c.id !== id));
  const updateConnection = (id, field, value) => setConnections(connections.map(c => c.id === id ? { ...c, [field]: value } : c));
  const addStimulator = () => setStimulators([...stimulators, { id: uuid(), targetId: neurons[0]?.id, stimType: 'AMPA', targetSection: 'Soma', position: 0.5, weight: 0.1, delay: 20 }]);
  const removeStimulator = (id) => setStimulators(stimulators.filter(s => s.id !== id));
  const updateStimulator = (id, field, value) => setStimulators(stimulators.map(s => s.id === id ? { ...s, [field]: value } : s));
  const addProbe = (targetId, section, position) => {
    const newProbe = { id: uuid(), targetId, section, position, color: getDistinctColor(probes.length) };
    setProbes([...probes, newProbe]);
  };
  const removeProbe = (id) => setProbes(probes.filter(p => p.id !== id));
  const updateProbe = (id, field, value) => {
    setProbes(probes.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };
  const cancelDrawing = () => {
    setConnectionDrawMode(null);
    setConnectionStartPoint(null);
  };
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cancelDrawing();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (mode !== 'individual') return;
    const canvas = circuitSchematicRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width; canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    const neuronPositions = {};
    neurons.forEach((neuron, index) => { neuronPositions[neuron.id] = { x: (width / (neurons.length + 1)) * (index + 1), y: height / 2 }; });
    
    connections.forEach(conn => {
        const sourcePos = neuronPositions[conn.sourceId];
        const targetNeuronData = neurons.find(n => n.id === conn.targetId);
        const targetNeuronBasePos = neuronPositions[conn.targetId];
        if (!sourcePos || !targetNeuronData || !targetNeuronBasePos) return;
        let targetX = targetNeuronBasePos.x;
        let targetY = targetNeuronBasePos.y;
        const morpho = targetNeuronData.morphology;
        const somaRadius = morpho.somaDiam / 2;
        if (conn.targetSection === 'Apical Dendrite' && morpho.includeApical) {
            targetY = targetNeuronBasePos.y - somaRadius - (conn.position * (morpho.apicalL / 4));
        } else if (conn.targetSection === 'Basal Dendrite' && morpho.includeBasal) {
            targetY = targetNeuronBasePos.y + somaRadius + (conn.position * (morpho.basalL / 4));
        }
        ctx.beginPath(); ctx.moveTo(sourcePos.x, sourcePos.y); ctx.lineTo(targetX, targetY);
        ctx.strokeStyle = conn.synapseType === 'AMPA' ? 'green' : 'red'; ctx.lineWidth = 2; ctx.stroke();
        const angle = Math.atan2(targetY - sourcePos.y, targetX - sourcePos.x);
        ctx.beginPath(); ctx.moveTo(targetX, targetY);
        ctx.lineTo(targetX - 15 * Math.cos(angle - Math.PI / 6), targetY - 15 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(targetX - 15 * Math.cos(angle + Math.PI / 6), targetY - 15 * Math.sin(angle + Math.PI / 6));
        ctx.closePath(); ctx.fillStyle = conn.synapseType === 'AMPA' ? 'green' : 'red'; ctx.fill();
    });

    neurons.forEach(neuron => {
        const pos = neuronPositions[neuron.id];
        const somaDiam = neuron.morphology.somaDiam;
        const visualApicalL = neuron.morphology.apicalL / 4;
        const visualBasalL = neuron.morphology.basalL / 4;
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
        if (neuron.morphology.includeApical) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y - somaDiam / 2); ctx.lineTo(pos.x, pos.y - somaDiam / 2 - visualApicalL); ctx.stroke(); }
        if (neuron.morphology.includeBasal) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y + somaDiam / 2); ctx.lineTo(pos.x, pos.y + somaDiam / 2 + visualBasalL); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(pos.x, pos.y, somaDiam / 2, 0, 2 * Math.PI);
        ctx.fillStyle = selectedNeuronId === neuron.id ? '#d9d9ff' : 'white'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'black'; ctx.textAlign = 'center'; ctx.fillText(neuron.name, pos.x, pos.y + somaDiam / 2 + 20);
    });

    probes.forEach(probe => {
        const neuronPos = neuronPositions[probe.targetId];
        const neuronData = neurons.find(n => n.id === probe.targetId);
        if (!neuronPos || !neuronData) return;
        const somaDiam = neuronData.morphology.somaDiam;
        const visualApicalL = neuronData.morphology.apicalL / 4;
        const visualBasalL = neuronData.morphology.basalL / 4;
        let probeY;
        if (probe.section === 'Soma') { probeY = neuronPos.y; } 
        else if (probe.section === 'Apical Dendrite') { probeY = neuronPos.y - (somaDiam / 2) - (probe.position * visualApicalL); } 
        else { probeY = neuronPos.y + (somaDiam / 2) + (probe.position * visualBasalL); }
        ctx.beginPath(); ctx.arc(neuronPos.x, probeY, 5, 0, 2 * Math.PI); ctx.fillStyle = probe.color; ctx.fill();
    });

    if (connectionStartPoint) {
      ctx.beginPath(); ctx.moveTo(connectionStartPoint.x, connectionStartPoint.y); ctx.lineTo(mousePos.x, mousePos.y);
      ctx.strokeStyle = connectionDrawMode === 'AMPA' ? 'green' : 'red'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
  }, [mode, neurons, connections, selectedNeuronId, probes, connectionStartPoint, mousePos, connectionDrawMode]);

  const handleMouseDown = (event) => {
    if (connectionDrawMode) return;
    const canvas = circuitSchematicRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    wasDraggedRef.current = false;
    const connectionHit = getHitConnection(x, y);
    if(connectionHit) {
      setDraggedConnectionId(connectionHit.id);
      return;
    }
    const probeHit = getHitProbe(x, y);
    if(probeHit) {
      setDraggedProbeId(probeHit.id);
      return;
    }
  };
  const handleMouseMove = (event) => {
    if (mode !== 'individual') return;
    const canvas = circuitSchematicRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    setMousePos({ x, y });
    if (draggedConnectionId) {
      wasDraggedRef.current = true;
      const hit = getHitNeuron(x, y);
      if (hit) { setConnections(connections.map(c => c.id === draggedConnectionId ? { ...c, targetId: hit.neuron.id, targetSection: hit.section, position: hit.position } : c)); }
    } else if (draggedProbeId) {
      wasDraggedRef.current = true;
      const probe = probes.find(p => p.id === draggedProbeId); if (!probe || probe.section === 'Soma') return; 
      const neuron = neurons.find(n => n.id === probe.targetId); const neuronY = canvas.height / 2; const somaRadius = neuron.morphology.somaDiam / 2;
      let newPosition;
      if (probe.section === 'Apical Dendrite') {
          const visualApicalL = neuron.morphology.apicalL / 4; const apicalBottom = neuronY - somaRadius;
          newPosition = (apicalBottom - y) / visualApicalL;
      } else {
          const visualBasalL = neuron.morphology.basalL / 4; const basalTop = neuronY + somaRadius;
          newPosition = (y - basalTop) / visualBasalL;
      }
      newPosition = Math.max(0, Math.min(1, newPosition)); updateProbe(draggedProbeId, 'position', newPosition);
    }
  };
  const handleMouseUp = () => { setDraggedProbeId(null); setDraggedConnectionId(null); };
  const handleCanvasClick = (event) => {
    if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }
    if (mode !== 'individual') return;
    const canvas = circuitSchematicRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const clickX = event.clientX - rect.left; const clickY = event.clientY - rect.top;

    if (connectionDrawMode) {
      const hit = getHitNeuron(clickX, clickY); if (!hit) return;
      if (!connectionStartPoint) { setConnectionStartPoint({ neuronId: hit.neuron.id, x: hit.neuronPos.x, y: hit.neuronPos.y }); } 
      else { addConnection(connectionStartPoint.neuronId, hit.neuron.id, connectionDrawMode, hit.section, hit.position); cancelDrawing(); }
    } else {
      const probeHit = getHitProbe(clickX, clickY); if (probeHit) { removeProbe(probeHit.id); return; }
      const neuronHit = getHitNeuron(clickX, clickY); if (neuronHit) { addProbe(neuronHit.neuron.id, neuronHit.section, neuronHit.position); }
    }
  };
  const getHitNeuron = (x, y) => {
    const canvas = circuitSchematicRef.current; if (!canvas) return null;
    for (const neuron of [...neurons].reverse()) {
        const neuronPos = { x: (canvas.width / (neurons.length + 1)) * (neurons.indexOf(neuron) + 1), y: canvas.height / 2 };
        const morpho = neuron.morphology; const somaRadius = morpho.somaDiam / 2; const CLICK_TOLERANCE = 5;
        const distanceToSomaCenter = Math.sqrt(Math.pow(x - neuronPos.x, 2) + Math.pow(y - neuronPos.y, 2));
        if (distanceToSomaCenter <= somaRadius) { return { neuron, neuronPos, section: 'Soma', position: 0.5 }; }
        if (morpho.includeApical) {
            const visualApicalL = morpho.apicalL / 4; const apicalTop = neuronPos.y - somaRadius - visualApicalL; const apicalBottom = neuronPos.y - somaRadius;
            if (x >= neuronPos.x - CLICK_TOLERANCE && x <= neuronPos.x + CLICK_TOLERANCE && y >= apicalTop && y <= apicalBottom) {
                const position = (apicalBottom - y) / visualApicalL;
                return { neuron, neuronPos, section: 'Apical Dendrite', position: Math.max(0, Math.min(1, position)) };
            }
        }
        if (morpho.includeBasal) {
            const visualBasalL = morpho.basalL / 4; const basalTop = neuronPos.y + somaRadius; const basalBottom = neuronPos.y + somaRadius + basalBottom;
            if (x >= neuronPos.x - CLICK_TOLERANCE && x <= neuronPos.x + CLICK_TOLERANCE && y >= basalTop && y <= basalBottom) {
                const position = (y - basalTop) / visualBasalL;
                return { neuron, neuronPos, section: 'Basal Dendrite', position: Math.max(0, Math.min(1, position)) };
            }
        }
    }
    return null;
  };
  const getHitProbe = (x, y) => {
    const canvas = circuitSchematicRef.current; if (!canvas) return null;
    for (const probe of [...probes].reverse()) {
        const neuron = neurons.find(n => n.id === probe.targetId); if (!neuron) continue;
        const neuronX = (canvas.width / (neurons.length + 1)) * (neurons.indexOf(neuron) + 1); const neuronY = canvas.height / 2;
        const somaRadius = neuron.morphology.somaDiam / 2; let probeY;
        if (probe.section === 'Soma') { probeY = neuronY; } 
        else if (probe.section === 'Apical Dendrite') { probeY = neuronY - somaRadius - (probe.position * (neuron.morphology.apicalL / 4)); } 
        else { probeY = neuronY + somaRadius + (probe.position * (neuron.morphology.basalL / 4)); }
        const distance = Math.sqrt(Math.pow(x - neuronX, 2) + Math.pow(y - probeY, 2)); if (distance <= 7) return probe;
    }
    return null;
  };
  const getHitConnection = (x, y) => {
    const canvas = circuitSchematicRef.current; if (!canvas) return null;
    const neuronPositions = {};
    neurons.forEach((neuron, index) => { neuronPositions[neuron.id] = { x: (canvas.width / (neurons.length + 1)) * (index + 1), y: canvas.height / 2 }; });
    for (const conn of [...connections].reverse()) {
      const targetNeuronData = neurons.find(n => n.id === conn.targetId); const targetNeuronBasePos = neuronPositions[conn.targetId]; if (!targetNeuronData || !targetNeuronBasePos) continue;
      let targetX = targetNeuronBasePos.x; let targetY = targetNeuronBasePos.y;
      const morpho = targetNeuronData.morphology; const somaRadius = morpho.somaDiam / 2;
      if (conn.targetSection === 'Apical Dendrite' && morpho.includeApical) { targetY = targetNeuronBasePos.y - somaRadius - (conn.position * (morpho.apicalL / 4)); } 
      else if (conn.targetSection === 'Basal Dendrite' && morpho.includeBasal) { targetY = targetNeuronBasePos.y + somaRadius + (conn.position * (morpho.basalL / 4)); }
      const distance = Math.sqrt(Math.pow(x - targetX, 2) + Math.pow(y - targetY, 2)); if (distance <= 10) return conn;
    }
    return null;
  };

  const runSimulation = async () => {
    setSimulationOutput([]);
    setSpikeData([]);
    const payload = { mode, neurons, connections, stimulators, probes, populations, connectionStrategies, stimulationStrategies, probabilisticProbes };
    try {
        const response = await fetch('http://127.0.0.1:5000/run_simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const results = await response.json();
        setSimulationOutput(results.traces || []);
        setSpikeData(results.spike_data || []);
    } catch (error) {
        console.error("Failed to run simulation:", error);
        alert("Failed to connect to the simulation server. Is it running?");
    }
  };
  
  // --- NEW: Chat handler ---
  const handleSendChat = async () => {
    if (chatInput.trim() === '' || isChatLoading) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    setChatHistory(prev => [...prev, userMessage]);
    setIsChatLoading(true);
    setChatInput('');

    const appState = { mode, neurons, connections, stimulators, probes, populations, connectionStrategies, stimulationStrategies, probabilisticProbes };

    try {
      const response = await fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, appState })
      });

      if (!response.ok) throw new Error(`Server error! status: ${response.status}`);
      
      const result = await response.json();
      const assistantMessage = { role: 'assistant', content: result.reply || "Sorry, I received an empty response." };
      setChatHistory(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Failed to get chat response:", error);
      const errorMessage = { role: 'assistant', content: 'Sorry, I was unable to connect to the AI service. Please check the server and try again.' };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };
  // --- END OF NEW CHAT HANDLER ---

  const chartData = {
    labels: simulationOutput[0]?.time || [],
    datasets: simulationOutput.map(trace => ({
      label: trace.label, data: trace.voltage, borderColor: trace.color,
      borderWidth: 2, pointRadius: 0, tension: 0.1
    }))
  };

  const rasterData = {
    datasets: [{
      label: 'Spikes',
      data: spikeData,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      pointRadius: 2,
      pointHoverRadius: 4,
      showLine: false,
    }]
  };

  return (
    <div className="app-container">
      <div className="title-wrapper"><h1>NeuroUI: Microcircuit Workbench</h1></div>
      
      <div className="mode-selector-panel">
        <button className={`mode-button ${mode === 'individual' ? 'active' : ''}`} onClick={() => setMode('individual')}>Individual Mode</button>
        <button className={`mode-button ${mode === 'probabilistic' ? 'active' : ''}`} onClick={() => setMode('probabilistic')}>Probabilistic Mode</button>
      </div>

      {mode === 'individual' && <>
        <div className="left-panel">
          <div className="card"><h3>Circuit Manager</h3><ul className="item-list">{neurons.map(n => (<li key={n.id} className={n.id === selectedNeuronId ? 'selected' : ''} onClick={() => setSelectedNeuronId(n.id)}><input type="text" value={n.name} onChange={(e) => updateNeuron(n.id, 'name', e.target.value)} onClick={(e) => e.stopPropagation()}/><button className="delete-btn" onClick={(e) => { e.stopPropagation(); removeNeuron(n.id); }}>×</button></li>))}</ul><button onClick={addNeuron}>Add Neuron</button></div>
          <div className="card"><h3>Connection Manager</h3><div className="item-list">{connections.map(c => (<div key={c.id} className="connection-item"><select value={c.sourceId} onChange={(e) => updateConnection(c.id, 'sourceId', e.target.value)}>{neurons.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select><span>→</span><select value={c.targetId} onChange={(e) => updateConnection(c.id, 'targetId', e.target.value)}>{neurons.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select><select value={c.synapseType} onChange={(e) => updateConnection(c.id, 'synapseType', e.target.value)}><option>AMPA</option><option>GABA</option></select><button className="delete-btn" onClick={() => removeConnection(c.id)}>×</button><div className="connection-details">Target:<select value={c.targetSection} onChange={(e) => updateConnection(c.id, 'targetSection', e.target.value)}><option>Apical Dendrite</option><option>Basal Dendrite</option><option>Soma</option></select>Position:<input type="number" value={c.position} onChange={(e) => updateConnection(c.id, 'position', parseFloat(e.target.value))} step="0.1" min="0" max="1"/>Weight (µS):<input type="number" value={c.weight} onChange={(e) => updateConnection(c.id, 'weight', parseFloat(e.target.value))} step="0.01"/>Delay (ms):<input type="number" value={c.delay} onChange={(e) => updateConnection(c.id, 'delay', parseFloat(e.target.value))}/></div></div>))}</div><button onClick={() => addConnection(neurons[0]?.id, neurons[0]?.id, 'AMPA', 'Soma', 0.5)}>Add Connection</button></div>
          <div className="card"><h3>External Stimulators</h3><div className="item-list">{stimulators.map(s => (<div key={s.id} className="connection-item">Stim → <select value={s.targetId} onChange={(e) => updateStimulator(s.id, 'targetId', e.target.value)}>{neurons.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select><select value={s.stimType} onChange={(e) => updateStimulator(s.id, 'stimType', e.target.value)}><option>AMPA</option><option>GABA</option><option>IClamp</option></select><button className="delete-btn" onClick={() => removeStimulator(s.id)}>×</button><div className="connection-details">Target:<select value={s.targetSection} onChange={(e) => updateStimulator(s.id, 'targetSection', e.target.value)}><option>Apical Dendrite</option><option>Basal Dendrite</option><option>Soma</option></select>Position:<input type="number" value={s.position} onChange={(e) => updateStimulator(s.id, 'position', parseFloat(e.target.value))} step="0.1" min="0" max="1"/>{s.stimType === 'IClamp' ? 'Amp (nA):' : 'Weight (µS):'}<input type="number" value={s.weight} onChange={(e) => updateStimulator(s.id, 'weight', parseFloat(e.target.value))} step="0.01"/>Delay (ms):<input type="number" value={s.delay} onChange={(e) => updateStimulator(s.id, 'delay', parseFloat(e.target.value))}/></div></div>))}</div><button onClick={addStimulator}>Add Stimulator</button></div>
          {selectedNeuron && <div className="card"><h3>Configuration for:<select value={selectedNeuronId} onChange={(e) => setSelectedNeuronId(e.target.value)} style={{ marginLeft: '10px', fontSize: '0.9em', fontWeight: 'bold', border: '1px solid #ccc', borderRadius: '4px' }} >{neurons.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></h3><h4>Morphology</h4><div className="config-item"><span>Soma Diameter (diam, µm)</span><div><input type="range" min="5" max="50" value={selectedNeuron.morphology.somaDiam} onChange={(e) => updateMorphology('somaDiam', parseFloat(e.target.value))}/><input type="number" value={selectedNeuron.morphology.somaDiam} onChange={(e) => updateMorphology('somaDiam', parseFloat(e.target.value))}/></div></div><div className="config-item"><span><input type="checkbox" checked={selectedNeuron.morphology.includeBasal} onChange={(e) => updateMorphology('includeBasal', e.target.checked)}/> Include Basal Dendrite</span></div>{selectedNeuron.morphology.includeBasal && <><div className="config-item indent"><span>Length (L, µm)</span><div><input type="range" min="10" max="500" value={selectedNeuron.morphology.basalL} onChange={(e) => updateMorphology('basalL', parseFloat(e.target.value))}/><input type="number" value={selectedNeuron.morphology.basalL} onChange={(e) => updateMorphology('basalL', parseFloat(e.target.value))}/></div></div><div className="config-item indent"><span>Diameter (diam, µm)</span><div><input type="range" min="1" max="10" value={selectedNeuron.morphology.basalDiam} onChange={(e) => updateMorphology('basalDiam', parseFloat(e.target.value))}/><input type="number" value={selectedNeuron.morphology.basalDiam} onChange={(e) => updateMorphology('basalDiam', parseFloat(e.target.value))}/></div></div></>}<div className="config-item"><span><input type="checkbox" checked={selectedNeuron.morphology.includeApical} onChange={(e) => updateMorphology('includeApical', e.target.checked)}/> Include Apical Dendrite</span></div>{selectedNeuron.morphology.includeApical && <><div className="config-item indent"><span>Length (L, µm)</span><div><input type="range" min="10" max="800" value={selectedNeuron.morphology.apicalL} onChange={(e) => updateMorphology('apicalL', parseFloat(e.target.value))}/><input type="number" value={selectedNeuron.morphology.apicalL} onChange={(e) => updateMorphology('apicalL', parseFloat(e.target.value))}/></div></div><div className="config-item indent"><span>Diameter (diam, µm)</span><div><input type="range" min="1" max="10" value={selectedNeuron.morphology.apicalDiam} onChange={(e) => updateMorphology('apicalDiam', parseFloat(e.target.value))}/><input type="number" value={selectedNeuron.morphology.apicalDiam} onChange={(e) => updateMorphology('apicalDiam', parseFloat(e.target.value))}/></div></div></>}</div>}
        </div>
        <div className="right-panel">
          <div className="card"><h3>Circuit Schematic</h3><div className="schematic-controls"><button className={connectionDrawMode === 'AMPA' ? 'active-ampa' : ''} onClick={() => setConnectionDrawMode(connectionDrawMode === 'AMPA' ? null : 'AMPA')} >+ AMPA</button><button className={connectionDrawMode === 'GABA' ? 'active-gaba' : ''} onClick={() => setConnectionDrawMode(connectionDrawMode === 'GABA' ? null : 'GABA')} >+ GABA</button>{connectionDrawMode && <button onClick={cancelDrawing}>Cancel</button>}</div><div className={`schematic-container ${connectionDrawMode ? 'drawing-mode' : ''}`}><canvas ref={circuitSchematicRef} onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} /></div></div>
          <div className="card"><h3>Recording Probes</h3><div className="item-list"><ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{probes.map(p => { const neuron = neurons.find(n => n.id === p.targetId); const isBeingEdited = editingProbe?.id === p.id; return (<li key={p.id} style={{ borderLeft: `5px solid ${p.color}`, display: 'flex', alignItems: 'center', marginBottom: '0.5rem', backgroundColor: '#f0f4f8', padding: '0.5rem', borderRadius: '4px' }}><div className="probe-item-controls"><select value={p.targetId} onChange={(e) => { const newTargetId = e.target.value; const targetNeuron = neurons.find(n => n.id === newTargetId); if (!targetNeuron) return; let updatedProbe = { ...p, targetId: newTargetId }; if ((p.section === 'Apical Dendrite' && !targetNeuron.morphology.includeApical) || (p.section === 'Basal Dendrite' && !targetNeuron.morphology.includeBasal)) { updatedProbe.section = 'Soma'; updatedProbe.position = 0.5; } setProbes(probes.map(probe => probe.id === p.id ? updatedProbe : probe)); }} onClick={(e) => e.stopPropagation()} >{neurons.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select><select value={p.section} onChange={(e) => { const newSection = e.target.value; if (newSection === 'Soma') { setProbes(probes.map(pr => pr.id === p.id ? { ...pr, section: newSection, position: 0.5 } : pr)); }  else { updateProbe(p.id, 'section', newSection); } }} onClick={(e) => e.stopPropagation()} ><option value="Soma">Soma</option>{neuron?.morphology.includeApical && <option value="Apical Dendrite">Apical</option>}{neuron?.morphology.includeBasal && <option value="Basal Dendrite">Basal</option>}</select><span>@</span><input type="text" value={isBeingEdited ? editingProbe.value : p.position.toFixed(2)} onFocus={() => setEditingProbe({ id: p.id, value: p.position.toFixed(2) })} onChange={(e) => setEditingProbe({ ...editingProbe, value: e.target.value })} onBlur={() => { const newPosition = parseFloat(editingProbe.value); if (!isNaN(newPosition)) { updateProbe(p.id, 'position', Math.max(0, Math.min(1, newPosition))); } setEditingProbe(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } if (e.key === 'Escape') { setEditingProbe(null); e.target.blur(); } }} disabled={p.section === 'Soma'} onClick={(e) => e.stopPropagation()} /></div><button className="delete-btn" onClick={() => removeProbe(p.id)}>×</button></li>);})}</ul></div><button onClick={() => { if (selectedNeuronId) addProbe(selectedNeuronId, 'Soma', 0.5); }}>Add Probe to Selected</button></div>
          <div className="card output-card"><h3>Simulation Output</h3><div className="output-container">{simulationOutput.length > 0 ? <Line options={chartOptions} data={chartData} /> : <p>Run a simulation to see results.</p>}</div></div>
        </div>
      </>}

      {mode === 'probabilistic' && <>
          <div className="left-panel">
            <div className="card"><h3>Population Manager</h3><ul className="item-list">{populations.map(pop => (<li key={pop.id} className={pop.id === selectedPopulationId ? 'selected' : ''} onClick={() => setSelectedPopulationId(pop.id)}><input type="text" value={pop.name} onChange={(e) => updatePopulation(pop.id, 'name', e.target.value)} onClick={(e) => e.stopPropagation()}/><input type="number" value={pop.quantity} onChange={(e) => updatePopulation(pop.id, 'quantity', parseInt(e.target.value, 10))} style={{width: "60px", marginLeft: "auto"}} onClick={(e) => e.stopPropagation()}/><button className="delete-btn" onClick={(e) => { e.stopPropagation(); removePopulation(pop.id); }}>×</button></li>))}</ul><button onClick={addPopulation}>Add Population</button></div>
            <div className="card"><h3>Connection Strategy Manager</h3><div className="item-list">{connectionStrategies.map(cs => (<div key={cs.id} className="connection-item"><select value={cs.sourcePopId} onChange={(e) => updateConnectionStrategy(cs.id, 'sourcePopId', e.target.value)}>{populations.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><span>→</span><select value={cs.targetPopId} onChange={(e) => updateConnectionStrategy(cs.id, 'targetPopId', e.target.value)}>{populations.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={cs.synapseType} onChange={(e) => updateConnectionStrategy(cs.id, 'synapseType', e.target.value)}><option>AMPA</option><option>GABA</option></select><button className="delete-btn" onClick={() => removeConnectionStrategy(cs.id)}>×</button><div className="connection-details">Probability:<input type="number" value={cs.probability} onChange={(e) => updateConnectionStrategy(cs.id, 'probability', parseFloat(e.target.value))} step="0.05" min="0" max="1"/>Target:<select value={cs.targetSection} onChange={(e) => updateConnectionStrategy(cs.id, 'targetSection', e.target.value)}><option>Apical Dendrite</option><option>Basal Dendrite</option><option>Soma</option></select>Weight (µS):<input type="number" value={cs.weight} onChange={(e) => updateConnectionStrategy(cs.id, 'weight', parseFloat(e.target.value))} step="0.01"/>Delay (ms):<input type="number" value={cs.delay} onChange={(e) => updateConnectionStrategy(cs.id, 'delay', parseFloat(e.target.value))}/></div></div>))}</div><button onClick={addConnectionStrategy} disabled={populations.length === 0}>Add Connection Rule</button></div>
            <div className="card"><h3>Stimulation Strategy Manager</h3><div className="item-list">{stimulationStrategies.map(ss => (<div key={ss.id} className="connection-item">Stim → <select value={ss.targetPopId} onChange={(e) => updateStimulationStrategy(ss.id, 'targetPopId', e.target.value)}>{populations.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={ss.stimType} onChange={(e) => updateStimulationStrategy(ss.id, 'stimType', e.target.value)}><option>AMPA</option><option>GABA</option><option>IClamp</option></select><button className="delete-btn" onClick={() => removeStimulationStrategy(ss.id)}>×</button><div className="connection-details"><label style={{gridColumn: '1 / -1'}}><input type="checkbox" checked={ss.isNoisy || false} onChange={e => updateStimulationStrategy(ss.id, 'isNoisy', e.target.checked)}/> Noisy Background</label>Target:<select value={ss.targetSection} onChange={(e) => updateStimulationStrategy(ss.id, 'targetSection', e.target.value)} disabled={ss.isNoisy}><option>Apical Dendrite</option><option>Basal Dendrite</option><option>Soma</option></select>Percentage (%):<input type="number" value={ss.percentage} onChange={(e) => updateStimulationStrategy(ss.id, 'percentage', parseFloat(e.target.value))} step="1" min="0" max="100" disabled={ss.isNoisy}/>{ss.stimType === 'IClamp' ? 'Amp (nA):' : 'Weight (µS):'}<input type="number" value={ss.weight} onChange={(e) => updateStimulationStrategy(ss.id, 'weight', parseFloat(e.target.value))} step="0.01"/>Delay (ms):<input type="number" value={ss.delay} onChange={(e) => updateStimulationStrategy(ss.id, 'delay', parseFloat(e.target.value))} disabled={ss.isNoisy}/></div></div>))}</div><button onClick={addStimulationStrategy} disabled={populations.length === 0}>Add Stimulation Rule</button></div>
            {selectedPopulation && <div className="card"><h3>Configuration for: {selectedPopulation.name}</h3><h4>Morphology</h4><div className="config-item"><span>Soma Diameter (diam, µm)</span><div><input type="range" min="5" max="50" value={selectedPopulation.morphology.somaDiam} onChange={(e) => updatePopulationMorphology('somaDiam', parseFloat(e.target.value))}/><input type="number" value={selectedPopulation.morphology.somaDiam} onChange={(e) => updatePopulationMorphology('somaDiam', parseFloat(e.target.value))}/></div></div><div className="config-item"><span><input type="checkbox" checked={selectedPopulation.morphology.includeBasal} onChange={(e) => updatePopulationMorphology('includeBasal', e.target.checked)}/> Include Basal Dendrite</span></div>{selectedPopulation.morphology.includeBasal && <><div className="config-item indent"><span>Length (L, µm)</span><div><input type="range" min="10" max="500" value={selectedPopulation.morphology.basalL} onChange={(e) => updatePopulationMorphology('basalL', parseFloat(e.target.value))}/><input type="number" value={selectedPopulation.morphology.basalL} onChange={(e) => updatePopulationMorphology('basalL', parseFloat(e.target.value))}/></div></div><div className="config-item indent"><span>Diameter (diam, µm)</span><div><input type="range" min="1" max="10" value={selectedPopulation.morphology.basalDiam} onChange={(e) => updatePopulationMorphology('diam', parseFloat(e.target.value))}/><input type="number" value={selectedPopulation.morphology.basalDiam} onChange={(e) => updatePopulationMorphology('basalDiam', parseFloat(e.target.value))}/></div></div></>}<div className="config-item"><span><input type="checkbox" checked={selectedPopulation.morphology.includeApical} onChange={(e) => updatePopulationMorphology('includeApical', e.target.checked)}/> Include Apical Dendrite</span></div>{selectedPopulation.morphology.includeApical && <><div className="config-item indent"><span>Length (L, µm)</span><div><input type="range" min="10" max="800" value={selectedPopulation.morphology.apicalL} onChange={(e) => updatePopulationMorphology('apicalL', parseFloat(e.target.value))}/><input type="number" value={selectedPopulation.morphology.apicalL} onChange={(e) => updatePopulationMorphology('apicalL', parseFloat(e.target.value))}/></div></div><div className="config-item indent"><span>Diameter (diam, µm)</span><div><input type="range" min="1" max="10" value={selectedPopulation.morphology.apicalDiam} onChange={(e) => updatePopulationMorphology('apicalDiam', parseFloat(e.target.value))}/><input type="number" value={selectedPopulation.morphology.apicalDiam} onChange={(e) => updatePopulationMorphology('apicalDiam', parseFloat(e.target.value))}/></div></div></>}</div>}
          </div>
          <div className="right-panel" style={{gridTemplateRows: '2fr auto 3fr'}}>
            <div className="card"><h3>Network Activity (Raster Plot)</h3>
              <div className="output-container">
                {spikeData.length > 0 ? <Scatter options={rasterOptions} data={rasterData} /> : <p>Run a simulation to see spike data.</p>}
              </div>
            </div>
            <div className="card"><h3>Recording Strategy Manager</h3>
              <div className="item-list">
                {probabilisticProbes.map(pp => (
                  <li key={pp.id} style={{ borderLeft: `5px solid ${pp.color}`, display: 'flex', alignItems: 'center', marginBottom: '0.5rem', backgroundColor: '#f0f4f8', padding: '0.5rem', borderRadius: '4px' }}>
                    <div className="probe-item-controls">
                      <span>Record</span>
                      <input type="number" value={pp.count} onChange={e => updateProbabilisticProbe(pp.id, 'count', parseInt(e.target.value, 10))} style={{width: '50px'}} />
                      <span>from</span>
                      <select value={pp.targetPopId} onChange={e => updateProbabilisticProbe(pp.id, 'targetPopId', e.target.value)}>
                        {populations.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <span>at</span>
                      <select value={pp.section} onChange={e => updateProbabilisticProbe(pp.id, 'section', e.target.value)}>
                        <option>Soma</option><option>Apical Dendrite</option><option>Basal Dendrite</option>
                      </select>
                    </div>
                    <button className="delete-btn" onClick={() => removeProbabilisticProbe(pp.id)}>×</button>
                  </li>
                ))}
              </div>
              <button onClick={addProbabilisticProbe} disabled={populations.length === 0}>Add Recording Rule</button>
            </div>
            <div className="card"><h3>Voltage Traces</h3>
                <div className="output-container">
                    {simulationOutput.length > 0 ? <Line options={chartOptions} data={chartData} /> : <p>Add recording rules and run simulation to see voltage traces.</p>}
                </div>
            </div>
          </div>
      </>}
      
      {/* --- THIS IS THE NEW CHAT PANEL --- */}
      <ChatPanel
        history={chatHistory}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={handleSendChat}
        isLoading={isChatLoading}
      />
      
      <div className="footer-panel"><button className="run-button-main" onClick={runSimulation}>Run Simulation</button></div>
    </div>
  );
}

export default App;