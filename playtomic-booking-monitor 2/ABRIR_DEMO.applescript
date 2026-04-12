on run
	set appPath to POSIX path of (path to me)
	set quotedAppPath to quoted form of appPath
	set appDir to do shell script ("dirname " & quotedAppPath)
	set demoPath to appDir & "/demo.html"
	set quotedDemoPath to quoted form of demoPath
	
	try
		do shell script ("/usr/bin/open " & quotedDemoPath)
	on error errMsg
		display dialog "No he podido abrir la demo.\n\nRuta esperada: " & demoPath & "\n\nError: " & errMsg buttons {"OK"} default button "OK"
	end try
end run
