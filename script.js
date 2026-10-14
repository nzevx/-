(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const scenes = $$('.scene');
  const starCount = $('#star-count');
  const starTotal = $('#star-total');
  const journalText = $('#journal-text');
  const modal = $('#wonder-modal');
  const modalTitle = $('#modal-title');
  const modalCopy = $('#modal-copy');
  const toast = $('#toast');
  let currentScene = 0;
  let pendingWonderStar = false;
  let toastTimer;
  let soundEnabled = false;
  let audioContext = null;
  let melodyTimer = null;
  let melodyStep = 0;
  const foundSigils = new Set();
  const discoveredFlowers = new Set();

  const collected = new Set();
  const completedClues = new Set();

  const starMessages = [
    { title: 'The little things', copy: 'Your creativity, your humor, and the way your mind finds interesting corners of the world — those little things make you unmistakably you.' },
    { title: 'Your own little world', copy: 'I hope you always have space for the music you love, the ideas that surprise you, and every tiny thing that makes your world feel like yours.' },
    { title: 'A wish for you', copy: 'May your days hold more soft moments, more reasons to laugh, and people who make it easy to be yourself.' },
    { title: 'A gentle reminder', copy: 'You do not have to be cheerful every second to be loved, and you do not have to earn rest. You can just be Yomna.' },
    { title: 'Tiny magic', copy: 'Sometimes the loveliest things begin in the most unexpected ways — one question, one laugh, one little hello at a time.' },
    { title: 'A path through the stars', copy: 'Every little light you found is part of this universe. Keep the ones that make you smile, and take the journey at your own pace.' }
  ];

  const wonderMessages = {
    bunny: { title: 'Your tiny guide 🐇', copy: 'This little bunny was appointed guardian of the clouds, keeper of tiny wishes, and official inspector of ribbon quality. A very serious job.' },
    orange: { title: 'The orange cat 🍊', copy: 'A tiny orange cat has one important mission: remind everyone that snacks, naps, and being a little silly are essential parts of a good universe.' },
    black: { title: 'The black cat 🐈‍⬛', copy: 'The black cat is in charge of the stars. It insists it is mysterious. It also walked into a cloud five minutes ago.' },
    lasagna: { title: 'A very layered mystery 🍝', copy: '“Did lasagna need layers?” A question for the ages. One tiny message, an unexpectedly wonderful beginning, and a whole universe of inside jokes waiting to happen.' },
    flower: { title: 'The moonflower garden 🌸', copy: 'A little flower for Roo: may you always find small beautiful things that make you pause, breathe, and remember how much wonder still fits inside an ordinary day.' }
  };

  const sigilMessages = {
    flower: { title: 'The Flower Sigil 🌸', copy: 'A tiny flower for all the gentle, lovely things that deserve to bloom in their own time.' },
    melody: { title: 'The Melody Sigil 🎶', copy: 'A little melody for the feelings that words cannot always carry. You can pause the music whenever you like, and the magic will wait.' },
    meteor: { title: 'The Meteor Sigil ☄️', copy: 'A little piece of starlight for every wish you have not said out loud yet. You do not have to tell the universe what it is.' }
  };

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function sparkleAt(x, y, count = 12) {
    if (document.body.classList.contains('reduce-motion')) return;
    const layer = $('#sparkle-layer');
    const glyphs = ['✦','✧','♡','💖','🍓','🎀','✨','🌸'];
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.className = 'sparkle';
      particle.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.fontSize = `${8 + Math.random() * 12}px`;
      particle.style.setProperty('--dx', `${(Math.random() - .5) * 115}px`);
      particle.style.setProperty('--dy', `${(Math.random() - .5) * 100}px`);
      layer.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
  }

  function makeStarfield() {
    const field = $('#starfield');
    for (let i = 0; i < 46; i++) {
      const star = document.createElement('span');
      star.className = 'background-star';
      star.textContent = Math.random() > .55 ? '✦' : '·';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.fontSize = `${5 + Math.random() * 11}px`;
      star.style.setProperty('--duration', `${2 + Math.random() * 4}s`);
      star.style.animationDelay = `${Math.random() * 4}s`;
      field.appendChild(star);
    }
  }

  function updateCount() {
    starCount.textContent = String(collected.size);
    starTotal.textContent = String(starMessages.length);
    journalText.textContent = collected.size === 0
      ? 'Your little star journal is waiting.'
      : `${collected.size} little ${collected.size === 1 ? 'star' : 'stars'} tucked safely into your journal.`;
  }

  function collectStar(index) {
    if (collected.has(index)) {
      showToast('This little star is already in your journal ♡');
      openModal(starMessages[index].title, starMessages[index].copy, false);
      return;
    }
    collected.add(index);
    const button = $(`[data-star="${index}"]`);
    if (button) button.classList.add('collected');
    updateCount();
    const rect = button?.getBoundingClientRect();
    if (rect) sparkleAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 15);
    openModal(starMessages[index].title, starMessages[index].copy, false);
    showToast('A little star has found its place ✧');
  }

  function openModal(title, copy, awardStar = false) {
    modalTitle.textContent = title;
    modalCopy.textContent = copy;
    pendingWonderStar = awardStar;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    $('#modal-done').textContent = awardStar ? 'Keep this little star ♡' : 'Back to the sky ♡';
  }

  function closeModal() {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    if (pendingWonderStar) {
      const bonusIndex = 5;
      if (!collected.has(bonusIndex)) {
        collected.add(bonusIndex);
        const star = $(`[data-star="${bonusIndex}"]`);
        if (star) star.classList.add('collected');
        updateCount();
      }
      pendingWonderStar = false;
    }
  }

  function goToScene(index) {
    const safeIndex = Math.max(0, Math.min(scenes.length - 1, index));
    scenes.forEach((scene, i) => {
      const active = i === safeIndex;
      scene.classList.toggle('active', active);
      scene.setAttribute('aria-hidden', String(!active));
    });
    currentScene = safeIndex;
    window.scrollTo({ top: 0, behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
    if (safeIndex === 7) {
      $('#meteor').classList.remove('fly');
      void $('#meteor').offsetWidth;
      $('#meteor').classList.add('fly');
    }
  }

  function getAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = audioContext || new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  }

  function playTone(frequency, duration = .32, volume = .025, wave = 'sine') {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + .04);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration + .02);
    } catch (_) { /* Audio is optional; the site remains usable without it. */ }
  }

  function softChime() {
    if (soundEnabled) playTone(660, .22, .012);
  }

  function playMelodyStep() {
    if (!soundEnabled) return;
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5];
    playTone(notes[melodyStep % notes.length], .9, .02, 'triangle');
    if (melodyStep % 4 === 0) playTone(notes[(melodyStep + 4) % notes.length] / 2, .85, .008);
    melodyStep++;
  }

  function toggleMelody() {
    soundEnabled = !soundEnabled;
    const button = $('#sound-toggle');
    button.setAttribute('aria-pressed', String(soundEnabled));
    button.textContent = soundEnabled ? '♫' : '♪';
    const sceneButton = $('#melody-scene-button');
    if (sceneButton) sceneButton.innerHTML = soundEnabled ? 'Pause the tiny melody <span>Ⅱ</span>' : 'Play the tiny melody <span>♫</span>'; 
    if (soundEnabled) {
      playMelodyStep();
      melodyTimer = window.setInterval(playMelodyStep, 720);
      showToast('A tiny melody is floating through the clouds ♫');
    } else {
      window.clearInterval(melodyTimer);
      melodyTimer = null;
      showToast('The melody is resting for now ♡');
    }
  }

  function collectSigil(name, button) {
    if (foundSigils.has(name)) {
      openModal(sigilMessages[name].title, 'This little keepsake is already safe with you. The secret door is waiting whenever you are ready. ♡');
      return;
    }
    foundSigils.add(name);
    button.classList.add('found');
    button.setAttribute('aria-pressed', 'true');
    $('#sigil-progress').textContent = `${foundSigils.size} of 3 keepsakes found ${foundSigils.size === 3 ? '— the secret door is awake ✨' : '✧'}`;
    const rect = button.getBoundingClientRect();
    sparkleAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 24);
    openModal(sigilMessages[name].title, sigilMessages[name].copy, false);
    if (foundSigils.size === 3) {
      $('#secret-door-button').hidden = false;
      $('#secret-door-button').classList.add('door-awake');
      showToast('All three keepsakes found. A little door has appeared ✨');
    }
  }

  const flowerMessages = {
    lily: { title: 'The moon lily 🌙', copy: 'A moon lily for Roo: a reminder that you do not have to bloom loudly to be beautiful. Some lovely things grow quietly, in their own time.' },
    rose: { title: 'The pink rose 🌸', copy: 'A little pink rose for the small things that make a day softer — a song you love, a silly thought, a kind word, or a moment that feels like yours.' },
    bloom: { title: 'The little bloom ✿', copy: 'This flower has one tiny job: to remind you that growing is not a race, and every version of you deserves a little tenderness.' },
    wish: { title: 'The wish flower ✨', copy: 'Make a wish just for yourself, Roo. You do not have to tell anyone what it is. Let it be yours for a little while.' }
  };

  function discoverFlower(name, button) {
    if (!discoveredFlowers.has(name)) {
      discoveredFlowers.add(name);
      button.classList.add('discovered');
      button.setAttribute('aria-pressed', 'true');
      $('#garden-counter').textContent = `${discoveredFlowers.size} of 4 little flowers discovered ${discoveredFlowers.size === 4 ? '— the garden is glowing ✨' : '✿'}`;
      const rect = button.getBoundingClientRect();
      sparkleAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 18);
      if (discoveredFlowers.size === 4) showToast('Every moonflower has shared its little secret 🌸');
    }
    openModal(flowerMessages[name].title, flowerMessages[name].copy, false);
  }


  makeStarfield();
  updateCount();

  document.addEventListener('pointerdown', event => {
    if (event.target.closest('button, a')) {
      sparkleAt(event.clientX, event.clientY, 5);
      softChime();
    }
  });

  $('#enter-button').addEventListener('click', event => {
    const rect = event.currentTarget.getBoundingClientRect();
    sparkleAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 28);
    setTimeout(() => goToScene(1), 250);
  });

  $('#home-link').addEventListener('click', event => {
    event.preventDefault();
    goToScene(0);
  });

  $$('[data-next]').forEach(button => button.addEventListener('click', () => goToScene(Number(button.dataset.next))));

  $$('[data-wonder]').forEach(button => button.addEventListener('click', () => {
    const message = wonderMessages[button.dataset.wonder];
    openModal(message.title, message.copy, true);
  }));

  $$('[data-star]').forEach(button => button.addEventListener('click', () => collectStar(Number(button.dataset.star))));

  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-done').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

  $('#open-letter').addEventListener('click', () => {
    const envelope = $('#open-letter');
    envelope.classList.add('opened');
    setTimeout(() => {
      envelope.style.display = 'none';
      $('#letter-paper').classList.add('visible');
      $('#letter-paper').setAttribute('aria-hidden', 'false');
      sparkleAt(window.innerWidth / 2, window.innerHeight / 2, 22);
    }, 420);
  });

  $('#keep-letter').addEventListener('click', () => showToast('A little letter, kept with care ♡'));

  $('#close-letter').addEventListener('click', () => {
    $('#letter-paper').classList.remove('visible');
    $('#letter-paper').setAttribute('aria-hidden', 'true');
    const envelope = $('#open-letter');
    envelope.style.display = '';
    envelope.classList.remove('opened');
  });

  $$('.clue-card').forEach(button => button.addEventListener('click', () => {
    const clue = Number(button.dataset.clue);
    if (completedClues.has(clue)) return;
    completedClues.add(clue);
    button.classList.add('done');
    $('.clue-check', button).textContent = '✓';
    sparkleAt(button.getBoundingClientRect().left + 28, button.getBoundingClientRect().top + 25, 10);
    if (completedClues.size === 1) showToast('One little clue found ✧');
    if (completedClues.size === 2) showToast('The stars are beginning to connect ♡');
    if (completedClues.size === 3) {
      $('#secret-reveal').classList.add('visible');
      $('#secret-reveal').scrollIntoView({ behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth', block: 'nearest' });
      showToast('The hidden constellation is complete 🌠');
    }
  }));

  $('#wish-button').addEventListener('click', () => {
    $('#meteor').classList.remove('fly');
    void $('#meteor').offsetWidth;
    $('#meteor').classList.add('fly');
    sparkleAt(window.innerWidth * .72, window.innerHeight * .25, 26);
    $('#final-letter').classList.add('visible');
    $('#final-letter').setAttribute('aria-hidden', 'false');
    $('#wish-button').textContent = 'Your wish is among the stars ♡';
    $('#wish-button').disabled = true;
    $('#final-letter').scrollIntoView({ behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth', block: 'nearest' });
  });

  $('#replay-button').addEventListener('click', () => {
    collected.clear();
    completedClues.clear();
    foundSigils.clear();
    discoveredFlowers.clear();
    $$('[data-garden-flower]').forEach(button => { button.classList.remove('discovered'); button.setAttribute('aria-pressed', 'false'); });
    $('#garden-counter').textContent = '0 of 4 little flowers discovered ✿';
    $$('[data-sigil]').forEach(button => { button.classList.remove('found'); button.setAttribute('aria-pressed', 'false'); });
    $('#sigil-progress').textContent = '0 of 3 keepsakes found ✧';
    $('#secret-door-button').hidden = true;
    $('#secret-door-button').classList.remove('door-awake');
    $('#treasure-box').classList.remove('opened');
    $('#treasure-letter').classList.remove('visible');
    $('#treasure-letter').setAttribute('aria-hidden', 'true');
    $('#open-treasure').disabled = false;
    $('#open-treasure').innerHTML = 'Open your surprise <span>♡</span>'
    $$('[data-star]').forEach(button => button.classList.remove('collected'));
    $$('.clue-card').forEach(button => {
      button.classList.remove('done');
      $('.clue-check', button).textContent = '＋';
    });
    $('#secret-reveal').classList.remove('visible');
    $('#open-letter').style.display = '';
    $('#open-letter').classList.remove('opened');
    $('#letter-paper').classList.remove('visible');
    $('#letter-paper').setAttribute('aria-hidden', 'true');
    $('#final-letter').classList.remove('visible');
    $('#final-letter').setAttribute('aria-hidden', 'true');
    $('#wish-button').disabled = false;
    $('#wish-button').innerHTML = 'Make a little wish <span>🌠</span>';
    updateCount();
    goToScene(0);
  });

  $$('[data-garden-flower]').forEach(button => button.addEventListener('click', () => discoverFlower(button.dataset.gardenFlower, button)));
  $$('[data-sigil]').forEach(button => button.addEventListener('click', () => collectSigil(button.dataset.sigil, button)));
  $('#melody-scene-button').addEventListener('click', toggleMelody);

  $('#open-treasure').addEventListener('click', () => {
    $('#treasure-box').classList.add('opened');
    $('#treasure-letter').classList.add('visible');
    $('#treasure-letter').setAttribute('aria-hidden', 'false');
    $('#open-treasure').textContent = 'Surprise opened ♡';
    $('#open-treasure').disabled = true;
    sparkleAt(window.innerWidth / 2, window.innerHeight * .55, 34);
    showToast('A little surprise, made just for Roo ♡');
  });

  $('#back-to-stars').addEventListener('click', () => goToScene(7));
  $('#sound-toggle').addEventListener('click', toggleMelody);

  $('#motion-toggle').addEventListener('click', event => {
    const reduced = document.body.classList.toggle('reduce-motion');
    event.currentTarget.setAttribute('aria-pressed', String(reduced));
    showToast(reduced ? 'Gentle motion mode is on' : 'Full dreamy motion is on ✧');
  });

  // Make the first screen fit gracefully, even on small phones.
  window.addEventListener('resize', () => {
    if (currentScene === 0) document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
  });

  // ♡ pinky extras: floating cuties + glitter trail
  (function pinkExtras() {
    const field = $('#starfield');
    const cuties = ['🍓','🎀','💗','🌷','✨','🩷','🌸','⭐'];
    for (let i = 0; i < 16; i++) {
      const f = document.createElement('span');
      f.className = 'floaty';
      f.textContent = cuties[i % cuties.length];
      f.style.left = `${Math.random() * 96}%`;
      f.style.fontSize = `${16 + Math.random() * 18}px`;
      f.style.setProperty('--d', `${13 + Math.random() * 14}s`);
      f.style.setProperty('--dl', `${-Math.random() * 20}s`);
      field.appendChild(f);
    }
    let last = 0;
    document.addEventListener('pointermove', e => {
      const now = performance.now();
      if (now - last < 90) return;
      last = now;
      sparkleAt(e.clientX, e.clientY, 1);
    });
  })();
})();
