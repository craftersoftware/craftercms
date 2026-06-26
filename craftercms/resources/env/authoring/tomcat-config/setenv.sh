#!/bin/bash
if [ "$(whoami)" == "root" ]; then
	echo -e "\033[38;5;196m"
	echo -e "CrafterCMS cowardly refuses to run as root."
    echo -e "Running as root is dangerous and is not supported."
    echo -e "\033[0m"
	exit 1
fi

# Opts used only in Tomcat start
CATALINA_OPTS="$CATALINA_OPTS -Dtomcat.host=$TOMCAT_HOST -Dtomcat.http.port=$TOMCAT_HTTP_PORT \
  -Dtomcat.https.port=$TOMCAT_HTTPS_PORT -Dtomcat.ajp.port=$TOMCAT_AJP_PORT \
  -Dtomcat.debug.port=$TOMCAT_DEBUG_PORT -Dcrafter.home=$CRAFTER_HOME \
  -Dcrafter.bin.dir=$CRAFTER_BIN_DIR -Dcrafter.data.dir=$CRAFTER_DATA_DIR -Dcrafter.logs.dir=$CRAFTER_LOGS_DIR \
  -Dcatalina.logs=$CATALINA_LOGS_DIR -Dapplication.logs=$CATALINA_LOGS_DIR -Djava.net.preferIPv4Stack=true \
	-Dgrape.root=$CRAFTER_BIN_DIR"
# Opts used in both Tomcat start and stop
JAVA_OPTS="$JAVA_OPTS -Dtomcat.shutdown.port=$TOMCAT_SHUTDOWN_PORT"
JAVA_OPTS="$JAVA_OPTS -Dorg.owasp.esapi.logSpecial.discard=true"
UMASK=$(umask)
