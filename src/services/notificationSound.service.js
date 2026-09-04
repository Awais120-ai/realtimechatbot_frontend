import { notification } from "antd";

const STORAGE_KEY = "notification_sound";

const SOUND_OPTIONS = {
    notification: "/sound/faah-notification.mp3",
    message: "/sound/message-notification.mp3",
    whatsapp: "/sound/bell-notification.wav",
    cartoon: "/sound/cartoon-character-sneeze.wav",
    Crowd: "/sound/crowd-laugh.wav",
    paresh: "/sound/uthale-re-baba.mp3"
};

let messageAudio = null;
let callAudio = null;


/* =====================================================
   GET AVAILABLE SOUNDS
===================================================== */

export const getNotificationSounds = () => {
    return SOUND_OPTIONS;
};


/* =====================================================
   GET SELECTED SOUND
===================================================== */

export const getSelectedNotificationSound = () => {
    return (
        localStorage.getItem(STORAGE_KEY) ||
        "notification"
    );
};


/* =====================================================
   SAVE SELECTED SOUND
===================================================== */

export const setSelectedNotificationSound = (
    soundKey
) => {
    if (!SOUND_OPTIONS[soundKey]) {
        return;
    }

    localStorage.setItem(
        STORAGE_KEY,
        soundKey
    );
};


/* =====================================================
   GET SOUND URL
===================================================== */

const getSoundUrl = () => {
    const selectedSound =
        getSelectedNotificationSound();

    return (
        SOUND_OPTIONS[selectedSound] ||
        SOUND_OPTIONS.notification
    );
};


/* =====================================================
   MESSAGE NOTIFICATION SOUND
===================================================== */

export const playMessageNotificationSound = () => {
    try {
        if (!messageAudio) {
            messageAudio = new Audio();

            messageAudio.preload = "auto";

            messageAudio.volume = 0.7;
        }

        messageAudio.pause();

        messageAudio.currentTime = 0;

        messageAudio.src =
            getSoundUrl();

        const playPromise =
            messageAudio.play();

        if (playPromise) {
            playPromise.catch(
                (error) => {
                    console.debug(
                        "Message notification sound blocked:",
                        error
                    );
                }
            );
        }

    } catch (error) {

        console.error(
            "Message notification sound error:",
            error
        );
    }
};


/* =====================================================
   INCOMING CALL RINGTONE
===================================================== */

export const startCallNotificationSound = () => {
    try {

        if (!callAudio) {
            callAudio = new Audio();

            callAudio.preload = "auto";

            callAudio.loop = true;

            callAudio.volume = 0.8;
        }

        callAudio.pause();

        callAudio.currentTime = 0;

        callAudio.src =
            getSoundUrl();

        callAudio.loop = true;

        const playPromise =
            callAudio.play();

        if (playPromise) {
            playPromise.catch(
                (error) => {
                    console.debug(
                        "Call ringtone blocked:",
                        error
                    );
                }
            );
        }

    } catch (error) {

        console.error(
            "Call ringtone error:",
            error
        );
    }
};


/* =====================================================
   STOP CALL RINGTONE
===================================================== */

export const stopCallNotificationSound = () => {

    try {

        if (!callAudio) {
            return;
        }

        callAudio.pause();

        callAudio.currentTime = 0;

    } catch (error) {

        console.error(
            "Stop ringtone error:",
            error
        );
    }
};


/* =====================================================
   TEST SELECTED SOUND
===================================================== */

export const testNotificationSound = () => {

    playMessageNotificationSound();

};