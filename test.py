from neuron import h
h.load_file('stdrun.hoc')      # load NEURON’s standard run library

# Create a single-compartment soma with Hodgkin-Huxley channels
soma = h.Section(name='soma')
soma.insert('hh')

# Simulation parameters
h.tstop = 50    # run for 50 ms
h.v_init = -65  # start at –65 mV
h.dt = 0.025    # time step

# Initialize and run
h.finitialize(h.v_init)
h.continuerun(h.tstop)

# Print final membrane potential
print(f"Simulation complete: Vm at {h.tstop} ms = {soma(0.5).v:.2f} mV")
