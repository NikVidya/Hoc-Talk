'use strict';
var muteIcons = {
    unmuted: '<i class="fas fa-microphone" style="color:white;"></i><div class="tooltip"><span>Mute Microphone</span></div>',
    muted: '<i class="fas fa-microphone-slash" style="color:red;"></i><div class="tooltip"><span>Unmute Microphone</span></div>'
}
var pauseIcons = {
    unpaused: '<i class="fas fa-video" style="color:white;"></i><div class="tooltip"><span>Pause Video Feed</span></div>',
    paused: '<i class="fas fa-video-slash" style="color:red;"></i><div class="tooltip"><span>Unpause Video Feed</span></div>'
}
var micMuteButton = document.getElementById("mic-mute-button");
var videoPauseButton = document.getElementById("video-pause-button");
var hangupButton = document.getElementById("hangup-button");
var chooseDeviceButton = document.getElementById("choose-device-button");

function activateClientControls() {
    if (localStream.getAudioTracks()[0] != null) {
        micMuteButton.innerHTML = muteIcons.unmuted;
        micMuteButton.addEventListener("click", () => {
            localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
            micMuteButton.innerHTML = (micMuteButton.innerHTML == muteIcons.unmuted ? muteIcons.muted : muteIcons.unmuted);
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