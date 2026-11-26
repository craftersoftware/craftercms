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

<!--
  XSLT to generate an intermediate XSLT from config.xml, which will then be used to transform form-definition.xml.
  The generated XSLT will copy the elements: previewable, paths, delete-dependencies, copy-dependencies, and allowed-roles from config.xml into form-definition.xml.
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
    <xsl:output method="xml" indent="yes"/>
    <xsl:strip-space elements="*"/>
    <xsl:param name="configFileName"/>

    <!-- copy all elements -->
    <xsl:template match="node() | @*">
        <!-- insert line breaks before comments -->
        <xsl:if test="self::comment()">
            <xsl:text>&#10;</xsl:text>
        </xsl:if>
        <xsl:copy>
            <xsl:apply-templates select="node() | @*"/>
        </xsl:copy>
        <!-- insert line breaks after comments -->
        <xsl:if test="self::comment()">
            <xsl:text>&#10;</xsl:text>
        </xsl:if>
    </xsl:template>

    <xsl:template match="form">
        <xsl:copy>
            <xsl:apply-templates select="node() | @*"/>
            <xsl:copy-of select="document($configFileName)/content-type/previewable"/>
            <xsl:copy-of select="document($configFileName)/content-type/paths"/>
            <xsl:copy-of select="document($configFileName)/content-type/delete-dependencies"/>
            <xsl:copy-of select="document($configFileName)/content-type/copy-dependencies"/>
            <xsl:copy-of select="document($configFileName)/content-type/allowed-roles"/>
        </xsl:copy>
    </xsl:template>
</xsl:stylesheet>

