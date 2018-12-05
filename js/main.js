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

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};


var localStream;
var localVideo = document.querySelector('#localVideo');

var isStarted = new Array();
var peerConnections = new Array(); //peerconnections collected via associative array (socket.id as key, RTCPeerConnection as value)
var remoteStreams = new Array();
var remoteVideos = new Array();

var constraints = {
  audio: true,
  video: true
}; //constraints for remote videos only

//#endregion

//#region Main

//enter room to join via URL or prompt
window.room = window.location.hash.substring(1);
if (!room) {
  window.room = window.location.hash = prompt("Enter room name:");
}

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

//get local mediastream once we are in a room
navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
  .then(gotStream)
  .catch(e => alert('getUserMedia() error: ' + e.name));

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  activateClientControls();
}

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
  handleRequestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

//#endregion

//#region Socket Callbacks

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
  console.log('Client ' + socket.id + ' to ' + targetId + ' - sending message: ', message);
  socket.emit('message', message, socket.id, targetId, room);
}

// This client receives a message
socket.on('message', (message, senderId, targetId) => {
  if (targetId === socket.id || targetId === "all") {
    console.log('Client received message:', message);
    console.log('message from: ' + senderId);
    if (message === 'got user media') {
      console.log("this client starting with client " + senderId);
      start(senderId);
    } else if (message.type === 'offer') {
      console.log(">>>>>>> received offer, params ", isStarted[senderId]);
      if (!isStarted[senderId]) {
        start(senderId);
      }
      peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(message));
      handleCreateAnswer(senderId);
    } else if (message.type === 'answer' && isStarted[senderId]) {
      peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted[senderId]) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      peerConnections[senderId].addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted[senderId]) {
      handleRemoteHangup(senderId);
    }
  } else {
    console.log("message wasn't for me!");
  }
});


//#endregion

//#region Handlers/Callbacks

function start(targetId) {
  console.log('>>>>>>> start() ', isStarted[targetId], localStream, isChannelReady, targetId);
  //if the call isn't started from this client, we have a local stream, and we have requested the server to join the room
  if (!isStarted[targetId] && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>>> creating peer connection with client ' + targetId);
    handleCreatePeerConnection(targetId);
    peerConnections[targetId].addTrack(localStream.getVideoTracks()[0], localStream);
    peerConnections[targetId].addTrack(localStream.getAudioTracks()[0], localStream);
    isStarted[targetId] = true;
    handleCreateOffer(targetId);
  }
}

function handleCreatePeerConnection(targetId) {
  try {
    peerConnections[targetId] = new RTCPeerConnection(null);
    peerConnections[targetId].onicecandidate = handleIceCandidate;
    peerConnections[targetId].ontrack = event => {
      console.log('Remote stream added.');
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
    peerConnections.onnegotiationneeded = () => {
      handleCreateOffer(targetId);
    };
    console.log('Created RTCPeerConnnection ' + targetId);
  } catch (e) {
    console.log('Failed to create PeerConnection with client ' + targetId + ', exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOffer(targetId) {
  console.log('Sending offer to peer');
  peerConnections[targetId].createOffer().then(offer => {
    console.log("Setting local description " + offer);
    return peerConnections[targetId].setLocalDescription(offer);
  })
    .then(() => {
      sendMessage(peerConnections[targetId].localDescription, targetId);
    })
    .catch(handleCreateOfferError);
}

function handleCreateAnswer(targetId) {
  console.log('Sending answer to peer.');
  peerConnections[targetId].createAnswer().then(answer => {
    return peerConnections[targetId].setLocalDescription(answer);
  })
    .then(() => {
      sendMessage(peerConnections[targetId].localDescription, targetId);
    })
    .catch(onCreateSessionDescriptionError);
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function onCreateSessionDescriptionError(error) {
  1
  trace('Failed to create session description: ' + error.toString());
}

function handleRequestTurn(turnURL) {
  console.log("Requesting TURN server");
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
  console.log('Hanging up peerConnection ' + peerId);
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
  console.log(socket.id + " hanging up.");
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
  for (var index in peerConnections) {
    peerConnections[index].close();
    peerConnections[index] = null;
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