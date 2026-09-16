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

import React from 'react';
import { LogEvent } from '../../models/monitoring/LogEvent';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import GlobalAppGridRow from '../GlobalAppGridRow';
import GlobalAppGridCell from '../GlobalAppGridCell';
import Typography from '@mui/material/Typography';
import { FormattedMessage, useIntl } from 'react-intl';
import TableBody from '@mui/material/TableBody';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { IconButton } from '@mui/material';
import { useSelection } from '../../hooks/useSelection';

interface LogConsoleGridUIProps {
	logEvents: LogEvent[];
	showSiteColumn?: boolean;
	onLogEventDetails(logEvent: LogEvent): void;
}

export function LogConsoleGridUI(props: LogConsoleGridUIProps) {
	const { logEvents, onLogEventDetails, showSiteColumn } = props;
	const localeBranch = useSelection((state) => state.uiConfig.locale);
	const { formatMessage } = useIntl();
	return (
		<TableContainer>
			<Table>
				<TableHead>
					<GlobalAppGridRow className="hoverDisabled">
						<GlobalAppGridCell align="left" className="width10">
							<Typography variant="subtitle2">
								<FormattedMessage id="words.level" defaultMessage="Level" />
							</Typography>
						</GlobalAppGridCell>
						<GlobalAppGridCell align="left" className="width15">
							<Typography variant="subtitle2">
								<FormattedMessage id="words.timestamp" defaultMessage="Timestamp" />
							</Typography>
						</GlobalAppGridCell>
						<GlobalAppGridCell align="left" className="width15">
							<Typography variant="subtitle2">
								<FormattedMessage id="words.thread" defaultMessage="Thread" />
							</Typography>
						</GlobalAppGridCell>
						{showSiteColumn && (
							<GlobalAppGridCell align="left">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.project" defaultMessage="Project" />
								</Typography>
							</GlobalAppGridCell>
						)}
						<GlobalAppGridCell align="left" className="width70">
							<Typography variant="subtitle2">
								<FormattedMessage id="words.message" defaultMessage="Message" />
							</Typography>
						</GlobalAppGridCell>
						<GlobalAppGridCell align="left" className="width10">
							<FormattedMessage id="words.details" defaultMessage="Details" />
						</GlobalAppGridCell>
					</GlobalAppGridRow>
				</TableHead>
				<TableBody>
					{logEvents.map((logEvent, i) => (
						<GlobalAppGridRow key={i} className="hoverDisabled">
							<GlobalAppGridCell align="left" className="ellipsis">
								{logEvent.level}
							</GlobalAppGridCell>
							<GlobalAppGridCell align="left" className="ellipsis">
								{new Intl.DateTimeFormat(localeBranch.localeCode, localeBranch.dateTimeFormatOptions).format(
									new Date(logEvent.timestamp)
								)}
							</GlobalAppGridCell>
							<GlobalAppGridCell align="left" className="ellipsis">
								{logEvent.thread}
							</GlobalAppGridCell>
							{showSiteColumn && (
								<GlobalAppGridCell title={logEvent.site} align="left" className="ellipsis">
									{logEvent.site.replace(/(.{30})..+/, '$1...')}
								</GlobalAppGridCell>
							)}
							<GlobalAppGridCell title={logEvent.message} align="left" className="ellipsis maxWidth300">
								{logEvent.message}
							</GlobalAppGridCell>
							<GlobalAppGridCell align="left" className="action">
								<IconButton
									onClick={() => onLogEventDetails(logEvent)}
									size="large"
									aria-label={formatMessage({ defaultMessage: 'Event details' })}
								>
									<VisibilityRoundedIcon />
								</IconButton>
							</GlobalAppGridCell>
						</GlobalAppGridRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}

export default LogConsoleGridUI;
