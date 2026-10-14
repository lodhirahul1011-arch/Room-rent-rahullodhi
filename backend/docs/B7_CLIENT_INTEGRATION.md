# RoomRent B7 — WebRTC Client Integration Contract

This B7 archive implements the **backend signaling and call control**. Real camera/microphone use requires an Owner/Tenant web or React Native client that implements `RTCPeerConnection`, user consent, tracks, speaker/mic controls, and background/incoming-call behavior. The backend does **not** stream, record or store media.

## Prerequisites

1. HTTPS for application and WSS for Socket.IO in production. HTTP localhost is acceptable for development only.
2. Deploy STUN + **TURN** (for example, coturn with a private `static-auth-secret`, TLS where practical). Set `WEBRTC_STUN_URLS`, `WEBRTC_TURN_URLS`, `TURN_SHARED_SECRET` in the server environment. Do not ship `TURN_SHARED_SECRET` in the frontend.
3. Deploy MongoDB as a replica set. Ensure CallLog and CallParticipantLock indexes have been created before taking traffic.
4. Run API with `npm start` and the existing worker separately with `npm run worker`. Worker expires unanswered calls and two-hour stale sessions.
5. Install `socket.io-client` in the Next.js client (or RN app). Use authenticated member access tokens in secure storage. Tablets use only their own device token.
6. A real device must be paired before it can ring. Owner creates a tablet record and reads the one-time pairing code (10 minutes). Tablet calls `/api/tablets/pair` and stores returned credential in secure OS storage.

## REST endpoints

All IDs are MongoDB ObjectId strings. **User** endpoints use `Authorization: Bearer <15-minute accessToken>`; **tablet** endpoints use `Authorization: Bearer <deviceToken>`.

| Method | Endpoint | Authorization | Purpose |
|---|---|---|---|
| POST | `/api/devices` | Owner/Manager | Create property tablet; response includes short-lived **one-time** pairing code |
| GET | `/api/devices` | Owner/Manager | List organization tablets, no device secrets |
| POST | `/api/devices/:id/pairing-code` | Owner/Manager | Reset and re-pair device; revokes existing credential and calls |
| PATCH | `/api/devices/:id` | Owner/Manager | Rename or disable/revoke tablet |
| POST | `/api/tablets/pair` | Pairing code + device ID | Issue device credential (30 days) |
| GET | `/api/tablets/me` | Tablet | Current device identity |
| POST | `/api/tablets/rotate-token` | Tablet | Rotate device credential; reconnect socket with new token |
| GET | `/api/tablets/calls` | Tablet | Device-specific call history |
| POST | `/api/tablets/calls/:id/{accept,reject,end,fail}` | Tablet | Change call state |
| GET | `/api/tablets/calls/:id/ice` | Tablet | Restricted STUN/TURN config for active call |
| POST | `/api/calls` | Owner/Manager/Tenant | Create call (details below) |
| GET | `/api/calls` | User | Calls where actor is caller or recipient |
| GET | `/api/calls/:id` | Participant | Single call |
| GET | `/api/calls/:id/ice` | Participant | Restricted STUN/TURN credentials for active call |
| POST | `/api/calls/:id/{accept,reject,cancel,end,fail}` | Participant | State changes, atomic in MongoDB |

**Call request examples**:

```json
{"type":"tenant","recipientTenantId":"<tenant-object-id>","clientRequestId":"owner-to-tenant-unique-uuid"}
```

```json
{"type":"tenant","recipientOwnerId":"<owner-user-id>","clientRequestId":"tenant-emergency-unique-uuid"}
```

```json
{"type":"tablet","deviceId":"<device-id>","clientRequestId":"owner-to-tablet-unique-uuid"}
```

A client-request ID is required; reusing it by the same caller returns the existing call instead of starting another. A ringing call expires in 45 seconds; a connected call has a 2-hour safety cap. Caller and recipient are reserved via unique MongoDB CallParticipantLock records to prevent parallel ringing sessions. The worker cleans up expired calls; worker downtime can delay cleanup.

## Socket.IO protocol

Connect to the same API host, Socket.IO path `/socket.io`:

```ts
import {io} from 'socket.io-client';
const socket=io(process.env.NEXT_PUBLIC_API_URL!,{
  path:'/socket.io', transports:['websocket'],
  auth:{accessToken} // Tablet uses {deviceToken} instead
});
```

- Server events: `call:sync` (outstanding calls on reconnect), `call:incoming`, `call:updated`, `call:signal`.
- Client ack events: `call:accept`, `call:reject`, `call:cancel`, `call:end`, `call:fail` with `{callId}`.
- Signaling: `call:signal` with `{callId,kind:'offer'|'answer'|'ice-candidate',payload}`.
- Offer payload `{type:'offer',sdp}`. Answer payload `{type:'answer',sdp}`. Candidate payload is the JSON form of `RTCIceCandidate` (`candidate`, `sdpMid`, `sdpMLineIndex`, optional `usernameFragment`).
- Server relays to **only the authenticated counterpart's identity room** and only for `accepted` calls. It does not allow clients to supply an arbitrary recipient room. Only the caller sends offers; recipient sends answers; both send ICE candidates. All event requests should use acknowledgement callbacks and handle `{ok:false,code}`.
- `call:signal` response includes `delivered` and `recipientSocketCount`. If no recipient socket is connected, no SDP/ICE event is queued; retry/renegotiate after reconnect.
- Rate limit: 120 socket actions/minute/connection. New call creation: 6/minute/IP plus global API limit; use a shared rate-limit store across multiple API instances in production.

## Suggested browser call flow

1. Create call via REST; listen for incoming event or recover via `call:sync`.
2. Recipient accepts using `call:accept` (or REST). Server broadcasts `call:updated`.
3. Each participant GETs `/api/calls/:id/ice` (or the tablet variant). If `iceServers` is empty, deployment is not ready for reliable internet media.
4. Request camera and mic access **after user approval**, create `RTCPeerConnection({iceServers})`, add local tracks.
5. Caller executes `createOffer`, `setLocalDescription`, and sends `call:signal` offer. Recipient executes `setRemoteDescription`, `createAnswer`, `setLocalDescription`, and sends answer. Caller sets remote answer.
6. Each peer sends validated ICE candidates via `call:signal`, applies incoming candidates with `addIceCandidate` (queue until `remoteDescription` exists).
7. Use `ontrack` for remote video/audio; handle `connectionState` transitions, ICE restarts, network switching, camera mute, speaker route, and error reporting. In case of fatal failure, emit `call:fail` and close tracks/connections.
8. Either participant ends via `call:end` and stops media tracks; server records state and releases participant locks.

The server does not automatically answer calls or open cameras. Browser foreground call prompts are not equivalent to native incoming-call notifications. Background Android/iOS ringing needs push notifications and OS-specific call UX, not implemented in B7.

## Authorization safeguards

- JWT session/user/membership verified from database on Socket.IO handshake **and each incoming socket action**.
- Tablet token is a 48-byte random secret stored only as SHA-256 hash server-side; paired with a property and organization; one-time pairing code has ten-minute expiry.
- Unauthorized owner/tenant/device IDs, cross-org calls, tenant without active tenancy, unlinked membership, device with expired/revoked credentials, and arbitrary socket room targets are denied.
- A tenant can call an active Owner/Manager in its own organization. An Owner/Manager can call a tenant with active tenancy or a paired tablet in the same organization.
- Signaling messages are bounded in size. SDP and ICE are relayed transiently and not persisted.
- Device revocation disconnects its sockets and terminates active calls; other membership revocations take effect by next socket action/delivery via DB re-check.

## Production gaps / non-goals

- No built-in physical camera media, real NAT traversal verification, mobile incoming-call OS integration, push wake-ups or native video UI.
- No TURN deployment or network-performance monitoring in ZIP; provide infrastructure and test across restrictive networks.
- EventEmitter delivers call events only inside one Node.js API process. For multiple replicas, use a Socket.IO Redis adapter AND a distributed event bus before load-balancing.
- No true MongoDB replica-set integration test has passed in this execution environment; see `B7_IMPLEMENTATION_REPORT.md`.
- Call permissions should be re-reviewed when implementing complex multi-bed/multi-owner cases.
