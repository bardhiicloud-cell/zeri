async function run() {
  const texts = ["Përshëndetje", "Si jeni?", "Mirë"];
  const combined = texts.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=sq&tl=en&dt=t&q=${encodeURIComponent(combined)}`;
  const res = await fetch(url);
  const data = await res.json();
  const results = data[0].map(item => item[0]);
  console.log(results);
}
run();
