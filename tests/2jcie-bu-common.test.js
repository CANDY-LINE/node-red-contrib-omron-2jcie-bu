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
import * as sinon from 'sinon';
import { assert } from 'chai';
import { Omron2jcieBuPacketParser, Omron2jcieBuPacketBuilder } from './2jcie-bu-common';

describe('Omron2jcieBuPacketParser', () => {
	let sandbox;
	let parser;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		parser = new Omron2jcieBuPacketParser();
	});
	afterEach(() => {
		sandbox = sandbox.restore();
	});
  describe('#parseResponse()', () => {
		it('should parse the error data packet from 2JCIE-BU in response to "Read" request', async () => {
			const output = await parser.parseResponse(Buffer.from(
				'5242060081215001237A',
				'hex'
			));
			assert.equal(output.status, 'Read Error');
			assert.equal(output.statusCode, 0x81);
			assert.equal(output.address, 0x5021);
			assert.equal(output.error, 'CRC Error');
			assert.equal(output.errorCode, 0x01);
    });
    it('should parse the error data packet from 2JCIE-BU in response to "Write" request', async () => {
			const output = await parser.parseResponse(Buffer.from(
				'5242060082215001233E',
				'hex'
			));
			assert.equal(output.status, 'Write Error');
			assert.equal(output.statusCode, 0x82);
			assert.equal(output.address, 0x5021);
			assert.equal(output.error, 'CRC Error');
			assert.equal(output.errorCode, 0x01);
    });

		it('should parse the long sensor data packet from 2JCIE-BU in response to "Read" request', async () => {
			const output = await parser.parseResponse(Buffer.from(
				'524236000121503729075c1d5b00fe4b0f004d1c000090010319670700000000000000000000000000000000000000000000000000000000d632',
				'hex'
			));
			console.log(output);
			assert.equal(output.status, 'Read OK');
			assert.equal(output.statusCode, 0x01);
			assert.equal(output.address, 0x5021);
			assert.closeTo(output.data.temperature, 18.33, 0.01);
			assert.equal(output.data.eco2, 400);
    });

		it('should parse the separated long sensor data packet from 2JCIE-BU in response to "Read" request', async () => {
			const msg1 = Buffer.from(
				'524236000121503729075c1d5b00fe4b0f004d1c0000900103196707000000',
				'hex'
			);
			const msg2 = Buffer.from(
				'00000000000000000000000000000000000000000000000000d632',
				'hex'
			);
			const output1 = await parser.parseResponse(msg1);
			assert.isFalse(output1.finished);
			const output2 = await parser.parseResponse(msg2);
			assert.isTrue(output2.finished);
			assert.equal(output2.status, 'Read OK');
			assert.equal(output2.statusCode, 0x01);
			assert.equal(output2.address, 0x5021);
			assert.closeTo(output2.data.temperature, 18.33, 0.01);
			assert.equal(output2.data.eco2, 400);
    });
  });
});

describe('Omron2jcieBuPacketBuilder', () => {
	let sandbox;
	let builder;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		builder = new Omron2jcieBuPacketBuilder();
	});
	afterEach(() => {
		sandbox = sandbox.restore();
	});
  describe('#buildReadLatestDataLongRequest()', () => {
    it('should build a Read-Latest-Data-Long request', async () => {
			const output = await builder.buildReadLatestDataLongRequest();
			assert.equal(output.toString('hex'), '52420500012150e24b');
    });
  });
	describe('#buildReadMountingOrientationRequest()', () => {
    it('should build a Read-Mounting-Orientation request', async () => {
			const output = await builder.buildReadMountingOrientationRequest();
			assert.equal(output.toString('hex'), '52420500010254fab8');
    });
  });
	describe('#buildReadDeviceInformationRequest()', () => {
    it('should build a Read-Device-Information request', async () => {
			const output = await builder.buildReadDeviceInformationRequest();
			assert.equal(output.toString('hex'), '52420500010a18fc8d');
    });
  });
	describe('#buildWriteLEDSettingsRequest()', () => {
    it('should build a Write-LED-Setting request with the rule: "Temperature"', async () => {
			const output = await builder.buildWriteLEDSettingsRequest({
				displayRule: 'Temperature'
			});
			assert.equal(output.toString('hex'), '52420a000211510200000000d7c5');
    });

		it('should build a Write-LED-Setting request with the rule: "ON"', async () => {
			const output = await builder.buildWriteLEDSettingsRequest({
				displayRule: 'ON',
				color: '#0D58C1'
			});
			assert.equal(output.toString('hex'), '52420a0002115101000d58c1f856');
    });
  });
});
