async function run() {
  const texts = ["Përshëndetje", "Si jeni?", "Mirë"];
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=sq&tl=en&dt=t&` + texts.map(t => `q=${encodeURIComponent(t)}`).join('&');
  const res = await fetch(url);
  const data = await res.json();
  console.log(JSON.stringify(data[0]));
}
run();
