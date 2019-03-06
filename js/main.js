'use strict';

//#region Definitions

var socket = io.connect();

var isChannelReady = false;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

var localStream;
var localVideo = document.querySelector('#localVideo');

var isStarted = new Array();
var peerConnections = {};
var remoteStreams = new Array();
var remoteVideos = new Array();

var emptyRoom = true;

const audioSelect = document.getElementById('audioDeviceSelect');
const videoSelect = document.getElementById('videoDeviceSelect');
const selectors = [audioSelect, videoSelect];
//#endregion

//#region Main

//room is location hash (#asdf will be "asdf")
window.room = window.location.hash.substring(1);
if (!room) {
  window.room = window.location.hash = prompt("Enter room name:");
}

if (room !== '') {
  socket.emit('create or join', room);
}

function getMedia() {
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
    });
  }
  var audioSource = audioSelect.value;
  var videoSource = videoSelect.value;
  var constraints = {
    audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
    video: { deviceId: videoSource ? { exact: videoSource } : undefined }
  };
  navigator.mediaDevices.getUserMedia(constraints)
    .then(gotStream)
    .then(gotDeviceList)
    .catch(() => navigator.mediaDevices.getUserMedia({ audio: constraints.audio })
      .then(gotStream)
      .then(gotDeviceList)
      .catch(() => navigator.mediaDevices.getUserMedia({ video: constraints.video })
        .then(gotStream)
        .then(gotDeviceList)
        .catch(() => {
          // observer user, make a text chat option for those without mic/camera TODO
          console.log("Beginning without video/audio");
          sendMessage('got user media');
        }
        )
      )
    );
}

// populate device selectors
function gotDeviceList(devices) {
  // wipe the old selector values
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  // add new labels to selector lists
  for (let i = 0; i < devices.length; i++) {
    var deviceInfo = devices[i];
    var option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    switch (deviceInfo.kind) {
      case 'audioinput':
        option.text = deviceInfo.label || 'Microphone ' + (audioSelect.length + 1);
        audioSelect.appendChild(option);
        break;
      case 'videoinput':
        option.text = deviceInfo.label || 'Camera  ' + (videoSelect.length + 1);
        videoSelect.appendChild(option)
        break;
    }
  }
  // update selector list values
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

function gotStream(stream) {
  localStream = stream;
  if (objectLength(peerConnections) == 0) {
    // first time entering room
    sendMessage('got user media');
    activateClientControls();
  } else {
    // getting new devices
    for (var index in peerConnections) {
      if (!peerConnections.hasOwnProperty(index)) {
        continue;
      }
      peerConnections[index].getSenders().forEach(sender => peerConnections[index].removeTrack(sender));
      localStream.getTracks().forEach(track => peerConnections[index].addTrack(track, localStream));
    }
    if (localStream.getAudioTracks()[0] != null) {
      micMuted = false;
    }
  }
  localVideo.srcObject = stream;
  return navigator.mediaDevices.enumerateDevices();
}

navigator.mediaDevices.enumerateDevices()
  .then(gotDeviceList)
  .catch(e => alert('Error detecting devices:' + e.name));

getMedia(); // also called on choose devices button press

//#endregion

//#region Socket Events

socket.on('created', room => {
  console.log('Created room ' + room + ', ' + socket.id + ' is initiator');
});

socket.on('full', room => {
  console.log('Room ' + room + ' is full');
});

socket.on('join', room => {
  console.log('Another peer made a request to join room ' + room);
  isChannelReady = true;
});

socket.on('joined', room => {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', array => {
  console.log.apply(console, array);
});

//#endregion

//#region Messages

// This client sends a message, attaching its ID, sending to targetId (relayed via signalling server)
function sendMessage(message, targetId = 'all', room = window.room) {
  console.log('This client: ' + socket.id + ' sent to ' + targetId + ' message: ', message);
  socket.emit('message', message, socket.id, targetId, room);
}

// This client receives a message
socket.on('message', async (message, senderId, targetId) => {
  if (targetId === socket.id || targetId === 'all') {
    console.log('This client received message: ', message);
    if (message === 'got user media') {
      await start(senderId);

    } else if (message.type === 'offer') {
      await start(senderId);
      await peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(message));
      await handleCreateAnswer(senderId);

    } else if (message.type === 'answer' && isStarted[senderId]) {
      await peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(message));

    } else if (message.type === 'candidate' && isStarted[senderId]) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      await peerConnections[senderId].addIceCandidate(candidate);

    } else if (message === 'bye' && isStarted[senderId]) {
      await handleRemoteHangup(senderId);

    } else {
      console.log("Could not respond to the message");
    }
  } else {
    console.log("message wasn't for me!");
  }
});

//#endregion

//#region Handlers/Callbacks

function start(targetId) {
  //if the call isn't started from this client, we have a local stream, and we have requested the server to join the room
  if (!isStarted[targetId] && typeof localStream !== 'undefined' && isChannelReady) {
    handleCreatePeerConnection(targetId);
    try {
      localStream.getTracks().forEach(track => peerConnections[targetId].addTrack(track, localStream));
    } catch (e) { console.log(e.message); }
    isStarted[targetId] = true;
    handleCreateOffer(targetId);
  }
}

function handleCreatePeerConnection(targetId) {
  try {
    peerConnections[targetId] = new RTCPeerConnection(null);
    peerConnections[targetId].onicecandidate = event => {
      if (event.candidate) {
        sendMessage({
          type: 'candidate',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        }, targetId);
      } else {
        console.log('End of candidates.');
      }
    };
    peerConnections[targetId].ontrack = event => {
      remoteStreams.push(event.streams[0]);
      var newVideoElement = document.getElementById(targetId);
      if (newVideoElement == null) {
        newVideoElement = document.createElement('video');
        newVideoElement.id = targetId;
        newVideoElement.className = "remoteVideo";
        newVideoElement.autoplay = true;
        var newVideoContainer = document.createElement('div');
        newVideoContainer.className = "remote-video-container";
        newVideoContainer.id = targetId + "-container";
        document.getElementById('videos').appendChild(newVideoContainer);
        newVideoContainer.appendChild(newVideoElement);
        remoteVideos.push(newVideoElement);
        addControls(newVideoElement, newVideoContainer);
      }
      remoteVideos[remoteVideos.indexOf(newVideoElement)].srcObject = remoteStreams[remoteStreams.length - 1];
    };
    peerConnections[targetId].onnegotiationneeded = () => {
      handleCreateOffer(targetId);
    };
  } catch (e) {
    console.log('Failed to create PeerConnection with client ' + targetId + ', exception: ' + e.message);
    alert('Cannot create peer connection. Hang up and try again.');
    return;
  }
}

function handleCreateOffer(targetId) {
  peerConnections[targetId].createOffer().then(offer => {
    return peerConnections[targetId].setLocalDescription(offer);
  })
    .then(() => {
      sendMessage(peerConnections[targetId].localDescription, targetId);
    })
    .catch(onCreateOfferError);
}

function handleCreateAnswer(targetId) {
  peerConnections[targetId].createAnswer().then(answer => {
    return peerConnections[targetId].setLocalDescription(answer);
  })
    .then(() => {
      sendMessage(peerConnections[targetId].localDescription, targetId);
    })
    .catch(onCreateSessionDescriptionError);
}

function onCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function handleRequestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteHangup(peerId) {
  try {
    remoteVideos.splice(remoteVideos.indexOf(document.getElementById(peerId)), 1)[0].remove();
    document.getElementById(peerId + "-container").remove();
    peerConnections[peerId].close();
    peerConnections[peerId] = null;
    delete peerConnections[peerId];
    isStarted[peerId] = false;
  } catch (e) {
    console.log("RemoteHangup error: " + e.message);
  }
}

function hangup() {
  sendMessage("bye");
  stop();
}

function stop() {
  for (var index in isStarted) {
    if (!isStarted.hasOwnProperty(index)) {
      continue;
    }
    isStarted[index] = false;
  }
  for (var id in peerConnections) {
    if (!peerConnections.hasOwnProperty(id)) {
      continue;
    }
    peerConnections[id].close();
    delete peerConnections[id];
  }
  isStarted = new Array();
  peerConnections = {};
  remoteStreams = new Array();
  remoteVideos = new Array();
}

function objectLength(obj) {
  var len = 0;
  for (var p in obj) {
    if (obj.hasOwnProperty(p)) {
      len++;
    }
  }
  return len;
}

window.onbeforeunload = () => {
  sendMessage("bye");
};
//#endregion
