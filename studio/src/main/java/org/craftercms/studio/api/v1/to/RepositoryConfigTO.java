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
package org.craftercms.studio.api.v1.to;

import java.io.Serializable;
import java.util.List;

public class RepositoryConfigTO implements Serializable {

	private static final long serialVersionUID = 1148516942728141172L;

	/**
	 * level descriptor name
	 **/
	protected String levelDescriptorName;

	/**
	 * page path patterns
	 **/
	protected List<String> pagePatterns = null;
	/**
	 * component path patterns
	 **/
	protected List<String> componentPatterns = null;
	/**
	 * assets path patterns
	 **/
	protected List<String> assetPatterns = null;
	/**
	 * document path patterns
	 **/
	protected List<String> documentPatterns = null;
	/**
	 * rendering template path patterns
	 **/
	protected List<String> renderingTemplatePatterns = null;
	/**
	 * scripts path patterns
	 **/
	protected List<String> scriptsPatterns = null;
	/**
	 * Configuration path patterns
	 */
	protected List<String> configurationPatterns = null;

	/**
	 * @param pagePatterns the pagePatterns to set
	 */
	public void setPagePatterns(List<String> pagePatterns) {
		this.pagePatterns = pagePatterns;
	}

	/**
	 * @return the pagePatterns
	 */
	public List<String> getPagePatterns() {
		return pagePatterns;
	}

	/**
	 * @param componentPatterns the componentPatterns to set
	 */
	public void setComponentPatterns(List<String> componentPatterns) {
		this.componentPatterns = componentPatterns;
	}

	/**
	 * @return the componentPatterns
	 */
	public List<String> getComponentPatterns() {
		return componentPatterns;
	}

	/**
	 * @param assetPatterns the assetPatterns to set
	 */
	public void setAssetPatterns(List<String> assetPatterns) {
		this.assetPatterns = assetPatterns;
	}

	/**
	 * @return the assetPatterns
	 */
	public List<String> getAssetPatterns() {
		return assetPatterns;
	}

	/**
	 * @param levelDescriptorName the levelDescriptorName to set
	 */
	public void setLevelDescriptorName(String levelDescriptorName) {
		this.levelDescriptorName = levelDescriptorName;
	}

	/**
	 * @return the levelDescriptorName
	 */
	public String getLevelDescriptorName() {
		return levelDescriptorName;
	}

	/**
	 * @param documentPatterns the documentPatterns to set
	 */
	public void setDocumentPatterns(List<String> documentPatterns) {
		this.documentPatterns = documentPatterns;
	}

	/**
	 * @return the documentPatterns
	 */
	public List<String> getDocumentPatterns() {
		return documentPatterns;
	}

	public List<String> getRenderingTemplatePatterns() {
		return this.renderingTemplatePatterns;
	}

	public void setRenderingTemplatePatterns(List<String> paterns) {
		this.renderingTemplatePatterns = paterns;
	}

	public List<String> getScriptsPatterns() {
		return scriptsPatterns;
	}

	public void setScriptsPatterns(List<String> scriptsPatterns) {
		this.scriptsPatterns = scriptsPatterns;
	}

	public List<String> getConfigurationPatterns() {
		return configurationPatterns;
	}

	public void setConfigurationPatterns(List<String> configurationPatterns) {
		this.configurationPatterns = configurationPatterns;
	}
}
