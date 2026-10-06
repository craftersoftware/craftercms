/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.model.rest;

import org.apache.commons.lang3.StringUtils;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public class PullFromRemoteRequest {

	public enum MergeStrategy {
		theirs,
		ours,
		none
	}

	@NotEmpty
	@Size(max = 50)
	private String remoteName;

	@NotEmpty
	private String remoteBranch;

	private MergeStrategy mergeStrategy = MergeStrategy.none;

	public String getRemoteName() {
		return remoteName;
	}

	public void setRemoteName(String remoteName) {
		this.remoteName = remoteName;
	}

	public String getRemoteBranch() {
		return remoteBranch;
	}

	public void setRemoteBranch(String remoteBranch) {
		this.remoteBranch = remoteBranch;
	}

	public String getMergeStrategy() {
		return mergeStrategy.toString();
	}

	public void setMergeStrategy(String mergeStrategy) {
		this.mergeStrategy = StringUtils.isEmpty(mergeStrategy) ? MergeStrategy.none : MergeStrategy.valueOf(mergeStrategy);
	}
}
