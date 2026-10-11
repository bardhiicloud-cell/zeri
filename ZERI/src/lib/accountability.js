const profiles = [
    { matches: ['infrastrukturës', 'rrugë lokale', 'gropa', 'asfaltim'], profile: { institution: 'Komuna - Drejtoria e Infrastrukturës', level: 'Komunale', responseHours: 72, office: 'Drejtoria e Infrastrukturës' } },
    { matches: ['ministria e infrastrukturës', 'autostrada', 'magjistrale', 'rajonale'], profile: { institution: 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', level: 'Qendrore', responseHours: 120, office: 'Sektori i Infrastrukturës' } },
    { matches: ['qkmf', 'ambulancat', 'shëndetësia primare'], profile: { institution: 'Komuna - QKMF / Ambulancat lokale', level: 'Komunale', responseHours: 24, office: 'Drejtoria e Shëndetësisë' } },
    { matches: ['ministria e shëndetësisë', 'shskuk', 'qkuk', 'spitalet rajonale'], profile: { institution: 'Ministria e Shëndetësisë / SHSKUK', level: 'Qendrore', responseHours: 24, office: 'Shërbimi Shëndetësor' } },
    { matches: ['arsimit', 'shkolla', 'kopshte', 'çerdhe'], profile: { institution: 'Komuna - Drejtoria e Arsimit', level: 'Komunale', responseHours: 72, office: 'Drejtoria e Arsimit' } },
    { matches: ['ujësjellësi', 'kru', 'kanalizimi', 'ujërat e zeza'], profile: { institution: 'KRU / Komuna - Shërbimet e Ujit', level: 'Publike', responseHours: 48, office: 'Shërbimet Publike' } },
    { matches: ['keds', 'kesco', 'rrjeti elektrik', 'ndriçimi publik'], profile: { institution: 'KEDS / KESCO dhe Komuna', level: 'Publike', responseHours: 24, office: 'Energjia dhe Ndriçimi' } },
    { matches: ['pastrimi', 'mbeturina', 'deponi', 'mjedisi'], profile: { institution: 'Kompania Pastrimi / Komuna - Mjedisi', level: 'Publike', responseHours: 48, office: 'Mjedisi dhe Higjiena' } },
    { matches: ['policia', 'siguria', 'aksident', 'rendit'], profile: { institution: 'Policia e Kosovës / MPB', level: 'Siguri', responseHours: 4, office: 'Siguria Publike' } },
    { matches: ['inspekcioni', 'ndërtime pa leje', 'tregje'], profile: { institution: 'Inspekcioni Komunal', level: 'Komunale', responseHours: 72, office: 'Inspekcioni' } },
    { matches: ['zjarrfikës', 'shpëtimi', 'emergjencë'], profile: { institution: 'Agjencia e Menaxhimit të Emergjencave', level: 'Siguri', responseHours: 1, office: 'Emergjencat' } },
    { matches: ['punëve të brendshme', 'pasaporta', 'letërnjoftime'], profile: { institution: 'Ministria e Punëve të Brendshme', level: 'Qendrore', responseHours: 120, office: 'Shërbimet Administrative' } },
    { matches: ['drejtësisë', 'gjykatat', 'prokuroria'], profile: { institution: 'Ministria e Drejtësisë', level: 'Qendrore', responseHours: 120, office: 'Drejtësia' } },
    { matches: ['financave', 'punës', 'pensionet', 'sociale'], profile: { institution: 'Ministria e Financave, Punës dhe Transfereve', level: 'Qendrore', responseHours: 120, office: 'Financat dhe Mirëqenia Sociale' } }
];
export function getAccountabilityProfile(category = '') {
    const normalized = category.toLowerCase();
    return profiles.find(item => item.matches.some(match => normalized.includes(match)))?.profile || {
        institution: 'Komuna - Zyra përkatëse',
        level: 'Komunale',
        responseHours: 72,
        office: 'Administrata Komunale'
    };
}
export function getAccountabilityDueDate(createdAt, responseHours) {
    return new Date(new Date(createdAt).getTime() + responseHours * 60 * 60 * 1000).toISOString();
}
