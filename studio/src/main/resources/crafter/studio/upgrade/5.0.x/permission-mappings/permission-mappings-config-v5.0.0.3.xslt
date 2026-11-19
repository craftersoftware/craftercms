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

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">

	<!-- to keep the right formatting -->
	<xsl:output method="xml" indent="yes"/>
	<xsl:strip-space elements="*"/>

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

	<!-- The stock author rule does not match the home folder. Widen only that exact regex. -->
	<xsl:template match="role[@name='author']/rule/@regex[. = '/site/website/.*|/site/components(/.*)?|/static-assets(/.*)?']">
		<xsl:attribute name="regex">
			<xsl:text>/site/website(/.*)?|/site/components(/.*)?|/static-assets(/.*)?</xsl:text>
		</xsl:attribute>
	</xsl:template>

	<!-- content_create is retired. A rule that already grants content_write keeps that permission. -->
	<xsl:template match="permission[. = 'content_create' and ../permission = 'content_write']"/>

	<!-- A rule that only had content_create keeps the ability to create through content_write. -->
	<xsl:template match="permission[. = 'content_create' and not(../permission = 'content_write')]">
		<xsl:element name="permission">
			<xsl:text>content_write</xsl:text>
		</xsl:element>
		<xsl:if test="not(../permission = 'content_move')">
			<xsl:element name="permission">
				<xsl:text>content_move</xsl:text>
			</xsl:element>
		</xsl:if>
	</xsl:template>

</xsl:stylesheet>
