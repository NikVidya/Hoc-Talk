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
var peerConnections = new Array(); //peerconnections collected via associative array (socket.id as key, RTCPeerConnection as value)
var remoteStreams = new Array();
var remoteVideos = new Array();

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

//check for a/v, if that fails check for a, if that fails check for v
function getMedia(onGotStream) {
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
    .then(onGotStream)
    .catch(e => {
      console.log(e.message);
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      })
        .then(onGotStream)
        .catch(e => {
          console.log(e.message);
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
          })
            .then(onGotStream)
            .catch(e => alert('getUserMedia() error: ' + e.name));
        });
    });
}

function gotStream(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  activateClientControls();
}

getMedia(gotStream);


if (location.hostname !== 'localhost') {
  handleRequestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

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
function sendMessage(message, targetId = "all", room = window.room) {
  console.log('This client: ' + socket.id + ' sent to ' + targetId + ' message: ', message);
  socket.emit('message', message, socket.id, targetId, room);
}

// This client receives a message
socket.on('message', async (message, senderId, targetId) => {
  if (targetId === socket.id || targetId === "all") {
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
    }
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
    alert('Cannot create RTCPeerConnection object.');
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
    peerConnections[id] = null;
  }
  peerConnections = new Array();
  isStarted = new Array();
  peerConnections = new Array();
  remoteStreams = new Array();
  remoteVideos = new Array();
}

window.onbeforeunload = () => {
  sendMessage("bye");
};
//#endregion