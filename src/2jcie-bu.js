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

import 'source-map-support/register';
import { Omron2jcieBuPacketParser, Omron2jcieBuPacketBuilder } from './2jcie-bu-common';

export default function(RED) {

  class Omron2jcieBuInNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.name = n.name;
      this.messageFormat = n.messageFormat || 'standard';
      this.parser = new Omron2jcieBuPacketParser(n.ttl || 10000);
      const formatMessage = (input, output, msg, timestamp) => {
        let result;
        switch (this.messageFormat) {
          case 'standard': {
            msg.payload = Object.assign(output, {
              timestamp
            });
            result = [msg];
            break;
          }
          case 'chart': {
            result = Object.keys(output.data || {}).map(k => {
              if (k === 'id' || typeof output.data[k] !== 'number') {
                return null;
              }
              return {
                topic: k,
                payload: output.data[k],
                timestamp
              };
            }).filter(d => d);
            break;
          }
          default: {
            result = [msg];
          }
        }
        return result;
      };
      this.on('input', msg => {
        try {
          const now = new Date().toISOString();
          const input = msg.payload;
          const output = this.parser.parseResponse(input);
          if (output.finished) {
            switch (output.address) {
              case 0x5021: {
                msg.topic = 'getLatestSensorData';
                break;
              }
              case 0x5402: {
                msg.topic = 'getMountingOrientation';
                break;
              }
              case 0x180A: {
                msg.topic = 'getDeviceInformation';
                break;
              }
              case 0x5111: {
                msg.topic = 'setLED';
                break;
              }
              default: {}
            }
            const result = formatMessage(input, output, msg, now);
            result.forEach(r => {
              this.send(r);
            });
          }
        } catch (e) {
          this.error(e);
        }
      });
    }
  }
  RED.nodes.registerType('2JCIE-BU in', Omron2jcieBuInNode);

  class Omron2jcieBuOutNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.name = n.name;
      this.builder = new Omron2jcieBuPacketBuilder();
      this.on('input', msg => {
        let packet;
        const { topic, payload } = msg;
        try {
          switch (topic) {
            case 'getLatestSensorData': {
              packet = this.builder.buildReadLatestDataLongRequest();
              break;
            }
            case 'getMountingOrientation': {
              packet = this.builder.buildReadMountingOrientationRequest();
              break;
            }
            case 'getDeviceInformation': {
              packet = this.builder.buildReadDeviceInformationRequest();
              break;
            }
            case 'setLED': {
              packet = this.builder.buildWriteLEDSettingsRequest(payload);
              break;
            }
            default: {
              throw new Error(`Unknown command: ${topic}`);
            }
          }
          msg.payload = packet;
          this.send(msg);
        } catch (e) {
          this.error(e);
        }
      });
    }
  }
  RED.nodes.registerType('2JCIE-BU out', Omron2jcieBuOutNode);

}
