# README.md
high level how to use quick start:
    Set up server:
    git clone this repo
    probably need to do some install in the apps/server and apps/client/ (TODO make a ./scripts/install.sh to auto do this or have it check and do in the start-system.sh)
    ./scripts/start-system.sh to start it 

    in the project you want to use it:
    npx claude-comms
    launch claude, --dangerously-skip-permissions flag if you like
    /cook <what you want to build, requirements spec, etc>


aditional commands
./scripts/restart-system.sh restarts everything and can clear the db


high level system architecture

links to guides and other references


# docs/
needs complete overhaul

dont touch spec and tech-docs subdirs

project/guides/ should contain a minimal set of 5-10 highly informative documents covering different aspects of the system including a self reflective system orchestration document
clear out project/phases/ . I want it empty. some things of value in there to include in guides but the phases docs were point in time documents and mostly stale.