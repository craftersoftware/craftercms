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

	<!-- Grant content_move on every rule that already grants content_write. A second run adds nothing. -->
	<xsl:template match="allowed-permissions[permission = 'content_write' and not(permission = 'content_move')]">
		<xsl:copy>
			<xsl:apply-templates select="@*|node()"/>
			<xsl:element name="permission">
				<xsl:text>content_move</xsl:text>
			</xsl:element>
		</xsl:copy>
	</xsl:template>

</xsl:stylesheet>
