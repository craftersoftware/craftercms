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

import React, { useEffect, useState } from 'react';
import { Logger, LoggerLevel } from '../../../models/Logger';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import GlobalAppGridRow from '../../GlobalAppGridRow';
import GlobalAppGridCell from '../../GlobalAppGridCell';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { capitalize } from '@mui/material';
import { LightbulbOutlined, WarningRounded } from '@mui/icons-material';
import FormHelperText from '@mui/material/FormHelperText';
import EmptyState from '../../EmptyState';
import Box from '@mui/material/Box';

export interface LoggingLevelsGridUIProps {
	loggers: Array<Logger>;
	loggerFilter?: string;
	levelFilter?: string;
	onLoggerFilterChange?(value: string): void;
	onLevelFilterChange?(value: string): void;
	onChangeLevel(logger: Logger, level: LoggerLevel): void;
}

const levels: LoggerLevel[] = ['off', 'error', 'warn', 'info', 'debug', 'trace', 'all'];
const capitalizedLevels = levels.map(capitalize) as LoggerLevel[];

const CHUNK_SIZE = 30;

export function LogLevelGrid(props: LoggingLevelsGridUIProps) {
	const {
		loggers,
		onChangeLevel,
		onLoggerFilterChange,
		onLevelFilterChange,
		loggerFilter = '',
		levelFilter = ''
	} = props;
	const [displayAll, setDisplayAll] = useState(false);
	const onShowAllClick = () => setDisplayAll(true);
	useEffect(() => {
		if (loggers) {
			setDisplayAll(loggers.length <= CHUNK_SIZE);
		}
	}, [loggers]);
	return (
        <section>
            <TableContainer>
				<Table sx={{ tableLayout: 'fixed' }}>
					<TableHead>
						<GlobalAppGridRow className="hoverDisabled">
							<GlobalAppGridCell className="width50">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.logger" defaultMessage="Logger" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell>
								<Typography variant="subtitle2">
									<FormattedMessage id="loggingLevels.changeLevelTo" defaultMessage="Current Level" />
								</Typography>
							</GlobalAppGridCell>
						</GlobalAppGridRow>
						{(onLoggerFilterChange || onLevelFilterChange) && (
							<GlobalAppGridRow className="hoverDisabled">
								{onLoggerFilterChange && (
									<GlobalAppGridCell>
										<TextField
											autoFocus
											fullWidth
											label={<FormattedMessage id="loggingLevels.loggersFilterLabel" defaultMessage="Logger filter" />}
											size="small"
											value={loggerFilter}
											onChange={(e) => onLoggerFilterChange(e.target.value)}
										/>
									</GlobalAppGridCell>
								)}
								{onLevelFilterChange && (
									<GlobalAppGridCell>
										<Select
											fullWidth
											label={<FormattedMessage id="loggingLevels.levelFilterLabel" defaultMessage="Level filter" />}
											value={levelFilter}
											size="small"
											variant="outlined"
											displayEmpty
											onChange={(e) => {
												onLevelFilterChange(e.target.value);
											}}
										>
											<MenuItem key="empty" value="">
												<FormattedMessage id="loggingLevels.levelFilterSelectEmptyLabel" defaultMessage="Any level" />
											</MenuItem>
											{levels.map((level, index) => (
												<MenuItem key={level} value={level}>
													{capitalizedLevels[index]}
												</MenuItem>
											))}
										</Select>
									</GlobalAppGridCell>
								)}
							</GlobalAppGridRow>
						)}
					</TableHead>
					<TableBody>
						{loggers.length === 0 && (
							<GlobalAppGridCell colSpan={2}>
								<EmptyState title="No loggers to display" />
							</GlobalAppGridCell>
						)}
						{(displayAll ? loggers : loggers.slice(0, 30)).map((logger) => (
							<GlobalAppGridRow key={logger.name} className="hoverDisabled">
								<GlobalAppGridCell align="left" title={logger.name} className="ellipsis">
									{logger.name}
								</GlobalAppGridCell>
								<GlobalAppGridCell align="left" className="action scroll-x">
									<ButtonGroup disableElevation variant="outlined">
										{levels.map((level, index) => (
											<Button
												key={level}
												sx={{
													bgcolor: logger.level === level ? 'primary.main' : undefined,
													color: logger.level === level ? 'primary.contrastText' : undefined,
													'&:hover':
														logger.level === level
															? {
																	bgcolor: 'primary.main',
																	color: 'primary.contrastText'
																}
															: undefined
												}}
												onClick={() => {
													logger.level !== level && onChangeLevel(logger, level);
												}}
											>
												{capitalizedLevels[index]}
											</Button>
										))}
									</ButtonGroup>
								</GlobalAppGridCell>
							</GlobalAppGridRow>
						))}
						{!displayAll && (
							<GlobalAppGridRow className="hoverDisabled">
								<GlobalAppGridCell colSpan={2}>
									<Box sx={{
                                        display: "flex"
                                    }}>
										<Button onClick={onShowAllClick} startIcon={<WarningRounded />} variant="outlined" color="warning">
											<FormattedMessage
												id="loggingLevels.displayAllEntriesButtonLabel"
												defaultMessage="Display {remaining} more entries"
												values={{ remaining: loggers.length - CHUNK_SIZE }}
											/>
										</Button>
										<FormHelperText sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
											<LightbulbOutlined color="info" />
											<FormattedMessage
												id="loggingLevels.avoidDisplayingAllEntriesLabel"
												defaultMessage="Try filtering instead"
											/>
										</FormHelperText>
									</Box>
								</GlobalAppGridCell>
							</GlobalAppGridRow>
						)}
					</TableBody>
				</Table>
			</TableContainer>
        </section>
    );
}

export default LogLevelGrid;
