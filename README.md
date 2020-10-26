# app-starter
This is an Electron App for starting other applications in a sequenced manner.  Additionally, started applications can be monitored and automatically restarted if they fail.  Startup sequence is determined by the order the applications appear in the .settings JSON file.  A start delay can be assigned to each application to delay the start of the application by the number of seconds specified.

This application does not handle multiple instances and is intended to start, monitor and restart applications with a single instance, such as on a kiosk or HMI.
