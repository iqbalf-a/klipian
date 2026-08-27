/* ===========================================================
   klipian — global transport controls
   ===========================================================
   Transport bar in topbar: always visible in work mode.
   Shares the same video element as the preview panel.
   =========================================================== */

/* ── global transport (topbar) ── */
.global-transport {
  display: none;            /* hidden in home mode */
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 6px 12px;
  background: var(--kaca);
  border: 1px solid var(--garis-kaca);
  border-radius: var(--r-pill);
  font-family: var(--font-data);
  font-size: 11px;
  color: var(--teks-samar);
}
.global-transport.visible { display: flex; }

/* transport-bawah style — time display */
.global-transport .gt-time {
  margin-left: 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 42px;
  text-align: center;
  color: var(--teks-lemah);
}

/* smaller buttons inside topbar transport */
.global-transport .langkah {
  width: 26px; height: 24px;
  border: 1px solid var(--garis-kaca);
  border-radius: var(--r-s);
  background: var(--kaca);
  color: var(--teks-lemah);
  cursor: pointer;
  font-family: var(--font-data);
  transition: background var(--cepat), color var(--cepat);
}
.global-transport .langkah:hover {
  color: var(--teks); border-color: var(--aksen);
  background: var(--kaca-kuat);
}
.global-transport .langkah:active { transform: translateY(1px); }

.global-transport .putar {
  width: 30px; height: 30px;
  margin: 0;
  font-size: 12px;
}

/* smaller mute button */
.global-transport .saklar {
  min-width: 26px; height: 24px;
  padding: 0 6px;
  font-size: 11px;
}
