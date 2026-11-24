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

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Logger, LoggerLevel } from '../../models/Logger';
import { fetchLoggers as fetchLoggersService, setLogger } from '../../services/logs';
import GlobalAppToolbar from '../GlobalAppToolbar';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import LogLevelGrid, { LogLevelGridSkeleton } from './LogLevelGrid';
import { useDispatch } from 'react-redux';
import { showSystemNotification } from '../../state/actions/system';
import Paper from '@mui/material/Paper';
import useDebouncedInput from '../../hooks/useDebouncedInput';
import IconButton from '@mui/material/IconButton';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import Tooltip from '@mui/material/Tooltip';
import { pushErrorDialog } from '../../utils/system';

const messages = defineMessages({
	levelChangedSuccess: {
		id: 'loggingLevelsManagement.levelChangedSuccessMessage',
		defaultMessage: 'Logging level changed successfully'
	}
});

export function LogLevelManagement() {
	const [fetching, setFetching] = useState(false);
	const [filteredLoggers, setFilteredLoggers] = useState<Array<Logger>>(null);
	const [loggerFilter, setLoggerFilter] = useState<string>('');
	const [levelFilter, setLevelFilter] = useState<string>('');
	const filtering$ = useDebouncedInput(() => fnRefs.current.applyFilters());
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const fnRefs = useRef({
		loggers: null as Array<Logger>,
		applyFilters: null as Function,
		fetchLoggers: null as Function
	});

	fnRefs.current.applyFilters = () => {
		const loggers = fnRefs.current.loggers;
		if (loggers) {
			let filtered = loggers;
			const levelQuery = levelFilter.toLocaleLowerCase().trim();
			const loggerQuery = loggerFilter.toLowerCase().trim();
			if (levelQuery || loggerQuery) {
				const filter =
					levelQuery && loggerQuery
						? (logger) =>
								logger.level.toLowerCase().includes(levelQuery) && logger.name.toLowerCase().includes(loggerQuery)
						: levelQuery
							? (logger) => logger.level.toLowerCase().includes(levelQuery)
							: (logger) => logger.name.toLowerCase().includes(loggerQuery);
				filtered = loggers.filter(filter);
			}
			setFilteredLoggers(filtered);
		}
	};

	fnRefs.current.fetchLoggers = () => {
		setFetching(true);
		fetchLoggersService().subscribe({
			next(loggers) {
				fnRefs.current.loggers = loggers;
				fnRefs.current.applyFilters();
				setFetching(false);
			},
			error({ response }) {
				dispatch(pushErrorDialog({ props: { error: response } }));
				setFetching(false);
			}
		});
	};

	useEffect(() => {
		fnRefs.current.fetchLoggers();
	}, []);

	const changeLevel = (logger: Logger, level: LoggerLevel) => {
		setLogger(logger.name, level).subscribe({
			next() {
				fnRefs.current.fetchLoggers();
				dispatch(
					showSystemNotification({
						message: formatMessage(messages.levelChangedSuccess),
						options: { variant: 'success' }
					})
				);
			},
			error(response) {
				dispatch(pushErrorDialog({ props: { error: response } }));
			}
		});
	};

	return (
		<Paper elevation={0}>
			<GlobalAppToolbar
				title={<FormattedMessage id="globalMenu.loggingLevelsEntryLabel" defaultMessage="Logging Levels" />}
				rightContent={
					<Tooltip title={formatMessage({ id: 'word.refresh', defaultMessage: 'Refresh' })}>
						<IconButton
							onClick={() => fnRefs.current.fetchLoggers()}
							aria-label={formatMessage({ id: 'word.refresh', defaultMessage: 'Refresh' })}
						>
							<RefreshRounded />
						</IconButton>
					</Tooltip>
				}
			/>
			{fetching ? (
				<LogLevelGridSkeleton />
			) : (
				filteredLoggers && (
					<LogLevelGrid
						loggerFilter={loggerFilter}
						levelFilter={levelFilter}
						onLoggerFilterChange={(v) => {
							setLoggerFilter(v);
							filtering$.next(v);
						}}
						onLevelFilterChange={(v) => {
							setLevelFilter(v);
							filtering$.next(v);
						}}
						loggers={filteredLoggers}
						onChangeLevel={changeLevel}
					/>
				)
			)}
		</Paper>
	);
}

export default LogLevelManagement;
