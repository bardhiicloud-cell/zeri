import type { L } from './memorial';

/**
 * Longer life stories for the martyrs in memorial.ts, and the photograph shown beside each.
 *
 * Every sentence here restates what the article linked as `source` on the martyr's entry says
 * (checked October 2026); anything a source does not say is not here. The photographs are of
 * statues, busts, memorials or, where a free-licence portrait exists, the person: the kind is
 * written on the card so a statue is never presented as a portrait. Author and licence of each
 * photo are in photoCredits.ts (key `dheshmor-<id>`).
 */
export interface MartyrProfile {
  /** A few sentences: who they were, what they did, how they fell, how the nation honours them. */
  bio: L;
  photo?: { kind: 'portrait' | 'statue' | 'bust' | 'memorial'; caption: L };
}

const l = (sq: string, en: string): L => ({ sq, en });

export const MARTYR_PROFILES: Readonly<Record<string, MartyrProfile>> = {
  'adem-jashari': {
    bio: l(
      'Lindi më 28 nëntor 1955 në Prekaz të Drenicës dhe njihet si «Ati i UÇK-së»: ishte një nga themeluesit e Ushtrisë Çlirimtare të Kosovës. Më 5–7 mars 1998 forcat serbe sulmuan shtëpinë e tij në Prekaz; në betejën që pasoi ranë Ademi, vëllai i tij Hamëz dhe dhjetëra anëtarë të familjes (burimi përmend 57). Pas shpalljes së pavarësisë më 2008 iu dha titulli postum «Hero i Kosovës».',
      'Born on 28 November 1955 in Prekaz, Drenica, he is known as the “Father of the KLA”: one of the founders of the Kosovo Liberation Army. On 5–7 March 1998 Serbian forces attacked his home in Prekaz; in the battle that followed Adem, his brother Hamëz and dozens of family members fell (the source gives 57). After independence in 2008 he was posthumously named “Hero of Kosovo”.'),
    photo: { kind: 'bust', caption: l('Busti i Adem Jasharit në Tiranë', 'Bust of Adem Jashari in Tirana') },
  },
  'hamez-jashari': {
    bio: l(
      'Lindi më 19 shkurt 1950, kreu shkollën e mesme në Skenderaj dhe vazhdoi studimet në shkollën e lartë ekonomike; kishte afri të madhe me artet. Ishte vëllai i Adem Jasharit dhe luftoi bashkë me të në kryengritjen e viteve 1995–1998. Ra më 7 mars 1998 në Prekaz; e bija, Besarta, mbijetoi.',
      'Born on 19 February 1950, he finished secondary school in Skenderaj and went on to the higher school of economics; he had a strong feeling for the arts. He was Adem Jashari’s brother and fought beside him in the uprising of 1995–1998. He fell on 7 March 1998 in Prekaz; his daughter Besarta survived.'),
    photo: { kind: 'portrait', caption: l('Hamëz Jashari', 'Hamëz Jashari') },
  },
  'zahir-pajaziti': {
    bio: l(
      'Lindi më 1 nëntor 1962 në Turuçicë të Podujevës dhe u rrit në Orllan të Llapit. Studioi gjuhën angleze në Universitetin e Prishtinës dhe mori pjesë në demonstratat e 1981-it. Është ndër themeluesit dhe komandantët e parë të UÇK-së, i quajtur «Pushka e parë e lirisë». Ra më 31 janar 1997 në pritën e Pestovës bashkë me Hakif Zejnullahun dhe Edmond Hoxhën. Më 2008 u shpall Hero i Kosovës dhe shtatorja e tij qëndron në bulevardin «Nënë Tereza» në Prishtinë.',
      'Born on 1 November 1962 in Turuçicë, Podujevë, and raised in Orllan in Llap. He studied English at the University of Pristina and took part in the 1981 demonstrations. He is one of the founders and first commanders of the KLA, known as the “First Gun of Freedom”. He fell on 31 January 1997 in the Pestovë ambush with Hakif Zejnullahu and Edmond Hoxha. In 2008 he was declared a Hero of Kosovo; his statue stands on Mother Teresa Boulevard in Pristina.'),
    photo: { kind: 'statue', caption: l('Shtatorja e Zahir Pajazitit në Prishtinë', 'Statue of Zahir Pajaziti in Pristina') },
  },
  'hakif-zejnullahu': {
    bio: l(
      'Lindi më 22 qershor 1962 në Lladoc të Podujevës. Në vitin 1989 qe i lidhur ngushtë me «Çetën e Llapit», një grup i armatosur që vuri themelet e asaj që do të bëhej UÇK. Kur UÇK u formua zyrtarisht më 1995, bashkë me Zahir Pajazitin koordinoi veprimtaritë e para. Ra më 31 janar 1997 në pritën e Pestovës.',
      'Born on 22 June 1962 in Lladoc, Podujevë. In 1989 he was closely tied to the “Çeta e Llapit”, an armed group that laid the foundation for what became the KLA. When the KLA was formally established in 1995 he and Zahir Pajaziti coordinated its first activities. He fell on 31 January 1997 in the Pestovë ambush.'),
    photo: { kind: 'statue', caption: l('Shtatorja e Hakif Zejnullahut', 'Statue of Hakif Zejnullahu') },
  },
  'luan-haradinaj': {
    bio: l(
      'Lindi më 17 nëntor 1973 në Gllogjan të Deçanit, një nga dhjetë fëmijët; vëllezërit e tij ishin Ramushi, Shkëlzeni dhe Dauti. Në nëntor 1993, bashkë me vëllezërit, formoi një nga bërthamat e para të rezistencës së armatosur në Dukagjin dhe në 1994 u emërua shef i logjistikës së UÇK-së. Shokët e njihnin për ndershmërinë, solidaritetin dhe kujdesin gjatë kalimit të kufirit, ndërsa rrugët i njihte më mirë se kushdo. Ra më 6 maj 1997 në Qafë Prush, në kufirin me Shqipërinë.',
      'Born on 17 November 1973 in Gllogjan, Deçan, one of ten children; his brothers included Ramush, Shkëlzen and Daut. In November 1993, with his brothers, he formed one of the first nuclei of armed resistance in Dukagjin, and in 1994 he was appointed the KLA’s chief of logistics. Comrades knew him for honesty, solidarity and the care he took on border crossings, which he knew better than anyone. He fell on 6 May 1997 at Qafë Prush on the Albanian border.'),
    photo: { kind: 'statue', caption: l('Shtatorja e Luan Haradinajt në Deçan', 'Statue of Luan Haradinaj in Deçan') },
  },
  'bahri-fazliu': {
    bio: l(
      'Poet, publicist dhe veprimtar i çështjes kombëtare, i lindur më 1971 në Llaushë të Podujevës; ishte vëllai i vogël i Fahri Fazliut. Bashkëthemelues i Lëvizjes Kombëtare për Çlirimin e Kosovës (LKÇK) dhe udhëheqës i saj pas burgosjes së Avni Klinakut, si dhe kryeredaktor i gazetës «Çlirimi». Ra më 7 maj 1998 në përpjekje me ushtrinë jugosllave në Bjeshkën e Bogiçes, katër ditë para marrëveshjes zyrtare të LKÇK-së me UÇK-në. Mban titullin «Hero i Kosovës», disa rrugë mbajnë emrin e tij.',
      'A poet, publicist and activist, born in 1971 in Llaushë, Podujevë; the younger brother of Fahri Fazliu. A co-founder of the National Movement for the Liberation of Kosovo (LKÇK) and its leader after Avni Klinaku’s imprisonment, and chief editor of the newspaper “Çlirimi”. He fell on 7 May 1998 in a clash with the Yugoslav army at Bjeshka e Bogiçes, four days before the formal agreement between the LKÇK and the KLA. He holds the title “Hero of Kosovo” and streets bear his name.'),
  },
  'agim-celaj': {
    bio: l(
      'Lindi më 12 qershor 1961 në Strellc të Pejës, i njohur me nofkën «Coli». Mori stërvitje ushtarake në Beograd (1980–1982) dhe më pas në Kroaci, ku luftoi si vullnetar kur nisi lufta në Kroaci. Në 1998, pas sulmit në Prekaz, hyri në Kosovë në krye të 45 burrave e grave të armatosur, duke vepruar në Likoc, Açarevë, Negroc e Kleçkë; më 25 qershor 1998 me Ismet Jasharin shkatërroi një automjet të blinduar jugosllav. Ra më 19 korrik 1998 pas sulmit në Rahovec. Më 14 dhjetor 2016 iu dha titulli «Hero i Kosovës».',
      'Born on 12 June 1961 in Strellc, Pejë, known by the nickname “Coli”. He trained at the military academy in Belgrade (1980–1982) and then in Croatia, where he fought as a volunteer. In 1998, after the attack on Prekaz, he entered Kosovo leading 45 armed men and women, operating in Likoc, Açarevë, Negroc and Kleçkë; on 25 June 1998, with Ismet Jashari, he destroyed a Yugoslav armoured vehicle. He fell on 19 July 1998 after the attack on Rahovec. On 14 December 2016 he was awarded the title “Hero of Kosovo”.'),
  },
  'bekim-berisha': {
    bio: l(
      'Lindi më 15 qershor 1966 në Graboc të Pejës, më i vogli i gjashtë fëmijëve. Studioi veterinari në Zagreb. Më 7 gusht 1991, në moshën 25-vjeçare, u kthye në Kroaci si vullnetar i Gardës Kombëtare Kroate në batalionin e 57-të në Sisak, më pas luftoi në Armatën e Bosnje-Hercegovinës, dhe në 1998 iu bashkua UÇK-së, ku u emërua gjeneral. Ra më 10 gusht 1998 në betejën e Junikut dhe pas vdekjes u ngrit në gradën Gjeneral Brigade.',
      'Born on 15 June 1966 in Graboc, Pejë, the youngest of six children. He studied veterinary science in Zagreb. On 7 August 1991, aged 25, he returned to Croatia as a volunteer in the Croatian National Guard’s 57th Battalion in Sisak, later fought in the Army of Bosnia and Herzegovina, and in 1998 joined the KLA, where he was named a general. He fell on 10 August 1998 in the Battle of Junik and was posthumously promoted to Brigadier General.'),
  },
  'ismet-jashari': {
    bio: l(
      'Lindi më 16 prill 1967 në Orizare të Likovës dhe jetonte në Zvicër kur, pas masakrës së Prekazit, iu bashkua UÇK-së. Më 11 mars 1998 hyri në Drenicë me Fehmi Lladrovcin, Bekim Berishën dhe Fatmir Limajn, dhe javët në vazhdim Shtabi i Përgjithshëm e caktoi komandant në rajonin e Llapushës. Ra më 25 gusht 1998 në Kleçkë. Brigada e UÇK-së mban emrin «Ismet Jashari – Kumanova» dhe pas luftës iu dha titulli «Hero i Kosovës».',
      'Born on 16 April 1967 in Orizare, Lipkovo, and living in Switzerland when, after the Prekaz massacre, he joined the KLA. On 11 March 1998 he entered Drenica with Fehmi Lladrovci, Bekim Berisha and Fatmir Limaj, and in the following weeks the General Staff made him commander in the Llapusha region. He fell on 25 August 1998 in Kleçkë. A KLA brigade bears the name “Ismet Jashari – Kumanova” and after the war he was declared a Hero of Kosovo.'),
    photo: { kind: 'statue', caption: l('Shtatorja e Ismet Jasharit në Prizren', 'Statue of Ismet Jashari in Prizren') },
  },
  'fehmi-lladrovci': {
    bio: l(
      'Lindi më 15 maj 1956 dhe kreu shkollën teknike «19 Nëntori» në Prishtinë; mësuesi i tij, Fazli Graiqevci, i dha frymë patriotike. Studioi në Zagreb dhe në fillim të viteve ’80, bashkë me bashkëshorten Xhevë Krasniqi, u bë anëtar aktiv i Lëvizjes Popullore të Kosovës (LPK). Në shtator 1985 u arrestua dhe u dënua me 10 vjet burg; u lirua në 1991 me amnistinë kroate, luftoi në Kroaci dhe më pas jetoi në Mynih. Ra më 22 shtator 1998, krah për krah me Xhevën, në ofensivën e Drenicës Qendrore.',
      'Born on 15 May 1956, he finished the “19 Nëntori” technical school in Pristina; his teacher Fazli Graiqevci inspired his patriotism. He studied in Zagreb and in the early 1980s, with his wife Xhevë Krasniqi, became an active member of the People’s Movement of Kosovo (LPK). In September 1985 he was arrested and sentenced to ten years; released in 1991 under a Croatian amnesty, he fought in Croatia and later lived in Munich. He fell on 22 September 1998, side by side with Xhevë, in the Central Drenica offensive.'),
  },
  'muje-krasniqi': {
    bio: l(
      'Lindi më 6 qershor 1967 në Çabiq të Klinës, një nga katërmbëdhjetë fëmijët e një familjeje të varfër; shkollën e mesme e kreu në Kijevë. Demonstratat e 1981-it ia ngjallën ndjenjën e padrejtësisë. Bashkë me Adem Jasharin dhe Nuhi Gecin themeloi UÇK-në në fillim të viteve ’90 dhe ishte lidhja mes Drenicës, Dukagjinit e Pashtrikut. Mban nofkën «Komandant Kapuçi». Ra më 14 dhjetor 1998 në pritën e Gorozhupit.',
      'Born on 6 June 1967 in Çabiq, Klinë, one of fourteen children of a hard-pressed family; he attended secondary school in Kijevë. The 1981 demonstrations awakened his sense of injustice. With Adem Jashari and Nuhi Geci he founded the KLA in the early 1990s and was the link between Drenica, Dukagjin and Pashtrik. He is known as “Commander Kapuçi”. He fell on 14 December 1998 in the Gorozhup ambush.'),
  },
  'agim-ramadani': {
    bio: l(
      'Lindi më 3 maj 1963 në Zhegër të Gjilanit, i njohur me nofkën «Katana». Studioi në shkollën e lartë teknike në Gjilan dhe në Akademinë Ushtarake të Komunikimit në Zagreb. Në 1998 la Zvicrën, ku jetonin bashkëshortja dhe tre fëmijët, dhe iu bashkua UÇK-së si komandant në zonën operative të Dukagjinit; udhëhoqi mbrojtjen e fshatrave Gjocaj e Jasiq (28 korrik) dhe betejën e Oplazës (9 gusht). Ra më 11 prill 1999 në Betejën e Koshares dhe pas luftës u shpall Hero i Kosovës.',
      'Born on 3 May 1963 in Zhegër, Gjilan, known by the nickname “Katana”. He studied at the higher technical school in Gjilan and the military communications academy in Zagreb. In 1998 he left Switzerland, where his wife and three children lived, and joined the KLA as a commander in the Dukagjin operational zone; he led the defence of the villages of Gjocaj and Jasiq (28 July) and the battle of Oplazë (9 August). He fell on 11 April 1999 in the Battle of Koshare and after the war was declared a Hero of Kosovo.'),
  },
  'shkelzen-haradinaj': {
    bio: l(
      'Lindi më 25 mars 1970 në Gllogjan të Deçanit. Në 1993 iu bashkua njësiteve të UÇK-së në Dukagjin, bashkë me vëllanë Luan, dhe shtëpia e familjes u bë bazë e rëndësishme e veprimtarisë. Kur mësoi për sulmin ndaj Ademit e familjes në Prekaz, në marsin 1998 organizoi mbi 22 veprime të armatosura brenda natës kundër bazave serbe në Dukagjin. Ra më 16 prill 1999 në Maznik, duke mbrojtur popullsinë civile që fshihej në pyjet pranë Deçanit.',
      'Born on 25 March 1970 in Gllogjan, Deçan. In 1993 he joined KLA units in Dukagjin with his brother Luan, and the family home became an important base. On learning of the attack on Adem and his family in Prekaz, in March 1998 he carried out more than 22 armed actions overnight against Serbian bases in Dukagjin. He fell on 16 April 1999 at Maznik, protecting civilians hiding in the forests near Deçan.'),
    photo: { kind: 'bust', caption: l('Busti i Gjeneral Shkëlzen Haradinajt në Pejë', 'Bust of General Shkëlzen Haradinaj in Pejë') },
  },
  'sali-cekaj': {
    bio: l(
      'Lindi më 22 qershor 1956 në Broliq të Deçanit, ishte jurist dhe aktivist politik që nga demonstratat e 1981-it; ndihmoi në hartimin e Kushtetutës së Kaçanikut (1990) dhe në statutin e komunës së Deçanit. Pas urdhër-arrestit u largua në Gjermani më 1991, ku organizoi diasporën dhe iniciativën për stërvitjen ushtarake të të rinjve në Shqipëri. Komandant i FARK-ut dhe i UÇK-së, ra më 19 prill 1999 në Betejën e Koshares.',
      'Born on 22 June 1956 in Broliq, Deçan, he was a lawyer and political activist from the 1981 demonstrations; he helped draft the Kaçanik Constitution (1990) and a communal statute for Deçan municipality. After an arrest warrant he left for Germany in 1991, where he organised the diaspora and the military training of young volunteers in Albania. A commander of FARK and the KLA, he fell on 19 April 1999 in the Battle of Koshare.'),
    photo: { kind: 'statue', caption: l('Shtatorja e Sali Çekajt në Deçan', 'Statue of Sali Çekaj in Deçan') },
  },
  'ilaz-kodra': {
    bio: l(
      'Lindi më 3 maj 1966 në Prekazin e Epërm, kreu shkollën në Skenderaj dhe Shkollën e Lartë Tregtare në Pejë, dhe e vuri shërbimin ushtarak në Slloveni. Rezistenca e Tahir e Nebih Mehës më 1981 e formësoi. U bë bashkëthemelues i bërthamës së parë të UÇK-së, ishte «dora e djathtë e Adem Jasharit» dhe më 1991 kaloi në Shqipëri për stërvitje. Ra më 30 prill 1999 në Betejën e Shtuticës.',
      'Born on 3 May 1966 in Prekaz i Epërm, he attended school in Skenderaj and the Higher Commercial School in Pejë, and did his military service in Slovenia. The 1981 resistance of Tahir and Nebih Meha shaped him. He helped form the first nucleus of the KLA, was the “right hand of Adem Jashari”, and in 1991 crossed into Albania for training. He fell on 30 April 1999 in the Battle of Shtuticë.'),
  },
  'tahir-meha': {
    bio: l(
      'Lindi më 10 tetor 1943 në Prekaz të Drenicës, në familjen Meha, shtëpia e së cilës — Kulla e Mehajve — u bë simbol qëndrese. Gjyshi i tij, Emin Lati, kishte qenë kaçak krah Azem Bejtës, dhe revolja e Azemit kaloi te Tahiri. Kur refuzoi t’u dorëzonte armët autoriteteve jugosllave, përplasja u shndërrua në luftim të armatosur që u mbyll më 13 maj 1981: ra bashkë me të atin, Nebih Mehën. Kujtohet në folklorin shqiptar si hero.',
      'Born on 10 October 1943 in Prekaz, Drenica, into the Meha family, whose home — the Kulla e Mehajve — became a symbol of resilience. His grandfather Emin Lati had been a kachak beside Azem Bejta, and Azem’s revolver passed to Tahir. When he refused to hand his weapons to the Yugoslav authorities, the confrontation became an armed fight that ended on 13 May 1981: he fell with his father, Nebih Meha. He is remembered in Albanian folklore as a hero.'),
  },
  'nebih-meha': {
    bio: l(
      'Lindi në vitin 1910 dhe ishte babai i Tahir Mehës. Ra më 13 maj 1981 në Prekaz, krah për krah me të birin, në rezistencën e familjes Meha ndaj forcave jugosllave. Shembulli i tyre u bë frymëzim për brezin që themeloi UÇK-në.',
      'Born in 1910, he was Tahir Meha’s father. He fell on 13 May 1981 in Prekaz, side by side with his son, in the Meha family’s resistance against Yugoslav forces. Their example inspired the generation that founded the KLA.'),
    photo: { kind: 'bust', caption: l('Busti i Nebih Mehës', 'Bust of Nebih Meha') },
  },
  'jusuf-gervalla': {
    bio: l(
      'Lindi më 1 tetor 1943 në Burrëmadh (Dubovik) të Deçanit; studioi në Prishtinë e Lubjanë dhe punoi gazetar në Shkup e Prishtinë. Ishte shkrimtar dhe muzikant (veprat «Fluturojnë e bien», «Kanjushë e verdhë», «Rrotull»). Në 1980 kërkoi azil në Gjermani, ku themeloi Lëvizjen Popullore për Republikën e Kosovës, nga e cila dolën LPK dhe LKÇK. Më 17 janar 1982 u vra pranë Shtutgartit bashkë me vëllanë Bardhosh dhe Kadri Zekën; vrasja e tyre shkaktoi zemërim të madh dhe forcoi qëndresën shqiptare.',
      'Born on 1 October 1943 in Burrëmadh (Dubovik), Deçan, he studied in Pristina and Ljubljana and worked as a journalist in Skopje and Pristina. He was a writer and musician (works include “Fluturojnë e bien”, “Kanjushë e verdhë”, “Rrotull”). In 1980 he sought asylum in Germany, where he founded the Popular Movement for the Republic of Kosovo, from which the LPK and LKÇK emerged. On 17 January 1982 he was shot dead near Stuttgart with his brother Bardhosh and Kadri Zeka; the killings caused outrage and hardened Albanian resolve.'),
    photo: { kind: 'statue', caption: l('Shtatorja e Jusuf Gërvallës', 'Statue of Jusuf Gërvalla') },
  },
  'bardhosh-gervalla': {
    bio: l(
      'Vëllai i Jusuf Gërvallës. Më 17 janar 1982 u vra në makinë pranë Shtutgartit, bashkë me Jusufin dhe veprimtarin Kadri Zeka, në atentatin që u atribuua shërbimit sekret jugosllav.',
      'Brother of Jusuf Gërvalla. On 17 January 1982 he was shot dead in a car near Stuttgart with Jusuf and the activist Kadri Zeka, in an assassination attributed to the Yugoslav secret service.'),
  },
  'kadri-zeka': {
    bio: l(
      'Veprimtar i çështjes kombëtare. Më 17 janar 1982 u vra pranë Shtutgartit, në makinë me vëllezërit Jusuf e Bardhosh Gërvalla, në atentatin që u atribuua shërbimit sekret jugosllav. Emri i tij mbahet në kujtesë me bustin pranë ndërtesës së Radio Kosovës.',
      'A national-cause activist. On 17 January 1982 he was shot dead near Stuttgart, in a car with the brothers Jusuf and Bardhosh Gërvalla, in an assassination attributed to the Yugoslav secret service. His memory is kept by a bust beside the Radio Kosova building.'),
    photo: { kind: 'bust', caption: l('Busti i Kadri Zekës para Radio Kosovës', 'Bust of Kadri Zeka at the Radio Kosova building') },
  },

  'agim-shala': {
    bio: l(
      'Lindi më 18 shtator 1975 në Jeshkovë të Prizrenit. E ndërpreu shkollën e mesme teknike në Prizren kur familja u varfërua nga ndjekjet dhe në 1993 shkoi në Romë. Pas sulmit në Prekaz iu bashkua UÇK-së; më 6 maj 1998 u vendos në Shtabin Operativ Rajonal të Prizrenit dhe luftoi në Bilushë (7 korrik) dhe në Tusus e Hoçën e Zagradës (16 korrik). Ra më 3 shtator 1998 në ofensivën e policisë në rajonin e Vërrinit, pasi kishte lidhur plagët e shokut të tij. Më 2023 shtatorja e tij u ngrit përpara komunës së Prizrenit.',
      'Born on 18 September 1975 in Jeshkovë, Prizren. He left the technical secondary school in Prizren when persecution impoverished his family and in 1993 went to Rome. After the attack on Prekaz he joined the KLA; on 6 May 1998 he was placed in the regional operational headquarters for Prizren and fought at Bilushë (7 July) and at Tusus and Hoça e Zagradës (16 July). He fell on 3 September 1998 in the police offensive on the Vërrin region, after dressing a fellow soldier’s wounds. In 2023 a statue of him was set up in front of Prizren municipality.'),
  },
  'abedin-rexha': {
    bio: l(
      'Lindi më 8 korrik 1969 në Vojnik të Skenderajt; studioi minierinë dhe metalurgjinë në Mitrovicë dhe, që në shkollë të mesme, shpërndante fletushka kundër pushtetit jugosllav. U largua nga Kosova më 1992, iu bashkua UÇK-së më 1996 dhe u takua me Adem Jasharin. Më 6 maj 1997 ishte në grupin që u përpoq të kalonte Qafën e Prushit. Komandant i Brigadës 112 «Arben Haliti», ra më 8 tetor 1998 në Klladërnicë afër Skenderajt; rrethanat e rënies shihni te burimi. Më 2017 iu dha titulli «Hero i Kosovës», dhe një shkollë në Turiçec mban emrin e tij.',
      'Born on 8 July 1969 in Vojnik, Skenderaj; he studied mining and metallurgy in Mitrovica and, already in secondary school, distributed leaflets against Yugoslav rule. He left Kosovo in 1992, joined the KLA in 1996 and met Adem Jashari. On 6 May 1997 he was in the group that tried to cross the Prush Pass. Commander of the 112th Brigade “Arben Haliti”, he fell on 8 October 1998 at Klladërnicë near Skenderaj; for the circumstances see the source. In 2017 he was awarded “Hero of Kosovo” and a school in Turiçec bears his name.'),
  },
  'besnik-lajci': {
    bio: l(
      'Lindi në Pejë më 1971 dhe studioi filozofi e letërsi shqipe në Universitetin e Prishtinës. Ishte ndër luftëtarët e parë të UÇK-së në Rugovë: bashkë me Salih e Selman Lajçin themeloi më 1997 Shtabin Rajonal të Rugovës, pati rol të rëndësishëm në furnizimin me armë dhe në krijimin e Brigadës 163 «Rugova», ku u bë gjeneral i njësisë zbuluese. Ra më 19 prill 1999 në Hajlë: i plagosur, sulmoi vijën e armikut për të mbuluar shokët. Mban titullin «Hero i Kosovës» dhe «Nderin e Kombit» nga presidenti i Shqipërisë.',
      'Born in Pejë in 1971, he studied philosophy and Albanian literature at the University of Pristina. He was among the first KLA fighters in Rugova: with Salih and Selman Lajçi he formed the Rugova Regional Staff in 1997, played a major part in the supply of arms and in creating the 163rd “Rugova” Brigade, where he became a general of the scouting unit. He fell on 19 April 1999 at Hajla: wounded, he charged the enemy line to cover his comrades. He holds the title “Hero of Kosovo” and the “Honour of the Nation” from the President of Albania.'),
  },
  'albesian-mataj': {
    bio: l(
      'Lindi më 3 gusht 1982 dhe ishte një nga luftëtarët më të rinj të UÇK-së që ranë në detyrë. Familja e tij ishte nga Osek i Pashës i Gjakovës; më 23 mars 1998, bashkë me vëllanë Albinot, u regjistrua në Junik, në zonën operative të Dukagjinit. Luftoi në rrethimin e Junikut, pastaj në Gllogjan nën komandën e Daut Haradinajt dhe më pas në njësinë «Shqiponjat e Zeza». U vra në pritë të policisë serbe natën mes 27 e 28 shkurtit 1999, teksa nisej nga fshati për në Gjakovë; ishte 16 vjeç. Prehet në Gjakovë, ku është ngritur memorial dhe çdo vit më 28 shkurt mbahen përkujtime.',
      'Born on 3 August 1982, he was one of the youngest KLA fighters to fall on duty. His family was from Osek i Pashës, Gjakova; on 23 March 1998, with his brother Albinot, he enlisted in Junik, in the Dukagjin operational zone. He fought in the siege of Junik, then at Gllogjan under Daut Haradinaj and later in the “Black Eagles” unit. He was killed in a Serbian police ambush on the night of 27–28 February 1999 as he set out from his village for Gjakova; he was 16. He is buried in Gjakova, where a memorial has been raised and commemorations are held every 28 February.'),
  },
  'bashkim-suka': {
    bio: l(
      'Lindi më 2 shkurt 1979 dhe ishte komandant i Njësisë Speciale të Brigadës 125 të UÇK-së. Gjatë 1998 mori pjesë në veprimet në rajonin jugor të Prizrenit, përfshirë ofensivën jugosllave mbi Prizren, ku u plagos. Ra më 11 mars 1999 në Betejën e Jeshkovës, duke mbrojtur pozicionet e UÇK-së. Më 2015 iu dha urdhri «Luftëtar i Lirisë Adem Jashari», dhe më 2019 titulli «Hero i Kosovës».',
      'Born on 2 February 1979, he was commander of the Special Unit of the KLA’s 125th Brigade. During 1998 he took part in operations in the southern Prizren region, including against the Yugoslav offensive on Prizren, where he was wounded. He fell on 11 March 1999 in the Battle of Jeshkovë, defending KLA positions. In 2015 he was awarded the “Freedom Fighter Adem Jashari” order and in 2019 the title “Hero of Kosovo”.'),
  },
  'indrit-cara': {
    bio: l(
      'Shqiptar nga Kavaja, i lindur më 11 korrik 1971 në një familje punëtore; jetonte në Londër mes kosovarëve. Në fillim të 1999 u kthye në Shqipëri për t’iu bashkuar UÇK-së dhe hyri në Kosovë me tre shokë. Ra më 31 mars 1999 në Betejën e Gallushës dhe u varros në Negroc me nderime ushtarake. Më 2009 presidenti Fatmir Sejdiu i dha medaljen «Adem Jashari»; Kavaja e ka bërë qytetar nderi, një rrugë mban emrin e tij dhe në qendër ka një shtatore. Është shembull i vullnetarëve nga Shqipëria që luftuan për Kosovën.',
      'An Albanian from Kavajë, born on 11 July 1971 into a working-class family; he lived in London among Kosovars. In early 1999 he returned to Albania to join the KLA and entered Kosovo with three friends. He fell on 31 March 1999 in the Battle of Gallushë and was buried in Negroc with a military salute. In 2009 President Fatmir Sejdiu awarded him the “Adem Jashari” medal; Kavajë has named him an honorary citizen, a street bears his name and a statue stands in the town centre. He is an example of the volunteers from Albania who fought for Kosovo.'),
    photo: { kind: 'bust', caption: l('Busti i Indrit Carës «Ushtar Kavaja»', 'Bust of Indrit Cara “Ushtar Kavaja”') },
  },
  'malush-ahmeti': {
    bio: l(
      'Lindi më 16 nëntor 1951 në Rezallë të Skenderajt, në një familje të varfër e patriote. Nga 1991–1992 prodhonte armë me dorë në punëtorinë e tij nëntokësore, derisa policia serbe ia bastisi shtëpinë më 1997 dhe ia mori veglat. Konsiderohet ndër shokët më të ngushtë të Adem Jasharit. Ra më 15 maj 1999 pranë Rezallës nga një predhë haubice 122 mm, teksa koordinonte mbrojtjen me komandantë të tjerë. Gjatë luftës kishte humbur edhe të birin shtatëvjeçar, Leotrimin.',
      'Born on 16 November 1951 in Rezallë, Skenderaj, into a poor and patriotic family. From 1991–1992 he made firearms by hand in his underground workshop, until Serbian police raided his home in 1997 and took his tools. He is considered one of Adem Jashari’s closest comrades. He fell on 15 May 1999 near Rezallë, struck by a 122 mm howitzer shell while coordinating the defence with other commanders. During the war he had also lost his seven-year-old son Leotrim.'),
  },
  'rasim-kicina': {
    bio: l(
      'Lindi më 25 gusht 1972 në Banjicë të Drenicës; shkollën e mesme «Skënderbeu» e kreu në Drenicë, i dalluar në mësime dhe në futboll. Më 1992 çarmatosi dy policë serbë që ngacmonin udhëtarë shqiptarë në tren — veprimi me të cilin nisi rezistenca e tij aktive. U bë komandant dhe anëtar i hershëm i Shtabit të Përgjithshëm të UÇK-së. U vra më 30 maj 1999 në një pritë afër Arllatit, bashkë me shokun Ragip Halilaj, dhe u varros në Negroc. Mban titullin «Hero i Kosovës».',
      'Born on 25 August 1972 in Banjica, Drenica; he attended the “Skënderbeu” secondary school in Drenica, standing out in studies and football. In 1992 he disarmed two Serbian police officers harassing Albanian passengers on a train — the act with which his active resistance began. He became a commander and an early member of the KLA General Staff. He was killed on 30 May 1999 in an ambush near Arllat, with his comrade Ragip Halilaj, and was buried in Negroc. He holds the title “Hero of Kosovo”.'),
  },
};
