export const KOSOVO_REGIONAL_HOSPITALS = {
    'Prishtinë': {
        id: 'hosp-qkuk',
        name: 'QKUK - Qendra Klinike Universitare e Kosovës',
        type: 'QKUK',
        municipality: 'Prishtinë',
        region: 'Rajoni i Prishtinës',
        phone: '+383 38 500 600',
        emergencyPhone: '194 / +383 38 500 600 - 2000',
        email: 'info@shskuk.org',
        address: 'Rruga e Spitalit p.n., Prishtinë',
        directorateHealthPhone: '+383 38 230 900'
    },
    'Prizren': {
        id: 'hosp-prizren',
        name: 'Spitali i Përgjithshëm "Prim. Dr. Daut Mustafa" Prizren',
        type: 'Spital Rajonal',
        municipality: 'Prizren',
        region: 'Rajoni i Prizrenit',
        phone: '+383 29 223 333',
        emergencyPhone: '194 / +383 29 242 424',
        email: 'spitali.prizren@shskuk.org',
        address: 'Rruga Hasan Prishtina, Prizren',
        directorateHealthPhone: '+383 29 221 545'
    },
    'Pejë': {
        id: 'hosp-peje',
        name: 'Spitali i Përgjithshëm Pejë',
        type: 'Spital Rajonal',
        municipality: 'Pejë',
        region: 'Rajoni i Pejës',
        phone: '+383 39 432 020',
        emergencyPhone: '194 / +383 39 431 111',
        email: 'spitali.peje@shskuk.org',
        address: 'Rruga Nënë Tereza, Pejë',
        directorateHealthPhone: '+383 39 433 222'
    },
    'Gjakovë': {
        id: 'hosp-gjakove',
        name: 'Spitali i Përgjithshëm "Isa Grezda" Gjakovë',
        type: 'Spital Rajonal',
        municipality: 'Gjakovë',
        region: 'Rajoni i Gjakovës',
        phone: '+383 390 320 030',
        emergencyPhone: '194 / +383 390 321 000',
        email: 'spitali.gjakove@shskuk.org',
        address: 'Rruga Ismail Qemali, Gjakovë',
        directorateHealthPhone: '+383 390 320 200'
    },
    'Gjilan': {
        id: 'hosp-gjilan',
        name: 'Spitali i Përgjithshëm Gjilan',
        type: 'Spital Rajonal',
        municipality: 'Gjilan',
        region: 'Rajoni i Gjilanit',
        phone: '+383 280 320 011',
        emergencyPhone: '194 / +383 280 320 194',
        email: 'spitali.gjilan@shskuk.org',
        address: 'Rruga e Prishtinës p.n., Gjilan',
        directorateHealthPhone: '+383 280 320 700'
    },
    'Ferizaj': {
        id: 'hosp-ferizaj',
        name: 'Spitali i Përgjithshëm Ferizaj',
        type: 'Spital Rajonal',
        municipality: 'Ferizaj',
        region: 'Rajoni i Ferizajt',
        phone: '+383 290 320 020',
        emergencyPhone: '194 / +383 290 321 194',
        email: 'spitali.ferizaj@shskuk.org',
        address: 'Rruga Dëshmorët e Kombit, Ferizaj',
        directorateHealthPhone: '+383 290 320 500'
    },
    'Mitrovicë e Jugut': {
        id: 'hosp-mitrovice',
        name: 'Spitali i Përgjithshëm "Dr. Sami Haxhibeqiri" Mitrovicë',
        type: 'Spital Rajonal',
        municipality: 'Mitrovicë e Jugut',
        region: 'Rajoni i Mitrovicës',
        phone: '+383 28 532 222',
        emergencyPhone: '194 / +383 28 530 194',
        email: 'spitali.mitrovice@shskuk.org',
        address: 'Rruga Mbretëresha Teutë, Mitrovicë',
        directorateHealthPhone: '+383 28 532 500'
    },
    'Vushtrri': {
        id: 'hosp-vushtrri',
        name: 'Spitali "Sheikh Zayed" Vushtrri',
        type: 'Spital Rajonal',
        municipality: 'Vushtrri',
        region: 'Rajoni i Mitrovicës',
        phone: '+383 28 571 200',
        emergencyPhone: '194 / +383 28 571 194',
        email: 'spitali.vushtrri@shskuk.org',
        address: 'Rruga Dëshmorët e Kombit, Vushtrri',
        directorateHealthPhone: '+383 28 571 300'
    }
};
/**
 * Maps each of the 38 municipalities to its regional hospital and local QKMF
 */
export function getHospitalInfoForMunicipality(municipality) {
    if (KOSOVO_REGIONAL_HOSPITALS[municipality]) {
        return KOSOVO_REGIONAL_HOSPITALS[municipality];
    }
    // Regional affiliations for other municipalities
    const prizrenRegion = ['Suharekë', 'Dragash', 'Mamushë'];
    if (prizrenRegion.includes(municipality)) {
        return {
            ...KOSOVO_REGIONAL_HOSPITALS['Prizren'],
            name: `Spitali Rajonal Prizren (Përgjegjës për ${municipality}) & QKMF ${municipality}`,
            municipality
        };
    }
    const pejeRegion = ['Klinë', 'Deçan', 'Istog', 'Junik'];
    if (pejeRegion.includes(municipality)) {
        return {
            ...KOSOVO_REGIONAL_HOSPITALS['Pejë'],
            name: `Spitali Rajonal Pejë (Përgjegjës për ${municipality}) & QKMF ${municipality}`,
            municipality
        };
    }
    const gjakoveRegion = ['Rahovec', 'Malishevë'];
    if (gjakoveRegion.includes(municipality)) {
        return {
            ...KOSOVO_REGIONAL_HOSPITALS['Gjakovë'],
            name: `Spitali Rajonal Gjakovë (Përgjegjës për ${municipality}) & QKMF ${municipality}`,
            municipality
        };
    }
    const gjilanRegion = ['Viti', 'Kamenicë', 'Kllokot', 'Ranillug', 'Partesh', 'Novobërdë'];
    if (gjilanRegion.includes(municipality)) {
        return {
            ...KOSOVO_REGIONAL_HOSPITALS['Gjilan'],
            name: `Spitali Rajonal Gjilan (Përgjegjës për ${municipality}) & QKMF ${municipality}`,
            municipality
        };
    }
    const ferizajRegion = ['Kaçanik', 'Shtime', 'Shtërpcë', 'Hani i Elezit'];
    if (ferizajRegion.includes(municipality)) {
        return {
            ...KOSOVO_REGIONAL_HOSPITALS['Ferizaj'],
            name: `Spitali Rajonal Ferizaj (Përgjegjës për ${municipality}) & QKMF ${municipality}`,
            municipality
        };
    }
    const mitroviceRegion = ['Skenderaj', 'Mitrovicë e Veriut', 'Leposaviq', 'Zveçan', 'Zubin Potok'];
    if (mitroviceRegion.includes(municipality)) {
        return {
            ...KOSOVO_REGIONAL_HOSPITALS['Mitrovicë e Jugut'],
            name: `Spitali Rajonal Mitrovicë (Përgjegjës për ${municipality}) & QKMF ${municipality}`,
            municipality
        };
    }
    // Default to QKUK Prishtinë (for Podujevë, Fushë Kosovë, Obiliq, Lipjan, Drenas, Graçanicë, etj.)
    return {
        ...KOSOVO_REGIONAL_HOSPITALS['Prishtinë'],
        name: `QKUK Qendra Klinike & QKMF ${municipality || 'Komunale'}`,
        municipality: municipality || 'Prishtinë'
    };
}
