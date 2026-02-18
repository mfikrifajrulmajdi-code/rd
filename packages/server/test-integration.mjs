/**
 * Integration Test Script — Remote Desktop Signaling Server
 * Uses correct event names from @remote-app/shared SOCKET_EVENTS constants
 */
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const RESULTS = [];

const log = (msg) => console.log(`[TEST] ${msg}`);
const pass = (test, note = '') => {
    RESULTS.push({ test, status: '✅ PASS', note });
    console.log(`✅ PASS: ${test}${note ? ' — ' + note : ''}`);
};
const fail = (test, note = '') => {
    RESULTS.push({ test, status: '❌ FAIL', note });
    console.log(`❌ FAIL: ${test}${note ? ' — ' + note : ''}`);
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const makeClient = () => io(SERVER_URL, { transports: ['websocket'], reconnection: false });

async function runTests() {
    console.log('\n=== Remote Desktop Integration Test Suite ===\n');

    // ── TEST 1: Server health ──────────────────────────────────────────────────
    try {
        const res = await fetch(SERVER_URL);
        const json = await res.json();
        if (json.status === 'ok') pass('Test 1: Server running', json.message);
        else fail('Test 1: Server running', JSON.stringify(json));
    } catch (e) {
        fail('Test 1: Server running', e.message);
    }

    // ── TEST 2: Host registers → gets session code ─────────────────────────────
    log('\nTest 2: Host registration (register-host → register-host-response)...');
    const host = makeClient();
    let sessionCode = null;

    await new Promise((resolve) => {
        const t = setTimeout(() => { fail('Test 2: Host registration', 'Timeout (6s)'); resolve(); }, 6000);
        host.on('connect', () => {
            log(`  Host socket connected: ${host.id}`);
            host.emit('register-host', { peerId: host.id, expiresInMs: 600000 });
        });
        host.on('register-host-response', (data) => {
            clearTimeout(t);
            sessionCode = data.sessionCode;
            const valid = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(data.sessionCode);
            if (valid) pass('Test 2: Host registration', `Session code: ${data.sessionCode}`);
            else fail('Test 2: Host registration', `Bad format: ${JSON.stringify(data)}`);
            resolve();
        });
        host.on('connect_error', (e) => { clearTimeout(t); fail('Test 2: Host registration', e.message); resolve(); });
    });

    if (!sessionCode) {
        fail('Tests 3-11', 'No session code — aborting remaining tests');
        return printSummary();
    }

    // ── TEST 3: Viewer joins ───────────────────────────────────────────────────
    log(`\nTest 3: Viewer connects to session ${sessionCode}...`);
    const viewer1 = makeClient();

    await new Promise((resolve) => {
        const t = setTimeout(() => { fail('Test 3: Viewer connect', 'Timeout (6s)'); resolve(); }, 6000);
        viewer1.on('connect', () => {
            log(`  Viewer socket connected: ${viewer1.id}`);
            viewer1.emit('join-session', { sessionCode, role: 'viewer' });
        });
        viewer1.on('join-session-response', (data) => {
            clearTimeout(t);
            pass('Test 3: Viewer connect', `hostId: ${data.hostId}, peerId: ${data.peerId}`);
            resolve();
        });
        viewer1.on('error', (e) => { clearTimeout(t); fail('Test 3: Viewer connect', JSON.stringify(e)); resolve(); });
        viewer1.on('connect_error', (e) => { clearTimeout(t); fail('Test 3: Viewer connect', e.message); resolve(); });
    });

    // ── TEST 5: Admin joins ────────────────────────────────────────────────────
    log('\nTest 5: Admin connects...');
    const admin = makeClient();
    let adminPeerId = null;

    await new Promise((resolve) => {
        const t = setTimeout(() => { fail('Test 5: Admin connect', 'Timeout (6s)'); resolve(); }, 6000);
        admin.on('connect', () => {
            log(`  Admin socket connected: ${admin.id}`);
            admin.emit('join-session', { sessionCode, role: 'admin' });
        });
        admin.on('join-session-response', (data) => {
            clearTimeout(t);
            adminPeerId = data.peerId;
            pass('Test 5: Admin connect', `hostId: ${data.hostId}, peerId: ${data.peerId}`);
            resolve();
        });
        admin.on('error', (e) => { clearTimeout(t); fail('Test 5: Admin connect', JSON.stringify(e)); resolve(); });
        admin.on('connect_error', (e) => { clearTimeout(t); fail('Test 5: Admin connect', e.message); resolve(); });
    });

    // ── TEST 8: Second viewer (multiple viewers) ───────────────────────────────
    log('\nTest 8: Second viewer (multiple viewers)...');
    const viewer2 = makeClient();

    await new Promise((resolve) => {
        const t = setTimeout(() => { fail('Test 8: Multiple viewers', 'Timeout (6s)'); resolve(); }, 6000);
        viewer2.on('connect', () => {
            log(`  Viewer2 socket connected: ${viewer2.id}`);
            viewer2.emit('join-session', { sessionCode, role: 'viewer' });
        });
        viewer2.on('join-session-response', (data) => {
            clearTimeout(t);
            pass('Test 8: Multiple viewers', `2nd viewer joined. hostId: ${data.hostId}, peerId: ${data.peerId}`);
            resolve();
        });
        viewer2.on('error', (e) => { clearTimeout(t); fail('Test 8: Multiple viewers', JSON.stringify(e)); resolve(); });
        viewer2.on('connect_error', (e) => { clearTimeout(t); fail('Test 8: Multiple viewers', e.message); resolve(); });
    });

    // ── TEST 9: Admin disconnect → host gets peer-left ─────────────────────────
    log('\nTest 9: Admin disconnect → host receives peer-left...');
    let peerLeftReceived = false;
    const peerLeftPromise = new Promise((resolve) => {
        host.on('peer-left', (data) => {
            peerLeftReceived = true;
            log(`  Host received peer-left: peerId=${data.peerId}`);
            resolve();
        });
        setTimeout(resolve, 3000);
    });
    admin.disconnect();
    await peerLeftPromise;

    if (peerLeftReceived) {
        pass('Test 9: Disconnect handling', 'Host received peer-left when admin disconnected');
    } else {
        fail('Test 9: Disconnect handling', 'peer-left not received by host within 3s');
    }

    // ── TEST 10: Host disconnect → viewers get peer-left ──────────────────────
    log('\nTest 10: Host disconnect → viewers notified...');
    let viewerNotified = false;
    const hostDisconnectPromise = new Promise((resolve) => {
        viewer1.on('peer-left', (data) => {
            viewerNotified = true;
            log(`  Viewer1 received peer-left: peerId=${data.peerId}`);
            resolve();
        });
        viewer1.on('disconnect', () => {
            viewerNotified = true;
            log('  Viewer1 was disconnected by server');
            resolve();
        });
        setTimeout(resolve, 3000);
    });
    host.disconnect();
    await hostDisconnectPromise;

    if (viewerNotified) {
        pass('Test 10: Host disconnect', 'Viewer notified when host disconnected');
    } else {
        fail('Test 10: Host disconnect', 'No notification received by viewer within 3s');
    }

    // ── TEST 11: Session expiry (3s TTL) ──────────────────────────────────────
    log('\nTest 11: Session expiry (3-second TTL)...');
    const host2 = makeClient();
    let expiryReceived = false;

    await new Promise((resolve) => {
        const t = setTimeout(() => { fail('Test 11: Session expiry', 'Timeout creating session'); resolve(); }, 5000);
        host2.on('connect', () => host2.emit('register-host', { peerId: host2.id, expiresInMs: 3000 }));
        host2.on('register-host-response', async (data) => {
            clearTimeout(t);
            log(`  Short-lived session: ${data.sessionCode} (3s TTL)`);

            const viewerE = makeClient();
            viewerE.on('connect', () => viewerE.emit('join-session', { sessionCode: data.sessionCode, role: 'viewer' }));
            viewerE.on('join-session-response', () => log('  Viewer joined expiry session, waiting 5s...'));
            viewerE.on('session-expired', () => { expiryReceived = true; log('  ✅ session-expired received by viewer'); });
            host2.on('session-expired', () => { expiryReceived = true; log('  ✅ session-expired received by host'); });

            await delay(5000);

            if (expiryReceived) {
                pass('Test 11: Session expiry', 'session-expired event received after TTL');
            } else {
                fail('Test 11: Session expiry', 'No session-expired event after 5s (TTL was 3s)');
            }

            viewerE.disconnect();
            host2.disconnect();
            resolve();
        });
        host2.on('connect_error', (e) => { clearTimeout(t); fail('Test 11: Session expiry', e.message); resolve(); });
    });

    // Cleanup
    viewer1.disconnect();
    viewer2.disconnect();

    printSummary();
}

function printSummary() {
    const passed = RESULTS.filter((r) => r.status.includes('PASS')).length;
    const failed = RESULTS.filter((r) => r.status.includes('FAIL')).length;

    console.log('\n' + '='.repeat(60));
    console.log('SIGNALING LAYER TEST RESULTS');
    console.log('='.repeat(60));
    RESULTS.forEach((r) => console.log(`${r.status}  ${r.test}${r.note ? '\n          └─ ' + r.note : ''}`));
    console.log('\n' + '─'.repeat(60));
    console.log(`✅ Tests passed: ${passed}/${RESULTS.length}`);
    console.log(`❌ Tests failed: ${failed}/${RESULTS.length}`);
    console.log('');
    console.log('Note: Tests 4 (video stream), 6 (input control), 7 (viewer restriction)');
    console.log('      require browser/WebRTC — must be verified manually in browser.');
    console.log('='.repeat(60));
}

runTests().catch((e) => { console.error('Fatal:', e); process.exit(1); });
