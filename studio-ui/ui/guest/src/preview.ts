/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { message$, post } from './utils/communicator';
import { guestCheckIn, guestCheckOut, navigationRequest } from '@craftercms/studio-ui/state/actions/preview';
import { createLocationArgument } from './utils/util';
import { fadeIn } from './utils/dom';

message$.subscribe(function ({ type, payload }) {
	switch (type) {
		case navigationRequest.type: {
			window.location.href = payload.url;
			break;
		}
	}
});

const location = createLocationArgument();

post(guestCheckIn.type, { location, __CRAFTERCMS_GUEST_LANDING__: true, version: process.env.VERSION });

setTimeout(() => {
	document.querySelectorAll('img').forEach((img) => {
		fadeIn(img);
	});
}, 700);

window.addEventListener('pagehide', () => {
	console.log('pagehide');
	post(guestCheckOut.type);
});
