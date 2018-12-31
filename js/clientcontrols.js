'use strict';
var muteIcons = {
    unmuted: '<i class="fas fa-microphone" style="color:white;"></i><div class="tooltip"><span>Mute Microphone</span></div>',
    muted: '<i class="fas fa-microphone-slash" style="color:red;"></i><div class="tooltip"><span>Unmute Microphone</span></div>'
}
var pauseIcons = {
    unpaused: '<i class="fas fa-video" style="color:white;"></i><div class="tooltip"><span>Pause Video Feed</span></div>',
    paused: '<i class="fas fa-video-slash" style="color:red;"></i><div class="tooltip"><span>Unpause Video Feed</span></div>'
}
var pttIcons = {
    disabled: '<i class="fas fa-microphone-alt-slash" style="color:#888;"></i>',
    inactive: '<i class="fas fa-microphone-alt" style="color:#888"></i>',
    active: '<i class="fas fa-microphone-alt" style="color:#FF0"></i>'
}
var micMuteButton = document.getElementById("mic-mute-button");
var micMuted = true;
var videoPauseButton = document.getElementById("video-pause-button");
var pttButton = document.getElementById("ptt-button");
var pttCheck = document.getElementById("ptt-checkbox");
var pttEnabled = false;
var chooseDeviceButton = document.getElementById("choose-device-button");
var hangupButton = document.getElementById("hangup-button");

function activateClientControls() {
    if (localStream.getAudioTracks()[0] != null) {
        micMuteButton.innerHTML = muteIcons.unmuted;
        micMuted = false;
        micMuteButton.addEventListener("click", () => {
            if (!micMuted) { //mute mic, regardless of ptt enabled
                localStream.getAudioTracks()[0].enabled = false;
                micMuted = true;
                micMuteButton.innerHTML = muteIcons.muted;
            } else { //unmute mic, unless ptt is enabled in which case just let ptt handle muting
                if (!pttEnabled) {
                    localStream.getAudioTracks()[0].enabled = true;
                }
                micMuted = false;
                micMuteButton.innerHTML = muteIcons.unmuted;
            }
        });

        pttButton.addEventListener("mousedown", () => {
            if (pttEnabled && !micMuted) {
                localStream.getAudioTracks()[0].enabled = true;
                pttButton.innerHTML = pttIcons.active;
            }
        });
        pttButton.addEventListener("mouseup", () => {
            if (pttEnabled) {
                localStream.getAudioTracks()[0].enabled = false;
                pttButton.innerHTML = pttIcons.inactive;
            }
        });
    }

    if (localStream.getVideoTracks()[0] != null) {
        videoPauseButton.innerHTML = pauseIcons.unpaused;
        videoPauseButton.addEventListener("click", () => {
            localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
            videoPauseButton.innerHTML = (videoPauseButton.innerHTML == pauseIcons.unpaused ? pauseIcons.paused : pauseIcons.unpaused);
        });
    }

    chooseDeviceButton.style.color = "white";
    chooseDeviceButton.addEventListener("click", () => {
        getMedia(gotNewStream);
    });

    //hangup, go back to main page
    hangupButton.style.color = "white";
    hangupButton.addEventListener("click", () => {
        hangup();
        window.location = "index.html";
    });

    pttCheck.addEventListener("change", () => {
        if (pttCheck.checked) {
            pttButton.innerHTML = pttIcons.inactive;
            pttEnabled = true;
            localStream.getAudioTracks()[0].enabled = false;
        } else {
            pttButton.innerHTML = pttIcons.disabled;
            pttEnabled = false;
            if (!micMuted) {
                localStream.getAudioTracks()[0].enabled = true;
            }
        }
    });
}

function gotNewStream(stream) {
    localStream = stream;
    for (var index in peerConnections) {
        if (!peerConnections.hasOwnProperty(index)) {
            continue;
        }
        peerConnections[index].getSenders().forEach(sender => peerConnections[index].removeTrack(sender));
        localStream.getTracks().forEach(track => peerConnections[index].addTrack(track, localStream));
    }
    localVideo.srcObject = stream;
}