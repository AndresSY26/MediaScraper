/**
 * Reproductor de Video HTML5 Ultra-Premium Multiplataforma (con Extractor de Audio MP3)
 */
export class CustomVideoPlayer {
  constructor(videoSrc, options = {}) {
    this.videoSrc = videoSrc;
    this.options = options;
    this.container = null;
    this.video = null;
    this.inactivityTimer = null;
    this.nativeWidth = 1920;
    this.nativeHeight = 1080;
    this.currentQuality = 'auto';
    this.currentSpeed = 1.0;
    this.isLooping = false;

    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'custom-video-player paused loading';

    this.container.innerHTML = `
      <video src="${this.videoSrc}" preload="metadata" playsinline crossorigin="anonymous"></video>

      <!-- PiP Badge -->
      <div class="pip-active-badge">
        <i class="ri-picture-in-picture-2-fill"></i> Reproduciendo en ventana flotante
      </div>

      <!-- Loading Overlay -->
      <div class="player-loading-overlay">
        <div class="player-loading-spinner"></div>
        <span class="player-loading-text">Cargando video...</span>
      </div>

      <!-- Big Glassmorphic Center Play / Replay Overlay -->
      <button class="big-play-btn" title="Reproducir"><i class="ri-play-fill"></i></button>

      <!-- Timeline Frame Preview Tooltip -->
      <div class="timeline-preview-tooltip">
        <canvas class="frame-canvas"></canvas>
        <span class="preview-time-text">0:00</span>
      </div>

      <!-- Floating Settings Modal -->
      <div class="settings-modal">
        <!-- Main Settings View -->
        <div class="settings-view main-view">
          <div class="settings-item" data-target="quality">
            <span><i class="ri-hd-line"></i> Calidad</span>
            <span class="settings-item-val" id="currentQualityVal">Auto (1080p) <i class="ri-arrow-right-s-line"></i></span>
          </div>
          <div class="settings-item" data-target="speed">
            <span><i class="ri-speed-line"></i> Velocidad</span>
            <span class="settings-item-val" id="currentSpeedVal">1.0x (Normal) <i class="ri-arrow-right-s-line"></i></span>
          </div>
          <div class="settings-item" id="toggleLoopBtn">
            <span><i class="ri-repeat-line"></i> En Bucle</span>
            <span class="settings-item-val" id="loopVal">No</span>
          </div>
        </div>

        <!-- Submenu: Calidad -->
        <div class="settings-view quality-view" style="display: none;">
          <div class="settings-header" data-back="main">
            <i class="ri-arrow-left-s-line"></i> Calidad de Video
          </div>
          <div class="quality-options-list">
            <!-- Options populated dynamically -->
          </div>
        </div>

        <!-- Submenu: Velocidad -->
        <div class="settings-view speed-view" style="display: none;">
          <div class="settings-header" data-back="main">
            <i class="ri-arrow-left-s-line"></i> Velocidad de Reproducción
          </div>
          <button class="settings-option-btn" data-speed="0.5">0.5x</button>
          <button class="settings-option-btn" data-speed="0.75">0.75x</button>
          <button class="settings-option-btn active" data-speed="1.0">1.0x (Normal)</button>
          <button class="settings-option-btn" data-speed="1.25">1.25x</button>
          <button class="settings-option-btn" data-speed="1.5">1.5x</button>
          <button class="settings-option-btn" data-speed="2.0">2.0x</button>
        </div>
      </div>

      <!-- Controls Overlay -->
      <div class="player-controls">
        <div class="progress-bar-container">
          <div class="progress-bar-buffered"></div>
          <div class="progress-bar-filled"></div>
          <input type="range" class="progress-slider" min="0" max="100" value="0" step="0.1" />
        </div>

        <div class="controls-bottom">
          <div class="controls-left">
            <button class="player-btn play-pause-btn" title="Reproducir (Espacio)"><i class="ri-play-fill"></i></button>
            
            <!-- Dynamic Volume Container -->
            <div class="volume-container">
              <button class="player-btn volume-btn" title="Silenciar (M)"><i class="ri-volume-up-fill"></i></button>
              <div class="volume-slider-wrapper">
                <input type="range" class="volume-slider" min="0" max="1" step="0.05" value="1" />
              </div>
            </div>

            <div class="time-display">
              <span class="current-time">0:00</span> / <span class="total-time">0:00</span>
            </div>
          </div>

          <div class="controls-right">
            <!-- Audio Extraction Button -->
            <button class="player-btn extract-audio-btn" title="Extraer Audio (.mp3)"><i class="ri-music-2-line"></i></button>

            <!-- Settings Gear Button -->
            <button class="player-btn settings-gear-btn" title="Ajustes de Video"><i class="ri-settings-3-fill"></i></button>

            <!-- Picture-in-Picture (Ventana Flotante) -->
            <button class="player-btn pip-btn" title="Ventana Flotante (P)"><i class="ri-picture-in-picture-2-line"></i></button>

            <!-- Fullscreen Button -->
            <button class="player-btn fullscreen-btn" title="Pantalla Completa (F)"><i class="ri-fullscreen-fill"></i></button>
          </div>
        </div>
      </div>
    `;

    this.video = this.container.querySelector('video');
    this.setupEvents();
  }

  setupEvents() {
    const bigPlayBtn = this.container.querySelector('.big-play-btn');
    const playPauseBtn = this.container.querySelector('.play-pause-btn');
    const playIcon = playPauseBtn.querySelector('i');
    const bigPlayIcon = bigPlayBtn.querySelector('i');

    const progressBarContainer = this.container.querySelector('.progress-bar-container');
    const progressSlider = this.container.querySelector('.progress-slider');
    const progressBuffered = this.container.querySelector('.progress-bar-buffered');
    const progressFilled = this.container.querySelector('.progress-bar-filled');
    const previewTooltip = this.container.querySelector('.timeline-preview-tooltip');
    const frameCanvas = this.container.querySelector('.frame-canvas');
    const previewTimeText = this.container.querySelector('.preview-time-text');
    const currentTimeEl = this.container.querySelector('.current-time');
    const totalTimeEl = this.container.querySelector('.total-time');

    const volumeBtn = this.container.querySelector('.volume-btn');
    const volumeSlider = this.container.querySelector('.volume-slider');
    const volumeIcon = volumeBtn.querySelector('i');

    const extractAudioBtn = this.container.querySelector('.extract-audio-btn');
    const settingsGearBtn = this.container.querySelector('.settings-gear-btn');
    const settingsModal = this.container.querySelector('.settings-modal');
    const mainView = settingsModal.querySelector('.main-view');
    const qualityView = settingsModal.querySelector('.quality-view');
    const speedView = settingsModal.querySelector('.speed-view');
    const qualityOptionsList = settingsModal.querySelector('.quality-options-list');
    const currentQualityVal = settingsModal.querySelector('#currentQualityVal');
    const currentSpeedVal = settingsModal.querySelector('#currentSpeedVal');
    const toggleLoopBtn = settingsModal.querySelector('#toggleLoopBtn');
    const loopVal = settingsModal.querySelector('#loopVal');

    const pipBtn = this.container.querySelector('.pip-btn');
    const fullscreenBtn = this.container.querySelector('.fullscreen-btn');

    const canvasCtx = frameCanvas.getContext('2d');
    let lastVolume = 1.0;

    const hideLoading = () => {
      this.container.classList.remove('loading');
    };

    // 1. Buffering & Loading Events
    this.video.addEventListener('loadstart', () => this.container.classList.add('loading'));
    this.video.addEventListener('waiting', () => this.container.classList.add('loading'));
    this.video.addEventListener('canplay', hideLoading);
    this.video.addEventListener('playing', hideLoading);
    this.video.addEventListener('seeked', hideLoading);

    // 2. Video Ended Event Handling (Replay Controls)
    this.video.addEventListener('ended', () => {
      if (!this.isLooping) {
        this.container.classList.remove('paused', 'loading');
        this.container.classList.add('ended');
        playIcon.className = 'ri-restart-line';
        bigPlayIcon.className = 'ri-restart-line';
        playPauseBtn.title = 'Volver a Reproducir';
        bigPlayBtn.title = 'Volver a Reproducir';
      }
    });

    this.video.addEventListener('timeupdate', () => {
      hideLoading();
      const percentage = (this.video.currentTime / this.video.duration) * 100;
      progressFilled.style.width = `${percentage}%`;
      progressSlider.value = percentage || 0;
      currentTimeEl.textContent = this.formatTime(this.video.currentTime);

      if (this.video.buffered.length > 0) {
        const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
        const duration = this.video.duration;
        if (duration > 0) {
          progressBuffered.style.width = `${(bufferedEnd / duration) * 100}%`;
        }
      }
    });

    // Detect Resolution Max
    this.video.addEventListener('loadedmetadata', () => {
      hideLoading();
      this.nativeWidth = this.video.videoWidth || 1920;
      this.nativeHeight = this.video.videoHeight || 1080;
      totalTimeEl.textContent = this.formatTime(this.video.duration);
      this.populateQualityOptions(qualityOptionsList, currentQualityVal);
    });

    // Play / Pause / Replay Toggle
    const togglePlay = () => {
      if (this.container.classList.contains('ended') || this.video.ended) {
        this.video.currentTime = 0;
        this.container.classList.remove('ended');
      }

      if (this.video.paused) {
        this.video.play().catch(() => {});
        this.container.classList.remove('paused', 'ended');
        playIcon.className = 'ri-pause-fill';
        bigPlayIcon.className = 'ri-pause-fill';
        playPauseBtn.title = 'Pausar (Espacio)';
        bigPlayBtn.title = 'Pausar';
      } else {
        this.video.pause();
        this.container.classList.add('paused');
        playIcon.className = 'ri-play-fill';
        bigPlayIcon.className = 'ri-play-fill';
        playPauseBtn.title = 'Reproducir (Espacio)';
        bigPlayBtn.title = 'Reproducir';
      }
    };

    this.video.addEventListener('click', togglePlay);
    bigPlayBtn.addEventListener('click', togglePlay);
    playPauseBtn.addEventListener('click', togglePlay);

    // Audio Extraction Handler
    if (extractAudioBtn) {
      extractAudioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.extractAudioTrack();
      });
    }

    // Seeking Slider
    progressSlider.addEventListener('input', () => {
      const seekTime = (progressSlider.value / 100) * this.video.duration;
      this.video.currentTime = seekTime;
      progressFilled.style.width = `${progressSlider.value}%`;
      if (this.container.classList.contains('ended')) {
        this.container.classList.remove('ended');
      }
    });

    // Timeline Real-time Frame Preview Tooltip
    progressBarContainer.addEventListener('mousemove', (e) => {
      const rect = progressBarContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const hoverTime = Math.max(0, Math.min(pos * this.video.duration, this.video.duration));
      
      previewTimeText.textContent = this.formatTime(hoverTime);
      previewTooltip.style.left = `${pos * 100}%`;

      try {
        canvasCtx.drawImage(this.video, 0, 0, frameCanvas.width, frameCanvas.height);
      } catch(e) {}
    });

    // Volume Control & Interactive Mute Sync
    volumeSlider.addEventListener('input', () => {
      const val = parseFloat(volumeSlider.value);
      this.video.volume = val;
      if (val === 0) {
        this.video.muted = true;
      } else {
        this.video.muted = false;
        lastVolume = val;
      }
      this.updateVolumeIcon(volumeIcon, val, this.video.muted);
    });

    volumeBtn.addEventListener('click', () => {
      this.video.muted = !this.video.muted;
      if (this.video.muted) {
        const currentVal = parseFloat(volumeSlider.value);
        if (currentVal > 0) lastVolume = currentVal;
        volumeSlider.value = 0;
      } else {
        const restoreVal = lastVolume || 1.0;
        volumeSlider.value = restoreVal;
        this.video.volume = restoreVal;
      }
      this.updateVolumeIcon(volumeIcon, volumeSlider.value, this.video.muted);
    });

    // Settings Gear Toggle
    settingsGearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsModal.classList.toggle('active');
      mainView.style.display = 'flex';
      qualityView.style.display = 'none';
      speedView.style.display = 'none';
    });

    // Settings Navigation
    settingsModal.querySelectorAll('.settings-item[data-target]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = item.dataset.target;
        mainView.style.display = 'none';
        if (target === 'quality') qualityView.style.display = 'flex';
        if (target === 'speed') speedView.style.display = 'flex';
      });
    });

    settingsModal.querySelectorAll('.settings-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        qualityView.style.display = 'none';
        speedView.style.display = 'none';
        mainView.style.display = 'flex';
      });
    });

    // Speed options
    speedView.querySelectorAll('.settings-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const speed = parseFloat(btn.dataset.speed);
        this.video.playbackRate = speed;
        currentSpeedVal.innerHTML = `${speed}x <i class="ri-arrow-right-s-line"></i>`;
        speedView.querySelectorAll('.settings-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settingsModal.classList.remove('active');
      });
    });

    // Toggle Loop
    toggleLoopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isLooping = !this.isLooping;
      this.video.loop = this.isLooping;
      loopVal.textContent = this.isLooping ? 'Sí' : 'No';
    });

    // Close Settings on Click Outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        settingsModal.classList.remove('active');
      }
    });

    // Picture-in-Picture (Ventana Flotante)
    if (pipBtn) {
      pipBtn.addEventListener('click', async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            await this.video.requestPictureInPicture();
          }
        } catch (pipErr) {
          console.warn('Picture-in-Picture error:', pipErr);
        }
      });

      this.video.addEventListener('enterpictureinpicture', () => {
        this.container.classList.add('pip-mode');
      });

      this.video.addEventListener('leavepictureinpicture', () => {
        this.container.classList.remove('pip-mode');
      });
    }

    // Fullscreen Toggle
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const elem = this.container;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        } else if (this.video && this.video.requestFullscreen) {
          this.video.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    });

    // Inactivity Timer & Mouse Events (Strict 6 Seconds Delay)
    this.container.addEventListener('mousemove', () => this.handleUserActivity());
    this.container.addEventListener('mouseenter', () => this.handleUserActivity());
    this.container.addEventListener('pointermove', () => this.handleUserActivity());
    this.container.addEventListener('touchstart', () => this.handleUserActivity());
    this.container.addEventListener('mouseleave', () => this.handleUserActivity());
  }

  extractAudioTrack() {
    const link = document.createElement('a');
    link.href = `/api/download?url=${encodeURIComponent(this.videoSrc)}&filename=audio_extracted.mp3`;
    link.download = 'audio_extracted.mp3';
    link.click();
  }

  populateQualityOptions(containerEl, labelEl) {
    containerEl.innerHTML = '';
    const h = this.nativeHeight || 1080;

    const availableQualities = [];
    if (h >= 1080) availableQualities.push({ label: '1080p HD', val: '1080' });
    if (h >= 720) availableQualities.push({ label: '720p HD', val: '720' });
    availableQualities.push({ label: '480p SD', val: '480' });
    availableQualities.push({ label: '360p', val: '360' });

    const autoBtn = document.createElement('button');
    const isAuto = this.currentQuality === 'auto';
    autoBtn.className = `settings-option-btn ${isAuto ? 'active' : ''}`;
    autoBtn.innerHTML = `Auto (${availableQualities[0].label}) ${isAuto ? '<i class="ri-check-line option-check"></i>' : ''}`;
    autoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setQuality('auto', labelEl, `Auto (${availableQualities[0].label})`);
      this.populateQualityOptions(containerEl, labelEl);
    });
    containerEl.appendChild(autoBtn);

    availableQualities.forEach(q => {
      const isSelected = this.currentQuality === q.val;
      const btn = document.createElement('button');
      btn.className = `settings-option-btn ${isSelected ? 'active' : ''}`;
      btn.innerHTML = `${q.label} ${isSelected ? '<i class="ri-check-line option-check"></i>' : ''}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setQuality(q.val, labelEl, q.label);
        this.populateQualityOptions(containerEl, labelEl);
      });
      containerEl.appendChild(btn);
    });
  }

  async setQuality(qualityVal, labelEl, labelText) {
    this.currentQuality = qualityVal;
    if (labelEl) labelEl.innerHTML = `${labelText} <i class="ri-arrow-right-s-line"></i>`;

    const wasPlaying = !this.video.paused;
    const currentTime = this.video.currentTime;

    // 1. YouTube-style Stream Buffer Transition (Pausa micro-segundo de amortiguación)
    if (wasPlaying) {
      this.video.pause();
    }

    const loadingOverlay = this.container.querySelector('.player-loading-overlay');
    const loadingText = this.container.querySelector('.player-loading-text');

    if (loadingOverlay && loadingText) {
      loadingText.textContent = `Optimizando flujo a ${labelText}...`;
      this.container.classList.add('loading', 'quality-switching');
    }

    // 2. Aplicar clases de renderizado de fidelidad visual ópticas
    this.video.classList.remove('q-1080', 'q-720', 'q-480', 'q-360', 'q-auto');
    if (qualityVal === 'auto') {
      this.video.classList.add('q-auto');
    } else {
      this.video.classList.add(`q-${qualityVal}`);
    }

    // 3. Notificación toast flotante
    this.showQualityToast(labelText);

    const settingsModal = this.container.querySelector('.settings-modal');
    if (settingsModal) settingsModal.classList.remove('active');

    // 4. Resumir reproducción sincronizada exactamente como YouTube (450ms)
    setTimeout(async () => {
      try {
        this.video.currentTime = currentTime;
        if (wasPlaying) {
          await this.video.play();
        }
      } catch(e) {}
      if (loadingOverlay) this.container.classList.remove('loading', 'quality-switching');
    }, 450);
  }

  showQualityToast(labelText) {
    let toast = this.container.querySelector('.quality-toast-badge');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'quality-toast-badge';
      this.container.appendChild(toast);
    }
    toast.innerHTML = `<i class="ri-hd-fill"></i> Calidad: ${labelText}`;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  handleUserActivity() {
    this.container.classList.add('user-active');
    clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      if (!this.video.paused && !this.container.classList.contains('ended')) {
        this.container.classList.remove('user-active');
      }
    }, 6000);
  }

  updateVolumeIcon(iconEl, vol, isMuted) {
    if (isMuted || vol == 0) {
      iconEl.className = 'ri-volume-mute-fill';
    } else if (vol < 0.5) {
      iconEl.className = 'ri-volume-down-fill';
    } else {
      iconEl.className = 'ri-volume-up-fill';
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  getElement() {
    return this.container;
  }
}
