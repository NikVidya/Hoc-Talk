function addControls(videoElement, videoContainer) {
    //full screen button
    var fullScreenButton = document.createElement('button');
    fullScreenButton.className = "btn fs-btn";
    fullScreenButton.innerHTML = '<i class="fas fa-arrows-alt"></i>';
    fullScreenButton.addEventListener("click", () => {
        if (videoElement.requestFullscreen) {
            videoElement.requestFullscreen();
        } else if (videoElement.mozRequestFullScreen) {
            videoElement.mozRequestFullScreen(); // Firefox
        } else if (videoElement.webkitRequestFullscreen) {
            videoElement.webkitRequestFullscreen(); // Chrome and Safari
        }
    });

    //volume slider
    var volumeSlider = document.createElement('input');
    volumeSlider.type = "range";
    volumeSlider.className = "volume-bar";
    volumeSlider.min = "0";
    volumeSlider.max = "1";
    volumeSlider.step = "0.1";
    volumeSlider.value = "1";
    volumeSlider.addEventListener("change", () => {
        videoElement.volume = volumeSlider.value;
    });

    //mute button
    var muteBtnIcons = {
        unmuted: '<i class="fas fa-volume-up" style="color:white;"></i>',
        muted: '<i class="fas fa-volume-off" style="color:red;"></i>'
    }
    var muteButton = document.createElement('button');
    muteButton.className = "btn mute-btn";
    muteButton.innerHTML = muteBtnIcons.unmuted;
    muteButton.addEventListener("click", () => {
        videoElement.muted = !videoElement.muted;
        muteButton.innerHTML = (muteButton.innerHTML == muteBtnIcons.unmuted ? muteBtnIcons.muted : muteBtnIcons.unmuted);
    })

    videoContainer.appendChild(fullScreenButton);
    videoContainer.appendChild(volumeSlider);
    videoContainer.appendChild(muteButton);

    //display controls on hover
    fullScreenButton.style.display = "none";
    volumeSlider.style.display = "none";
    muteButton.style.display = "none";
    videoContainer.addEventListener("mouseover", () => {
        fullScreenButton.style.display = "unset";
        volumeSlider.style.display = "unset";
        muteButton.style.display = "unset";
    })
    videoContainer.addEventListener("mouseout", () => {
        fullScreenButton.style.display = "none";
        volumeSlider.style.display = "none";
        muteButton.style.display = "none";
    })
}