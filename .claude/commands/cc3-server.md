start the claude comms servers for the user

# CC2 server and UI:
`./scripts/start-system.sh`

# CC3 backend and UI
1. check if exists and create if not:
`nohup workflow-engine/ui/config.json`

2. ask the user for convex url or if they want local
tradeoff is local the client needs to run on same machine or use docker port forward or something. convex cloud removes that barrier.
if cloud then you will need deploy url and deploy key for prod if they want. `workflow-engine/.env`
if local you can npx convex dev

3. when you have set the convex url then start the UI `cd workflow-engine/ui && nohup npm start > /tmp/ui-server.log 2>&1 &`


4 when all up and running. tell user to:
run `npx claude-comms` in their client repo (the one they want to do work on)
run claude with `/cc3-client` to setup the client with the same convex url