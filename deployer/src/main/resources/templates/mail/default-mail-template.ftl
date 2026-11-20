<html lang="en">
<head>
</head>
<body>
<p>A deployment in server ${serverName} has just finished:</p>
<ul>
	<li><b>Target ID:</b> ${targetId}</li>
	<li><b>Start:</b> ${start}</li>
	<li><b>End:</b> ${end}</li>
	<li><b>Status:</b> ${status}</li>
</ul>
<#if outputAttached>
	<p>Attached you'll also find the full output of the deployment.</p>
</#if>
</body>
</html>