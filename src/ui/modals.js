/**
 * @file modals.js
 * @description Onboarding guide, credits disclaimer, tips, and modal state persistence.
 */

export function initModals() {
  const chkIntroDontShow = document.getElementById('chk-intro-dont-show');
  const btnCloseGuide = document.getElementById('btn-close-guide');
  const btnStartSimulator = document.getElementById('btn-start-simulator');

  if (btnCloseGuide) {
    btnCloseGuide.addEventListener('click', () => toggleGuideModal(false));
  }

  if (btnStartSimulator) {
    btnStartSimulator.addEventListener('click', () => {
      if (chkIntroDontShow && chkIntroDontShow.checked) {
        try { localStorage.setItem('garmin_sim_intro_seen', 'true'); } catch (e) {}
      }
      toggleGuideModal(false);
    });
  }

  // Setup sonar tips tabs
  ['live', 'side', 'clear', 'trad'].forEach(tab => {
    const btn = document.getElementById(`tab-btn-${tab}`);
    if (btn) {
      btn.addEventListener('click', () => setTipTab(tab));
    }
  });
}

export function checkFirstTimeUser() {
  let seen = false;
  try {
    seen = localStorage.getItem('garmin_sim_intro_seen') === 'true';
  } catch (e) {}
  if (!seen) {
    toggleGuideModal(true);
  }
}

export function toggleGuideModal(forceOpen) {
  const modal = document.getElementById('modal-intro');
  if (!modal) return;
  if (forceOpen === true) modal.classList.remove('hidden');
  else if (forceOpen === false) modal.classList.add('hidden');
  else modal.classList.toggle('hidden');
}

export function toggleCreditsModal() {
  const modal = document.getElementById('drawer-credits');
  if (modal) modal.classList.toggle('hidden');
}

export function toggleTipsModal() {
  const drawer = document.getElementById('drawer-tips');
  if (drawer) drawer.classList.toggle('hidden');
}

export function openSonarTipTab(tab) {
  const drawer = document.getElementById('drawer-tips');
  if (drawer && drawer.classList.contains('hidden')) {
    drawer.classList.remove('hidden');
  }
  setTipTab(tab);
}

export function setTipTab(tab) {
  ['live', 'side', 'clear', 'trad'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (!btn) return;
    if (t === tab) {
      btn.className = "px-2 py-0.5 rounded bg-sky-900 text-sky-300 font-bold text-[10px]";
    } else {
      btn.className = "px-2 py-0.5 rounded text-slate-400 hover:text-white text-[10px]";
    }
  });

  const box = document.getElementById('tip-content-box');
  if (!box) return;

  const tips = {
    live: `
      <p class="font-bold text-emerald-400 mb-1">Panoptix LiveScope™ Three Directional Modes & Rotation:</p>
      <p>• <strong>Forward Mode:</strong> Shows what is happening in front of and around your boat. Ideal for casting to structure and fish ahead.</p>
      <p>• <strong>Down Mode:</strong> Shows live views directly beneath your boat for vertical jigging and pinpointing depth.</p>
      <p>• <strong>Perspective Mode:</strong> Wide-angle top-down horizontal view (135° fan) ideal for shallow water, weedlines, and shorelines.</p>
      <p>• <strong>Beam Rotation:</strong> Rotate the transducer heading (-180° to +180°) relative to boat travel to "look around" for schooling fish without turning the boat.</p>
      <p>• <strong>Zero Scroll Delay:</strong> Real-time 20 FPS video representation. Live fish appear as swimming blips with glowing acoustic halos.</p>
    `,
    side: `
      <p class="font-bold text-purple-400 mb-1">SideVü™ UHD:</p>
      <p>• Center line is your boat keel. The dark gap is water depth beneath the hull.</p>
      <p>• <strong>Keel Boulders:</strong> Pinch the dark water column narrower on Port & Starboard simultaneously (no lateral shadow).</p>
      <p>• <strong>Keel Timber:</strong> Branches and trunk branch directly inside the dark water column band.</p>
      <p>• <strong>Offshore Structure:</strong> Bright reflection followed by a crisp black acoustic shadow cast outward along the bottom.</p>
    `,
    clear: `
      <p class="font-bold text-amber-400 mb-1">ClearVü™ DownScan:</p>
      <p>• Thin razor-slice beam eliminates wide-cone arch distortion.</p>
      <p>• Submerged trees display actual trunks, limbs, and branch forks.</p>
      <p>• Fish appear as sharp rice grains directly in cover.</p>
    `,
    trad: `
      <p class="font-bold text-sky-400 mb-1">Traditional 2D CHIRP:</p>
      <p>• Conical beam paints hyperbolic fish arches as targets swim through.</p>
      <p>• Peak of the arch represents the target's closest point of approach.</p>
      <p>• Dense bottom band indicates hard rock or gravel substrate.</p>
    `
  };

  box.innerHTML = tips[tab] || tips.live;
}
