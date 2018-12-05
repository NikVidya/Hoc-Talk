'use strict';
function activateClientControls() {
    var muteIcons = {
        unmuted: '<i class="fas fa-microphone" style="color:white;"></i>',
        muted: '<i class="fas fa-microphone-slash" style="color:red;"></i>'
    }
    var pauseIcons = {
        unpaused: '<i class="fas fa-video" style="color:white;"></i>',
        paused: '<i class="fas fa-video-slash" style="color:red;"></i>'
    }
    var micMuteButton = document.getElementById("mic-mute-button");
    micMuteButton.innerHTML = muteIcons.unmuted;
    var videoPauseButton = document.getElementById("video-pause-button");
    videoPauseButton.innerHTML = pauseIcons.unpaused;
    var hangupButton = document.getElementById("hangup-button");
    hangupButton.style.color = "white";

    //mute user mic
    micMuteButton.addEventListener("click", () => {
        localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
        micMuteButton.innerHTML = (micMuteButton.innerHTML == muteIcons.unmuted ? muteIcons.muted : muteIcons.unmuted);
    });

    //disable local video
    videoPauseButton.addEventListener("click", () => {
        localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
        videoPauseButton.innerHTML = (videoPauseButton.innerHTML == pauseIcons.unpaused ? pauseIcons.paused : pauseIcons.unpaused);
    });

    //hangup, go back to main page
    hangupButton.addEventListener("click", () => {
        hangup();
        window.location = "index.html";
    });

    //hotswap media devices WIP -- need update for getSenders()
    // var chooseCameraButton = document.getElementById("choose-camera-button");
    // chooseCameraButton.addEventListener("click", () => {
    //     navigator.mediaDevices.getUserMedia({
    //         video: true
    //     })
    //         .then(gotCameraDevice)
    //         .catch(e => { alert('getUserMedia() error: ' + e.name); console.log(e.message); });
    // });

    // function gotCameraDevice(stream) {
    //     for (var index in peerConnections) {
    //         var sender = peerConnections.getSenders()[0];
    //         peerConnections[index].removeTrack(sender); //not guaranteed to be the video sender
    //     }
    //     localStream = stream;
    //     for (var index in peerConnections) {
    //         peerConnections[index].addTrack(localStream.getVideoTracks()[0], localStream);
    //     }
    //     localVideo.srcObject = stream;
    // }

    // var chooseMicButton = document.getElementById("choose-camera-button");
    // chooseMicButton.addEventListener("click", () => {
    //     navigator.mediaDevices.getUserMedia({
    //         audio: true
    //     })
    //         .then(gotMicDevice)
    //         .catch(e => { alert('getUserMedia() error: ' + e.name); console.log(e.message); });
    // });
    // function gotMicDevice(stream) {
    //     for (var index in peerConnections) {
    //         var sender = peerConnections.getSenders()[1];
    //         peerConnections[index].removeTrack(sender); //not guaranteed to be the audio sender
    //     }
    //     localStream = stream;
    //     for (var index in peerConnections) {
    //         peerConnections[index].addTrack(localStream.getAudioTracks()[0], localStream);
    //     }
    //     localVideo.srcObject = stream;
    // }
}