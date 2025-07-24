from flask import Flask, jsonify, request
from flask_cors import CORS
from neuron import h
import json
import random
import google.generativeai as genai

# --- THIS IS A NEW SECTION ---
# TODO: Paste your Google AI API Key here
# Find your key at https://aistudio.google.com/app/apikey
GOOGLE_API_KEY = "AIzaSyCOSwJtj6w8G7JXKTZKLC9bFCMZCPm1eAM"

genai.configure(api_key=GOOGLE_API_KEY)
# --- END OF NEW SECTION ---


app = Flask(__name__)
CORS(app)


# --- THIS IS A NEW FUNCTION ---
def format_app_state_for_ai(app_state):
    """Converts the app's state into a readable summary for the AI."""
    mode = app_state.get('mode', 'individual')
    summary = f"The user is currently in '{mode}' mode.\n"

    if mode == 'individual':
        summary += f"There are {len(app_state.get('neurons', []))} neurons.\n"
        summary += f"There are {len(app_state.get('connections', []))} connections.\n"
        summary += f"There are {len(app_state.get('stimulators', []))} stimulators.\n"
        summary += f"There are {len(app_state.get('probes', []))} probes.\n"
        # Optional: Add more detail about the individual items if needed later
    
    elif mode == 'probabilistic':
        populations = app_state.get('populations', [])
        summary += f"There are {len(populations)} populations defined:\n"
        for pop in populations:
            summary += f"- '{pop.get('name')}' with {pop.get('quantity')} neurons.\n"

        connections = app_state.get('connectionStrategies', [])
        summary += f"There are {len(connections)} connection rules:\n"
        for conn in connections:
            summary += f"- A rule connecting '{conn.get('sourcePopId')}' to '{conn.get('targetPopId')}' with {conn.get('probability')*100}% probability.\n"

        stimulations = app_state.get('stimulationStrategies', [])
        summary += f"There are {len(stimulations)} stimulation rules.\n"

    summary += "\nHere is the full application state in JSON format for your reference:\n"
    summary += json.dumps(app_state, indent=2)
    return summary
# --- END OF NEW FUNCTION ---


# --- THIS IS A NEW ROUTE ---
@app.route('/chat', methods=['POST'])
def handle_chat():
    """Handles chat messages from the frontend."""
    try:
        payload = request.get_json()
        user_message = payload.get('message')
        app_state = payload.get('appState')

        if not user_message or not app_state:
            return jsonify({"error": "Missing message or appState"}), 400
        
        if GOOGLE_API_KEY == "AIzaSyCOSwJtj6w8G7JXKTZKLC9bFCMZCPm1eAM":
            return jsonify({"reply": "It looks like the Google AI API key is not set on the server. Please ask the developer to configure it in the `server.py` file."})

        # Create a detailed prompt for the AI
        formatted_state = format_app_state_for_ai(app_state)
        system_prompt = (
            "You are a helpful and concise expert assistant for a neuroscience simulation application called NeuroUI. "
            "Your role is to guide the user through building and understanding neural circuit models. "
            "You must use the provided application state to inform your answer. "
            "Do not provide code. Explain concepts and guide the user on how to use the UI. "
            "Here is the user's current circuit configuration:\n\n"
            f"{formatted_state}"
            "\n\nNow, please answer the user's question."
        )

        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content([system_prompt, user_message])
        
        return jsonify({"reply": response.text})

    except Exception as e:
        print(f"Error in /chat endpoint: {e}")
        return jsonify({"error": "An error occurred while communicating with the AI service."}), 500
# --- END OF NEW ROUTE ---


def create_neuron_from_morpho(neuron_id_str, morpho, mechanisms):
    soma = h.Section(name=f"{neuron_id_str}_soma")
    soma.L = soma.diam = morpho['somaDiam']
    
    neuron_cell = {'Soma': soma}
    all_sections = [soma]
    
    if morpho.get('includeApical', False):
        apical = h.Section(name=f"{neuron_id_str}_apical")
        apical.L = morpho['apicalL']
        apical.diam = morpho['apicalDiam']
        apical.connect(soma(1))
        neuron_cell['Apical Dendrite'] = apical
        all_sections.append(apical)

    if morpho.get('includeBasal', False):
        basal = h.Section(name=f"{neuron_id_str}_basal")
        basal.L = morpho['basalL']
        basal.diam = morpho['basalDiam']
        basal.connect(soma(0))
        neuron_cell['Basal Dendrite'] = basal
        all_sections.append(basal)
        
    for sec in all_sections:
        for mech in mechanisms:
            sec.insert(mech)

    return neuron_cell

@app.route('/run_simulation', methods=['POST'])
def run_simulation():
    payload = request.get_json()
    
    print("--- Received New Simulation Request ---")
    print(f"Mode: {payload.get('mode', 'individual')}")

    h.load_file('stdrun.hoc')
    h.tstop = payload.get('tstop', 1000.0)
    
    neuron_objects = {}
    netcons = []
    netstims = []
    synapses = []
    iclamps = []
    traces = []
    
    spike_times_list = []
    spike_gids_list = []
    
    def spike_recorder(gid):
        spike_gids_list.append(gid)
        spike_times_list.append(h.t)

    if payload.get('mode') == 'probabilistic':
        print("Building network from probabilistic rules...")
        
        population_cells = {}
        all_cells = []
        global_neuron_index = 0

        class SpikeRecorder:
            def __init__(self, gid):
                self.gid = gid
            def record(self):
                spike_recorder(self.gid)
        
        recorders = [] 
        
        for pop_data in payload['populations']:
            pop_id = pop_data['id']
            population_cells[pop_id] = []
            
            mechs_to_insert = ['hh']
            if pop_data['name'] in ['TC', 'RE']:
                mechs_to_insert.append('it')
                print(f"Adding T-type channels to population: {pop_data['name']}")

            for i in range(pop_data['quantity']):
                neuron_instance_id = f"{pop_id}_n{i}"
                cell = create_neuron_from_morpho(neuron_instance_id, pop_data['morphology'], mechs_to_insert)
                population_cells[pop_id].append(cell)
                all_cells.append(cell)
                
                soma = cell['Soma']
                nc_spike = h.NetCon(soma(0.5)._ref_v, None, sec=soma)
                nc_spike.threshold = -20
                
                recorder = SpikeRecorder(global_neuron_index)
                recorders.append(recorder)
                nc_spike.record(recorder.record)
                
                netcons.append(nc_spike)
                global_neuron_index += 1

        print(f"Created {len(all_cells)} total neurons and set up spike recorders.")

        num_connections = 0
        for strategy in payload.get('connectionStrategies', []):
            source_pop = population_cells.get(strategy['sourcePopId'], [])
            target_pop = population_cells.get(strategy['targetPopId'], [])
            
            if not source_pop or not target_pop: continue

            for source_cell in source_pop:
                for target_cell in target_pop:
                    if source_cell == target_cell: continue

                    if random.random() < strategy['probability']:
                        source_point = source_cell['Soma'](0.5)
                        target_section_name = strategy.get('targetSection', 'Soma')
                        if target_section_name not in target_cell: target_section_name = 'Soma'
                            
                        target_point = target_cell[target_section_name](0.5)
                        
                        syn = h.Exp2Syn(target_point)
                        
                        if strategy['synapseType'] == 'GABA':
                            syn.tau1 = 0.5
                            syn.tau2 = 50.0
                            syn.e = -80
                        else: # AMPA
                            syn.tau1 = 0.2
                            syn.tau2 = 2.0
                            syn.e = 0
                        
                        synapses.append(syn)
                        
                        nc = h.NetCon(source_point._ref_v, syn, sec=source_point.sec)
                        nc.delay = strategy['delay']; nc.weight[0] = strategy['weight']; nc.threshold = -20
                        netcons.append(nc)
                        num_connections += 1
        
        print(f"Created {num_connections} probabilistic connections.")

        num_stimulators = 0
        for stim_strat in payload.get('stimulationStrategies', []):
            target_pop = population_cells.get(stim_strat['targetPopId'], [])
            if not target_pop: continue

            if stim_strat.get('isNoisy', False):
                print(f"Applying noisy background to population {stim_strat['targetPopId']}")
                for cell in target_pop:
                    target_point = cell['Soma'](0.5)
                    stim = h.NetStim()
                    stim.interval = 100
                    stim.number = 1e9
                    stim.start = 0
                    stim.noise = 1
                    netstims.append(stim)
                    syn = h.Exp2Syn(target_point)
                    syn.tau1 = 0.2; syn.tau2 = 2.0; syn.e = 0
                    synapses.append(syn)
                    nc = h.NetCon(stim, syn)
                    nc.delay = 1
                    nc.weight[0] = stim_strat['weight']
                    netcons.append(nc)
                    num_stimulators += 1
            else:
                num_to_stimulate = int(len(target_pop) * (stim_strat.get('percentage', 100) / 100.0))
                stimulated_cells = random.sample(target_pop, num_to_stimulate)

                for cell in stimulated_cells:
                    target_section_name = stim_strat.get('targetSection', 'Soma')
                    if target_section_name not in cell: target_section_name = 'Soma'
                    target_point = cell[target_section_name](0.5)

                    if stim_strat['stimType'] == 'IClamp':
                        clamp = h.IClamp(target_point)
                        clamp.delay = stim_strat['delay']; clamp.dur = 100; clamp.amp = stim_strat['weight']
                        iclamps.append(clamp)
                    else:
                        stim = h.NetStim(); stim.interval = 1e9; stim.number = 1; stim.start = stim_strat['delay']; stim.noise = 0
                        netstims.append(stim)
                        syn = h.Exp2Syn(target_point)
                        if stim_strat['stimType'] == 'GABA':
                            syn.tau1 = 0.5; syn.tau2 = 50; syn.e = -80
                        else:
                            syn.tau1 = 0.2; syn.tau2 = 2.0; syn.e = 0
                        synapses.append(syn)
                        nc = h.NetCon(stim, syn); nc.delay = 1; nc.weight[0] = stim_strat['weight']
                        netcons.append(nc)
                    num_stimulators += 1

        print(f"Created {num_stimulators} probabilistic stimulators.")

        num_probes = 0
        for probe_rule in payload.get('probabilisticProbes', []):
            target_pop_id = probe_rule['targetPopId']
            target_pop_cells = population_cells.get(target_pop_id, [])
            if not target_pop_cells: continue

            count = min(probe_rule.get('count', 1), len(target_pop_cells))
            probed_cells = random.sample(target_pop_cells, count)
            
            pop_name = next((p['name'] for p in payload['populations'] if p['id'] == target_pop_id), "N/A")

            for i, cell in enumerate(probed_cells):
                section_name = probe_rule.get('section', 'Soma')
                if section_name not in cell: section_name = 'Soma'
                
                target_section = cell[section_name]
                recording_target = target_section(probe_rule.get('position', 0.5))
                
                v_vec = h.Vector().record(recording_target._ref_v)
                t_vec = h.Vector().record(h._ref_t)

                traces.append({
                    'id': f"{probe_rule['id']}-{i}",
                    'label': f"{pop_name} #{i+1} ({section_name.split(' ')[0]})",
                    'color': probe_rule['color'], 'v_vec': v_vec, 't_vec': t_vec
                })
                num_probes += 1
        print(f"Created {num_probes} probabilistic probes.")

    else:
        # --- INDIVIDUAL MODE LOGIC (UNCHANGED) ---
        print("Building network from individual components...")
        for neuron_data in payload['neurons']:
            neuron_id = neuron_data['id']
            neuron_objects[neuron_id] = create_neuron_from_morpho(neuron_id, neuron_data['morphology'], ['hh'])

        for conn_data in payload['connections']:
            source_neuron = neuron_objects.get(conn_data['sourceId'])
            target_neuron = neuron_objects.get(conn_data['targetId'])
            if not source_neuron or not target_neuron: continue
            
            source_point = source_neuron['Soma'](0.5)
            target_point = target_neuron[conn_data['targetSection']](conn_data['position'])
            
            syn = h.Exp2Syn(target_point)
            if conn_data['synapseType'] == 'GABA':
                syn.tau1 = 0.5; syn.tau2 = 50; syn.e = -80
            else:
                syn.tau1 = 0.2; syn.tau2 = 2.0; syn.e = 0
            synapses.append(syn)
            
            nc = h.NetCon(source_point._ref_v, syn, sec=source_point.sec)
            nc.delay = conn_data['delay']; nc.weight[0] = conn_data['weight']; nc.threshold = -20
            netcons.append(nc)
            
        for stim_data in payload['stimulators']:
            target_neuron = neuron_objects.get(stim_data['targetId'])
            if not target_neuron: continue
            target_point = target_neuron[stim_data['targetSection']](stim_data['position'])
            
            if stim_data['stimType'] == 'IClamp':
                clamp = h.IClamp(target_point)
                clamp.delay = stim_data['delay']; clamp.dur = 100; clamp.amp = stim_data['weight']
                iclamps.append(clamp)
            else:
                stim = h.NetStim(); stim.interval = 1e9; stim.number = 1; stim.start = stim_data['delay']; stim.noise = 0
                netstims.append(stim)
                syn = h.Exp2Syn(target_point)
                if stim_data['stimType'] == 'GABA':
                    syn.tau1 = 0.5; syn.tau2 = 50; syn.e = -80
                else:
                    syn.tau1 = 0.2; syn.tau2 = 2.0; syn.e = 0
                synapses.append(syn)
                nc = h.NetCon(stim, syn); nc.delay = 1; nc.weight[0] = stim_data['weight']
                netcons.append(nc)

        for probe_data in payload['probes']:
            target_neuron = neuron_objects.get(probe_data['targetId'])
            if not target_neuron: continue
            ui_section_name = probe_data['section']
            if ui_section_name not in target_neuron: continue
            target_section = target_neuron[ui_section_name]
            recording_target = target_section(probe_data['position'])
            v_vec = h.Vector().record(recording_target._ref_v)
            t_vec = h.Vector().record(h._ref_t)
            neuron_name = next((n['name'] for n in payload['neurons'] if n['id'] == probe_data['targetId']), "N/A")
            traces.append({
                'id': probe_data['id'], 'label': f"{neuron_name} {ui_section_name.split(' ')[0]} @ {probe_data['position']:.2f}",
                'color': probe_data['color'], 'v_vec': v_vec, 't_vec': t_vec
            })

    h.finitialize(-65)
    h.run()

    results = { "traces": [] }
    for trace in traces:
        results["traces"].append({
            "label": trace['label'], "color": trace['color'],
            "time": list(trace['t_vec']), "voltage": list(trace['v_vec'])
        })
        
    if payload.get('mode') == 'probabilistic':
        spike_data = [{"x": t, "y": gid} for t, gid in zip(spike_times_list, spike_gids_list)]
        results['spike_data'] = spike_data
        print(f"Recorded {len(spike_data)} total spikes.")
        
    print("--- Simulation Complete. Sending results. ---")
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)