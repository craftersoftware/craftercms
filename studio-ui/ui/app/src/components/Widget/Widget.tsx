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

import React, { ComponentType, ElementType, lazy, memo } from 'react';
import NonReactWidget from '../NonReactWidget/NonReactWidget';
import { buildFileUrl, importPlugin } from '../../services/plugin';
import { components } from '../../utils/constants';
import EmptyState from '../EmptyState/EmptyState';
import { defineMessages, useIntl } from 'react-intl';
import ErrorState from '../ErrorState';
import { isValidElementType } from 'react-is';
import WidgetDescriptor from '../../models/WidgetDescriptor';
import NonReactWidgetRecord from '../../models/NonReactWidgetRecord';

export interface WidgetProps extends WidgetDescriptor {
	/** Props applied to all widgets; supersedes widget props. */
	overrideProps?: object;
	/** Props applied to all widgets. Widget props supersede defaultProps. */
	defaultProps?: object;
	/** Heading element for the not-found and plugin-failed fallbacks. Defaults to the EmptyState/ErrorState h3. */
	fallbackTitleComponent?: ElementType;
}

const messages = defineMessages({
	componentNotFoundTitle: {
		id: 'widgetComponent.componentNotFoundTitle',
		defaultMessage: 'Component {id} not found.'
	},
	componentNotFoundSubtitle: {
		id: 'widgetComponent.componentNotFoundSubtitle',
		defaultMessage: "Check ui config & make sure you've installed the plugins that contain the desired components."
	},
	pluginLoadFailedMessageTitle: {
		id: 'widgetComponent.pluginLoadFailedMessageTitle',
		defaultMessage: 'Plugin load failed'
	},
	pluginLoadFailedMessageBody: {
		id: 'widgetComponent.pluginLoadFailedMessageBody',
		defaultMessage: 'With {info} & component id "{id}".'
	}
});

const cache: Record<string, ComponentType<WidgetProps>> = {};

const Widget = memo<WidgetProps>(function (props) {
	const { id, plugin, configuration, fallbackTitleComponent } = props;
	const record = components.get(id);
	const { formatMessage } = useIntl();
	if (record) {
		if (isValidElementType(record)) {
			const Component = record as ElementType;
			return <Component {...{ ...props.defaultProps, ...configuration, ...props.overrideProps }} />;
		} else {
			return (
				<NonReactWidget
					widget={record as NonReactWidgetRecord}
					configuration={{ ...props.defaultProps, ...configuration, ...props.overrideProps }}
				/>
			);
		}
	} else if (!plugin) {
		return (
			<EmptyState
				title={formatMessage(messages.componentNotFoundTitle, { id })}
				subtitle={formatMessage(messages.componentNotFoundSubtitle)}
				titleComponent={fallbackTitleComponent}
				sxs={{ image: { width: 100 } }}
			/>
		);
	} else {
		let Component;
		const fileUrl = buildFileUrl(plugin);
		if (fileUrl in cache) {
			Component = cache[fileUrl];
		} else {
			cache[fileUrl] = Component = lazy<ComponentType<WidgetProps>>(() =>
				importPlugin(plugin).then(
					() => ({
						default: function (props) {
							if (components.has(id)) {
								return <Widget {...props} />;
							} else {
								return (
									<EmptyState
										title={formatMessage(messages.componentNotFoundTitle, { id })}
										subtitle={formatMessage(messages.componentNotFoundSubtitle)}
										titleComponent={props.fallbackTitleComponent}
										sxs={{ image: { width: 100 } }}
									/>
								);
							}
						}
					}),
					(error) => {
						console.error(error);
						return {
							default: function ({ id, plugin, fallbackTitleComponent }: WidgetProps) {
								return (
									<ErrorState
										sxs={{ image: { width: 100 } }}
										title={formatMessage(messages.pluginLoadFailedMessageTitle)}
										titleComponent={fallbackTitleComponent}
										message={formatMessage(messages.pluginLoadFailedMessageBody, {
											id,
											info: Object.entries(plugin)
												.map(([key, value]) => `${key} "${value}"`)
												.join(', ')
										})}
									/>
								);
							}
						};
					}
				)
			);
		}
		return <Component {...props} />;
	}
});

export { Widget };

export default Widget;
