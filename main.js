const APP_ID = "e628b04189314162b71eef929dce8985"; // Replace with your actual App ID
const TOKEN = null; // Replace with your actual token if you have one
const CHANNEL = "main";

const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });

let localTracks = [];
let remoteUsers = {};

let isHost = false;

let joinAndDisplayLocalStream = async () => {
    client.on('user-published', handleUserJoined);
    client.on('user-left', handleUserLeft);

    try {
        let UID = await client.join(APP_ID, CHANNEL, TOKEN, null);

        if (isHost) {
            localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        }

        let player = `
            <div class="video-container" id="user-container-${UID}">
                <div class="video-player" id="user-${UID}"></div>
            </div>`;
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player);

        if (isHost) {
            localTracks[1].play(`user-${UID}`);
            await client.publish([localTracks[0], localTracks[1]]);
        }

    } catch (error) {
        console.error("Failed to join and display local stream:", error);
    }
};

let joinStream = async (isHostRole) => {
    isHost = isHostRole;
    try {
        await client.setClientRole(isHost ? "host" : "audience");
        await joinAndDisplayLocalStream();
        document.getElementById('join-btn').style.display = 'none';
        document.getElementById('stream-controls').style.display = 'flex';
    } catch (error) {
        console.error("Failed to join stream:", error);
    }
};

let joinStreamAsAudience = async () => {
    await joinStream(false);
};

let handleUserJoined = async (user, mediaType) => {
    remoteUsers[user.uid] = user;

    try {
        await client.subscribe(user, mediaType);

        if (mediaType === 'video') {
            let player = document.getElementById(`user-container-${user.uid}`);
            if (player == null) {
                player = `
                    <div class="video-container" id="user-container-${user.uid}">
                        <div class="video-player" id="user-${user.uid}"></div>
                    </div>`;
                document.getElementById('video-streams').insertAdjacentHTML('beforeend', player);
            }
            user.videoTrack.play(`user-${user.uid}`);
        }

        if (mediaType === 'audio') {
            user.audioTrack.play();
        }
    } catch (error) {
        console.error("Failed to handle user join:", error);
    }
};

let handleUserLeft = async (user) => {
    delete remoteUsers[user.uid];
    document.getElementById(`user-container-${user.uid}`).remove();
};

let leaveAndRemoveLocalStream = async () => {
    for (let i = 0; i < localTracks.length; i++) {
        localTracks[i].stop();
        localTracks[i].close();
    }

    await client.leave();
    document.getElementById('join-btn').style.display = 'block';
    document.getElementById('stream-controls').style.display = 'none';
    document.getElementById('video-streams').innerHTML = '';
};

let toggleMic = async (e) => {
    if (localTracks[0].muted) {
        await localTracks[0].setMuted(false);
        e.target.innerText = 'Mic on';
        e.target.style.backgroundColor = 'cadetblue';
    } else {
        await localTracks[0].setMuted(true);
        e.target.innerText = 'Mic off';
        e.target.style.backgroundColor = '#EE4B2B';
    }
};

let toggleCamera = async (e) => {
    if (localTracks[1].muted) {
        await localTracks[1].setMuted(false);
        e.target.innerText = 'Camera on';
        e.target.style.backgroundColor = 'cadetblue';
    } else {
        await localTracks[1].setMuted(true);
        e.target.innerText = 'Camera off';
        e.target.style.backgroundColor = '#EE4B2B';
    }
};

document.getElementById('host-btn').addEventListener('click', () => joinStream(true));
document.getElementById('audience-btn').addEventListener('click', joinStreamAsAudience);
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream);
document.getElementById('mic-btn').addEventListener('click', toggleMic);
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
