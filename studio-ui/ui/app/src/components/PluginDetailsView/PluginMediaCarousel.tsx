/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import React, { forwardRef, type ReactNode, useImperativeHandle, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { useIntl } from 'react-intl';
import { Theme } from '@mui/material';
import { SxProps } from '@mui/system';
import { consolidateSx } from '../../utils/system';

interface PluginMediaCarouselProps {
	items: ReactNode[];
	initialIndex?: number;
	onChangeItem?: (itemIndex: number) => void;
	sx?: SxProps<Theme>;
}

export const PluginMediaCarousel = forwardRef((props: PluginMediaCarouselProps, ref) => {
	const { items, initialIndex = 0, onChangeItem, sx } = props;
	const [index, setIndex] = useState(initialIndex);
	const { formatMessage } = useIntl();

	const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		setIndex((prev) => {
			const nextIndex = prev === 0 ? items.length - 1 : prev - 1;
			onChangeItem?.(nextIndex);
			return nextIndex;
		});
	};

	const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		setIndex((prev) => {
			const nextIndex = prev === items.length - 1 ? 0 : prev + 1;
			onChangeItem?.(nextIndex);
			return nextIndex;
		});
	};

	const moveToItem = (itemIndex: number) => {
		if (itemIndex >= 0 && itemIndex < items.length) {
			setIndex(itemIndex);
			onChangeItem?.(itemIndex);
		}
	};

	useImperativeHandle(ref, () => ({
		moveToItem
	}));

	return (
		<Box
			sx={consolidateSx(
				{
					position: 'relative',
					width: '100%',
					overflow: 'hidden',
					'& .navigate-button': { visibility: 'hidden' },
					'&:hover .navigate-button': { visibility: 'visible' },
					'& .navigate-button:focus-within': { visibility: 'visible' }
				},
				sx
			)}
		>
			{items?.length > 0 && (
				<>
					<Box
						sx={{
							display: 'flex',
							transition: 'transform 0.5s',
							width: `${items.length * 100}%`,
							transform: `translateX(-${index * (100 / items.length)}%)`
						}}
					>
						{items.map((item, i) => (
							<Box
								key={i}
								inert={i === index ? undefined : true}
								aria-hidden={i === index ? undefined : true}
								sx={{ width: `${100 / items.length}%`, flexShrink: 0 }}
							>
								{item}
							</Box>
						))}
					</Box>
					{items.length > 1 && (
						<>
							<Box
								className="navigate-button"
								sx={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)' }}
							>
								<IconButton
									onClick={handlePrev}
									sx={{ backgroundColor: (theme) => `${theme.palette.divider} !important` }}
									aria-label={formatMessage({ defaultMessage: 'Previous Item' })}
								>
									<NavigateBeforeRoundedIcon />
								</IconButton>
							</Box>
							<Box
								className="navigate-button"
								sx={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)' }}
							>
								<IconButton
									onClick={handleNext}
									sx={{ backgroundColor: (theme) => `${theme.palette.divider} !important` }}
									aria-label={formatMessage({ defaultMessage: 'Next Item' })}
								>
									<NavigateNextRoundedIcon />
								</IconButton>
							</Box>
						</>
					)}
				</>
			)}
		</Box>
	);
});

export default PluginMediaCarousel;
