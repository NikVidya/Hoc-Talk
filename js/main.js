'use strict';

//#region Definitions

var isChannelReady = false;
var isInitiator = false;
var isStarted = new Array(); //stores whether stream is started with each client, allows dynamic client amount
var localStream;
var peerConnections = new Array(); //peerconnections collected via associative array (socket.id as key, RTCPeerConnection as value)
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
  audio: false,
  video: true
})
  .then(gotStream)
  .catch(e => alert('getUserMedia() error: ' + e.name));

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  // if (isInitiator) { //might not need this
  //   start(session.id);
  // }
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
  isInitiator = true;
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

// This client sends a message, attaching its ID
function sendMessage(message) {
  console.log('Client ' + socket.id + ' sending message: ', message);
  socket.emit('message', message, socket.id);
}

// This client receives a message
socket.on('message', (message, senderId) => {
  console.log('Client received message:', message);
  console.log('message from: ' + senderId);
  if (message === 'got user media') {
    console.log("this client starting with client " + senderId);
    start(senderId);
  } else if (message.type === 'offer') {
    console.log(">>>>>>> received offer, params ", isInitiator, isStarted[senderId]);
    if (!isInitiator && !isStarted[senderId]) {
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
});


//#endregion

//#region Handlers/Callbacks

function start(targetId) {
  console.log('>>>>>>> start() ', isStarted[targetId], localStream, isChannelReady, targetId);
  //if the call isn't started from this client, we have a local stream, and we have requested the server to join the room
  if (!isStarted[targetId] && typeof localStream !== 'undefined' && isChannelReady) { //TODO possibly bad to send offer to this client
    console.log('>>>>>> creating peer connection with client ' + targetId);
    handleCreatePeerConnection(targetId);
    peerConnections[targetId].addStream(localStream);
    isStarted[targetId] = true;
    // console.log('isInitiator', isInitiator);
    // if (isInitiator) {
    handleCreateOffer(targetId);
    //}
  }
}

function handleCreatePeerConnection(targetId) {
  try {
    peerConnections[targetId] = new RTCPeerConnection(null);
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

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStreams.push(event.stream);
  var newVideoElement = document.createElement('video');
  newVideoElement.autoplay = true;
  newVideoElement.className = "remoteVideo";
  document.getElementById('videos').appendChild(newVideoElement);
  remoteVideos.push(newVideoElement);
  remoteVideos[remoteVideos.length - 1].srcObject = remoteStreams[remoteStreams.length - 1];
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function handleCreateOffer(targetId) {
  console.log('Sending offer to peer');
  // peerConnections[targetId].createOffer(setLocalAndSendMessage(targetId), handleCreateOfferError);
  peerConnections[targetId].createOffer().then(offer => {
    console.log("Setting local description " + offer);
    return peerConnections[targetId].setLocalDescription(offer);
  })
    .then(() => {
      sendMessage(peerConnections[targetId].localDescription);
    })
    .catch(handleCreateOfferError);
}

function handleCreateAnswer(targetId) {
  console.log('Sending answer to peer.');
  // peerConnections[targetId].createAnswer().then(
  //   setLocalAndSendMessage(targetId),
  //   onCreateSessionDescriptionError
  // );
  peerConnections[targetId].createAnswer().then(answer => {
    return peerConnections[targetId].setLocalDescription(answer);
  })
    .then(() => {
      sendMessage(peerConnections[targetId].localDescription);
    })
    .catch(onCreateSessionDescriptionError);
}

// function setLocalAndSendMessage(sessionDescription, targetId) {
//   peerConnections[targetId].setLocalDescription(sessionDescription);
//   console.log('setLocalAndSendMessage sending message', sessionDescription);
//   sendMessage(sessionDescription);
// }

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function onCreateSessionDescriptionError(error) {
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
  peerConnection[peerId].close();
}

function hangup() {
  console.log(socket.id + " hanging up.");
  isInitiator = false;
  stop();
  sendMessage('bye');
}

function stop() {
  for (var index in isStarted) {
    if (!isStarted.hasOwnProperty(index)) {
      continue;
    }
    isStarted[index] = false;
  }
  peerConnections.foreach(close());
  peerConnections = null;
}

window.onbeforeunload = () => {
  sendMessage('bye');
};
//#endregion