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

package org.craftercms.studio.api.v1.to;

import java.util.List;
import java.util.Map;

public class DependencyResolverConfigTO {

	private Map<String, ItemType> itemTypes;

	public Map<String, ItemType> getItemTypes() {
		return itemTypes;
	}

	public void setItemTypes(Map<String, ItemType> itemTypes) {
		this.itemTypes = itemTypes;
	}

	public static class ItemType {

		private List<String> includes;
		private List<String> excludes;
		private Map<String, DependencyType> dependencyTypes;

		public List<String> getIncludes() {
			return includes;
		}

		public void setIncludes(List<String> includes) {
			this.includes = includes;
		}

		public List<String> getExcludes() {
			return excludes;
		}

		public void setExcludes(List<String> excludes) {
			this.excludes = excludes;
		}

		public Map<String, DependencyType> getDependencyTypes() {
			return dependencyTypes;
		}

		public void setDependencyTypes(Map<String, DependencyType> dependencyTypes) {
			this.dependencyTypes = dependencyTypes;
		}
	}

	public static class DependencyType {

		private String name;
		private List<DependencyExtractionPattern> includes;

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		public List<DependencyExtractionPattern> getIncludes() {
			return includes;
		}

		public void setIncludes(List<DependencyExtractionPattern> includes) {
			this.includes = includes;
		}
	}

	public static class DependencyExtractionPattern {

		private String findRegex;
		private List<DependencyExtractionTransform> transforms;

		public String getFindRegex() {
			return findRegex;
		}

		public void setFindRegex(String findRegex) {
			this.findRegex = findRegex;
		}

		public List<DependencyExtractionTransform> getTransforms() {
			return transforms;
		}

		public void setTransforms(List<DependencyExtractionTransform> transforms) {
			this.transforms = transforms;
		}
	}

	public static class DependencyExtractionTransform {

		private String match;
		private String replace;
		private boolean split;
		private String delimiter;

		public String getMatch() {
			return match;
		}

		public void setMatch(String match) {
			this.match = match;
		}

		public String getReplace() {
			return replace;
		}

		public void setReplace(String replace) {
			this.replace = replace;
		}

		public boolean isSplit() {
			return split;
		}

		public void setSplit(boolean split) {
			this.split = split;
		}

		public String getDelimiter() {
			return delimiter;
		}

		public void setDelimiter(String delimiter) {
			this.delimiter = delimiter;
		}

	}
}
