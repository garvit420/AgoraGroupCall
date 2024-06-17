const APP_ID = "e628b04189314162b71eef929dce8985"; // Replace with your actual App ID
const TOKEN = null; // Replace with your actual token if you have one
const CHANNEL = "main";

const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });

let localTracks = [];
let remoteUsers = {};
let screenTrack = null;
let isHost = false;

let joinAndDisplayLocalStream = async () => {
    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
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
        alert(`Error: ${error.message}`);
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
        alert(`Error: ${error.message}`);
    }
};

let handleUserPublished = async (user, mediaType) => {
    remoteUsers[user.uid] = user;
    try {
        await client.subscribe(user, mediaType);
    } catch (error) {
        console.error("Failed to subscribe to user:", error);
        alert(`Error: ${error.message}`);
        return;
    }

    if (mediaType === 'video') {
        let player = document.getElementById(`user-container-${user.uid}`);
        if (!player) {
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
};

let handleUserLeft = async (user) => {
    delete remoteUsers[user.uid];
    let player = document.getElementById(`user-container-${user.uid}`);
    if (player) {
        player.remove();
    }
};

let handleUserUnpublished = async (user, mediaType) => {
    if (mediaType === 'video' ) {
        let player = document.getElementById(`user-container-${user.uid}`);
        if (player) {
            player.remove();
        }
    }
};

let leaveAndRemoveLocalStream = async () => {
    for (let i = 0; i < localTracks.length; i++) {
        localTracks[i].stop();
        localTracks[i].close();
    }
    if (screenTrack) {
        screenTrack.stop();
        screenTrack.close();
    }
    try {
        await client.leave();
    } catch (error) {
        console.error("Failed to leave the client:", error);
        alert(`Error: ${error.message}`);
    }
    document.getElementById('join-btn').style.display = 'block';
    document.getElementById('stream-controls').style.display = 'none';
    document.getElementById('video-streams').innerHTML = '';
};

let toggleMic = async (e) => {
    if (localTracks[0].muted) {
        await localTracks[0].setMuted(false);
        e.target.innerText = 'Mic on';
        e.target.style.backgroundColor = 'white';
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
        e.target.style.backgroundColor = 'white';
    } else {
        await localTracks[1].setMuted(true);
        e.target.innerText = 'Camera off';
        e.target.style.backgroundColor = '#EE4B2B';
    }
};

let startScreenShare = async () => {
    if (!isHost) {
        alert("Only hosts can share the screen.");
        return;
    }
    try {
        // Stop and unpublish the current video track if it exists
        if (localTracks[1]) {
            await client.unpublish(localTracks[1]);
            localTracks[1].stop();
            localTracks[1].close();
            localTracks[1] = null;
            let UID = client.uid;
            let player = document.getElementById(`user-container-${UID}`);
            if (player) {
                player.remove();
            }
        }

        // Create and publish the screen track
        screenTrack = await AgoraRTC.createScreenVideoTrack();
        let screenUid = screenTrack.getTrackId();

        let player = `
            <div class="video-container" id="user-container-${screenUid}">
                <div class="video-player" id="user-${screenUid}"></div>
            </div>`;
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player);

        screenTrack.play(`user-${screenUid}`);
        await client.publish(screenTrack);

        screenTrack.on('track-ended', stopScreenShare);
    } catch (error) {
        console.error("Failed to start screen sharing:", error);

        // Check if the error is due to the user canceling the screen sharing dialog
        if (!localTracks[1] && !screenTrack) {
            // Recreate and publish the camera track if screen sharing is canceled
            localTracks[1] = await AgoraRTC.createCameraVideoTrack();
            let UID = client.uid;

            let player = `
                <div class="video-container" id="user-container-${UID}">
                    <div class="video-player" id="user-${UID}"></div>
                </div>`;
            document.getElementById('video-streams').insertAdjacentHTML('beforeend', player);

            localTracks[1].play(`user-${UID}`);
            await client.publish(localTracks[1]);
        }

        alert(`Error: ${error.message}`);
    }
};

let stopScreenShare = async () => {
    if (screenTrack) {
        await client.unpublish(screenTrack);
        screenTrack.stop();
        screenTrack.close();
        let player = document.getElementById(`user-container-${screenTrack.getTrackId()}`);
        if (player) {
            player.remove();
        }
        screenTrack = null;

        // Recreate and publish the camera track
        if (isHost) {
            try {
                localTracks[1] = await AgoraRTC.createCameraVideoTrack();
                let UID = client.uid;

                let player = `
                    <div class="video-container" id="user-container-${UID}">
                        <div class="video-player" id="user-${UID}"></div>
                    </div>`;
                document.getElementById('video-streams').insertAdjacentHTML('beforeend', player);

                localTracks[1].play(`user-${UID}`);
                await client.publish(localTracks[1]);
            } catch (error) {
                console.error("Failed to recreate camera track:", error);
                alert(`Error: ${error.message}`);
            }
        }
    }
};

document.getElementById('host-btn').addEventListener('click', () => joinStream(true));
document.getElementById('audience-btn').addEventListener('click', () => joinStream(false));
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream);
document.getElementById('mic-btn').addEventListener('click', toggleMic);
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('screen-share-btn').addEventListener('click', startScreenShare);
document.getElementById('stop-screen-share-btn').addEventListener('click', stopScreenShare);
