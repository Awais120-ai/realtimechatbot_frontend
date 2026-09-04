import { useEffect, useRef, useState, useMemo } from "react";
import { CaretRightOutlined, PauseOutlined, AudioOutlined } from "@ant-design/icons";
import styles from "./VoiceMessagePlayer.module.css";

/**
 * Deterministic waveform bar heights generator based on a string seed
 */
const generateWaveform = (seedStr, barCount = 28) => {
    let hash = 0;
    const str = String(seedStr || "voice");
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    const bars = [];
    for (let i = 0; i < barCount; i++) {
        // pseudo-random using linear congruential generator
        hash = (hash * 9301 + 49297) % 233280;
        const rnd = hash / 233280;
        // height between 20% and 100%
        const heightPct = Math.floor(20 + rnd * 80);
        bars.push(heightPct);
    }
    return bars;
};

const formatTime = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return "0:00";
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Custom WhatsApp-like Voice Message Player
 */
const VoiceMessagePlayer = ({
    audioUrl,
    isOwnMessage = false,
    darkMode = false,
    messageId = null,
}) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    const playerId = useMemo(() => {
        return messageId ? String(messageId) : audioUrl;
    }, [messageId, audioUrl]);

    // Consistent waveform bars for this audio
    const waveformBars = useMemo(() => {
        return generateWaveform(playerId, 28);
    }, [playerId]);

    // Handle pausing when another voice message starts playing
    useEffect(() => {
        const handlePauseOthers = (event) => {
            if (event.detail?.id !== playerId) {
                if (audioRef.current && !audioRef.current.paused) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                }
            }
        };

        window.addEventListener("app:pause-other-audios", handlePauseOthers);
        return () => {
            window.removeEventListener("app:pause-other-audios", handlePauseOthers);
        };
    }, [playerId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.removeAttribute("src");
                audioRef.current.load();
            }
        };
    }, []);

    const togglePlayPause = async (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            // Notify other audio players to pause
            window.dispatchEvent(
                new CustomEvent("app:pause-other-audios", {
                    detail: { id: playerId },
                })
            );

            try {
                await audio.play();
                setIsPlaying(true);
            } catch (err) {
                console.warn("Audio playback error:", err);
                setIsPlaying(false);
            }
        }
    };

    const handleLoadedMetadata = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
        } else if (audio.duration === Infinity) {
            // Chromium WebM recorded audio duration bug fix
            audio.currentTime = 1e101;
            audio.ontimeupdate = function () {
                this.ontimeupdate = null;
                this.currentTime = 0;
                if (Number.isFinite(this.duration) && this.duration > 0) {
                    setDuration(this.duration);
                }
            };
        }
        setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
        const audio = audioRef.current;
        if (!audio) return;
        setCurrentTime(audio.currentTime);

        // Fix for browsers where duration is not available until playing
        if (
            (!duration || !Number.isFinite(duration) || duration <= 0) &&
            Number.isFinite(audio.duration) &&
            audio.duration > 0
        ) {
            setDuration(audio.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    };

    // Scrub / Seek when clicking anywhere on the waveform
    const handleWaveformClick = (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || !duration || duration <= 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = ratio * duration;

        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const progress = duration > 0 ? currentTime / duration : 0;
    const currentBarIndex = Math.floor(progress * waveformBars.length);

    // Display current playback time and total duration
    const displayTime =
        isPlaying || currentTime > 0
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : formatTime(duration);

    return (
        <div
            className={`${styles.voicePlayer} ${
                isOwnMessage ? styles.sent : styles.received
            } ${darkMode ? styles.darkMode : ""}`}
            onClick={(e) => e.stopPropagation()}
        >
            <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
            />

            {/* Circular Play / Pause button */}
            <button
                type="button"
                className={styles.playBtn}
                onClick={togglePlayPause}
                aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
            >
                {isPlaying ? (
                    <PauseOutlined className={styles.pauseIcon} />
                ) : (
                    <CaretRightOutlined className={styles.playIcon} />
                )}
            </button>

            {/* Track area with waveform and meta */}
            <div className={styles.trackArea}>
                <div
                    className={styles.waveform}
                    onClick={handleWaveformClick}
                    title="Seek audio"
                >
                    {waveformBars.map((heightPct, idx) => {
                        const isPlayed = idx <= currentBarIndex && (isPlaying || currentTime > 0);
                        return (
                            <div
                                key={idx}
                                className={`${styles.bar} ${
                                    isPlayed ? styles.barPlayed : styles.barUnplayed
                                }`}
                                style={{ height: `${heightPct}%` }}
                            />
                        );
                    })}
                </div>

                <div className={styles.metaRow}>
                    <span className={styles.timeText}>{displayTime}</span>
                    <AudioOutlined className={styles.micIcon} />
                </div>
            </div>
        </div>
    );
};

export default VoiceMessagePlayer;
