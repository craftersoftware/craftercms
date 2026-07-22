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

import { forEach } from '@craftercms/studio-ui/utils/array';
import { Coordinates, DropMarkerPosition, DropMarkerPositionArgs, InRectStats } from '../models/Positioning';
import { LookupTable } from '@craftercms/studio-ui/models/LookupTable';
import { DropZone } from '../models/InContextEditing';
import { ValidationResult } from '@craftercms/studio-ui/models/ContentType';
import { HORIZONTAL, TOLERANCE_PERCENTS, VERTICAL, X_AXIS, Y_AXIS } from './util';
import { CSSProperties } from 'react';
import { ContentTypeDropTarget } from '@craftercms/studio-ui/models/ContentTypeDropTarget';

// Regular click gets triggered even after loooong mouse downs or
// when mousing-down and dragging cursor - without actually being on
// a drag and drop of an element - and then mousing-up some other place.
// This causes the ice zone selection to occur and the UX feels awkward.
// This is a custom click event with a more opinionated click behaviour
// that could be used instead of the regular click. The trade-of is that,
// as is, won't handle preventDefault/stopPropagation correctly as it's a
// delegate on the document (i.e. the event as bubbled all the way up).
// Would need to add additional logic to set the delegation in a way that
// events can still be stopped (see jQuery).
// export function addClickListener(
//   element: HTMLElement | Document,
//   type: string,
//   handler: (e: Event) => any
// ): Subscription {
//   if (element === document) {
//     // TODO: set up as delegate, control event propagation & stopping accordingly
//   }
//
//   const mouseDown$ = fromEvent(element, 'mousedown');
//   const mouseUp$ = fromEvent(element, 'mouseup');
//   return mouseDown$
//     .pipe(
//       switchMap(() => mouseUp$.pipe(takeUntil(interval(300)), take(1))),
//       filter(
//         (e: any) =>
//           e.target.hasAttribute('data-craftercms-model-id') ||
//           forEach(
//             e.path,
//             (el) =>
//               el !== window && el !== document && el.hasAttribute('data-craftercms-model-id')
//                 ? true
//                 : 'continue',
//             false
//           )
//       )
//     )
//     .subscribe(handler);
// }

export function sibling(element: HTMLElement, next: boolean): Element {
	return next ? element.nextElementSibling : element.previousElementSibling;
}

export function getDropMarkerPosition(args: DropMarkerPositionArgs): DropMarkerPosition {
	const {
			// refElement,
			arrangement,
			insertPosition,
			refElementRect,
			nextOrPrevRect
		} = args,
		horizontal = arrangement === HORIZONTAL,
		before = insertPosition === 'before',
		// This vars are just for mental clarity; to work with
		// the right semantics in the code below.
		// If inserting before the element, will be working with
		// the previous element's rect (prev rect). If inserting
		// after, will be working with the next element's rect.
		nextRect = nextOrPrevRect,
		prevRect = nextOrPrevRect;

	// If there is not next/prev rect, no need to account for it
	// in the position calculation - set difference to 0.
	const difference = !nextOrPrevRect
		? 0
		: // Account for whether the previous rect inline with current rect...
			// Only matters when working with horizontally laid-out elements
			horizontal && nextOrPrevRect.top !== refElementRect.top
			? 0
			: // Calculate the middle point between the two adjacent rects.
				// This avoids the drop marker moving by millimeters when switching from
				// inserting after nodes[i] to before node[i+1]
				before
				? // Inserting before
					horizontal
					? // Smaller number fronted to obtain a negative
						// value since wish to subtract from the position
						(prevRect.right - refElementRect.left) / 2
					: (prevRect.bottom - refElementRect.top) / 2
				: // Inserting after
					horizontal
					? // Bigger number fronted to obtain a positive
						// value to add to the position
						(nextRect.left - refElementRect.right) / 2
					: (nextRect.top - refElementRect.bottom) / 2;

	return horizontal
		? {
				height: refElementRect.height,
				top: refElementRect.top,
				left: before ? refElementRect.left + difference : refElementRect.right + difference
			}
		: {
				width: refElementRect.width,
				top: before ? refElementRect.top + difference : refElementRect.bottom + difference,
				left: refElementRect.left
			};
}

export function splitRect(rect: DOMRect, axis: string = X_AXIS): DOMRect[] {
	// x, y, width, height, top, right, bottom, left
	let rect1: any = {},
		rect2: any = {};

	// noinspection DuplicatedCode
	if (axis === X_AXIS) {
		const half = rect.height / 2;

		rect1.x = rect.x;
		rect1.y = rect.y;
		rect1.width = rect.width;
		rect1.height = half;
		rect1.top = rect.top;
		rect1.right = rect.right;
		rect1.bottom = rect.top + half;
		rect1.left = rect.left;

		rect2.x = rect.x;
		rect2.y = rect.y + half;
		rect2.width = rect.width;
		rect2.height = half;
		rect2.top = rect2.y;
		rect2.right = rect.right;
		rect2.bottom = rect.bottom;
		rect2.left = rect.left;
	} else if (axis === Y_AXIS) {
		const half = rect.width / 2;

		rect1.x = rect.x;
		rect1.y = rect.y;
		rect1.width = half;
		rect1.height = rect.height;
		rect1.top = rect.top;
		rect1.right = rect.left + half;
		rect1.bottom = rect.bottom;
		rect1.left = rect.left;

		rect2.x = rect.x + half;
		rect2.y = rect.y;
		rect2.width = half;
		rect2.height = rect.height;
		rect2.top = rect.top;
		rect2.right = rect.right;
		rect2.bottom = rect.bottom;
		rect2.left = rect.left + half;
	} else {
		throw new Error(`Invalid axis suplied. Valid values are "${X_AXIS}" or "${Y_AXIS}".`);
	}
	return [rect1, rect2];
}

export function insertDropMarker({
	$dropMarker,
	insertPosition,
	refElement
}: {
	$dropMarker: JQuery<any>;
	insertPosition: string;
	refElement: HTMLElement | JQuery | string;
}): void {
	if (insertPosition === 'after') {
		$dropMarker.insertAfter(refElement);
	} else {
		$dropMarker.insertBefore(refElement);
	}
}

export function getDistanceBetweenPoints(p1: Coordinates, p2: Coordinates): number {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function findClosestRect(parentRect: DOMRect, subRects: DOMRect[], coordinates: Coordinates): number {
	let //
		index = -1,
		distances = [];

	subRects.forEach((rect, i) => {
		const stats = getInRectStats(rect, coordinates);

		stats.inRect && (index = i);

		distances.push(
			getDistanceBetweenPoints(coordinates, {
				x: rect.left + rect.width / 2,
				y: rect.top + rect.height / 2
			})
		);

		return stats;
	});

	if (index === -1) {
		index = distances.indexOf(Math.min(...distances));
	}

	return index;
}

export function getChildArrangement(children: Element[], childrenRects: DOMRect[], selfRect?: DOMRect): string {
	if (children.length === 0) {
		// If width is big enough, we may assume it may potentially have multiple
		// columns and HORIZONTAL arrangement may be better guess; however,
		// using the larger space to display the drop marker makes it more visible.
		// Vertical arrangement (stacked), will cause the drop marker to be across
		// the X axis, so logic is sort of flipped in the sense that it's said to be
		// vertical so that drop marker displays horizontally
		return selfRect.width > selfRect.height ? VERTICAL : HORIZONTAL;
	}

	let //
		topValues = [],
		alignedTop = false;

	for (let i = 0, l = children.length, topValue, marginTop; i < l; i++) {
		marginTop = parseInt(
			// javascript is kind enough to always provide the value in pixels :)
			getComputedStyle(children[i]).getPropertyValue('margin-top').replace(/px/i, '') || '',
			10
		);

		topValue = childrenRects[i].top - marginTop;

		if (topValues.includes(topValue)) {
			alignedTop = true;
			break;
		} else {
			topValues.push(topValue);
		}
	}

	return alignedTop ? HORIZONTAL : VERTICAL;
}

export function getInRectStats(
	rect: DOMRect,
	coordinates: Coordinates,
	tolerancePercents: Coordinates = TOLERANCE_PERCENTS
): InRectStats {
	const percents = getRelativePointerPositionPercentages(coordinates, rect),
		inRectTop = coordinates.y >= rect.top,
		inRectRight = coordinates.x <= rect.right,
		inRectBottom = coordinates.y <= rect.bottom,
		inRectLeft = coordinates.x >= rect.left,
		inRect = inRectLeft && inRectRight && inRectTop && inRectBottom,
		inInnerRectTop = percents.y >= tolerancePercents.y,
		inInnerRectRight = percents.x <= 100 - tolerancePercents.x,
		inInnerRectBottom = percents.y <= 100 - tolerancePercents.y,
		inInnerRectLeft = percents.x >= tolerancePercents.x,
		inInnerRect =
			inInnerRectLeft && // left
			inInnerRectRight && // right
			inInnerRectTop && // top
			inInnerRectBottom; // bottom

	return {
		inRectTop,
		inRectRight,
		inRectBottom,
		inRectLeft,
		inRect,
		inInnerRectTop,
		inInnerRectRight,
		inInnerRectBottom,
		inInnerRectLeft,
		inInnerRect,
		percents
	};
}

export function getRelativePointerPositionPercentages(mousePosition: Coordinates, rect: DOMRect): Coordinates {
	const x =
			/* mouse X distance from rect left edge */
			((mousePosition.x - rect.left) /
				/* width */
				rect.width) *
			100,
		y =
			/* mouse X distance from rect top edge */
			((mousePosition.y - rect.top) /
				/* height */
				rect.height) *
			100;

	return { x, y };
}

export function isElementInView(element: Element, fullyInView?: boolean): boolean {
	const pageTop = window.scrollY;
	const pageBottom = pageTop + window.innerHeight;
	const elementTop = elementOffset(element).top;
	const elementBottom = elementTop + element.clientHeight;

	if (fullyInView === true) {
		return pageTop < elementTop && pageBottom > elementBottom;
	} else {
		return elementTop <= pageBottom && elementBottom >= pageTop;
	}
}

export function addAnimation(element: Element | HTMLElement, animationClass: string): void {
	const END_EVENT = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
	element.classList.add(animationClass);
	element.addEventListener(
		END_EVENT,
		function () {
			element.classList.remove(animationClass);
		},
		{
			once: true
		}
	);
}

export function scrollToElement(element: Element, scrollElement: string, animate: boolean = false): Element {
	if (!element) {
		return null;
	} else if (!isElementInView(element)) {
		document.querySelector(scrollElement).scrollTo({
			top: elementOffset(element).top - 100,
			behavior: 'smooth'
		});
		if (animate) addAnimation(element, 'craftercms-content-tree-locate');
	} else if (animate) {
		addAnimation(element, 'craftercms-content-tree-locate');
	}
	return element;
}

export function scrollToDropTargets(
	dropTargets: ContentTypeDropTarget[],
	scrollElement: string,
	getElementRegistry: (id: number) => Element
) {
	let elementInView: boolean;
	elementInView = forEach(
		dropTargets,
		({ id }) => {
			let elem = getElementRegistry(id);
			if (isElementInView(elem)) {
				elementInView = true;
				return 'break';
			}
		},
		false
	);
	if (!elementInView) {
		// TODO: Do this relative to the scroll position. Don't move if things are already in viewport. Be smarter.
		let element = getElementRegistry(dropTargets[0].id);
		document.querySelector(scrollElement).scrollTo({
			top: elementOffset(element).top - 100,
			behavior: 'smooth'
		});
	}
}

export function updateDropZoneValidations(
	dropZone: DropZone,
	dropZones: DropZone[],
	validations: LookupTable<ValidationResult>
): DropZone[] {
	const newDropZone = { ...dropZone };
	let newDropZones = [...dropZones];
	newDropZone.validations = validations;
	newDropZones = newDropZones.filter((item) => item.elementRecordId !== newDropZone.elementRecordId);
	newDropZones.push(newDropZone);
	return newDropZones;
}

export function getZoneMarkerStyle(rect: DOMRect, padding: number = 0): CSSProperties {
	return {
		height: rect.height + padding,
		width: rect.width + padding,
		top: rect.top + window.scrollY - padding / 2,
		left: rect.left + window.scrollX - padding / 2
	};
}

export function fadeIn(el: HTMLElement) {
	var op = 0;
	el.style.opacity = `${op}`;
	el.style.display = 'inline-block';

	var timer = setInterval(function () {
		if (op >= 1.0) {
			clearInterval(timer);
		}
		el.style.opacity = `${op}`;
		op = op + 0.1;
	}, 50);
}

export function elementOffset(element: Element) {
	// Position of element relative to document = window scrolling position + position of element relative to screen
	var rec = element.getBoundingClientRect();
	var top = rec.top + window.scrollY;
	var left = rec.left + window.scrollX;
	return { top: top, left: left };
}

export const DRAG_SCROLL_MARGIN = 150;
export const DRAG_SCROLL_STEP = 5; // pixels to scroll per interval
export const DRAG_SCROLL_INTERVAL = 8; // milliseconds between intervals

/**
 * Determines if the given element is one of the primary scroll elements for the entire document.
 *
 * Checks if the element is equal to the document's scrollingElement, documentElement, or body.
 *
 * @param {Element} element - The element to check.
 * @returns {boolean} True if the element represents the document's main scrollable area, false otherwise.
 */
function isDocumentScrollElement(element: Element): boolean {
	return element === document.scrollingElement || element === document.documentElement || element === document.body;
}

/**
 * Returns the nearest scrollable parent element of the provided element.
 *
 * @param {Element} element - The element for which to find the nearest scrollable container.
 * @returns {Element} The closest scrollable parent element, or the document's scrolling element if none are found.
 */
export function getScrollContainer(element: Element): Element {
	let parent = element.parentElement;

	while (parent) {
		const { overflow, overflowY } = getComputedStyle(parent);
		const scrollable = /(auto|scroll)/.test(overflowY) || /(auto|scroll)/.test(overflow);
		if (scrollable && parent.scrollHeight > parent.clientHeight) {
			return parent;
		}
		parent = parent.parentElement;
	}

	return document.scrollingElement ?? document.documentElement;
}

/**
 * Returns the visible bounds (top, bottom, left, right) for drag-scroll detection.
 * If the scroll container is the document, calculates bounds based on the viewport.
 * Otherwise, returns the bounding rect of the scroll container element.
 *
 * @param scrollContainer - Element to use for scrolling
 */
export function getDragScrollBounds(scrollContainer: Element): {
	top: number;
	bottom: number;
	left: number;
	right: number;
} {
	if (isDocumentScrollElement(scrollContainer)) {
		return {
			top: 0,
			bottom: window.innerHeight,
			left: 0,
			right: window.innerWidth
		};
	}

	const rect = scrollContainer.getBoundingClientRect();
	return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
}

/**
 * Scrolls the given container vertically by the specified number of pixels.
 *
 * If the scroll container is the document's scrolling element, this function scrolls the window.
 * Otherwise, it scrolls the provided element by modifying its scrollTop property.
 *
 * @param {Element} scrollContainer - The container element to scroll. This can be a DOM element or the document's scrolling element.
 * @param {number} delta - The number of pixels by which to scroll vertically. Positive values scroll down, negative values scroll up.
 */
export function scrollContainerBy(scrollContainer: Element, delta: number): void {
	if (isDocumentScrollElement(scrollContainer)) {
		window.scrollTo({ top: window.scrollY + delta, behavior: 'auto' });
	} else {
		scrollContainer.scrollTop += delta;
	}
}
