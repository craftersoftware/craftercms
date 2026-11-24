<html lang="en">
	<head>
	</head>
	<body>
		<p>A deployment in server ${serverName} has exceeded the configured threshold of ${target.getRuntimeWarningThreshold()} seconds:</p>
		<ul>
			<li><b>Target ID:</b> ${target.id}</li>
			<li><b>Start:</b> ${payload.getStart().format(dateTimeFormatter)}</li>
			<li><b>Current runtime:</b> ${durationFormatter.apply(event.getRuntime())}</li>
		</ul>
		<#if outputAttached>
			<p>Attached you'll also find the full output of the deployment.</p>
		</#if>
	</body>
</html>
