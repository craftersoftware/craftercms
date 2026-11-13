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
    <!-- Add the catalog after the last top-level widget when that widget is missing. -->
    <xsl:template match="siteUi/widget[last()]">
        <xsl:copy>
            <xsl:apply-templates select="@*"/>
            <xsl:apply-templates select="node()"/>
        </xsl:copy>
        <xsl:if test="not(../widget[@id='craftercms.components.ContentTypeManagement'])">
            <xsl:call-template name="contentTypeManagementWidget"/>
        </xsl:if>
    </xsl:template>

    <!-- widget[last()] does not match when siteUi has no top-level widget. Append the catalog
         without reordering the existing children. Nested tool references do not count. -->
    <xsl:template match="siteUi[not(widget)]">
        <xsl:copy>
            <xsl:apply-templates select="@*|node()"/>
            <xsl:call-template name="contentTypeManagementWidget"/>
        </xsl:copy>
    </xsl:template>

    <xsl:template name="contentTypeManagementWidget">
            <widget id="craftercms.components.ContentTypeManagement">
                <configuration>
                    <objectTypes>
                        <objectType id="page">
                            <descriptor>
                                <name>Page</name>
                                <type>page</type>
                                <fields>
                                    <file-name>
                                        <defaultValue/>
                                        <description/>
                                        <helpText/>
                                        <id>file-name</id>
                                        <name>Page URL</name>
                                        <type>file-name</type>
                                    </file-name>
                                    <internal-name>
                                        <defaultValue/>
                                        <description/>
                                        <helpText/>
                                        <id>internal-name</id>
                                        <name>Internal Name</name>
                                        <type>input</type>
                                    </internal-name>
                                    <navLabel>
                                        <defaultValue/>
                                        <description/>
                                        <helpText/>
                                        <id>navLabel</id>
                                        <name>Nav Label</name>
                                        <type>input</type>
                                    </navLabel>
                                    <placeInNav>
                                        <defaultValue/>
                                        <description/>
                                        <helpText/>
                                        <id>placeInNav</id>
                                        <name>Place In Nav</name>
                                        <type>page-nav-order</type>
                                    </placeInNav>
                                </fields>
                                <sections title="System Properties">
                                    <id>defaultSection</id>
                                    <color>rgba(255,0,0,.7)</color>
                                    <title>System Properties</title>
                                    <expandByDefault>true</expandByDefault>
                                    <fields>file-name</fields>
                                    <fields>internal-name</fields>
                                    <fields>placeInNav</fields>
                                    <fields>navLabel</fields>
                                </sections>
                            </descriptor>
                        </objectType>
                        <objectType id="component">
                            <descriptor>
                                <name>Component</name>
                                <type>component</type>
                                <fields>
                                    <file-name>
                                        <defaultValue/>
                                        <description/>
                                        <helpText/>
                                        <id>file-name</id>
                                        <name>Component ID</name>
                                        <type>auto-filename</type>
                                    </file-name>
                                    <internal-name>
                                        <defaultValue/>
                                        <description/>
                                        <helpText/>
                                        <id>internal-name</id>
                                        <name>Internal Name</name>
                                        <type>input</type>
                                    </internal-name>
                                </fields>
                                <sections title="System Properties">
                                    <id>defaultSection</id>
                                    <color>rgba(255,0,0,.7)</color>
                                    <title>System Properties</title>
                                    <expandByDefault>true</expandByDefault>
                                    <fields>file-name</fields>
                                    <fields>internal-name</fields>
                                </sections>
                            </descriptor>
                        </objectType>
                    </objectTypes>
                    <controls>
                        <control id="repeat">
                            <icon id="@mui/icons-material/ReplayOutlined"/>
                        </control>
                        <control id="input">
                            <icon id="@mui/icons-material/DriveFileRenameOutlineOutlined"/>
                        </control>
                        <control id="input-email">
                            <icon id="@mui/icons-material/AlternateEmailOutlined"/>
                        </control>
                        <control id="input-link">
                            <icon id="@mui/icons-material/LinkOutlined"/>
                        </control>
                        <control id="input-phone">
                            <icon id="@mui/icons-material/PhoneAndroidOutlined"/>
                        </control>
                        <control id="numeric-input">
                            <icon id="@mui/icons-material/PinOutlined"/>
                        </control>
                        <control id="textarea">
                            <icon id="@mui/icons-material/NotesOutlined"/>
                        </control>
                        <control id="rte">
                            <icon id="@mui/icons-material/CodeOutlined"/>
                        </control>
                        <control id="dropdown">
                            <icon id="@mui/icons-material/ArrowDropDownOutlined"/>
                        </control>
                        <control id="time">
                            <icon id="@mui/icons-material/AccessTimeOutlined"/>
                        </control>
                        <control id="date-time">
                            <icon id="@mui/icons-material/CalendarMonthOutlined"/>
                        </control>
                        <control id="checkbox">
                            <icon id="@mui/icons-material/CheckBoxOutlined"/>
                        </control>
                        <control id="checkbox-group">
                            <icon id="@mui/icons-material/ChecklistOutlined"/>
                        </control>
                        <control id="node-selector">
                            <icon id="@mui/icons-material/ZoomInMapOutlined"/>
                        </control>
                        <control id="image-picker">
                            <icon id="@mui/icons-material/InsertPhotoOutlined"/>
                        </control>
                        <control id="video-picker">
                            <icon id="@mui/icons-material/VideocamOutlined"/>
                        </control>
                        <control id="transcoded-video-picker">
                            <icon id="@mui/icons-material/VideocamOutlined"/>
                        </control>
                        <control id="label">
                            <icon id="@mui/icons-material/SellOutlined"/>
                        </control>
                        <control id="page-nav-order">
                            <icon id="@mui/icons-material/ImportExportOutlined"/>
                        </control>
                        <control id="file-name">
                            <icon id="@mui/icons-material/InsertDriveFileOutlined"/>
                        </control>
                        <control id="auto-filename">
                            <icon id="@mui/icons-material/DescriptionOutlined"/>
                        </control>
                        <control id="internal-name">
                            <icon id="@mui/icons-material/FontDownloadOutlined"/>
                        </control>
                        <control id="locale-selector">
                            <icon id="@mui/icons-material/PublicOutlined"/>
                        </control>
                        <control id="disabled">
                            <icon id="@mui/icons-material/NotInterestedOutlined"/>
                        </control>
                        <control id="forcehttps">
                            <icon id="@mui/icons-material/HttpsOutlined"/>
                        </control>
                        <control id="uuid">
                            <icon id="@mui/icons-material/BadgeOutlined"/>
                        </control>
                        <control id="expired-date">
                            <icon id="@mui/icons-material/EventBusyOutlined"/>
                        </control>
                    </controls>
                    <dataSources>
                        <dataSource id="components">
                            <icon id="@mui/icons-material/ExtensionOutlined"/>
                        </dataSource>
                        <dataSource id="shared-content">
                            <icon id="@mui/icons-material/ShareOutlined"/>
                        </dataSource>
                        <dataSource id="embedded-content">
                            <icon id="@mui/icons-material/AdjustOutlined"/>
                        </dataSource>
                        <dataSource id="img-desktop-upload">
                            <icon id="@mui/icons-material/InsertPhotoOutlined"/>
                        </dataSource>
                        <dataSource id="img-repository-upload">
                            <icon id="@mui/icons-material/InsertPhotoOutlined"/>
                        </dataSource>
                        <dataSource id="file-desktop-upload">
                            <icon id="@mui/icons-material/UploadFileOutlined"/>
                        </dataSource>
                        <dataSource id="file-browse-repo">
                            <icon id="@mui/icons-material/PanToolAltOutlined"/>
                        </dataSource>
                        <dataSource id="WebDAV-repo">
                            <icon id="@mui/icons-material/DnsOutlined"/>
                        </dataSource>
                        <dataSource id="img-WebDAV-repo">
                            <icon id="@mui/icons-material/DnsOutlined"/>
                        </dataSource>
                        <dataSource id="video-WebDAV-repo">
                            <icon id="@mui/icons-material/DnsOutlined"/>
                        </dataSource>
                        <dataSource id="WebDAV-upload">
                            <icon id="@mui/icons-material/DnsOutlined"/>
                        </dataSource>
                        <dataSource id="img-WebDAV-upload">
                            <icon id="@mui/icons-material/DnsOutlined"/>
                        </dataSource>
                        <dataSource id="video-WebDAV-upload">
                            <icon id="@mui/icons-material/DnsOutlined"/>
                        </dataSource>
                        <dataSource id="S3-repo">
                            <icon id="@mui/icons-material/InsertDriveFileOutlined"/>
                        </dataSource>
                        <dataSource id="img-S3-repo">
                            <icon id="@mui/icons-material/InsertPhotoOutlined"/>
                        </dataSource>
                        <dataSource id="video-S3-repo">
                            <icon id="@mui/icons-material/VideocamOutlined"/>
                        </dataSource>
                        <dataSource id="S3-upload">
                            <icon id="@mui/icons-material/InsertDriveFileOutlined"/>
                        </dataSource>
                        <dataSource id="img-S3-upload">
                            <icon id="@mui/icons-material/InsertPhotoOutlined"/>
                        </dataSource>
                        <dataSource id="video-S3-upload">
                            <icon id="@mui/icons-material/VideocamOutlined"/>
                        </dataSource>
                        <dataSource id="video-S3-transcoding">
                            <icon id="@mui/icons-material/VideocamOutlined"/>
                        </dataSource>
                        <dataSource id="video-desktop-upload">
                            <icon id="@mui/icons-material/VideocamOutlined"/>
                        </dataSource>
                        <dataSource id="video-browse-repo">
                            <icon id="@mui/icons-material/VideocamOutlined"/>
                        </dataSource>
                        <dataSource id="key-value-list">
                            <icon id="@mui/icons-material/KeyOutlined"/>
                        </dataSource>
                        <dataSource id="simpleTaxonomy">
                            <icon id="@mui/icons-material/StyleOutlined"/>
                        </dataSource>
                        <dataSource id="audio-desktop-upload">
                            <icon id="@mui/icons-material/AudioFileOutlined"/>
                        </dataSource>
                        <dataSource id="audio-browse-repo">
                            <icon id="@mui/icons-material/AudioFileOutlined"/>
                        </dataSource>
                        <dataSource id="configured-list">
                            <icon id="@mui/icons-material/AudioFileOutlined"/>
                        </dataSource>
                    </dataSources>
                </configuration>
            </widget>
    </xsl:template>
</xsl:stylesheet>
