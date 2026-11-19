<#ftl output_format="HTML" auto_esc=true>
<html lang="en">
	<head>
	</head>
	<body>
		<p>The disk usage on the server has exceeded the defined threshold. Please review the details below:</p>
		<ul>
			<li><b>Server Name:</b> ${serverName}</li>
			<li><b>Disk Usage:</b> ${payload.diskInfo.diskUsage}%</li>
			<li><b>High Usage Watermark:</b> ${payload.highWaterMark}%</li>
			<li><b>Total Space:</b> ${byteCountToDisplaySize.apply(payload.diskInfo.totalSpace)}</li>
			<li><b>Used Space:</b> ${byteCountToDisplaySize.apply(payload.diskInfo.usedSpace)}</li>
			<li><b>Free Space:</b> ${byteCountToDisplaySize.apply(payload.diskInfo.freeSpace)}</li>
		</ul>
		<#if outputAttached>
			<p>See attached document for additional details.</p>
		</#if>
	</body>
</html>
