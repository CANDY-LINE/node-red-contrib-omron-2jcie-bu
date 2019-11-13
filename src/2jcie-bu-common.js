/**
 * @license
 * Copyright (c) 2019 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*jslint bitwise: true */

import 'source-map-support/register';

const HEADER = 0x4252; // LE byte order
const RESPONSE_STATUS = {
  0x01: 'Read OK',
  0x02: 'Write OK',
  0x81: 'Read Error',
  0x82: 'Write Error',
  0xFF: 'Unkown'
};
const ERROR_STATUS = {
  0x01: 'CRC Error',
  0x02: 'Command Error',
  0x03: 'Address Error',
  0x04: 'Length Error',
  0x05: 'Data Error',
  0x06: 'Busy'
};
const DISPLAY_RULES = {
  'OFF': 0x0000,
  'ON': 0x0001,
  'Temperature': 0x0002,
  'Humidity': 0x0003,
  'Illuminance': 0x0004,
  'Barometric Pressure': 0x0005,
  'Sound Noise': 0x0006,
  'eTVOC': 0x0007,
  'Vibration': 0x0008 // SI value scales
};

const crc16 = (buf) => {
  let register = 0xffff;
  for (let i = 0; i < buf.length; i++) {
    register ^= buf[i];
    for (let b = 0; b < 8; b++) {
      const lsb = register & 0x0001;
      register = (register >> 1) & 0x7ffff; // 0b0111111111111111
      if (lsb) {
        register ^= 0xa001;
      }
    }
  }
  return register;
};

export class Omron2jcieBuPacketBuilder {

  constructor() {
  }

  buildRequest(payloadBuf) {
    let dataBuf = Buffer.alloc(4);
    dataBuf.writeUInt16LE(HEADER, 0);
    // Payload + CRC length
    dataBuf.writeUInt16LE(payloadBuf.length + 2, 2);
    // Append Payload
    dataBuf = Buffer.concat([dataBuf, payloadBuf]);
    // CRC16
    const crc16Value = crc16(dataBuf);
    const crc16Buf = Buffer.alloc(2);
    crc16Buf.writeUInt16LE(crc16Value, 0);
    dataBuf = Buffer.concat([dataBuf, crc16Buf]);
    return dataBuf;
  }

  buildReadLatestDataLongRequest() {
    const payloadBuf = Buffer.alloc(3);
    payloadBuf[0] = 0x01; // Read
    payloadBuf.writeUInt16LE(0x5021, 1);
    return this.buildRequest(payloadBuf);
  }

  buildReadMountingOrientationRequest() {
    const payloadBuf = Buffer.alloc(3);
    payloadBuf[0] = 0x01; // Read
    payloadBuf.writeUInt16LE(0x5402, 1);
    return this.buildRequest(payloadBuf);
  }

  buildReadDeviceInformationRequest() {
    const payloadBuf = Buffer.alloc(3);
    payloadBuf[0] = 0x01; // Read
    payloadBuf.writeUInt16LE(0x180A, 1);
    return this.buildRequest(payloadBuf);
  }

  buildWriteLEDSettingsRequest({ displayRule, color }) {
    const payloadBuf = Buffer.alloc(8);
    payloadBuf[0] = 0x02; // Write
    payloadBuf.writeUInt16LE(0x5111, 1);
    // Display rule
    payloadBuf.writeUInt16LE(this.resolveDisplayRule(displayRule), 3);
    if (displayRule === 'ON') {
      const colorValue = this.resolveColor(color);
      // LED Color (Red), ignored unless displayRule = 'ON'
      payloadBuf.writeUInt8((colorValue >> 16) & 0xff, 5);
      // LED Color (Green), ignored unless displayRule = 'ON'
      payloadBuf.writeUInt8((colorValue >> 8) & 0xff, 6);
      // LED Color (Blue), ignored unless displayRule = 'ON'
      payloadBuf.writeUInt8(colorValue & 0xff, 7);
    }
    return this.buildRequest(payloadBuf);
  }

  resolveDisplayRule(displayRule) {
    const value = DISPLAY_RULES[displayRule];
    if (!value) {
      return 0x0000; // OFF
    }
    return value;
  }

  resolveColor(color) {
    switch (typeof color) {
      case 'string': {
        if (color.indexOf('#') === 0) {
          return parseInt(color.substring(1), 16);
        }
        return parseInt(color, 16);
      }
      case 'number': {
        return color;
      }
      default: {
        return 0;
      }
    }
  }

}

export class Omron2jcieBuPacketParser {

  constructor(ttl) {
    this.bufferArray = null;
    this.expectedLength = 0;
    this.lastBuffered = 0;
    this.ttl = ttl;
  }

  reset() {
    this.bufferArray = null;
    this.expectedLength = 0;
    this.lastBuffered = 0;
  }

  parseResponse(dataBuf) {
    if (this.expectedLength > 0 && this.ttl && (Date.now() - this.lastBuffered >= this.ttl)) {
      this.reset();
    }
    if (this.expectedLength > 0) {
      this.bufferArray.push(dataBuf);
      this.lastBuffered = Date.now();
    } else {
      // See "Table 70 Common frame format" for the data frame format
      if (!Array.isArray(dataBuf) && !(dataBuf instanceof Buffer)) {
        if (dataBuf && dataBuf.type === 'Buffer' && Array.isArray(dataBuf.data)) {
          dataBuf = Buffer.from(dataBuf.data);
        } else {
          throw new Error(`[FormatError] The passed data buffer must be either int array or Buffer.`);
        }
      }
      if (Array.isArray(dataBuf)) {
        dataBuf = Buffer.from(dataBuf);
      }
      // Process header
      if (dataBuf.readUInt16LE(0) !== HEADER) {
        throw new Error(`[FormatError] Cannot parse the given data. Unsupported format.`);
      }
      this.expectedLength = dataBuf.readUInt16LE(2) + 4; // +4 => Header + CRC16
      this.bufferArray = [dataBuf];
      this.lastBuffered = Date.now();
    }
    const dataBufLen = this.bufferArray.reduce((acc, cur) => acc + cur.length , 0);
    if (dataBufLen === this.expectedLength) {
      const msgBuf = Buffer.concat(this.bufferArray);
      this.reset();
      const crc16ActualIndex = msgBuf.length - 2;
      const payloadBuf = msgBuf.slice(4, crc16ActualIndex);
      const crc16Actual = msgBuf.readUInt16LE(crc16ActualIndex);
      const crc16Expected = crc16(msgBuf.slice(0, crc16ActualIndex));
      if (crc16Expected !== crc16Actual) {
        throw new Error(`[FormatError] CRC16 Check Failed! Expected:0x${crc16Expected.toString(16)}, Actual:0x${crc16Actual.toString(16)}`);
      }
      const output = this.parsePayloadFrame(payloadBuf);
      output.finished = true;
      return output;
    } else {
      return {
        finished: false
      };
    }
  }

  parsePayloadFrame(payloadBuf) {
    const status = payloadBuf[0];
    const address = payloadBuf.readUInt16LE(1);
    const output = {
      status: RESPONSE_STATUS[status],
      statusCode: status,
      address: address,
      data: {}
    };

    const isError = status & 0x80;
    if (isError) {
      const error = payloadBuf[3];
      output.error = ERROR_STATUS[error];
      output.errorCode = error;
      return output;
    }

    switch (address) {
      case 0x5021: {
        // Latest data long
        this.readLatestDataLongFrame(payloadBuf, output.data);
        break;
      }
      case 0x5402: {
        // Mounting orientation
        this.readMountingOrientationFrame(payloadBuf, output.data);
        break;
      }
      case 0x180A: {
        // Device information
        this.readDeviceInformationFrame(payloadBuf, output.data);
        break;
      }
      default: {
        if (status === 0x01) {
          // Unsupported Addresses for 'Read OK status'
          throw new Error(`[IllegalDataError] Unsupported Address.`);
        }
      }
    }
    return output;
  }

  readLatestDataLongFrame(payloadBuf, data) {
    // Sequence number
    data.id = payloadBuf.readUInt8(3);
    // Temperature (degree Celsius)
    data.temperature = payloadBuf.readInt16LE(4) / 100;
    // Humidity (%)
    data.humidity = payloadBuf.readInt16LE(6) / 100;
    // Illuminance (lux)
    data.illuminance = payloadBuf.readInt16LE(8);
    // Barometric Pressure (hPa)
    data.barometricPressure = payloadBuf.readInt32LE(10) / 1000;
    // Sound Noise (dB)
    data.soundNoise = payloadBuf.readInt16LE(14) / 100;
    // eTVOC (ppb)
    data.etvoc = payloadBuf.readInt16LE(16);
    // eCO2 (ppm)
    data.eco2 = payloadBuf.readInt16LE(18);
    // Discomfort Index (DI, Temperature-Humidity Index)
    data.discomfortIndex = payloadBuf.readInt16LE(20) / 100;
    // Heat Stroke (degree Celsius)
    data.heatStroke = payloadBuf.readInt16LE(22) / 100;
    // Vibration Status (`None`, `Vibration Detected`, or `Earthquake Detected`)
    data.vibrationStatus = this.resolveVibrationStatus(payloadBuf.readUInt8(24));
    // Spectral Intensity Value (SI Value in cm/s=kine, for small to medium scale vibration)
    data.spectralIntensity = payloadBuf.readInt16LE(25) / 10;
    // Seismic Intensity Scale of Japan (for larger scale vibration like earthquake)
    data.seismicIntensity = payloadBuf.readInt16LE(29) / 1000;
  }

  resolveVibrationStatus(value) {
    switch (value) {
      case 0x00: {
        return 'None';
      }
      case 0x01: {
        return 'Vibration Detected';
      }
      case 0x02: {
        return 'Earthquake Detected';
      }
      default: {
        return 'Unknown';
      }
    }
  }

  readMountingOrientationFrame(payloadBuf, data) {
    data.position = payloadBuf.readUInt8(3);
  }

  readDeviceInformationFrame(payloadBuf, data) {
    data.model = payloadBuf.slice(3, 13).toString();
    data.serialNumber = payloadBuf.slice(13, 23).toString();
    data.firmwareVersion = payloadBuf.slice(23, 28).toString();
    data.hardwareVersion = payloadBuf.slice(28, 33).toString();
    data.manufacturer = payloadBuf.slice(33, 38).toString();
  }
}
