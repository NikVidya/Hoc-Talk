//mute user mic
var muteIcons = {
    unmuted: '<i class="fas fa-microphone"></i>',
    muted: '<i class="fas fa-microphone-slash"></i>'
}
micMuteButton = document.getElementById("mic-mute-button");
micMuteButton.addEventListener("click", () => {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
    micMuteButton.innerHTML = (micMuteButton.innerHTML == muteIcons.unmuted ? muteIcons.muted : muteIcons.unmuted);
});

//disable local video
var pauseIcons = {
    unpaused: '<i class="fas fa-video-slash"></i>',
    paused: '<i class="fas fa-video"></i>'
}
videoPauseButton = document.getElementById("video-pause-button");
videoPauseButton.addEventListener("click", () => {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
    videoPauseButton.innerHTML = (videoPauseButton.innerHTML == pauseIcons.unpaused ? pauseIcons.paused : pauseIcons.unpaused);
});

//hangup, go back to main page
hangupButton = document.getElementById("hangup-button");
hangupButton.addEventListener("click", () => {
    hangup();
    window.location = "index.html";
});