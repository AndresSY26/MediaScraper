import { CDN_LIBRARIES } from '../config/constants.js';
import { AudioExtractorService } from '../services/audioExtractor.service.js';
import { escapeHtml, loadScriptOnce, sanitizeHref, unwrapProxyUrl } from '../utils/dom.util.js';

/**
 * Reproductor de Video HTML5 Multiplataforma con carga HLS diferida, Web Audio API y limpieza de recursos
 */
export class CustomVideoPlayer {
  constructor(videoSrc, options = {}) {
    this.videoSrc = videoSrc || '';
    this.options = options;
    this.container = null;
    this.video = null;
    this.hls = null;
    this.inactivityTimer = null;
    this.toastTimer = null;
    this.qualityTimer = null;
    this.boundOutsideClick = null;
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
    this.container.tabIndex = 0;

    const rawUnwrapped = unwrapProxyUrl(this.videoSrc);
    const isHls = /\.m3u8(\?|$)/i.test(rawUnwrapped) || this.videoSrc.includes('/hls/');
    const safeSrc = escapeHtml(sanitizeHref(this.videoSrc));
    const initialVideoSrcAttr = isHls ? '' : `src="${safeSrc}"`;

    this.container.innerHTML = `
      <video ${initialVideoSrcAttr} preload="metadata" playsinline crossorigin="anonymous"></video>

      <div class="pip-active-badge">
        <i class="ri-picture-in-picture-2-fill"></i> Reproduciendo en ventana flotante
      </div>

      <div class="player-loading-overlay">
        <div class="player-loading-spinner"></div>
        <span class="player-loading-text">Cargando video...</span>
      </div>

      <button type="button" class="big-play-btn" title="Reproducir" aria-label="Reproducir"><i class="ri-play-fill"></i></button>

      <div class="timeline-preview-tooltip">
        <canvas class="frame-canvas" width="120" height="68"></canvas>
        <span class="preview-time-text">0:00</span>
      </div>

      <div class="settings-modal">
        <div class="settings-view main-view">
          <div class="settings-item" data-target="quality">
            <span><i class="ri-hd-line"></i> Calidad</span>
            <span class="settings-item-val current-quality-val">Auto (1080p) <i class="ri-arrow-right-s-line"></i></span>
          </div>
          <div class="settings-item" data-target="speed">
            <span><i class="ri-speed-line"></i> Velocidad</span>
            <span class="settings-item-val current-speed-val">1.0x (Normal) <i class="ri-arrow-right-s-line"></i></span>
          </div>
          <div class="settings-item toggle-loop-btn">
            <span><i class="ri-repeat-line"></i> En Bucle</span>
            <span class="settings-item-val loop-val">No</span>
          </div>
        </div>

        <div class="settings-view quality-view" style="display: none;">
          <div class="settings-header" data-back="main">
            <i class="ri-arrow-left-s-line"></i> Calidad de Video
          </div>
          <div class="quality-options-list"></div>
        </div>

        <div class="settings-view speed-view" style="display: none;">
          <div class="settings-header" data-back="main">
            <i class="ri-arrow-left-s-line"></i> Velocidad de Reproducción
          </div>
          <button type="button" class="settings-option-btn" data-speed="0.5">0.5x</button>
          <button type="button" class="settings-option-btn" data-speed="0.75">0.75x</button>
          <button type="button" class="settings-option-btn active" data-speed="1.0">1.0x (Normal)</button>
          <button type="button" class="settings-option-btn" data-speed="1.25">1.25x</button>
          <button type="button" class="settings-option-btn" data-speed="1.5">1.5x</button>
          <button type="button" class="settings-option-btn" data-speed="2.0">2.0x</button>
        </div>
      </div>

      <div class="player-controls">
        <div class="progress-bar-container">
          <div class="progress-bar-buffered"></div>
          <div class="progress-bar-filled"></div>
          <input type="range" class="progress-slider" min="0" max="100" value="0" step="0.1" aria-label="Progreso del video" />
        </div>

        <div class="controls-bottom">
          <div class="controls-left">
            <button type="button" class="player-btn play-pause-btn" title="Reproducir (Espacio)" aria-label="Reproducir o Pausar"><i class="ri-play-fill"></i></button>

            <div class="volume-container">
              <button type="button" class="player-btn volume-btn" title="Silenciar (M)" aria-label="Silenciar"><i class="ri-volume-up-fill"></i></button>
              <div class="volume-slider-wrapper">
                <input type="range" class="volume-slider" min="0" max="1" step="0.05" value="1" aria-label="Volumen" />
              </div>
            </div>

            <div class="time-display">
              <span class="current-time">0:00</span> / <span class="total-time">0:00</span>
            </div>
          </div>

          <div class="controls-right">
            <button type="button" class="player-btn extract-audio-btn" title="Extraer Pista de Audio" aria-label="Extraer Audio"><i class="ri-music-2-line"></i></button>
            <button type="button" class="player-btn settings-gear-btn" title="Ajustes de Video" aria-label="Ajustes"><i class="ri-settings-3-fill"></i></button>
            <button type="button" class="player-btn pip-btn" title="Ventana Flotante (P)" aria-label="Picture in Picture"><i class="ri-picture-in-picture-2-line"></i></button>
            <button type="button" class="player-btn fullscreen-btn" title="Pantalla Completa (F)" aria-label="Pantalla Completa"><i class="ri-fullscreen-fill"></i></button>
          </div>
        </div>
      </div>
    `;

    this.video = this.container.querySelector('video');

    if (isHls) {
      this.initHlsStream();
    }

    this.setupEvents();
  }

  async initHlsStream() {
    try {
      if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
        this.video.src = this.videoSrc;
        return;
      }

      if (!window.Hls) {
        await loadScriptOnce(CDN_LIBRARIES.HLS);
      }

      if (window.Hls && window.Hls.isSupported() && this.video) {
        this.hls = new window.Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          enableWorker: true
        });
        this.hls.loadSource(this.videoSrc);
        this.hls.attachMedia(this.video);
      } else if (this.video) {
        this.video.src = this.videoSrc;
      }
    } catch (err) {
      console.warn('Aviso inicializando HLS:', err);
      this.container.classList.remove('loading');
    }
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
    const currentQualityVal = settingsModal.querySelector('.current-quality-val');
    const currentSpeedVal = settingsModal.querySelector('.current-speed-val');
    const toggleLoopBtn = settingsModal.querySelector('.toggle-loop-btn');
    const loopVal = settingsModal.querySelector('.loop-val');

    const pipBtn = this.container.querySelector('.pip-btn');
    const fullscreenBtn = this.container.querySelector('.fullscreen-btn');

    const canvasCtx = frameCanvas.getContext('2d');
    let lastVolume = 1.0;

    const hideLoading = () => {
      this.container.classList.remove('loading');
    };

    this.video.addEventListener('loadstart', () => this.container.classList.add('loading'));
    this.video.addEventListener('waiting', () => this.container.classList.add('loading'));
    this.video.addEventListener('canplay', hideLoading);
    this.video.addEventListener('playing', hideLoading);
    this.video.addEventListener('seeked', hideLoading);
    this.video.addEventListener('error', () => {
      hideLoading();
      this.showQualityToast('No se pudo cargar este flujo de video');
    });

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
      const duration = this.video.duration || 0;
      const percentage = duration > 0 ? (this.video.currentTime / duration) * 100 : 0;
      progressFilled.style.width = `${percentage}%`;
      progressSlider.value = percentage || 0;
      currentTimeEl.textContent = this.formatTime(this.video.currentTime);

      if (this.video.buffered.length > 0 && duration > 0) {
        const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
        progressBuffered.style.width = `${Math.min(100, (bufferedEnd / duration) * 100)}%`;
      }
    });

    this.video.addEventListener('loadedmetadata', () => {
      hideLoading();
      this.nativeWidth = this.video.videoWidth || 1920;
      this.nativeHeight = this.video.videoHeight || 1080;
      totalTimeEl.textContent = this.formatTime(this.video.duration);
      this.populateQualityOptions(qualityOptionsList, currentQualityVal);
    });

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

    const toggleMute = () => {
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
    };

    const togglePiP = async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled && this.video.readyState >= 1) {
          await this.video.requestPictureInPicture();
        }
      } catch (pipErr) {
        console.warn('Picture-in-Picture aviso:', pipErr);
      }
    };

    const toggleFullscreen = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const elem = this.container;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (this.video && this.video.webkitEnterFullscreen) {
          this.video.webkitEnterFullscreen();
        }
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    };

    this.video.addEventListener('click', togglePlay);
    bigPlayBtn.addEventListener('click', togglePlay);
    playPauseBtn.addEventListener('click', togglePlay);

    // Atajos de teclado cuando el reproductor tiene foco
    this.container.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (key === 'p') {
        e.preventDefault();
        togglePiP();
      } else if (key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'ArrowRight' && this.video.duration) {
        e.preventDefault();
        this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 5);
      } else if (e.key === 'ArrowLeft' && this.video.duration) {
        e.preventDefault();
        this.video.currentTime = Math.max(0, this.video.currentTime - 5);
      }
    });

    if (extractAudioBtn) {
      extractAudioBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.extractAudioTrack(extractAudioBtn);
      });
    }

    progressSlider.addEventListener('input', () => {
      if (!this.video.duration) return;
      const seekTime = (progressSlider.value / 100) * this.video.duration;
      this.video.currentTime = seekTime;
      progressFilled.style.width = `${progressSlider.value}%`;
      if (this.container.classList.contains('ended')) {
        this.container.classList.remove('ended');
      }
    });

    progressBarContainer.addEventListener('mousemove', (e) => {
      const rect = progressBarContainer.getBoundingClientRect();
      if (!rect.width) return;
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const duration = this.video.duration || 0;
      const hoverTime = pos * duration;

      previewTimeText.textContent = this.formatTime(hoverTime);
      // Acotar horizontalmente para no desbordar bordes del reproductor
      const clampedPct = Math.max(12, Math.min(88, pos * 100));
      previewTooltip.style.left = `${clampedPct}%`;

      try {
        canvasCtx.drawImage(this.video, 0, 0, frameCanvas.width, frameCanvas.height);
      } catch (err) {}
    });

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

    volumeBtn.addEventListener('click', toggleMute);

    settingsGearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsModal.classList.toggle('active');
      mainView.style.display = 'flex';
      qualityView.style.display = 'none';
      speedView.style.display = 'none';
    });

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

    toggleLoopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isLooping = !this.isLooping;
      this.video.loop = this.isLooping;
      loopVal.textContent = this.isLooping ? 'Sí' : 'No';
    });

    this.boundOutsideClick = (e) => {
      if (this.container && !this.container.contains(e.target)) {
        settingsModal.classList.remove('active');
      }
    };
    document.addEventListener('click', this.boundOutsideClick);

    if (pipBtn) {
      pipBtn.addEventListener('click', togglePiP);
      this.video.addEventListener('enterpictureinpicture', () => {
        this.container.classList.add('pip-mode');
      });
      this.video.addEventListener('leavepictureinpicture', () => {
        this.container.classList.remove('pip-mode');
      });
    }

    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });

    this.container.addEventListener('mousemove', () => this.handleUserActivity());
    this.container.addEventListener('mouseenter', () => this.handleUserActivity());
    this.container.addEventListener('pointermove', () => this.handleUserActivity());
    this.container.addEventListener('touchstart', () => this.handleUserActivity(), { passive: true });
    this.container.addEventListener('mouseleave', () => this.handleUserActivity());
  }

  async extractAudioTrack(btnEl) {
    if (btnEl.disabled) return;
    const originalHTML = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="ri-loader-4-line spin"></i>';
    this.showQualityToast('Decodificando pista de audio...');

    try {
      const targetSource = this.options.originalUrl || this.videoSrc;
      const baseName = this.options.filename || 'video_audio';
      const res = await AudioExtractorService.extractAndDownload(targetSource, baseName);
      this.showQualityToast(res.mode === 'wav' ? '¡Audio WAV descargado!' : 'Iniciando descarga de flujo de audio...');
    } catch (err) {
      console.warn('Error extrayendo audio:', err);
      this.showQualityToast('Este video no contiene pista de audio extraíble');
    } finally {
      btnEl.disabled = false;
      btnEl.innerHTML = originalHTML;
    }
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
    autoBtn.type = 'button';
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
      btn.type = 'button';
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
    if (labelEl) labelEl.innerHTML = `${escapeHtml(labelText)} <i class="ri-arrow-right-s-line"></i>`;

    const wasPlaying = !this.video.paused;
    const currentTime = this.video.currentTime;

    if (wasPlaying) {
      this.video.pause();
    }

    const loadingOverlay = this.container.querySelector('.player-loading-overlay');
    const loadingText = this.container.querySelector('.player-loading-text');

    if (loadingOverlay && loadingText) {
      loadingText.textContent = `Optimizando flujo a ${labelText}...`;
      this.container.classList.add('loading', 'quality-switching');
    }

    this.video.classList.remove('q-1080', 'q-720', 'q-480', 'q-360', 'q-auto');
    this.video.classList.add(qualityVal === 'auto' ? 'q-auto' : `q-${qualityVal}`);

    this.showQualityToast(`Calidad: ${labelText}`);

    const settingsModal = this.container.querySelector('.settings-modal');
    if (settingsModal) settingsModal.classList.remove('active');

    clearTimeout(this.qualityTimer);
    this.qualityTimer = setTimeout(async () => {
      if (!this.video) return;
      try {
        this.video.currentTime = currentTime;
        if (wasPlaying) {
          await this.video.play();
        }
      } catch (e) {}
      if (this.container) this.container.classList.remove('loading', 'quality-switching');
    }, 450);
  }

  showQualityToast(messageText) {
    if (!this.container) return;
    let toast = this.container.querySelector('.quality-toast-badge');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'quality-toast-badge';
      this.container.appendChild(toast);
    }
    toast.innerHTML = `<i class="ri-information-fill"></i> ${escapeHtml(messageText)}`;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (toast) toast.classList.remove('show');
    }, 2400);
  }

  handleUserActivity() {
    if (!this.container || !this.video) return;
    this.container.classList.add('user-active');
    clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      if (this.container && this.video && !this.video.paused && !this.container.classList.contains('ended')) {
        this.container.classList.remove('user-active');
      }
    }, 6000);
  }

  updateVolumeIcon(iconEl, vol, isMuted) {
    if (isMuted || Number(vol) === 0) {
      iconEl.className = 'ri-volume-mute-fill';
    } else if (Number(vol) < 0.5) {
      iconEl.className = 'ri-volume-down-fill';
    } else {
      iconEl.className = 'ri-volume-up-fill';
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  getElement() {
    return this.container;
  }

  /**
   * Libera buffers HLS, timers, reproducción activa y event listeners globales
   */
  destroy() {
    clearTimeout(this.inactivityTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.qualityTimer);

    if (this.boundOutsideClick) {
      document.removeEventListener('click', this.boundOutsideClick);
      this.boundOutsideClick = null;
    }

    if (this.hls) {
      try {
        this.hls.destroy();
      } catch (e) {}
      this.hls = null;
    }

    if (this.video) {
      try {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      } catch (e) {}
      this.video = null;
    }
  }
}
