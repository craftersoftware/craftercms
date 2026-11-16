<?xml version="1.0" encoding="UTF-8"?>
<!--
  ~ Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
  ~
  ~ This program is free software: you can redistribute it and/or modify
  ~ it under the terms of the GNU General Public License version 3 as published by
  ~ the Free Software Foundation.
  ~
  ~ This program is distributed in the hope that it will be useful,
  ~ but WITHOUT ANY WARRANTY; without even the implied warranty of
  ~ MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  ~ GNU General Public License for more details.
  ~
  ~ You should have received a copy of the GNU General Public License
  ~ along with this program.  If not, see <http://www.gnu.org/licenses/>.
  -->
<xsl:stylesheet version="2.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <!-- Identity template: copy everything by default -->
    <xsl:template match="@*|node()">
        <xsl:copy>
            <xsl:apply-templates select="@*|node()"/>
        </xsl:copy>
    </xsl:template>

    <!-- Replace an unidentified <label>Pages</label>. An existing id is a translation the site already chose. -->
    <xsl:template match="label[not(@id) and normalize-space(text())='Pages']">
        <label id="pathNavigatorTree.pages" defaultMessage="Pages"/>
    </xsl:template>

    <!-- Replace <label>Components</label> -->
    <xsl:template match="label[not(@id) and normalize-space(text())='Components']">
        <label id="pathNavigatorTree.components" defaultMessage="Components"/>
    </xsl:template>

    <!-- Replace <label>Items</label> -->
    <xsl:template match="label[not(@id) and normalize-space(text())='Items']">
        <label id="pathNavigatorTree.items" defaultMessage="Items"/>
    </xsl:template>

    <!-- Replace <label>Taxonomy</label> -->
    <xsl:template match="label[not(@id) and normalize-space(text())='Taxonomy']">
        <label id="pathNavigatorTree.taxonomy" defaultMessage="Taxonomy"/>
    </xsl:template>

    <!-- Replace <label>Static Assets</label> -->
    <xsl:template match="label[not(@id) and normalize-space(text())='Static Assets']">
        <label id="pathNavigatorTree.staticAssets" defaultMessage="Static Assets"/>
    </xsl:template>

    <!-- Replace <label>Templates</label> -->
    <xsl:template match="label[not(@id) and normalize-space(text())='Templates']">
        <label id="pathNavigatorTree.templates" defaultMessage="Templates"/>
    </xsl:template>

    <!-- Replace <label>Scripts</label> -->
    <xsl:template match="label[not(@id) and normalize-space(text())='Scripts']">
        <label id="pathNavigatorTree.scripts" defaultMessage="Scripts"/>
    </xsl:template>

    <!-- PreviewAudiencesPanel changes. The same id guard applies to name, label, and helpText. -->
    <xsl:template match="widget[@id='craftercms.components.PreviewAudiencesPanel']//name[not(@id) and normalize-space(text())='Segment']">
        <name id="previewAudiencesPanel.segmentLabel" defaultMessage="Segment"/>
    </xsl:template>

    <xsl:template match="widget[@id='craftercms.components.PreviewAudiencesPanel']//label[not(@id) and normalize-space(text())='Guy']">
        <label id="previewAudiencesPanel.guyValueLabel" defaultMessage="Guy"/>
    </xsl:template>

    <xsl:template match="widget[@id='craftercms.components.PreviewAudiencesPanel']//label[not(@id) and normalize-space(text())='Gal']">
        <label id="previewAudiencesPanel.galValueLabel" defaultMessage="Gal"/>
    </xsl:template>

    <xsl:template match="widget[@id='craftercms.components.PreviewAudiencesPanel']//label[not(@id) and normalize-space(text())='Anonymous']">
        <label id="previewAudiencesPanel.anonymousValueLabel" defaultMessage="Anonymous"/>
    </xsl:template>

    <xsl:template match="widget[@id='craftercms.components.PreviewAudiencesPanel']//helpText[not(@id) and normalize-space(text())='Setting the segment will change content targeting to the audience selected.']">
        <helpText id="previewAudiencesPanel.segmentHelpText" defaultMessage="Setting the segment will change content targeting to the audience selected"/>
    </xsl:template>

    <xsl:template match="widget[@id='craftercms.components.PreviewAudiencesPanel']//name[not(@id) and normalize-space(text())='Name']">
        <name id="previewAudiencesPanel.nameLabel" defaultMessage="Name"/>
    </xsl:template>

    <xsl:template match="widget[@id='craftercms.components.PreviewAudiencesPanel']//helpText[not(@id) and normalize-space(text())='Enter user''s first and last name.']">
        <helpText id="previewAudiencesPanel.nameHelpText" defaultMessage="Enter user's first and last name"/>
    </xsl:template>

</xsl:stylesheet>
