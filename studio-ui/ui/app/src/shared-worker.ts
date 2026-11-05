/// <reference lib="webworker" />

import { obtainAuthToken, ObtainAuthTokenResponse } from './services/auth';
import StandardAction from './models/StandardAction';
import {
	logout,
	refreshAuthToken,
	sharedWorkerConnect,
	sharedWorkerDisconnect,
	sharedWorkerError,
	sharedWorkerExtendSession,
	sharedWorkerTimeout,
	sharedWorkerToken,
	sharedWorkerUnauthenticated
} from './state/actions/auth';
import { AjaxError } from 'rxjs/ajax';
import { SESSION_TIMEOUT_WARNING_MS, SHARED_WORKER_NAME, XSRF_TOKEN_HEADER_NAME } from './utils/constants';
import { Client, StompSubscription } from '@stomp/stompjs';
import {
	closeSiteSocket,
	configurationEvent,
	contentEvent,
	deleteContentEvent,
	deleteContentEvents,
	emitSystemEvent,
	emitSystemEvents,
	globalSocketStatus,
	lockContentEvent,
	moveContentEvent,
	openSiteSocket,
	publishEvent,
	repositoryEvent,
	siteSocketStatus,
	workflowEventApprove,
	workflowEventCancel,
	workflowEventDirectPublish,
	workflowEventReject,
	workflowEventSubmit
} from './state/actions/system';
import SocketEvent, {
	DeleteContentEventsPayload,
	LockContentEventPayload,
	MoveContentEventPayload
} from './models/SocketEvent';
import { withIndex, withoutIndex } from './utils/path';

declare const self: SharedWorkerGlobalScope;

export type SharedWorkerStatus = '' | 'active' | 'expired' | 'error';

const refreshAtFactor = 0.5;
// The server removes expired sessions once a minute, so they can outlive `sessionExpiresAt` by up to that long.
const sessionCleanupGraceMs = 61 * 1000;
let clients: MessagePort[] = [];
let status: SharedWorkerStatus = '';
let timeout: number;
let current: ObtainAuthTokenResponse = {
	expiresAt: null,
	token: null
};
let refreshInterval;
let isRetrieving = false;
let isProduction = process.env.PRODUCTION !== 'development';
let siteSocketClient: Client;
let rootSocketClient: Client;

const log = !isProduction ? (message, ...args) => console.log(`%c${message}`, 'color: #0071A4', ...args) : () => void 0;

function onmessage(event) {
	log('Message received from page', event.data);
	if (self.name !== SHARED_WORKER_NAME) {
		// Using name as an additional security mechanism
		return;
	}
	const type = event.data?.type;
	switch (type) {
		// A new app window has connected to the worker.
		case sharedWorkerConnect.type:
			log(`A client has connected. Status is "${status}"`);
			const xsrfToken = event.data.payload?.xsrfToken;
			// There's a sharedWorker connection from studio and from XB, we only open the root topic socket when connecting
			// from studio.
			if (xsrfToken) {
				// Open the root topic socket.
				openSocket({ site: null, xsrfToken: event.data.payload.xsrfToken });
			}
			if (status === 'active') {
				event.target.postMessage(sharedWorkerToken(current));
			} /* else if (status === 'error' || status === 'expired' || status === '') */ else {
				// If an error occurred or auth expired, need to retry/retrieve upon new connections.
				// Otherwise, the worker may end up staying 'dirty' when one tab expires, dies and
				// another comes in later after having logged in properly.
				clearCurrent();
				retrieve();
			}
			break;
		// After login (from session timeout), the app sends this event for the worker to
		// get a fresh token and continue session.
		case refreshAuthToken.type:
			log('App requested token refresh');
			clearCurrent();
			openSocket({ site: null, xsrfToken: event.data.payload.xsrfToken });
			retrieve();
			break;
		// The user chose to stay signed in from the session timeout warning.
		case sharedWorkerExtendSession.type:
			log('App requested to extend the session');
			retrieve(true);
			break;
		// The user logged out.
		case logout.type:
		// The app received a 401 and it's reporting the session timeout.
		// eslint-disable-next-line no-fallthrough
		case sharedWorkerTimeout.type:
			if (type === logout.type) {
				log('User has logged out');
			} else {
				log('App reported session timeout');
			}
			clearCurrent();
			unauthenticated(event.target);
			break;
		// An app window disconnected from the worker.
		case sharedWorkerDisconnect.type:
			log('Client disconnected');
			clients = clients.filter((client) => client !== event.target);
			break;
		case openSiteSocket.type:
			openSocket(event.data.payload);
			break;
		case closeSiteSocket.type:
			closeSocket(event.data.payload.site);
			break;
		default:
			log(`Received unknown action: "${type}"`);
			break;
	}
}

function clearCurrent() {
	status = '';
	current.token = null;
	current.expiresAt = null;
}

function isExpired(time = Date.now()) {
	return current.expiresAt !== null && time >= current.expiresAt;
}

function unauthenticated(excludeClient?: MessagePort) {
	log(`Auth has expired.`);
	clearTimeout(timeout);
	status = 'expired';
	siteSocketClient?.deactivate();
	rootSocketClient?.deactivate();
	broadcast(sharedWorkerUnauthenticated(), excludeClient);
}

// Besides the regular refresh, checks the session again when the warning is due (so tabs warn based on up to date
// information as the session may have been extended by activity) and after it should have expired.
function getNextRefreshDelay() {
	if (current.sessionExpiresAt) {
		const now = Date.now();
		// The extra second guarantees tabs see the session as inside the warning window even if the timer fires early.
		const checkpoints = [
			current.sessionExpiresAt - SESSION_TIMEOUT_WARNING_MS + 1000,
			current.sessionExpiresAt + sessionCleanupGraceMs
		].filter((checkpoint) => checkpoint > now);
		if (checkpoints.length) {
			return Math.min(refreshInterval, checkpoints[0] - now);
		}
	}
	return refreshInterval;
}

let retries = 0;
function retrieve(extendSession = false) {
	clearTimeout(timeout);
	if (!isRetrieving) {
		isRetrieving = true;
		return obtainAuthToken(extendSession).subscribe({
			next(response) {
				retries = 0;
				isRetrieving = false;
				if (response) {
					log('New token received');
					status = 'active';
					current = response;
					broadcast(sharedWorkerToken(current));
					refreshInterval = Math.floor((current.expiresAt - Date.now()) * refreshAtFactor);
					if (clients.length) {
						// If there are clients connected, keep the token refresh going
						timeout = self.setTimeout(retrieve, getNextRefreshDelay());
					} else {
						// Do SharedWorkers stop as soon as all their tabs are terminated?
						clearTimeout(timeout);
					}
				} else {
					unauthenticated();
				}
				return current;
			},
			error(e: AjaxError) {
				isRetrieving = false;
				clearTimeout(timeout);
				log('Error retrieving token', e);
				if (e.status === 401) {
					retries = 0;
					unauthenticated();
				} else {
					status = 'error';
					broadcast(sharedWorkerError({ status: e.status, message: e.message }));
					// If there are clients connected try again.
					if (clients.length && retries++ < 3) {
						timeout = self.setTimeout(retrieve, Math.floor(refreshInterval * 0.9));
					}
				}
			}
		});
	}
}

function broadcast(message: StandardAction, excludedClient?: MessagePort) {
	(excludedClient ? clients.filter((client) => client !== excludedClient) : clients).forEach((client) => {
		client.postMessage(message);
	});
}

function broadcastSocketConnection(connected: boolean, siteId: string = null) {
	broadcast(siteId ? siteSocketStatus({ siteId, connected }) : globalSocketStatus({ connected }));
}

function openSocket({ site, xsrfToken }) {
	let isSiteSocket = !!site;
	let socketClient = isSiteSocket ? siteSocketClient : rootSocketClient;
	socketClient?.deactivate();
	let subscription: StompSubscription;
	let protocol = self.location.protocol === 'https:' ? 'wss' : 'ws';
	socketClient = new Client({
		brokerURL: `${protocol}://${isProduction ? self.location.host : 'localhost:8080'}/studio/events`,
		...(!isProduction && { debug: log }),
		connectHeaders: { [XSRF_TOKEN_HEADER_NAME]: xsrfToken },
		onConnect() {
			broadcastSocketConnection(true, site);
			const topicUrl = isSiteSocket ? `/topic/studio/${site}` : '/topic/studio';
			const packageEvent = (payload: SocketEvent): StandardAction => ({ type: payload.eventType, payload });
			// region Event Deduping
			/* * */
			// Notes:
			//  - Consider a second level deduping based on throttling at the widget level.
			//  - Most events that come close, come less than 100ms apart. But over a second has been observed between, for instance, the delete and the subsequent workflow event (1.4s) or up to 2.4 between move and repository events.
			//  - Bulk upload typically uploads to the same folder, so the effect is refreshing the parent & fetching its children. Could be "deduped"?
			//  - It would be possible to consider publishEvent, repositoryEvent, workflowEvent the same event, but not doing that since different parts of the UI might be listening to them specifically. Adjust the rest of the UI to use these interchangeably?
			//  - A delete event is followed by a "workflow", "repository" and "publish" events. Even various objects or a whole tree (folder) will trigger these events only once. But would need to ensure they are used interchangeably across the UI.
			//  - A move event is followed by a "repository" event (2469ms delta).
			//  - Don't think there would ever be identical move, lock or config events.
			//  - Move is inconsistent with delete in the sense that an event is not triggered for each move in the tree.
			//  - The delete event is not triggered for both the index.xml and the folder, unlike the content event.
			//  - Deleting a folder, will trigger an individual event for every child.
			const maxCycles: number = 5;
			const waitTime: number = 120;
			let eventIndex: Record<string, number> = {};
			let eventQueue: SocketEvent[] = [];
			let eventReceived: boolean = false;
			let cycles: number = 0;
			let intervalStarted: boolean = false;
			let intervalRef: NodeJS.Timeout;
			const generateKey = (event: SocketEvent): string => {
				let keyBase = `${event.eventType}:`;
				switch (event.eventType) {
					case contentEvent.type:
						// It is unknown if event is for a folder or page at this point. Can't apply withIndex/withoutIndex here.
						return `${keyBase}${event.targetPath}`;
					case moveContentEvent.type:
						return `${keyBase}${(event as MoveContentEventPayload).sourcePath}-${event.targetPath}`;
					case lockContentEvent.type:
						return `${keyBase}${event.targetPath}-${(event as LockContentEventPayload).locked}`;
					case deleteContentEvent.type:
						return `${keyBase}${event.targetPath}`;
					case configurationEvent.type:
						return `${keyBase}${event.targetPath}`;
					case publishEvent.type:
					case repositoryEvent.type:
					case workflowEventSubmit.type:
					case workflowEventDirectPublish.type:
					case workflowEventApprove.type:
					case workflowEventReject.type:
					case workflowEventCancel.type:
					default:
						return keyBase;
				}
			};
			const addToQueue = (newEvent: SocketEvent): void => {
				let key = generateKey(newEvent);
				let logicalDupeFound = key in eventIndex;
				if (!logicalDupeFound) {
					if (newEvent.eventType === contentEvent.type) {
						if (
							// - Updating a config file through the UI triggers both a content and config events.
							//   Will drop the content event and let the config event flow.
							newEvent.targetPath.startsWith('/config')
						) {
							logicalDupeFound = true;
						} else if (
							// - A page creation triggers 2 content events (folder and index). Their effect on the UI is virtually the same
							//   but want the path with index.xml to prevail but if the folder event came in first it would be the one on the queue.
							newEvent.targetPath.endsWith('/index.xml')
						) {
							// TODO: Don't like that this requires knowledge of the key generation logic.
							//  Alternatively, putting this on the key generator would make that function have multiple responsibilities.
							// auxKey would contain the key for the folder event.
							let auxKey = generateKey({ ...newEvent, targetPath: withoutIndex(newEvent.targetPath) });
							// The event for the folder is already in the queue, want the page.
							if (auxKey in eventIndex) {
								const folderEventIndex = eventIndex[auxKey];
								eventQueue[folderEventIndex] = newEvent;
								eventIndex[key] = folderEventIndex;
								logicalDupeFound = true;
							}
						} /* targetPath doesn't end with `index.xml` */ else {
							let auxKey = generateKey({ ...newEvent, targetPath: withIndex(newEvent.targetPath) });
							// The event for the page is already in the queue.
							logicalDupeFound = auxKey in eventIndex;
							// If the index is already in, index folder event to detect future dups.
							if (logicalDupeFound) eventIndex[key] = eventIndex[auxKey];
						}
					} else if (newEvent.eventType === deleteContentEvent.type) {
						const newKey = deleteContentEvents.type;
						// TODO: Perhaps should convert the back to bulk events for most/all events? (i.e. targetPath => targetPaths)
						// Not sure if we can dedupe these.
						// - Currently, Preview, Navigators, Dashlets and state cache need to react to items being deleted.
						// - Sending only some can cause issues or too much additional checking.
						if (deleteContentEvents.type in eventIndex) {
							const batchedDeleteIndexInQueue = eventIndex[newKey];
							const batchedDeleteEvent = eventQueue[batchedDeleteIndexInQueue] as DeleteContentEventsPayload;
							batchedDeleteEvent.targetPaths.push(newEvent.targetPath);
							// Register the existence of this key in the index.
							eventIndex[key] = batchedDeleteIndexInQueue;
							logicalDupeFound = true; // This is already in the queue...
							eventReceived = true; // ...but we did receive & add an event.
						} else {
							newEvent = deleteContentEvents({
								...newEvent,
								eventType: deleteContentEvents.type,
								targetPaths: [newEvent.targetPath]
							}).payload;
							delete newEvent.targetPath;
							// Index this delete event. Below, the batched event containing this one will be pushed to the queue (in pos length-1).
							eventIndex[key] = eventQueue.length;
						}
						key = deleteContentEvents.type;
					}
				}
				if (!logicalDupeFound) {
					eventQueue.push(newEvent);
					eventIndex[key] = eventQueue.length - 1;
					eventReceived = true;
				}
				if (!intervalStarted) {
					intervalStarted = true;
					intervalRef = setInterval(() => {
						if (cycles >= maxCycles || !eventReceived) {
							const events = eventQueue.map(packageEvent);
							events.length &&
								broadcast(events.length > 1 ? emitSystemEvents({ siteId: site, events }) : emitSystemEvent(events[0]));
							// Clear timer
							intervalStarted = false;
							clearInterval(intervalRef);
							// Reset queue.
							eventQueue = [];
							eventIndex = {};
							// Reset cycles.
							cycles = 0;
						} else {
							cycles++;
							// An event was received, but we're not done with our cycles, reset events received.
							eventReceived = false;
						}
					}, waitTime);
				}
			};
			// endregion
			subscription = socketClient.subscribe(topicUrl, (message) => {
				if (!message.body) {
					return log('Received an empty message from websocket.');
				} else if (message.headers['content-type'] !== 'application/json') {
					return log(
						`Received an non-json message from websocket. Content type header value was ${message.headers['content-type']}`
					);
				}
				const payload: SocketEvent = JSON.parse(message.body);
				// Deduping only ran for site events.
				if (isSiteSocket) {
					addToQueue(payload);
				} else {
					broadcast(emitSystemEvent(packageEvent(payload)));
				}
			});
		},
		onStompError() {
			// Will be invoked in case of error encountered at Broker
			// Bad login/passcode typically will cause an error
			broadcastSocketConnection(false, site);
		},
		onWebSocketError() {
			broadcastSocketConnection(false, site);
		},
		onDisconnect() {
			subscription?.unsubscribe();
			log(isSiteSocket ? `Site socket for "${site}" disconnected` : 'Global socket disconnected');
		}
	});
	socketClient.activate();
	if (isSiteSocket) {
		siteSocketClient = socketClient;
	} else {
		rootSocketClient = socketClient;
	}
}

function closeSocket(siteId?: string) {
	if (siteId) {
		siteSocketClient?.deactivate();
		siteSocketClient = null;
		broadcastSocketConnection(false, siteId);
	} else {
		rootSocketClient?.deactivate();
		rootSocketClient = null;
		broadcastSocketConnection(false);
	}
}

self.onconnect = (e) => {
	const port = e.ports[0];
	clients.push(port);
	port.onmessage = onmessage;
};
