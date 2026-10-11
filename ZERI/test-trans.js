async function run() {
  const text = "Përshëndetje";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=sq&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(data[0][0][0]);
}
run();
