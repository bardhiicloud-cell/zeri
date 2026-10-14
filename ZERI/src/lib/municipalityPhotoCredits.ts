// Wikimedia Commons credits for the photos in src/assets/municipalities.
// `graded: true` means the night image is the real daytime photo colour-graded to night.
export interface MunicipalityPhotoCredit { title: string; author: string; license: string; source: string; graded?: boolean }
export const MUNICIPALITY_PHOTO_CREDITS: Record<string, { day: MunicipalityPhotoCredit; night: MunicipalityPhotoCredit }> = {
  'decan': {
    day: { title: 'Aerial panorama of the center, Deçan 1.jpg', author: 'Arianit', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Aerial_panorama_of_the_center%2C_De%C3%A7an_1.jpg' },
    night: { title: 'Aerial panorama of the center, Deçan 1.jpg', author: 'Arianit', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Aerial_panorama_of_the_center%2C_De%C3%A7an_1.jpg', graded: true },
  },
  'dragash': {
    day: { title: 'Ljubovishte, village in Dragash municipality.jpg', author: 'Aljabakphoto', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Ljubovishte,_village_in_Dragash_municipality.jpg' },
    night: { title: 'Milky Way over Brod, Dragash – Long-Exposure Astrophotography.jpg', author: 'Astroclubkosova', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Milky_Way_over_Brod%2C_Dragash_%E2%80%93_Long-Exposure_Astrophotography.jpg' },
  },
  'drenas': {
    day: { title: 'KRM Photography 16.jpg', author: 'Kosovare Ramadani Mehmeti', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:KRM_Photography_16.jpg' },
    night: { title: 'KRM Photography 16.jpg', author: 'Kosovare Ramadani Mehmeti', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:KRM_Photography_16.jpg', graded: true },
  },
  'ferizaj': {
    day: { title: 'Ferizaj Aerial View.jpg', author: 'Albinfo', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Ferizaj_Aerial_View.jpg' },
    night: { title: 'Ferizaj Aerial View.jpg', author: 'Albinfo', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Ferizaj_Aerial_View.jpg', graded: true },
  },
  'fushe-kosove': {
    day: { title: 'Fushë Kosovë railway station.jpg', author: 'Kabelleger / David Gubler (http://www.bahnbilder.ch)', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Fush%C3%AB_Kosov%C3%AB_railway_station.jpg' },
    night: { title: 'Fushë Kosovë railway station.jpg', author: 'Kabelleger / David Gubler (http://www.bahnbilder.ch)', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Fush%C3%AB_Kosov%C3%AB_railway_station.jpg', graded: true },
  },
  'gjakove': {
    day: { title: 'Gjakova - Çarshia e Madhe - Big Baazar Panorama.JPG', author: 'Shkëlzen Rexha (Valed Promotion)', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Gjakova_-_%C3%87arshia_e_Madhe_-_Big_Baazar_Panorama.JPG' },
    night: { title: 'Gjakova Naten Gjakova at Night.jpg', author: 'Wikimedia Commons', license: '', source: 'https://commons.wikimedia.org/wiki/File:Gjakova_Naten_Gjakova_at_Night.jpg' },
  },
  'gjilan': {
    day: { title: 'Gjilani pas dite.jpg', author: 'Planeti', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Gjilani_pas_dite.jpg' },
    night: { title: 'Gjilani pas dite.jpg', author: 'Planeti', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Gjilani_pas_dite.jpg', graded: true },
  },
  'gracanice': {
    day: { title: 'Gračanica Monastery, Kosovo – 2017-05 02.jpg', author: 'Pasztilla aka Attila Terbócs', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Gra%C4%8Danica_Monastery%2C_Kosovo_%E2%80%93_2017-05_02.jpg' },
    night: { title: 'Manastiri i Graçanicës, Kosova 12.jpg', author: 'GentiBehramaj', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Manastiri_i_Gra%C3%A7anic%C3%ABs%2C_Kosova_12.jpg' },
  },
  'hani-i-elezit': {
    day: { title: 'Komuna Hani i Elezit.jpg', author: 'Integrali bushi', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Komuna_Hani_i_Elezit.jpg' },
    night: { title: 'Komuna Hani i Elezit.jpg', author: 'Integrali bushi', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Komuna_Hani_i_Elezit.jpg', graded: true },
  },
  'istog': {
    day: { title: 'Burimi i ujit në Vrellë.jpg', author: 'VesaMorina1', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Burimi_i_ujit_n%C3%AB_Vrell%C3%AB.jpg' },
    night: { title: 'Istog at night.jpg', author: 'Generallyuntilestimate', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Istog_at_night.jpg' },
  },
  'junik': {
    day: { title: 'Junik.jpg', author: 'Arbenllapashtica', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Junik.jpg' },
    night: { title: 'Junik.jpg', author: 'Arbenllapashtica', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Junik.jpg', graded: true },
  },
  'kacanik': {
    day: { title: 'Panorama of Kacanik, Kosovo.jpg', author: 'Fidania 2001 Fidan Bela', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Panorama_of_Kacanik,_Kosovo.jpg' },
    night: { title: 'Panorama of Kacanik, Kosovo.jpg', author: 'Fidania 2001 Fidan Bela', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Panorama_of_Kacanik,_Kosovo.jpg', graded: true },
  },
  'kamenice': {
    day: { title: 'Kamenica Pano.jpg', author: 'Toksave', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Kamenica_Pano.jpg' },
    night: { title: 'Kamenica Pano.jpg', author: 'Toksave', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Kamenica_Pano.jpg', graded: true },
  },
  'kline': {
    day: { title: 'Kisha Katolike in Zllakuqan, dem "kleinen Rom" des Kosovo. - panoramio.jpg', author: 'Martin Furtschegger', license: 'CC BY 3.0', source: 'https://commons.wikimedia.org/wiki/File:Kisha_Katolike_in_Zllakuqan,_dem_%22kleinen_Rom%22_des_Kosovo._-_panoramio.jpg' },
    night: { title: 'Kisha Katolike in Zllakuqan, dem "kleinen Rom" des Kosovo. - panoramio.jpg', author: 'Martin Furtschegger', license: 'CC BY 3.0', source: 'https://commons.wikimedia.org/wiki/File:Kisha_Katolike_in_Zllakuqan,_dem_%22kleinen_Rom%22_des_Kosovo._-_panoramio.jpg', graded: true },
  },
  'kllokot': {
    day: { title: 'Serbian Orthodox church in Klokot.jpg', author: 'Filius humanitas', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Serbian_Orthodox_church_in_Klokot.jpg' },
    night: { title: 'Serbian Orthodox church in Klokot.jpg', author: 'Filius humanitas', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Serbian_Orthodox_church_in_Klokot.jpg', graded: true },
  },
  'leposaviq': {
    day: { title: 'Dren-Leposavić - pogled na selo i okolinu.jpg', author: 'Dragomir Miladinović', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Dren-Leposavi%C4%87_-_pogled_na_selo_i_okolinu.jpg' },
    night: { title: 'Dren-Leposavić - pogled na selo i okolinu.jpg', author: 'Dragomir Miladinović', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Dren-Leposavi%C4%87_-_pogled_na_selo_i_okolinu.jpg', graded: true },
  },
  'lipjan': {
    day: { title: 'City View, Lipjan, Kosovo.JPG', author: 'Memi Sahitolli', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:City_View%2C_Lipjan%2C_Kosovo.JPG' },
    night: { title: 'City View, Lipjan, Kosovo.JPG', author: 'Memi Sahitolli', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:City_View%2C_Lipjan%2C_Kosovo.JPG', graded: true },
  },
  'malisheve': {
    day: { title: 'Mirusha Waterfall in Malisheva.jpg', author: 'Veton Kastrati', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Mirusha_Waterfall_in_Malisheva.jpg' },
    night: { title: 'Mirusha Waterfall in Malisheva.jpg', author: 'Veton Kastrati', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Mirusha_Waterfall_in_Malisheva.jpg', graded: true },
  },
  'mamushe': {
    day: { title: 'Sahat kulla ne Mamushe.jpg', author: 'Bujar I Gashi', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Sahat_kulla_ne_Mamushe.jpg' },
    night: { title: 'Sahat kulla ne Mamushe.jpg', author: 'Bujar I Gashi', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Sahat_kulla_ne_Mamushe.jpg', graded: true },
  },
  'mitrovice': {
    day: { title: 'Kosovska Mitrovica 09.jpg', author: 'Geograf208', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Kosovska_Mitrovica_09.jpg' },
    night: { title: 'Mitrovica City.jpg', author: 'Bleron Çaka', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Mitrovica_City.jpg' },
  },
  'mitrovica-veriut': {
    day: { title: 'Mitrovica nga lart.JPG', author: 'AgronBeqiri', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Mitrovica_nga_lart.JPG' },
    night: { title: 'Ura e Ibrit Ibar Bridge Mitrovica.jpeg', author: 'GentiBehramaj', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Ura_e_Ibrit_Ibar_Bridge_Mitrovica_13_00_07_024000.jpeg' },
  },
  'novoberde': {
    day: { title: 'Novo Brdo Fortress (OSCAL19 trip).jpg', author: 'albinfo', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Novo_Brdo_Fortress_%28OSCAL19_trip%29.jpg' },
    night: { title: 'Novo Brdo Fortress (OSCAL19 trip).jpg', author: 'albinfo', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Novo_Brdo_Fortress_%28OSCAL19_trip%29.jpg', graded: true },
  },
  'obiliq': {
    day: { title: 'Obilic Kastriot Main street 2.JPG', author: 'Babaroga', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Obilic_Kastriot_Main_street_2.JPG' },
    night: { title: 'Obilic Kastriot Main street 2.JPG', author: 'Babaroga', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Obilic_Kastriot_Main_street_2.JPG', graded: true },
  },
  'partesh': {
    day: { title: 'Church of Holy Trinity in Parteš.jpg', author: 'Kafziel at English Wikipedia', license: 'CC BY 2.5', source: 'https://commons.wikimedia.org/wiki/File:Church_of_Holy_Trinity_in_Parte%C5%A1.jpg' },
    night: { title: 'Church of Holy Trinity in Parteš.jpg', author: 'Kafziel at English Wikipedia', license: 'CC BY 2.5', source: 'https://commons.wikimedia.org/wiki/File:Church_of_Holy_Trinity_in_Parte%C5%A1.jpg', graded: true },
  },
  'peje': {
    day: { title: 'A view of city of Peja III.jpg', author: 'Shkurte ramushi', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:A_view_of_city_of_Peja_III.jpg' },
    night: { title: 'Peja in the evening.jpg', author: 'Uniacademic', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Peja_in_the_evening.jpg' },
  },
  'podujeve': {
    day: { title: 'Qyteti i Podujeves 6.JPG', author: 'Aid Muliqi', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Qyteti_i_Podujeves_6.JPG' },
    night: { title: 'Qyteti i Podujeves 6.JPG', author: 'Aid Muliqi', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Qyteti_i_Podujeves_6.JPG', graded: true },
  },
  'prishtine': {
    day: { title: 'Panorama of Prishtina.JPG', author: 'Ardianlumi', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Panorama_of_Prishtina.JPG' },
    night: { title: 'Prishtina at the evening.jpg', author: 'Bujar I Gashi', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Prishtina_at_the_evening.jpg' },
  },
  'prizren': {
    day: { title: 'Prizren Cityscape.jpg', author: 'Tom.whitehead337', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Prizren_Cityscape.jpg' },
    night: { title: 'Night view of Prizren 2025.jpg', author: 'ほっきー', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Night_view_of_Prizren_2025.jpg' },
  },
  'rahovec': {
    day: { title: 'Vreshtat e Rahovecit.jpg', author: 'Bleron Caka', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Vreshtat_e_Rahovecit.jpg' },
    night: { title: 'Vreshtat e Rahovecit.jpg', author: 'Bleron Caka', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Vreshtat_e_Rahovecit.jpg', graded: true },
  },
  'ranillug': {
    day: { title: '20161001 114625 Ranilug Znepole.jpg', author: 'Kalisto9898', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:20161001_114625_Ranilug_Znepole.jpg' },
    night: { title: '20161001 114625 Ranilug Znepole.jpg', author: 'Kalisto9898', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:20161001_114625_Ranilug_Znepole.jpg', graded: true },
  },
  'shterpce': {
    day: { title: 'Liqeni - Shterpce..JPG', author: 'Sadikymeri', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Liqeni_-_Shterpce..JPG' },
    night: { title: 'Liqeni - Shterpce..JPG', author: 'Sadikymeri', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Liqeni_-_Shterpce..JPG', graded: true },
  },
  'shtime': {
    day: { title: 'Stadiumi i Shtimes.jpg', author: 'USIllyrian', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Stadiumi_i_Shtimes.jpg' },
    night: { title: 'Stadiumi i Shtimes.jpg', author: 'USIllyrian', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Stadiumi_i_Shtimes.jpg', graded: true },
  },
  'skenderaj': {
    day: { title: 'Skenderaj 1.jpg', author: 'sq:Përdoruesi:Kaperthuras', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Skenderaj_1.jpg' },
    night: { title: 'Skenderaj 1.jpg', author: 'sq:Përdoruesi:Kaperthuras', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Skenderaj_1.jpg', graded: true },
  },
  'suhareke': {
    day: { title: 'Theranda 2023.jpg', author: 'Metibudakovaa', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Theranda_2023.jpg' },
    night: { title: 'Theranda 2023.jpg', author: 'Metibudakovaa', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Theranda_2023.jpg', graded: true },
  },
  'viti': {
    day: { title: 'Vitia.JPG', author: 'Quqja', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Vitia.JPG' },
    night: { title: 'Vitia.JPG', author: 'Quqja', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Vitia.JPG', graded: true },
  },
  'vushtrri': {
    day: { title: 'Vushtrri, Kosovo.jpg', author: 'Bleron Çaka', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Vushtrri%2C_Kosovo.jpg' },
    night: { title: 'Qyteti i Vushtrrise naten.jpg', author: 'Bleron vushtrri', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Qyteti_i_Vushtrrise_naten.jpg' },
  },
  'zubin-potok': {
    day: { title: 'Gazivode Lake.JPG', author: 'Julian Nyča', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Gazivode_Lake.JPG' },
    night: { title: 'Gazivode Lake.JPG', author: 'Julian Nyča', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Gazivode_Lake.JPG', graded: true },
  },
  'zvecan': {
    day: { title: 'Pogled na Zvečan.jpg', author: 'Original uploader was Sima90 at sr.wikipedia', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Pogled_na_Zve%C4%8Dan.jpg' },
    night: { title: 'Pogled na Zvečan.jpg', author: 'Original uploader was Sima90 at sr.wikipedia', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Pogled_na_Zve%C4%8Dan.jpg', graded: true },
  },
};
