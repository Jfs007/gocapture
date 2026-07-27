const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key) {
  return crypto.createHash('sha1').update(`${key}${GUID}`).digest('base64');
}

function encodeFrame(text) {
  const payload = Buffer.from(text);
  const length = payload.length;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }
  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function encodeControlFrame(opcode, payload = Buffer.alloc(0)) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (body.length > 125) return Buffer.alloc(0);
  return Buffer.concat([Buffer.from([0x80 | opcode, body.length]), body]);
}

function unmaskPayload(payload, mask) {
  if (!mask) return payload;
  for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return payload;
}

function emitCompleteMessage(socket, opcode, payload, onText) {
  if (opcode === 0x1) {
    onText(payload.toString('utf8'));
  }
}

function appendFragment(socket, opcode, payload, fin, onText) {
  if (opcode === 0x1 || opcode === 0x2) {
    if (fin) {
      emitCompleteMessage(socket, opcode, payload, onText);
      return;
    }
    socket.__gocaptureWsFragmentOpcode = opcode;
    socket.__gocaptureWsFragments = [payload];
    return;
  }

  if (opcode !== 0x0) return;
  const fragmentOpcode = socket.__gocaptureWsFragmentOpcode;
  const fragments = socket.__gocaptureWsFragments;
  if (!fragmentOpcode || !Array.isArray(fragments)) {
    socket.destroy();
    return;
  }
  fragments.push(payload);
  if (!fin) return;
  const complete = Buffer.concat(fragments);
  socket.__gocaptureWsFragmentOpcode = 0;
  socket.__gocaptureWsFragments = null;
  emitCompleteMessage(socket, fragmentOpcode, complete, onText);
}

function decodeFrames(socket, chunk, onText) {
  socket.__gocaptureWsBuffer = Buffer.concat([socket.__gocaptureWsBuffer || Buffer.alloc(0), chunk]);
  let buffer = socket.__gocaptureWsBuffer;
  let offset = 0;

  while (buffer.length - offset >= 2) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const fin = (first & 0x80) === 0x80;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) === 0x80;
    let length = second & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (buffer.length - offset < 10) break;
      const bigLength = buffer.readBigUInt64BE(offset + 2);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        socket.destroy();
        return;
      }
      length = Number(bigLength);
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + length;
    if (buffer.length - offset < frameLength) break;

    if (opcode === 0x8) {
      socket.end();
      return;
    }

    const maskOffset = offset + headerLength;
    const payloadOffset = maskOffset + maskLength;
    const mask = masked ? buffer.subarray(maskOffset, maskOffset + 4) : null;
    const payload = unmaskPayload(Buffer.from(buffer.subarray(payloadOffset, payloadOffset + length)), mask);

    if (opcode === 0x9) {
      const pong = encodeControlFrame(0xA, payload);
      if (pong.length) socket.write(pong);
    } else if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
      appendFragment(socket, opcode, payload, fin, onText);
    }

    offset += frameLength;
  }

  socket.__gocaptureWsBuffer = buffer.subarray(offset);
}

function upgradeToWebSocket(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return false;
  }
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    '',
    '',
  ].join('\r\n'));
  return true;
}

module.exports = {
  decodeFrames,
  encodeFrame,
  upgradeToWebSocket,
};
