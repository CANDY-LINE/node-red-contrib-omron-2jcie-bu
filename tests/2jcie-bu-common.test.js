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
    it('should parse the error data packet from 2JCIE-BU in response to "Write" request', async () => {
			const output = await parser.parseResponse(Buffer.from(
				'52420600812150016371',
				'hex'
			));
			console.log(output);
			assert.equal('Read Error', output.status);
			assert.equal(0x81, output.statusCode);
			assert.equal(0x5021, output.address);
			assert.equal('CRC Error', output.error);
			assert.equal(0x01, output.errorCode);
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
			assert.equal('52420500012150f94b', output.toString('hex'));
    });
  });
	describe('#buildReadMountingOrientationRequest()', () => {
    it('should build a Read-Mounting-Orientation request', async () => {
			const output = await builder.buildReadMountingOrientationRequest();
			assert.equal('52420500010254e1b8', output.toString('hex'));
    });
  });
	describe('#buildReadDeviceInformationRequest()', () => {
    it('should build a Read-Device-Information request', async () => {
			const output = await builder.buildReadDeviceInformationRequest();
			assert.equal('52420500010a18e78d', output.toString('hex'));
    });
  });
	describe('#buildWriteLEDSettingsRequest()', () => {
    it('should build a Write-LED-Setting request with the rule: "Temperature"', async () => {
			const output = await builder.buildWriteLEDSettingsRequest({
				displayRule: 'Temperature'
			});
			assert.equal('52420a000211510200000000b3c7', output.toString('hex'));
    });

		it('should build a Write-LED-Setting request with the rule: "ON"', async () => {
			const output = await builder.buildWriteLEDSettingsRequest({
				displayRule: 'ON',
				color: '#0D58C1'
			});
			assert.equal('52420a0002115101000d58c19c54', output.toString('hex'));
    });
  });
});
