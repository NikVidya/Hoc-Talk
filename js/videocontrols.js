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
    var muteButton = document.createElement('button');
    muteButton.className = "btn mute-btn";
    muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
    muteButton.addEventListener("click", () => {
        if (videoElement.muted == false) {
            muteButton.innerHTML = '<i class="fas fa-volume-off"></i>';
            videoElement.muted = true;
        } else {
            muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            videoElement.muted = false;
        }
    })

    videoContainer.appendChild(fullScreenButton);
    videoContainer.appendChild(volumeSlider);
    videoContainer.appendChild(muteButton);

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