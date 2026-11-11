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

import { Repository } from '../../../models/Repository';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import GlobalAppGridRow from '../../GlobalAppGridRow';
import GlobalAppGridCell from '../../GlobalAppGridCell';
import Typography from '@mui/material/Typography';
import { FormattedMessage, useIntl } from 'react-intl';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import React from 'react';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ConfirmDropdown from '../../ConfirmDropdown';

export interface RepoGridUIProps {
	repositories: Array<Repository>;
	disableActions: boolean;
	onPullClick(remoteName: string, branches: string[]): void;
	onPushClick(remoteName: string, branches: string[]): void;
	onDeleteRemote(remoteName: string): void;
}

export function RepoGridUI(props: RepoGridUIProps) {
	const { repositories, disableActions, onDeleteRemote, onPullClick, onPushClick } = props;
	const { formatMessage } = useIntl();
	return (
		<TableContainer>
			<Table>
				<RepositoriesGridTableHead />
				<TableBody>
					{repositories?.map((repository) => (
						<GlobalAppGridRow key={repository.name} className="hoverDisabled">
							<GlobalAppGridCell align="left">{repository.name}</GlobalAppGridCell>
							<GlobalAppGridCell align="left">{repository.url}</GlobalAppGridCell>
							<GlobalAppGridCell align="left">{repository.fetch}</GlobalAppGridCell>
							<GlobalAppGridCell align="left">{repository.pushUrl}</GlobalAppGridCell>
							<GlobalAppGridCell align="right">
								<Tooltip title={<FormattedMessage id="words.pull" defaultMessage="Pull" />}>
									<span>
										<IconButton
											onClick={() => onPullClick(repository.name, repository.branches)}
											disabled={disableActions}
											size="large"
											aria-label={formatMessage({ id: 'words.pull', defaultMessage: 'Pull' })}
										>
											<ArrowDownwardRoundedIcon />
										</IconButton>
									</span>
								</Tooltip>
								<Tooltip title={<FormattedMessage id="words.push" defaultMessage="Push" />}>
									<span>
										<IconButton
											onClick={() => onPushClick(repository.name, repository.branches)}
											disabled={disableActions}
											size="large"
											aria-label={formatMessage({ id: 'words.push', defaultMessage: 'Push' })}
										>
											<ArrowUpwardRoundedIcon />
										</IconButton>
									</span>
								</Tooltip>
								<ConfirmDropdown
									cancelText={<FormattedMessage id="words.no" defaultMessage="No" />}
									confirmText={<FormattedMessage id="words.yes" defaultMessage="Yes" />}
									confirmHelperText={
										<FormattedMessage id="repositories.deleteConfirmation" defaultMessage="Delete remote repository?" />
									}
									iconTooltip={<FormattedMessage id="words.delete" defaultMessage="Delete" />}
									iconLabel={formatMessage({ defaultMessage: 'Delete {name}' }, { name: repository.name })}
									icon={DeleteRoundedIcon}
									onConfirm={() => {
										onDeleteRemote(repository.name);
									}}
									disabled={disableActions}
								/>
							</GlobalAppGridCell>
						</GlobalAppGridRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}

export function RepositoriesGridTableHead() {
	return (
		<TableHead>
			<GlobalAppGridRow className="hoverDisabled">
				<GlobalAppGridCell>
					<Typography variant="subtitle2">
						<FormattedMessage id="words.name" defaultMessage="Name" />
					</Typography>
				</GlobalAppGridCell>
				<GlobalAppGridCell>
					<Typography variant="subtitle2">
						<FormattedMessage id="words.url" defaultMessage="Url" />
					</Typography>
				</GlobalAppGridCell>
				<GlobalAppGridCell>
					<Typography variant="subtitle2">
						<FormattedMessage id="words.fetch" defaultMessage="Fetch" />
					</Typography>
				</GlobalAppGridCell>
				<GlobalAppGridCell>
					<Typography variant="subtitle2">
						<FormattedMessage id="repositories.pushUrl" defaultMessage="Push URL" />
					</Typography>
				</GlobalAppGridCell>
				<GlobalAppGridCell />
			</GlobalAppGridRow>
		</TableHead>
	);
}

export default RepoGridUI;
