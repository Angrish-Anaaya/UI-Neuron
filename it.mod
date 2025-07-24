TITLE T-type calcium current

NEURON {
	SUFFIX it
	USEION ca READ eca WRITE ica
	RANGE gbar, g, i, cai, cao
	GLOBAL hinf, minf, taum, tauh
}

UNITS {
	(mA) = (milliamp)
	(mV) = (millivolt)
	(molar) = (1/liter)
	(mM) = (millimolar)
}

PARAMETER {
	gbar = 0.002 (mho/cm2)
	cai = 50.e-6 (mM)
	cao = 2 (mM)
}

ASSIGNED {
	v (mV)
	eca (mV)
	ica (mA/cm2)
	g (mho/cm2)
	i (mA/cm2)
	minf
	hinf
	taum (ms)
	tauh (ms)
}

STATE { m h }

BREAKPOINT {
	SOLVE states METHOD cnexp
	g = gbar * m*m*h
	i = g * (v-eca)
	ica = i
}

INITIAL {
	rates(v)
	m = minf
	h = hinf
}

DERIVATIVE states {
	rates(v)
	m' = (minf-m)/taum
	h' = (hinf-h)/tauh
}

PROCEDURE rates(v(mV)) {
	minf  = 1.0 / ( 1 + exp(-(v+59)/6.2) )
	hinf  = 1.0 / ( 1 + exp((v+83)/4.0) )
	taum = 0.612 + 1.0/(exp(-(v+132)/16.7) + exp((v+16.8)/18.2))
	tauh = exp((v+467)/66.6)
	if (v > -81) {
		tauh = 28.3 + exp(-(v+12.6)/11.1)
	}
}