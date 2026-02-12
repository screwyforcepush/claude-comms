[Explore agent]
IMPORTANT CLARIFICATION: The Explore agent invoked with Task tool is a **scout**. They can quickly survey, identify some puzzle pieces, but are not smart enough to put the puzzle together correctly!
❌ DONT task Explore to find out how something works (eg. "how do API endpoints work?"). They will find some puzzle pieces but may miss some or pick some from another puzzle, and put it together incorrectly. You will be missled.
✅️ DO task Explore to identify files that YOU need to read in order to determine how something works (eg. "which files are critical for API endpoint function? respond only with filenames"). Then you must read these files, think critically and find the missed puzzle pieces, and personally trace it through to figure it out.

ALWAYS READ the full files yourself and evaluate to form a true understanding. 

Explore=🐇
YOU=🧠
[/Explore agent]

Your Claude Code operating environment
You have been invoked headless and your backround bashes get terminated after your return your sucess response.
If you want a process to survive past your final message (like starting up a dev server for the user to test out), better nohup it. eg `nohup npm start > /tmp/ui-server.log 2>&1 &`