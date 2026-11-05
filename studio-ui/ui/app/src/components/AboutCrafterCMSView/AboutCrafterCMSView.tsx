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
import GlobalAppToolbar from '../GlobalAppToolbar';
import { FormattedMessage } from 'react-intl';
import Paper from '@mui/material/Paper';
import CrafterCMSLogo from '../../icons/CrafterCMSLogo';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useSelection } from '../../hooks/useSelection';
import { useEnv } from '../../hooks/useEnv';

export function AboutCrafterCMSView() {
	const env = useEnv();
	const localeBranch = useSelection((state) => state.uiConfig.locale);

	return (
		<Paper elevation={0}>
			<Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 215px)' }}>
				<GlobalAppToolbar title={<FormattedMessage id="global.about" defaultMessage="About" />} />
				<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
					<Paper
						sx={{
							display: 'flex',
							padding: '30px',
							flexDirection: 'column',
							backgroundColor: (theme) => theme.palette.background.default,
							'& .row': {
								display: 'flex',
								marginTop: '10px',
								'& .aboutLabel': {
									marginRight: '10px'
								}
							}
						}}
					>
						<CrafterCMSLogo width={250} sxs={{ root: { margin: '0 auto 20px auto' } }} />
						<div className="row">
							<Typography variant="subtitle2" className={'aboutLabel'}>
								<FormattedMessage id="about.versionNumber" defaultMessage="Version Number" />:
							</Typography>
							<Typography variant="body2">{`${env.packageVersion}-${env.packageBuild?.substring(0, 6)}`}</Typography>
						</div>
						<div className="row">
							<Typography variant="subtitle2" className={'aboutLabel'}>
								<FormattedMessage id="about.buildNumber" defaultMessage="Build Number" />:
							</Typography>
							<Typography variant="body2">{env.packageBuild}</Typography>
						</div>
						<div className="row">
							<Typography variant="subtitle2" className={'aboutLabel'}>
								<FormattedMessage id="about.buildDate" defaultMessage="Build Date" />:
							</Typography>
							<Typography variant="body2">
								{new Intl.DateTimeFormat(localeBranch.localeCode, localeBranch.dateTimeFormatOptions).format(
									new Date(env.packageBuildDate)
								)}
							</Typography>
						</div>
						<Box sx={{ marginTop: '10px' }}>
							<Typography variant="body2">
								<FormattedMessage
									id="aboutView.attribution"
									defaultMessage="CrafterCMS is made possible by these other <a>open source software projects</a>."
									values={{
										a: (msg) => (
											<Link
												href={`https://craftercms.com/docs/current/contribute/acknowledgements.html`}
												target="_blank"
											>
												{msg}
											</Link>
										)
									}}
								/>
							</Typography>
						</Box>
					</Paper>
				</Box>
			</Box>
		</Paper>
	);
}

export default AboutCrafterCMSView;
