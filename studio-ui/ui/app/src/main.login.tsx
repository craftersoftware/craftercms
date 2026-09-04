import { createRoot } from 'react-dom/client';
import React, { StrictMode, Suspense, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Login from './pages/Login';
import { LoginViewProps } from './components/LoginView/LoginView';
import CrafterThemeProvider from './components/CrafterThemeProvider';
import I18nProvider from './components/I18nProvider';
import GlobalStyles from './components/GlobalStyles';
import ErrorState from './components/ErrorState';
import { applyUiBootstrapSideEffects, fetchUiBootstrap } from './services/environment';

interface LockedBootData {
	lockedErrorMessage: string | null;
	lockedTimeSeconds: number | null;
}

function parseLockedBootData(): LockedBootData {
	const el = document.getElementById('bootData');
	const json = el?.textContent?.trim();
	if (!json) {
		return { lockedErrorMessage: null, lockedTimeSeconds: null };
	}
	return JSON.parse(json);
}

function LoginBootstrap() {
	const [props, setProps] = useState<LoginViewProps | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		const locked = parseLockedBootData();
		const subscription = fetchUiBootstrap().subscribe({
			next: (bootstrap) => {
				applyUiBootstrapSideEffects(bootstrap);
				setProps({
					xsrfToken: bootstrap.xsrfToken,
					xsrfParamName: bootstrap.xsrfArgument,
					passwordRequirementsMinComplexity: bootstrap.passwordRequirementsMinComplexity,
					lockedErrorMessage: locked.lockedErrorMessage ?? undefined,
					lockedTimeSeconds: locked.lockedTimeSeconds ?? undefined
				});
			},
			error: () => setError(true)
		});
		return () => subscription.unsubscribe();
	}, []);

	if (error) {
		return (
			<I18nProvider>
				<CrafterThemeProvider>
					<Box
						sx={{
							height: '100%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							background: 'url("/studio/static-assets/images/cogs.jpg") 0 0 no-repeat',
							backgroundSize: 'cover'
						}}
					>
						<ErrorState
							title="Unable to load login"
							imageUrl="/studio/static-assets/images/warning_state.svg"
							sxs={{
								title: { textAlign: 'center' },
								image: { width: 250, marginBottom: '10px', marginTop: '10px' }
							}}
						/>
					</Box>
					<GlobalStyles />
				</CrafterThemeProvider>
			</I18nProvider>
		);
	}

	if (!props) {
		return (
			<Box
				sx={{
					height: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: 'url("/studio/static-assets/images/cogs.jpg") 0 0 no-repeat',
					backgroundSize: 'cover'
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return <Login {...props} />;
}

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<Suspense>
			<LoginBootstrap />
		</Suspense>
	</StrictMode>
);
