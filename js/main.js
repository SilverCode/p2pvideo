const client_id = 'client_' + Math.trunc(Math.random() * 1000);
let mqtt_client;
let rtc_client;

const mqtt_config = {
    server: "192.168.1.30",
    port: 9002,
    useSSL: true
}
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("Connection lost: ", responseObject);
    }
}

function onMessageArrived(message) {
    if (message && message.destinationName === "offer") {
        const payload = JSON.parse(message.payloadString);
        if (payload.client_id !== client_id) {
            console.log('Received offer from ' + payload.client_id);
            receiveOffer(payload.offer);
        }
    } else if (message && message.destinationName === "answer") {
        const payload = JSON.parse(message.payloadString);
        if (payload.client_id !== client_id) {
            console.log('Received answer from ' + payload.client_id);
            receiveAnswer(payload.answer);
        }
    } else if (message && message.destinationName === "ice") {
        const payload = JSON.parse(message.payloadString);
        if (payload.client_id !== client_id) {
            console.log('Received ICE candidate from ' + payload.client_id);
            receiveICECandidate(payload.ice);
        }
    }
}

function onConnect() {
    console.log('Connected to MQTT as', client_id);
    mqtt_client.subscribe("offer");
    mqtt_client.subscribe("answer")
    mqtt_client.subscribe("ice")
    initWebRTC();
}

function sendOffer(offer) {
    console.log('Sending Offer');
    const payload = JSON.stringify({
        "client_id": client_id,
        "type": "offer",
        "offer": offer
    })
    let message = new Paho.MQTT.Message(payload);
    message.destinationName = "offer";
    mqtt_client.send(message);
}

function sendAnswer(answer) {
    console.log('Sending Answer');
    const payload = JSON.stringify({
        "client_id": client_id,
        "type": "answer",
        "answer": answer
    });
    let message = new Paho.MQTT.Message(payload);
    message.destinationName = "answer";
    mqtt_client.send(message);
}

function sendICECandidate(iceCandidate) {
    console.log('Sending ICE candidate');
    const payload = JSON.stringify({
        "client_id": client_id,
        "type": "ice",
        "ice": iceCandidate
    });
    let message = new Paho.MQTT.Message(payload);
    message.destinationName = "ice";
    mqtt_client.send(message);
}

function receiveICECandidate(iceCandidate) {
    if (iceCandidate != null) {
        rtc_client.addIceCandidate(iceCandidate)
            .then()
            .catch(e => console.log(e));
    }
}

function receiveOffer(offer) {
    rtc_client = new RTCPeerConnection();

    rtc_client.onconnectionstatechange = () => {
        if (rtc_client.connectionState === "connected") {
            console.log("Connected");
        }
    }
    rtc_client.ontrack = handleTrack;
    document.getElementById('local').srcObject.getTracks().forEach(track => {
        rtc_client.addTrack(track);
    });

    rtc_client.setRemoteDescription(offer)
        .then(() => rtc_client.createAnswer())
        .then(answer => rtc_client.setLocalDescription(answer))
        .then(() => {
            sendAnswer(rtc_client.localDescription);
            rtc_client.onicecandidate = e => {
                sendICECandidate(e.candidate);
            }
        });
}

function receiveAnswer(answer) {
    rtc_client.setRemoteDescription(answer);
}

function initMQTT() {
    mqtt_client = new Paho.MQTT.Client(mqtt_config.server, mqtt_config.port, client_id);

    mqtt_client.onConnectionLost = onConnectionLost;
    mqtt_client.onMessageArrived = onMessageArrived;

    mqtt_client.connect({
        onSuccess: onConnect,
        useSSL: mqtt_config.useSSL
    });
}

function dial() {
    rtc_client = new RTCPeerConnection();
    rtc_client.onconnectionstatechange = (e) => {
        if (rtc_client.connectionState === "connected") {
            console.log("Connected");
        }
    }
    rtc_client.onicecandidate = e => {
        sendICECandidate(e.candidate);
    }

    rtc_client.ontrack = handleTrack;
    document.getElementById('local').srcObject.getTracks().forEach(track => {
        rtc_client.addTrack(track);
    });
    rtc_client.createOffer()
        .then(offer =>rtc_client.setLocalDescription(offer))
        .then(() => sendOffer(rtc_client.localDescription))
}

function handleTrack(trackEvent) {
    console.log('Received Track');
    let remote_video = document.getElementById('remote');
    if (!remote_video.srcObject) {
        remote_video.srcObject = new MediaStream();
    }
    remote_video.srcObject.addTrack(trackEvent.track);
}

function initWebRTC() {
    navigator.mediaDevices.getUserMedia(
        {
            video: {'width': 1280, 'height': 720},
            audio: {'echoCancellation': true}
        })
        .then(stream => {
            let local_video = document.getElementById('local');
            local_video.srcObject = stream;
            local_video.play();
        })
        .catch(error => {
            console.log(error);
        })
}

function init() {
    initMQTT();
    document.getElementById("btnDial").addEventListener("click", dial);
}

init();
