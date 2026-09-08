"use client";

import { useEffect, useRef, useState } from "react";

const singingFrames = Array.from(
  { length: 16 },
  (_, index) =>
    `/images/singing/frame-${String(index + 1).padStart(2, "0")}.png`
);

// ms per frame — higher = slower / smoother mouth movement
const FRAME_INTERVAL = 180;

// Pull the 11-char video id out of the common YouTube URL shapes.
function extractYouTubeId(raw) {
  if (!raw) return null;

  const value = raw.trim();

  const patterns = [
    /(?:youtube\.com|music\.youtube\.com)\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }

  // Bare id pasted on its own.
  if (/^[\w-]{11}$/.test(value)) return value;

  return null;
}

// Load the YouTube IFrame Player API once, shared across calls.
let youTubeApiPromise = null;
function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);

  if (!youTubeApiPromise) {
    youTubeApiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }

  return youTubeApiPromise;
}

export default function Home() {
  const [appState, setAppState] = useState("idle");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileURL, setFileURL] = useState(null);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);

  // { type: "file" } | { type: "youtube", videoId: string }
  const [source, setSource] = useState(null);

  const mediaRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const ytPendingPlayRef = useRef(false);

  const youtubeId = extractYouTubeId(youtubeInput);
  const canSing = Boolean(uploadedFile) || Boolean(youtubeId);

  // Start the hidden YouTube player with sound. Must be reachable
  // synchronously from a tap so mobile browsers allow it.
  function playYouTube() {
    const player = ytPlayerRef.current;
    if (player && ytReadyRef.current) {
      player.unMute();
      player.setVolume(100);
      player.playVideo();
    } else {
      // Player not ready yet: let onReady kick it off instead.
      ytPendingPlayRef.current = true;
    }
  }

  // (Re)build the YouTube player into its host node. The IFrame API
  // swaps the mount element for an <iframe>, so we hand it a fresh
  // child each time and destroy() cleans that child up.
  function buildYouTubePlayer(videoId) {
    if (!ytHostRef.current || !videoId) return;

    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    }
    ytReadyRef.current = false;
    ytHostRef.current.innerHTML = "";

    const mount = document.createElement("div");
    ytHostRef.current.appendChild(mount);

    loadYouTubeApi().then((YT) => {
      // Bail if the link changed while the API was loading.
      if (!ytHostRef.current || !ytHostRef.current.contains(mount)) return;

      ytPlayerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          loop: 1,
          playlist: videoId, // required for loop to work
        },
        events: {
          onReady: (event) => {
            ytReadyRef.current = true;
            if (ytPendingPlayRef.current) {
              ytPendingPlayRef.current = false;
              event.target.unMute();
              event.target.setVolume(100);
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              event.target.seekTo(0);
              event.target.playVideo();
            }
          },
        },
      });
    });
  }

  function destroyYouTubePlayer() {
    ytReadyRef.current = false;
    ytPendingPlayRef.current = false;
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    }
    if (ytHostRef.current) ytHostRef.current.innerHTML = "";
  }

  // Preload animation frames
  useEffect(() => {
    singingFrames.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  // Animate singing frames (runs for every source type)
  useEffect(() => {
    if (appState !== "singing") return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        // Pick a random frame, but never the same one twice in a
        // row or the mouth looks like it stalled.
        let next = Math.floor(Math.random() * singingFrames.length);
        if (next === prev && singingFrames.length > 1) {
          next = (next + 1) % singingFrames.length;
        }
        return next;
      });
    }, FRAME_INTERVAL);

    return () => clearInterval(interval);
  }, [appState]);

  function handleTouchMe() {
    setAppState("mouthOpen");
  }

  function handleMouthTouch() {
    setAppState("upload");
  }

  function handleBack() {
    destroyYouTubePlayer();
    setUploadedFile(null);
    setFileURL(null);
    setYoutubeInput("");
    setSource(null);
    setAppState("mouthOpen");
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");

    if (!isAudio && !isVideo) {
      alert("Please upload an audio or video file.");
      return;
    }

    const url = URL.createObjectURL(file);

    setUploadedFile(file);
    setFileURL(url);
    setYoutubeInput("");
  }

  // Kicked off directly by the "make me sing" tap. Playback is
  // started synchronously here (not in an effect) because mobile
  // browsers only allow audio to start from inside a user gesture.
  function startSinging() {
    if (youtubeId) {
      setSource({ type: "youtube", videoId: youtubeId });
      setAppState("singing");
      playYouTube();
      return;
    }

    if (fileURL) {
      setSource({ type: "file" });
      setAppState("singing");

      const el = mediaRef.current;
      if (el) {
        el.loop = true;
        try {
          el.currentTime = 0;
        } catch {
          // Some browsers throw if metadata isn't loaded yet; harmless.
        }
        el.play().catch((error) => {
          console.error("Playback failed:", error);
        });
      }
      return;
    }

    alert("Paste a YouTube link or choose an audio/video file.");
  }

  // Prime the YouTube player as soon as there's a valid link, so it
  // is already "ready" when the user taps and playback can start
  // inside that gesture. Rebuilds when the link changes; tears down
  // when it clears or the component unmounts.
  useEffect(() => {
    if (!youtubeId) return;
    buildYouTubePlayer(youtubeId);

    return () => {
      destroyYouTubePlayer();
    };
  }, [youtubeId]);

  // Safety net for the local <audio>/<video> element: if we're in the
  // singing state and it isn't playing (e.g. the gesture call raced
  // the element mounting), try again.
  useEffect(() => {
    if (appState !== "singing" || source?.type !== "file") return;

    const el = mediaRef.current;
    if (!el) return;

    el.loop = true;
    if (el.paused) {
      el.play().catch((error) => {
        console.error("Playback failed:", error);
      });
    }
  }, [appState, source]);

  function stopSinging() {
    if (mediaRef.current) {
      mediaRef.current.pause();
      mediaRef.current.currentTime = 0;
    }
    if (ytPlayerRef.current) {
      ytPlayerRef.current.pauseVideo();
    }

    setAppState("stopped");
  }

  function exitExperience() {
    if (fileURL) {
      URL.revokeObjectURL(fileURL);
    }
    destroyYouTubePlayer();

    setUploadedFile(null);
    setFileURL(null);
    setYoutubeInput("");
    setSource(null);
    setCurrentFrame(0);
    setAppState("idle");
  }

  return (
    <main className="app">

      {/* IDLE */}
      {appState === "idle" && (
        <>
          <img
            src="/images/idle.png"
            alt="Background"
            className="background"
          />

          <button
            className="screen-button"
            onClick={handleTouchMe}
          >
            <span className="screen-button__label">touch me</span>
          </button>
        </>
      )}

      {/* MOUTH OPEN */}
      {appState === "mouthOpen" && (
        <>
          <img
            src="/images/mouth-open.png"
            alt="Mouth open"
            className="background"
          />

          <button
            className="mouth-button"
            onClick={handleMouthTouch}
            aria-label="Touch mouth"
          />

          <div className="instruction">
            touch my tongue
          </div>
        </>
      )}

      {/* UPLOAD */}
      {appState === "upload" && (
        <>
          <img
            src="/images/mouth-open.png"
            alt="Background"
            className="background"
          />

          <div className="modal-overlay">
            <div
              className="upload-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="feed-title"
            >

              <button
                type="button"
                className="modal-back"
                onClick={handleBack}
                aria-label="Go back"
              >
                ‹
              </button>

              <h1 id="feed-title">feed me</h1>
              <p className="modal-subtitle">
                give me a song and i&apos;ll sing it back
              </p>

              <div className="field">
                <label className="field-label" htmlFor="yt-url">
                  youtube link
                </label>
                <input
                  id="yt-url"
                  type="text"
                  autoComplete="off"
                  className={
                    "text-input" +
                    (youtubeId ? " is-ok" : "") +
                    (youtubeInput && !youtubeId ? " is-bad" : "")
                  }
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeInput}
                  onChange={(event) => {
                    setYoutubeInput(event.target.value);
                    setUploadedFile(null);
                    setFileURL(null);
                  }}
                />
                {youtubeInput && !youtubeId && (
                  <p className="field-error">
                    that&apos;s not a youtube link!
                  </p>
                )}
              </div>

              <div className="divider">or</div>

              <div className="field">
                <span className="field-label">audio or video file</span>
                <label
                  className={
                    "file-input" + (uploadedFile ? " has-file" : "")
                  }
                >
                  <span className="file-input-text">
                    {uploadedFile ? uploadedFile.name : "no file chosen"}
                  </span>
                  <span className="file-input-cta">browse</span>
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              <button
                className="play-button"
                onClick={startSinging}
                disabled={!canSing}
              >
                make me sing
              </button>

            </div>
          </div>
        </>
      )}

      {/* SINGING */}
      {appState === "singing" && (
        <>
          <img
            src={singingFrames[currentFrame]}
            alt="Singing"
            className="background"
          />

          <button
            className="screen-button"
            onClick={stopSinging}
          >
            <span className="screen-button__label">touch to stop</span>
          </button>
        </>
      )}

      {/* STOPPED */}
      {appState === "stopped" && (
        <>
          <img
            src="/images/stopped.png"
            alt="Stopped"
            className="background"
          />

          <button
            className="screen-button"
            onClick={exitExperience}
          >
            <span className="screen-button__label">touch to exit</span>
          </button>
        </>
      )}

      {/* LOCAL MEDIA (audio/video file) — mounted as soon as a file is
          picked so playback can be started from the "make me sing" tap.
          Kept on-screen but 1px/invisible: iOS Safari refuses to play
          media that is display:none. */}
      {fileURL && uploadedFile && (
        uploadedFile.type.startsWith("audio/") ? (
          <audio
            ref={mediaRef}
            src={fileURL}
            loop
            preload="auto"
          />
        ) : (
          <video
            ref={mediaRef}
            src={fileURL}
            loop
            preload="auto"
            playsInline
            className="hidden-media"
          />
        )
      )}

      {/* HIDDEN YOUTUBE PLAYER — present whenever there's a link so it
          can be primed before the tap. */}
      {(youtubeId || source?.type === "youtube") && (
        <div
          ref={ytHostRef}
          className="hidden-media"
          aria-hidden="true"
        />
      )}

    </main>
  );
}
