document.addEventListener('DOMContentLoaded', () => BRM.initPrivatePage(async () => {
  const main = document.querySelector('#app-main');
  main.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow">Production library</span><h1>Descendants Libretto</h1><p>Read the complete libretto for authorized rehearsal and production use.</p></div>
      <div class="page-actions"><a class="button button-secondary" href="production-library.html">Script & sheet music</a><a class="button button-primary" href="downloads/BedfordRoadMusical-2.15.6.apk" download>Open in ScoreFlow</a></div>
    </div>
    <div class="alert alert-info"><strong>Protected rehearsal material:</strong> the libretto is available only inside the Android app. It cannot be downloaded, saved, exported, or shared from the website.</div>
    <section class="panel" style="margin-top:20px"><span class="eyebrow">ScoreFlow</span><h2>Read, listen, and annotate together</h2><p>Your authorized rehearsal reader keeps annotations with the score and places the music player within easy reach.</p></section>`;
}));
