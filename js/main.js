'use strict';

//#region Definitions

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var peerConnections;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: false,
  offerToReceiveVideo: true
};

var socket = io.connect();

var localVideo = document.querySelector('#localVideo');
var remoteStreams = new Array();
var remoteVideos = new Array(); //defined dynamically as streams are added

var constraints = {
  audio: false,
  video: true
};

//#endregion

//#region Socket

window.room = window.location.hash.substring(1);
if (!room) {
  window.room = window.location.hash = prompt("Enter room name:");
}

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  if (isInitiator) {
    console.log('This peer is the initiator of room ' + room + '!');
  }
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

//#endregion

//#region Messages

// This client sends a message, attaching its ID
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message, socket.id);
}

// This client receives a message
socket.on('message', (message, senderId) => {
  console.log('Client received message:', message);
  console.log('message from: ' + senderId);
  if (message === 'got user media') {
    maybeStart(senderId);
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart(senderId);
    }
    peerConnections[socket.id].setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(senderId);
  } else if (message.type === 'answer' && isStarted) {
    peerConnections[socket.id].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peerConnections[socket.id].addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

//#endregion

//#region Main

//get local mediastream
navigator.mediaDevices.getUserMedia({
  audio: false,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart(session.id);
  }
}

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

function maybeStart(targetId) {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady, targetId);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection with client ' + targetId);
    createPeerConnection(targetId);
    peerConnections[targetId].addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall(targetId);
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

//#endregion

//#region Handlers/Callbacks

function createPeerConnection(targetId) {
  try {
    peerConnections[targetId] = new RTCPeerConnection();
    peerConnections[targetId].onicecandidate = handleIceCandidate;
    peerConnections[targetId].onaddstream = handleRemoteStreamAdded;
    peerConnections[targetId].onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
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

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall(targetId) {
  console.log('Sending offer to peer');
  // peerConnections[targetId].createOffer(setLocalAndSendMessage(targetId), handleCreateOfferError);
  peerConnections[targetId].createOffer().then(function(offer){
    console.log('setLocalAndSendMessage sending message', offer);
    return peerConnections[targetId].setLocalDescription(offer);
  })
  .then(function(offer){
    sendMessage(offer);
  })
  .catch(handleCreateOfferError);
}

function doAnswer(targetId) {
  console.log('Sending answer to peer.');
  // peerConnections[targetId].createAnswer().then(
  //   setLocalAndSendMessage(targetId),
  //   onCreateSessionDescriptionError
  // );
  peerConnections[targetId].createAnswer().then(function(answer) {
    console.log('setLocalAndSendMessage sending message', answer);
    return peerConnections[targetId].setLocalDescription(answer);
  })
  .then(function(answer){
    sendMessage(answer);
  })
  .catch(onCreateSessionDescriptionError);
}

//TODO might not work with targetid as an argument when called in createOffer() and createAnswer(), find another solution if broken
function setLocalAndSendMessage(sessionDescription, targetId) {
  peerConnections[targetId].setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
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
    xhr.onreadystatechange = function() {
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

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStreams.push(event.stream);
  var newVideoElement = document.createElement('video');
  newVideoElement.autoplay = true;
  newVideoElement.className = "remoteVideo";
  document.getElementById('videos').appendChild(newVideoElement);
  remoteVideos.push(newVideoElement);
  remoteVideos[remoteVideos.length-1].srcObject = remoteStreams[remoteStreams.length-1];
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  peerConnections.foreach(close());
  peerConnections = null;
}
//#endregion